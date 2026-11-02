// Erzeugt von build.mjs aus quelle/app.html – dort ändern, nicht hier.
"use strict";
const Q = DATA.questions;               // a[0] ist jeweils die richtige Antwort
const IMG = DATA.images;                // id -> data:URI
const LIGHT = new Set(DATA.lightImages);// Bilder mit hellem Hintergrund
const byN = new Map(Q.map(q => [q.n, q]));
const BASIS = Q.filter(q => q.section === "Basisfragen").map(q => q.n);
const SEE = Q.filter(q => q.section !== "Basisfragen").map(q => q.n);
const IN_ARTIFACT = !!(window.claude && window.claude.use);

/* ---------- Hilfsfunktionen ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const fmtDate = t => new Date(t).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
function shuffle(arr, rnd = Math.random) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function seeded(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2600); }
const imgTag = (q, cls = "qimg") => q.img.map(id => `<img class="${cls}${LIGHT.has(id) ? " light" : ""}" src="${IMG[id]}" alt="Abbildung zu Frage ${q.n}">`).join("");

/* ---------- Lernstand (lokal + optional synchronisiert) ---------- */
const LS_KEY = "sbfsee-progress-v1";
let P = blank();
function blank() { return { c: {}, daily: null, exams: [], dailySize: 10, days: {}, nav: {}, notes: {}, termin: null }; }
try { const raw = localStorage.getItem(LS_KEY); if (raw) P = Object.assign(blank(), JSON.parse(raw)); } catch (e) {}
function merge(a, b) {
  const out = Object.assign(blank(), a);
  out.c = Object.assign({}, a.c);
  for (const [k, v] of Object.entries(b.c || {})) if (!out.c[k] || (v.t || 0) > (out.c[k].t || 0)) out.c[k] = v;
  if (b.daily && (!out.daily || (b.daily.t || 0) > (out.daily.t || 0))) out.daily = b.daily;
  const seen = new Set(out.exams.map(e => e.t));
  out.exams = out.exams.concat((b.exams || []).filter(e => !seen.has(e.t))).sort((x, y) => x.t - y.t).slice(-30);
  if (b.dailySize && (b.st || 0) > (a.st || 0)) out.dailySize = b.dailySize;
  out.days = Object.assign({}, a.days);
  for (const [k, v] of Object.entries(b.days || {})) out.days[k] = Math.max(out.days[k] || 0, v);
  if (b.termin && (!out.termin || (b.termin.t || 0) > (out.termin.t || 0))) out.termin = b.termin;
  for (const f of ["nav", "notes"]) {
    out[f] = Object.assign({}, a[f]);
    for (const [k, v] of Object.entries(b[f] || {})) if (!out[f][k] || (v.t || 0) > (out[f][k].t || 0)) out[f][k] = v;
  }
  out.st = Math.max(a.st || 0, b.st || 0);
  return out;
}
/* Abgleich: im Claude-Artifact über die Claude-Datenbank, in der installierbaren App über Firebase mit Lerncode */
let remote = null, writing = false, dirty = false, saveTimer = null;
function save() {
  P.st = Date.now();
  try { localStorage.setItem(LS_KEY, JSON.stringify(P)); } catch (e) {}
  if (remote) { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(flush, 1500); }
}
async function flush() {
  if (!remote || writing || !dirty) return;
  writing = true; dirty = false;
  try { await remote.set(JSON.parse(JSON.stringify(P))); setSync("sync"); }
  catch (e) { setSync("local"); if (e && e.code === "invalid_argument") remote = null; }
  writing = false;
  if (dirty) flush();
}
function setSync(mode) {
  $("#sync").textContent = mode === "sync" ? "☁ verbunden" : "Lernstand auf diesem Gerät";
}
setSync("local");
// Daten von einem anderen Gerät einmischen; hat dieses Gerät Neueres, zurückschreiben
function receive(d) {
  if (!d) return;
  const before = JSON.stringify(P);
  P = merge(P, d);
  try { localStorage.setItem(LS_KEY, JSON.stringify(P)); } catch (e) {}
  if (JSON.stringify(P) !== before && !busy()) render();
  if ((P.st || 0) > (d.st || 0) || Object.keys(P.c).length > Object.keys(d.c || {}).length) { dirty = true; flush(); }
}
async function initSync() {
  if (IN_ARTIFACT) {
    try {
      const [user, db] = await Promise.all([claude.use("user"), claude.use("db")]);
      if (!user || !db) return;
      const id = await user.id();
      if (!id) return;
      const ref = db.doc("data/users/" + id + "/sbfsee");
      const snap = await ref.get();
      remote = { set: d => ref.set(d) }; setSync("sync");
      if (snap.exists) receive(snap.data()); else { dirty = true; flush(); }
      render();
      ref.onSnapshot(s => { if (s.exists && !s.metadata.hasPendingWrites) receive(s.data()); }, () => {});
    } catch (e) {}
    return;
  }
  if (!CAN_FB) return;
  const fromLink = new URLSearchParams(location.search).get("code");
  if (fromLink) { try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {} }
  const code = cleanCode(fromLink || lernCode());
  if (code) connectCode(code, false).catch(e => { if (fromLink) toast(e.message === "notfound" ? "Diesen Lerncode gibt es nicht." : "Verbinden hat nicht geklappt. Bist du online?"); });
}

const FB = "https://www.gstatic.com/firebasejs/12.19.0/";
const CAN_FB = !IN_ARTIFACT && /^https?:$/.test(location.protocol) && !new URLSearchParams(location.search).has("demo");
const CODE_ABC = "abcdefghjkmnpqrstuvwxyz23456789";
let fb = null, fbUnsub = null;
const lernCode = () => { try { return localStorage.getItem("sbfsee-code") || ""; } catch (e) { return ""; } };
const cleanCode = c => String(c || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const showCode = c => c.replace(/(.{4})(?=.)/g, "$1-");
function newCode() { return Array.from(crypto.getRandomValues(new Uint8Array(10)), b => CODE_ABC[b % CODE_ABC.length]).join(""); }
async function fbInit() {
  if (fb) return fb;
  const [appMod, authMod, fs, cfg] = await Promise.all([
    import(FB + "firebase-app.js"), import(FB + "firebase-auth.js"), import(FB + "firebase-firestore.js"),
    import(new URL("../essen-match-app/firebase-config.js", location.href).href)
  ]);
  // Eigener App-Name, damit sich der Offline-Speicher nicht mit den anderen Apps mischt
  const app = appMod.initializeApp(cfg.firebaseConfig, "sbfsee");
  const auth = authMod.getAuth(app);
  await new Promise((resolve, reject) => {
    const stop = authMod.onAuthStateChanged(auth, u => { if (u) { stop(); resolve(); } });
    authMod.signInAnonymously(auth).catch(reject);
  });
  let db;
  try { db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() }); } catch (e) { db = fs.getFirestore(app); }
  fb = { fs, db };
  return fb;
}
// Mit einem Lerncode verbinden; isNew legt ihn mit dem Lernstand dieses Geräts an
async function connectCode(code, isNew) {
  const { fs, db } = await fbInit();
  const ref = fs.doc(db, "lernstand", code);
  if (isNew) await fs.setDoc(ref, JSON.parse(JSON.stringify(P)));
  else {
    const snap = await fs.getDoc(ref);
    if (!snap.exists()) throw new Error("notfound");
    receive(snap.data());
  }
  try { localStorage.setItem("sbfsee-code", code); } catch (e) {}
  if (fbUnsub) fbUnsub();
  remote = { set: d => fs.setDoc(ref, d), code };
  fbUnsub = fs.onSnapshot(ref, s => { if (s.exists() && !s.metadata.hasPendingWrites) receive(s.data()); }, () => setSync("local"));
  setSync("sync");
  if (view === "start") render();
}
function disconnect() {
  if (fbUnsub) fbUnsub(); fbUnsub = null; remote = null;
  try { localStorage.removeItem("sbfsee-code"); } catch (e) {}
  setSync("local"); render();
}

/* Markierung je Frage: s = schlecht, m = mittel, g = sicher, "" = noch nicht markiert */
const MARKS = { s: "schlecht", m: "mittel", g: "sicher" };
function stat(n) { return P.c[n] || { r: 0, w: 0, t: 0 }; }
function mark(n) { const s = stat(n); if (s.m !== undefined) return s.m; return s.b === 1 ? "s" : s.b >= 4 ? "g" : s.b ? "m" : ""; }
function setMark(n, m) { const s = Object.assign({}, stat(n)); s.m = m; delete s.b; s.t = Date.now(); P.c[n] = s; logDay(); save(); }
// Ankreuzen setzt die Markierung automatisch: falsch -> schlecht, richtig -> eine Stufe besser
function record(n, ok) {
  const s = Object.assign({}, stat(n)), cur = mark(n);
  if (ok) s.r++; else s.w++;
  s.m = ok ? (cur === "s" ? "m" : cur === "m" || cur === "g" ? "g" : "m") : "s";
  delete s.b; s.t = Date.now(); P.c[n] = s; logDay(); save();
  return s.m;
}
// Lernkalender: wie viele Fragen pro Tag bearbeitet wurden (die letzten 120 Tage)
function logDay() {
  const d = Object.assign({}, P.days); d[today()] = (d[today()] || 0) + 1;
  const keys = Object.keys(d).sort(); for (const k of keys.slice(0, Math.max(0, keys.length - 120))) delete d[k];
  P.days = d;
}
// Sichere Fragen kommen nach einer Woche zum Auffrischen wieder
const REFRESH_DAYS = 7;
const isDue = n => mark(n) === "g" && Date.now() - (stat(n).t || 0) > REFRESH_DAYS * 86400000;
const duePool = () => Q.map(q => q.n).filter(isDue).sort((a, b) => stat(a).t - stat(b).t);
const markPill = n => { const k = mark(n); return `<span class="pill mk-${k || "n"}">${k ? MARKS[k] : "nicht markiert"}</span>`; };
const markBar = n => { const k = mark(n); return `<span class="markbar" role="group" aria-label="Markierung für Frage ${n}">${["s", "m", "g"].map(x => `<button class="mk mk-${x}" data-mark="${x}" data-n="${n}" aria-pressed="${k === x}">${MARKS[x]}</button>`).join("")}</span>`; };
// Klick auf eine Markierung: setzen bzw. bei erneutem Klick wieder entfernen
document.addEventListener("click", e => {
  const b = e.target.closest("[data-mark]"); if (!b) return;
  e.stopPropagation();
  const n = +b.dataset.n, k = mark(n) === b.dataset.mark && !b.dataset.keep ? "" : b.dataset.mark;
  setMark(n, k);
  document.querySelectorAll(`[data-mark][data-n="${n}"]`).forEach(x => x.setAttribute("aria-pressed", x.dataset.mark === k));
}, true);
// Reihenfolge zum Lernen: schlecht zuerst, dann unmarkierte, dann mittel, dann sicher
function priority(n, rnd) { return { s: 0, "": 1, m: 2, g: 3 }[mark(n)] + rnd() * 0.9; }
function pickLearn(pool, count, rnd = Math.random) { return pool.map(n => [n, priority(n, rnd)]).sort((a, b) => a[1] - b[1]).slice(0, count).map(x => x[0]); }

/* Fragen-Nummern wie "1-10, 22, 30 32" lesen */
function parseNums(str) {
  const out = []; let bad = false;
  for (const t of String(str).split(/[,;\s]+/).filter(Boolean)) {
    const r = t.match(/^(\d+)(?:-|–|bis)(\d+)$/), s = t.match(/^\d+$/);
    if (r) { let a = +r[1], b = +r[2]; if (a > b) [a, b] = [b, a]; for (let i = a; i <= b; i++) out.push(i); }
    else if (s) out.push(+t); else bad = true;
  }
  const ok = [...new Set(out)].filter(n => byN.has(n));
  return { ids: ok, bad: bad || ok.length < new Set(out).size };
}
/* Gemeinsame Fragen-Auswahl für Karteikarten, Drucken und Katalog */
/* Auswahl nach Markierung, frei kombinierbar: g = sicher, m = mittel, s = schlecht, n = noch nicht bewertet.
   Gilt gemeinsam für Karteikarten, Drucken, Katalog und Tagesfragen. */
const MKSEL = [["g", "sicher"], ["m", "mittel"], ["s", "schlecht"], ["n", "unbewertet"]];
let markSel = "sm";
try { markSel = localStorage.getItem("sbfsee-marksel") ?? "sm"; } catch (e) {}
const markPool = () => Q.map(q => q.n).filter(n => markSel.includes(mark(n) || "n"));
function markChips() {
  const c = counts(Q.map(q => q.n));
  return `<div class="markbar" role="group" aria-label="Markierungen auswählen">${MKSEL.map(([k, l]) =>
    `<button class="mk mk-${k === "n" ? "o" : k}" data-msel="${k}" aria-pressed="${markSel.includes(k)}">${l} · ${c[k === "n" ? "" : k]}</button>`).join("")}</div>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-msel]"); if (!b) return;
  const k = b.dataset.msel;
  markSel = markSel.includes(k) ? markSel.replace(k, "") : markSel + k;
  try { localStorage.setItem("sbfsee-marksel", markSel); } catch (err) {}
  if (view === "drucken") buildPrintItems();
  render();
});
const POOLS = [["alle", "Alle 285 Fragen"], ["marks", "Nach Markierung (sicher, mittel, schlecht, unbewertet)"],
  ["faellig", "Sichere Fragen zum Auffrischen (seit 7 Tagen nicht geübt)"], ["nummern", "Bestimmte Nummern (z. B. 1-10, 22, 30)"], ["basis", "Basisfragen (72)"], ["see", "Spezifische See-Fragen (213)"], ["bild", "Fragen mit Bild (Lichter, Zeichen, Signale)"]];
function poolFor(key, nums) {
  if (key === "nummern") return parseNums(nums).ids;
  if (key === "basis") return BASIS.slice();
  if (key === "see") return SEE.slice();
  if (key === "bild") return Q.filter(q => q.img.length).map(q => q.n);
  if (key === "marks") return markPool();
  if (key === "faellig") return duePool();
  return Q.map(q => q.n);
}
const poolOptions = sel => POOLS.map(([k, l]) => `<option value="${k}" ${sel === k ? "selected" : ""}>${l}</option>`).join("");
function numsHint(str) { const p = parseNums(str); return p.ids.length ? `${p.ids.length} Fragen${p.bad ? " · einige Angaben ignoriert (gültig sind 1 bis 285)" : ""}` : "Gib Nummern ein, z. B. 1-10, 22, 30, 32"; }

/* ---------- Navigation ---------- */
const ICONS = {
  start: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  tag: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8 14l2.5 2.5L16 12"/>',
  karten: '<rect x="6" y="3" width="15" height="12" rx="2"/><path d="M3 8v11a2 2 0 0 0 2 2h12"/>',
  pruefung: '<path d="M7 3h10l4 4v14H3V3z"/><path d="M7 11h2M7 15h2M12 11h5M12 15h5"/>',
  drucken: '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7"/>',
  katalog: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>',
  nav: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  praxis: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4v6M12 14v6M4 12h6M14 12h6"/>'
};
const VIEWS = [["start", "Übersicht", "Start"], ["tag", "Tagesfragen", "Heute"], ["karten", "Karteikarten", "Karten"], ["pruefung", "Prüfung", "Prüfung"], ["nav", "Navigation", "Navi"], ["praxis", "Praxis", "Praxis"], ["drucken", "Drucken", "Druck"], ["katalog", "Katalog", "Katalog"]];
let view = (location.hash || "").slice(1);
if (!VIEWS.some(v => v[0] === view)) view = "start";
function go(v) { view = v; try { history.replaceState(null, "", "#" + v); } catch (e) {} render(); window.scrollTo(0, 0); }
function renderTabs() {
  $("#tabs").innerHTML = VIEWS.map(([k, l, sh]) => `<button data-go="${k}" aria-label="${l}" ${view === k ? 'aria-current="page"' : ""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg><span class="tl">${l}</span><span class="ts">${sh}</span></button>`).join("");
}
document.addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (!b) return; go(b.dataset.go); });
window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (h !== view && VIEWS.some(v => v[0] === h)) { view = h; render(); } });

/* Laufende Sitzungen nicht durch Sync-Updates zerstören */
let flash = null, exam = null, quiz = null;
const busy = () => (view === "praxis" && sim && !sim.done) || (view === "karten" && ((flash && !flash.done) || pics)) || (view === "pruefung" && exam && !exam.done) || (view === "tag" && quiz);

function render() {
  renderTabs();
  const m = $("#main");
  ({ start: vStart, tag: vTag, karten: vKarten, pruefung: vPruefung, nav: vNav, praxis: vPraxis, drucken: vDrucken, katalog: vKatalog })[view](m);
}

/* ---------- Übersicht ---------- */
function counts(pool) { const c = { g: 0, m: 0, s: 0, "": 0 }; for (const n of pool) c[mark(n)]++; return c; }
const MKCOL = { g: "var(--sb)", m: "var(--mid)", s: "var(--bb)", "": "var(--line)" };
function meter(pool) {
  const c = counts(pool), tot = pool.length;
  return `<div class="meter">${["g", "m", "s", ""].map(k => c[k] ? `<i style="width:${c[k] / tot * 100}%;background:${MKCOL[k]}"></i>` : "").join("")}</div>`;
}
function vStart(m) {
  const all = counts(Q.map(q => q.n));
  const pct = Math.round(all.g / Q.length * 100);
  const st = stack(), d = st && st.ids.length ? st : null;
  const dDone = d ? d.ids.filter(n => d.res && d.res[n] === true).length : 0;
  const ex = P.exams.slice(-5).reverse();
  m.innerHTML = `<div class="view">
    <section class="hero">
      <div><div class="eyebrow">Sportbootführerschein See · 285 amtliche Fragen</div>
      <h2 style="font-size:2.2rem;margin-top:4px">Leinen los zum Lernen</h2>
      <p class="muted">Lerne mit Karteikarten, übe ganze Prüfungsbögen oder lass dir Tagesfragen und A4-Bögen zum Ausdrucken zusammenstellen. Die richtige Antwort steht jedes Mal an einer anderen Stelle.</p></div>
      <div style="text-align:right"><div class="big mono">${pct}<span style="font-size:1.4rem">%</span></div><div class="muted" style="font-size:.85rem">sicher beherrscht</div></div>
    </section>
    ${terminPanel(all)}
    <div class="grid2">
      <section class="panel" style="display:grid;gap:12px">
        <div class="eyebrow">Heute</div>
        ${d ? `<h3>Lernstapel: ${d.ids.length} ${d.ids.length === 1 ? "Frage" : "Fragen"}, heute ${dDone} richtig</h3>
          <div class="progress"><i style="width:${dDone / d.ids.length * 100}%"></i></div>`
          : `<h3>Dein Lernstapel ist leer</h3><p class="muted" style="margin:0">Leg Fragen hinein, die du lernen willst: per Suche, nach Nummern, nach Markierung oder automatisch.</p>`}
        <div class="row"><button class="btn primary" data-go="tag">${d ? "Lernstapel öffnen" : "Fragen hinzufügen"}</button>
        <button class="btn" data-go="karten">Karteikarten</button></div>
      </section>
      <section class="panel">
        <div class="eyebrow">Deine Markierungen</div>
        <div class="boxes">${[["g", "sicher"], ["m", "mittel"], ["s", "schlecht"], ["", "offen"]].map(([k, l]) => `<button class="boxlink" data-learn="mk-${k}" ${all[k] ? "" : "disabled"}><b style="color:${k ? MKCOL[k] : "var(--muted)"}">${all[k]}</b><span>${l}</span></button>`).join("")}</div>
        <p class="muted" style="margin:8px 0 0;font-size:.82rem">Antippen, um genau diese Fragen als Karteikarten zu lernen.</p>
        <div style="margin-top:16px;display:grid;gap:10px">
          <div><div class="row" style="justify-content:space-between;font-size:.88rem;font-weight:700"><span>Basisfragen</span><span class="mono muted">${BASIS.length}</span></div>${meter(BASIS)}</div>
          <div><div class="row" style="justify-content:space-between;font-size:.88rem;font-weight:700"><span>Spezifische See-Fragen</span><span class="mono muted">${SEE.length}</span></div>${meter(SEE)}</div>
        </div>
        <div class="legend"><span><i style="background:var(--sb)"></i>sicher</span><span><i style="background:var(--mid)"></i>mittel</span><span><i style="background:var(--bb)"></i>schlecht</span><span><i style="background:var(--line)"></i>noch nicht markiert</span></div>
      </section>
    </div>
    <div class="grid2">${readinessPanel(all)}${calendarPanel()}</div>
    ${hardestPanel()}
    ${CAN_FB ? devicePanel() : ""}
    <section class="panel">
      <div class="row" style="justify-content:space-between"><div><div class="eyebrow">Prüfungssimulation</div><h3 style="margin-top:2px">30 Fragen: 7 Basis + 23 See</h3></div>
      <button class="btn primary" data-go="pruefung">Prüfungsbogen starten</button></div>
      ${ex.length ? `<ul class="examlist">${ex.map(e => `<li><span>${fmtDate(e.t)}</span><span class="mono">${e.score} / 30</span><span class="pill ${e.pass ? "ok" : "no"}">${e.pass ? "bestanden" : "nicht bestanden"}</span></li>`).join("")}</ul>` : `<p class="muted" style="margin:8px 0 0">Noch keine Prüfung geschrieben.</p>`}
    </section>
    <section class="panel" style="display:grid;gap:10px">
      <div class="eyebrow">Lernstand sichern</div>
      <p style="margin:0;max-width:62ch">Speichere deinen Lernstand als Datei, falls mal etwas mit dem Lerncode schiefgeht. Beim Laden wird die Datei mit deinem jetzigen Stand zusammengeführt, es geht nichts verloren.</p>
      <div class="row"><button class="btn" id="bexport">Sicherung speichern</button><button class="btn" id="bimport">Sicherung laden</button><input type="file" id="bfile" accept=".json,application/json" hidden></div>
    </section>
  </div>`;
  m.querySelectorAll("[data-learn]").forEach(b => b.onclick = () => { markSel = b.dataset.learn.slice(3) || "n"; try { localStorage.setItem("sbfsee-marksel", markSel); } catch (e) {} flashCfg.pool = "marks"; flash = null; go("karten"); });
  if (CAN_FB) wireDevicePanel();
  wireHardest(m);
  wireTermin(m);
  m.querySelectorAll("[data-due]").forEach(b => b.onclick = () => { flashCfg.pool = "faellig"; flash = null; go("karten"); });
  $("#bexport").onclick = exportBackup;
  $("#bimport").onclick = () => $("#bfile").click();
  $("#bfile").onchange = e => { const f = e.target.files[0]; if (f) importBackup(f); e.target.value = ""; };
}

/* Prüfungstermin: Tage bis zur Prüfung und wie viele Fragen pro Tag sicher werden müssen.
   Die letzten 2 Tage bleiben zum Wiederholen frei. */
let terminEdit = false;
function terminInfo(all) {
  const d = P.termin && P.termin.d; if (!d) return null;
  const days = Math.round((new Date(d + "T00:00:00") - new Date(today() + "T00:00:00")) / 86400000);
  const offen = Q.length - all.g, lernTage = Math.max(1, days - 2);
  const navOffen = NAV.filter(t => Object.values(navRes(t.nr)).filter(Boolean).length < 7).length;
  return { d, days, offen, perDay: days > 0 ? Math.ceil(offen / lernTage) : offen, lernTage, navOffen };
}
function terminPanel(all) {
  const t = terminInfo(all);
  if (!t || terminEdit) return `<section class="panel termin" style="display:grid;gap:10px">
      <div class="eyebrow">Prüfungstermin</div>
      <p style="margin:0">Trag dein (ungefähres) Prüfungsdatum ein. Dann siehst du, wie viele Tage noch bleiben und wie viele Fragen du pro Tag lernen solltest. Du kannst es jederzeit ändern.</p>
      <div class="row" style="align-items:end"><label class="field">Datum<input type="date" id="tdate" min="${today()}" value="${t ? t.d : ""}"></label>
        <button class="btn primary" id="tsave">Speichern</button>
        ${t ? `<button class="btn" id="tcancel">Abbrechen</button><button class="btn" id="tdel">Termin löschen</button>` : `<button class="btn" id="tnov">Ende November (30.11.)</button>`}</div>
    </section>`;
  const date = new Date(t.d + "T00:00:00").toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const head = t.days > 1 ? `<span class="big mono">${t.days}</span> <b>Tage bis zur Prüfung</b>` : t.days === 1 ? `<b class="big" style="font-size:2rem">Morgen ist Prüfung!</b>` : t.days === 0 ? `<b class="big" style="font-size:2rem">Heute ist Prüfung. Viel Erfolg!</b>` : `<b>Der eingetragene Termin ist vorbei.</b>`;
  const plan = t.days <= 0 ? "" : t.offen === 0
    ? `<p style="margin:0">Alle 285 Fragen sind sicher. Jetzt nur noch wiederholen und Prüfungsbögen schreiben.</p>`
    : t.days <= 2 ? `<p style="margin:0">Die letzten Tage: keine neuen Fragen mehr, nur noch die ${t.offen} unsicheren wiederholen und 1–2 Prüfungsbögen schreiben.</p>`
    : `<p style="margin:0"><b>${t.offen} Fragen</b> sind noch nicht sicher. Damit alle bis 2 Tage vor der Prüfung sitzen, schaffst du <b>etwa ${t.perDay} ${t.perDay === 1 ? "Frage" : "Fragen"} pro Tag</b> (${t.lernTage} Lerntage).</p>`;
  return `<section class="panel termin" style="display:grid;gap:10px">
    <div class="row" style="justify-content:space-between"><div class="eyebrow">Prüfungstermin · ${date}</div><button class="linkbtn" id="tedit">ändern</button></div>
    <div>${head}</div>
    ${plan}
    ${t.days > 0 && t.navOffen ? `<p class="muted" style="margin:0;font-size:.88rem">Navigation: ${t.navOffen} von 15 Aufgaben noch nicht mit 7 von 9 gelöst${t.days > 2 ? `, also etwa eine alle ${Math.max(1, Math.floor(t.lernTage / t.navOffen))} Tage` : ""}.</p>` : ""}
    ${t.days > 2 && t.offen ? `<div><button class="btn primary" id="tpace">Heute ${t.perDay} ${t.perDay === 1 ? "Frage" : "Fragen"} in den Lernstapel</button></div>` : ""}
  </section>`;
}
function wireTermin(m) {
  const saveDate = d => { if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { toast("Bitte ein Datum wählen."); return; } P.termin = { d, t: Date.now() }; save(); terminEdit = false; render(); };
  if ($("#tsave")) $("#tsave").onclick = () => saveDate($("#tdate").value);
  if ($("#tnov")) $("#tnov").onclick = () => saveDate(new Date().getFullYear() + "-11-30");
  if ($("#tcancel")) $("#tcancel").onclick = () => { terminEdit = false; render(); };
  if ($("#tdel")) $("#tdel").onclick = () => { P.termin = { d: "", t: Date.now() }; save(); terminEdit = false; render(); };
  if ($("#tedit")) $("#tedit").onclick = () => { terminEdit = true; render(); };
  if ($("#tpace")) $("#tpace").onclick = () => { const t = terminInfo(counts(Q.map(q => q.n))); addToStack(suggest(Math.min(t.perDay, DAILY_MAX))); go("tag"); };
}

/* Prüfungsreife: Ampel aus Lernstand und den letzten Prüfungsbögen */
function readinessPanel(all) {
  const pct = all.g / Q.length, last3 = P.exams.slice(-3), passed = last3.filter(e => e.pass).length, due = duePool().length;
  const checks = [
    [pct >= 0.9, `Mindestens 90 % der Fragen sicher <span class="muted">(jetzt ${Math.round(pct * 100)} %)</span>`],
    [all.s === 0, `Keine Frage als schlecht markiert <span class="muted">(jetzt ${all.s})</span>`],
    [last3.length === 3 && passed === 3, `Die letzten 3 Prüfungsbögen bestanden <span class="muted">(${passed} von ${last3.length})</span>`]
  ];
  const ok = checks.filter(c => c[0]).length;
  const [cls, label, text] = ok === 3 ? ["ok", "Bereit", "Du kannst dich zur Prüfung anmelden."]
    : pct >= 0.6 || passed >= 1 ? ["warn", "Fast so weit", "Noch etwas üben, dann passt es."]
    : ["no", "Weiter üben", "Lerne die schlecht markierten und neuen Fragen."];
  return `<section class="panel" style="display:grid;gap:12px">
    <div class="row" style="justify-content:space-between"><div class="eyebrow">Prüfungsreife</div><span class="pill ${cls}" style="font-size:.9rem">${label}</span></div>
    <b>${text}</b>
    <ul class="checks">${checks.map(([done, t]) => `<li class="${done ? "done" : ""}"><span aria-hidden="true">${done ? "✓" : "○"}</span><span>${t}</span></li>`).join("")}</ul>
    ${due ? `<button class="btn small" data-due="1" style="justify-self:start">${due} sichere ${due === 1 ? "Frage" : "Fragen"} auffrischen</button>` : ""}
    <p class="muted" style="margin:0;font-size:.82rem">Die Navigationsaufgabe (Kartenaufgabe) gehört auch zur Prüfung, ist hier aber nicht enthalten.</p>
  </section>`;
}

/* Lernkalender der letzten 5 Wochen mit Serie */
function dayKey(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function streak() {
  const d = new Date(); let n = 0;
  if (!P.days[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (P.days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function calendarPanel() {
  const end = new Date();
  // 5 volle Wochen Mo–So, die letzte endet mit der aktuellen Woche
  const monday = new Date(end); monday.setDate(end.getDate() - (end.getDay() + 6) % 7 - 28);
  const cells = [];
  for (let i = 0; i < 35; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const k = dayKey(d), v = P.days[k] || 0, future = d > end;
    const lvl = future ? "f" : v === 0 ? 0 : v < 10 ? 1 : v < 30 ? 2 : 3;
    cells.push(`<i class="l${lvl}${k === today() ? " today" : ""}" title="${d.toLocaleDateString("de-DE")}: ${v} Fragen"></i>`);
  }
  const s = streak(), todayN = P.days[today()] || 0;
  return `<section class="panel" style="display:grid;gap:12px">
    <div class="row" style="justify-content:space-between"><div class="eyebrow">Lernkalender</div><span class="muted" style="font-size:.85rem">heute ${todayN} ${todayN === 1 ? "Frage" : "Fragen"}</span></div>
    <div><span class="big mono" style="font-size:2rem">${s}</span> <b>${s === 1 ? "Tag" : "Tage"} am Stück gelernt</b></div>
    <div class="cal">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(d => `<span>${d}</span>`).join("")}${cells.join("")}</div>
    <div class="legend" style="margin:0"><span><i style="background:var(--line)"></i>nichts</span><span><i class="lg1"></i>unter 10</span><span><i class="lg2"></i>10–29</span><span><i class="lg3"></i>30 und mehr</span></div>
  </section>`;
}

/* Sicherung als Datei */
async function exportBackup() {
  const data = JSON.stringify(Object.assign({ app: "sbf-see-trainer", version: 1, exportedAt: new Date().toISOString() }, P), null, 1);
  const filename = "sbf-see-lernstand-" + today() + ".json";
  if (IN_ARTIFACT) {
    const dl = await claude.use("downloads").catch(() => null);
    if (!dl) { toast("Speichern ist in dieser Ansicht nicht möglich."); return; }
    try { await dl.save({ filename, data }); toast("Sicherung gespeichert"); }
    catch (e) { toast(e && e.code === "declined" ? "Speichern abgebrochen" : "Sicherung konnte nicht gespeichert werden"); }
    return;
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: "application/json" })); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Sicherung gespeichert");
}
async function importBackup(file) {
  try {
    const d = JSON.parse(await file.text());
    if (!d || typeof d.c !== "object" || Array.isArray(d.c)) throw new Error("format");
    const before = Object.keys(P.c).length;
    P = merge(P, d); save();
    toast(`Sicherung geladen: ${Object.keys(d.c).length} Fragen in der Datei, ${Object.keys(P.c).length - before} davon neu hier`);
    render();
  } catch (e) { toast("Das ist keine Sicherung aus dieser App."); }
}

/* Handy und PC verbinden */
let devConfirmOff = false;
function devicePanel() {
  const code = remote && remote.code;
  if (code) return `<section class="panel" style="display:grid;gap:10px">
      <div class="eyebrow">Handy und PC verbunden</div>
      <p style="margin:0">Dein Lernstand wird über den Lerncode abgeglichen. Am anderen Gerät die App öffnen und diesen Code eingeben:</p>
      <div class="row"><b class="mono" style="font-size:1.4rem;letter-spacing:.04em">${showCode(code)}</b><button class="btn small" id="dcopy">Code kopieren</button></div>
      ${devConfirmOff ? `<div class="panel confirm row" style="justify-content:space-between"><span>Trennen? Der Lernstand bleibt auf diesem Gerät, wird aber nicht mehr abgeglichen.</span><span class="row"><button class="btn small" id="doffno">Abbrechen</button><button class="btn small primary" id="doffyes">Trennen</button></span></div>`
        : `<div><button class="btn small" id="doff">Dieses Gerät trennen</button></div>`}
    </section>`;
  return `<section class="panel" style="display:grid;gap:12px">
      <div class="eyebrow">Handy und PC verbinden</div>
      <p style="margin:0;max-width:62ch">Damit Handy und PC denselben Lernstand haben: Erstelle auf einem Gerät einen Lerncode und gib ihn auf dem anderen ein. Bis dahin bleibt alles nur auf diesem Gerät.</p>
      <div class="row" style="gap:12px;align-items:end">
        <button class="btn primary" id="dnew2">Lerncode erstellen</button>
        <span class="muted">oder</span>
        <label class="field" style="flex:0 1 220px">Lerncode vom anderen Gerät<input type="text" id="dcode" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="xxxx-xxxx-xx"></label>
        <button class="btn" id="djoin">Verbinden</button>
      </div>
    </section>`;
}
function wireDevicePanel() {
  const busyBtn = (b, t) => { b.disabled = true; b.textContent = t; };
  if ($("#dnew2")) $("#dnew2").onclick = async e => {
    busyBtn(e.currentTarget, "Wird erstellt …");
    try { await connectCode(newCode(), true); toast("Lerncode erstellt"); } catch (err) { toast("Das hat nicht geklappt. Bist du online?"); render(); }
  };
  if ($("#djoin")) $("#djoin").onclick = async e => {
    const code = cleanCode($("#dcode").value);
    if (code.length < 10) { toast("Der Lerncode hat 10 Zeichen."); return; }
    busyBtn(e.currentTarget, "Verbinde …");
    try { await connectCode(code, false); toast("Verbunden"); }
    catch (err) { toast(err.message === "notfound" ? "Diesen Lerncode gibt es nicht. Bitte genau abtippen." : "Verbinden hat nicht geklappt. Bist du online?"); render(); }
  };
  if ($("#dcopy")) $("#dcopy").onclick = () => navigator.clipboard.writeText(showCode(remote.code)).then(() => toast("Code kopiert"), () => toast("Kopieren ging nicht, bitte abschreiben"));
  if ($("#doff")) $("#doff").onclick = () => { devConfirmOff = true; render(); };
  if ($("#doffno")) $("#doffno").onclick = () => { devConfirmOff = false; render(); };
  if ($("#doffyes")) $("#doffyes").onclick = () => { devConfirmOff = false; disconnect(); };
}

/* ---------- Tagesfragen = Lernstapel ----------
   Der Stapel bleibt über mehrere Tage bestehen. Eine Frage verlässt ihn nur, wenn du „Kann ich“ tippst.
   „Heute richtig/falsch“ (res) gilt nur für den aktuellen Tag; sicher/mittel/schlecht ist die langfristige Markierung. */
const DAILY_MAX = 40;
let tagHide = true, tagView = "kreuz", tagSheet = null, tagAddOpen = false, tagConfirmClear = false;
let tagAddMode = "suche", tagNums = "", tagMkCount = "10", tagAutoCount = "10", tagSearch = "", tagPicked = new Set();
try { tagNums = localStorage.getItem("sbfsee-tagnums") || ""; tagAddMode = localStorage.getItem("sbfsee-tagadd") || "suche"; } catch (e) {}
function rememberTag() { try { localStorage.setItem("sbfsee-tagnums", tagNums); localStorage.setItem("sbfsee-tagadd", tagAddMode); } catch (e) {} }
// Stapel holen; an einem neuen Tag bleiben die Fragen, nur die Tagesergebnisse beginnen neu
function stack() {
  if (!P.daily) return null;
  if (P.daily.date !== today()) { P.daily = { date: today(), ids: (P.daily.ids || []).slice(), res: {}, t: Date.now() }; save(); }
  return P.daily;
}
function setStack(ids, res) {
  const d = stack();
  P.daily = { date: today(), ids: ids.slice(0, DAILY_MAX), res: res || (d ? d.res : {}), t: Date.now() };
  save(); return P.daily;
}
// Fragen in den Stapel legen (ohne Doppelte); gibt zurück, wie viele neu hineinkamen
function addToStack(ids) {
  const d = stack(), cur = d ? d.ids : [], add = [...new Set(ids)].filter(n => !cur.includes(n));
  const taken = add.slice(0, Math.max(0, DAILY_MAX - cur.length));
  setStack(cur.concat(taken));
  tagSheet = null;
  if (add.length > taken.length) toast(`Der Stapel ist voll (höchstens ${DAILY_MAX}). ${add.length - taken.length} Fragen passten nicht mehr hinein.`);
  else toast(taken.length === 1 ? "1 Frage in den Stapel gelegt" : taken.length + " Fragen in den Stapel gelegt");
  return taken.length;
}
function removeFromStack(n) { const d = stack(); if (!d) return; const res = Object.assign({}, d.res); delete res[n]; setStack(d.ids.filter(x => x !== n), res); }
const inStack = n => !!(P.daily && (P.daily.ids || []).includes(n));
// Vorschlag für „Automatisch“: fällige sichere Fragen zum Auffrischen, dann schlecht markierte und neue
function suggest(count) {
  const due = duePool().filter(n => !inStack(n)).slice(0, Math.ceil(count / 3));
  const rest = Q.map(q => q.n).filter(n => !inStack(n) && !due.includes(n));
  return due.concat(pickLearn(rest, count - due.length));
}
// Für Drucken: liefert den Stapel und füllt ihn, falls er leer ist
function ensureDaily() {
  const d = stack();
  if (d && d.ids.length) return d;
  return setStack(suggest(P.dailySize || 10), {});
}
// Suche nach Wort oder Nummern (wie im Katalog)
function searchQuestions(str) {
  const s = str.trim().toLowerCase();
  if (!s) return [];
  if (/^(nr\.?\s*)?[\d\s,;\-–]+$/.test(s) && /\d/.test(s)) return parseNums(s.replace(/^nr\.?/, "")).ids;
  return Q.filter(q => (q.q + " " + q.a.join(" ")).toLowerCase().includes(s)).map(q => q.n);
}
// Reihenfolge im Stapel: gemischt (Standard) oder nach Fragennummer. „Neu mischen“ ändert Fragen- und Antwortreihenfolge.
let tagMix = true, tagMixKey = Math.floor(Math.random() * 1e6); // bei jedem Öffnen eine neue Reihenfolge
try { tagMix = localStorage.getItem("sbfsee-tagmix") !== "0"; } catch (e) {}
const tagOrder = (d, n) => shuffle([0, 1, 2, 3], seeded(d.date + ":" + tagMixKey + ":" + n));
// Jede Frage bekommt einen festen Zufallsrang, so bleibt die Reihenfolge stabil, wenn Fragen dazukommen oder rausgehen
const tagSeq = (d, ids) => tagMix ? ids.slice().sort((a, b) => seeded(d.date + "#" + tagMixKey + "#" + a)() - seeded(d.date + "#" + tagMixKey + "#" + b)()) : ids.slice().sort((a, b) => a - b);
function reshuffleTag() { tagMixKey++; tagSheet = null; }

function vTag(m) {
  if (quiz) return vQuiz(m);
  const d = stack(), ids = d ? d.ids : [];
  const right = ids.filter(n => d.res[n] === true).length, wrong = ids.filter(n => d.res[n] === false).length;
  const open = !ids.length || tagAddOpen;
  m.innerHTML = `<div class="view">
    <div class="noprint"><div class="eyebrow">${new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</div><h2>Tagesfragen</h2></div>
    <section class="panel noprint" style="display:grid;gap:10px">
      <div class="row" style="justify-content:space-between">
        <div><div class="eyebrow">Dein Lernstapel</div>
          <h3 style="margin-top:2px">${ids.length} ${ids.length === 1 ? "Frage" : "Fragen"}${ids.length ? ` · heute <span style="color:var(--sb)">${right} richtig</span>, <span style="color:var(--bb)">${wrong} falsch</span>` : ""}</h3></div>
        ${ids.length ? `<div class="row"><button class="btn ${open ? "" : "primary"}" id="tadd">${open ? "Hinzufügen schließen" : "Fragen hinzufügen"}</button><button class="btn" id="tclear">Stapel leeren</button></div>` : ""}
      </div>
      <p class="muted" style="margin:0;font-size:.88rem;max-width:70ch">Fragen bleiben im Stapel, auch über mehrere Tage, bis du bei einer Frage <b>Kann ich</b> tippst. „Heute richtig/falsch“ gilt nur für heute. Deine Markierung sicher/mittel/schlecht ist davon getrennt und gilt dauerhaft.</p>
      ${tagConfirmClear ? `<div class="panel confirm row" style="justify-content:space-between"><span>Alle ${ids.length} Fragen aus dem Stapel nehmen? Deine Markierungen bleiben.</span><span class="row"><button class="btn small" id="tclearno">Abbrechen</button><button class="btn small primary" id="tclearyes">Stapel leeren</button></span></div>` : ""}
    </section>
    ${open ? addPanelHTML() : ""}
    ${ids.length ? `<section class="panel noprint row" style="justify-content:space-between">
        <div class="row"><div class="seg" role="group" aria-label="Ansicht"><button data-tview="kreuz" aria-pressed="${tagView === "kreuz"}">Ankreuzen</button><button data-tview="loes" aria-pressed="${tagView === "loes"}">Lösungen</button></div>
          <div class="seg" role="group" aria-label="Reihenfolge"><button data-tmix="1" aria-pressed="${tagMix}">Gemischt</button><button data-tmix="0" aria-pressed="${!tagMix}">Nach Nummer</button></div>
          ${tagMix ? `<button class="btn small" id="tremix">Neu mischen</button>` : ""}</div>
        <div class="row"><button class="btn" id="dpdf">Als PDF</button><button class="btn" id="dquiz">Einzeln abfragen</button></div>
      </section>
      ${tagView === "kreuz" ? tagSheetHTML(d)
        : `<div class="row noprint"><button class="btn small" id="dhide">${tagHide ? "Antworten zeigen" : "Antworten verdecken"}</button></div>
           <div class="printarea">${sheetHTML(tagSeq(d, d.ids).map(n => ({ q: byN.get(n) })), "lern", "Lernstapel vom " + fmtDate(Date.now()), tagHide, d.res, true)}</div>`}` : ""}
  </div>`;
  if ($("#tadd")) $("#tadd").onclick = () => { tagAddOpen = !tagAddOpen; render(); };
  if ($("#tclear")) $("#tclear").onclick = () => { tagConfirmClear = true; render(); };
  if ($("#tclearno")) $("#tclearno").onclick = () => { tagConfirmClear = false; render(); };
  if ($("#tclearyes")) $("#tclearyes").onclick = () => { tagConfirmClear = false; setStack([], {}); tagSheet = null; render(); };
  if (open) wireAddPanel(m);
  if (ids.length) {
    m.querySelectorAll("[data-tview]").forEach(b => b.onclick = () => { tagView = b.dataset.tview; render(); });
    m.querySelectorAll("[data-tmix]").forEach(b => b.onclick = () => { tagMix = b.dataset.tmix === "1"; try { localStorage.setItem("sbfsee-tagmix", tagMix ? "1" : "0"); } catch (e) {} render(); });
    if ($("#tremix")) $("#tremix").onclick = () => { reshuffleTag(); render(); toast("Neu gemischt"); };
    if ($("#dhide")) $("#dhide").onclick = () => { tagHide = !tagHide; render(); };
    $("#dquiz").onclick = () => { quiz = { ids: shuffle(d.ids), i: 0, ok: 0, from: "tag" }; render(); };
    $("#dpdf").onclick = () => makePdf(tagSeq(d, d.ids).map(n => ({ q: byN.get(n), order: tagOrder(d, n) })), "bogen", "Lernstapel vom " + fmtDate(Date.now()), "Lernstapel-" + d.date);
    m.querySelectorAll(".ans.hidden").forEach(el => el.onclick = () => el.classList.remove("hidden"));
    if (tagView === "kreuz") wireTagSheet(m, d);
  }
}

/* Fragen hinzufügen: Suchen mit Haken, automatisch, nach Markierung oder nach Nummern */
function addPanelHTML() {
  const modes = [["suche", "Auswählen"], ["auto", "Automatisch"], ["marks", "Nach Markierung"], ["nummern", "Nummern"]];
  let body = "";
  if (tagAddMode === "suche") body = `
    <div class="row" style="align-items:end">
      <label class="field" style="flex:1 1 240px">Suche (leer lassen = alle Fragen)<input type="search" id="tsearch" autocomplete="off" value="${esc(tagSearch)}" placeholder="z. B. Nebel, Tonne, Schallsignal  oder  20-30"></label>
      <label class="field">Zeigen<select id="tfilter">${LIST_FILTERS.map(([k, l]) => `<option value="${k}" ${tagListFilter === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    </div>
    <div id="tresults"></div>`;
  if (tagAddMode === "auto") body = `
    <p class="muted" style="margin:0">Die App schlägt Fragen vor: fällige sichere zum Auffrischen, dann schlecht markierte und neue.</p>
    <div class="row" style="align-items:end"><label class="field">Anzahl<select id="tautocount">${["5", "10", "15", "20", "30"].map(n => `<option ${n === tagAutoCount ? "selected" : ""}>${n}</option>`).join("")}</select></label>
    <button class="btn primary" id="taddauto">Hinzufügen</button></div>`;
  if (tagAddMode === "marks") {
    const free = markPool().filter(n => !inStack(n)).length;
    body = `${markChips()}
    <div class="row" style="align-items:end"><label class="field">Anzahl<select id="tmkcount">${["5", "10", "15", "20", "30", "alle"].map(n => `<option value="${n}" ${n === tagMkCount ? "selected" : ""}>${n === "alle" ? "alle" : n}</option>`).join("")}</select></label>
    <button class="btn primary" id="taddmarks" ${free ? "" : "disabled"}>Hinzufügen</button></div>
    <span class="muted" style="font-size:.85rem">${free} passende Fragen, die noch nicht im Stapel sind. Schlecht markierte kommen zuerst.</span>`;
  }
  if (tagAddMode === "nummern") body = `
    <div class="row" style="align-items:end"><label class="field" style="flex:1 1 240px">Nummern<input type="text" id="tnums" inputmode="numeric" autocomplete="off" value="${esc(tagNums)}" placeholder="z. B. 22, 23, 25, 30, 40-43"></label>
    <button class="btn primary" id="taddnums">Hinzufügen</button></div>
    <span class="muted" id="tnumshint" style="font-size:.85rem">${numsHint(tagNums)}</span>`;
  return `<section class="panel noprint" style="display:grid;gap:12px">
    <div class="row" style="gap:12px"><span class="eyebrow">Fragen hinzufügen</span>
      <div class="seg" role="group" aria-label="Wie hinzufügen">${modes.map(([k, l]) => `<button data-addmode="${k}" aria-pressed="${tagAddMode === k}">${l}</button>`).join("")}</div></div>
    ${body}
  </section>`;
}
const LIST_FILTERS = [["alle", "Alle Fragen"], ["offen", "Noch nicht sicher"], ["n", "Unbewertet"], ["s", "Schlecht"], ["m", "Mittel"], ["g", "Sicher"], ["basis", "Basisfragen"], ["see", "See-Fragen"], ["bild", "Mit Bild"]];
let tagListFilter = "alle";
function listFilter(n) {
  const k = mark(n) || "n", q = byN.get(n);
  switch (tagListFilter) {
    case "offen": return k !== "g";
    case "n": case "s": case "m": case "g": return k === tagListFilter;
    case "basis": return q.section === "Basisfragen";
    case "see": return q.section !== "Basisfragen";
    case "bild": return q.img.length > 0;
    default: return true;
  }
}
// Liste aller passenden Fragen zum Durchscrollen und Anhaken; der Hinzufügen-Knopf bleibt unten sichtbar
function renderResults() {
  const box = $("#tresults"); if (!box) return;
  const base = tagSearch.trim() ? searchQuestions(tagSearch) : Q.map(q => q.n);
  const hits = base.filter(listFilter), pickable = hits.filter(n => !inStack(n));
  box.innerHTML = hits.length ? `
    <div class="row" style="justify-content:space-between;margin-bottom:8px"><b>${hits.length} ${hits.length === 1 ? "Frage" : "Fragen"}</b>
      <span class="row"><button class="btn small" id="tpickall" ${pickable.length ? "" : "disabled"}>Alle ${pickable.length} anhaken</button><button class="btn small" id="tpicknone" ${tagPicked.size ? "" : "disabled"}>Haken entfernen</button></span></div>
    <div class="picklist">${hits.map(n => { const q = byN.get(n), there = inStack(n);
      return `<label class="pick${there ? " there" : ""}"><input type="checkbox" data-pick="${n}" ${there || tagPicked.has(n) ? "checked" : ""} ${there ? "disabled" : ""}>
        <span class="mono">Nr. ${n}</span><span class="pt">${esc(q.q)}</span>${there ? `<span class="pill n">im Stapel</span>` : markPill(n)}</label>`; }).join("")}</div>
    <div class="pickbar"><span id="tpickcount">${tagPicked.size} angehakt</span><button class="btn primary" id="taddpicked" ${tagPicked.size ? "" : "disabled"}>In den Stapel legen</button></div>`
    : `<p class="muted" style="margin:0">Keine Frage gefunden.</p>`;
  box.querySelectorAll("[data-pick]").forEach(c => c.onchange = () => { const n = +c.dataset.pick; c.checked ? tagPicked.add(n) : tagPicked.delete(n); updatePickBtn(); });
  if ($("#tpickall")) $("#tpickall").onclick = () => { pickable.forEach(n => tagPicked.add(n)); renderResults(); };
  if ($("#tpicknone")) $("#tpicknone").onclick = () => { tagPicked.clear(); renderResults(); };
  if ($("#taddpicked")) $("#taddpicked").onclick = () => { addToStack([...tagPicked]); tagPicked.clear(); render(); };
}
function updatePickBtn() { const b = $("#taddpicked"); if (b) b.disabled = !tagPicked.size; const c = $("#tpickcount"); if (c) c.textContent = tagPicked.size + " angehakt"; const nn = $("#tpicknone"); if (nn) nn.disabled = !tagPicked.size; }
function wireAddPanel(m) {
  m.querySelectorAll("[data-addmode]").forEach(b => b.onclick = () => { tagAddMode = b.dataset.addmode; rememberTag(); render(); });
  if ($("#tsearch")) { $("#tsearch").oninput = e => { tagSearch = e.target.value; renderResults(); }; renderResults(); }
  if ($("#tfilter")) $("#tfilter").onchange = e => { tagListFilter = e.target.value; renderResults(); };
  if ($("#tautocount")) $("#tautocount").onchange = e => { tagAutoCount = e.target.value; };
  if ($("#taddauto")) $("#taddauto").onclick = () => { addToStack(suggest(+tagAutoCount)); render(); };
  if ($("#tmkcount")) $("#tmkcount").onchange = e => { tagMkCount = e.target.value; };
  if ($("#taddmarks")) $("#taddmarks").onclick = () => { const pool = markPool().filter(n => !inStack(n)); addToStack(pickLearn(pool, tagMkCount === "alle" ? pool.length : +tagMkCount).sort((a, b) => a - b)); render(); };
  if ($("#tnums")) {
    $("#tnums").oninput = e => { tagNums = e.target.value; rememberTag(); $("#tnumshint").textContent = numsHint(tagNums); };
    $("#tnums").onkeydown = e => { if (e.key === "Enter") $("#taddnums").click(); };
  }
  if ($("#taddnums")) $("#taddnums").onclick = () => { const ids = parseNums(tagNums).ids; if (!ids.length) { toast("Bitte gültige Nummern zwischen 1 und 285 eingeben."); return; } addToStack(ids); render(); };
}

/* „Kann ich“: Frage verlässt den Stapel und wird als sicher markiert */
document.addEventListener("click", e => {
  const b = e.target.closest("[data-know]"); if (!b) return;
  const n = +b.dataset.know, y = window.scrollY;
  removeFromStack(n); setMark(n, "g");
  toast(`Nr. ${n} ist raus aus dem Stapel und als sicher markiert`);
  render(); window.scrollTo(0, y);
});

/* Stapel als Bogen: alle vier Antworten aus dem Katalog, gemischt, zum Ankreuzen */
function tagState(d) { if (!tagSheet || tagSheet.key !== d.date) tagSheet = { key: d.date, ans: {}, done: false, only: null }; return tagSheet; }
function tagSheetHTML(d) {
  const st = tagState(d), list = tagSeq(d, (st.only || d.ids).filter(n => d.ids.includes(n)));
  const right = list.filter(n => st.ans[n] === 0).length, answered = list.filter(n => st.ans[n] !== undefined).length;
  const wrongToday = d.ids.filter(n => d.res[n] === false);
  const summary = st.done
    ? `<div class="row" style="justify-content:space-between"><div><span class="big mono" style="font-size:2rem">${right} / ${list.length}</span> <span class="muted">richtig</span></div>
        <span class="row"><button class="btn" id="tagagain">Nochmal alle</button>${wrongToday.length ? `<button class="btn primary" id="tagwrong">Nur die ${wrongToday.length} falschen nochmal</button>` : ""}</span></div>
       <p class="muted" style="margin:0">Was du jetzt sicher kannst, nimmst du mit <b>Kann ich</b> aus dem Stapel. Alles andere bleibt für morgen drin.</p>`
    : st.only ? `<div class="row" style="justify-content:space-between"><b>Nur die heute falschen: ${list.length} Fragen</b><button class="btn small" id="tagall">Alle zeigen</button></div>` : "";
  return `<section class="panel" style="display:grid;gap:22px">
    ${summary}
    ${list.map((n, idx) => { const q = byN.get(n), today = d.res[n]; return `<div class="examq">
      <div class="qmeta" style="justify-content:space-between"><span class="row" style="gap:8px"><span class="mono">Frage ${idx + 1}</span><span>·</span><span class="mono">Nr. ${n}</span>${markPill(n)}${today !== undefined ? `<span class="pill ${today ? "ok" : "no"}">heute ${today ? "richtig" : "falsch"}</span>` : ""}</span>
        <button class="btn small knowit" data-know="${n}">✓ Kann ich</button></div>
      <p class="qtext">${esc(q.q)}</p>${imgTag(q)}
      <div class="opts">${tagOrder(d, n).map((o, i) => { let c = ""; if (st.done) { if (o === 0) c = "right"; else if (st.ans[n] === o) c = "wrong"; } else if (st.ans[n] === o) c = "sel";
        return `<button class="opt ${c}" data-tn="${n}" data-o="${o}" ${st.done ? "disabled" : ""}><span class="k">${"ABCD"[i]}</span><span>${esc(q.a[o])}</span></button>`; }).join("")}</div>
      ${st.done ? `<div style="margin-top:6px">${markBar(n)}</div>${noteBox(n)}` : ""}</div>`; }).join("")}
    ${st.done ? "" : `<div class="row" style="justify-content:space-between"><b class="mono" id="tagcount">${answered} / ${list.length} angekreuzt</b><button class="btn primary" id="tagcheck">Auswerten</button></div>`}
  </section>`;
}
function wireTagSheet(m, d) {
  const st = tagState(d), list = () => tagSeq(d, (st.only || d.ids).filter(n => d.ids.includes(n)));
  m.querySelectorAll("[data-tn]").forEach(b => b.onclick = () => {
    st.ans[b.dataset.tn] = +b.dataset.o;
    b.parentNode.querySelectorAll(".opt").forEach(x => x.classList.toggle("sel", x === b));
    $("#tagcount").textContent = list().filter(n => st.ans[n] !== undefined).length + " / " + list().length + " angekreuzt";
  });
  if ($("#tagcheck")) $("#tagcheck").onclick = () => {
    const res = Object.assign({}, d.res);
    for (const n of list()) if (st.ans[n] !== undefined) { const ok = st.ans[n] === 0; res[n] = ok; record(n, ok); }
    setStack(d.ids, res); st.done = true; render(); window.scrollTo(0, 0);
  };
  if ($("#tagagain")) $("#tagagain").onclick = () => { reshuffleTag(); render(); window.scrollTo(0, 0); };
  if ($("#tagwrong")) $("#tagwrong").onclick = () => { const only = d.ids.filter(n => d.res[n] === false); tagMixKey++; tagSheet = { key: d.date, ans: {}, done: false, only }; render(); window.scrollTo(0, 0); };
  if ($("#tagall")) $("#tagall").onclick = () => { tagSheet = null; render(); };
}

function vQuiz(m) {
  const z = quiz;
  if (z.i >= z.ids.length) {
    m.innerHTML = `<div class="view"><section class="panel" style="display:grid;gap:12px;text-align:center;justify-items:center;padding:36px">
      <div class="eyebrow">Abfrage beendet</div><div class="big mono">${z.ok} / ${z.ids.length}</div>
      <p class="muted" style="margin:0">${z.ok === z.ids.length ? "Alles richtig. Stark!" : "Falsch beantwortete Fragen sind jetzt als „schlecht“ markiert und kommen bald wieder."}</p>
      <button class="btn primary" id="qback">Zurück zum Lernstapel</button></section></div>`;
    $("#qback").onclick = () => { quiz = null; render(); };
    return;
  }
  const n = z.ids[z.i];
  m.innerHTML = `<div class="view"><div class="row" style="justify-content:space-between"><div class="eyebrow">Tagesfragen abfragen · ${z.i + 1} von ${z.ids.length}</div><button class="btn small" id="qstop">Beenden</button></div>
    <div class="progress"><i style="width:${z.i / z.ids.length * 100}%"></i></div>
    <section class="panel" id="qbox"></section></div>`;
  $("#qstop").onclick = () => { quiz = null; render(); };
  mcQuestion($("#qbox"), byN.get(n), ok => {
    if (P.daily && P.daily.ids.includes(n)) { P.daily.res = Object.assign({}, P.daily.res, { [n]: ok }); P.daily.t = Date.now(); }
    record(n, ok); if (ok) z.ok++;
  }, () => { z.i++; render(); });
}

/* Multiple-Choice-Frage mit gemischten Antworten */
function mcQuestion(box, q, onAnswer, onNext) {
  const order = shuffle([0, 1, 2, 3]);
  box.innerHTML = `<div class="qmeta"><span class="mono">Nr. ${q.n}</span><span>·</span><span>${esc(q.section)}</span>${markPill(q.n)}</div>
    <p class="qtext">${esc(q.q)}</p>${imgTag(q)}
    <div class="opts">${order.map((o, i) => `<button class="opt" data-o="${o}"><span class="k">${"ABCD"[i]}</span><span>${esc(q.a[o])}</span></button>`).join("")}</div>
    <div class="row" style="margin-top:16px;justify-content:space-between" hidden id="nextrow"><span class="row" style="gap:8px"><span class="muted" style="font-size:.85rem">Markierung:</span><span id="mbar"></span></span><button class="btn primary" id="next">Weiter</button></div><div id="mnote"></div>`;
  box.querySelectorAll(".opt").forEach(b => b.onclick = () => {
    const ok = b.dataset.o === "0";
    box.querySelectorAll(".opt").forEach(x => { x.disabled = true; if (x.dataset.o === "0") x.classList.add("right"); });
    if (!ok) b.classList.add("wrong");
    onAnswer(ok);
    box.querySelector("#mbar").innerHTML = markBar(q.n);
    box.querySelector("#mnote").innerHTML = noteBox(q.n);
    box.querySelector("#nextrow").hidden = false; box.querySelector("#next").focus();
  });
  box.querySelector("#next").onclick = onNext;
}

/* ---------- Karteikarten ---------- */
let flashCfg = { pool: "alle", mode: "karte", order: "lernen", nums: "1-10" };
const flashPool = () => poolFor(flashCfg.pool, flashCfg.nums);
function vKarten(m) {
  if (similar) return vSimilar(m);
  if (pics) return vPics(m);
  if (flash && !flash.done) return vFlash(m);
  const pool = flashPool();
  const done = flash && flash.done ? flash : null;
  m.innerHTML = `<div class="view">
    <div><div class="eyebrow">Markiere jede Karte als sicher, mittel oder schlecht</div><h2>Karteikarten</h2></div>
    ${done ? `<section class="panel confirm" style="display:grid;gap:6px"><b>Runde beendet: ${done.seen} Karten, davon ${done.ok} sicher.</b><span class="muted">Über „Welche Fragen?“ kannst du jetzt gezielt alle schlechten oder mittleren Karten wiederholen.</span></section>` : ""}
    <section class="panel" style="display:grid;gap:16px">
      <div class="row" style="gap:16px;align-items:end">
        <label class="field">Welche Fragen?
          <select id="fpool">${poolOptions(flashCfg.pool)}</select></label>
        ${flashCfg.pool === "marks" ? `<div style="flex:1 1 100%">${markChips()}</div>` : ""}
        ${flashCfg.pool === "nummern" ? `<label class="field" style="flex:1 1 220px">Nummern<input type="text" id="fnums" inputmode="numeric" value="${esc(flashCfg.nums)}" placeholder="z. B. 1-10, 22, 30, 32"></label>` : ""}
        <label class="field">Reihenfolge
          <select id="forder"><option value="lernen" ${flashCfg.order === "lernen" ? "selected" : ""}>Schlechte zuerst</option><option value="zufall" ${flashCfg.order === "zufall" ? "selected" : ""}>Zufällig</option><option value="nummer" ${flashCfg.order === "nummer" ? "selected" : ""}>Nach Fragennummer</option></select></label>
      </div>
      <div class="row" style="gap:12px"><span class="eyebrow" style="margin-right:4px">Modus</span>
        <div class="seg" role="group" aria-label="Modus"><button data-mode="karte" aria-pressed="${flashCfg.mode === "karte"}">Umdrehen</button><button data-mode="mc" aria-pressed="${flashCfg.mode === "mc"}">Ankreuzen</button></div></div>
      <p class="muted" style="margin:0">${flashCfg.mode === "karte" ? "Du siehst die Frage, überlegst die Antwort und drehst die Karte um. Dann markierst du sie als sicher, mittel oder schlecht." : "Du wählst aus vier Antworten, die bei jeder Karte neu gemischt werden. Falsch markiert die Karte als schlecht, richtig eine Stufe besser. Du kannst die Markierung danach selbst ändern."}</p>
      <div class="row"><button class="btn primary" id="fstart" ${pool.length ? "" : "disabled"}>${pool.length} Karten lernen</button>${flashCfg.pool === "nummern" ? `<span class="muted" id="fhint" style="font-size:.85rem">${numsHint(flashCfg.nums)}</span>` : ""}</div>
    </section>
    <div class="grid2">
      <section class="panel" style="display:grid;gap:10px;align-content:start"><div class="eyebrow">Bilder-Training</div>
        <p style="margin:0">20 Fragen mit Bild schnell hintereinander: Lichter, Sichtzeichen, Schallsignale, Tafelzeichen. Richtige Antworten gehen automatisch weiter.</p>
        <div><button class="btn primary" id="picstart">Bilder-Training starten</button></div></section>
      <section class="panel" style="display:grid;gap:10px;align-content:start"><div class="eyebrow">Verwechslungsgefahr</div>
        <p style="margin:0">${SIMILAR_GROUPS.length} Gruppen von Fragen mit gleichen Antworten, direkt nebeneinander (davon ${simGroups().length} noch nicht ganz sicher). So siehst du, woran du sie unterscheidest.</p>
        <div><button class="btn" id="simstart">Ähnliche Fragen vergleichen</button></div></section>
    </div>
  </div>`;
  $("#picstart").onclick = startPics;
  $("#simstart").onclick = () => { similar = { i: 0 }; render(); window.scrollTo(0, 0); };
  $("#fpool").onchange = e => { flashCfg.pool = e.target.value; flash = null; render(); };
  $("#forder").onchange = e => { flashCfg.order = e.target.value; };
  if ($("#fnums")) $("#fnums").oninput = e => { flashCfg.nums = e.target.value; const n = flashPool().length; $("#fstart").disabled = !n; $("#fstart").textContent = n + " Karten lernen"; $("#fhint").textContent = numsHint(flashCfg.nums); };
  m.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { flashCfg.mode = b.dataset.mode; render(); });
  $("#fstart").onclick = () => {
    let ids = flashPool();
    ids = flashCfg.order === "nummer" ? ids.slice().sort((a, b) => a - b) : flashCfg.order === "zufall" ? shuffle(ids) : pickLearn(ids, ids.length);
    flash = { ids, i: 0, ok: 0, seen: 0, done: false }; render();
  };
}
function vFlash(m) {
  const f = flash;
  if (f.i >= f.ids.length) { f.done = true; return render(); }
  const q = byN.get(f.ids[f.i]);
  const head = `<div class="row" style="justify-content:space-between"><div class="eyebrow">Karte ${f.i + 1} von ${f.ids.length} · ${f.ok} sicher</div><button class="btn small" id="fstop">Runde beenden</button></div>
    <div class="progress"><i style="width:${f.i / f.ids.length * 100}%"></i></div>`;
  const next = () => { f.i++; render(); };
  if (flashCfg.mode === "mc") {
    m.innerHTML = `<div class="view">${head}<section class="panel" id="qbox"></section></div>`;
    mcQuestion($("#qbox"), q, ok => { record(q.n, ok); f.seen++; }, () => { if (mark(q.n) === "g") f.ok++; next(); });
  } else {
    const meta = `<div class="qmeta"><span class="mono">Nr. ${q.n}</span><span>·</span><span>${esc(q.section)}</span>${markPill(q.n)}</div>`;
    m.innerHTML = `<div class="view">${head}
      <div class="cardwrap"><div class="card" id="card" tabindex="0" role="button" aria-label="Karte umdrehen">
        <div class="face front">${meta}<p class="qtext">${esc(q.q)}</p>${imgTag(q)}<div class="hint">Antippen oder Leertaste zum Umdrehen</div></div>
        <div class="face back">${meta}<p class="qtext" style="font-size:1rem;font-weight:400">${esc(q.q)}</p><div class="answer">${esc(q.a[0])}</div>${imgTag(q)}${noteBox(q.n)}<div class="hint">Wie sicher warst du?</div></div>
      </div></div>
      <div class="rate" id="rate" hidden><button class="btn bad" data-rate="s">Schlecht</button><button class="btn mid" data-rate="m">Mittel</button><button class="btn good" data-rate="g">Sicher</button></div>
    </div>`;
    const card = $("#card");
    const fit = () => { const a = card.querySelector(".front"), b = card.querySelector(".back"); a.style.position = b.style.position = "relative"; const h = Math.max(a.scrollHeight, b.scrollHeight, 340); a.style.position = b.style.position = ""; card.style.height = h + "px"; };
    fit(); card.querySelectorAll("img").forEach(i => i.onload = fit);
    const flip = () => { card.classList.toggle("flipped"); if (card.classList.contains("flipped")) $("#rate").hidden = false; };
    card.onclick = e => { if (!e.target.closest("[data-notebox]")) flip(); };
    card.onkeydown = e => { if (e.target.tagName === "TEXTAREA") return; if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } };
    m.querySelectorAll("[data-rate]").forEach(b => b.onclick = () => { const k = b.dataset.rate; setMark(q.n, k); f.seen++; if (k === "g") f.ok++; next(); });
    card.focus({ preventScroll: true });
  }
  $("#fstop").onclick = () => { f.done = true; render(); };
}
document.addEventListener("keydown", e => {
  if (view !== "karten" || !flash || flash.done || flashCfg.mode !== "karte" || e.target.tagName === "TEXTAREA") return;
  if ($("#rate") && !$("#rate").hidden) { const k = { "1": "s", "2": "m", "3": "g" }[e.key]; if (k) document.querySelector(`[data-rate="${k}"]`).click(); }
});

/* ---------- Prüfung ---------- */
function newExamIds() { return shuffle(BASIS).slice(0, 7).concat(shuffle(SEE).slice(0, 23)); }
function vPruefung(m) {
  if (!exam) {
    const ex = P.exams.slice().reverse();
    m.innerHTML = `<div class="view">
      <div><div class="eyebrow">Wie in der theoretischen Prüfung</div><h2>Prüfungsbogen</h2></div>
      <section class="panel" style="display:grid;gap:12px">
        <p style="margin:0;max-width:62ch">Ein Bogen mit <b>30 Fragen</b>: 7 Basisfragen und 23 spezifische See-Fragen, zufällig gezogen. Du hast <b>60 Minuten</b>. Bestanden ist der Bogen mit mindestens <b>5 von 7 Basisfragen</b> und <b>18 von 23 See-Fragen</b>. Erst nach dem Abgeben siehst du, was richtig war.</p>
        <div class="row"><button class="btn primary" id="estart">Zufälligen Bogen beginnen</button><button class="btn" id="eprint">Zufälligen Bogen ausdrucken</button></div>
      </section>
      <section class="panel" style="display:grid;gap:12px">
        <div class="eyebrow">Die 15 offiziellen Prüfungsbögen</div>
        <p class="muted" style="margin:0">In der Prüfung bekommst du einen dieser Bögen. Grün = schon bestanden, rot = zuletzt nicht bestanden.</p>
        <div class="bogengrid">${Object.keys(DATA.boegen).map(k => { const last = P.exams.filter(e => e.b === +k).at(-1), best = Math.max(-1, ...P.exams.filter(e => e.b === +k && e.pass).map(e => e.score));
          return `<button class="bogenbtn ${best >= 0 ? "ok" : last ? "no" : ""}" data-bogen="${k}"><b>Bogen ${k}</b><span>${best >= 0 ? best + " / 30 ✓" : last ? last.score + " / 30" : "noch offen"}</span></button>`; }).join("")}</div>
        <div class="row" style="align-items:end"><label class="field">Bogen ausdrucken<select id="eprintnr">${Object.keys(DATA.boegen).map(k => `<option value="${k}">Bogen ${k}</option>`).join("")}</select></label><button class="btn" id="eprintoff">Zum Drucken</button></div>
      </section>
      <section class="panel"><div class="eyebrow">Bisherige Bögen</div>
        ${ex.length ? `<ul class="examlist">${ex.map(e => `<li><span>${fmtDate(e.t)}${e.b ? " · Bogen " + e.b : ""}</span><span class="mono">${e.score} / 30 · Basis ${e.basis}/7</span><span class="pill ${e.pass ? "ok" : "no"}">${e.pass ? "bestanden" : "nicht bestanden"}</span></li>`).join("")}</ul>` : `<p class="muted" style="margin:8px 0 0">Noch keine Prüfung geschrieben.</p>`}
      </section></div>`;
    $("#estart").onclick = () => { exam = { ids: newExamIds(), ans: {}, start: Date.now(), done: false }; exam.order = Object.fromEntries(exam.ids.map(n => [n, shuffle([0, 1, 2, 3])])); confirmSubmit = false; render(); };
    $("#eprint").onclick = () => { printCfg.src = "pruefung"; printCfg.kind = "bogen"; printItems = null; go("drucken"); };
    m.querySelectorAll("[data-bogen]").forEach(b => b.onclick = () => { const k = +b.dataset.bogen; exam = { ids: DATA.boegen[k].slice(), bogen: k, ans: {}, start: Date.now(), done: false }; exam.order = Object.fromEntries(exam.ids.map(n => [n, shuffle([0, 1, 2, 3])])); confirmSubmit = false; render(); window.scrollTo(0, 0); });
    $("#eprintoff").onclick = () => { printCfg.src = "offiziell"; printCfg.bogen = $("#eprintnr").value; printCfg.kind = "bogen"; printItems = null; go("drucken"); };
    return;
  }
  const e = exam;
  const answered = Object.keys(e.ans).length;
  const correct = e.ids.filter(n => e.ans[n] === 0).length;
  const basisOk = e.ids.slice(0, 7).filter(n => e.ans[n] === 0).length;
  m.innerHTML = `<div class="view">
    ${e.done ? `<section class="panel result">
        <div><div class="eyebrow">Ergebnis</div><div class="big mono">${correct} / 30</div></div>
        <div style="display:grid;gap:6px"><span class="pill ${e.pass ? "ok" : "no"}" style="font-size:1rem;justify-self:start">${e.pass ? "Bestanden" : "Nicht bestanden"}</span>
        <span class="muted">Basis ${basisOk} von 7 (nötig 5) · See ${correct - basisOk} von 23 (nötig 18) · ${Math.round((e.end - e.start) / 60000)} Minuten</span></div>
        <div class="row" style="margin-left:auto"><button class="btn" id="eclose">Schließen</button>${correct < 30 ? `<button class="btn" id="ewrong">${30 - correct} falsche in den Lernstapel</button>` : ""}<button class="btn primary" id="eagain">Neuer Bogen</button></div>
      </section>`
      : `<div class="stickyexam">${e.bogen ? `<span class="pill n">Bogen ${e.bogen}</span>` : ""}<b class="mono">${answered} / 30 beantwortet</b><span class="muted mono" id="clock"></span><span style="margin-left:auto"></span><button class="btn small" id="ecancel">Abbrechen</button><button class="btn primary small" id="esubmit">Abgeben</button></div>
         ${confirmSubmit ? `<section class="panel confirm row" style="justify-content:space-between"><span>${answered < 30 ? `<b>${30 - answered} Fragen</b> sind noch offen. ` : ""}Bogen jetzt abgeben?</span><span class="row"><button class="btn small" id="cno">Weiter bearbeiten</button><button class="btn primary small" id="cyes">Ja, abgeben</button></span></section>` : ""}`}
    <section class="panel" style="display:grid;gap:22px">
      ${e.ids.map((n, idx) => { const q = byN.get(n); return `<div class="examq" id="eq${n}">
        <div class="qmeta"><span class="mono">Frage ${idx + 1}</span><span>·</span><span>${idx < 7 ? "Basisfrage" : "See-Frage"}</span><span>·</span><span class="mono">Nr. ${n}</span>${e.done ? `<span class="pill ${e.ans[n] === 0 ? "ok" : "no"}">${e.ans[n] === 0 ? "richtig" : e.ans[n] === undefined ? "offen" : "falsch"}</span>` : ""}</div>
        <p class="qtext">${esc(q.q)}</p>${imgTag(q)}
        <div class="opts">${e.order[n].map((o, i) => { let c = ""; if (e.done) { if (o === 0) c = "right"; else if (e.ans[n] === o) c = "wrong"; } else if (e.ans[n] === o) c = "sel";
          return `<button class="opt ${c}" data-n="${n}" data-o="${o}" ${e.done ? "disabled" : ""}><span class="k">${"ABCD"[i]}</span><span>${esc(q.a[o])}</span></button>`; }).join("")}</div>${e.done ? `<div style="margin-top:6px">${markBar(n)}</div>${noteBox(n)}` : ""}</div>`; }).join("")}
    </section>
    ${e.done ? "" : `<div class="row" style="justify-content:flex-end"><button class="btn primary" id="esubmit2">Abgeben</button></div>`}
  </div>`;
  if (e.done) {
    $("#eclose").onclick = () => { exam = null; render(); };
    $("#eagain").onclick = () => { exam = null; render(); $("#estart").click(); };
    if ($("#ewrong")) $("#ewrong").onclick = () => {
      const wrongIds = e.ids.filter(n => e.ans[n] !== 0);
      exam = null; tagView = "kreuz"; tagAddOpen = false; addToStack(wrongIds); go("tag");
    };
    return;
  }
  m.querySelectorAll(".opt").forEach(b => b.onclick = () => {
    e.ans[b.dataset.n] = +b.dataset.o;
    b.parentNode.querySelectorAll(".opt").forEach(x => x.classList.toggle("sel", x === b));
    m.querySelector(".stickyexam b").textContent = Object.keys(e.ans).length + " / 30 beantwortet";
  });
  const ask = () => { confirmSubmit = true; const y = window.scrollY; render(); window.scrollTo(0, Math.min(y, 0)); };
  $("#esubmit").onclick = ask; $("#esubmit2").onclick = ask;
  $("#ecancel").onclick = () => { exam = null; render(); };
  if (confirmSubmit) {
    $("#cno").onclick = () => { confirmSubmit = false; render(); };
    $("#cyes").onclick = () => {
      e.done = true; e.end = Date.now();
      const sc = e.ids.filter(n => e.ans[n] === 0).length;
      // Bestanden: mindestens 5 von 7 Basisfragen und 18 von 23 See-Fragen
      const basis = e.ids.slice(0, 7).filter(n => e.ans[n] === 0).length, see = sc - basis;
      e.pass = basis >= 5 && see >= 18;
      for (const n of e.ids) record(n, e.ans[n] === 0);
      P.exams = P.exams.concat([{ t: e.end, score: sc, basis, see, pass: e.pass, b: e.bogen || 0 }]).slice(-30);
      save(); confirmSubmit = false; render(); window.scrollTo(0, 0);
    };
  }
  tick();
}
let confirmSubmit = false;
function tick() {
  const c = $("#clock"); if (!c || !exam || exam.done) return;
  const left = Math.max(0, 3600000 - (Date.now() - exam.start));
  c.textContent = left ? `noch ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")} min` : "Zeit abgelaufen";
  clearTimeout(tick.h); tick.h = setTimeout(tick, 1000);
}

/* ---------- Drucken ---------- */
let printCfg = { src: "alle", kind: "bogen", count: "10", nums: "1-10" };
let printItems = null;
function buildPrintItems() {
  const c = printCfg; let ids;
  if (c.src === "tag") ids = ensureDaily().ids.slice();
  else if (c.src === "pruefung") ids = newExamIds();
  else if (c.src === "offiziell") ids = DATA.boegen[c.bogen || 1].slice();
  else {
    ids = poolFor(c.src, c.nums);
    if (c.count !== "alle" && ids.length > +c.count) ids = shuffle(ids).slice(0, +c.count);
  }
  if (c.src !== "pruefung" && c.src !== "offiziell") ids.sort((a, b) => a - b);
  printItems = ids.map(n => ({ q: byN.get(n), order: shuffle([0, 1, 2, 3]) }));
}
const SRC = [["tag", "Mein Lernstapel (Tagesfragen)"], ["pruefung", "Zufälliger Prüfungsbogen (7 Basis + 23 See)"], ["offiziell", "Offizieller Prüfungsbogen 1–15"]].concat(POOLS);
function printTitle() {
  return printCfg.kind === "bogen" ? (printCfg.src === "offiziell" ? "Prüfungsbogen " + (printCfg.bogen || 1) + " von 15 · SBF-See" : printCfg.src === "pruefung" ? "Prüfungsbogen SBF-See" : "Übungsbogen SBF-See") : "Lernblatt SBF-See";
}
function vDrucken(m) {
  if (!printItems) buildPrintItems();
  const c = printCfg;
  const needCount = !["tag", "pruefung", "offiziell"].includes(c.src);
  const poolSize = needCount ? poolFor(c.src, c.nums).length : 0;
  m.innerHTML = `<div class="view">
    <div class="noprint"><div class="eyebrow">DIN A4 zum schriftlichen Üben</div><h2>Bögen drucken</h2></div>
    <section class="panel noprint" style="display:grid;gap:16px">
      <div class="row" style="gap:16px;align-items:end">
        <label class="field">Fragen
          <select id="psrc">${SRC.map(([k, l]) => `<option value="${k}" ${c.src === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        ${c.src === "offiziell" ? `<label class="field">Bogen<select id="pbogen">${Object.keys(DATA.boegen).map(k => `<option value="${k}" ${String(c.bogen || 1) === k ? "selected" : ""}>Bogen ${k}</option>`).join("")}</select></label>` : ""}
        ${c.src === "marks" ? `<div style="flex:1 1 100%">${markChips()}</div>` : ""}
        ${c.src === "nummern" ? `<label class="field" style="flex:1 1 220px">Nummern<input type="text" id="pnums" inputmode="numeric" value="${esc(c.nums)}" placeholder="z. B. 1-10, 22, 30, 32"></label>` : ""}
        ${needCount ? `<label class="field">Anzahl<select id="pcount">${["alle", "5", "10", "15", "20", "30", "40"].map(n => `<option value="${n}" ${n === c.count ? "selected" : ""}>${n === "alle" ? "alle (" + poolSize + ")" : n + " zufällig"}</option>`).join("")}</select></label>` : ""}
      </div>
      ${c.src === "nummern" ? `<span class="muted" style="font-size:.85rem;margin-top:-8px" id="phint">${numsHint(c.nums)}</span>` : ""}
      <div class="row" style="gap:12px"><span class="eyebrow">Art</span>
        <div class="seg" role="group" aria-label="Art des Bogens"><button data-kind="bogen" aria-pressed="${c.kind === "bogen"}">Zum Ankreuzen</button><button data-kind="lern" aria-pressed="${c.kind === "lern"}">Lernblatt mit Lösung</button></div></div>
      <p class="muted" style="margin:0">${c.kind === "bogen" ? "Vier Antworten in gemischter Reihenfolge mit Kästchen. Die Lösungen stehen auf einer eigenen Seite am Ende." : "Jede Frage mit der richtigen Antwort darunter, zum Lesen und Einprägen."}</p>
      <div class="row"><button class="btn" id="pshuffle">Neu mischen</button><button class="btn primary" id="ppdf" ${printItems.length ? "" : "disabled"}>PDF erstellen</button>${IN_ARTIFACT ? "" : `<button class="btn" id="pprint">Drucken</button>`}</div>
    </section>
    <div class="printarea">${printItems.length ? sheetHTML(printItems, c.kind, printTitle(), false) : `<div class="panel empty">Für diese Auswahl gibt es noch keine Fragen.</div>`}</div>
  </div>`;
  $("#psrc").onchange = e => { c.src = e.target.value; c.count = e.target.value === "marks" || e.target.value === "nummern" ? "alle" : "10"; buildPrintItems(); render(); };
  if ($("#pbogen")) $("#pbogen").onchange = e => { c.bogen = e.target.value; buildPrintItems(); render(); };
  if ($("#pcount")) $("#pcount").onchange = e => { c.count = e.target.value; buildPrintItems(); render(); };
  if ($("#pnums")) $("#pnums").onchange = e => { c.nums = e.target.value; buildPrintItems(); render(); };
  m.querySelectorAll("[data-kind]").forEach(b => b.onclick = () => { c.kind = b.dataset.kind; render(); });
  $("#pshuffle").onclick = () => { buildPrintItems(); render(); };
  $("#ppdf").onclick = () => makePdf(printItems, c.kind, printTitle(), (c.kind === "bogen" ? "Bogen" : "Lernblatt") + "-SBF-See-" + today());
  if ($("#pprint")) $("#pprint").onclick = () => window.print();
}
function sheetHTML(items, kind, title, hide, res, know) {
  const rows = items.map((it, i) => {
    const q = it.q, order = it.order || [0, 1, 2, 3];
    const mark = res && res[q.n] !== undefined ? ` <span class="pill ${res[q.n] ? "ok" : "no"}" style="font-size:.7rem">${res[q.n] ? "richtig" : "falsch"}</span>` : "";
    return `<div class="pq"><div><div class="t">${i + 1}. ${esc(q.q)}<small>Nr. ${q.n}</small>${mark}${know ? ` <button class="btn small knowit noprint" data-know="${q.n}">✓ Kann ich</button>` : ""}</div>
      ${kind === "bogen" ? `<ul>${order.map((o, k) => `<li><span class="cb"></span><span>${"ABCD"[k]}) ${esc(q.a[o])}</span></li>`).join("")}</ul>`
        : `<div class="ans${hide ? " hidden" : ""}">${esc(q.a[0])}</div>`}</div>
      <div>${imgTag(q, "")}</div></div>`;
  }).join("");
  const key = kind === "bogen" ? `<div class="keypart"><h3>Lösungen</h3><div class="keygrid">${items.map((it, i) => `<span>${i + 1}. ${"ABCD"[(it.order || [0]).indexOf(0)]}</span>`).join("")}</div></div>` : "";
  return `<article class="paper"><div class="phead"><b>${esc(title)}</b><span>${items.length} Fragen · ${new Date().toLocaleDateString("de-DE")}</span>${kind === "bogen" ? "<span>Name: ____________________</span>" : ""}</div>${rows}${key}</article>`;
}

/* PDF mit jsPDF (wird bei Bedarf geladen) */
function loadJsPDF() {
  if (window.jspdf) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = IN_ARTIFACT ? "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" : "jspdf.umd.min.js"; s.onload = res; s.onerror = () => rej(new Error("jsPDF")); document.head.appendChild(s); });
}
async function makePdf(items, kind, title, fname) {
  toast("PDF wird erstellt …");
  try { await loadJsPDF(); } catch (e) { toast("PDF-Baustein konnte nicht geladen werden. Bist du online?"); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 15, PW = 210, PH = 297, W = PW - 2 * M, LH = 4.5, IW = 45, IH = 30;
  let y = 0, page = 1;
  const head = () => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(title, M, M + 4);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`${items.length} Fragen · ${new Date().toLocaleDateString("de-DE")}`, PW - M, M + 4, { align: "right" });
    if (kind === "bogen" && page === 1) doc.text("Name: ______________________", M, M + 10);
    doc.setLineWidth(0.5); doc.line(M, M + (kind === "bogen" && page === 1 ? 13 : 7), PW - M, M + (kind === "bogen" && page === 1 ? 13 : 7));
    y = M + (kind === "bogen" && page === 1 ? 20 : 14);
  };
  const newPage = () => { doc.addPage(); page++; head(); };
  head();
  items.forEach((it, i) => {
    const q = it.q, order = it.order || [0, 1, 2, 3], hasImg = q.img.length > 0;
    const tw = hasImg ? W - IW - 6 : W - 14;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
    const ql = doc.splitTextToSize(`${i + 1}. ${q.q}`, tw);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const blocks = kind === "bogen" ? order.map((o, k) => doc.splitTextToSize(`${"ABCD"[k]})  ${q.a[o]}`, tw - 7)) : [doc.splitTextToSize(q.a[0], tw - 4)];
    let h = ql.length * LH + 2 + blocks.reduce((s, b) => s + b.length * LH + 1.2, 0) + (kind === "lern" ? 1 : 0);
    if (hasImg) h = Math.max(h, IH + 1);
    if (y + h > PH - M - 6) newPage();
    const top = y;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(0);
    doc.text(ql, M, y + 3.5); y += ql.length * LH + 2;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    if (kind === "bogen") {
      blocks.forEach(b => { doc.setLineWidth(0.3); doc.rect(M + 0.5, y + 0.6, 3.3, 3.3); doc.text(b, M + 7, y + 3.5); y += b.length * LH + 1.2; });
    } else {
      doc.setTextColor(20, 99, 47); doc.setFont("helvetica", "bold"); doc.text(blocks[0], M + 4, y + 3.5); doc.setTextColor(0);
      doc.setDrawColor(20, 99, 47); doc.setLineWidth(0.8); doc.line(M + 1, y + 0.5, M + 1, y + blocks[0].length * LH + 0.5); doc.setDrawColor(0);
      y += blocks[0].length * LH + 2.2;
    }
    if (hasImg) { try { doc.addImage(IMG[q.img[0]], "PNG", PW - M - IW, top + 0.5, IW, IH); if (LIGHT.has(q.img[0])) { doc.setLineWidth(0.2); doc.setDrawColor(180); doc.rect(PW - M - IW, top + 0.5, IW, IH); doc.setDrawColor(0); } } catch (e) {} }
    y = Math.max(y, top + h) + 2.5;
    doc.setLineWidth(0.15); doc.setDrawColor(170); doc.line(M, y - 1.5, PW - M, y - 1.5); doc.setDrawColor(0);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120); doc.text(`Nr. ${q.n}`, PW - M, top + (hasImg ? IH + 4 : 3.5), { align: "right" }); doc.setTextColor(0);
    if (hasImg) y = Math.max(y, top + IH + 7);
  });
  if (kind === "bogen") {
    newPage();
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Lösungen", M, y + 2); y += 9;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const cols = 5, cw = W / cols;
    items.forEach((it, i) => { const r = Math.floor(i / cols), c = i % cols; doc.text(`${i + 1}.  ${"ABCD"[it.order.indexOf(0)]}   (Nr. ${it.q.n})`, M + c * cw, y + r * 6.5); });
    y += Math.ceil(items.length / cols) * 6.5 + 4;
    if (items.length === 30) { doc.setFontSize(9); doc.setTextColor(90); doc.text((printCfg.src === "pruefung" || printCfg.src === "offiziell") && kind === "bogen" ? "Bestanden mit mindestens 5 von 7 Basisfragen (Nr. 1-7) und 18 von 23 See-Fragen (Nr. 8-30)." : "", M, y); doc.setTextColor(0); }
  }
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) { doc.setPage(p); doc.setFontSize(8); doc.setTextColor(120); doc.text(`Seite ${p} von ${n}`, PW / 2, PH - 8, { align: "center" }); doc.setTextColor(0); }
  const blob = doc.output("blob"), filename = fname.replace(/[^\w.-]+/g, "-") + ".pdf";
  if (IN_ARTIFACT) {
    const dl = await claude.use("downloads").catch(() => null);
    if (!dl) { toast("Speichern ist in dieser Ansicht nicht möglich."); return; }
    try { await dl.save({ filename, data: blob }); toast("PDF gespeichert"); }
    catch (e) { toast(e && e.code === "declined" ? "Speichern abgebrochen" : "PDF konnte nicht gespeichert werden"); }
  } else {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast("PDF gespeichert");
  }
}

/* ---------- Katalog ---------- */
let catCfg = { s: "", sec: "alle", limit: 40 };
// [1,2,3,7] -> "1-3, 7"
function compactNums(ids) {
  const s = ids.slice().sort((a, b) => a - b), out = [];
  for (let i = 0; i < s.length; i++) { let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; out.push(j > i ? s[i] + "-" + s[j] : String(s[i])); i = j; }
  return out.join(", ");
}
function vKatalog(m) {
  m.innerHTML = `<div class="view">
    <div><div class="eyebrow">Alle Fragen mit richtiger Antwort</div><h2>Fragenkatalog</h2></div>
    <section class="panel" style="display:grid;gap:12px">
      <div class="row" style="gap:12px;align-items:end">
        <label class="field" style="flex:1 1 240px">Suche nach Wort oder Nummern<input type="search" id="cs" placeholder="z. B. Nebel  oder  1-10, 22, 30" value="${esc(catCfg.s)}"></label>
        <label class="field">Auswahl<select id="csec">${POOLS.filter(p => p[0] !== "nummern").map(([k, l]) => `<option value="${k}" ${catCfg.sec === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      </div>
      ${catCfg.sec === "marks" ? markChips() : ""}
      <div class="row" style="justify-content:space-between"><b id="ccount"></b>
        <span class="row"><button class="btn small" id="clearn">Diese als Karteikarten lernen</button><button class="btn small" id="cprint">Diese drucken</button></span></div>
    </section>
    <div class="catlist" id="clist"></div></div>`;
  let result = [];
  const list = () => {
    const s = catCfg.s.trim().toLowerCase();
    const isNums = /^(nr\.?\s*)?[\d\s,;\-–]+$/.test(s) && /\d/.test(s);
    const allowed = new Set(poolFor(catCfg.sec));
    let r = Q.filter(q => allowed.has(q.n));
    if (isNums) { const want = new Set(parseNums(s.replace(/^nr\.?/, "")).ids); r = r.filter(q => want.has(q.n)); }
    else if (s) r = r.filter(q => (q.q + " " + q.a.join(" ")).toLowerCase().includes(s));
    result = r.map(q => q.n);
    $("#ccount").textContent = r.length === 1 ? "1 Frage" : r.length + " Fragen";
    $("#clearn").disabled = $("#cprint").disabled = !r.length;
    const shown = r.slice(0, catCfg.limit);
    $("#clist").innerHTML = (shown.length ? shown.map(q => `<article class="panel catitem"><div style="min-width:0">
        <div class="qmeta"><span class="mono">Nr. ${q.n}</span><span>·</span><span>${esc(q.section)}</span></div>
        <div style="font-weight:700;margin-top:4px">${esc(q.q)}</div><div class="a">${esc(q.a[0])}</div>
        <div style="margin-top:10px">${markBar(q.n)}</div>${noteBox(q.n)}</div>${imgTag(q, "")}</article>`).join("") : `<div class="panel empty">Keine Frage gefunden.</div>`)
      + (r.length > shown.length ? `<div class="row" style="justify-content:center"><button class="btn" id="cmore">Weitere ${Math.min(40, r.length - shown.length)} von ${r.length - shown.length} anzeigen</button></div>` : "");
    if ($("#cmore")) $("#cmore").onclick = () => { catCfg.limit += 40; list(); };
  };
  $("#cs").oninput = e => { catCfg.s = e.target.value; catCfg.limit = 40; list(); };
  $("#csec").onchange = e => { catCfg.sec = e.target.value; catCfg.limit = 40; render(); };
  $("#clearn").onclick = () => { flashCfg.pool = "nummern"; flashCfg.nums = compactNums(result); flash = null; go("karten"); };
  $("#cprint").onclick = () => { printCfg.src = "nummern"; printCfg.nums = compactNums(result); printCfg.count = "alle"; printItems = null; go("drucken"); };
  list();
}

/* ---------- Eselsbrücken: eigene Notiz je Frage ---------- */
const note = n => (P.notes && P.notes[n] && P.notes[n].s) || "";
function setNote(n, s) { const notes = Object.assign({}, P.notes); notes[n] = { s: s.slice(0, 300), t: Date.now() }; P.notes = notes; save(); }
const noteBox = n => `<div class="notebox" data-notebox="${n}">${noteInner(n)}</div>`;
function noteInner(n) {
  const s = note(n);
  return s ? `<div class="note"><span class="note-l">Eselsbrücke</span><span class="note-t">${esc(s)}</span><button class="linkbtn" data-note="edit" data-n="${n}">ändern</button></div>`
    : `<button class="linkbtn" data-note="edit" data-n="${n}">✎ Eselsbrücke notieren</button>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-note]"); if (!b) return;
  e.stopPropagation(); e.preventDefault();
  const n = +b.dataset.n, box = b.closest("[data-notebox]");
  if (b.dataset.note === "edit") {
    box.innerHTML = `<div class="noteedit"><textarea maxlength="300" rows="2" placeholder="z. B. Rot = Backbord = links, wie Rotwein links">${esc(note(n))}</textarea>
      <span class="row"><button class="btn small" data-note="cancel" data-n="${n}">Abbrechen</button><button class="btn small primary" data-note="save" data-n="${n}">Speichern</button></span></div>`;
    box.querySelector("textarea").focus(); return;
  }
  if (b.dataset.note === "save") { setNote(n, box.querySelector("textarea").value.trim()); toast("Eselsbrücke gespeichert"); }
  document.querySelectorAll(`[data-notebox="${n}"]`).forEach(x => x.innerHTML = noteInner(n));
}, true);
// Klicks und Tasten in einer Notiz sollen keine Karte umdrehen
document.addEventListener("click", e => { if (e.target.closest(".noteedit")) e.stopPropagation(); }, true);

/* ---------- Schwierigste Fragen ---------- */
function hardest() {
  const rate = n => { const s = stat(n); return s.w / Math.max(1, s.r + s.w); };
  return Q.map(q => q.n).filter(n => stat(n).w > 0).sort((a, b) => stat(b).w - stat(a).w || rate(b) - rate(a)).slice(0, 10);
}
function hardestPanel() {
  const h = hardest();
  return `<section class="panel" style="display:grid;gap:10px">
    <div class="row" style="justify-content:space-between"><div class="eyebrow">Deine schwierigsten Fragen</div>
      ${h.some(n => !inStack(n)) ? `<button class="btn small" id="hardall">Alle in den Lernstapel</button>` : ""}</div>
    ${h.length ? `<ul class="hardlist">${h.map(n => { const s = stat(n), q = byN.get(n); return `<li>
        <span class="mono">Nr. ${n}</span><span class="ht">${esc(q.q.length > 90 ? q.q.slice(0, 88) + " …" : q.q)}</span>
        <span class="muted mono" style="white-space:nowrap">${s.w}× falsch · ${s.r}× richtig</span>
        ${inStack(n) ? `<span class="pill n">im Stapel</span>` : `<button class="btn small" data-hardadd="${n}">+ Stapel</button>`}</li>`; }).join("")}</ul>`
      : `<p class="muted" style="margin:0">Noch keine Frage falsch beantwortet. Sobald du übst, siehst du hier, was dir am schwersten fällt.</p>`}
  </section>`;
}
function wireHardest(m) {
  m.querySelectorAll("[data-hardadd]").forEach(b => b.onclick = () => { addToStack([+b.dataset.hardadd]); render(); });
  if ($("#hardall")) $("#hardall").onclick = () => { addToStack(hardest()); render(); };
}

/* ---------- Verwechslungsgefahr: Fragen mit gleichen Antworten ---------- */
const normA = s => s.toLowerCase().replace(/[^a-zäöüß0-9]+/g, " ").trim();
const SIMILAR_GROUPS = (() => {
  const sets = Q.map(q => new Set(q.a.map(normA))), parent = new Map(Q.map(q => [q.n, q.n]));
  const find = x => parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x));
  for (let i = 0; i < Q.length; i++) for (let j = i + 1; j < Q.length; j++) {
    let c = 0; for (const a of sets[i]) if (sets[j].has(a)) c++;
    if (c >= 2) parent.set(find(Q[i].n), find(Q[j].n));
  }
  const groups = new Map();
  for (const q of Q) { const r = find(q.n); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(q.n); }
  return [...groups.values()].filter(g => g.length > 1).sort((a, b) => a[0] - b[0]);
})();
let similar = null; // { i }
let simOpenOnly = true;
try { simOpenOnly = localStorage.getItem("sbfsee-simopen") !== "0"; } catch (e) {}
// Gruppen, in denen noch mindestens eine Frage nicht als sicher markiert ist
const simGroups = () => simOpenOnly ? SIMILAR_GROUPS.filter(g => g.some(n => mark(n) !== "g")) : SIMILAR_GROUPS;
function vSimilar(m) {
  const groups = simGroups();
  if (!groups.length) {
    m.innerHTML = `<div class="view"><section class="panel" style="display:grid;gap:12px;text-align:center;justify-items:center;padding:36px">
      <div class="eyebrow">Verwechslungsgefahr</div><h3>Alle ähnlichen Fragen sind als sicher markiert.</h3>
      <div class="row"><button class="btn" id="simall">Trotzdem alle Gruppen zeigen</button><button class="btn primary" id="simclose">Schließen</button></div></section></div>`;
    $("#simall").onclick = () => { simOpenOnly = false; try { localStorage.setItem("sbfsee-simopen", "0"); } catch (e) {} similar.i = 0; render(); };
    $("#simclose").onclick = () => { similar = null; render(); };
    return;
  }
  similar.i = Math.min(similar.i, groups.length - 1);
  const g = groups[similar.i];
  const all = g.flatMap(n => byN.get(n).a.map(normA));
  const shared = a => all.filter(x => x === normA(a)).length > 1;
  m.innerHTML = `<div class="view">
    <div class="row" style="justify-content:space-between"><div><div class="eyebrow">Verwechslungsgefahr · Gruppe ${similar.i + 1} von ${groups.length}</div><h2>Ähnliche Fragen im Vergleich</h2></div>
      <button class="btn small" id="simclose">Schließen</button></div>
    <div class="seg" role="group" aria-label="Welche Gruppen"><button data-simopen="1" aria-pressed="${simOpenOnly}">Nur noch nicht sichere Gruppen</button><button data-simopen="0" aria-pressed="${!simOpenOnly}">Alle ${SIMILAR_GROUPS.length} Gruppen</button></div>
    <p class="muted" style="margin:0;max-width:70ch">Diese Fragen haben gleiche oder fast gleiche Antworten. Grün ist jeweils die richtige. Mit ↔ markierte Antworten kommen auch bei einer anderen Frage dieser Gruppe vor.</p>
    <div class="simgrid">${g.map(n => { const q = byN.get(n); return `<article class="panel" style="display:grid;gap:8px;align-content:start">
        <div class="qmeta" style="justify-content:space-between"><span class="row" style="gap:8px"><span class="mono">Nr. ${n}</span>${markPill(n)}</span>
          ${inStack(n) ? `<span class="pill n">im Stapel</span>` : `<button class="btn small" data-simone="${n}">+ Stapel</button>`}</div>
        <b>${esc(q.q)}</b>${imgTag(q)}
        <ul class="simans">${q.a.map((a, k) => `<li class="${k === 0 ? "ok" : ""}">${k === 0 ? "✓" : "·"} ${esc(a)}${shared(a) ? ` <span class="muted">↔</span>` : ""}</li>`).join("")}</ul>
        <div>${markBar(n)}</div>${noteBox(n)}</article>`; }).join("")}</div>
    <div class="row" style="justify-content:space-between">
      <button class="btn" id="simprev" ${similar.i ? "" : "disabled"}>‹ Vorige Gruppe</button>
      <button class="btn" id="simadd">${g.every(inStack) ? "Alle im Stapel" : "Gruppe in den Lernstapel"}</button>
      <button class="btn primary" id="simnext" ${similar.i < groups.length - 1 ? "" : "disabled"}>Nächste Gruppe ›</button></div>
  </div>`;
  $("#simclose").onclick = () => { similar = null; render(); };
  $("#simprev").onclick = () => { similar.i--; render(); window.scrollTo(0, 0); };
  $("#simnext").onclick = () => { similar.i++; render(); window.scrollTo(0, 0); };
  $("#simadd").onclick = () => { if (!g.every(inStack)) { const y = window.scrollY; addToStack(g); render(); window.scrollTo(0, y); } };
  m.querySelectorAll("[data-simone]").forEach(b => b.onclick = () => { const y = window.scrollY; addToStack([+b.dataset.simone]); render(); window.scrollTo(0, y); });
  m.querySelectorAll("[data-simopen]").forEach(b => b.onclick = () => { simOpenOnly = b.dataset.simopen === "1"; try { localStorage.setItem("sbfsee-simopen", simOpenOnly ? "1" : "0"); } catch (e) {} similar.i = 0; render(); });
}

/* ---------- Bilder-Training: schnell hintereinander nur Fragen mit Bild ---------- */
let pics = null; // { ids, i, ok, streak, best, answered }
function startPics() { pics = { ids: pickLearn(Q.filter(q => q.img.length).map(q => q.n), 20), i: 0, ok: 0, streak: 0, best: 0, answered: false }; pics.ids = shuffle(pics.ids); render(); }
function vPics(m) {
  const p = pics;
  if (p.i >= p.ids.length) {
    m.innerHTML = `<div class="view"><section class="panel" style="display:grid;gap:12px;text-align:center;justify-items:center;padding:36px">
      <div class="eyebrow">Bilder-Training beendet</div><div class="big mono">${p.ok} / ${p.ids.length}</div>
      <p class="muted" style="margin:0">Längste Serie: ${p.best} richtig hintereinander.</p>
      <div class="row"><button class="btn" id="picend">Zurück</button><button class="btn primary" id="picagain">Nochmal 20 Bilder</button></div></section></div>`;
    $("#picend").onclick = () => { pics = null; render(); };
    $("#picagain").onclick = startPics;
    return;
  }
  const q = byN.get(p.ids[p.i]), order = shuffle([0, 1, 2, 3]);
  m.innerHTML = `<div class="view">
    <div class="row" style="justify-content:space-between"><div class="eyebrow">Bild ${p.i + 1} von ${p.ids.length} · ${p.ok} richtig · Serie ${p.streak}</div><button class="btn small" id="picstop">Beenden</button></div>
    <div class="progress"><i style="width:${p.i / p.ids.length * 100}%"></i></div>
    <section class="panel picq">
      ${imgTag(q, "qimg big")}
      <div><div class="qmeta"><span class="mono">Nr. ${q.n}</span>${markPill(q.n)}</div><p class="qtext" style="font-size:1rem">${esc(q.q)}</p>
      <div class="opts">${order.map((o, i) => `<button class="opt" data-po="${o}"><span class="k">${"ABCD"[i]}</span><span>${esc(q.a[o])}</span></button>`).join("")}</div>
      <div class="row" style="justify-content:space-between;margin-top:12px" id="picnext" hidden><span id="picnote"></span><button class="btn primary" id="picgo">Weiter</button></div></div>
    </section></div>`;
  $("#picstop").onclick = () => { p.i = p.ids.length; render(); };
  const next = () => { p.i++; render(); };
  m.querySelectorAll("[data-po]").forEach(b => b.onclick = () => {
    const ok = b.dataset.po === "0";
    m.querySelectorAll("[data-po]").forEach(x => { x.disabled = true; if (x.dataset.po === "0") x.classList.add("right"); });
    if (!ok) b.classList.add("wrong");
    record(q.n, ok);
    if (ok) { p.ok++; p.streak++; p.best = Math.max(p.best, p.streak); setTimeout(() => { if (pics === p && byN.get(p.ids[p.i]) === q) next(); }, 900); }
    else { p.streak = 0; $("#picnote").innerHTML = noteBox(q.n); $("#picnext").hidden = false; $("#picgo").onclick = next; $("#picgo").focus(); }
  });
}

/* ---------- Navigation (Kartenaufgabe) ---------- */
const NAV = DATA.navigation;
let navTask = null, navShown = {}, navTrainer = null;
const navRes = k => (P.nav && P.nav[k] && P.nav[k].r) || {};
function setNavRes(k, part, ok) {
  const nav = Object.assign({}, P.nav), r = Object.assign({}, navRes(k));
  if (ok === null) delete r[part]; else r[part] = ok;
  nav[k] = { r, t: Date.now() }; P.nav = nav; logDay(); save();
}
const LOES_PDF = "bootspruefung_de_sbfs_navigationsaufgaben_alle.pdf";

/* Seekarten: aus der eigenen PDF geladen, nur auf diesem Gerät gespeichert (IndexedDB) */
let kartenUrls = {}, kartenStatus = "";
function kartenDb() { return new Promise((res, rej) => { const r = indexedDB.open("sbfsee-karten", 1); r.onupgradeneeded = () => r.result.createObjectStore("k"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function kartenOp(mode, fn) { const db = await kartenDb(); return new Promise((res, rej) => { const tx = db.transaction("k", mode), st = tx.objectStore("k"); const out = fn(st); tx.oncomplete = () => res(out && out.result); tx.onerror = () => rej(tx.error); }); }
async function loadKartenFromDb() {
  try {
    for (let k = 1; k <= 15; k++) { const blob = await kartenOp("readonly", st => st.get(k)); if (blob) kartenUrls[k] = URL.createObjectURL(blob); }
    if (Object.keys(kartenUrls).length && view === "nav") render();
  } catch (e) {}
}
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  const base = IN_ARTIFACT ? "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/" : "pdfjs/";
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = base + "pdf.min.js";
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + "pdf.worker.min.js"; res(); }; s.onerror = () => rej(new Error("pdfjs")); document.head.appendChild(s); });
}
async function importKarten(file) {
  const status = t => { kartenStatus = t; const el = $("#kstatus"); if (el) el.textContent = t; };
  try {
    status("PDF wird geöffnet …");
    await loadPdfJs();
    const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
    if (pdf.numPages < 15) throw new Error("zu wenige Seiten");
    // Die Karten-PDF hat vorne eine Erklärungsseite, danach Karte 1 bis 15 (Überschrift ist Grafik, kein Text)
    const first = pdf.numPages - 14, found = {};
    for (let p = first; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const text = (await page.getTextContent()).items.map(i => i.str).join(" ");
      const m = text.match(/Navigationsaufgabe\s+(\d+)/) || [null, String(p - first + 1)];
      if (found[m[1]]) continue;
      status(`Seekarte ${m[1]} wird gespeichert …`);
      const vp0 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: 2200 / vp0.width });
      const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
      await kartenOp("readwrite", st => st.put(blob, +m[1]));
      if (kartenUrls[m[1]]) URL.revokeObjectURL(kartenUrls[m[1]]);
      kartenUrls[m[1]] = URL.createObjectURL(blob); found[m[1]] = true;
    }
    const n = Object.keys(found).length;
    kartenStatus = "";
    toast(n ? `${n} Seekarten geladen` : "In dieser PDF wurden keine Seekarten gefunden.");
  } catch (e) { kartenStatus = ""; toast("Die PDF konnte nicht gelesen werden."); }
  render();
}
async function removeKarten() {
  try { await kartenOp("readwrite", st => st.clear()); } catch (e) {}
  Object.values(kartenUrls).forEach(u => URL.revokeObjectURL(u)); kartenUrls = {}; render();
}
function openMap(k) {
  const o = document.createElement("div"); o.className = "mapview";
  o.innerHTML = `<div class="mapbar"><b>Seekarte zu Navigationsaufgabe ${k}</b><span class="row"><button class="btn small" data-mz>Zoom</button><button class="btn small primary" data-mc>Schließen</button></span></div><div class="mapscroll"><img src="${kartenUrls[k]}" alt="Seekarte ${k}"></div>`;
  document.body.appendChild(o);
  o.querySelector("[data-mc]").onclick = () => o.remove();
  o.querySelector("[data-mz]").onclick = () => o.classList.toggle("zoom");
  o.querySelector("img").ondblclick = () => o.classList.toggle("zoom");
}

const GRUNDLAGEN = `
  <h4>Kurse und Peilungen umrechnen</h4>
  <p><b>rwK = MgK + Abl + Mw</b> und zurück <b>MgK = rwK − Mw − Abl</b>. Für Peilungen gilt dasselbe: rwP = MgP + Abl + Mw.
  Östliche Werte (E) sind plus, westliche (W) minus. Kurse und Peilungen immer dreistellig schreiben: 079°, 003°.</p>
  <h4>Missweisung aus der Karte</h4>
  <p>Beispiel „0°50'E 2010 (5'E)“: 2010 waren es 50' Ost, jedes Jahr kommen 5' Ost dazu. Im Jahr der Aufgabe also 50' + Jahre × 5'.
  60' sind 1°. Gerundet auf ganze Grad.</p>
  <h4>Zeit, Distanz, Fahrt</h4>
  <p><b>Zeit (min) = Distanz (sm) ÷ Fahrt (kn) × 60</b> und <b>Distanz = Fahrt × Zeit (min) ÷ 60</b>.
  Distanzen immer am <b>seitlichen</b> Kartenrand abgreifen (Breitenskala, 1' = 1 sm), nie oben oder unten.</p>
  <h4>Koppelort und Besteckversetzung</h4>
  <p>Koppelort: vom Ausgangsort den rwK einzeichnen und die gefahrene Distanz abtragen.
  Der beobachtete Ort ergibt sich aus dem Schnitt der Peilungen. Die <b>Besteckversetzung</b> ist Richtung und Abstand vom Koppelort zum beobachteten Ort, z. B. „BV = 103° – 0,8 sm“.</p>
  <h4>Position angeben</h4>
  <p>Erst die Breite, dann die Länge: 54° 03,5' N, 008° 06,9' E. Die Länge wird mit drei Stellen geschrieben.</p>
  <h4>In der Prüfung</h4>
  <p>9 Teilaufgaben, mindestens 7 müssen stimmen. Folgefehler werden als richtig gewertet, wenn der Lösungsweg stimmt. Deshalb immer den Rechenweg hinschreiben.
  Mitbringen: Kursdreieck, Anlegedreieck oder zweites Dreieck, Zirkel, Bleistift, Radiergummi.</p>`;

/* Rechentrainer mit zufälligen Werten */
const deg3 = d => String(((Math.round(d) % 360) + 360) % 360).padStart(3, "0") + "°";
const sgn = (v, u) => (v >= 0 ? "+" : "−") + Math.abs(v) + u;
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
function newTrainer(kind) {
  if (kind === "mgk") { const mgk = rint(0, 359), abl = rint(-6, 6), mw = rint(-3, 3), rwk = mgk + abl + mw;
    return { kind, frage: `MgK = ${deg3(mgk)}, Ablenkung ${sgn(abl, "°")}, Missweisung ${sgn(mw, "°")}. Wie lautet der rwK?`, soll: ((rwk % 360) + 360) % 360, tol: 0, einheit: "°",
      weg: `rwK = MgK + Abl + Mw = ${mgk}° ${sgn(abl, "°")} ${sgn(mw, "°")} = ${deg3(rwk)}` }; }
  if (kind === "rwk") { const rwk = rint(0, 359), abl = rint(-6, 6), mw = rint(-3, 3), mgk = rwk - mw - abl;
    return { kind, frage: `rwK = ${deg3(rwk)}, Ablenkung ${sgn(abl, "°")}, Missweisung ${sgn(mw, "°")}. Wie lautet der MgK?`, soll: ((mgk % 360) + 360) % 360, tol: 0, einheit: "°",
      weg: `MgK = rwK − Mw − Abl = ${rwk}° − (${sgn(mw, "°")}) − (${sgn(abl, "°")}) = ${deg3(mgk)}` }; }
  if (kind === "zeit") { const d = rint(20, 150) / 10, v = rint(4, 14), t = d / v * 60;
    return { kind, frage: `Distanz ${String(d).replace(".", ",")} sm, Fahrt über Grund ${v} kn. Wie viele Minuten dauert die Fahrt?`, soll: Math.round(t), tol: 1, einheit: "min",
      weg: `Zeit = Distanz ÷ Fahrt × 60 = ${String(d).replace(".", ",")} ÷ ${v} × 60 = ${t.toFixed(1).replace(".", ",")} min, also rund ${Math.round(t)} min` }; }
  if (kind === "dist") { const v = rint(4, 14), t = rint(10, 90), d = v * t / 60;
    return { kind, frage: `Fahrt über Grund ${v} kn, Fahrzeit ${t} min. Wie weit kommt das Boot (in sm)?`, soll: Math.round(d * 10) / 10, tol: 0.1, einheit: "sm",
      weg: `Distanz = Fahrt × Zeit ÷ 60 = ${v} × ${t} ÷ 60 = ${d.toFixed(2).replace(".", ",")} sm, also ${String(Math.round(d * 10) / 10).replace(".", ",")} sm` }; }
  const base = rint(0, 2), bmin = rint(0, 11) * 5, jahr0 = rint(2005, 2012), delta = rint(3, 9), jahr = jahr0 + rint(1, 12), ew = Math.random() < 0.7 ? "E" : "W";
  const total = base * 60 + bmin + (jahr - jahr0) * delta;
  return { kind: "mw", frage: `In der Karte steht „${base}°${String(bmin).padStart(2, "0")}'${ew} ${jahr0} (${delta}'${ew})“. Wie groß ist die Missweisung im Jahr ${jahr} in ganzen Grad?`,
    soll: Math.round(total / 60) * (ew === "E" ? 1 : -1), tol: 0, einheit: "°", signed: true,
    weg: `${base * 60 + bmin}' + ${jahr - jahr0} Jahre × ${delta}' = ${total}' = ${(total / 60).toFixed(2).replace(".", ",")}°, gerundet ${Math.round(total / 60)}° ${ew === "E" ? "Ost (+)" : "West (−)"}` };
}
const TRAINER_KINDS = [["mgk", "MgK → rwK"], ["rwk", "rwK → MgK"], ["mw", "Missweisung"], ["zeit", "Zeit"], ["dist", "Distanz"]];
function trainerHTML() {
  const t = navTrainer;
  return `<section class="panel" style="display:grid;gap:12px" id="trainer">
    <div class="row" style="justify-content:space-between"><div class="eyebrow">Rechentrainer</div><span class="muted mono" style="font-size:.85rem">${t.ok} von ${t.n} richtig</span></div>
    <div class="seg" role="group" aria-label="Aufgabenart" style="flex-wrap:wrap">${TRAINER_KINDS.map(([k, l]) => `<button data-tk="${k}" aria-pressed="${t.cur.kind === k}">${l}</button>`).join("")}</div>
    <b>${esc(t.cur.frage)}</b>
    <div class="row" style="align-items:end"><label class="field">Deine Lösung (${t.cur.einheit})<input type="text" id="tans" inputmode="decimal" autocomplete="off" style="width:140px" ${t.done ? "disabled" : ""}></label>
      ${t.done ? `<button class="btn primary" id="tnext">Nächste Aufgabe</button>` : `<button class="btn primary" id="tcheck">Prüfen</button>`}</div>
    ${t.done ? `<div class="trainres ${t.right ? "ok" : "no"}"><b>${t.right ? "Richtig!" : "Leider falsch."}</b> Lösung: ${t.cur.kind === "mgk" || t.cur.kind === "rwk" ? deg3(t.cur.soll) : String(t.cur.soll).replace(".", ",") + " " + t.cur.einheit}<br><span>${esc(t.cur.weg)}</span></div>` : ""}
  </section>`;
}
function wireTrainer(m) {
  const t = navTrainer;
  m.querySelectorAll("[data-tk]").forEach(b => b.onclick = () => { navTrainer.cur = newTrainer(b.dataset.tk); navTrainer.done = false; rerenderTrainer(); });
  if ($("#tcheck")) {
    const check = () => {
      const v = parseFloat($("#tans").value.replace(",", ".").replace(/[^\d.+-]/g, ""));
      if (isNaN(v)) { toast("Bitte eine Zahl eingeben."); return; }
      let diff = Math.abs(v - t.cur.soll);
      if (t.cur.einheit === "°" && !t.cur.signed) diff = Math.min(diff, 360 - diff);
      t.right = diff <= t.cur.tol + 1e-9; t.n++; if (t.right) t.ok++; t.done = true; logDay(); save(); rerenderTrainer();
    };
    $("#tcheck").onclick = check; $("#tans").onkeydown = e => { if (e.key === "Enter") check(); }; $("#tans").focus({ preventScroll: true });
  }
  if ($("#tnext")) { $("#tnext").onclick = () => { t.cur = newTrainer(t.cur.kind); t.done = false; rerenderTrainer(); }; $("#tnext").focus({ preventScroll: true }); }
}
function rerenderTrainer() { const el = $("#trainer"); if (!el) return; el.outerHTML = trainerHTML(); wireTrainer($("#main")); }

function vNav(m) {
  if (!navTrainer) navTrainer = { cur: newTrainer("mgk"), done: false, n: 0, ok: 0 };
  if (navTask) return vNavTask(m);
  const nk = Object.keys(kartenUrls).length;
  m.innerHTML = `<div class="view">
    <div><div class="eyebrow">Kartenaufgabe der Theorieprüfung</div><h2>Navigation</h2></div>
    <section class="panel" style="display:grid;gap:10px">
      <p style="margin:0;max-width:70ch">In der Prüfung bekommst du eine der <b>15 Navigationsaufgaben</b> mit einem Seekartenausschnitt. Von den <b>9 Teilaufgaben</b> müssen <b>7</b> stimmen.
      Löse die Aufgaben auf der ausgedruckten Karte mit Kursdreieck und Zirkel, dann vergleiche hier mit der Lösung.</p>
      <div class="row" style="gap:12px">
        ${nk ? `<span class="pill ok">${nk} Seekarten auf diesem Gerät</span><button class="btn small" id="kdel">Seekarten entfernen</button>`
          : `<button class="btn primary" id="kload">Seekarten aus PDF laden</button><span class="muted" style="font-size:.85rem">Deine Datei „bootspruefung_de_sbfs_karten.pdf“. Die Karten bleiben nur auf diesem Gerät.</span>`}
        <input type="file" id="kfile" accept="application/pdf,.pdf" hidden>
        <span class="muted" id="kstatus">${esc(kartenStatus)}</span>
      </div>
    </section>
    <div class="navgrid">${NAV.map(t => { const r = navRes(t.nr), done = Object.keys(r).length, ok = Object.values(r).filter(Boolean).length;
      return `<button class="panel navcard" data-navtask="${t.nr}">
        <span class="row" style="justify-content:space-between;width:100%"><b>Aufgabe ${t.nr}</b>${done ? `<span class="pill ${ok >= 7 ? "ok" : done === 9 ? "no" : "n"}">${ok} / 9</span>` : `<span class="pill n">offen</span>`}</span>
        <span class="muted">${esc(t.lage[0].slice(0, 110))}${t.lage[0].length > 110 ? " …" : ""}</span>
        ${kartenUrls[t.nr] ? `<span class="muted" style="font-size:.78rem">Seekarte vorhanden</span>` : ""}</button>`; }).join("")}</div>
    <details class="panel grundlagen"><summary><b>Grundlagen und Formeln</b></summary>${GRUNDLAGEN}</details>
    ${trainerHTML()}
  </div>`;
  m.querySelectorAll("[data-navtask]").forEach(b => b.onclick = () => { navTask = +b.dataset.navtask; navShown = {}; render(); window.scrollTo(0, 0); });
  if ($("#kload")) $("#kload").onclick = () => $("#kfile").click();
  $("#kfile").onchange = e => { const f = e.target.files[0]; if (f) importKarten(f); e.target.value = ""; };
  if ($("#kdel")) $("#kdel").onclick = removeKarten;
  wireTrainer(m);
}
function vNavTask(m) {
  const t = NAV.find(x => x.nr === navTask), r = navRes(t.nr);
  const ok = Object.values(r).filter(Boolean).length, done = Object.keys(r).length;
  m.innerHTML = `<div class="view">
    <div class="row" style="justify-content:space-between"><div><div class="eyebrow">Navigationsaufgabe ${t.nr} von 15</div><h2>Ausgangslage</h2></div>
      <span class="row"><button class="btn small" id="navpdf">Aufgabenblatt als PDF</button><button class="btn small" id="navback">Alle Aufgaben</button></span></div>
    <section class="panel navlage">
      <div style="display:grid;gap:8px;min-width:0">${t.lage.map(p => `<p style="margin:0">${esc(p)}</p>`).join("")}</div>
      ${kartenUrls[t.nr] ? `<button class="mapthumb" id="navmap"><img src="${kartenUrls[t.nr]}" alt="Seekarte ${t.nr}"><span>Seekarte groß öffnen</span></button>`
        : `<p class="muted" style="margin:0;font-size:.85rem">Nimm die ausgedruckte Seekarte ${t.nr}. Unter „Alle Aufgaben“ kannst du die Karten aus deiner PDF in die App laden.</p>`}
    </section>
    ${t.teile.map(te => { const shown = navShown[te.nr] || r[te.nr] !== undefined; return `<section class="panel navpart" style="display:grid;gap:10px">
      <div class="row" style="justify-content:space-between"><b>Teilaufgabe ${te.nr}</b>${r[te.nr] !== undefined ? `<span class="pill ${r[te.nr] ? "ok" : "no"}">${r[te.nr] ? "richtig" : "falsch"}</span>` : ""}</div>
      <p style="margin:0">${esc(te.frage)}</p>
      ${shown ? `<div class="navans"><span class="note-l">Lösung</span>${te.antwort.map(a => `<div>${esc(a)}</div>`).join("")}
          ${te.seite ? `<div class="muted" style="font-size:.82rem;margin-top:6px">Ausführlicher Lösungsweg: Seite ${te.seite} in deiner PDF „${LOES_PDF}“</div>` : ""}</div>
        <div class="row"><span class="muted" style="font-size:.85rem">Hattest du es richtig?</span>
          <button class="btn small ${r[te.nr] === true ? "good" : ""}" data-navok="${te.nr}">✓ Richtig</button>
          <button class="btn small ${r[te.nr] === false ? "bad" : ""}" data-navno="${te.nr}">✗ Falsch</button></div>`
        : `<div class="row"><button class="btn" data-navshow="${te.nr}">Lösung zeigen</button></div>`}
    </section>`; }).join("")}
    <section class="panel row" style="justify-content:space-between">
      <div><span class="big mono" style="font-size:2rem">${ok} / 9</span> <span class="muted">${done < 9 ? `richtig · noch ${9 - done} offen` : ok >= 7 ? "bestanden (ab 7)" : "nicht bestanden (ab 7)"}</span></div>
      <span class="row"><button class="btn" id="navreset">Neu beginnen</button>${t.nr < 15 ? `<button class="btn primary" id="navnext">Aufgabe ${t.nr + 1} ›</button>` : ""}</span>
    </section>
  </div>`;
  $("#navback").onclick = () => { navTask = null; render(); };
  if ($("#navmap")) $("#navmap").onclick = () => openMap(t.nr);
  $("#navpdf").onclick = () => navPdf(t);
  m.querySelectorAll("[data-navshow]").forEach(b => b.onclick = () => { navShown[b.dataset.navshow] = true; const y = window.scrollY; render(); window.scrollTo(0, y); });
  m.querySelectorAll("[data-navok],[data-navno]").forEach(b => b.onclick = () => { const y = window.scrollY; setNavRes(t.nr, b.dataset.navok || b.dataset.navno, !!b.dataset.navok); render(); window.scrollTo(0, y); });
  $("#navreset").onclick = () => { const nav = Object.assign({}, P.nav); nav[t.nr] = { r: {}, t: Date.now() }; P.nav = nav; save(); navShown = {}; render(); window.scrollTo(0, 0); };
  if ($("#navnext")) $("#navnext").onclick = () => { navTask = t.nr + 1; navShown = {}; render(); window.scrollTo(0, 0); };
}
// Aufgabenblatt: Seite 1 Aufgaben mit Platz für den Lösungsweg, Seite 2 die Lösungen
async function navPdf(t) {
  toast("PDF wird erstellt …");
  try { await loadJsPDF(); } catch (e) { toast("PDF-Baustein konnte nicht geladen werden. Bist du online?"); return; }
  const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" }), M = 15, W = 180, LH = 4.6;
  let y = M;
  const text = (s, size, bold, indent = 0) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); const l = doc.splitTextToSize(s, W - indent); if (y + l.length * LH > 282) { doc.addPage(); y = M; } doc.text(l, M + indent, y + 3.5); y += l.length * LH; };
  text(`Navigationsaufgabe ${t.nr} von 15 · SBF-See`, 14, true); y += 3;
  t.lage.forEach(p => { text(p, 10.5, false); y += 1.5; });
  y += 2;
  for (const te of t.teile) {
    if (y > 250) { doc.addPage(); y = M; }
    text(`${te.nr}. ${te.frage}`, 10.5, true); y += 1;
    doc.setDrawColor(190); for (let i = 0; i < 2; i++) { doc.line(M + 5, y + 5, M + W, y + 5); y += 7; } doc.setDrawColor(0); y += 2;
  }
  text("Mindestens 7 von 9 Teilaufgaben müssen richtig sein. Schreibe immer den Lösungsweg dazu.", 9, false);
  doc.addPage(); y = M;
  text(`Lösungen zu Navigationsaufgabe ${t.nr}`, 14, true); y += 3;
  for (const te of t.teile) { text(`${te.nr}. ${te.frage}`, 9.5, false); text(te.antwort.join(" · "), 10.5, true, 5); y += 2; }
  const blob = doc.output("blob"), filename = `Navigationsaufgabe-${t.nr}.pdf`;
  if (IN_ARTIFACT) { const dl = await claude.use("downloads").catch(() => null); if (!dl) { toast("Speichern ist in dieser Ansicht nicht möglich."); return; } try { await dl.save({ filename, data: blob }); toast("PDF gespeichert"); } catch (e) { toast("Speichern abgebrochen"); } return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast("PDF gespeichert");
}

/* ---------- Praxis: Manöver-Simulator ----------
   Vereinfachtes Motorboot (8 m, rechtsdrehende Schraube) von oben gesehen. Wichtigste Lernpunkte:
   - Das Ruder bleibt stehen, wo du es hinstellst. Das Boot dreht verzögert und dreht weiter, solange Ruder liegt.
   - Rechtzeitig mittschiffs und kurz Gegenruder geben, sonst schießt man über den Kurs hinaus („Rumeiern“).
   - Das Boot dreht um einen Punkt im vorderen Drittel: das Heck schwenkt weit aus.
   - Rückwärts zieht der Radeffekt das Heck nach Backbord; bei wenig Fahrt wirkt das Ruder kaum. */
const SIM = { L: 8, B: 2.8, PIVOT: 0.3, RUD_MAX: 35, RUD_RATE: 22 };
const D2R = Math.PI / 180, R2D = 180 / Math.PI, KN = 1.9438;
const norm360 = a => ((a % 360) + 360) % 360;
const angDiff = (a, b) => { let d = norm360(a - b); return d > 180 ? d - 360 : d; };
const THROTTLE = { "-2": "Zurück 2", "-1": "Zurück 1", "0": "Neutral", "1": "Voraus 1", "2": "Voraus 2", "3": "Voraus 3" };

const SCENARIOS = [
  { id: "kurs", title: "Kurs ändern und halten", kurz: "Gegen das Rumeiern: rechtzeitig Ruder mittschiffs und Gegenruder.",
    brief: [
      "Du fährst mit 5 kn Kurs 000°. Ändere den Kurs auf <b>090°</b> und halte ihn 20 Sekunden lang auf ±5° genau.",
      "<b>So geht's:</b> Ruder nach Steuerbord legen. Das Boot beginnt erst nach einem Moment zu drehen, dann aber immer schneller.",
      "<b>Etwa 15–20° vor dem Zielkurs</b> das Ruder zurück auf <b>mittschiffs</b> (Anzeige grün). Das Boot dreht trotzdem noch weiter!",
      "Dreht es zu weit, <b>kurz</b> Gegenruder geben und gleich wieder mittschiffs. Kleine Ruderbewegungen, dann abwarten.",
      "Achte auf die <b>Drehrate</b>: Sie zeigt, wie schnell sich das Boot gerade dreht. Der orange Pfeil zeigt, wo der Bug in 3 Sekunden steht."],
    start: { x: 0, y: 0, psi: 0, u: 2.6, T: 2 }, view: 110, follow: true, target: 90 },
  { id: "aufstoppen", title: "Kursgerecht aufstoppen", kurz: "Anhalten, ohne vom Kurs abzukommen.",
    brief: [
      "Du fährst mit etwa 5 kn genau auf der gestrichelten Kurslinie. Bringe das Boot <b>zwischen den beiden gelben Tonnen</b> zum Stehen.",
      "Dabei soll der Bug auf dem Kurs bleiben (±10°) und das Boot nicht mehr als 4 m neben der Linie stehen.",
      "<b>So geht's:</b> Rechtzeitig auf Neutral, Fahrt auslaufen lassen, dann <b>Ruder mittschiffs</b> und <b>kurz und dosiert rückwärts</b> einkuppeln.",
      "Rückwärts zieht der <b>Radeffekt</b> das Heck nach Backbord, der Bug wandert nach Steuerbord. Deshalb nur kurz rückwärts und mit wenig Gas. Bei wenig Fahrt hilft das Ruder kaum."],
    start: { x: 0, y: 0, psi: 0, u: 2.5, T: 2 }, view: 90, follow: true, zone: { y1: 70, y2: 82, x: 4 } },
  { id: "anlegen", title: "Anlegen (Backbord an den Steg)", kurz: "Spitzer Winkel, wenig Fahrt, rückwärts aufstoppen.",
    brief: [
      "Lege mit der <b>Backbordseite</b> am Steg an, im grün markierten Liegeplatz.",
      "<b>So geht's:</b> Mit wenig Fahrt (Voraus 1) in einem <b>spitzen Winkel von etwa 20–30°</b> auf den Liegeplatz zufahren.",
      "Kurz vor dem Steg auf Neutral, Ruder nach <b>Steuerbord</b>, damit der Bug parallel zum Steg schwenkt. Dann <b>kurz rückwärts</b>: Das stoppt das Boot, und der Radeffekt zieht das Heck nach Backbord an den Steg.",
      "Ziel: parallel zum Steg (±12°), höchstens 1 m Abstand, Fahrt unter 0,3 kn. Anstoßen mit mehr als 1 kn zählt als Rumms."],
    start: { x: 22, y: -24, psi: 345, u: 1.0, T: 1 }, view: 80, follow: false, center: { x: 6, y: 4 },
    piers: [{ x1: -8, x2: 0, y1: -10, y2: 40 }], berth: { y1: 12, y2: 26 },
    moored: [{ x: 1.5, y: 33, psi: 0 }, { x: 1.5, y: 3, psi: 0 }] },
  { id: "ablegen", title: "Ablegen (Heck rauskurbeln)", kurz: "Ruder hart Bb, im Wechsel kurz voraus und zurück bis 45°, dann rückwärts raus.",
    brief: [
      "Du liegst mit Backbord am Steg, vor und hinter dir liegen andere Boote. Fahre hinaus, bis du <b>15 m vom Steg</b> entfernt bist, ohne anzustoßen.",
      "<b>So wie in deiner Fahrstunde:</b> 1. Ruder <b>hart Backbord</b> (zum Steg) und dort lassen.",
      "2. <b>Kurz Voraus 1</b>: Der Schraubenstrom trifft das Ruder, das Heck wird nach Steuerbord vom Steg weggedrückt, bevor das Boot Fahrt aufnimmt.",
      "3. <b>Direkt Zurück 1</b> und kurz warten: Das stoppt die Vorausfahrt. Solange das Heck noch seitlich weggeht, warten. Sobald es anfängt nach hinten zu fahren, wieder <b>kurz voraus</b>.",
      "4. So im Wechsel, bis das Boot etwa <b>45° vom Steg</b> weg zeigt (oben steht der Winkel). Dann <b>Ruder mittschiffs</b> und <b>rückwärts heraus</b>, bis du 15 m Abstand hast.",
      "Der Bug darf dabei am Steg anliegen, dort hängt in echt ein Fender. Nur zu viel Gas führt zum Rumms. Die Drehrichtung der Schraube (unten) bestimmt, wohin das Heck rückwärts zieht."],
    start: { x: 1.5, y: 18, psi: 0, u: 0, T: 0 }, view: 60, follow: false, center: { x: 10, y: 16 },
    piers: [{ x1: -8, x2: 0, y1: -10, y2: 45 }],
    moored: [{ x: 1.5, y: 29, psi: 0 }, { x: 1.5, y: 5, psi: 0 }], leave: 15 },
  { id: "mob", title: "Mensch über Bord", kurz: "Heck weg von der Person, Kreis fahren, mit Neutral ankommen.",
    brief: [
      "Du fährst mit 6 kn geradeaus. Irgendwann fällt eine Person über Bord. Die Seite wird angesagt.",
      "<b>Sofort</b> das Ruder <b>zur Seite der Person</b> legen: So schwenkt das Heck mit der Schraube von ihr weg. (In echt zusätzlich: „Mensch über Bord“ rufen, Rettungsring werfen, Person nicht aus den Augen lassen.)",
      "Dann in einem Kreis zurückfahren und <b>langsam</b> an die Person heranfahren. Kommt die Schraube der Person näher als 4 m, während sie dreht, ist das lebensgefährlich.",
      "Ziel: Person höchstens 3 m neben dem Boot, Fahrt unter 0,5 kn und <b>Schalthebel auf Neutral</b>."],
    start: { x: 0, y: 0, psi: 0, u: 3.0, T: 3 }, view: 130, follow: true }
];

let sim = null, simPick = null, simLoop = 0, simHelp = true, simBest = {};
try { simBest = JSON.parse(localStorage.getItem("sbfsee-simbest") || "{}"); simHelp = localStorage.getItem("sbfsee-simhelp") !== "0"; } catch (e) {}

/* Wind und Strömung: einstellbar, Richtung fest oder zufällig */
const WIND_LEVELS = [["0", "Kein Wind", 0], ["6", "Leicht (6 kn, Bft 2)", 6], ["12", "Mittel (12 kn, Bft 4)", 12], ["18", "Frisch (18 kn, Bft 5)", 18]];
const CUR_LEVELS = [["0", "Keine Strömung", 0], ["0.5", "0,5 kn", 0.5], ["1", "1 kn", 1], ["1.5", "1,5 kn", 1.5]];
const DIRS = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
let simEnv = { wind: "0", windDir: "zufall", cur: "0", curDir: "zufall", prop: "rechts" };
try { Object.assign(simEnv, JSON.parse(localStorage.getItem("sbfsee-simenv") || "{}")); } catch (e) {}
const dirName = deg => DIRS[Math.round(norm360(deg) / 45) % 8];
function makeEnv() {
  const pick = d => d === "zufall" ? Math.floor(Math.random() * 8) * 45 : DIRS.indexOf(d) * 45;
  const w = WIND_LEVELS.find(x => x[0] === simEnv.wind) || WIND_LEVELS[0], c = CUR_LEVELS.find(x => x[0] === simEnv.cur) || CUR_LEVELS[0];
  // Wind kommt AUS windFrom, Strömung setzt NACH curTo (beides in Grad)
  return { windKn: w[2], windFrom: pick(simEnv.windDir), curKn: c[2], curTo: pick(simEnv.curDir) };
}
function envText(env) {
  const p = [];
  if (env.windKn) p.push(`Wind ${env.windKn} kn aus ${dirName(env.windFrom)}`);
  if (env.curKn) p.push(`Strom ${String(env.curKn).replace(".", ",")} kn nach ${dirName(env.curTo)}`);
  return p.join(" · ");
}
// Versatz über Grund durch Wind (Abdrift) und Strömung in m/s
function envDrift(env, factor = 1) {
  const W = env.windKn / KN, down = (env.windFrom + 180) * D2R, cs = env.curKn / KN, to = env.curTo * D2R, wd = 0.009 * W * W * factor;
  return [Math.sin(down) * wd + Math.sin(to) * cs, Math.cos(down) * wd + Math.cos(to) * cs];
}

function newSim(sc) {
  const s = sc.start;
  const st = {
    sc, t: 0, done: null, steer: 0, lastSteer: 0, wheelChanges: 0, contacts: 0, hardHit: false, inContact: false,
    b: { x: s.x, y: s.y, psi: s.psi * D2R, u: s.u, r: 0, delta: 0, T: s.T, thr: s.T },
    prop: simEnv.prop === "links" ? -1 : 1,
    trail: [], msg: "", hold: 0, stats: {}, env: makeEnv(), drift: [0, 0]
  };
  if (sc.id === "kurs") Object.assign(st.stats, { reached: false, maxOver: 0, inBand: 0, crossings: 0, lastSign: 0 });
  if (sc.id === "mob") Object.assign(st.stats, { fallAt: 4 + Math.random() * 5, side: Math.random() < 0.5 ? 1 : -1, person: null, reactAt: null, propDanger: false, minDist: 1e9 });
  return st;
}

/* Rumpf relativ zum Drehpunkt (vorne x = quer nach Steuerbord, y = voraus) */
function hullLocal() {
  const L = SIM.L, B = SIM.B / 2, f = SIM.PIVOT * L, a = L - f;
  return [[0, f], [B, f - 1.6], [B, -a], [-B, -a], [-B, f - 1.6]];
}
const fwd = psi => [Math.sin(psi), Math.cos(psi)], stb = psi => [Math.cos(psi), -Math.sin(psi)];
function toWorld(b, p) { const f = fwd(b.psi), s = stb(b.psi); return [b.x + p[0] * s[0] + p[1] * f[0], b.y + p[0] * s[1] + p[1] * f[1]]; }
function pointVel(b, w, drift = [0, 0]) { const f = fwd(b.psi), ox = w[0] - b.x, oy = w[1] - b.y; return [b.u * f[0] + b.r * oy + drift[0], b.u * f[1] - b.r * ox + drift[1]]; }

function simStep(st, dt) {
  const b = st.b, sc = st.sc;
  // Ruder: bleibt stehen, wo es hingelegt wird
  if (st.wheel === undefined) { st.wheel = 0; st.prevWheel = 0; st.lastDir = 0; }
  if (st.steer) st.wheel = Math.max(-WHEEL_MAX, Math.min(WHEEL_MAX, st.wheel + st.steer * 160 * dt));
  const dw = st.wheel - st.prevWheel;
  if (Math.abs(dw) > 0.3) { const dir = Math.sign(dw); if (st.lastDir && dir !== st.lastDir) st.wheelChanges++; st.lastDir = dir; }
  st.prevWheel = st.wheel;
  const want = st.wheel / WHEEL_MAX * SIM.RUD_MAX;
  b.delta += Math.max(-45 * dt, Math.min(45 * dt, want - b.delta));
  // Längsfahrt: Schub minus Widerstand
  // Schub folgt dem Hebel mit kurzer Verzögerung (Getriebe, Drehzahl); rückwärts zieht die Schraube schwächer
  if (b.thr === undefined) b.thr = b.T;
  b.thr += (b.T - b.thr) * Math.min(1, dt / 0.4);
  const a = b.thr > 0 ? b.thr * 0.25 : b.thr * 0.16;
  b.u += (a - 0.05 * b.u - 0.07 * b.u * Math.abs(b.u)) * dt;
  // Drehung: Ruderwirkung braucht Anströmung (Fahrt oder Schraubenstrahl voraus)
  // Schraubenstrom voraus trifft das Ruder: wirkt auch aus dem Stand kräftig („Ruder anblasen“), bei Fahrt weniger zusätzlich
  const flow = b.u + (b.thr > 0 ? 1.4 * b.thr / (1 + Math.abs(b.u)) : 0);
  // Radeffekt rückwärts: aus dem Stand stark (Heck geht seitlich weg), mit zunehmender Fahrt achteraus schwächer.
  // Rechtsdrehende Schraube: Heck nach Backbord (Bug nach Steuerbord); linksdrehend umgekehrt.
  const walk = b.thr < 0 ? -0.085 * b.thr * (st.prop || 1) * Math.exp(-2 * Math.abs(b.u)) : 0;
  // Wind dreht den Bug nach Lee (stärker, wenn das Boot langsam ist)
  const env = st.env || { windKn: 0, curKn: 0 }, Wms = env.windKn / KN;
  const windYaw = Wms ? 0.0005 * Wms * Wms * Math.sin((env.windFrom + 180) * D2R - b.psi) / (1 + b.u * b.u) : 0;
  b.r += (0.06 * (b.delta * D2R) * flow + walk + windYaw - 0.5 * b.r) * dt;
  b.psi += b.r * dt;
  // Abdrift: bei Fahrt etwas weniger, weil der Rumpf seitlich „greift“
  st.drift = env.windKn || env.curKn ? envDrift(env, 1 / (1 + 0.6 * Math.abs(b.u))) : [0, 0];
  const f = fwd(b.psi); b.x += (b.u * f[0] + st.drift[0]) * dt; b.y += (b.u * f[1] + st.drift[1]) * dt;
  st.t += dt;
  // Kontakt mit Steg und anderen Booten
  let touching = false;
  const obstacles = (sc.piers || []).map(p => ({ type: "rect", ...p })).concat((sc.moored || []).map(m => ({ type: "boat", m })));
  for (const lp of hullLocal()) {
    const w = toWorld(b, lp);
    for (const o of obstacles) {
      const hit = o.type === "rect" ? rectHit(o, w) : boatHit(o.m, w);
      if (!hit) continue;
      touching = true;
      const v = pointVel(b, w, st.drift), vn = -(v[0] * hit.n[0] + v[1] * hit.n[1]);
      if (vn > 0.5) st.hardHit = true;
      b.x += hit.n[0] * hit.pen; b.y += hit.n[1] * hit.pen;
      b.u *= 0.995;
    }
  }
  // Ein Anstoßen zählt nur einmal, auch wenn der Rumpf kurz hintereinander mehrmals berührt
  if (touching && !st.inContact && st.t - (st.lastTouch || -9) > 1) st.contacts++;
  if (touching) st.lastTouch = st.t;
  st.inContact = touching;
  if (!st.trail.length || Math.hypot(st.trail.at(-1)[0] - b.x, st.trail.at(-1)[1] - b.y) > 1.2) { st.trail.push([b.x, b.y]); if (st.trail.length > 400) st.trail.shift(); }
  CHECKS[sc.id](st, dt);
}
function rectHit(o, w) {
  if (w[0] < o.x1 || w[0] > o.x2 || w[1] < o.y1 || w[1] > o.y2) return null;
  const d = [[w[0] - o.x1, [-1, 0]], [o.x2 - w[0], [1, 0]], [w[1] - o.y1, [0, -1]], [o.y2 - w[1], [0, 1]]].sort((a, b) => a[0] - b[0])[0];
  return { pen: d[0] + 0.01, n: d[1] };
}
function boatHit(m, w) {
  // anderes Boot als Rechteck in dessen Längsrichtung (liegt parallel zum Steg)
  return rectHit({ x1: m.x - SIM.B / 2, x2: m.x + SIM.B / 2, y1: m.y - SIM.L / 2, y2: m.y + SIM.L / 2 }, w);
}

/* Auswertung je Übung: setzt st.msg (Hinweis) und st.done = { ok, text, tips[] } */
const CHECKS = {
  kurs(st, dt) {
    const s = st.stats, err = angDiff(st.b.psi * R2D, st.sc.target);
    if (!s.reached && Math.abs(err) < 5) s.reached = true;
    if (s.reached) {
      s.maxOver = Math.max(s.maxOver, err);
      const sign = Math.sign(Math.round(err));
      if (sign && s.lastSign && sign !== s.lastSign && Math.abs(err) > 2) s.crossings++;
      if (sign) s.lastSign = sign;
      s.inBand = Math.abs(err) <= 5 ? s.inBand + dt : 0;
    }
    st.msg = !s.reached ? `Noch ${Math.abs(Math.round(err))}° bis 090°` : Math.abs(err) <= 5 ? `Kurs halten … ${Math.max(0, 20 - s.inBand).toFixed(0)} s` : `Abweichung ${Math.round(err) > 0 ? "+" : ""}${Math.round(err)}°`;
    if (s.inBand >= 20) {
      const tips = [];
      if (s.maxOver > 10) tips.push(`Du bist bis zu ${Math.round(s.maxOver)}° über den Zielkurs hinausgedreht. Ruder früher auf mittschiffs, etwa 15–20° vor dem Ziel.`);
      if (st.wheelChanges > 6) tips.push(`${st.wheelChanges} Ruderwechsel: Das ist das Rumeiern. Kleine Ruderbewegung, dann 2–3 Sekunden abwarten, was das Boot macht.`);
      if (!tips.length) tips.push("Sauber gesteuert: wenig Überschießen und ruhige Ruderbewegungen.");
      st.done = { ok: true, text: `Kurs 090° gehalten nach ${Math.round(st.t)} s`, tips, score: Math.round(st.t) };
    }
    if (st.t > 150) st.done = { ok: false, text: "Zeit abgelaufen", tips: ["Achte auf die Drehrate: Wenn sie zum Ziel hin noch hoch ist, jetzt schon Ruder mittschiffs."] };
  },
  aufstoppen(st) {
    const b = st.b, z = st.sc.zone, kn = Math.abs(b.u) * KN, err = angDiff(b.psi * R2D, 0);
    st.msg = b.y < z.y1 - 40 ? "Weiter auf die gelben Tonnen zu" : b.y < z.y1 ? `Noch ${Math.round(z.y1 - b.y)} m bis zur Stoppzone` : b.y <= z.y2 ? `In der Zone: ${kn.toFixed(1).replace(".", ",")} kn` : "Über die Zone hinaus";
    if (Math.abs(b.u) < 0.05 && b.y > 20) {
      const inZone = b.y >= z.y1 && b.y <= z.y2, onLine = Math.abs(b.x) <= z.x, straight = Math.abs(err) <= 10;
      const tips = [];
      if (!inZone) tips.push(b.y < z.y1 ? "Zu früh gestoppt: länger auslaufen lassen." : "Zu spät: Früher auf Neutral, dann rechtzeitig kurz rückwärts.");
      if (!straight) tips.push(`Der Bug ist ${Math.round(Math.abs(err))}° vom Kurs abgedreht. Rückwärts nur kurz und mit wenig Gas, Ruder mittschiffs.`);
      if (!onLine) tips.push(`Du stehst ${Math.abs(b.x).toFixed(1).replace(".", ",")} m neben der Kurslinie.`);
      const ok = inZone && onLine && straight;
      if (ok) tips.push("Gut aufgestoppt: auf Position, auf Kurs, ohne Abdrehen.");
      st.done = { ok, text: ok ? `Aufgestoppt nach ${Math.round(st.t)} s` : "Nicht ganz kursgerecht", tips, score: ok ? Math.round(st.t) : null };
    }
    if (b.y > z.y2 + 40 || st.t > 150) st.done = { ok: false, text: "Über die Stoppzone hinaus", tips: ["Rechtzeitig auf Neutral gehen: Ein Boot hat keine Bremse und läuft lange aus."] };
  },
  anlegen(st, dt) {
    const b = st.b, sc = st.sc, kn = Math.abs(b.u) * KN, err = angDiff(b.psi * R2D, 0);
    const xs = hullLocal().map(p => toWorld(b, p)), minX = Math.min(...xs.map(p => p[0])), cy = b.y - (SIM.L / 2 - SIM.PIVOT * SIM.L) * Math.cos(b.psi);
    const good = Math.abs(err) <= 12 && minX <= 1.0 && kn < 0.3 && Math.abs(b.r) < 0.03 && cy >= sc.berth.y1 && cy <= sc.berth.y2;
    st.hold = good ? st.hold + dt : 0;
    st.msg = st.hardHit ? "Rumms! Zu schnell an den Steg." : good ? "Liegt gut … halten" : `Abstand ${Math.max(0, minX).toFixed(1).replace(".", ",")} m · Winkel ${Math.round(Math.abs(err))}° · ${kn.toFixed(1).replace(".", ",")} kn`;
    if (st.hardHit) st.done = { ok: false, text: "Zu hart angelegt", tips: ["Langsamer anfahren (Voraus 1, dann Neutral) und mit kurzem Rückwärts aufstoppen, bevor der Rumpf den Steg berührt."] };
    else if (st.hold > 1.5) st.done = { ok: true, text: `Angelegt nach ${Math.round(st.t)} s`, tips: [st.contacts > 2 ? "Angelegt, aber mehrmals am Steg angestoßen. Etwas früher aufstoppen." : "Sauber angelegt."], score: Math.round(st.t) };
    else if (st.t > 180) st.done = { ok: false, text: "Zeit abgelaufen", tips: ["Spitzer Anlaufwinkel (20–30°), wenig Fahrt, kurz vor dem Steg Ruder Steuerbord und kurz rückwärts."] };
  },
  ablegen(st) {
    const b = st.b, minX = Math.min(...hullLocal().map(p => toWorld(b, p)[0])), ang = Math.round(Math.abs(angDiff(b.psi * R2D, 0)));
    st.msg = st.hardHit ? "Rumms!" : `Winkel zum Steg ${ang}° · Abstand ${minX.toFixed(1).replace(".", ",")} m`;
    if (st.hardHit) st.done = { ok: false, text: "Zu hart angestoßen", tips: ["Nur kurz und mit wenig Gas einkuppeln (Voraus 1 / Zurück 1). Das Boot soll sich drehen, nicht Fahrt aufnehmen."] };
    else if (minX >= st.sc.leave) st.done = { ok: true, text: `Abgelegt nach ${Math.round(st.t)} s`,
      tips: [st.contacts ? "Der Bug lag beim Rauskurbeln am Steg an. Das ist normal, dafür hängt dort ein Fender." : "Sauber abgelegt, ohne Berührung.", "Merke: Heck rauskurbeln bis etwa 45°, dann rückwärts heraus."], score: Math.round(st.t) };
    else if (st.t > 180) st.done = { ok: false, text: "Zeit abgelaufen", tips: ["Ruder hart Backbord lassen, dann im Wechsel kurz Voraus 1 und Zurück 1, bis das Heck etwa 45° vom Steg weg zeigt. Dann Ruder mittschiffs und rückwärts heraus."] };
  },
  mob(st, dt) {
    const s = st.stats, b = st.b;
    if (!s.person && st.t >= s.fallAt) {
      const off = toWorld(b, [s.side * (SIM.B / 2 + 0.8), -1]);
      s.person = { x: off[0], y: off[1] }; s.fellAt = st.t;
    }
    if (!s.person) { st.msg = "Geradeaus fahren und aufpassen …"; return; }
    if (st.env.windKn || st.env.curKn) { const pd = envDrift(st.env, 0.25); s.person.x += pd[0] * dt; s.person.y += pd[1] * dt; }
    if (s.reactAt === null && Math.sign(b.delta) === s.side && Math.abs(b.delta) >= 15) s.reactAt = st.t - s.fellAt;
    const stern = toWorld(b, [0, -(SIM.L - SIM.PIVOT * SIM.L)]);
    const dStern = Math.hypot(stern[0] - s.person.x, stern[1] - s.person.y);
    if (dStern < 4 && b.T !== 0) s.propDanger = true;
    const hull = hullLocal().map(p => toWorld(b, p));
    const dHull = Math.min(...hull.map(p => Math.hypot(p[0] - s.person.x, p[1] - s.person.y)));
    s.minDist = Math.min(s.minDist, dHull);
    const kn = Math.abs(b.u) * KN, sideName = s.side > 0 ? "Steuerbord" : "Backbord";
    st.msg = st.t - s.fellAt < 4 ? `MENSCH ÜBER BORD an ${sideName}!` : `Person ${dHull.toFixed(0)} m entfernt · ${kn.toFixed(1).replace(".", ",")} kn`;
    if (s.propDanger) { st.done = { ok: false, text: "Schraube zu nah an der Person", tips: ["Nie mit drehender Schraube nah an die Person. Ruder sofort zur Seite der Person, später mit Neutral heranfahren."] }; return; }
    if (dHull <= 3 && kn < 0.5 && b.T === 0) {
      const tips = [];
      if (s.reactAt === null || s.reactAt > 3) tips.push(`Das Ruder ging ${s.reactAt === null ? "nicht" : "erst nach " + s.reactAt.toFixed(1).replace(".", ",") + " s"} zur Seite der Person. Ziel: sofort, damit das Heck wegschwenkt.`);
      else tips.push(`Schnell reagiert: Ruder nach ${s.reactAt.toFixed(1).replace(".", ",")} s zur richtigen Seite.`);
      tips.push("Person sicher erreicht, Schalthebel auf Neutral.");
      st.done = { ok: true, text: `Person erreicht nach ${Math.round(st.t - s.fellAt)} s`, tips, score: Math.round(st.t - s.fellAt) };
    }
    if (st.t - s.fellAt > 180) st.done = { ok: false, text: "Zeit abgelaufen", tips: ["Ruder zur Seite der Person, Kreis fahren, mit wenig Fahrt zurück und rechtzeitig auf Neutral."] };
  }
};

/* Zeichnen */
function simDraw(cv, st, opt = {}) {
  const ctx = cv.getContext("2d"), W = cv.width, H = cv.height, dpr = window.devicePixelRatio || 1, sc = st.sc, b = st.b;
  const view = opt.view || sc.view, follow = opt.follow != null ? opt.follow : sc.follow;
  const scale = Math.min(W, H) / view;
  const cx = follow ? b.x : sc.center.x, cy = follow ? b.y : sc.center.y;
  const X = x => W / 2 + (x - cx) * scale, Y = y => H / 2 - (y - cy) * scale;
  ctx.fillStyle = "#1d5f86"; ctx.fillRect(0, 0, W, H);
  // Raster, damit man Fahrt und Drehung sieht
  ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.lineWidth = 1;
  const g = 10, x0 = Math.floor((cx - W / 2 / scale) / g) * g, y0 = Math.floor((cy - H / 2 / scale) / g) * g;
  for (let x = x0; x < cx + W / 2 / scale; x += g) { ctx.beginPath(); ctx.moveTo(X(x), 0); ctx.lineTo(X(x), H); ctx.stroke(); }
  for (let y = y0; y < cy + H / 2 / scale; y += g) { ctx.beginPath(); ctx.moveTo(0, Y(y)); ctx.lineTo(W, Y(y)); ctx.stroke(); }
  // Kurslinie / Zone
  if (sc.id === "aufstoppen") {
    ctx.setLineDash([8 * dpr, 8 * dpr]); ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.beginPath(); ctx.moveTo(X(0), Y(-200)); ctx.lineTo(X(0), Y(400)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,214,0,.15)"; ctx.fillRect(X(-sc.zone.x), Y(sc.zone.y2), 2 * sc.zone.x * scale, (sc.zone.y2 - sc.zone.y1) * scale);
    for (const yy of [sc.zone.y1, sc.zone.y2]) for (const xx of [-sc.zone.x - 2, sc.zone.x + 2]) buoy(ctx, X(xx), Y(yy), 0.9 * scale, "#ffd600");
  }
  if (sc.id === "kurs") {
    ctx.save(); ctx.translate(X(b.x), Y(b.y)); ctx.rotate(sc.target * D2R);
    ctx.setLineDash([6 * dpr, 6 * dpr]); ctx.strokeStyle = "rgba(120,255,160,.6)"; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -H); ctx.stroke(); ctx.restore(); ctx.setLineDash([]);
  }
  // Steg, Liegeplatz, andere Boote
  for (const p of sc.piers || []) { ctx.fillStyle = "#8a6a45"; ctx.fillRect(X(p.x1), Y(p.y2), (p.x2 - p.x1) * scale, (p.y2 - p.y1) * scale); ctx.fillStyle = "#6f5436"; for (let y = p.y1; y < p.y2; y += 1.2) ctx.fillRect(X(p.x1), Y(y), (p.x2 - p.x1) * scale, 1); }
  if (sc.berth) { ctx.fillStyle = "rgba(80,220,120,.25)"; ctx.fillRect(X(0), Y(sc.berth.y2), 3.5 * scale, (sc.berth.y2 - sc.berth.y1) * scale); }
  for (const mb of sc.moored || []) drawBoat(ctx, X, Y, scale, { x: mb.x, y: mb.y + (SIM.L / 2 - SIM.PIVOT * SIM.L), psi: mb.psi * D2R, delta: 0 }, "#cfd8dc", "#90a4ae");
  // Kielwasser
  ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1.5 * dpr; ctx.beginPath();
  st.trail.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.lineTo(X(b.x), Y(b.y)); ctx.stroke();
  // Person im Wasser
  if (sc.id === "mob" && st.stats.person) {
    const p = st.stats.person, px = X(p.x), py = Y(p.y);
    ctx.fillStyle = "#ff6d00"; ctx.beginPath(); ctx.arc(px, py, Math.max(5 * dpr, 0.9 * scale), 0, 7); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.arc(px, py, Math.max(9 * dpr, 1.6 * scale), 0, 7); ctx.stroke();
    if (px < 0 || px > W || py < 0 || py > H) { // Richtung zur Person am Rand
      const ang = Math.atan2(py - H / 2, px - W / 2), rr = Math.min(W, H) / 2 - 20 * dpr;
      ctx.fillStyle = "#ff6d00"; ctx.beginPath(); ctx.arc(W / 2 + Math.cos(ang) * rr, H / 2 + Math.sin(ang) * rr, 7 * dpr, 0, 7); ctx.fill();
    }
  }
  // Vorschau: wo zeigt der Bug in 3 s?
  if (simHelp) {
    const pre = b.psi + b.r * 3, len = SIM.L * 2.2 * scale;
    ctx.strokeStyle = "rgba(255,160,60,.9)"; ctx.lineWidth = 2.5 * dpr; ctx.beginPath(); ctx.moveTo(X(b.x), Y(b.y)); ctx.lineTo(X(b.x) + Math.sin(pre) * len, Y(b.y) - Math.cos(pre) * len); ctx.stroke();
  }
  drawBoat(ctx, X, Y, scale, b, "#ffffff", "#0f2a3f");
  // Wind- und Strömungspfeil oben rechts
  const arrow = (ox, deg, color, label) => { const a = deg * D2R, l = 16 * dpr; ctx.save(); ctx.translate(ox, 30 * dpr); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3 * dpr;
    ctx.beginPath(); ctx.moveTo(-Math.sin(a) * l, Math.cos(a) * l); ctx.lineTo(Math.sin(a) * l, -Math.cos(a) * l); ctx.stroke();
    ctx.beginPath(); ctx.arc(Math.sin(a) * l, -Math.cos(a) * l, 4 * dpr, 0, 7); ctx.fill(); ctx.font = `bold ${10 * dpr}px system-ui`; ctx.textAlign = "center"; ctx.fillText(label, 0, 28 * dpr); ctx.restore(); };
  if (st.env && st.env.windKn) arrow(W - 26 * dpr, st.env.windFrom + 180, "#ffffff", "Wind");
  if (st.env && st.env.curKn) arrow(W - 70 * dpr, st.env.curTo, "#7fe3ff", "Strom");
  // Maßstab
  ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.font = `${11 * dpr}px system-ui`; ctx.fillRect(12 * dpr, H - 14 * dpr, 10 * scale, 3 * dpr); ctx.fillText("10 m", 12 * dpr, H - 20 * dpr);
}
function buoy(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, Math.max(r, 4), 0, 7); ctx.fill(); ctx.strokeStyle = "#333"; ctx.lineWidth = 1; ctx.stroke(); }
function drawBoat(ctx, X, Y, scale, b, fill, line) {
  const pts = hullLocal().map(p => toWorld(b, p));
  ctx.fillStyle = fill; ctx.strokeStyle = line; ctx.lineWidth = 2;
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Ruderblatt am Heck
  const st = toWorld(b, [0, -(SIM.L - SIM.PIVOT * SIM.L)]), ang = b.psi + Math.PI - b.delta * D2R, len = 1.4 * scale;
  ctx.strokeStyle = "#e53935"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(st[0]), Y(st[1])); ctx.lineTo(X(st[0]) + Math.sin(ang) * len, Y(st[1]) - Math.cos(ang) * len); ctx.stroke();
  // Steuerstand
  const c = toWorld(b, [0, -1.5]); ctx.fillStyle = line; ctx.beginPath(); ctx.arc(X(c[0]), Y(c[1]), Math.max(2, 0.45 * scale), 0, 7); ctx.fill();
}

/* ---------- Vollbild-Simulator: Sicht vom Steuerstand, Steuerrad in der Mitte, Hebel links ---------- */
const WHEEL_MAX = 540; // 1,5 Umdrehungen bis Hartruder
let simCam = "cockpit";
try { simCam = localStorage.getItem("sbfsee-simcam") || "cockpit"; } catch (e) {}
const CAMS = [["cockpit", "Steuerstand"], ["chase", "Hinter dem Boot"], ["top", "Von oben"]];
function loadThree() {
  if (window.THREE) return Promise.resolve();
  const src = IN_ARTIFACT ? "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" : "three/three.min.js";
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("three")); document.head.appendChild(s); });
}

function vPraxis(m) {
  if (!simPick) {
    m.innerHTML = `<div class="view">
      <div><div class="eyebrow">Manöver üben</div><h2>Praxis-Simulator</h2></div>
      <section class="panel" style="display:grid;gap:8px">
        <p style="margin:0;max-width:70ch">Du stehst am Steuerstand eines Motorboots: <b>Steuerrad in der Mitte</b>, <b>Schalthebel links</b>. Das Ruder bleibt liegen, wo du es hindrehst, das Boot reagiert verzögert und dreht nach. Die orange markierte Speiche oben am Rad heißt: Ruder mittschiffs.</p>
        <p class="muted" style="margin:0;font-size:.88rem">Am besten das <b>Handy quer halten</b>. Das Rad drehst du mit dem Finger, den Hebel schiebst du nach oben (voraus) oder unten (zurück). Am PC: Pfeiltasten ← → für das Rad, ↑ ↓ für den Hebel. Ein vereinfachtes Modell ohne Wind und Strömung, es ersetzt keine Fahrstunde.</p>
      </section>
      <div class="navgrid">${SCENARIOS.map(s => `<button class="panel navcard" data-sim="${s.id}"><b>${s.title}</b><span class="muted">${s.kurz}</span>
        ${simBest[s.id] ? `<span class="pill ok">geschafft · beste Zeit ${simBest[s.id]} s</span>` : `<span class="pill n">noch offen</span>`}</button>`).join("")}</div>
      <details class="panel grundlagen"><summary><b>Warum eiert man am Anfang herum?</b></summary>
        <p style="margin-top:10px">Beim Auto lenkt sich das Rad von selbst zurück, und das Auto folgt sofort. Beim Boot <b>bleibt das Ruder liegen</b>, und das Boot dreht erst verzögert, dann aber weiter, auch wenn man schon zurückdreht. Wer wartet, bis der Bug auf dem Ziel steht, ist zu spät. Dann steuert man kräftig gegen, das Boot schießt auf die andere Seite, und so weiter.</p>
        <p><b>Die Lösung:</b> Kleine Ruderbewegungen. Rechtzeitig vor dem Ziel zurück auf mittschiffs. Dann kurz abwarten, was das Boot macht. Am Steuerrad hilft die markierte Speiche: Steht sie oben, ist das Ruder mittschiffs.</p>
      </details>
    </div>`;
    m.querySelectorAll("[data-sim]").forEach(b => b.onclick = () => { simPick = SCENARIOS.find(s => s.id === b.dataset.sim); render(); window.scrollTo(0, 0); });
    return;
  }
  const sc = simPick;
  m.innerHTML = `<div class="view">
    <div class="row" style="justify-content:space-between"><div><div class="eyebrow">Praxis-Simulator</div><h2>${sc.title}</h2></div><button class="btn small" id="simback">Alle Übungen</button></div>
    <section class="panel" style="display:grid;gap:10px">${sc.brief.map(p => `<p style="margin:0;max-width:72ch">${p}</p>`).join("")}
      <div class="row" style="gap:12px;align-items:end">
        <label class="field">Wind<select id="envwind">${WIND_LEVELS.map(([k, l]) => `<option value="${k}" ${simEnv.wind === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="field">aus Richtung<select id="envwdir">${["zufall", ...DIRS].map(d => `<option value="${d}" ${simEnv.windDir === d ? "selected" : ""}>${d === "zufall" ? "zufällig" : d}</option>`).join("")}</select></label>
        <label class="field">Strömung<select id="envcur">${CUR_LEVELS.map(([k, l]) => `<option value="${k}" ${simEnv.cur === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="field">Schraube<select id="envprop"><option value="rechts" ${simEnv.prop !== "links" ? "selected" : ""}>rechtsdrehend: rückwärts Heck nach Bb</option><option value="links" ${simEnv.prop === "links" ? "selected" : ""}>linksdrehend: rückwärts Heck nach Stb</option></select></label>
        <label class="field">setzt nach<select id="envcdir">${["zufall", ...DIRS].map(d => `<option value="${d}" ${simEnv.curDir === d ? "selected" : ""}>${d === "zufall" ? "zufällig" : d}</option>`).join("")}</select></label>
      </div>
      <p class="muted" style="margin:0;font-size:.85rem">Wind treibt das Boot seitlich ab und drückt den Bug nach Lee, besonders bei wenig Fahrt. Strömung versetzt Boot und Person gleichermaßen. Tipp: Gegen Wind oder Strom anlegen und an die Person heranfahren, dann hast du mehr Kontrolle.</p>
      <label class="row" style="gap:8px"><input type="checkbox" id="simhelp" ${simHelp ? "checked" : ""}> Hilfen anzeigen: Minikarte mit Pfeil, wo der Bug in 3 Sekunden steht</label>
      <div class="row"><button class="btn primary" id="simgo">Los geht's (Vollbild)</button><span class="muted" style="font-size:.85rem">Handy dafür quer halten.</span></div></section>
  </div>`;
  $("#simback").onclick = () => { simPick = null; render(); };
  $("#simhelp").onchange = e => { simHelp = e.target.checked; try { localStorage.setItem("sbfsee-simhelp", simHelp ? "1" : "0"); } catch (err) {} };
  const envSave = () => { simEnv = { wind: $("#envwind").value, windDir: $("#envwdir").value, cur: $("#envcur").value, curDir: $("#envcdir").value, prop: $("#envprop").value }; try { localStorage.setItem("sbfsee-simenv", JSON.stringify(simEnv)); } catch (e) {} };
  ["#envwind", "#envwdir", "#envcur", "#envcdir", "#envprop"].forEach(id => $(id).onchange = envSave);
  $("#simgo").onclick = () => startSimFullscreen(sc);
}

async function startSimFullscreen(sc) {
  try { if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: "hide" }); } catch (e) {}
  try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock("landscape"); } catch (e) {}
  let has3d = true;
  try { await loadThree(); } catch (e) { has3d = false; toast("3D-Ansicht nicht verfügbar, zeige Ansicht von oben."); }
  runSim(sc, has3d);
}

function runSim(sc, has3d) {
  const st = sim = newSim(sc);
  st.wheel = 0; st.prevWheel = 0; st.lastDir = 0;
  const o = document.createElement("div"); o.className = "simfs";
  o.innerHTML = `
    <canvas class="fs3d"></canvas><canvas class="fs2d" hidden></canvas>
    <div class="fstop">
      <span class="row" style="gap:6px"><button class="fsbtn" data-a="exit" aria-label="Beenden">✕</button><button class="fsbtn" data-a="restart">Neu</button><button class="fsbtn" data-a="pause">Pause</button></span>
      <div class="compasswrap"><div class="compass"><div class="ctape">${tapeHTML(sc)}</div><i class="cmark"></i></div><b class="cval mono"></b></div>
      <button class="fsbtn" data-a="cam"></button>
    </div>
    <div class="fsinfo"><b class="fsmsg"></b><span class="fsdata mono"></span></div>
    <canvas class="fsmini"></canvas>
    <div class="fslook" role="group" aria-label="Blickrichtung">${[[-90, "◀ Bb"], [0, "Voraus"], [180, "Achtern"], [90, "Stb ▶"]].map(([y, l]) => `<button class="fsbtn" data-look="${y}">${l}</button>`).join("")}</div>
    <div class="fslever" aria-label="Schalthebel">${[3, 2, 1, 0, -1, -2].map(v => `<span class="lstop ${v === 0 ? "n" : ""}" data-t="${v}">${v > 0 ? "V" + v : v < 0 ? "Z" + -v : "N"}</span>`).join("")}<i class="lknob"></i></div>
    <div class="fsrudder"><span class="rudlabel">Ruderlage</span><div class="rudbar"><i class="rudmid"></i><i class="rudpos"></i></div><span class="rudtxt"></span></div>
    <div class="fswheelbox">
      <svg class="fswheel" viewBox="-60 -60 120 120" aria-label="Steuerrad"><circle r="48" fill="none" stroke="#3b2a1c" stroke-width="12"/><circle r="48" fill="none" stroke="#7a5a3a" stroke-width="7"/>
        ${[0, 60, 120, 180, 240, 300].map(a => `<line x1="0" y1="0" x2="${Math.sin(a * D2R) * 56}" y2="${-Math.cos(a * D2R) * 56}" stroke="${a === 0 ? "#ff7a3d" : "#7a5a3a"}" stroke-width="${a === 0 ? 9 : 7}" stroke-linecap="round"/>`).join("")}
        <circle r="13" fill="#3b2a1c"/><circle r="6" fill="#ff7a3d"/></svg>
    </div>
    <div class="fsportrait">Handy quer halten für mehr Übersicht</div>
    <div class="fsresult" hidden></div>`;
  document.body.appendChild(o);
  document.documentElement.classList.add("simopen");
  const q = s => o.querySelector(s);
  const c3 = q(".fs3d"), c2 = q(".fs2d"), mini = q(".fsmini"), wheel = q(".fswheel"), lever = q(".fslever");
  let g3 = null;
  if (has3d) { try { g3 = build3D(c3, sc, st); } catch (e) { g3 = null; } }
  if (!g3) simCam = "top";
  const camLabel = () => q('[data-a="cam"]').textContent = "Ansicht: " + CAMS.find(c => c[0] === simCam)[1];
  const applyCam = () => { c3.hidden = simCam === "top" || !g3; c2.hidden = !c3.hidden; mini.hidden = simCam === "top" || !simHelp; o.classList.toggle("camfar", simCam !== "cockpit"); camLabel(); };
  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = o.clientWidth, h = o.clientHeight;
    c2.width = w * dpr; c2.height = h * dpr; c2.style.width = w + "px"; c2.style.height = h + "px";
    const mw = Math.round(Math.min(w, h) * 0.34); mini.width = mw * dpr; mini.height = mw * dpr; mini.style.width = mini.style.height = mw + "px";
    if (g3) g3.resize(w, h);
  };
  size(); applyCam();
  window.addEventListener("resize", size);

  // Steuerrad: mit dem Finger drehen, es bleibt stehen, wo man es loslässt
  let drag = null;
  wheel.addEventListener("pointerdown", e => {
    const r = wheel.getBoundingClientRect(); drag = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    drag.a = Math.atan2(e.clientX - drag.cx, drag.cy - e.clientY) * R2D; wheel.setPointerCapture(e.pointerId); e.preventDefault();
  });
  wheel.addEventListener("pointermove", e => {
    if (!drag) return;
    const a = Math.atan2(e.clientX - drag.cx, drag.cy - e.clientY) * R2D; let d = a - drag.a; if (d > 180) d -= 360; if (d < -180) d += 360;
    drag.a = a; st.wheel = Math.max(-WHEEL_MAX, Math.min(WHEEL_MAX, st.wheel + d));
  });
  ["pointerup", "pointercancel"].forEach(ev => wheel.addEventListener(ev, () => drag = null));
  // Schalthebel: ziehen oder auf eine Stufe tippen
  const leverSet = clientY => { const stops = [...lever.querySelectorAll(".lstop")]; let best = stops[0], bd = 1e9; for (const s of stops) { const r = s.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - clientY); if (d < bd) { bd = d; best = s; } } st.b.T = +best.dataset.t; };
  let ldrag = false;
  lever.addEventListener("pointerdown", e => { ldrag = true; lever.setPointerCapture(e.pointerId); leverSet(e.clientY); e.preventDefault(); });
  lever.addEventListener("pointermove", e => { if (ldrag) leverSet(e.clientY); });
  ["pointerup", "pointercancel"].forEach(ev => lever.addEventListener(ev, () => ldrag = false));
  // Umsehen in der 3D-Ansicht: über das Bild wischen
  let look = null;
  c3.addEventListener("pointerdown", e => { look = { x: e.clientX, yaw: st.lookYaw || 0 }; c3.setPointerCapture(e.pointerId); });
  c3.addEventListener("pointermove", e => { if (look) st.lookYaw = Math.max(-180, Math.min(180, look.yaw - (e.clientX - look.x) * 0.3)); });
  o.querySelectorAll("[data-look]").forEach(bt => bt.onclick = e => { e.stopPropagation(); st.lookYaw = +bt.dataset.look; if (simCam !== "cockpit") { simCam = "cockpit"; applyCam(); } });
  ["pointerup", "pointercancel"].forEach(ev => c3.addEventListener(ev, () => look = null));
  c3.addEventListener("dblclick", () => st.lookYaw = 0);

  const close = () => {
    cancelAnimationFrame(simLoop); simLoop = 0; window.removeEventListener("resize", size);
    if (g3) g3.dispose(); o.remove(); document.documentElement.classList.remove("simopen"); sim = null;
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
    render();
  };
  o.addEventListener("click", e => {
    const a = e.target.closest("[data-a]"); if (!a) return;
    if (a.dataset.a === "exit") close();
    if (a.dataset.a === "restart") { cancelAnimationFrame(simLoop); if (g3) g3.dispose(); o.remove(); runSim(sc, has3d); }
    if (a.dataset.a === "pause") { st.paused = !st.paused; a.textContent = st.paused ? "Weiter" : "Pause"; }
    if (a.dataset.a === "cam") { const i = CAMS.findIndex(c => c[0] === simCam); simCam = CAMS[(i + 1) % CAMS.length][0]; if (simCam !== "top" && !g3) simCam = "top"; try { localStorage.setItem("sbfsee-simcam", simCam); } catch (err) {} applyCam(); }
    if (a.dataset.a === "again") { cancelAnimationFrame(simLoop); if (g3) g3.dispose(); o.remove(); runSim(sc, has3d); }
    if (a.dataset.a === "list") { simPick = null; close(); }
  });

  let last = performance.now(), hudT = 0;
  const frame = now => {
    if (!o.isConnected || sim !== st) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!st.paused && !st.done) for (let i = 0; i < 4; i++) simStep(st, dt / 4);
    if (simCam === "top" || !g3) simDraw(c2, st); else { g3.update(st, simCam); if (simHelp) simDraw(mini, st, { view: Math.max(60, sc.view * 0.7), follow: true, mini: true }); }
    // Rad, Ruderanzeige, Hebel jedes Bild; Texte etwas seltener
    wheel.style.transform = `rotate(${st.wheel}deg)`;
    q(".rudpos").style.left = 50 + st.b.delta / SIM.RUD_MAX * 50 + "%";
    q(".lknob").style.top = (q(`.lstop[data-t="${st.b.T}"]`).offsetTop + q(".lstop").offsetHeight / 2) + "px";
    if ((hudT += dt) > 0.1) {
      hudT = 0;
      const b = st.b, hd = norm360(b.psi * R2D), mid = Math.abs(b.delta) < 2, d = Math.round(b.delta);
      q(".cval").textContent = String(Math.round(hd)).padStart(3, "0") + "°";
      q(".ctape").style.transform = `translateX(${-hd * 3}px)`;
      q(".rudtxt").textContent = mid ? "Ruder mittschiffs" : `Ruder ${Math.abs(d)}° ${d > 0 ? "Stb" : "Bb"}`;
      q(".rudtxt").classList.toggle("mid", mid);
      q(".fsmsg").textContent = st.msg;
      q(".fsdata").textContent = `${(b.u * KN).toFixed(1).replace(".", ",")} kn · Drehung ${(b.r * R2D).toFixed(1).replace(".", ",")}°/s · ${THROTTLE[b.T]}${envText(st.env) ? " · " + envText(st.env) : ""}`;
      lever.querySelectorAll(".lstop").forEach(s => s.classList.toggle("on", +s.dataset.t === b.T));
      o.querySelectorAll("[data-look]").forEach(bt => bt.classList.toggle("on", simCam === "cockpit" && Math.abs((st.lookYaw || 0) - +bt.dataset.look) < 1));
    }
    if (st.done && q(".fsresult").hidden) {
      const d = st.done, box = q(".fsresult");
      if (d.ok && d.score != null) { const best = simBest[sc.id]; if (!best || d.score < best) { simBest[sc.id] = d.score; try { localStorage.setItem("sbfsee-simbest", JSON.stringify(simBest)); } catch (e) {} } }
      box.innerHTML = `<div class="eyebrow">${d.ok ? "Geschafft" : "Nicht geschafft"}</div><h3>${esc(d.text)}</h3>${d.tips.map(t => `<p style="margin:0">${esc(t)}</p>`).join("")}
        <div class="row"><button class="btn primary" data-a="again">Nochmal</button><button class="btn" data-a="list">Andere Übung</button></div>`;
      box.className = "fsresult " + (d.ok ? "ok" : "no"); box.hidden = false;
    }
    simLoop = requestAnimationFrame(frame);
  };
  simLoop = requestAnimationFrame(frame);
}

// Kompassband: alle 10° ein Strich, Himmelsrichtungen und Zielkurs markiert
function tapeHTML(sc) {
  let h = "";
  for (let d = -180; d <= 540; d += 10) { const n = norm360(d), lab = n % 90 === 0 ? ["N", "O", "S", "W"][n / 90] : n % 30 === 0 ? String(n).padStart(3, "0") : ""; h += `<span class="tk${lab ? " big" : ""}" style="left:${d * 3}px">${lab}</span>`; }
  if (sc.target != null) for (const k of [-360, 0, 360]) h += `<i class="ttarget" style="left:${(sc.target + k) * 3}px"></i>`;
  return h;
}

/* 3D-Szene mit three.js. Welt: x = Ost, y = Nord (Meter) → three: (x, Höhe, −y) */
function build3D(canvas, sc, st) {
  const T = window.THREE;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new T.Scene();
  scene.background = new T.Color(0xbfd8ea); scene.fog = new T.Fog(0xbfd8ea, 150, 700);
  const camera = new T.PerspectiveCamera(62, 1, 0.1, 2000);
  scene.add(new T.HemisphereLight(0xffffff, 0x2a4a66, 0.95));
  const sun = new T.DirectionalLight(0xffffff, 0.7); sun.position.set(80, 120, 40); scene.add(sun);
  // Wasser mit Raster, damit man Fahrt und Drehung sieht
  const tc = document.createElement("canvas"); tc.width = tc.height = 128; const tx = tc.getContext("2d");
  tx.fillStyle = "#2b6c94"; tx.fillRect(0, 0, 128, 128); tx.strokeStyle = "rgba(255,255,255,.18)"; tx.lineWidth = 2; tx.strokeRect(0, 0, 128, 128);
  for (let i = 0; i < 40; i++) { tx.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`; tx.fillRect(Math.random() * 128, Math.random() * 128, 18, 2); }
  const tex = new T.CanvasTexture(tc); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(200, 200);
  const water = new T.Mesh(new T.PlaneGeometry(2000, 2000), new T.MeshLambertMaterial({ map: tex }));
  water.rotation.x = -Math.PI / 2; scene.add(water);
  const V = (x, y, h = 0) => new T.Vector3(x, h, -y);
  const box = (w, h, d, color, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshLambertMaterial({ color })); m.position.set(x, z, -y); scene.add(m); return m; };
  // Steg mit Pfählen
  for (const p of sc.piers || []) {
    box(p.x2 - p.x1, 0.5, p.y2 - p.y1, 0x8a6a45, (p.x1 + p.x2) / 2, (p.y1 + p.y2) / 2, 0.75);
    for (let y = p.y1 + 2; y < p.y2; y += 6) { const post = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 2.2, 8), new T.MeshLambertMaterial({ color: 0x5a4330 })); post.position.copy(V(p.x2 - 0.15, y, 0.6)); scene.add(post); }
  }
  if (sc.berth) { const pl = new T.Mesh(new T.PlaneGeometry(3.4, sc.berth.y2 - sc.berth.y1), new T.MeshBasicMaterial({ color: 0x4ddc7c, transparent: true, opacity: 0.35 })); pl.rotation.x = -Math.PI / 2; pl.position.copy(V(1.7, (sc.berth.y1 + sc.berth.y2) / 2, 0.03)); scene.add(pl); }
  // Boote
  const boatMesh = (hullColor, deckColor, own) => {
    const g = new T.Group(), shape = new T.Shape(); hullLocal().forEach((p, i) => i ? shape.lineTo(p[0], p[1]) : shape.moveTo(p[0], p[1]));
    const hull = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: 1.1, bevelEnabled: false }), [new T.MeshLambertMaterial({ color: deckColor }), new T.MeshLambertMaterial({ color: hullColor })]);
    hull.rotation.x = -Math.PI / 2; g.add(hull);
    if (!own) { const cab = new T.Mesh(new T.BoxGeometry(2.0, 1.1, 3.2), new T.MeshLambertMaterial({ color: 0xf2f2f2 })); cab.position.set(0, 1.65, 2.2); g.add(cab); }
    else {
      // Bugkorb-Stange als Peilhilfe und Windschutz vor dem Steuerstand
      const pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 1.4, 6), new T.MeshLambertMaterial({ color: 0xff7a3d })); pole.position.set(0, 1.8, -SIM.PIVOT * SIM.L + 0.3); g.add(pole);
      const screen = new T.Mesh(new T.BoxGeometry(2.2, 0.5, 0.08), new T.MeshLambertMaterial({ color: 0x9fc3d8, transparent: true, opacity: 0.35 })); screen.position.set(0, 1.5, -0.2); g.add(screen);
      const dash = new T.Mesh(new T.BoxGeometry(2.4, 0.35, 0.8), new T.MeshLambertMaterial({ color: 0x1d2b36 })); dash.position.set(0, 1.25, 0.3); g.add(dash);
    }
    scene.add(g); return g;
  };
  const place = (g, x, y, psi) => { g.position.set(x, 0, -y); g.rotation.y = -psi; };
  for (const mb of sc.moored || []) place(boatMesh(0xdfe6ea, 0xb0bec5, false), mb.x, mb.y + (SIM.L / 2 - SIM.PIVOT * SIM.L), mb.psi * D2R);
  const own = boatMesh(0xffffff, 0xd8cdb8, true);
  // Tonnen, Kurslinie, Landmarke
  const buoy = (x, y, color) => { const b = new T.Mesh(new T.CylinderGeometry(0.45, 0.6, 1.4, 12), new T.MeshLambertMaterial({ color })); b.position.copy(V(x, y, 0.5)); scene.add(b); return b; };
  if (sc.zone) { for (const yy of [sc.zone.y1, sc.zone.y2]) for (const xx of [-sc.zone.x - 2, sc.zone.x + 2]) buoy(xx, yy, 0xffd600);
    for (let y = -40; y < 200; y += 8) box(0.3, 0.05, 2.5, 0xffffff, 0, y, 0.03); }
  if (sc.id === "kurs") { // Leuchtturm im Osten als Ziel für Kurs 090°
    const lt = new T.Mesh(new T.CylinderGeometry(3, 4, 30, 16), new T.MeshLambertMaterial({ color: 0xffffff })); lt.position.copy(V(600, 40, 15)); scene.add(lt);
    const red = new T.Mesh(new T.CylinderGeometry(3.2, 3.4, 6, 16), new T.MeshLambertMaterial({ color: 0xd32f2f })); red.position.copy(V(600, 40, 20)); scene.add(red); }
  // Ufer als Hintergrund im Hafen
  if (sc.piers) box(400, 6, 30, 0x7c9a6a, -40, 200, 3);
  let person = null;
  // Windfahne an der Bugstange: zeigt, wohin der Wind weht
  const fg = new T.PlaneGeometry(0.45, 0.28); fg.translate(0.225, 0, 0);
  const flag = new T.Mesh(fg, new T.MeshLambertMaterial({ color: 0xd32f2f, side: T.DoubleSide })); scene.add(flag);
  const update = (st, cam) => {
    const b = st.b;
    place(own, b.x, b.y, b.psi);
    if (st.stats.person && !person) { person = new T.Group(); const head = new T.Mesh(new T.SphereGeometry(0.3, 12, 10), new T.MeshLambertMaterial({ color: 0xf1c27d })); head.position.y = 0.35; person.add(head);
      const ring = new T.Mesh(new T.TorusGeometry(0.55, 0.14, 8, 18), new T.MeshLambertMaterial({ color: 0xff6d00 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; person.add(ring); scene.add(person); }
    if (person) { person.position.copy(V(st.stats.person.x, st.stats.person.y, Math.sin(performance.now() / 500) * 0.08)); }
    const tip = toWorld(b, [0, SIM.PIVOT * SIM.L - 0.3]); flag.position.copy(V(tip[0], tip[1], 2.35));
    flag.rotation.y = st.env.windKn ? -((st.env.windFrom + 180) * D2R) + Math.PI / 2 + Math.sin(performance.now() / 160) * 0.15 : -b.psi - Math.PI / 2;
    flag.visible = st.env.windKn > 0;
    if (st.env.curKn) { tex.offset.x += Math.sin(st.env.curTo * D2R) * st.env.curKn / KN * 0.016 / 10; tex.offset.y += Math.cos(st.env.curTo * D2R) * st.env.curKn / KN * 0.016 / 10; }
    if (cam === "chase") {
      const p = toWorld(b, [0, -20]), t = toWorld(b, [0, 6]);
      camera.position.copy(V(p[0], p[1], 9)); camera.lookAt(V(t[0], t[1], 0));
    } else {
      const look = st.lookYaw || 0, yaw = b.psi + look * D2R, p = toWorld(b, [0, Math.abs(look) > 120 ? -0.6 : -1.0]);
      camera.position.copy(V(p[0], p[1], 2.5)); camera.lookAt(V(p[0] + Math.sin(yaw) * 40, p[1] + Math.cos(yaw) * 40, 0.6));
    }
    renderer.render(scene, camera);
  };
  const resize = (w, h) => { renderer.setSize(w, h, false); canvas.style.width = w + "px"; canvas.style.height = h + "px"; camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const dispose = () => { renderer.dispose(); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); };
  return { update, resize, dispose };
}
// Tastatur: Rad gedrückt halten, Hebel schrittweise
document.addEventListener("keydown", e => {
  if (!sim || sim.done || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.key === "ArrowLeft") { sim.steer = -1; e.preventDefault(); }
  if (e.key === "ArrowRight") { sim.steer = 1; e.preventDefault(); }
  if (e.key === "ArrowUp" && !e.repeat) { sim.b.T = Math.min(3, sim.b.T + 1); e.preventDefault(); }
  if (e.key === "ArrowDown" && !e.repeat) { sim.b.T = Math.max(-2, sim.b.T - 1); e.preventDefault(); }
  if (e.key === "n" || e.key === "0") sim.b.T = 0;
});
document.addEventListener("keyup", e => { if (sim && (e.key === "ArrowLeft" || e.key === "ArrowRight")) sim.steer = 0; });


render();
initSync();
loadKartenFromDb();
if (!IN_ARTIFACT && "serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
