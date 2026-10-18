import { mountTool } from "../app.js";

mountTool({
  id: "duplicate-pages",
  title: "Duplicate pages",
  desc: "Copy selected pages and place the copies right after the originals. Leave the page field blank to duplicate every page.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Duplicate pages",
  options: [
    { name: "pages", label: "Pages to duplicate", type: "text", placeholder: "1, 3, 5-7" },
    { name: "times", label: "Copies of each", type: "number", value: 1, min: 1, max: 20 },
  ],
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const o = ctx.options;
    const src = await PDFDocument.load(await ctx.files[0].arrayBuffer(), { ignoreEncryption: true });
    const total = src.getPageCount();
    let sel = ctx.parseRanges(o.pages, total);
    if (!sel.length) sel = Array.from({ length: total }, (_, i) => i + 1);
    const times = Math.min(Math.max(1, o.times | 0), 20);
    const idxs = [];
    for (let i = 1; i <= total; i++) {
      idxs.push(i - 1);
      if (sel.includes(i)) for (let k = 0; k < times; k++) idxs.push(i - 1);
    }
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, idxs);
    pages.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    ctx.download(bytes, "duplicated.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Duplicated ${sel.length} page(s) ×${times}; the output has ${idxs.length} page(s).</p>`;
  },
  help: "<p>Each copy is inserted immediately after its original, so the reading order stays logical.</p>",
});
