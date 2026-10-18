import { mountTool } from "../app.js";

const FMT = [["png", "PNG"], ["jpeg", "JPG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

mountTool({
  id: "image-border",
  title: "Add image border",
  desc: "Frame a photo with a coloured border.",
  accept: "image/*",
  multiple: false,
  action: "Add border",
  options: [
    { name: "mode", label: "Border style", type: "select", value: "inside", options: [["inside", "Draw inside the photo"], ["outside", "Add a frame around it"]] },
    { name: "width", label: "Border width (px)", type: "number", value: 24, min: 1, max: 400 },
    { name: "color", label: "Colour", type: "select", value: "white", options: [["white", "White"], ["black", "Black"], ["red", "Red"], ["blue", "Blue"], ["gray", "Grey"]] },
    { name: "radius", label: "Corner radius (px)", type: "number", value: 0, min: 0, max: 400 },
    { name: "format", label: "Output format", type: "select", value: "png", options: FMT },
    { name: "quality", label: "Quality (JPG / WebP)", type: "range", value: 0.9, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const o = ctx.options;
    const img = await ctx.fileToImage(ctx.files[0]);
    const W = img.naturalWidth, H = img.naturalHeight;
    const bw = Math.round(Number(o.width) || 24);
    const radius = Math.round(Number(o.radius) || 0);
    const colors = { white: "#ffffff", black: "#000000", red: "#e11d48", blue: "#2563eb", gray: "#9ca3af" };
    const color = colors[o.color] || "#fff";
    const outside = o.mode === "outside";
    const cw = outside ? W + bw * 2 : W;
    const ch = outside ? H + bw * 2 : H;
    const c = ctx.canvasOf(cw, ch);
    const g = c.getContext("2d");
    if (outside) { g.fillStyle = color; g.fillRect(0, 0, cw, ch); }
    const dx = outside ? bw : 0, dy = outside ? bw : 0;
    if (radius > 0) {
      g.save();
      const r = Math.min(radius, W / 2, H / 2);
      g.beginPath();
      g.moveTo(dx + r, dy);
      g.arcTo(dx + W, dy, dx + W, dy + H, r);
      g.arcTo(dx + W, dy + H, dx, dy + H, r);
      g.arcTo(dx, dy + H, dx, dy, r);
      g.arcTo(dx, dy, dx + W, dy, r);
      g.closePath();
      g.clip();
    }
    g.drawImage(img, dx, dy, W, H);
    if (radius > 0) g.restore();
    if (!outside) {
      g.strokeStyle = color;
      g.lineWidth = bw;
      const inset = bw / 2;
      if (radius > 0) {
        const r = Math.min(radius, W / 2, H / 2);
        g.beginPath();
        g.moveTo(inset + r, inset);
        g.arcTo(W - inset, inset, W - inset, H - inset, r);
        g.arcTo(W - inset, H - inset, inset, H - inset, r);
        g.arcTo(inset, H - inset, inset, inset, r);
        g.arcTo(inset, inset, W - inset, inset, r);
        g.closePath();
        g.stroke();
      } else {
        g.strokeRect(inset, inset, W - bw, H - bw);
      }
    }
    const mime = mimeOf(o.format);
    const blob = await ctx.canvasBlob(c, mime, Number(o.quality) || 0.9);
    ctx.download(blob, `bordered.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Border added — output is ${cw}×${ch}px.</p>`;
  },
  help: "<p>“Outside” grows the canvas so nothing of the photo is covered; “inside” draws the border over the edges. A corner radius rounds both the photo and the frame together.</p>",
});
