import { mountTool } from "../app.js";

mountTool({
  id: "grid-split",
  title: "Grid split",
  desc: "Split one image into a grid of tiles — perfect for a multi-post Instagram grid, or for cutting a poster into printable sheets.",
  accept: "image/*",
  multiple: false,
  action: "Split into tiles",
  options: [
    { name: "cols", label: "Columns", type: "number", value: 3, min: 1, max: 10 },
    { name: "rows", label: "Rows", type: "number", value: 3, min: 1, max: 10 },
    { name: "format", label: "Tile format", type: "select", value: "jpeg", options: [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]] },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    const base = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    base.getContext("2d").drawImage(img, 0, 0);
    const o = ctx.options;
    const cols = Math.min(Math.max(1, o.cols | 0), 10);
    const rows = Math.min(Math.max(1, o.rows | 0), 10);
    if (cols === 1 && rows === 1) throw new Error("Use at least 2 columns or rows.");
    const tw = Math.floor(base.width / cols);
    const th = Math.floor(base.height / rows);
    if (tw < 8 || th < 8) throw new Error("The tiles would be too small — use fewer rows/columns.");
    const mime = o.format === "png" ? "image/png" : o.format === "webp" ? "image/webp" : "image/jpeg";
    const ext = o.format === "jpeg" ? "jpg" : o.format;

    const entries = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.progress((r * cols + c) / (rows * cols));
        const t = ctx.canvasOf(tw, th);
        const g = t.getContext("2d");
        if (o.format !== "png") { g.fillStyle = "#fff"; g.fillRect(0, 0, tw, th); }
        g.drawImage(base, c * tw, r * th, tw, th, 0, 0, tw, th);
        const blob = await ctx.canvasBlob(t, mime, Number(o.quality) || 0.92);
        entries.push({ name: `tile-r${r + 1}-c${c + 1}.${ext}`, data: new Uint8Array(await blob.arrayBuffer()) });
      }
    }
    ctx.downloadZip(entries, "tiles.zip");
    ctx.out.innerHTML = `<p class="hint">✓ Split into ${cols}×${rows} = ${entries.length} tile(s) of ${tw}×${th}px, in <b>tiles.zip</b>.</p>`;
  },
  help: "<p>Tiles are numbered row-by-row from the top-left. Post them in order and the full picture reassembles on a profile grid.</p>",
});
