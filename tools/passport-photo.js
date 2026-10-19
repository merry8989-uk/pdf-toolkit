import { mountTool } from "../app.js";

const SIZES = [
  ["in-35x45", "35 × 45 mm — India, UK, EU, Schengen, Australia", 35, 45],
  ["us-2x2", "51 × 51 mm (2 × 2 in) — USA, Canada, India visa", 51, 51],
  ["in-25x35", "25 × 35 mm — India (small), some visas", 25, 35],
  ["cn-33x48", "33 × 48 mm — China visa", 33, 48],
  ["jp-35x45", "35 × 45 mm — Japan", 35, 45],
  ["passport-35x45", "35 × 45 mm — standard passport", 35, 45],
];

mountTool({
  id: "passport-photo",
  title: "Passport / ID photo",
  desc: "Crop a photo to a standard passport or visa size with a clean background, ready to print or upload.",
  accept: "image/*",
  multiple: false,
  action: "Create ID photo",
  options: [
    { name: "size", label: "Photo size", type: "select", value: "in-35x45", options: SIZES.map((s) => [s[0], s[1]]) },
    { name: "dpi", label: "Print resolution (DPI)", type: "number", value: 300, min: 150, max: 600 },
    { name: "bg", label: "Background colour", type: "text", value: "#ffffff" },
    { name: "zoom", label: "Zoom (%)", type: "range", value: 100, min: 60, max: 180, step: 5 },
    { name: "offsetY", label: "Move up/down (%)", type: "range", value: 0, min: -30, max: 30, step: 5 },
    { name: "quality", label: "Quality", type: "range", value: 0.95, min: 0.5, max: 1, step: 0.05 },
  ],
  async onFiles(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    const c = ctx.canvasOf(1, 1);
    ctx.extra.innerHTML = `<p class="hint">Preview at the chosen size and DPI. Adjust the zoom and vertical position so your head fills the frame.</p><div id="stage"></div>`;
    const stage = ctx.extra.querySelector("#stage");
    c.style.cssText = "display:block;border:1px solid var(--line);border-radius:8px;background:#fff";
    stage.appendChild(c);
    const draw = () => {
      const o = {
        size: document.getElementById("opt-size")?.value || "in-35x45",
        dpi: Number(document.getElementById("opt-dpi")?.value || 300),
        bg: document.getElementById("opt-bg")?.value || "#ffffff",
        zoom: Number(document.getElementById("opt-zoom")?.value || 100),
        offsetY: Number(document.getElementById("opt-offsetY")?.value || 0),
      };
      const s = SIZES.find((x) => x[0] === o.size) || SIZES[0];
      const W = Math.round(s[2] / 25.4 * o.dpi), H = Math.round(s[3] / 25.4 * o.dpi);
      const scale = 260 / H;
      c.width = Math.round(W * scale); c.height = Math.round(H * scale);
      const g = c.getContext("2d");
      g.fillStyle = o.bg; g.fillRect(0, 0, c.width, c.height);
      const r = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight) * (o.zoom / 100);
      const w = img.naturalWidth * r, h = img.naturalHeight * r;
      g.drawImage(img, (c.width - w) / 2, (c.height - h) / 2 + c.height * o.offsetY / 100, w, h);
      c._preview = { W, H, o };
    };
    ["size", "dpi", "bg", "zoom", "offsetY"].forEach((n) => {
      const el = document.getElementById("opt-" + n);
      if (el) { el.addEventListener("input", draw); el.addEventListener("change", draw); }
    });
    ctx._idImg = img;
    draw();
  },
  async run(ctx) {
    const img = ctx._idImg;
    if (!img) throw new Error("Add a photo first.");
    const o = ctx.options;
    const s = SIZES.find((x) => x[0] === o.size) || SIZES[0];
    const dpi = Number(o.dpi) || 300;
    const W = Math.round(s[2] / 25.4 * dpi), H = Math.round(s[3] / 25.4 * dpi);
    const out = ctx.canvasOf(W, H);
    const g = out.getContext("2d");
    g.fillStyle = o.bg || "#ffffff";
    g.fillRect(0, 0, W, H);
    g.imageSmoothingQuality = "high";
    const r = Math.max(W / img.naturalWidth, H / img.naturalHeight) * (Number(o.zoom) || 100) / 100;
    const w = img.naturalWidth * r, h = img.naturalHeight * r;
    g.drawImage(img, (W - w) / 2, (H - h) / 2 + H * (Number(o.offsetY) || 0) / 100, w, h);
    const blob = await ctx.canvasBlob(out, "image/jpeg", Number(o.quality) || 0.95);
    ctx.download(blob, `id-photo-${s[2]}x${s[3]}mm-${dpi}dpi.jpg`, "image/jpeg");
    ctx.out.innerHTML = `<p class="hint">✓ Created a ${s[2]}×${s[3]} mm photo at ${dpi} DPI (${W}×${H}px). Print it at 100% scale so the measurements come out right.</p>`;
  },
  help: "<p>Sizes are converted from millimetres using your chosen DPI, so the printed result matches the official requirement. Requirements differ by country — always check the current rule for your application before submitting.</p>",
});
