import { mountTool } from "../app.js";

mountTool({
  id: "mix-interleave",
  title: "Mix / interleave",
  desc: "Alternate pages from two PDFs into one — the classic way to recombine separately scanned fronts and backs.",
  accept: ".pdf,application/pdf",
  multiple: true,
  action: "Interleave",
  async run(ctx) {
    if (ctx.files.length !== 2) throw new Error("Add exactly two PDF files.");
    const { PDFDocument } = await ctx.loadPdfLib();
    const a = await PDFDocument.load(await ctx.files[0].arrayBuffer(), { ignoreEncryption: true });
    const b = await PDFDocument.load(await ctx.files[1].arrayBuffer(), { ignoreEncryption: true });
    const out = await PDFDocument.create();
    const ai = a.getPageIndices(), bi = b.getPageIndices();
    const n = Math.max(ai.length, bi.length);
    for (let i = 0; i < n; i++) {
      ctx.progress(i / n);
      if (i < ai.length) { const [p] = await out.copyPages(a, [ai[i]]); out.addPage(p); }
      if (i < bi.length) { const [p] = await out.copyPages(b, [bi[i]]); out.addPage(p); }
    }
    const bytes = await out.save();
    ctx.download(bytes, "interleaved.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Interleaved ${ai.length} + ${bi.length} page(s) into <b>interleaved.pdf</b>.</p>`;
  },
  help: "<p>Page 1 of the first file, then page 1 of the second, then page 2 of each, and so on. Add the front-sides file first.</p>",
});
