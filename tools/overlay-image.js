import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;
const ANCHORS = [
  ["top-left", "Top left"], ["top-center", "Top centre"], ["top-right", "Top right"],
  ["middle-left", "Middle left"], ["center", "Centre"], ["middle-right", "Middle right"],
  ["bottom-left", "Bottom left"], ["bottom-center", "Bottom centre"], ["bottom-right", "Bottom right"],
];

mountTool({
  id: "overlay-image",
  title: "Overlay image",
  desc: "Place one image on top of another — a logo on a photo, a frame over a picture, a sticker on a shot. Add the base image first, then the overlay.",
  accept: "image/*",
  multiple: true,
  reorder: true,
  action: "Overlay",
  options: [
    { name: "scale", label: "Overlay size (% of base width)", type: "number", value: 30, min: 2, max: 200 },
    { name: "opacity", label: "Opacity", type: "range", value: 1, min: 0.05, max: 1, step: 0.05 },
    { name: "anchor", label: "Position", type: "select", value: "bottom-right", options: ANCHORS },
    { name: "margin", label: "Margin (% of width)", type: "number", value: 3, min: 0, max: 40 },
    { name: "blend", label: "Blend mode", type: "select", value: "source-over", options: [["source-over", "Normal"], ["multiply", "Multiply"], ["screen", "Screen"], ["overlay", "Overlay"], ["soft-light", "Soft light"], ["difference", "Difference"]] },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    if (ctx.files.length < 2) throw new Error("Add two images: the base first, then the overlay.");
    const o = ctx.options;
    const base = await ctx.fileToImage(ctx.files[0]);
    const top = await ctx.fileToImage(ctx.files[1]);
    const out = ctx.canvasOf(base.naturalWidth, base.naturalHeight);
    const g = out.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, out.width, out.height);
    g.drawImage(base, 0, 0);

    const w = out.width * (Number(o.scale) || 30) / 100;
    const h = w * top.naturalHeight / top.naturalWidth;
    const m = out.width * (Number(o.margin) || 0) / 100;
    let x, y;
    if (o.anchor.includes("left")) x = m;
    else if (o.anchor.includes("right")) x = out.width - w - m;
    else x = (out.width - w) / 2;
    if (o.anchor.startsWith("top")) y = m;
    else if (o.anchor.startsWith("bottom")) y = out.height - h - m;
    else y = (out.height - h) / 2;

    g.globalAlpha = Number(o.opacity) || 1;
    g.globalCompositeOperation = o.blend || "source-over";
    g.drawImage(top, x, y, w, h);
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";

    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `overlaid.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Placed the second image at ${o.anchor} — ${Math.round(w)}×${Math.round(h)}px.</p>`;
  },
  help: "<p>PNG transparency is preserved, so a logo with a transparent background drops in cleanly. Use the ↑ ↓ buttons above the file list to make sure the base image is first.</p>",
});
