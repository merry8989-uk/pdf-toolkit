import { mountTool } from "../app.js";

mountTool({
  id: "add-border",
  title: "Add page border",
  desc: "Draw a rectangular border around every page.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Add border",
  options: [
    { name: "width", label: "Border thickness (pt)", type: "number", value: 2, min: 0.5, max: 20, step: 0.5 },
    { name: "margin", label: "Margin from edge (pt)", type: "number", value: 18, min: 0, max: 120 },
    { name: "color", label: "Colour", type: "select", value: "black", options: [["black", "Black"], ["gray", "Grey"], ["red", "Red"], ["blue", "Blue"]] },
  ],
  async run(ctx) {
    const { PDFDocument, rgb } = await ctx.loadPdfLib();
    const o = ctx.options;
    const colors = { black: rgb(0, 0, 0), gray: rgb(0.5, 0.5, 0.5), red: rgb(0.8, 0.1, 0.1), blue: rgb(0.1, 0.3, 0.8) };
    const doc = await ctx.loadPdf(ctx.files[0]);
    const m = Math.max(0, Number(o.margin) || 0);
    const w = Number(o.width) || 2;
    doc.getPages().forEach((p) => {
      const { width, height } = p.getSize();
      const bw = width - 2 * m, bh = height - 2 * m;
      if (bw <= 0 || bh <= 0) return;
      p.drawRectangle({ x: m, y: m, width: bw, height: bh, borderColor: colors[o.color] || colors.black, borderWidth: w });
    });
    const bytes = await doc.save();
    ctx.download(bytes, "bordered.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Added a border to ${doc.getPageCount()} page(s).</p>`;
  },
  help: "<p>The border is drawn inside the page's existing size, so nothing is clipped. Use a larger margin to keep it clear of the content.</p>",
});
