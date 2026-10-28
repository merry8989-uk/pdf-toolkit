/* PDF Toolkit service worker — makes the app installable and usable offline.
   The shell is precached; every other same-origin file is cached as it is used,
   so the PDF/photo engines keep working after the first visit. */
const CACHE = "pdf-toolkit-v10";
const SHELL = [
  "./",
  "./index.html",
  "./tools.html",
  "./guide.html",
  "./style.css",
  "./app.js",
  "./registry.js",
  "./zip.js",
  "./logger.js",
  "./settings.html",
  "./settings.js",
  "./logo.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function put(req, res) {
  if (res && res.status === 200 && res.type === "basic") {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  // Page navigations and code: network-first, so a new deploy is picked up
  // immediately and the cache is only a fallback when offline.
  const isDoc = req.mode === "navigate" || /\.(html|js|css|webmanifest)$/.test(url.pathname);
  if (isDoc) {
    event.respondWith(
      fetch(req).then((res) => put(req, res)).catch(() =>
        caches.match(req).then((hit) => hit || caches.match("./index.html"))
      )
    );
    return;
  }

  // Engines, fonts and language data: cache-first (they never change).
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res)))
  );
});
