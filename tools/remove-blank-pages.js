import { mountTool } from "../app.js";

mountTool({
  id: "remove-blank-pages",
  title: "Remove blank pages",
  desc: "Detect pages with no visible content and delete them, keeping the rest as one file.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Remove blank pages",
  options: [
    { name: "threshold", label: "Sensitivity", type: "select", value: "0.002", options: [["0.0005", "Strict (only truly empty)"], ["0.002", "Balanced"], ["0.01", "Aggressive (near-empty too)"]] },
  ],
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const src = await PDFDocument.load(await ctx.files[0].arrayBuffer(), { ignoreEncryption: true });
    const total = src.getPageCount();
    const viewer = await ctx.openDocument(await ctx.files[0].arrayBuffer());
    const limit = parseFloat(ctx.options.threshold);

    const blanks = [];
    for (let i = 1; i <= total; i++) {
      ctx.progress((i / total) * 0.7);
      const page = await viewer.getPage(i);
      const vp = page.getViewport({ scale: 0.25 });
      const c = ctx.canvasOf(vp.width, vp.height);
      const g = c.getContext("2d");
      g.fillStyle = "#fff";
      g.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: g, viewport: vp }).promise;
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let ink = 0;
      for (let p = 0; p < d.length; p += 4) if (d[p] < 245 || d[p + 1] < 245 || d[p + 2] < 245) ink++;
      if (ink / (d.length / 4) < limit) blanks.push(i);
    }

    if (!blanks.length) {
      ctx.out.innerHTML = `<p class="hint">No blank pages were detected — nothing to remove.</p>`;
      return;
    }
    const keep = [];
    for (let i = 1; i <= total; i++) if (!blanks.includes(i)) keep.push(i - 1);
    if (!keep.length) throw new Error("Every page looked blank — refusing to produce an empty file.");

    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, keep);
    pages.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    ctx.download(bytes, "no-blanks.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Removed ${blanks.length} blank page(s) (${blanks.join(", ")}). <b>no-blanks.pdf</b> has ${keep.length} page(s).</p>`;
  },
  help: "<p>Each page is rendered small and checked for non-white pixels. Raise the sensitivity if near-empty pages are left behind; lower it if real content is being removed.</p>",
});
