import { mountTool } from "../app.js";

mountTool({
  id: "insert-pages",
  title: "Insert blank pages",
  desc: "Add one or more blank pages at any position in a PDF.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Insert pages",
  options: [
    { name: "before", label: "Insert before page number", type: "number", value: 1, min: 1 },
    { name: "count", label: "How many blank pages", type: "number", value: 1, min: 1, max: 50 },
  ],
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const o = ctx.options;
    const src = await PDFDocument.load(await ctx.files[0].arrayBuffer(), { ignoreEncryption: true });
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
    const total = out.getPageCount();
    const pos = Math.min(Math.max(1, o.before | 0), total + 1);
    const count = Math.min(Math.max(1, o.count | 0), 50);
    const ref = total ? out.getPage(Math.min(pos - 1, total - 1)).getSize() : { width: 595.28, height: 841.89 };
    for (let c = 0; c < count; c++) out.insertPage(pos - 1 + c, out.addPage([ref.width, ref.height]));
    const bytes = await out.save();
    ctx.download(bytes, "inserted.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Inserted ${count} blank page(s); the document now has ${out.getPageCount()} page(s).</p>`;
  },
  help: "<p>Blank pages match the size of the neighbouring page. To append at the very end, set the page number to one more than the current page count.</p>",
});
