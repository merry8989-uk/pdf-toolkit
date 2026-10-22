import { mountTool } from "../app.js";

const POS = [
  ["bottom-right", "Bottom right"], ["bottom-center", "Bottom centre"], ["bottom-left", "Bottom left"],
  ["top-right", "Top right"], ["top-left", "Top left"],
];

mountTool({
  id: "bates-numbering",
  title: "Bates numbering",
  desc: "Add legal-style Bates stamps — a prefix plus a zero-padded running number — to every page.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Apply Bates numbering",
  options: [
    { name: "prefix", label: "Prefix", type: "text", value: "ABC" },
    { name: "start", label: "Start number", type: "number", value: 1, min: 0 },
    { name: "digits", label: "Digits (zero padding)", type: "number", value: 6, min: 1, max: 12 },
    { name: "suffix", label: "Suffix", type: "text", placeholder: "optional" },
    { name: "position", label: "Position", type: "select", value: "bottom-right", options: POS },
    { name: "size", label: "Font size", type: "number", value: 9, min: 6, max: 24 },
  ],
  async run(ctx) {
    const { PDFDocument, StandardFonts, rgb } = await ctx.loadPdfLib();
    const o = ctx.options;
    const doc = await ctx.loadPdf(ctx.files[0]);
    const font = await ctx.fontFor(doc, (o.prefix || "") + (o.suffix || ""), {});
    const size = Number(o.size) || 9;
    const digits = Math.min(Math.max(1, o.digits | 0), 12);
    const start = o.start | 0;
    const m = 28;

    doc.getPages().forEach((p, i) => {
      const label = `${o.prefix || ""}${String(start + i).padStart(digits, "0")}${o.suffix || ""}`;
      const { width, height } = p.getSize();
      const w = font.widthOfTextAtSize(label, size);
      const x = o.position.includes("left") ? m : o.position.includes("right") ? width - w - m : (width - w) / 2;
      const y = o.position.startsWith("top") ? height - m - size : m;
      p.drawText(label, { x, y, size, font, color: rgb(0.1, 0.1, 0.12) });
    });

    const bytes = await doc.save();
    ctx.download(bytes, "bates.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Stamped ${doc.getPageCount()} page(s), starting at <b>${(o.prefix || "") + String(start).padStart(digits, "0")}</b>.${ctx.unicodeNote(doc)}${ctx.glyphWarning((o.prefix || "") + (o.suffix || ""))}</p>`;
  },
  help: "<p>Bates numbering is used in legal discovery to give every page a unique, sequential identifier. The number is zero-padded so the stamps line up in order.</p>",
});
