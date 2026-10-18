import { mountTool } from "../app.js";

mountTool({
  id: "pdf-to-jpg",
  title: "PDF to JPG",
  desc: "Render each page of a PDF as a JPG (or PNG) image. Multi-page results are delivered as a ZIP.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Convert to images",
  options: [
    { name: "format", label: "Image format", type: "select", value: "jpeg", options: [["jpeg", "JPG"], ["png", "PNG"]] },
    { name: "scale", label: "Resolution", type: "select", value: "2", options: [["1.5", "Standard (1.5×)"], ["2", "High (2×)"], ["3", "Very high (3×)"]] },
  ],
  async run(ctx) {
    const o = ctx.options;
    const doc = await ctx.openDocument(await ctx.files[0].arrayBuffer());
    const scale = parseFloat(o.scale);
    const mime = o.format === "png" ? "image/png" : "image/jpeg";
    const ext = o.format === "png" ? "png" : "jpg";
    const entries = [];
    for (let i = 1; i <= doc.numPages; i++) {
      ctx.progress(i / doc.numPages);
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(vp.width);
      canvas.height = Math.round(vp.height);
      const c = canvas.getContext("2d");
      c.fillStyle = "#fff";
      c.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: c, viewport: vp }).promise;
      const blob = await new Promise((r) => canvas.toBlob(r, mime, 0.92));
      entries.push({ name: `page-${String(i).padStart(2, "0")}.${ext}`, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    if (entries.length === 1) ctx.download(new Blob([entries[0].data], { type: mime }), entries[0].name, mime);
    else ctx.downloadZip(entries, "pdf-images.zip");
    ctx.out.innerHTML = `<p class="hint">✓ ${entries.length} image(s) ${entries.length === 1 ? "downloaded" : "bundled into pdf-images.zip"}.</p>`;
  },
  help: "<p>Pages are rendered with pdf.js — the engine behind Firefox's PDF viewer — so text and vector art come out crisp.</p>",
});
