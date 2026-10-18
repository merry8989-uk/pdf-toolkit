import { mountTool } from "../app.js";

mountTool({
  id: "collage",
  title: "Collage",
  desc: "Arrange several photos into a neat grid, then save it as an image or a one-page PDF.",
  accept: "image/*",
  multiple: true,
  reorder: true,
  action: "Build collage",
  options: [
    { name: "cols", label: "Columns", type: "number", value: 3, min: 1, max: 8 },
    { name: "cell", label: "Cell size (px)", type: "number", value: 400, min: 80, max: 2000 },
    { name: "gap", label: "Gap between cells (px)", type: "number", value: 12, min: 0, max: 120 },
    { name: "bg", label: "Background", type: "select", value: "white", options: [["white", "White"], ["black", "Black"], ["gray", "Grey"]] },
    { name: "output", label: "Output", type: "select", value: "png", options: [["png", "PNG image"], ["jpeg", "JPG image"], ["pdf", "One-page PDF"]] },
    { name: "quality", label: "Image quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const o = ctx.options;
    const cols = Math.min(Math.max(1, o.cols | 0), 8);
    const cell = Math.max(80, o.cell | 0);
    const gap = Math.max(0, o.gap | 0);
    const n = ctx.files.length;
    const rows = Math.ceil(n / cols);
    const W = cols * cell + gap * (cols + 1);
    const H = rows * cell + gap * (rows + 1);
    const bg = o.bg === "black" ? "#000000" : o.bg === "gray" ? "#e5e7eb" : "#ffffff";

    const c = ctx.canvasOf(W, H);
    const g = c.getContext("2d");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    for (let i = 0; i < n; i++) {
      ctx.progress(i / n);
      const img = await ctx.fileToImage(ctx.files[i]);
      const col = i % cols, row = Math.floor(i / cols);
      const cx = gap + col * (cell + gap);
      const cy = gap + row * (cell + gap);
      const r = Math.min(cell / img.naturalWidth, cell / img.naturalHeight);
      const w = img.naturalWidth * r, h = img.naturalHeight * r;
      g.drawImage(img, cx + (cell - w) / 2, cy + (cell - h) / 2, w, h);
    }

    if (o.output === "pdf") {
      const blob = await ctx.canvasBlob(c, "image/jpeg", Number(o.quality) || 0.92);
      const { PDFDocument } = await ctx.loadPdfLib();
      const doc = await PDFDocument.create();
      const jpg = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const scale = 595.28 / W;
      const page = doc.addPage([595.28, H * scale]);
      page.drawImage(jpg, { x: 0, y: 0, width: 595.28, height: H * scale });
      const bytes = await doc.save();
      ctx.download(bytes, "collage.pdf");
      ctx.out.innerHTML = `<p class="hint">✓ Collage of ${n} photo(s) saved as a one-page PDF.</p>`;
      return;
    }

    const mime = o.output === "jpeg" ? "image/jpeg" : "image/png";
    const blob = await ctx.canvasBlob(c, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `collage.${o.output === "jpeg" ? "jpg" : "png"}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Collage of ${n} photo(s) — ${W}×${H}px, ${ctx.fmtSize(blob.size)}.</p>`;
  },
  help: "<p>Photos are fitted whole into their cells (never cropped), centred on the background. Use the ↑ ↓ buttons above to set the order.</p>",
});
