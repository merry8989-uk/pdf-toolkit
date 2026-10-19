/* ============================================================
   PDF Toolkit — shared engine + UI kit
   Everything runs in the browser. No uploads, no server, no CDN.
   ============================================================ */
import { createZip } from "./zip.js";
import { REGISTRY, ALL_TOOLS } from "./registry.js";
export { createZip, REGISTRY, ALL_TOOLS };

/* ---------- lazy library loaders (imported only when needed) ---------- */
let _pdfLib = null;
export function loadPdfLib() {
  if (!_pdfLib) _pdfLib = import("./vendor/pdf-lib.esm.min.js");
  return _pdfLib;
}

let _pdfJs = null;
export function loadPdfJs() {
  if (!_pdfJs) {
    _pdfJs = import("./vendor/pdf.min.mjs").then((m) => {
      m.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.min.mjs", import.meta.url).href;
      return m;
    });
  }
  return _pdfJs;
}

/** Open a PDF with pdf.js, with local standard-font and cmap paths wired up. */
export async function openDocument(data) {
  const pdfjs = await loadPdfJs();
  return pdfjs.getDocument({
    data: data instanceof Uint8Array ? data : new Uint8Array(data),
    standardFontDataUrl: new URL("./vendor/standard_fonts/", import.meta.url).href,
    cMapUrl: new URL("./vendor/cmaps/", import.meta.url).href,
    cMapPacked: true,
  }).promise;
}

/* ---------- small helpers ---------- */
export function fmtSize(n) {
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  return (n / 1048576).toFixed(2) + " MB";
}

/** "1-3,5,8-" -> [1,2,3,5,8,9,...max]  (1-based, clamped, de-duped, sorted) */
export function parseRanges(str, max) {
  const out = new Set();
  if (!str) return [];
  for (const part of String(str).split(",")) {
    const p = part.trim();
    if (!p) continue;
    const m = p.match(/^(\d+)\s*-\s*(\d*)$/);
    if (m) {
      const a = Math.max(1, parseInt(m[1], 10));
      const b = m[2] ? Math.min(max, parseInt(m[2], 10)) : max;
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.add(i);
    } else if (/^\d+$/.test(p)) {
      const n = parseInt(p, 10);
      if (n >= 1 && n <= max) out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}

export function download(data, name, mime = "application/pdf") {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function toast(msg, isErr = false) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.toggle("err", !!isErr);
  t.classList.add("on");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("on"), 3200);
}

/* ---------- page thumbnails via pdf.js ---------- */
export async function thumbnails(file, container, opts = {}) {
  const doc = await openDocument(await file.arrayBuffer());
  container.innerHTML = "";
  container.classList.add("pages");
  const items = new Map();
  const w = opts.width || 150;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: w / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    const el = document.createElement("div");
    el.className = "pg";
    el.dataset.page = i;
    el.appendChild(canvas);
    const n = document.createElement("div");
    n.className = "n";
    n.textContent = "Page " + i;
    el.appendChild(n);
    if (opts.onClick) el.addEventListener("click", () => opts.onClick(i, el));
    container.appendChild(el);
    items.set(i, el);
  }
  return { items, numPages: doc.numPages };
}

/* ---------- image helpers (used by the Photos tools) ---------- */
export async function fileToImage(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error("That file could not be read as an image."));
      img.src = url;
    });
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }
}

export function canvasOf(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function canvasBlob(canvas, mime = "image/png", quality = 0.92) {
  return new Promise((res) => canvas.toBlob(res, mime, quality));
}

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Position a box of w×h inside W×H for an anchor like "bottom-right". */
export function anchorXY(anchor, W, H, w, h, margin = 24) {
  const a = anchor || "center";
  let x, y;
  if (a.includes("left")) x = margin;
  else if (a.includes("right")) x = W - w - margin;
  else x = (W - w) / 2;
  if (a.startsWith("top")) y = margin;
  else if (a.startsWith("bottom")) y = H - h - margin;
  else y = (H - h) / 2;
  return { x, y };
}

export const ANCHORS = [
  ["top-left", "Top left"], ["top-center", "Top centre"], ["top-right", "Top right"],
  ["middle-left", "Middle left"], ["center", "Centre"], ["middle-right", "Middle right"],
  ["bottom-left", "Bottom left"], ["bottom-center", "Bottom centre"], ["bottom-right", "Bottom right"],
];

/* ---------- photo filters & editors (shared by scan, filters and adjust tools) ---------- */
export const PHOTO_FILTERS = {
  none:     { label: "Original",        css: "" },
  document: { label: "Document scan",   css: "grayscale(1) contrast(1.45) brightness(1.12)" },
  bw:       { label: "Black & white",   css: "grayscale(1) contrast(1.6) brightness(1.05)", pixel: "threshold" },
  grayscale:{ label: "Grayscale",       css: "grayscale(1)" },
  enhance:  { label: "Enhance",         css: "contrast(1.25) saturate(1.15) brightness(1.06)" },
  lighten:  { label: "Lighten",         css: "brightness(1.2)" },
  darken:   { label: "Darken",          css: "brightness(0.86)" },
  sepia:    { label: "Sepia",           css: "sepia(0.85)" },
  warm:     { label: "Warm",            css: "sepia(0.35) saturate(1.25) brightness(1.03)" },
  cool:     { label: "Cool",            css: "hue-rotate(-14deg) saturate(1.15) brightness(1.02)" },
  fade:     { label: "Fade",            css: "contrast(0.85) saturate(0.72) brightness(1.08)" },
  vivid:    { label: "Vivid",           css: "saturate(1.55) contrast(1.12)" },
  invert:   { label: "Invert",          css: "invert(1)" },
};

/** Apply a named preset filter to a canvas, returning a NEW canvas. */
export function applyFilter(src, name) {
  const f = PHOTO_FILTERS[name] || PHOTO_FILTERS.none;
  const out = canvasOf(src.width, src.height);
  const g = out.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, out.width, out.height);
  if (f.css) g.filter = f.css;
  g.drawImage(src, 0, 0);
  g.filter = "none";
  if (f.pixel === "threshold") {
    const d = g.getImageData(0, 0, out.width, out.height);
    const a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      const lum = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
      const v = lum > 142 ? 255 : 0;
      a[i] = a[i + 1] = a[i + 2] = v;
    }
    g.putImageData(d, 0, 0);
  }
  return out;
}

/** Manual adjustments. All values are 100 = unchanged except hue (deg) and blur (px). */
export function adjustCanvas(src, a = {}) {
  const out = canvasOf(src.width, src.height);
  const g = out.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, out.width, out.height);
  const parts = [];
  if (a.brightness != null && a.brightness !== 100) parts.push(`brightness(${a.brightness / 100})`);
  if (a.contrast != null && a.contrast !== 100) parts.push(`contrast(${a.contrast / 100})`);
  if (a.saturation != null && a.saturation !== 100) parts.push(`saturate(${a.saturation / 100})`);
  if (a.hue) parts.push(`hue-rotate(${a.hue}deg)`);
  if (a.blur) parts.push(`blur(${a.blur}px)`);
  if (a.sepia) parts.push(`sepia(${a.sepia / 100})`);
  if (a.grayscale) parts.push(`grayscale(${a.grayscale / 100})`);
  g.filter = parts.join(" ") || "none";
  g.drawImage(src, 0, 0);
  return out;
}

/** Simple box-free 3×3 unsharp mask. amount 0..1. */
export function sharpenCanvas(src, amount = 0.6) {
  const w = src.width, h = src.height;
  const s = src.getContext("2d").getImageData(0, 0, w, h);
  const a = s.data;
  const out = new Uint8ClampedArray(a);
  const k = amount, centre = 1 + 4 * k, side = -k;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        out[i + c] = centre * a[i + c] + side * (a[i - 4 + c] + a[i + 4 + c] + a[i - w * 4 + c] + a[i + w * 4 + c]);
      }
    }
  }
  const dst = canvasOf(w, h);
  dst.getContext("2d").putImageData(new ImageData(out, w, h), 0, 0);
  return dst;
}

/** Rotate a canvas by 0/90/180/270 degrees. */
export function rotCanvas(src, deg) {
  deg = ((deg % 360) + 360) % 360;
  if (!deg) return src;
  const swap = deg === 90 || deg === 270;
  const out = canvasOf(swap ? src.height : src.width, swap ? src.width : src.height);
  const g = out.getContext("2d");
  g.translate(out.width / 2, out.height / 2);
  g.rotate(deg * Math.PI / 180);
  g.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

/** Mirror a canvas horizontally and/or vertically. */
export function flipCanvas(src, h, v) {
  const out = canvasOf(src.width, src.height);
  const g = out.getContext("2d");
  g.translate(h ? out.width : 0, v ? out.height : 0);
  g.scale(h ? -1 : 1, v ? -1 : 1);
  g.drawImage(src, 0, 0);
  return out;
}

/** Downscale a canvas so its longest edge is at most max. */
export function fitCanvas(src, max) {
  const s = Math.min(1, max / Math.max(src.width, src.height));
  if (s >= 1) return src;
  const out = canvasOf(src.width * s, src.height * s);
  const g = out.getContext("2d");
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

/* ---------- shared photo-editor helpers ---------- */

/** Run a per-pixel function over a canvas. fn returns [r,g,b,a] or null to keep. */
export function pixelMap(src, fn) {
  const out = canvasOf(src.width, src.height);
  const g = out.getContext("2d");
  g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, out.width, out.height);
  const a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const r = fn(a[i], a[i + 1], a[i + 2], a[i + 3], i >> 2);
    if (r) { a[i] = r[0]; a[i + 1] = r[1]; a[i + 2] = r[2]; a[i + 3] = r[3]; }
  }
  g.putImageData(d, 0, 0);
  return out;
}

export function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

/** Draw source into a fresh canvas, optionally filled first. */
export function canvasFrom(src, fill) {
  const out = canvasOf(src.width, src.height);
  const g = out.getContext("2d");
  if (fill) { g.fillStyle = fill; g.fillRect(0, 0, out.width, out.height); }
  g.drawImage(src, 0, 0);
  return out;
}

/**
 * Show an image with a draggable rectangular selection.
 * Returns { get() -> {x,y,w,h} in SOURCE pixels or null, view }.
 */
export function regionPicker(ctx, host, source, opts = {}) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative;display:inline-block;border:1px solid var(--line);border-radius:8px;overflow:hidden;max-width:100%";
  const base = ctx.canvasOf(1, 1), over = ctx.canvasOf(1, 1);
  base.style.display = "block";
  over.style.cssText = "position:absolute;left:0;top:0;cursor:crosshair;touch-action:none";
  wrap.append(base, over);
  host.appendChild(wrap);

  const view = ctx.fitCanvas(source, opts.max || 560);
  base.width = over.width = view.width;
  base.height = over.height = view.height;
  base.getContext("2d").drawImage(view, 0, 0);
  const scale = source.width / view.width;

  let rect = null, sx = 0, sy = 0, drag = false;
  const paint = () => {
    const g = over.getContext("2d");
    g.clearRect(0, 0, over.width, over.height);
    if (!rect) return;
    g.fillStyle = "rgba(0,0,0,.35)";
    g.fillRect(rect.x, rect.y, rect.w, rect.h);
    g.strokeStyle = "#f0b429";
    g.lineWidth = 2;
    g.strokeRect(rect.x, rect.y, rect.w, rect.h);
  };
  const pos = (e) => {
    const r = over.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (cx - r.left) * over.width / r.width, y: (cy - r.top) * over.height / r.height };
  };
  const down = (e) => { e.preventDefault(); drag = true; const p = pos(e); sx = p.x; sy = p.y; };
  const move = (e) => {
    if (!drag) return;
    e.preventDefault();
    const p = pos(e);
    rect = { x: Math.min(sx, p.x), y: Math.min(sy, p.y), w: Math.abs(p.x - sx), h: Math.abs(p.y - sy) };
    paint();
  };
  const up = () => { if (drag) { drag = false; if (opts.onChange) opts.onChange(get()); } };
  const get = () => rect && rect.w > 4 && rect.h > 4
    ? { x: Math.round(rect.x * scale), y: Math.round(rect.y * scale), w: Math.round(rect.w * scale), h: Math.round(rect.h * scale) }
    : null;
  over.addEventListener("mousedown", down);
  over.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
  over.addEventListener("touchstart", down, { passive: false });
  over.addEventListener("touchmove", move, { passive: false });
  over.addEventListener("touchend", up);
  paint();
  return { get, view, scale };
}

/** Minimal EXIF reader for JPEG files. Returns a flat tag map (may be empty). */
export async function readExif(file) {
  const buf = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
  if (buf.getUint16(0) !== 0xffd8) return {};
  let off = 2;
  while (off + 4 < buf.byteLength) {
    if (buf.getUint8(off) !== 0xff) { off++; continue; }
    const marker = buf.getUint8(off + 1);
    const size = buf.getUint16(off + 2);
    if (marker === 0xe1) {
      const start = off + 4;
      if (buf.getUint32(start) !== 0x45786966) return {};   // "Exif"
      const tiff = start + 6;
      const little = buf.getUint16(tiff) === 0x4949;
      const rd16 = (p) => buf.getUint16(p, little);
      const rd32 = (p) => buf.getUint32(p, little);
      const ifd0 = tiff + rd32(tiff + 4);
      const NAMES = { 0x010f: "Make", 0x0110: "Model", 0x0132: "DateTime", 0x0112: "Orientation", 0x011a: "XResolution", 0x8769: "ExifIFD", 0x8825: "GPSIFD", 0x0131: "Software", 0x829a: "ExposureTime", 0x829d: "FNumber", 0x8827: "ISO", 0x920a: "FocalLength", 0x9003: "DateTimeOriginal", 0xa002: "PixelXDimension", 0xa003: "PixelYDimension", 0x9209: "Flash", 0xa434: "LensModel" };
      const out = {};
      const readIFD = (at) => {
        const n = rd16(at);
        for (let i = 0; i < n; i++) {
          const e = at + 2 + i * 12;
          const tag = rd16(e);
          const type = rd16(e + 2);
          const count = rd32(e + 4);
          const name = NAMES[tag];
          if (name === "ExifIFD" || name === "GPSIFD") { readIFD(tiff + rd32(e + 8)); continue; }
          if (!name) continue;
          const vOff = tiff + (count * (type === 3 ? 2 : 4) > 4 ? rd32(e + 8) : e + 8);
          let val = "";
          if (type === 2) {
            let s = "";
            for (let k = 0; k < count; k++) { const c = buf.getUint8(vOff + k); if (!c) break; s += String.fromCharCode(c); }
            val = s.trim();
          } else if (type === 3) val = rd16(vOff);
          else if (type === 4) val = rd32(vOff);
          else if (type === 5) val = (rd32(vOff) / rd32(vOff + 4)).toFixed(3);
          else if (type === 10) val = (buf.getInt32(vOff, little) / buf.getInt32(vOff + 4, little)).toFixed(3);
          if (name === "ExposureTime" && typeof val === "number") val = `1/${Math.round(1 / val)} s`;
          out[name] = val;
        }
      };
      readIFD(ifd0);
      return out;
    }
    if (marker === 0xda || marker === 0xd9) break;
    off += 2 + size;
  }
  return {};
}

/* ---------- install prompt + service worker ---------- */
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    window.__installPrompt = e;
    const b = document.getElementById("installApp");
    if (b) b.style.display = "";
  });
  window.addEventListener("appinstalled", () => {
    window.__installPrompt = null;
    const b = document.getElementById("installApp");
    if (b) b.style.display = "none";
  });
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
}

/* ---------- site chrome ---------- */
function chrome(active) {
  const theme = localStorage.getItem("theme");
  if (theme) document.documentElement.dataset.theme = theme;

  const header = document.createElement("header");
  header.className = "site";
  const ddHtml = REGISTRY.map((cat) => `
    <div class="dd">
      <button class="dd-btn" aria-haspopup="true" aria-expanded="false">${cat.icon} ${cat.name} <span class="caret">▾</span></button>
      <div class="dd-menu">
        ${cat.groups.map((g) => `
          <div class="dd-group">
            <div class="dd-group-title">${g.name}</div>
            ${g.tools.map((t) => `<a href="./${t[0]}.html">${t[1]}</a>`).join("")}
          </div>`).join("")}
      </div>
    </div>`).join("");
  header.innerHTML = `
    <div class="bar">
      <a class="logo" href="./index.html"><span class="mark"></span>PDF&nbsp;Toolkit</a>
      <nav>
        <a href="./tools.html">All tools</a>
        ${ddHtml}
        <a href="./guide.html">Guide</a>
        <button class="theme-btn" title="Toggle theme" aria-label="Toggle theme">◐</button>
      </nav>
    </div>`;
  header.querySelectorAll(".dd-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const dd = btn.parentElement;
      const wasOpen = dd.classList.contains("open");
      header.querySelectorAll(".dd").forEach((d) => d.classList.remove("open"));
      if (!wasOpen) dd.classList.add("open");
      btn.setAttribute("aria-expanded", String(!wasOpen));
    });
  });
  document.addEventListener("click", () => header.querySelectorAll(".dd").forEach((d) => d.classList.remove("open")));
  header.querySelector(".theme-btn").addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
  });
  document.body.prepend(header);

  const footer = document.createElement("footer");
  footer.className = "site";
  footer.innerHTML = `
    <div class="bar" style="flex-direction:column;align-items:stretch;gap:18px">
      <div class="foot-main">
        <div class="foot-col">
          <div class="foot-title">Get the app</div>
          <p class="foot-note">Install it like a native app, or download the whole thing and run it yourself — it is a static site.</p>
          <div class="row">
            <button class="btn sm" id="installApp" type="button" style="display:none">⬇ Install app</button>
            <a class="btn ghost sm" href="https://github.com/merry8989-uk/pdf-toolkit/archive/refs/heads/main.zip" rel="noopener">⬇ Download source (.zip)</a>
            <a class="btn ghost sm" href="https://github.com/merry8989-uk/pdf-toolkit" target="_blank" rel="noopener">View on GitHub</a>
          </div>
          <p class="foot-note" id="installHint">Installing adds an icon to your home screen and lets every tool run offline.</p>
        </div>
        <div class="foot-col">
          <div class="foot-title">Suggest a feature</div>
          <p class="foot-note">Found a bug, or want a tool that isn't here? Send it over — ideas are very welcome.</p>
          <div class="row">
            <a class="btn ghost sm" href="https://instagram.com/osintgram_io" target="_blank" rel="noopener">📸 @osintgram_io</a>
          </div>
        </div>
      </div>
      <div class="foot-bottom">
        <span>© ${new Date().getFullYear()} PDF Toolkit — every file is processed in your browser, never uploaded.</span>
        <span class="foot-links">
          <a href="./tools.html">All tools</a><a href="./guide.html">Guide</a><a href="./privacy.html">Privacy</a><a href="./terms.html">Terms</a>
        </span>
      </div>
    </div>`;
  document.body.appendChild(footer);

  const installBtn = footer.querySelector("#installApp");
  const showInstall = () => { if (window.__installPrompt && installBtn) installBtn.style.display = ""; };
  showInstall();
  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      const p = window.__installPrompt;
      if (!p) { toast("Use your browser menu → “Install app” or “Add to Home screen”."); return; }
      p.prompt();
      try { await p.userChoice; } catch (e) { /* ignore */ }
      window.__installPrompt = null;
      installBtn.style.display = "none";
    });
  }
  return { header, footer };
}

/* ---------- tool page builder ---------- */
export function mountTool(cfg) {
  const { header, footer } = chrome(cfg.id);
  let main = document.getElementById("app");
  const isNew = !main;
  if (isNew) { main = document.createElement("main"); main.id = "app"; }

  main.innerHTML = `
    <div class="tool-head">
      <a class="back" href="./tools.html">← All tools</a>
      <h1>${cfg.title}</h1>
      <p class="lead">${cfg.desc}</p>
    </div>
    <div class="panel" id="p-drop">
      <div class="drop" id="drop" tabindex="0" role="button" aria-label="Choose files">
        <div class="big">Choose ${cfg.multiple ? "files" : "a file"}</div>
        <div class="sub">${cfg.hint || "Drop here or click to browse"} · processed on your device</div>
        <span class="cta">Select file${cfg.multiple ? "s" : ""}</span>
      </div>
      <input type="file" id="file" class="sr" ${cfg.multiple ? "multiple" : ""} accept="${cfg.accept || ".pdf,application/pdf"}">
      <ul class="filelist" id="filelist"></ul>
      <div id="extra"></div>
    </div>
    <div class="panel" id="p-opts"><div class="opts" id="opts"></div></div>
    <div class="panel">
      <div class="row">
        <button class="btn" id="go" disabled>${cfg.action || "Process"}</button>
        <button class="btn ghost sm" id="reset">Reset</button>
      </div>
      <div class="progress" id="progress"><i></i></div>
      <div class="out" id="out"></div>
    </div>
    <p class="privacy-note"><span>🔒</span><span><b>Nothing is uploaded.</b> This tool reads your file in this browser tab using WebAssembly and JavaScript. Open your browser's Network tab to verify no file data is sent.</span></p>
    ${cfg.help ? `<div class="panel"><h3>How it works</h3>${cfg.help}</div>` : ""}
    ${cfg.faq ? `<h2>FAQ</h2>${cfg.faq.map(([q, a]) => `<details class="faq"><summary>${q}</summary><div class="body">${a}</div></details>`).join("")}` : ""}
  `;
  if (isNew) document.body.insertBefore(main, footer);

  const $ = (s) => main.querySelector(s);
  const drop = $("#drop"), input = $("#file"), filelist = $("#filelist"),
    extra = $("#extra"), optsBox = $("#opts"), go = $("#go"), reset = $("#reset"),
    progress = $("#progress"), bar = progress.querySelector("i"), out = $("#out");

  let files = [];

  // build option fields
  const opts = {};
  for (const f of cfg.options || []) {
    const wrap = document.createElement("div");
    wrap.className = f.type === "checkbox" ? "check" : "field";
    let el;
    if (f.type === "select") {
      el = document.createElement("select");
      for (const o of f.options) {
        const op = document.createElement("option");
        op.value = o[0];
        op.textContent = o[1];
        if (o[0] === f.value) op.selected = true;
        el.appendChild(op);
      }
    } else if (f.type === "checkbox") {
      el = document.createElement("input");
      el.type = "checkbox";
      el.checked = !!f.value;
    } else {
      el = document.createElement("input");
      el.type = f.type || "text";
      if (f.value !== undefined) el.value = f.value;
      if (f.min !== undefined) el.min = f.min;
      if (f.max !== undefined) el.max = f.max;
      if (f.step !== undefined) el.step = f.step;
      if (f.placeholder) el.placeholder = f.placeholder;
    }
    el.id = "opt-" + f.name;
    el.dataset.name = f.name;
    el.dataset.kind = f.type || "text";
    if (f.type === "checkbox") {
      wrap.appendChild(el);
      const lb = document.createElement("label");
      lb.htmlFor = el.id;
      lb.textContent = f.label;
      wrap.appendChild(lb);
    } else {
      const lb = document.createElement("label");
      lb.htmlFor = el.id;
      lb.textContent = f.label;
      wrap.appendChild(lb);
      wrap.appendChild(el);
    }
    optsBox.appendChild(wrap);
    opts[f.name] = el;
  }
  if (!cfg.options || !cfg.options.length) $("#p-opts").style.display = "none";
  if (cfg.noFile) $("#p-drop").style.display = "none";

  function readOpts() {
    const o = {};
    for (const k in opts) {
      const el = opts[k];
      o[k] = el.dataset.kind === "checkbox" ? el.checked
        : el.dataset.kind === "number" || el.dataset.kind === "range" ? parseFloat(el.value)
        : el.value;
    }
    return o;
  }

  const ctx = {
    files,
    opts,
    get options() { return readOpts(); },
    extra,
    out,
    download,
    downloadZip(entries, name = "output.zip") { download(createZip(entries), name, "application/zip"); },
    toast,
    loadPdfLib, loadPdfJs, openDocument, parseRanges, thumbnails, fmtSize,
    fileToImage, canvasOf, canvasBlob, hexToRgb, anchorXY, ANCHORS,
    PHOTO_FILTERS, applyFilter, adjustCanvas, sharpenCanvas, rotCanvas, fitCanvas, flipCanvas,
    pixelMap, rgbToHex, canvasFrom, regionPicker, readExif,
    progress(p) { progress.classList.add("on"); bar.style.width = Math.max(0, Math.min(1, p)) * 100 + "%"; },
    progressDone() { bar.style.width = "100%"; setTimeout(() => { progress.classList.remove("on"); bar.style.width = "0"; }, 500); },
    setBusy(b, label) { go.disabled = b || (!cfg.noFile && !files.length); if (label) go.textContent = label; },
  };

  function renderFiles() {
    filelist.innerHTML = "";
    files.forEach((f, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="name">${f.name.replace(/[<>&]/g, "")}</span><span class="sz">${fmtSize(f.size)}</span>`;
      if (cfg.reorder && files.length > 1) {
        const up = document.createElement("button");
        up.className = "mv"; up.textContent = "↑"; up.title = "Move up";
        up.onclick = () => { if (i > 0) { [files[i - 1], files[i]] = [files[i], files[i - 1]]; renderFiles(); } };
        const dn = document.createElement("button");
        dn.className = "mv"; dn.textContent = "↓"; dn.title = "Move down";
        dn.onclick = () => { if (i < files.length - 1) { [files[i + 1], files[i]] = [files[i], files[i + 1]]; renderFiles(); } };
        li.append(up, dn);
      }
      const x = document.createElement("button");
      x.className = "x"; x.textContent = "✕"; x.title = "Remove";
      x.onclick = () => { files.splice(i, 1); ctx.files = files; renderFiles(); };
      li.appendChild(x);
      filelist.appendChild(li);
    });
    go.disabled = cfg.noFile ? false : !files.length;
    ctx.files = files;
    if (cfg.onFiles) Promise.resolve(cfg.onFiles(ctx)).catch((e) => toast(e.message || String(e), true));
  }

  async function accept(list) {
    const picked = [...list];
    if (!cfg.multiple) files = picked.slice(0, 1);
    else files = files.concat(picked);
    renderFiles();
  }

  drop.addEventListener("click", () => input.click());
  drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") input.click(); });
  input.addEventListener("change", () => { accept(input.files); input.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => { if (e.dataTransfer?.files?.length) accept(e.dataTransfer.files); });

  reset.addEventListener("click", () => {
    files = []; ctx.files = files; renderFiles(); out.innerHTML = ""; extra.innerHTML = "";
    if (cfg.onReset) cfg.onReset(ctx);
  });

  go.addEventListener("click", async () => {
    if (!cfg.noFile && !files.length) return;
    out.innerHTML = "";
    progress.classList.add("on");
    bar.style.width = "2%";
    ctx.setBusy(true, "Working…");
    try {
      await cfg.run(ctx);
      ctx.progressDone();
    } catch (e) {
      console.error(e);
      toast(e?.message ? e.message : "Something went wrong", true);
      ctx.progressDone();
    } finally {
      ctx.setBusy(false, cfg.action || "Process");
    }
  });

  if (cfg.onInit) cfg.onInit(ctx);
  return ctx;
}

/* inject site header/footer on content pages (landing, tools, guide, legal) */
export function siteChrome() { return chrome(); }

/* expose the image/positioning helpers on ctx as well */
