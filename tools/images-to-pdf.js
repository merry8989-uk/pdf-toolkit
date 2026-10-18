import { mountTool } from "../app.js";

async function toPng(file) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  c.getContext("2d").drawImage(bmp, 0, 0);
  return await new Promise((r) => c.toBlob(r, "image/png"));
}

mountTool({
  id: "images-to-pdf",
  title: "Images to PDF",
  desc: "Combine JPG, PNG or WebP images into a single PDF, one page per image. Reorder them before converting.",
  accept: "image/*",
  multiple: true,
  reorder: true,
  action: "Create PDF",
  options: [
    { name: "size", label: "Page size", type: "select", value: "fit", options: [["fit", "Fit to image"], ["a4", "A4"], ["letter", "Letter"]] },
    { name: "orientation", label: "Orientation", type: "select", value: "auto", options: [["auto", "Auto"], ["portrait", "Portrait"], ["landscape", "Landscape"]] },
    { name: "margin", label: "Margin (points)", type: "number", value: 0, min: 0, max: 72 },
  ],
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const o = ctx.options;
    const out = await PDFDocument.create();
    const dims = { a4: [595.28, 841.89], letter: [612, 792] };
    for (let i = 0; i < ctx.files.length; i++) {
      ctx.progress(i / ctx.files.length);
      const bytes = new Uint8Array(await ctx.files[i].arrayBuffer());
      let img;
      if (bytes[0] === 0xff && bytes[1] === 0xd8) img = await out.embedJpg(bytes);
      else if (bytes[0] === 0x89 && bytes[1] === 0x50) img = await out.embedPng(bytes);
      else img = await out.embedPng(new Uint8Array(await (await toPng(ctx.files[i])).arrayBuffer()));

      if (o.size === "fit") {
        const page = out.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      } else {
        let [pw, ph] = dims[o.size] || dims.a4;
        const land = o.orientation === "landscape" || (o.orientation === "auto" && img.width > img.height);
        if (land) [pw, ph] = [ph, pw];
        const m = Number(o.margin) || 0;
        const s = Math.min((pw - 2 * m) / img.width, (ph - 2 * m) / img.height);
        const w = img.width * s, h = img.height * s;
        const page = out.addPage([pw, ph]);
        page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
      }
    }
    const bytes = await out.save();
    ctx.download(bytes, "images.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Created a PDF with ${ctx.files.length} page(s).</p>`;
  },
  help: "<p>JPG and PNG are embedded as-is (no re-compression). WebP and other formats are converted to PNG in your browser first.</p>",
});
