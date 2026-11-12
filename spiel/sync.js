// Sonnenhof – Spielstand zwischen Handy und PC abgleichen (über einen Sync-Code in Firebase).
// Gleiches Firebase-Projekt wie die anderen Apps (../essen-match-app/firebase-config.js). Der Spielstand liegt
// in der Sammlung „reisen“ (gleiche Form wie Kanada- und Film-App: j = Text, st = Zeitstempel), damit keine
// neue Firestore-Regel nötig ist. Das Präfix „sonnenhof-“ hält ihn getrennt. Der neuere Stand gewinnt.
export function syncStarten(api) {
  const FB = "https://www.gstatic.com/firebasejs/12.19.0/";
  const LS_CODE = "sonnenhof-code", ABC = "abcdefghjkmnpqrstuvwxyz23456789";
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  const sauber = c => String(c || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const zeigen = c => c.replace(/(.{4})(?=.)/g, "$1-");
  const neuerCode = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => ABC[b % ABC.length]).join("");

  let fb = null, ref = null, abo = null, timer = null, schreibt = false, offen = false;
  let status = "aus", eingabe = "", letzteZeit = 0;

  async function fbStart() {
    if (fb) return fb;
    const [appMod, authMod, fs, cfg] = await Promise.all([
      import(FB + "firebase-app.js"), import(FB + "firebase-auth.js"), import(FB + "firebase-firestore.js"),
      import(new URL("../essen-match-app/firebase-config.js", location.href).href),
    ]);
    const app = appMod.initializeApp(cfg.firebaseConfig, "sonnenhof");
    const auth = authMod.getAuth(app);
    await new Promise((ok, fehler) => {
      const stop = authMod.onAuthStateChanged(auth, u => { if (u) { stop(); ok(); } });
      authMod.signInAnonymously(auth).catch(fehler);
    });
    fb = { fs, db: fs.getFirestore(app) };
    return fb;
  }
  const packen = s => ({ j: JSON.stringify(s), st: s.geaendert || Date.now() });

  async function hochladen() {
    if (!ref || schreibt || !offen) return;
    schreibt = true; offen = false;
    try { await ref.set(packen(api.getS())); status = "an"; letzteZeit = Date.now(); }
    catch (e) { console.error(e); status = "fehler"; }
    schreibt = false;
    if (offen) hochladen();
  }
  function aenderung() { if (!ref) return; offen = true; clearTimeout(timer); timer = setTimeout(hochladen, 1500); }
  function sofort() { if (ref && offen) { clearTimeout(timer); hochladen(); } }

  // modus: "neu" = diesen Hof hochladen, "beitreten" = Hof vom anderen Gerät übernehmen, "start" = der neuere gewinnt
  async function verbinden(code, modus) {
    status = "verbindet";
    const { fs, db } = await fbStart();
    const doc = fs.doc(db, "reisen", "sonnenhof-" + code);
    let fern = null;
    if (modus === "neu") await fs.setDoc(doc, packen(api.getS()));
    else {
      const snap = await fs.getDoc(doc);
      if (!snap.exists()) { if (modus === "beitreten") throw new Error("nicht gefunden"); }
      else fern = snap.data();
    }
    ls.set(LS_CODE, code);
    if (abo) abo();
    ref = { code, set: d => fs.setDoc(doc, d) };
    if (fern) {
      if (modus === "beitreten" || (fern.st || 0) > (api.getS().geaendert || 0)) api.setS(JSON.parse(fern.j));
      else { offen = true; hochladen(); }
    }
    abo = fs.onSnapshot(doc, s => {
      if (!s.exists() || s.metadata.hasPendingWrites) return;
      const d = s.data();
      if ((d.st || 0) > (api.getS().geaendert || 0)) { api.setS(JSON.parse(d.j)); api.meldung("Spielstand vom anderen Gerät geladen"); }
    }, () => { status = "fehler"; });
    status = "an"; letzteZeit = Date.now();
  }
  function trennen() { if (abo) abo(); abo = null; ref = null; ls.del(LS_CODE); status = "aus"; }

  /* ---------- Fenster ---------- */
  function panel() {
    api.oeffnen("einstellungen", () => {
      const code = ref?.code;
      const zeile = status === "an" ? `Verbunden · zuletzt abgeglichen ${new Date(letzteZeit).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
        : status === "verbindet" ? "Verbinde …" : status === "fehler" ? "Gerade keine Verbindung. Dein Spiel wird trotzdem auf diesem Gerät gespeichert." : "";
      return `<div class="kopf"><h2>Einstellungen</h2>${api.zu()}</div>
        <h3>Auf Handy und PC spielen</h3>
        ${code ? `
          <p>Dieses Gerät ist verbunden. Gib den Code auf deinem anderen Gerät ein, dann spielt ihr denselben Hof.</p>
          <div class="synccode"><b>${zeigen(code)}</b><button class="los zweit klein" data-aktion="s-kopieren">Kopieren</button></div>
          <p class="hinweis">${zeile}</p>
          <button class="los zweit" data-aktion="s-trennen">Auf diesem Gerät trennen</button>`
        : `
          <p>Verbinde deine Geräte mit einem Sync-Code. Dann ist dein Hof auf Handy und PC immer gleich.</p>
          <button class="los" data-aktion="s-neu">Sync-Code für diesen Hof erstellen</button>
          <p class="hinweis" style="margin-top:14px">Schon einen Code vom anderen Gerät?</p>
          <div class="syncfeld"><input id="sync-eingabe" placeholder="z. B. abcd-efgh-jkmn" autocomplete="off" autocapitalize="off" spellcheck="false" value="${eingabe}">
          <button class="los" data-aktion="s-beitreten">Verbinden</button></div>
          <p class="hinweis">Beim Verbinden wird der Hof auf diesem Gerät durch den Hof vom anderen Gerät ersetzt.</p>
          ${status === "fehler" ? `<p class="fehlt">Das hat nicht geklappt. Prüfe den Code und die Internetverbindung.</p>` : ""}`}
        ${api.zusatz ? "<hr>" + api.zusatz() : ""}
        <hr>
        <button class="los rot" data-aktion="s-neustart">Spiel neu beginnen …</button>`;
    });
  }
  const host = document.querySelector("#fenster");
  host.addEventListener("input", e => { if (e.target.id === "sync-eingabe") eingabe = e.target.value; });
  host.addEventListener("click", async e => {
    const b = e.target.closest("[data-aktion^='s-']"); if (!b || b.disabled) return;
    const a = b.dataset.aktion;
    if (a === "s-neustart") { api.neustartFragen(); return; }
    if (a === "s-kopieren") {
      const t = zeigen(ref.code);
      try { await navigator.clipboard.writeText(t); api.meldung("Code kopiert"); } catch { api.meldung("Code: " + t); }
      return;
    }
    if (a === "s-trennen") { trennen(); api.meldung("Sync auf diesem Gerät ausgeschaltet"); return; }
    try {
      if (a === "s-neu") { await verbinden(neuerCode(), "neu"); api.meldung("Sync ist an. Gib den Code auf dem anderen Gerät ein."); }
      if (a === "s-beitreten") {
        const c = sauber(eingabe);
        if (c.length < 12) { api.meldung("Der Code hat 12 Zeichen."); return; }
        await verbinden(c, "beitreten"); eingabe = ""; api.meldung("Verbunden! Dein Hof vom anderen Gerät ist da.");
      }
    } catch (err) { console.error(err); status = "fehler"; ref = null; ls.del(LS_CODE); api.meldung("Verbinden hat nicht geklappt."); }
  });

  addEventListener("pagehide", sofort);
  addEventListener("visibilitychange", () => { if (document.hidden) sofort(); });
  // Nach einem Funkloch erneut verbinden
  const nochmal = () => { const c = ls.get(LS_CODE); if (c && status === "fehler") verbinden(c, "start").catch(() => { status = "fehler"; }); };
  addEventListener("online", nochmal);
  addEventListener("visibilitychange", () => { if (!document.hidden) nochmal(); });
  const gespeichert = ls.get(LS_CODE);
  if (gespeichert) verbinden(gespeichert, "start").catch(e => { console.error(e); status = "fehler"; ref = { code: gespeichert, set: async () => { throw e; } }; });

  return { aenderung, sofort, panel };
}
