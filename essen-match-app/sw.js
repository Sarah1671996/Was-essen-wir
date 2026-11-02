// Hält die App-Dateien offline bereit. Erst Netz, bei Funkloch der Zwischenspeicher.
// Bei Änderungen an der App die Versionsnummer hochzählen.
const CACHE = "essen-v15";
const FILES = [
  "./", "index.html", "style.css", "app.js", "store.js", "firebase-config.js", "starter-dishes.js",
  "cleaning-logic.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/apple-touch-icon.png"
];

// Push-Benachrichtigungen vom Server (Firebase Cloud Messaging, Datennachricht mit title/body/link/tag)
self.addEventListener("push", e => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch { p = { data: { body: e.data && e.data.text() } }; }
  const d = { ...(p.notification || {}), ...(p.data || {}) };
  e.waitUntil(self.registration.showNotification(d.title || "Planer", {
    body: d.body || "",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    data: { link: d.link || "./" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const link = new URL(e.notification.data?.link || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.registration.scope));
    if (open) { open.navigate(link).catch(() => {}); return open.focus(); }
    return self.clients.openWindow(link);
  }));
});

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
