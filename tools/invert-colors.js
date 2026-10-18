import { mountTool } from "../app.js";

mountTool({
  id: "invert-colors",
  title: "Invert colours",
  desc: "Invert the colours of every page — white becomes black and vice versa. Useful for dark-mode reading and for reducing glare.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Invert colours",
  async run(ctx) {
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
      dg.filter = "invert(1)";
      dg.drawImage(src, 0, 0);
      const blob = await ctx.canvasBlob(dst, "image/jpeg", 0.9);
      const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const p = out.addPage([base.width, base.height]);
      p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
    }
    const bytes = await out.save();
    ctx.download(bytes, "inverted.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Inverted ${viewer.numPages} page(s).</p>`;
  },
  help: "<p>Pages are re-rendered at 150 DPI and inverted as images. This is a visual change, so the text in the output is no longer selectable.</p>",
});
