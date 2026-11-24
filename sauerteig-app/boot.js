// Notbremse wie in der Einkaufs-App: Startet die App nicht, kommt statt eines leeren Bildschirms
// eine Meldung mit "Neu laden". app.js setzt window.__stShown, sobald etwas zu sehen ist.
(function () {
  function fail(msg) {
    if (window.__stShown) return;
    var box = document.getElementById("bootFail");
    if (!box) return;
    document.getElementById("bootFailMsg").textContent = msg ? "Fehler: " + msg : "";
    box.hidden = false;
  }
  window.addEventListener("error", function (e) {
    fail(e.message || (e.target && e.target.src ? "Datei fehlt: " + e.target.src : ""));
  }, true);
  setTimeout(function () { fail("Start dauert zu lange"); }, 20000);
  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("bootReload").onclick = function () {
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
