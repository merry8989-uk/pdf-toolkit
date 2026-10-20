import { mountTool } from "../app.js";

mountTool({
  id: "header-footer",
  title: "Header & footer",
  desc: "Add running text at the top or bottom of every page, with optional page numbers.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Add header & footer",
  options: [
    { name: "header", label: "Header text", type: "text", placeholder: "e.g. Company Confidential" },
    { name: "footer", label: "Footer text", type: "text", placeholder: "e.g. Draft — 2026" },
    { name: "numbers", label: "Add “Page X of Y”", type: "checkbox", value: true },
    { name: "size", label: "Font size", type: "number", value: 9, min: 6, max: 24 },
    { name: "margin", label: "Margin (pt)", type: "number", value: 28, min: 10, max: 90 },
    { name: "skip", label: "Skip the first page", type: "checkbox", value: false },
  ],
  async run(ctx) {
    const { PDFDocument, StandardFonts, rgb } = await ctx.loadPdfLib();
    const o = ctx.options;
    const doc = await PDFDocument.load(await ctx.files[0].arrayBuffer(), { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    const total = pages.length;
    const size = Number(o.size) || 9;
    const m = Number(o.margin) || 28;
    const col = rgb(0.3, 0.3, 0.34);

    pages.forEach((p, i) => {
      if (o.skip && i === 0) return;
      const { width, height } = p.getSize();
      const put = (text, y) => {
        if (!text) return;
        const w = font.widthOfTextAtSize(text, size);
        p.drawText(text, { x: Math.max(6, (width - w) / 2), y, size, font, color: col });
      };
      if (o.header) put(o.header, height - m - size + 2);
      const foot = [o.footer, o.numbers ? `Page ${i + 1} of ${total}` : ""].filter(Boolean).join("   ·   ");
      if (foot) put(foot, m - size);
    });

    const bytes = await doc.save();
    ctx.download(bytes, "headered.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Added a header/footer to ${o.skip ? total - 1 : total} page(s).${ctx.glyphWarning((o.header || "") + (o.footer || ""))}</p>`;
  },
  help: "<p>Header text sits near the top edge and footer text near the bottom, both centred. Leave either field blank to skip it.</p>",
});
