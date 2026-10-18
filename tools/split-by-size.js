import { mountTool } from "../app.js";

mountTool({
  id: "split-by-size",
  title: "Split by size",
  desc: "Cut a PDF into several files, each staying under a size limit you choose.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Split by size",
  options: [{ name: "limit", label: "Max size per file (MB)", type: "number", value: 1, min: 0.05, max: 500, step: 0.05 }],
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const src = await PDFDocument.load(await ctx.files[0].arrayBuffer(), { ignoreEncryption: true });
    const total = src.getPageCount();
    const limit = (Number(ctx.options.limit) || 1) * 1024 * 1024;

    const sizes = [];
    for (let i = 0; i < total; i++) {
      ctx.progress((i / total) * 0.6);
      const d = await PDFDocument.create();
      const [pg] = await d.copyPages(src, [i]);
      d.addPage(pg);
      sizes.push((await d.save()).length);
    }

    const groups = [];
    let cur = [], curSize = 0;
    for (let i = 0; i < total; i++) {
      if (cur.length && curSize + sizes[i] > limit) { groups.push(cur); cur = []; curSize = 0; }
      cur.push(i);
      curSize += sizes[i];
    }
    if (cur.length) groups.push(cur);

    const entries = [];
    for (let gi = 0; gi < groups.length; gi++) {
      ctx.progress(0.6 + 0.4 * (gi / groups.length));
      const d = await PDFDocument.create();
      const pgs = await d.copyPages(src, groups[gi]);
      pgs.forEach((p) => d.addPage(p));
      const first = groups[gi][0] + 1, last = groups[gi][groups[gi].length - 1] + 1;
      entries.push({ name: `part-${gi + 1}-pages-${first}-${last}.pdf`, data: await d.save() });
    }
    ctx.downloadZip(entries, "split-by-size.zip");
    ctx.out.innerHTML = `<p class="hint">✓ Created ${entries.length} file(s) in <b>split-by-size.zip</b>.</p>`;
  },
  help: "<p>Each page's size is measured on its own, then pages are grouped greedily so every output stays close to your limit. A single page bigger than the limit gets a file to itself.</p>",
});
