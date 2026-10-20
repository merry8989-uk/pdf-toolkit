import { mountTool } from "../app.js";

mountTool({
  id: "stamps",
  title: "Stamps",
  desc: "Add a rubber-stamp mark such as APPROVED, DRAFT or CONFIDENTIAL to your pages.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Apply stamp",
  options: [
    { name: "preset", label: "Stamp", type: "select", value: "APPROVED", options: [
      ["APPROVED", "APPROVED"], ["DRAFT", "DRAFT"], ["CONFIDENTIAL", "CONFIDENTIAL"],
      ["REJECTED", "REJECTED"], ["REVIEWED", "REVIEWED"], ["CUSTOM", "Custom text…"],
    ] },
    { name: "custom", label: "Custom text (if selected above)", type: "text", placeholder: "e.g. FOR INTERNAL USE" },
    { name: "color", label: "Colour", type: "select", value: "red", options: [["red", "Red"], ["green", "Green"], ["blue", "Blue"], ["gray", "Grey"]] },
    { name: "size", label: "Font size", type: "number", value: 30, min: 10, max: 120 },
    { name: "angle", label: "Angle", type: "select", value: "0", options: [["0", "Horizontal"], ["-15", "-15°"], ["15", "15°"]] },
    { name: "opacity", label: "Opacity", type: "range", value: 0.75, min: 0.2, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const { PDFDocument, StandardFonts, rgb, degrees } = await ctx.loadPdfLib();
    const o = ctx.options;
    const text = (o.preset === "CUSTOM" ? o.custom : o.preset) || "";
    if (!text.trim()) throw new Error("Choose a stamp or type custom text.");
    const colors = { red: rgb(0.78, 0.1, 0.12), green: rgb(0.1, 0.55, 0.25), blue: rgb(0.12, 0.3, 0.75), gray: rgb(0.35, 0.35, 0.38) };
    const color = colors[o.color] || colors.red;
    const doc = await PDFDocument.load(await ctx.files[0].arrayBuffer(), { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const size = Number(o.size) || 30;
    const op = Number(o.opacity) || 0.75;
    const ang = parseInt(o.angle, 10) || 0;

    doc.getPages().forEach((p) => {
      const { width, height } = p.getSize();
      const tw = font.widthOfTextAtSize(text, size);
      const pad = size * 0.35;
      const bw = tw + pad * 2, bh = size + pad * 1.6;
      const x = (width - bw) / 2 + size * 0.6, y = (height - bh) / 2 + size * 0.6;
      p.drawRectangle({ x, y, width: bw, height: bh, borderColor: color, borderWidth: Math.max(2, size * 0.09), opacity: op, rotate: degrees(ang) });
      p.drawText(text, { x: x + pad, y: y + pad * 0.8, size, font, color, opacity: op, rotate: degrees(ang) });
    });

    const bytes = await doc.save();
    ctx.download(bytes, "stamped.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Applied the “${text.trim()}” stamp to ${doc.getPageCount()} page(s).${ctx.glyphWarning(text)}</p>`;
  },
  help: "<p>Each page gets a bordered stamp centred on it. Lower the opacity so the underlying text stays readable.</p>",
});
