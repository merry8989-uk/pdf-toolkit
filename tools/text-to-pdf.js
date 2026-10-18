import { mountTool } from "../app.js";

function wrapText(text, font, size, maxWidth) {
  const out = [];
  for (const para of text.replace(/\r/g, "").split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(""); continue; }
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
      else { if (line) out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}

mountTool({
  id: "text-to-pdf",
  title: "Text to PDF",
  desc: "Paste any text and turn it into a clean, paginated PDF. Type in the box below, then create the PDF.",
  noFile: true,
  action: "Create PDF",
  options: [
    { name: "size", label: "Font size", type: "number", value: 11, min: 6, max: 32 },
    { name: "font", label: "Font", type: "select", value: "Helvetica", options: [["Helvetica", "Helvetica"], ["TimesRoman", "Times"], ["Courier", "Courier"]] },
    { name: "page", label: "Page size", type: "select", value: "a4", options: [["a4", "A4"], ["letter", "Letter"]] },
    { name: "margin", label: "Margin (pt)", type: "number", value: 56, min: 12, max: 120 },
  ],
  onInit(ctx) {
    ctx.extra.innerHTML = `<div class="field"><label for="ta">Your text</label>
      <textarea id="ta" placeholder="Paste or type your text here…" style="width:100%;height:240px;background:var(--surface-2);color:var(--text);border:1px solid var(--line);border-radius:9px;padding:12px;font:13px/1.55 var(--mono)"></textarea></div>`;
  },
  async run(ctx) {
    const text = document.getElementById("ta").value;
    if (!text.trim()) throw new Error("Type or paste some text first.");
    const { PDFDocument, StandardFonts, rgb } = await ctx.loadPdfLib();
    const o = ctx.options;
    const doc = await PDFDocument.create();
    const f = await doc.embedFont(StandardFonts[o.font] || StandardFonts.Helvetica);
    const dims = { a4: [595.28, 841.89], letter: [612, 792] };
    const [pw, ph] = dims[o.page] || dims.a4;
    const m = Number(o.margin) || 56;
    const size = Number(o.size) || 11;
    const leading = size * 1.45;
    const maxW = pw - 2 * m;
    const lines = wrapText(text, f, size, maxW);
    const perPage = Math.floor((ph - 2 * m) / leading);
    for (let i = 0; i < lines.length; i += perPage) {
      ctx.progress(i / lines.length);
      const page = doc.addPage([pw, ph]);
      const chunk = lines.slice(i, i + perPage);
      chunk.forEach((ln, j) => {
        if (!ln) return;
        page.drawText(ln, { x: m, y: ph - m - size - j * leading, size, font: f, color: rgb(0.1, 0.1, 0.12) });
      });
    }
    const bytes = await doc.save();
    ctx.download(bytes, "text.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Created <b>text.pdf</b> — ${doc.getPageCount()} page(s) from ${lines.length} line(s).</p>`;
  },
  help: "<p>Text is wrapped to the page width and paginated automatically. Blank lines are preserved as paragraph breaks.</p>",
});
