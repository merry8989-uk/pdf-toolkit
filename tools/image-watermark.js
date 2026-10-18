import { mountTool } from "../app.js";

const ANCHOR_OPTS = [
  ["bottom-right", "Bottom right"], ["bottom-center", "Bottom centre"], ["bottom-left", "Bottom left"],
  ["middle-right", "Middle right"], ["center", "Centre"], ["middle-left", "Middle left"],
  ["top-right", "Top right"], ["top-center", "Top centre"], ["top-left", "Top left"],
];
const FMT = [["png", "PNG"], ["jpeg", "JPG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

mountTool({
  id: "image-watermark",
  title: "Watermark image",
  desc: "Stamp text across a photo — a copyright line, a brand, or a draft mark.",
  accept: "image/*",
  multiple: false,
  action: "Add watermark",
  options: [
    { name: "text", label: "Watermark text", type: "text", value: "© Your Name" },
    { name: "size", label: "Font size (px)", type: "number", value: 40, min: 8, max: 300 },
    { name: "opacity", label: "Opacity", type: "range", value: 0.45, min: 0.05, max: 1, step: 0.05 },
    { name: "anchor", label: "Position", type: "select", value: "bottom-right", options: ANCHOR_OPTS },
    { name: "color", label: "Colour", type: "select", value: "white", options: [["white", "White"], ["black", "Black"], ["red", "Red"], ["yellow", "Yellow"]] },
    { name: "angle", label: "Angle", type: "select", value: "0", options: [["0", "Horizontal"], ["-30", "-30°"], ["-45", "-45°"]] },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.9, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const o = ctx.options;
    const text = (o.text || "").trim();
    if (!text) throw new Error("Type the watermark text.");
    const img = await ctx.fileToImage(ctx.files[0]);
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = ctx.canvasOf(W, H);
    const g = c.getContext("2d");
    if (o.format !== "png") { g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); }
    g.drawImage(img, 0, 0);

    const colors = { white: "#ffffff", black: "#000000", red: "#e11d48", yellow: "#facc15" };
    const size = Number(o.size) || 40;
    const ang = (parseInt(o.angle, 10) || 0) * Math.PI / 180;
    const m = Math.round(size * 0.8);
    g.save();
    g.globalAlpha = Number(o.opacity) || 0.45;
    g.fillStyle = colors[o.color] || "#fff";
    g.font = `700 ${size}px system-ui, sans-serif`;
    g.textBaseline = "top";
    const tw = g.measureText(text).width, th = size * 1.2;
    const a = o.anchor;
    const ax = a.includes("left") ? m : a.includes("right") ? W - tw - m : (W - tw) / 2;
    const ay = a.startsWith("top") ? m : a.startsWith("bottom") ? H - th - m : (H - th) / 2;
    g.translate(ax + tw / 2, ay + th / 2);
    g.rotate(ang);
    g.shadowColor = "rgba(0,0,0,.35)";
    g.shadowBlur = 6;
    g.fillText(text, -tw / 2, -th / 2);
    g.restore();

    const mime = mimeOf(o.format);
    const blob = await ctx.canvasBlob(c, mime, Number(o.quality) || 0.9);
    ctx.download(blob, `watermarked.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Watermarked ${W}×${H}px image.</p>`;
  },
  help: "<p>The watermark is drawn at the position you choose with a soft shadow so it stays readable over busy photos.</p>",
});
