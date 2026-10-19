import { mountTool } from "../app.js";

const PRESETS = [
  ["ig-square", "Instagram post — 1080×1080", 1080, 1080],
  ["ig-portrait", "Instagram portrait — 1080×1350", 1080, 1350],
  ["ig-story", "Instagram story / reel — 1080×1920", 1080, 1920],
  ["yt-thumb", "YouTube thumbnail — 1280×720", 1280, 720],
  ["yt-banner", "YouTube banner — 2560×1440", 2560, 1440],
  ["x-post", "X / Twitter post — 1600×900", 1600, 900],
  ["x-header", "X / Twitter header — 1500×500", 1500, 500],
  ["fb-post", "Facebook post — 1200×630", 1200, 630],
  ["li-post", "LinkedIn post — 1200×1200", 1200, 1200],
  ["li-banner", "LinkedIn banner — 1584×396", 1584, 396],
  ["pin", "Pinterest pin — 1000×1500", 1000, 1500],
  ["wa-status", "WhatsApp status — 1080×1920", 1080, 1920],
];

mountTool({
  id: "social-resize",
  title: "Social media resize",
  desc: "Resize and crop a photo to the exact dimensions a social platform expects — Instagram, YouTube, X, Facebook, LinkedIn, Pinterest and more.",
  accept: "image/*",
  multiple: false,
  action: "Resize for platform",
  options: [
    { name: "preset", label: "Platform", type: "select", value: "ig-square", options: PRESETS.map((p) => [p[0], p[1]]) },
    { name: "fit", label: "Fit mode", type: "select", value: "cover", options: [["cover", "Fill the frame (crop) "], ["contain", "Fit inside (adds background)"]] },
    { name: "bg", label: "Background (fit mode)", type: "text", value: "#ffffff" },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]] },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    const o = ctx.options;
    const preset = PRESETS.find((p) => p[0] === o.preset) || PRESETS[0];
    const [, label, W, H] = preset;
    const out = ctx.canvasOf(W, H);
    const g = out.getContext("2d");
    g.fillStyle = o.bg || "#ffffff";
    g.fillRect(0, 0, W, H);
    g.imageSmoothingQuality = "high";
    const r = o.fit === "contain"
      ? Math.min(W / img.naturalWidth, H / img.naturalHeight)
      : Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * r, h = img.naturalHeight * r;
    g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    const mime = o.format === "png" ? "image/png" : o.format === "webp" ? "image/webp" : "image/jpeg";
    const blob = await ctx.canvasBlob(out, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `${o.preset}-${W}x${H}.${o.format === "jpeg" ? "jpg" : o.format}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Resized for <b>${label}</b> — ${W}×${H}px, ${ctx.fmtSize(blob.size)}.</p>`;
  },
  help: "<p><b>Fill the frame</b> scales the photo to cover the whole canvas and crops the overflow — best for photos. <b>Fit inside</b> keeps the whole photo and pads the gaps with your background colour — best for graphics and logos.</p>",
});
