import { mountTool } from "../app.js";

mountTool({
  id: "watermark",
  title: "Watermark PDF",
  desc: "Add a text watermark across every page, with control over size, colour, angle and opacity.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Add watermark",
  options: [
    { name: "text", label: "Watermark text", type: "text", value: "CONFIDENTIAL" },
    { name: "size", label: "Font size", type: "number", value: 54, min: 8, max: 200 },
    { name: "opacity", label: "Opacity", type: "range", value: 0.18, min: 0.05, max: 1, step: 0.05 },
    { name: "angle", label: "Angle", type: "select", value: "45", options: [["45", "45°"], ["-45", "-45°"], ["0", "Horizontal"]] },
    { name: "color", label: "Colour", type: "select", value: "gray", options: [["gray", "Grey"], ["red", "Red"], ["blue", "Blue"]] },
  ],
  async run(ctx) {
    const { PDFDocument, StandardFonts, rgb, degrees } = await ctx.loadPdfLib();
    const o = ctx.options;
    const text = (o.text || "").trim();
    if (!text) throw new Error("Type the watermark text.");
    const doc = await ctx.loadPdf(ctx.files[0]);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const colors = { gray: rgb(0.5, 0.5, 0.5), red: rgb(0.85, 0.15, 0.15), blue: rgb(0.15, 0.3, 0.8) };
    const size = Number(o.size) || 54, opacity = Number(o.opacity) || 0.18, ang = parseInt(o.angle, 10);
    doc.getPages().forEach((p) => {
      const { width, height } = p.getSize();
      const tw = font.widthOfTextAtSize(text, size);
      p.drawText(text, {
        x: width / 2 - tw / 2, y: height / 2 - size / 3,
        size, font, color: colors[o.color] || colors.gray, opacity, rotate: degrees(ang),
      });
    });
    const bytes = await doc.save();
    ctx.download(bytes, "watermarked.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Watermarked ${doc.getPageCount()} page(s).${ctx.glyphWarning(text)}</p>`;
  },
  help: "<p>The same stamp is drawn centred on every page. Lower the opacity for a subtle, non-intrusive mark.</p>",
});
