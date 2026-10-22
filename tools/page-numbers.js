import { mountTool } from "../app.js";

mountTool({
  id: "page-numbers",
  title: "Add page numbers",
  desc: "Stamp a running page number in any corner of every page.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Add page numbers",
  options: [
    { name: "position", label: "Position", type: "select", value: "bottom-center", options: [
      ["bottom-center", "Bottom centre"], ["bottom-right", "Bottom right"], ["bottom-left", "Bottom left"],
      ["top-center", "Top centre"], ["top-right", "Top right"], ["top-left", "Top left"],
    ] },
    { name: "start", label: "Start at", type: "number", value: 1, min: 0 },
    { name: "size", label: "Font size", type: "number", value: 12, min: 6, max: 48 },
    { name: "skip", label: "Skip the first page", type: "checkbox", value: false },
  ],
  async run(ctx) {
    const { PDFDocument, StandardFonts, rgb } = await ctx.loadPdfLib();
    const o = ctx.options;
    const doc = await ctx.loadPdf(ctx.files[0]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    const start = Number(o.start) || 1, size = Number(o.size) || 12, m = 26;
    const [vert, horiz] = o.position.split("-");
    pages.forEach((p, i) => {
      if (o.skip && i === 0) return;
      const { width, height } = p.getSize();
      const label = String(start + (i - (o.skip ? 1 : 0)));
      const tw = font.widthOfTextAtSize(label, size);
      const x = horiz === "left" ? m : horiz === "right" ? width - m - tw : width / 2 - tw / 2;
      const y = vert === "bottom" ? m : height - m - size;
      p.drawText(label, { x, y, size, font, color: rgb(0.15, 0.15, 0.18) });
    });
    const bytes = await doc.save();
    ctx.download(bytes, "numbered.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Added page numbers to ${o.skip ? pages.length - 1 : pages.length} page(s).</p>`;
  },
  help: "<p>Numbers are drawn with the built-in Helvetica font, so no extra font file needs to load.</p>",
});
