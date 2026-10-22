import { mountTool } from "../app.js";

/** Word boxes from either the v5 blocks shape or a flat words array. */
function collectWords(data) {
  if (data.words && data.words.length) return data.words;
  const out = [];
  for (const b of data.blocks || [])
    for (const p of b.paragraphs || [])
      for (const l of p.lines || [])
        for (const w of l.words || []) out.push(w);
  return out;
}

const isPdfBytes = (h) => h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46;

mountTool({
  id: "ocr",
  title: "OCR — text from PDFs & images",
  desc: "Read the text out of a scanned PDF, a photo, or a screenshot. Tesseract runs in WebAssembly inside your browser, so nothing is uploaded.",
  accept: ".pdf,application/pdf,image/*",
  multiple: true,
  action: "Run OCR",
  options: [
    { name: "dpi", label: "Scan resolution (PDF pages)", type: "select", value: "200", options: [["150", "Fast (150 DPI)"], ["200", "Balanced (200 DPI)"], ["300", "Accurate (300 DPI, slower)"], ["400", "Maximum (400 DPI, slowest)"]] },
    { name: "maxside", label: "Max image side (px)", type: "number", value: 2400, min: 600, max: 6000, step: 100 },
    { name: "searchable", label: "Also build a searchable PDF", type: "checkbox", value: false },
    { name: "invert", label: "Invert colours before OCR (dark mode scans)", type: "checkbox", value: false },
  ],
  async onFiles(ctx) {
    const kinds = [];
    for (const f of ctx.files) {
      const h = new Uint8Array(await f.slice(0, 4).arrayBuffer());
      kinds.push(`${f.name} — ${isPdfBytes(h) ? "PDF" : "image"}`);
    }
    ctx.extra.innerHTML = `<p class="hint">Files queued: ${kinds.join(" · ")}</p>`;
  },
  async run(ctx) {
    const o = ctx.options;
    const dpi = parseInt(o.dpi, 10) || 200;
    const maxSide = Number(o.maxside) || 2400;

    // ---- work out what we were given, by content rather than extension ----
    const items = [];
    for (const f of ctx.files) {
      const h = new Uint8Array(await f.slice(0, 4).arrayBuffer());
      items.push({ file: f, isPdf: isPdfBytes(h) });
    }
    if (!items.length) throw new Error("Add a PDF or an image first.");

    ctx.toast("Loading the OCR engine… this can take a moment the first time.");
    const mod = await import("../vendor/tesseract/tesseract.esm.min.js");
    let Tesseract = mod.default || mod;
    if (Tesseract && Tesseract.default && !Tesseract.createWorker) Tesseract = Tesseract.default;
    const createWorker = Tesseract.createWorker || mod.createWorker;
    if (typeof createWorker !== "function") {
      throw new Error("The OCR engine could not be loaded. Reload the page and try again.");
    }

    const worker = await createWorker("eng", 1, {
      workerPath: new URL("../vendor/tesseract/worker.min.js", import.meta.url).href,
      corePath: new URL("../vendor/tesseract-core/", import.meta.url).href,
      langPath: new URL("../vendor/tessdata/", import.meta.url).href,
      gzip: true,
      logger: (m) => { if (m.status && m.progress) ctx.progress(m.progress); },
    });

    const { PDFDocument, StandardFonts, rgb } = await ctx.loadPdfLib();
    const out = o.searchable ? await PDFDocument.create() : null;
    const textParts = [];
    let pagesDone = 0;

    try {
      for (const item of items) {
        const label = item.file.name;
        if (item.isPdf) {
          const viewer = await ctx.openDocument(await item.file.arrayBuffer());
          for (let i = 1; i <= viewer.numPages; i++) {
            ctx.progress(0);
            const page = await viewer.getPage(i);
            const vp = page.getViewport({ scale: dpi / 72 });
            const c = ctx.canvasOf(vp.width, vp.height);
            const g = c.getContext("2d");
            g.fillStyle = "#fff";
            g.fillRect(0, 0, c.width, c.height);
            await page.render({ canvasContext: g, viewport: vp }).promise;
            const { text, words, w, h } = await recognise(ctx, worker, c, o.invert);
            textParts.push(`\n\n----- ${label} · page ${i} -----\n\n${text}`);
            if (out) await addPage(ctx, out, rgb, StandardFonts, c, words, w, h);
            pagesDone++;
          }
        } else {
          const img = await ctx.fileToImage(item.file);
          let c = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
          c.getContext("2d").drawImage(img, 0, 0);
          if (Math.max(c.width, c.height) > maxSide) {
            const k = maxSide / Math.max(c.width, c.height);
            const small = ctx.canvasOf(c.width * k, c.height * k);
            const sg = small.getContext("2d");
            sg.imageSmoothingQuality = "high";
            sg.drawImage(c, 0, 0, small.width, small.height);
            c = small;
          }
          const { text, words, w, h } = await recognise(ctx, worker, c, o.invert);
          textParts.push(`\n\n----- ${label} -----\n\n${text}`);
          if (out) await addPage(ctx, out, rgb, StandardFonts, c, words, w, h);
          pagesDone++;
        }
      }
    } finally {
      try { await worker.terminate(); } catch (e) { /* ignore */ }
    }

    const text = textParts.join("").trim();
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    let searchLine = "";
    if (out) {
      const bytes = await out.save();
      ctx.download(bytes, "searchable.pdf");
      searchLine = ` A searchable PDF (<b>searchable.pdf</b>) was also created with an invisible text layer.`;
    }

    ctx.out.innerHTML = `
      <p class="hint">✓ Recognised ${pagesDone} page(s)/image(s) from ${items.length} file(s).${searchLine}</p>
      <textarea readonly style="width:100%;height:280px;margin-top:12px;background:var(--surface-2);color:var(--text);border:1px solid var(--line);border-radius:9px;padding:12px;font:13px var(--mono)"></textarea>
      <div class="row" style="margin-top:10px"><a class="dl" href="${url}" download="ocr-text.txt">Download .txt</a></div>`;
    ctx.out.querySelector("textarea").value = text || "(No text was recognised — try a higher DPI, or check that the image is not blank.)";
  },
  help: "<p>Tesseract (English) runs in a background worker inside your browser — it reads both PDFs and images. PDF pages are rendered first at the resolution you pick; images are used at their own size, capped by the max-side setting. Tick <b>Also build a searchable PDF</b> to get a PDF with the picture and an invisible, selectable text layer on top. OCR is CPU-heavy: expect a few seconds per page.</p>",
});

/* ---------- helpers ---------- */

async function recognise(ctx, worker, canvas, invert) {
  let target = canvas;
  if (invert) {
    target = ctx.canvasOf(canvas.width, canvas.height);
    const g = target.getContext("2d");
    g.filter = "invert(1)";
    g.drawImage(canvas, 0, 0);
  }
  const res = await worker.recognize(target, {}, { blocks: true, text: true });
  const data = res.data || {};
  return { text: (data.text || "").trim(), words: collectWords(data), w: canvas.width, h: canvas.height };
}

/** Add a page: the scan as an image, with the recognised words as invisible text. */
async function addPage(ctx, doc, rgb, StandardFonts, canvas, words, w, h) {
  const pt = 72 / 200;                   // treat the scan as a 200 DPI page
  const page = doc.addPage([w * pt, h * pt]);
  const blob = await ctx.canvasBlob(canvas, "image/jpeg", 0.85);
  const img = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
  page.drawImage(img, { x: 0, y: 0, width: w * pt, height: h * pt });
  const font = await ctx.fontFor(doc, words.map((w) => w.text || "").join(" "), {});
  for (const word of words) {
    const b = word.bbox || {};
    const size = Math.max(3, (b.y1 - b.y0) * 0.85 * pt);
    try {
      page.drawText(word.text || "", {
        x: b.x0 * pt,
        y: h * pt - b.y1 * pt,
        size, font, color: rgb(1, 1, 1), opacity: 0.01,
      });
    } catch (e) { /* skip glyphs the built-in font cannot encode */ }
  }
}
