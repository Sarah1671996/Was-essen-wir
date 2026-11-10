// Notbremse: Startet die App nicht (z. B. halb alte, halb neue Dateien nach einem Update),
// kommt statt eines leeren Bildschirms eine Meldung mit "Neu laden". Bewusst einfaches altes JavaScript,
// damit es auch läuft, wenn app.js gar nicht geladen werden kann. app.js setzt window.__ekShown, sobald etwas zu sehen ist.
(function () {
  function fail(msg) {
    if (window.__ekShown) return;
    var box = document.getElementById("bootFail");
    if (!box) return;
    document.getElementById("bootFailMsg").textContent = msg ? "Fehler: " + msg : "";
    box.hidden = false;
  }
  window.addEventListener("error", function (e) {
    fail(e.message || (e.target && e.target.src ? "Datei fehlt: " + e.target.src : ""));
  }, true);
  window.addEventListener("unhandledrejection", function (e) { fail(e.reason && (e.reason.message || String(e.reason))); });
  setTimeout(function () { fail("Start dauert zu lange"); }, 20000);
  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("bootReload").onclick = function () {
      // Zwischenspeicher leeren, damit garantiert alle Dateien frisch kommen
      var jobs = [];
      if (navigator.serviceWorker) jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) {
        return Promise.all(rs.map(function (r) { return r.unregister(); }));
      }));
      if (window.caches) jobs.push(caches.keys().then(function (ks) {
        return Promise.all(ks.map(function (k) { return caches.delete(k); }));
      }));
      Promise.all(jobs).catch(function () {}).then(function () { location.reload(); });
    };
  });
})();
