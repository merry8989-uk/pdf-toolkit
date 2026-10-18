import { mountTool } from "../app.js";

mountTool({
  id: "annotate-text",
  title: "Add text",
  desc: "Place a line of text anywhere on the page — a note, a label, a correction.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Add text",
  options: [
    { name: "text", label: "Text", type: "text", value: "" },
    { name: "pages", label: "Pages (blank = all)", type: "text", placeholder: "1, 3-5" },
    { name: "x", label: "Horizontal position (%)", type: "number", value: 10, min: 0, max: 100 },
    { name: "y", label: "Vertical position from top (%)", type: "number", value: 10, min: 0, max: 100 },
    { name: "size", label: "Font size", type: "number", value: 14, min: 6, max: 72 },
    { name: "color", label: "Colour", type: "select", value: "black", options: [["black", "Black"], ["red", "Red"], ["blue", "Blue"], ["gray", "Grey"]] },
    { name: "bold", label: "Bold", type: "checkbox", value: false },
  ],
  async run(ctx) {
    const { PDFDocument, StandardFonts, rgb } = await ctx.loadPdfLib();
    const o = ctx.options;
    if (!o.text || !o.text.trim()) throw new Error("Type the text to add.");
    const colors = { black: rgb(0, 0, 0), red: rgb(0.8, 0.1, 0.1), blue: rgb(0.1, 0.3, 0.8), gray: rgb(0.4, 0.4, 0.44) };
    const doc = await PDFDocument.load(await ctx.files[0].arrayBuffer(), { ignoreEncryption: true });
    const font = await doc.embedFont(o.bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
    const total = doc.getPageCount();
    const sel = ctx.parseRanges(o.pages, total);
    const all = !sel.length;
    const size = Number(o.size) || 14;

    doc.getPages().forEach((p, i) => {
      if (!all && !sel.includes(i + 1)) return;
      const { width, height } = p.getSize();
      p.drawText(o.text, {
        x: width * (Number(o.x) || 0) / 100,
        y: height - height * (Number(o.y) || 0) / 100 - size,
        size, font, color: colors[o.color] || colors.black,
      });
    });
    const bytes = await doc.save();
    ctx.download(bytes, "annotated.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Added text to ${all ? total : sel.length} page(s).</p>`;
  },
  help: "<p>Positions are given as a percentage of the page, so the same setting lands in the same relative spot on any page size. 0% is the left/top edge.</p>",
});
