import { mountTool } from "../app.js";

const FMT = [["png", "PNG"], ["jpeg", "JPG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

mountTool({
  id: "add-text-to-image",
  title: "Add text to image",
  desc: "Write a caption or label directly onto a photo.",
  accept: "image/*",
  multiple: false,
  action: "Add text",
  options: [
    { name: "text", label: "Text", type: "text", value: "" },
    { name: "x", label: "Horizontal position (%)", type: "number", value: 8, min: 0, max: 100 },
    { name: "y", label: "Vertical position from top (%)", type: "number", value: 8, min: 0, max: 100 },
    { name: "size", label: "Font size (px)", type: "number", value: 48, min: 8, max: 400 },
    { name: "color", label: "Colour", type: "select", value: "white", options: [["white", "White"], ["black", "Black"], ["red", "Red"], ["yellow", "Yellow"]] },
    { name: "bold", label: "Bold", type: "checkbox", value: true },
    { name: "outline", label: "Add a dark outline (better on busy photos)", type: "checkbox", value: true },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const o = ctx.options;
    const text = (o.text || "").trim();
    if (!text) throw new Error("Type the text to add.");
    const img = await ctx.fileToImage(ctx.files[0]);
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = ctx.canvasOf(W, H);
    const g = c.getContext("2d");
    if (o.format !== "png") { g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); }
    g.drawImage(img, 0, 0);
    const colors = { white: "#ffffff", black: "#000000", red: "#e11d48", yellow: "#facc15" };
    const size = Number(o.size) || 48;
    g.font = `${o.bold ? 800 : 400} ${size}px system-ui, sans-serif`;
    g.textBaseline = "top";
    const x = W * (Number(o.x) || 0) / 100;
    const y = H * (Number(o.y) || 0) / 100;
    if (o.outline) {
      g.lineWidth = Math.max(2, size * 0.09);
      g.strokeStyle = "rgba(0,0,0,.75)";
      g.lineJoin = "round";
      g.strokeText(text, x, y);
    }
    g.fillStyle = colors[o.color] || "#fff";
    g.fillText(text, x, y);
    const mime = mimeOf(o.format);
    const blob = await ctx.canvasBlob(c, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `text-image.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Added text to the ${W}×${H}px image.</p>`;
  },
  help: "<p>Positions are a percentage of the image, so the same setting works on any photo size. The outline option keeps the text legible on detailed backgrounds.</p>",
});
