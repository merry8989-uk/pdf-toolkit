import { mountTool } from "../app.js";

mountTool({
  id: "crop",
  title: "Crop PDF",
  desc: "Trim the visible margins of every page by a percentage of its width and height.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Crop pages",
  options: [
    { name: "top", label: "Trim from top (%)", type: "number", value: 5, min: 0, max: 45 },
    { name: "bottom", label: "Trim from bottom (%)", type: "number", value: 5, min: 0, max: 45 },
    { name: "left", label: "Trim from left (%)", type: "number", value: 5, min: 0, max: 45 },
    { name: "right", label: "Trim from right (%)", type: "number", value: 5, min: 0, max: 45 },
  ],
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const o = ctx.options;
    const doc = await PDFDocument.load(await ctx.files[0].arrayBuffer(), { ignoreEncryption: true });
    const t = +o.top / 100, b = +o.bottom / 100, l = +o.left / 100, r = +o.right / 100;
    if (l + r >= 1 || t + b >= 1) throw new Error("Crop percentages are too large — nothing would remain.");
    doc.getPages().forEach((p) => {
      const { width, height } = p.getSize();
      p.setCropBox(width * l, height * b, width * (1 - l - r), height * (1 - t - b));
    });
    const bytes = await doc.save();
    ctx.download(bytes, "cropped.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Cropped ${doc.getPageCount()} page(s).</p>`;
  },
  help: "<p>Crop changes the visible area (the crop box) only. The content outside it still exists in the file — that is how PDF cropping is defined.</p>",
});
