import { mountTool } from "../app.js";

async function raster(ctx, filter, label) {
  const input = await ctx.files[0].arrayBuffer();
  const viewer = await ctx.openDocument(input);
  const { PDFDocument } = await ctx.loadPdfLib();
  const out = await PDFDocument.create();
  for (let i = 1; i <= viewer.numPages; i++) {
    ctx.progress(i / viewer.numPages);
    const page = await viewer.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: 150 / 72 });
    const src = ctx.canvasOf(vp.width, vp.height);
    const sg = src.getContext("2d");
    sg.fillStyle = "#fff";
    sg.fillRect(0, 0, src.width, src.height);
    await page.render({ canvasContext: sg, viewport: vp }).promise;
    const dst = ctx.canvasOf(src.width, src.height);
    const dg = dst.getContext("2d");
    dg.filter = filter;
    dg.drawImage(src, 0, 0);
    const blob = await ctx.canvasBlob(dst, "image/jpeg", 0.88);
    const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    const p = out.addPage([base.width, base.height]);
    p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
  }
  return { bytes: await out.save(), pages: viewer.numPages };
}

mountTool({
  id: "grayscale",
  title: "Grayscale PDF",
  desc: "Convert every page to black and white. Handy for printing and for reducing ink-heavy colour documents.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Convert to grayscale",
  async run(ctx) {
    const { bytes, pages } = await raster(ctx, "grayscale(1)", "grayscale");
    ctx.download(bytes, "grayscale.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Converted ${pages} page(s) to grayscale.</p>`;
  },
  help: "<p>Pages are re-rendered at 150 DPI and converted with a standard luminosity filter, so the output is an image-based PDF — smaller to print, but its text is no longer selectable.</p>",
});
