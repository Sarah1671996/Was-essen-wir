// Hält die App-Dateien offline bereit. Erst Netz, bei Funkloch der Zwischenspeicher.
// Bei Änderungen an der App die Versionsnummer hochzählen.
const CACHE = "essen-v8";
const FILES = [
  "./", "index.html", "style.css", "app.js", "store.js", "firebase-config.js", "starter-dishes.js",
  "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // "no-cache": immer beim Server nachfragen, ob es eine neuere Fassung gibt
  // (GitHub Pages erlaubt Browsern sonst, Dateien 10 Minuten alt zu verwenden)
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
