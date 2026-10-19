import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

mountTool({
  id: "mirror-image",
  title: "Mirror effect",
  desc: "Mirror one half of a photo onto the other for a symmetrical, kaleidoscope-style image.",
  accept: "image/*",
  multiple: false,
  action: "Mirror",
  options: [
    { name: "axis", label: "Mirror across", type: "select", value: "vertical", options: [
      ["vertical", "Vertical centre (left → right)"], ["vertical-r", "Vertical centre (right → left)"],
      ["horizontal", "Horizontal centre (top → bottom)"], ["horizontal-b", "Horizontal centre (bottom → top)"],
      ["quad", "Four-way (kaleidoscope)"],
    ] },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    const base = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    base.getContext("2d").drawImage(img, 0, 0);
    const o = ctx.options;
    const w = base.width, h = base.height;
    const out = ctx.canvasOf(w, h);
    const g = out.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);

    if (o.axis === "quad") {
      const hw = Math.round(w / 2), hh = Math.round(h / 2);
      const half = ctx.canvasOf(hw, hh);
      half.getContext("2d").drawImage(base, 0, 0, hw, hh, 0, 0, hw, hh);
      g.drawImage(half, 0, 0);
      g.save(); g.translate(w, 0); g.scale(-1, 1); g.drawImage(half, 0, 0); g.restore();
      g.save(); g.translate(0, h); g.scale(1, -1); g.drawImage(half, 0, 0); g.restore();
      g.save(); g.translate(w, h); g.scale(-1, -1); g.drawImage(half, 0, 0); g.restore();
    } else if (o.axis.startsWith("vertical")) {
      const hw = Math.round(w / 2);
      const half = ctx.canvasOf(hw, h);
      half.getContext("2d").drawImage(base, 0, 0, hw, h, 0, 0, hw, h);
      if (o.axis === "vertical") {
        g.drawImage(half, 0, 0);
        g.save(); g.translate(w, 0); g.scale(-1, 1); g.drawImage(half, 0, 0); g.restore();
      } else {
        g.drawImage(half, w - hw, 0);
        g.save(); g.translate(w, 0); g.scale(-1, 1); g.drawImage(half, w - hw, 0); g.restore();
      }
    } else {
      const hh = Math.round(h / 2);
      const half = ctx.canvasOf(w, hh);
      half.getContext("2d").drawImage(base, 0, 0, w, hh, 0, 0, w, hh);
      if (o.axis === "horizontal") {
        g.drawImage(half, 0, 0);
        g.save(); g.translate(0, h); g.scale(1, -1); g.drawImage(half, 0, 0); g.restore();
      } else {
        g.drawImage(half, 0, h - hh);
        g.save(); g.translate(0, h); g.scale(1, -1); g.drawImage(half, 0, h - hh); g.restore();
      }
    }

    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `mirrored.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Mirrored the image (${o.axis}).</p>`;
  },
  help: "<p>Half of the photo is duplicated and flipped onto the other half. Kaleidoscope mode repeats one corner into all four quadrants.</p>",
});
