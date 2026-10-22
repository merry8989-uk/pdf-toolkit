import { mountTool } from "../app.js";

mountTool({
  id: "rotate",
  title: "Rotate PDF",
  desc: "Turn all or selected pages by 90°, 180° or 270°.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Rotate PDF",
  options: [
    { name: "angle", label: "Rotation", type: "select", value: "90", options: [
      ["90", "90° clockwise"], ["180", "180°"], ["270", "270° (90° anti-clockwise)"],
    ] },
    { name: "pages", label: "Pages (blank = all)", type: "text", placeholder: "1-3, 7" },
  ],
  async run(ctx) {
    const { PDFDocument, degrees } = await ctx.loadPdfLib();
    const o = ctx.options;
    const doc = await ctx.loadPdf(ctx.files[0]);
    const total = doc.getPageCount();
    const sel = ctx.parseRanges(o.pages, total);
    const all = !sel.length;
    const a = parseInt(o.angle, 10);
    doc.getPages().forEach((p, i) => {
      if (!all && !sel.includes(i + 1)) return;
      const cur = p.getRotation().angle || 0;
      p.setRotation(degrees((((cur + a) % 360) + 360) % 360));
    });
    const bytes = await doc.save();
    ctx.download(bytes, "rotated.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Rotated ${all ? "all " + total : sel.length} page(s) by ${a}°.</p>`;
  },
  help: "<p>Rotation is added on top of each page's existing rotation, so running it again keeps turning the page.</p>",
});
