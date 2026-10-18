import { mountTool } from "../app.js";

mountTool({
  id: "ocr",
  title: "OCR PDF",
  desc: "Make a scanned PDF searchable. The text layer is recognised on your device with Tesseract running in WebAssembly — nothing is uploaded.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Run OCR",
  options: [
    { name: "dpi", label: "Scan resolution", type: "select", value: "200", options: [["150", "Fast (150 DPI)"], ["200", "Balanced (200 DPI)"], ["300", "Accurate (300 DPI, slower)"]] },
    { name: "searchable", label: "Also build a searchable PDF", type: "checkbox", value: true },
  ],
  async run(ctx) {
    ctx.toast("Loading the OCR engine… this can take a moment the first time.");
    const { createWorker } = await import("../vendor/tesseract/tesseract.esm.min.js");
    const worker = await createWorker("eng", 1, {
      workerPath: new URL("../vendor/tesseract/worker.min.js", import.meta.url).href,
      corePath: new URL("../vendor/tesseract-core/", import.meta.url).href,
      langPath: new URL("../vendor/tessdata/", import.meta.url).href,
      gzip: true,
      logger: (m) => { if (m.status && m.progress != null) ctx.progress(Math.min(0.98, m.progress)); },
    });

    try {
      const input = await ctx.files[0].arrayBuffer();
      const viewer = await ctx.openDocument(input);
      const dpi = parseInt(ctx.options.dpi, 10) || 200;
      const { PDFDocument, StandardFonts, rgb } = await ctx.loadPdfLib();
      const out = await PDFDocument.create();
      const font = await out.embedFont(StandardFonts.Helvetica);
      const allText = [];
      const n = viewer.numPages;

      for (let i = 1; i <= n; i++) {
        ctx.progress((i - 1) / n);
        const page = await viewer.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: dpi / 72 });
        const canvas = ctx.canvasOf(vp.width, vp.height);
        const g = canvas.getContext("2d");
        g.fillStyle = "#fff";
        g.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: g, viewport: vp }).promise;

        const { data } = await worker.recognize(canvas);
        allText.push(`----- Page ${i} -----\n\n${(data.text || "").trim()}`);

        if (ctx.options.searchable) {
          const blob = await ctx.canvasBlob(canvas, "image/jpeg", 0.82);
          const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
          const p = out.addPage([base.width, base.height]);
          p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
          const sc = base.width / canvas.width;   // PDF pt per image px
          for (const w of (data.words || [])) {
            const t = (w.text || "").trim();
            if (!t) continue;
            const bb = w.bbox || {};
            const size = Math.max(4, ((bb.y1 || 0) - (bb.y0 || 0)) * sc);
            p.drawText(t, {
              x: (bb.x0 || 0) * sc,
              y: base.height - (bb.y1 || 0) * sc,
              size, font, color: rgb(1, 1, 1), opacity: 0.01,
            });
          }
        }
      }

      const text = allText.join("\n\n");
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      let html = `<textarea readonly style="width:100%;height:220px;margin-top:12px;background:var(--surface-2);color:var(--text);border:1px solid var(--line);border-radius:9px;padding:12px;font:13px/1.5 var(--mono)"></textarea>
        <div class="row" style="margin-top:10px"><a class="dl" href="${url}" download="ocr-text.txt">Download text (.txt)</a></div>`;

      if (ctx.options.searchable) {
        const bytes = await out.save();
        ctx.download(bytes, "searchable.pdf");
        html += `<p class="hint">✓ Also downloaded <b>searchable.pdf</b> — the pages plus an invisible text layer, so it can be searched and selected.</p>`;
      }
      ctx.out.innerHTML = html;
      ctx.out.querySelector("textarea").value = text || "(No text was recognised.)";
    } finally {
      await worker.terminate();
    }
  },
  help: "<p>Tesseract (English) runs in a background worker inside your browser. Each page is rendered, recognised, and — optionally — given an invisible text layer placed over the scanned image, so the PDF becomes searchable. OCR is CPU-heavy: expect a few seconds per page.</p>",
});
