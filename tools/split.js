import { mountTool } from "../app.js";

mountTool({
  id: "split",
  title: "Split PDF",
  desc: "Extract a page range into one file, split into one file per page, or cut the document into chunks of a fixed size.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Split PDF",
  options: [
    { name: "mode", label: "Split mode", type: "select", value: "ranges", options: [
      ["ranges", "Extract page ranges (one file)"],
      ["every", "One file per page"],
      ["chunks", "Chunks of N pages"],
    ] },
    { name: "pages", label: "Pages (extract mode)", type: "text", placeholder: "1-3, 5, 8-" },
    { name: "size", label: "Pages per file (chunk mode)", type: "number", value: 1, min: 1, max: 500 },
  ],
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const o = ctx.options;
    const src = await ctx.loadPdf(ctx.files[0]);
    const total = src.getPageCount();

    if (o.mode === "ranges") {
      const sel = ctx.parseRanges(o.pages, total);
      if (!sel.length) throw new Error("Enter a page range, for example 1-3, 5");
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, sel.map((n) => n - 1));
      pages.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      ctx.download(bytes, "split.pdf");
      ctx.out.innerHTML = `<p class="hint">✓ Extracted ${sel.length} page(s) into <b>split.pdf</b>.</p>`;
      return;
    }

    const groups = [];
    if (o.mode === "every") {
      for (let i = 0; i < total; i++) groups.push([i]);
    } else {
      const size = Math.max(1, o.size | 0);
      for (let i = 0; i < total; i += size) {
        const g = [];
        for (let j = i; j < Math.min(i + size, total); j++) g.push(j);
        groups.push(g);
      }
    }

    const entries = [];
    for (let gi = 0; gi < groups.length; gi++) {
      ctx.progress(gi / groups.length);
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, groups[gi]);
      pages.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      const first = groups[gi][0] + 1, last = groups[gi][groups[gi].length - 1] + 1;
      entries.push({ name: first === last ? `page-${first}.pdf` : `pages-${first}-${last}.pdf`, data: bytes });
    }
    ctx.downloadZip(entries, "split.zip");
    ctx.out.innerHTML = `<p class="hint">✓ Created ${entries.length} file(s) in <b>split.zip</b>.</p>`;
  },
  help: "<p><b>Extract</b> pulls the pages you name into one new PDF. <b>One file per page</b> and <b>chunks</b> produce several files, bundled as a ZIP.</p>",
});
