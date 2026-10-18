import { mountTool } from "../app.js";

mountTool({
  id: "compress",
  title: "Compress PDF",
  desc: "Reduce a PDF's file size. Choose lossless structure cleanup, or re-render pages as optimised images for much smaller files.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Compress PDF",
  options: [
    { name: "mode", label: "Compression mode", type: "select", value: "balanced", options: [
      ["lossless", "Lossless — keep text (small savings)"],
      ["balanced", "Balanced — 150 DPI images"],
      ["strong", "Strong — 110 DPI images"],
      ["extreme", "Extreme — 80 DPI images"],
    ] },
    { name: "quality", label: "Image quality", type: "range", value: 0.7, min: 0.3, max: 0.95, step: 0.05 },
  ],
  async run(ctx) {
    const o = ctx.options;
    const input = await ctx.files[0].arrayBuffer();
    const before = input.byteLength;
    let bytes, note;

    if (o.mode === "lossless") {
      const { PDFDocument } = await ctx.loadPdfLib();
      const doc = await PDFDocument.load(input, { ignoreEncryption: true });
      bytes = await doc.save({ useObjectStreams: true });
      note = "Structure rebuilt with object streams. Text stays selectable.";
    } else {
      const dpi = o.mode === "balanced" ? 150 : o.mode === "strong" ? 110 : 80;
      const viewer = await ctx.openDocument(input);
      const { PDFDocument } = await ctx.loadPdfLib();
      const out = await PDFDocument.create();
      for (let i = 1; i <= viewer.numPages; i++) {
        ctx.progress(i / viewer.numPages);
        const page = await viewer.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: dpi / 72 });
        const c = ctx.canvasOf(vp.width, vp.height);
        const g = c.getContext("2d");
        g.fillStyle = "#fff";
        g.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: g, viewport: vp }).promise;
        const blob = await ctx.canvasBlob(c, "image/jpeg", Number(o.quality) || 0.7);
        const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        const p = out.addPage([base.width, base.height]);
        p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
      }
      bytes = await out.save();
      note = `Pages re-rendered as ${dpi} DPI JPEGs. Text becomes part of the image, so it is no longer selectable.`;
    }

    const saved = before - bytes.length;
    const pct = before ? Math.round((saved / before) * 100) : 0;
    ctx.download(bytes, "compressed.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ ${ctx.fmtSize(before)} → <b>${ctx.fmtSize(bytes.length)}</b> (${pct >= 0 ? "saved " + pct + "%" : "grew " + Math.abs(pct) + "%"}). ${note}</p>`;
  },
  help: "<p><b>Lossless</b> keeps your text and only rebuilds the file structure — safe, but modest. The image modes rasterise each page, which shrinks scans and image-heavy documents dramatically at the cost of selectable text.</p>",
});
