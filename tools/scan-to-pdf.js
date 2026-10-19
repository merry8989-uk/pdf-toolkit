import { mountTool, PHOTO_FILTERS } from "../app.js";

let stream = null;
let pages = [];          // { canvas, rot }
let activeFilter = "document";

const FILTER_OPTS = Object.entries(PHOTO_FILTERS).map(([k, v]) => [k, v.label]);

function stopCam() {
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
}

async function startCam(video, deviceId) {
  stopCam();
  const video0 = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } };
  stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: video0 });
  video.srcObject = stream;
  await video.play().catch(() => {});
  return stream;
}

mountTool({
  id: "scan-to-pdf",
  title: "Scan to PDF",
  desc: "Open your camera, capture pages, clean them up with filters, rotate or delete pages, then build a PDF. You can also add photos from your device.",
  noFile: true,
  multiple: true,
  action: "Create PDF",
  options: [
    { name: "filter", label: "Page filter", type: "select", value: "document", options: FILTER_OPTS },
    { name: "maxdim", label: "Max page size (px)", type: "number", value: 2200, min: 600, max: 5000, step: 100 },
    { name: "quality", label: "JPEG quality", type: "range", value: 0.85, min: 0.4, max: 0.95, step: 0.05 },
  ],
  onInit(ctx) {
    ctx.extra.innerHTML = `
      <div class="row" style="margin:14px 0 10px">
        <button class="btn sm" id="open" type="button">📷 Open camera</button>
        <select id="camsel" style="display:none;max-width:240px;background:var(--surface-2);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font:inherit;font-size:13px"></select>
        <button class="btn ghost sm" id="stop" type="button" style="display:none">Stop camera</button>
        <button class="btn ghost sm" id="cap" type="button" disabled>Capture page</button>
        <button class="btn ghost sm" id="addimg" type="button">Add image files</button>
        <input type="file" id="imgs" accept="image/*" multiple style="display:none">
      </div>
      <video id="cam" autoplay playsinline muted style="width:100%;max-width:520px;border-radius:10px;background:#000;display:none"></video>
      <p class="hint" id="cammsg">Tap <b>Open camera</b> to start scanning. On a laptop you can also just add image files.</p>
      <div class="row" style="margin-top:14px;display:none" id="editbar">
        <button class="btn ghost sm" id="rotall" type="button">Rotate all 90°</button>
        <button class="btn ghost sm" id="clrall" type="button">Clear all pages</button>
        <span class="hint" id="pcount" style="margin:0"></span>
      </div>
      <div id="pages" class="pages"></div>`;

    const video = ctx.extra.querySelector("#cam");
    const sel = ctx.extra.querySelector("#camsel");
    const msg = ctx.extra.querySelector("#cammsg");
    const editbar = ctx.extra.querySelector("#editbar");
    const box = ctx.extra.querySelector("#pages");
    const capBtn = ctx.extra.querySelector("#cap");
    const stopBtn = ctx.extra.querySelector("#stop");
    const openBtn = ctx.extra.querySelector("#open");
    const imgs = ctx.extra.querySelector("#imgs");
    const filterSel = document.getElementById("opt-filter");

    function refreshEditBar() {
      editbar.style.display = pages.length ? "flex" : "none";
      ctx.extra.querySelector("#pcount").textContent = pages.length ? `${pages.length} page(s) captured` : "";
    }

    function thumbOf(page, maxW) {
      const base = ctx.fitCanvas(page.canvas, 700);
      const filtered = ctx.applyFilter(base, activeFilter);
      const rotated = ctx.rotCanvas(filtered, page.rot);
      const s = maxW / rotated.width;
      const t = ctx.canvasOf(maxW, rotated.height * s);
      t.getContext("2d").drawImage(rotated, 0, 0, t.width, t.height);
      return t;
    }

    function renderPages() {
      box.innerHTML = "";
      pages.forEach((p, i) => {
        const wrap = document.createElement("div");
        wrap.className = "pg";
        wrap.style.cursor = "default";
        wrap.appendChild(thumbOf(p, 130));
        const n = document.createElement("div");
        n.className = "n";
        n.textContent = `Page ${i + 1}`;
        wrap.appendChild(n);
        const bar = document.createElement("div");
        bar.style.cssText = "display:flex;gap:4px;justify-content:center;margin-top:4px;flex-wrap:wrap";
        const mk = (label, title, fn) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = label;
          b.title = title;
          b.style.cssText = "background:var(--surface);border:1px solid var(--line);color:var(--dim);border-radius:6px;width:24px;height:22px;cursor:pointer;font-size:11px;line-height:1";
          b.onclick = fn;
          return b;
        };
        bar.append(
          mk("↺", "Rotate left", () => { p.rot = (p.rot + 270) % 360; renderPages(); }),
          mk("↻", "Rotate right", () => { p.rot = (p.rot + 90) % 360; renderPages(); }),
          mk("←", "Move earlier", () => { if (i > 0) { [pages[i - 1], pages[i]] = [pages[i], pages[i - 1]]; renderPages(); } }),
          mk("→", "Move later", () => { if (i < pages.length - 1) { [pages[i + 1], pages[i]] = [pages[i], pages[i + 1]]; renderPages(); } }),
          mk("✕", "Delete", () => { pages.splice(i, 1); renderPages(); }),
        );
        wrap.appendChild(bar);
        box.appendChild(wrap);
      });
      refreshEditBar();
    }

    async function populateCams() {
      try {
        const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
        if (devs.length > 1) {
          sel.innerHTML = devs.map((d, i) => `<option value="${d.deviceId}">${d.label || "Camera " + (i + 1)}</option>`).join("");
          sel.style.display = "";
        }
      } catch (e) { /* labels are unavailable without permission — that is fine */ }
    }

    openBtn.addEventListener("click", async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        msg.innerHTML = "This browser does not expose a camera API. Add image files instead.";
        return;
      }
      try {
        await startCam(video, sel.value || undefined);
        video.style.display = "";
        stopBtn.style.display = "";
        capBtn.disabled = false;
        openBtn.textContent = "📷 Camera on";
        msg.innerHTML = "Camera is live. Tap <b>Capture page</b> for each page, then create the PDF.";
        await populateCams();
      } catch (e) {
        msg.innerHTML = `<span style="color:var(--danger)">Could not open the camera (${e.name || e.message}).</span> Check the browser's camera permission, or add image files instead.`;
      }
    });

    sel.addEventListener("change", async () => {
      try { await startCam(video, sel.value); } catch (e) { ctx.toast("Could not switch camera", true); }
    });

    stopBtn.addEventListener("click", () => {
      stopCam();
      video.style.display = "none";
      stopBtn.style.display = "none";
      capBtn.disabled = true;
      openBtn.textContent = "📷 Open camera";
      msg.textContent = "Camera stopped.";
    });

    capBtn.addEventListener("click", () => {
      if (!video.videoWidth) { ctx.toast("Camera is not ready yet.", true); return; }
      const c = ctx.canvasOf(video.videoWidth, video.videoHeight);
      c.getContext("2d").drawImage(video, 0, 0);
      pages.push({ canvas: c, rot: 0 });
      renderPages();
    });

    ctx.extra.querySelector("#addimg").addEventListener("click", () => imgs.click());
    imgs.addEventListener("change", async () => {
      for (const f of imgs.files) {
        const img = await ctx.fileToImage(f);
        const c = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
        c.getContext("2d").drawImage(img, 0, 0);
        pages.push({ canvas: c, rot: 0 });
      }
      imgs.value = "";
      renderPages();
    });

    ctx.extra.querySelector("#rotall").addEventListener("click", () => { pages.forEach((p) => { p.rot = (p.rot + 90) % 360; }); renderPages(); });
    ctx.extra.querySelector("#clrall").addEventListener("click", () => { pages = []; renderPages(); });

    // live-update the thumbnails when the filter changes
    if (filterSel) {
      activeFilter = filterSel.value || "document";
      filterSel.addEventListener("change", () => { activeFilter = filterSel.value; renderPages(); });
    }

    ctx._scanStop = () => { stopCam(); };
    renderPages();
  },
  onReset(ctx) {
    if (ctx._scanStop) ctx._scanStop();
    pages = [];
  },
  async run(ctx) {
    if (!pages.length) throw new Error("Open the camera and capture a page, or add an image file first.");
    const o = ctx.options;
    const filter = o.filter || "document";
    const maxdim = Number(o.maxdim) || 2200;
    const q = Number(o.quality) || 0.85;

    const { PDFDocument } = await ctx.loadPdfLib();
    const out = await PDFDocument.create();
    for (let i = 0; i < pages.length; i++) {
      ctx.progress(i / pages.length);
      const p = pages[i];
      let c = ctx.fitCanvas(p.canvas, maxdim);
      c = ctx.applyFilter(c, filter);
      c = ctx.rotCanvas(c, p.rot);
      const blob = await ctx.canvasBlob(c, "image/jpeg", q);
      const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const page = out.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }
    const bytes = await out.save();
    ctx.download(bytes, "scan.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Created <b>scan.pdf</b> with ${pages.length} page(s), using the “${PHOTO_FILTERS[filter]?.label || filter}” filter.</p>`;
  },
  help: "<p><b>Open camera</b> asks your browser for camera access; nothing is recorded or uploaded — frames become JPEGs in this tab. Use <b>Add image files</b> for photos you already have. The filter applies to every page, and each thumbnail has rotate, move and delete buttons. Rotate or delete a page before creating the PDF.</p>",
});
