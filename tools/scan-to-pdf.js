import { mountTool } from "../app.js";

let stream = null;
let shots = [];

function stopCam() {
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
}

mountTool({
  id: "scan-to-pdf",
  title: "Scan to PDF",
  desc: "Use your device camera to capture pages and build a PDF. You can also add image files from your device.",
  noFile: true,
  multiple: true,
  action: "Create PDF",
  options: [
    { name: "quality", label: "Image quality", type: "range", value: 0.85, min: 0.4, max: 0.95, step: 0.05 },
  ],
  onInit(ctx) {
    ctx.extra.innerHTML = `
      <p class="hint">Point your camera at a page and tap <b>Capture</b>. Add as many pages as you like, then create the PDF. On desktop you can also drop image files below.</p>
      <video id="cam" autoplay playsinline muted style="width:100%;max-width:460px;border-radius:10px;background:#000;display:block"></video>
      <div class="row" style="margin-top:10px">
        <button class="btn sm" id="cap" type="button">Capture page</button>
        <button class="btn ghost sm" id="stop" type="button">Stop camera</button>
        <button class="btn ghost sm" id="clear" type="button">Clear pages</button>
      </div>
      <div id="shots" class="pages"></div>`;
    const video = ctx.extra.querySelector("#cam");
    const shotsBox = ctx.extra.querySelector("#shots");

    navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((s) => { stream = s; video.srcObject = s; })
      .catch((e) => {
        ctx.extra.insertAdjacentHTML("afterbegin",
          `<p class="hint" style="color:var(--danger)">Camera unavailable (${e.name || e.message}). Add image files instead.</p>`);
      });

    ctx.extra.querySelector("#cap").addEventListener("click", () => {
      if (!video.videoWidth) { ctx.toast("Camera is not ready yet.", true); return; }
      const c = ctx.canvasOf(video.videoWidth, video.videoHeight);
      c.getContext("2d").drawImage(video, 0, 0);
      shots.push(c);
      const thumb = ctx.canvasOf(120, 120 * c.height / c.width);
      thumb.getContext("2d").drawImage(c, 0, 0, thumb.width, thumb.height);
      const box = document.createElement("div");
      box.className = "pg";
      box.appendChild(thumb);
      const n = document.createElement("div");
      n.className = "n";
      n.textContent = "Page " + shots.length;
      box.appendChild(n);
      shotsBox.appendChild(box);
    });
    ctx.extra.querySelector("#stop").addEventListener("click", stopCam);
    ctx.extra.querySelector("#clear").addEventListener("click", () => { shots = []; shotsBox.innerHTML = ""; });
  },
  onReset() { stopCam(); shots = []; },
  async run(ctx) {
    const q = Number(ctx.options.quality) || 0.85;
    const pages = [];
    for (const c of shots) {
      const blob = await ctx.canvasBlob(c, "image/jpeg", q);
      pages.push({ kind: "jpg", data: new Uint8Array(await blob.arrayBuffer()) });
    }
    for (const f of ctx.files) {
      const b = new Uint8Array(await f.arrayBuffer());
      if (b[0] === 0xff && b[1] === 0xd8) pages.push({ kind: "jpg", data: b });
      else if (b[0] === 0x89 && b[1] === 0x50) pages.push({ kind: "png", data: b });
      else {
        const bmp = await createImageBitmap(f);
        const c = ctx.canvasOf(bmp.width, bmp.height);
        c.getContext("2d").drawImage(bmp, 0, 0);
        const blob = await ctx.canvasBlob(c, "image/png");
        pages.push({ kind: "png", data: new Uint8Array(await blob.arrayBuffer()) });
      }
    }
    if (!pages.length) throw new Error("Capture a page or add an image file first.");

    const { PDFDocument } = await ctx.loadPdfLib();
    const out = await PDFDocument.create();
    for (let i = 0; i < pages.length; i++) {
      ctx.progress(i / pages.length);
      const pg = pages[i];
      const img = pg.kind === "jpg" ? await out.embedJpg(pg.data) : await out.embedPng(pg.data);
      const page = out.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }
    const bytes = await out.save();
    ctx.download(bytes, "scan.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Created <b>scan.pdf</b> with ${pages.length} page(s).</p>`;
  },
  help: "<p>Frames are captured straight to JPEG in your browser — no photo ever leaves your device. Each captured page becomes one PDF page at the captured resolution.</p>",
});
