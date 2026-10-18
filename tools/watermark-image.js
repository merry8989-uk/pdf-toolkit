import { mountTool } from "../app.js";

const ANCHOR_OPTS = [
  ["bottom-right", "Bottom right"], ["bottom-center", "Bottom centre"], ["bottom-left", "Bottom left"],
  ["middle-right", "Middle right"], ["center", "Centre"], ["middle-left", "Middle left"],
  ["top-right", "Top right"], ["top-center", "Top centre"], ["top-left", "Top left"],
];

function pdfAnchor(anchor, W, H, w, h, m) {
  const x = anchor.includes("left") ? m : anchor.includes("right") ? W - w - m : (W - w) / 2;
  const y = anchor.startsWith("top") ? H - h - m : anchor.startsWith("bottom") ? m : (H - h) / 2;
  return { x, y };
}

mountTool({
  id: "watermark-image",
  title: "Image watermark",
  desc: "Stamp a logo or image onto every page. Add the PDF and the image together — the tool works out which is which.",
  accept: ".pdf,application/pdf,image/*",
  multiple: true,
  action: "Add image watermark",
  options: [
    { name: "width", label: "Width (% of page)", type: "number", value: 30, min: 5, max: 100 },
    { name: "opacity", label: "Opacity", type: "range", value: 0.3, min: 0.05, max: 1, step: 0.05 },
    { name: "anchor", label: "Position", type: "select", value: "center", options: ANCHOR_OPTS },
    { name: "margin", label: "Margin (pt)", type: "number", value: 24, min: 0, max: 120 },
  ],
  async run(ctx) {
    let pdfFile = null, imgFile = null;
    for (const f of ctx.files) {
      const b = new Uint8Array(await f.slice(0, 4).arrayBuffer());
      if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) pdfFile = f;
      else if (!imgFile) imgFile = f;
    }
    if (!pdfFile) throw new Error("Add a PDF file.");
    if (!imgFile) throw new Error("Add an image file (PNG or JPG) to use as the watermark.");

    const o = ctx.options;
    const { PDFDocument } = await ctx.loadPdfLib();
    const doc = await PDFDocument.load(await pdfFile.arrayBuffer(), { ignoreEncryption: true });
    const ib = new Uint8Array(await imgFile.arrayBuffer());
    let png;
    if (ib[0] === 0x89 && ib[1] === 0x50) png = await doc.embedPng(ib);
    else if (ib[0] === 0xff && ib[1] === 0xd8) png = await doc.embedJpg(ib);
    else {
      const bmp = await createImageBitmap(imgFile);
      const c = ctx.canvasOf(bmp.width, bmp.height);
      c.getContext("2d").drawImage(bmp, 0, 0);
      png = await doc.embedPng(new Uint8Array(await (await ctx.canvasBlob(c, "image/png")).arrayBuffer()));
    }

    const pct = Number(o.width) || 30, op = Number(o.opacity) || 0.3, m = Number(o.margin) || 0;
    doc.getPages().forEach((p) => {
      const { width, height } = p.getSize();
      const w = width * pct / 100;
      const h = w * png.height / png.width;
      const { x, y } = pdfAnchor(o.anchor, width, height, w, h, m);
      p.drawImage(png, { x, y, width: w, height: h, opacity: op });
    });
    const bytes = await doc.save();
    ctx.download(bytes, "image-watermarked.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Stamped the image on ${doc.getPageCount()} page(s).</p>`;
  },
  help: "<p>Add exactly one PDF and one image. PNG transparency is preserved, so a logo with a transparent background works best.</p>",
});
