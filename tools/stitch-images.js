import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

mountTool({
  id: "stitch-images",
  title: "Stitch images",
  desc: "Join several photos into one long image — stacked vertically for a scrolling collage, or side by side.",
  accept: "image/*",
  multiple: true,
  reorder: true,
  action: "Stitch images",
  options: [
    { name: "dir", label: "Direction", type: "select", value: "vertical", options: [["vertical", "Vertical (stacked)"], ["horizontal", "Horizontal (side by side)"]] },
    { name: "size", label: "Thickness (px)", type: "number", value: 1080, min: 100, max: 4000 },
    { name: "gap", label: "Gap between images (px)", type: "number", value: 0, min: 0, max: 200 },
    { name: "bg", label: "Background", type: "select", value: "white", options: [["white", "White"], ["black", "Black"], ["gray", "Grey"]] },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const o = ctx.options;
    const vertical = o.dir !== "horizontal";
    const target = Number(o.size) || 1080;
    const gap = Math.max(0, Number(o.gap) || 0);
    const bg = o.bg === "black" ? "#000000" : o.bg === "gray" ? "#e5e7eb" : "#ffffff";

    const imgs = [];
    for (const f of ctx.files) imgs.push(await ctx.fileToImage(f));
    if (!imgs.length) throw new Error("Add some images first.");

    const scaled = imgs.map((im) => {
      const r = target / (vertical ? im.naturalWidth : im.naturalHeight);
      return { w: Math.round(im.naturalWidth * r), h: Math.round(im.naturalHeight * r), im };
    });
    const totalMain = scaled.reduce((n, s) => n + (vertical ? s.h : s.w), 0) + gap * (scaled.length - 1);
    const cross = Math.max(...scaled.map((s) => vertical ? s.w : s.h));

    const W = vertical ? cross : totalMain;
    const H = vertical ? totalMain : cross;
    if (W * H > 80_000_000) throw new Error("That would create an image too large to process. Lower the thickness.");

    const out = ctx.canvasOf(W, H);
    const g = out.getContext("2d");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    let pos = 0;
    for (const s of scaled) {
      const x = vertical ? Math.round((cross - s.w) / 2) : pos;
      const y = vertical ? pos : Math.round((cross - s.h) / 2);
      g.drawImage(s.im, x, y, s.w, s.h);
      pos += (vertical ? s.h : s.w) + gap;
    }
    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `stitched.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Stitched ${imgs.length} image(s) into ${W}×${H}px.</p>`;
  },
  help: "<p>Each image is scaled to the thickness you set and placed in order. Vertical stitching with a 1080px thickness is ideal for Instagram-style long posts.</p>",
});
