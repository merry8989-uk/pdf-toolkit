import { mountTool } from "../app.js";

mountTool({
  id: "reverse-pages",
  title: "Reverse pages",
  desc: "Flip the page order of a PDF so the last page becomes the first.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Reverse pages",
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const src = await PDFDocument.load(await ctx.files[0].arrayBuffer(), { ignoreEncryption: true });
    const idxs = src.getPageIndices().reverse();
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, idxs);
    pages.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    ctx.download(bytes, "reversed.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Reversed ${idxs.length} page(s).</p>`;
  },
  help: "<p>Every page is kept — only their order is flipped. Handy for fixing a document scanned back-to-front.</p>",
});
