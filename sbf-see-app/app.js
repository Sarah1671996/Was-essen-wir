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
function blank() { return { c: {}, daily: null, exams: [], dailySize: 10, days: {}, nav: {}, notes: {} }; }
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
  nav: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'
};
const VIEWS = [["start", "Übersicht", "Start"], ["tag", "Tagesfragen", "Heute"], ["karten", "Karteikarten", "Karten"], ["pruefung", "Prüfung", "Prüfung"], ["nav", "Navigation", "Navi"], ["drucken", "Drucken", "Druck"], ["katalog", "Katalog", "Katalog"]];
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
const busy = () => (view === "karten" && ((flash && !flash.done) || pics)) || (view === "pruefung" && exam && !exam.done) || (view === "tag" && quiz);

function render() {
  renderTabs();
  const m = $("#main");
  ({ start: vStart, tag: vTag, karten: vKarten, pruefung: vPruefung, nav: vNav, drucken: vDrucken, katalog: vKatalog })[view](m);
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
  m.querySelectorAll("[data-due]").forEach(b => b.onclick = () => { flashCfg.pool = "faellig"; flash = null; go("karten"); });
  $("#bexport").onclick = exportBackup;
  $("#bimport").onclick = () => $("#bfile").click();
  $("#bfile").onchange = e => { const f = e.target.files[0]; if (f) importBackup(f); e.target.value = ""; };
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
const tagOrder = (d, n) => shuffle([0, 1, 2, 3], seeded(d.date + ":" + n));

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
        <div class="seg" role="group" aria-label="Ansicht"><button data-tview="kreuz" aria-pressed="${tagView === "kreuz"}">Ankreuzen</button><button data-tview="loes" aria-pressed="${tagView === "loes"}">Lösungen</button></div>
        <div class="row"><button class="btn" id="dpdf">Als PDF</button><button class="btn" id="dquiz">Einzeln abfragen</button></div>
      </section>
      ${tagView === "kreuz" ? tagSheetHTML(d)
        : `<div class="row noprint"><button class="btn small" id="dhide">${tagHide ? "Antworten zeigen" : "Antworten verdecken"}</button></div>
           <div class="printarea">${sheetHTML(d.ids.map(n => ({ q: byN.get(n) })), "lern", "Lernstapel vom " + fmtDate(Date.now()), tagHide, d.res, true)}</div>`}` : ""}
  </div>`;
  if ($("#tadd")) $("#tadd").onclick = () => { tagAddOpen = !tagAddOpen; render(); };
  if ($("#tclear")) $("#tclear").onclick = () => { tagConfirmClear = true; render(); };
  if ($("#tclearno")) $("#tclearno").onclick = () => { tagConfirmClear = false; render(); };
  if ($("#tclearyes")) $("#tclearyes").onclick = () => { tagConfirmClear = false; setStack([], {}); tagSheet = null; render(); };
  if (open) wireAddPanel(m);
  if (ids.length) {
    m.querySelectorAll("[data-tview]").forEach(b => b.onclick = () => { tagView = b.dataset.tview; render(); });
    if ($("#dhide")) $("#dhide").onclick = () => { tagHide = !tagHide; render(); };
    $("#dquiz").onclick = () => { quiz = { ids: shuffle(d.ids), i: 0, ok: 0, from: "tag" }; render(); };
    $("#dpdf").onclick = () => makePdf(d.ids.map(n => ({ q: byN.get(n), order: tagOrder(d, n) })), "bogen", "Lernstapel vom " + fmtDate(Date.now()), "Lernstapel-" + d.date);
    m.querySelectorAll(".ans.hidden").forEach(el => el.onclick = () => el.classList.remove("hidden"));
    if (tagView === "kreuz") wireTagSheet(m, d);
  }
}

/* Fragen hinzufügen: Suchen mit Haken, automatisch, nach Markierung oder nach Nummern */
function addPanelHTML() {
  const modes = [["suche", "Suchen"], ["auto", "Automatisch"], ["marks", "Nach Markierung"], ["nummern", "Nummern"]];
  let body = "";
  if (tagAddMode === "suche") body = `
    <label class="field">Suche nach Wort oder Nummern<input type="search" id="tsearch" autocomplete="off" value="${esc(tagSearch)}" placeholder="z. B. Nebel, Tonne, Schallsignal  oder  20-30"></label>
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
function renderResults() {
  const box = $("#tresults"); if (!box) return;
  const hits = searchQuestions(tagSearch), shown = hits.slice(0, 60);
  const pickable = shown.filter(n => !inStack(n));
  if (!tagSearch.trim()) { box.innerHTML = `<p class="muted" style="margin:0">Tippe ein Stichwort oder Nummern ein. Dann hakst du die Fragen an, die du lernen willst.</p>`; return; }
  box.innerHTML = hits.length ? `
    <div class="row" style="justify-content:space-between;margin-bottom:8px"><b>${hits.length} Treffer${hits.length > 60 ? " (die ersten 60)" : ""}</b>
      <span class="row"><button class="btn small" id="tpickall" ${pickable.length ? "" : "disabled"}>Alle anhaken</button><button class="btn small primary" id="taddpicked" ${tagPicked.size ? "" : "disabled"}>${tagPicked.size} angehakte hinzufügen</button></span></div>
    <div class="picklist">${shown.map(n => { const q = byN.get(n), there = inStack(n);
      return `<label class="pick${there ? " there" : ""}"><input type="checkbox" data-pick="${n}" ${there || tagPicked.has(n) ? "checked" : ""} ${there ? "disabled" : ""}>
        <span class="mono">Nr. ${n}</span><span class="pt">${esc(q.q)}</span>${there ? `<span class="pill n">im Stapel</span>` : markPill(n)}</label>`; }).join("")}</div>`
    : `<p class="muted" style="margin:0">Keine Frage gefunden.</p>`;
  box.querySelectorAll("[data-pick]").forEach(c => c.onchange = () => { const n = +c.dataset.pick; c.checked ? tagPicked.add(n) : tagPicked.delete(n); updatePickBtn(); });
  if ($("#tpickall")) $("#tpickall").onclick = () => { pickable.forEach(n => tagPicked.add(n)); renderResults(); };
  if ($("#taddpicked")) $("#taddpicked").onclick = () => { addToStack([...tagPicked]); tagPicked.clear(); render(); };
}
function updatePickBtn() { const b = $("#taddpicked"); if (b) { b.disabled = !tagPicked.size; b.textContent = tagPicked.size + " angehakte hinzufügen"; } }
function wireAddPanel(m) {
  m.querySelectorAll("[data-addmode]").forEach(b => b.onclick = () => { tagAddMode = b.dataset.addmode; rememberTag(); render(); });
  if ($("#tsearch")) { $("#tsearch").oninput = e => { tagSearch = e.target.value; renderResults(); }; renderResults(); }
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
  const st = tagState(d), list = (st.only || d.ids).filter(n => d.ids.includes(n));
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
  const st = tagState(d), list = () => (st.only || d.ids).filter(n => d.ids.includes(n));
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
  if ($("#tagagain")) $("#tagagain").onclick = () => { tagSheet = null; render(); window.scrollTo(0, 0); };
  if ($("#tagwrong")) $("#tagwrong").onclick = () => { const only = d.ids.filter(n => d.res[n] === false); tagSheet = { key: d.date, ans: {}, done: false, only }; render(); window.scrollTo(0, 0); };
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
        <p style="margin:0">${SIMILAR_GROUPS.length} Gruppen von Fragen mit gleichen Antworten, direkt nebeneinander. So siehst du, woran du sie unterscheidest.</p>
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
function vSimilar(m) {
  const g = SIMILAR_GROUPS[similar.i];
  const all = g.flatMap(n => byN.get(n).a.map(normA));
  const shared = a => all.filter(x => x === normA(a)).length > 1;
  m.innerHTML = `<div class="view">
    <div class="row" style="justify-content:space-between"><div><div class="eyebrow">Verwechslungsgefahr · Gruppe ${similar.i + 1} von ${SIMILAR_GROUPS.length}</div><h2>Ähnliche Fragen im Vergleich</h2></div>
      <button class="btn small" id="simclose">Schließen</button></div>
    <p class="muted" style="margin:0;max-width:70ch">Diese Fragen haben gleiche oder fast gleiche Antworten. Grün ist jeweils die richtige. Mit ↔ markierte Antworten kommen auch bei einer anderen Frage dieser Gruppe vor.</p>
    <div class="simgrid">${g.map(n => { const q = byN.get(n); return `<article class="panel" style="display:grid;gap:8px;align-content:start">
        <div class="qmeta"><span class="mono">Nr. ${n}</span>${markPill(n)}</div>
        <b>${esc(q.q)}</b>${imgTag(q)}
        <ul class="simans">${q.a.map((a, k) => `<li class="${k === 0 ? "ok" : ""}">${k === 0 ? "✓" : "·"} ${esc(a)}${shared(a) ? ` <span class="muted">↔</span>` : ""}</li>`).join("")}</ul>
        ${noteBox(n)}</article>`; }).join("")}</div>
    <div class="row" style="justify-content:space-between">
      <button class="btn" id="simprev" ${similar.i ? "" : "disabled"}>‹ Vorige Gruppe</button>
      <button class="btn" id="simadd">${g.every(inStack) ? "Alle im Stapel" : "Gruppe in den Lernstapel"}</button>
      <button class="btn primary" id="simnext" ${similar.i < SIMILAR_GROUPS.length - 1 ? "" : "disabled"}>Nächste Gruppe ›</button></div>
  </div>`;
  $("#simclose").onclick = () => { similar = null; render(); };
  $("#simprev").onclick = () => { similar.i--; render(); window.scrollTo(0, 0); };
  $("#simnext").onclick = () => { similar.i++; render(); window.scrollTo(0, 0); };
  $("#simadd").onclick = () => { if (!g.every(inStack)) { addToStack(g); render(); } };
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

render();
initSync();
loadKartenFromDb();
if (!IN_ARTIFACT && "serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
