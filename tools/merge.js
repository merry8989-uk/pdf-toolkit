import { mountTool } from "../app.js";

mountTool({
  id: "merge",
  title: "Merge PDF",
  desc: "Combine two or more PDF files into a single document, in the order you choose. Use the ↑ ↓ buttons to reorder files before merging.",
  accept: ".pdf,application/pdf",
  multiple: true,
  reorder: true,
  action: "Merge PDF",
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const out = await PDFDocument.create();
    for (let i = 0; i < ctx.files.length; i++) {
      ctx.progress(i / ctx.files.length);
      const src = await PDFDocument.load(await ctx.files[i].arrayBuffer(), { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    }
    const bytes = await out.save();
    ctx.download(bytes, "merged.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Merged ${ctx.files.length} file(s) into <b>merged.pdf</b> — ${out.getPageCount()} page(s), ${ctx.fmtSize(bytes.length)}. Check your downloads.</p>`;
  },
  help: "<p>Pages are copied in the order shown above, using pdf-lib. Bookmarks and form fields from the source files are preserved as page content.</p>",
});
