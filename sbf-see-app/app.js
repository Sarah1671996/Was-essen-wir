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
function blank() { return { c: {}, daily: null, exams: [], dailySize: 10 }; }
try { const raw = localStorage.getItem(LS_KEY); if (raw) P = Object.assign(blank(), JSON.parse(raw)); } catch (e) {}
function merge(a, b) {
  const out = Object.assign(blank(), a);
  out.c = Object.assign({}, a.c);
  for (const [k, v] of Object.entries(b.c || {})) if (!out.c[k] || (v.t || 0) > (out.c[k].t || 0)) out.c[k] = v;
  if (b.daily && (!out.daily || (b.daily.t || 0) > (out.daily.t || 0))) out.daily = b.daily;
  const seen = new Set(out.exams.map(e => e.t));
  out.exams = out.exams.concat((b.exams || []).filter(e => !seen.has(e.t))).sort((x, y) => x.t - y.t).slice(-30);
  if (b.dailySize && (b.st || 0) > (a.st || 0)) out.dailySize = b.dailySize;
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
function setMark(n, m) { const s = Object.assign({}, stat(n)); s.m = m; delete s.b; s.t = Date.now(); P.c[n] = s; save(); }
// Ankreuzen setzt die Markierung automatisch: falsch -> schlecht, richtig -> eine Stufe besser
function record(n, ok) {
  const s = Object.assign({}, stat(n)), cur = mark(n);
  if (ok) s.r++; else s.w++;
  s.m = ok ? (cur === "s" ? "m" : cur === "m" || cur === "g" ? "g" : "m") : "s";
  delete s.b; s.t = Date.now(); P.c[n] = s; save();
  return s.m;
}
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
const POOLS = [["alle", "Alle 285 Fragen"], ["mk-s", "Markiert: schlecht"], ["mk-m", "Markiert: mittel"], ["mk-g", "Markiert: sicher"], ["mk-sm", "Schlecht + mittel (alles noch nicht Sichere)"], ["mk-", "Noch nicht markiert"],
  ["nummern", "Bestimmte Nummern (z. B. 1-10, 22, 30)"], ["basis", "Basisfragen (72)"], ["see", "Spezifische See-Fragen (213)"], ["bild", "Fragen mit Bild (Lichter, Zeichen, Signale)"]];
function poolFor(key, nums) {
  if (key === "nummern") return parseNums(nums).ids;
  if (key === "basis") return BASIS.slice();
  if (key === "see") return SEE.slice();
  if (key === "bild") return Q.filter(q => q.img.length).map(q => q.n);
  if (key === "mk-sm") return Q.map(q => q.n).filter(n => mark(n) === "s" || mark(n) === "m");
  if (key.startsWith("mk-")) return Q.map(q => q.n).filter(n => mark(n) === key.slice(3));
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
  katalog: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>'
};
const VIEWS = [["start", "Übersicht"], ["tag", "Tagesfragen"], ["karten", "Karteikarten"], ["pruefung", "Prüfung"], ["drucken", "Drucken"], ["katalog", "Katalog"]];
let view = (location.hash || "").slice(1);
if (!VIEWS.some(v => v[0] === view)) view = "start";
function go(v) { view = v; try { history.replaceState(null, "", "#" + v); } catch (e) {} render(); window.scrollTo(0, 0); }
function renderTabs() {
  $("#tabs").innerHTML = VIEWS.map(([k, l]) => `<button data-go="${k}" ${view === k ? 'aria-current="page"' : ""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg><span>${l}</span></button>`).join("");
}
document.addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (!b) return; if (b.dataset.daily) ensureDaily(false); go(b.dataset.go); });
window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (h !== view && VIEWS.some(v => v[0] === h)) { view = h; render(); } });

/* Laufende Sitzungen nicht durch Sync-Updates zerstören */
let flash = null, exam = null, quiz = null;
const busy = () => (view === "karten" && flash && !flash.done) || (view === "pruefung" && exam && !exam.done) || (view === "tag" && quiz);

function render() {
  renderTabs();
  const m = $("#main");
  ({ start: vStart, tag: vTag, karten: vKarten, pruefung: vPruefung, drucken: vDrucken, katalog: vKatalog })[view](m);
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
  const d = P.daily && P.daily.date === today() ? P.daily : null;
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
        ${d ? `<h3>${dDone} von ${d.ids.length} Tagesfragen richtig</h3>
          <div class="progress"><i style="width:${dDone / d.ids.length * 100}%"></i></div>`
          : `<h3>Noch keine Tagesfragen für heute</h3><p class="muted" style="margin:0">Die App wählt Fragen aus, die du noch nicht kannst oder noch nie gesehen hast.</p>`}
        <div class="row"><button class="btn primary" data-go="tag" data-daily="1">${d ? "Tagesfragen öffnen" : "Tagesfragen zusammenstellen"}</button>
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
    ${CAN_FB ? devicePanel() : ""}
    <section class="panel">
      <div class="row" style="justify-content:space-between"><div><div class="eyebrow">Prüfungssimulation</div><h3 style="margin-top:2px">30 Fragen: 7 Basis + 23 See</h3></div>
      <button class="btn primary" data-go="pruefung">Prüfungsbogen starten</button></div>
      ${ex.length ? `<ul class="examlist">${ex.map(e => `<li><span>${fmtDate(e.t)}</span><span class="mono">${e.score} / 30</span><span class="pill ${e.pass ? "ok" : "no"}">${e.pass ? "bestanden" : "nicht bestanden"}</span></li>`).join("")}</ul>` : `<p class="muted" style="margin:8px 0 0">Noch keine Prüfung geschrieben.</p>`}
    </section>
  </div>`;
  m.querySelectorAll("[data-learn]").forEach(b => b.onclick = () => { flashCfg.pool = b.dataset.learn; flash = null; go("karten"); });
  if (CAN_FB) wireDevicePanel();
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

/* ---------- Tagesfragen ---------- */
let tagHide = true;
function ensureDaily(force) {
  if (!force && P.daily && P.daily.date === today()) return P.daily;
  const rnd = seeded(today() + ":" + Date.now());
  P.daily = { date: today(), ids: pickLearn(Q.map(q => q.n), P.dailySize || 10, rnd).sort((a, b) => a - b), res: {}, t: Date.now() };
  save(); return P.daily;
}
function vTag(m) {
  if (quiz) return vQuiz(m);
  const d = P.daily && P.daily.date === today() ? P.daily : null;
  m.innerHTML = `<div class="view">
    <div class="noprint"><div class="eyebrow">${new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</div><h2>Tagesfragen</h2></div>
    <section class="panel noprint row" style="justify-content:space-between">
      <div class="row">
        <label class="field">Anzahl
          <select id="dsize">${[5, 10, 15, 20, 30].map(n => `<option ${n === (P.dailySize || 10) ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <button class="btn" id="dnew" style="align-self:end">${d ? "Neu zusammenstellen" : "Zusammenstellen"}</button>
      </div>
      ${d ? `<div class="row" style="align-self:end">
        <button class="btn" id="dhide">${tagHide ? "Antworten zeigen" : "Antworten verdecken"}</button>
        <button class="btn" id="dpdf">Als PDF</button>
        <button class="btn primary" id="dquiz">Abfragen</button></div>` : ""}
    </section>
    ${d ? `<div class="printarea">${sheetHTML(d.ids.map(n => ({ q: byN.get(n) })), "lern", "Tagesfragen vom " + fmtDate(d.t), tagHide, d.res)}</div>`
      : `<div class="panel empty">Wähle die Anzahl und tippe auf „Zusammenstellen“. Bevorzugt kommen Fragen, die du zuletzt falsch hattest oder noch nicht kennst.</div>`}
  </div>`;
  $("#dsize").onchange = e => { P.dailySize = +e.target.value; save(); };
  $("#dnew").onclick = () => { P.dailySize = +$("#dsize").value; ensureDaily(true); render(); };
  if (d) {
    $("#dhide").onclick = () => { tagHide = !tagHide; render(); };
    $("#dquiz").onclick = () => { quiz = { ids: shuffle(d.ids), i: 0, ok: 0, from: "tag" }; render(); };
    $("#dpdf").onclick = () => makePdf(d.ids.map(n => ({ q: byN.get(n) })), "lern", "Tagesfragen vom " + fmtDate(d.t), "Tagesfragen-" + d.date);
    m.querySelectorAll(".ans.hidden").forEach(el => el.onclick = () => el.classList.remove("hidden"));
  }
}
function vQuiz(m) {
  const z = quiz;
  if (z.i >= z.ids.length) {
    m.innerHTML = `<div class="view"><section class="panel" style="display:grid;gap:12px;text-align:center;justify-items:center;padding:36px">
      <div class="eyebrow">Abfrage beendet</div><div class="big mono">${z.ok} / ${z.ids.length}</div>
      <p class="muted" style="margin:0">${z.ok === z.ids.length ? "Alles richtig. Stark!" : "Falsch beantwortete Fragen sind jetzt als „schlecht“ markiert und kommen bald wieder."}</p>
      <button class="btn primary" id="qback">Zurück zu den Tagesfragen</button></section></div>`;
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
    <div class="row" style="margin-top:16px;justify-content:space-between" hidden id="nextrow"><span class="row" style="gap:8px"><span class="muted" style="font-size:.85rem">Markierung:</span><span id="mbar"></span></span><button class="btn primary" id="next">Weiter</button></div>`;
  box.querySelectorAll(".opt").forEach(b => b.onclick = () => {
    const ok = b.dataset.o === "0";
    box.querySelectorAll(".opt").forEach(x => { x.disabled = true; if (x.dataset.o === "0") x.classList.add("right"); });
    if (!ok) b.classList.add("wrong");
    onAnswer(ok);
    box.querySelector("#mbar").innerHTML = markBar(q.n);
    box.querySelector("#nextrow").hidden = false; box.querySelector("#next").focus();
  });
  box.querySelector("#next").onclick = onNext;
}

/* ---------- Karteikarten ---------- */
let flashCfg = { pool: "alle", mode: "karte", order: "lernen", nums: "1-10" };
const flashPool = () => poolFor(flashCfg.pool, flashCfg.nums);
function vKarten(m) {
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
        ${flashCfg.pool === "nummern" ? `<label class="field" style="flex:1 1 220px">Nummern<input type="text" id="fnums" inputmode="numeric" value="${esc(flashCfg.nums)}" placeholder="z. B. 1-10, 22, 30, 32"></label>` : ""}
        <label class="field">Reihenfolge
          <select id="forder"><option value="lernen" ${flashCfg.order === "lernen" ? "selected" : ""}>Schlechte zuerst</option><option value="zufall" ${flashCfg.order === "zufall" ? "selected" : ""}>Zufällig</option><option value="nummer" ${flashCfg.order === "nummer" ? "selected" : ""}>Nach Fragennummer</option></select></label>
      </div>
      <div class="row" style="gap:12px"><span class="eyebrow" style="margin-right:4px">Modus</span>
        <div class="seg" role="group" aria-label="Modus"><button data-mode="karte" aria-pressed="${flashCfg.mode === "karte"}">Umdrehen</button><button data-mode="mc" aria-pressed="${flashCfg.mode === "mc"}">Ankreuzen</button></div></div>
      <p class="muted" style="margin:0">${flashCfg.mode === "karte" ? "Du siehst die Frage, überlegst die Antwort und drehst die Karte um. Dann markierst du sie als sicher, mittel oder schlecht." : "Du wählst aus vier Antworten, die bei jeder Karte neu gemischt werden. Falsch markiert die Karte als schlecht, richtig eine Stufe besser. Du kannst die Markierung danach selbst ändern."}</p>
      <div class="row"><button class="btn primary" id="fstart" ${pool.length ? "" : "disabled"}>${pool.length} Karten lernen</button>${flashCfg.pool === "nummern" ? `<span class="muted" id="fhint" style="font-size:.85rem">${numsHint(flashCfg.nums)}</span>` : ""}</div>
    </section>
  </div>`;
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
        <div class="face back">${meta}<p class="qtext" style="font-size:1rem;font-weight:400">${esc(q.q)}</p><div class="answer">${esc(q.a[0])}</div>${imgTag(q)}<div class="hint">Wie sicher warst du?</div></div>
      </div></div>
      <div class="rate" id="rate" hidden><button class="btn bad" data-rate="s">Schlecht</button><button class="btn mid" data-rate="m">Mittel</button><button class="btn good" data-rate="g">Sicher</button></div>
    </div>`;
    const card = $("#card");
    const fit = () => { const a = card.querySelector(".front"), b = card.querySelector(".back"); a.style.position = b.style.position = "relative"; const h = Math.max(a.scrollHeight, b.scrollHeight, 340); a.style.position = b.style.position = ""; card.style.height = h + "px"; };
    fit(); card.querySelectorAll("img").forEach(i => i.onload = fit);
    const flip = () => { card.classList.toggle("flipped"); if (card.classList.contains("flipped")) $("#rate").hidden = false; };
    card.onclick = flip;
    card.onkeydown = e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } };
    m.querySelectorAll("[data-rate]").forEach(b => b.onclick = () => { const k = b.dataset.rate; setMark(q.n, k); f.seen++; if (k === "g") f.ok++; next(); });
    card.focus({ preventScroll: true });
  }
  $("#fstop").onclick = () => { f.done = true; render(); };
}
document.addEventListener("keydown", e => {
  if (view !== "karten" || !flash || flash.done || flashCfg.mode !== "karte") return;
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
        <p style="margin:0;max-width:62ch">Ein Bogen mit <b>30 Fragen</b>: 7 Basisfragen und 23 spezifische See-Fragen, zufällig gezogen. Du hast <b>60 Minuten</b>. Bestanden ist der Bogen ab <b>24 richtigen</b> Antworten. Erst nach dem Abgeben siehst du, was richtig war.</p>
        <div class="row"><button class="btn primary" id="estart">Neuen Bogen beginnen</button><button class="btn" id="eprint">Bogen zum Ausdrucken</button></div>
      </section>
      <section class="panel"><div class="eyebrow">Bisherige Bögen</div>
        ${ex.length ? `<ul class="examlist">${ex.map(e => `<li><span>${fmtDate(e.t)}</span><span class="mono">${e.score} / 30 · Basis ${e.basis}/7</span><span class="pill ${e.pass ? "ok" : "no"}">${e.pass ? "bestanden" : "nicht bestanden"}</span></li>`).join("")}</ul>` : `<p class="muted" style="margin:8px 0 0">Noch keine Prüfung geschrieben.</p>`}
      </section></div>`;
    $("#estart").onclick = () => { exam = { ids: newExamIds(), ans: {}, start: Date.now(), done: false }; exam.order = Object.fromEntries(exam.ids.map(n => [n, shuffle([0, 1, 2, 3])])); confirmSubmit = false; render(); };
    $("#eprint").onclick = () => { printCfg.src = "pruefung"; printCfg.kind = "bogen"; printItems = null; go("drucken"); };
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
        <span class="muted">Basisfragen: ${basisOk} von 7 richtig · ${Math.round((e.end - e.start) / 60000)} Minuten</span></div>
        <div class="row" style="margin-left:auto"><button class="btn" id="eclose">Schließen</button><button class="btn primary" id="eagain">Neuer Bogen</button></div>
      </section>`
      : `<div class="stickyexam"><b class="mono">${answered} / 30 beantwortet</b><span class="muted mono" id="clock"></span><span style="margin-left:auto"></span><button class="btn small" id="ecancel">Abbrechen</button><button class="btn primary small" id="esubmit">Abgeben</button></div>
         ${confirmSubmit ? `<section class="panel confirm row" style="justify-content:space-between"><span>${answered < 30 ? `<b>${30 - answered} Fragen</b> sind noch offen. ` : ""}Bogen jetzt abgeben?</span><span class="row"><button class="btn small" id="cno">Weiter bearbeiten</button><button class="btn primary small" id="cyes">Ja, abgeben</button></span></section>` : ""}`}
    <section class="panel" style="display:grid;gap:22px">
      ${e.ids.map((n, idx) => { const q = byN.get(n); return `<div class="examq" id="eq${n}">
        <div class="qmeta"><span class="mono">Frage ${idx + 1}</span><span>·</span><span>${idx < 7 ? "Basisfrage" : "See-Frage"}</span><span>·</span><span class="mono">Nr. ${n}</span>${e.done ? `<span class="pill ${e.ans[n] === 0 ? "ok" : "no"}">${e.ans[n] === 0 ? "richtig" : e.ans[n] === undefined ? "offen" : "falsch"}</span>` : ""}</div>
        <p class="qtext">${esc(q.q)}</p>${imgTag(q)}
        <div class="opts">${e.order[n].map((o, i) => { let c = ""; if (e.done) { if (o === 0) c = "right"; else if (e.ans[n] === o) c = "wrong"; } else if (e.ans[n] === o) c = "sel";
          return `<button class="opt ${c}" data-n="${n}" data-o="${o}" ${e.done ? "disabled" : ""}><span class="k">${"ABCD"[i]}</span><span>${esc(q.a[o])}</span></button>`; }).join("")}</div>${e.done ? `<div style="margin-top:6px">${markBar(n)}</div>` : ""}</div>`; }).join("")}
    </section>
    ${e.done ? "" : `<div class="row" style="justify-content:flex-end"><button class="btn primary" id="esubmit2">Abgeben</button></div>`}
  </div>`;
  if (e.done) {
    $("#eclose").onclick = () => { exam = null; render(); };
    $("#eagain").onclick = () => { exam = null; render(); $("#estart").click(); };
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
      e.pass = sc >= 24;
      for (const n of e.ids) record(n, e.ans[n] === 0);
      P.exams = P.exams.concat([{ t: e.end, score: sc, basis: e.ids.slice(0, 7).filter(n => e.ans[n] === 0).length, pass: e.pass }]).slice(-30);
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
  if (c.src === "tag") ids = ensureDaily(false).ids.slice();
  else if (c.src === "pruefung") ids = newExamIds();
  else {
    ids = poolFor(c.src, c.nums);
    if (c.count !== "alle" && ids.length > +c.count) ids = shuffle(ids).slice(0, +c.count);
  }
  if (c.src !== "pruefung") ids.sort((a, b) => a - b);
  printItems = ids.map(n => ({ q: byN.get(n), order: shuffle([0, 1, 2, 3]) }));
}
const SRC = [["tag", "Meine heutigen Tagesfragen"], ["pruefung", "Prüfungsbogen (7 Basis + 23 See)"]].concat(POOLS);
function printTitle() {
  return printCfg.kind === "bogen" ? (printCfg.src === "pruefung" ? "Prüfungsbogen SBF-See" : "Übungsbogen SBF-See") : "Lernblatt SBF-See";
}
function vDrucken(m) {
  if (!printItems) buildPrintItems();
  const c = printCfg;
  const needCount = !["tag", "pruefung"].includes(c.src);
  const poolSize = needCount ? poolFor(c.src, c.nums).length : 0;
  m.innerHTML = `<div class="view">
    <div class="noprint"><div class="eyebrow">DIN A4 zum schriftlichen Üben</div><h2>Bögen drucken</h2></div>
    <section class="panel noprint" style="display:grid;gap:16px">
      <div class="row" style="gap:16px;align-items:end">
        <label class="field">Fragen
          <select id="psrc">${SRC.map(([k, l]) => `<option value="${k}" ${c.src === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
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
  $("#psrc").onchange = e => { c.src = e.target.value; c.count = e.target.value.startsWith("mk-") || e.target.value === "nummern" ? "alle" : "10"; buildPrintItems(); render(); };
  if ($("#pcount")) $("#pcount").onchange = e => { c.count = e.target.value; buildPrintItems(); render(); };
  if ($("#pnums")) $("#pnums").onchange = e => { c.nums = e.target.value; buildPrintItems(); render(); };
  m.querySelectorAll("[data-kind]").forEach(b => b.onclick = () => { c.kind = b.dataset.kind; render(); });
  $("#pshuffle").onclick = () => { buildPrintItems(); render(); };
  $("#ppdf").onclick = () => makePdf(printItems, c.kind, printTitle(), (c.kind === "bogen" ? "Bogen" : "Lernblatt") + "-SBF-See-" + today());
  if ($("#pprint")) $("#pprint").onclick = () => window.print();
}
function sheetHTML(items, kind, title, hide, res) {
  const rows = items.map((it, i) => {
    const q = it.q, order = it.order || [0, 1, 2, 3];
    const mark = res && res[q.n] !== undefined ? ` <span class="pill ${res[q.n] ? "ok" : "no"}" style="font-size:.7rem">${res[q.n] ? "richtig" : "falsch"}</span>` : "";
    return `<div class="pq"><div><div class="t">${i + 1}. ${esc(q.q)}<small>Nr. ${q.n}</small>${mark}</div>
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
    if (items.length === 30) { doc.setFontSize(9); doc.setTextColor(90); doc.text("Bestanden ab 24 richtigen Antworten.", M, y); doc.setTextColor(0); }
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
        <div style="margin-top:10px">${markBar(q.n)}</div></div>${imgTag(q, "")}</article>`).join("") : `<div class="panel empty">Keine Frage gefunden.</div>`)
      + (r.length > shown.length ? `<div class="row" style="justify-content:center"><button class="btn" id="cmore">Weitere ${Math.min(40, r.length - shown.length)} von ${r.length - shown.length} anzeigen</button></div>` : "");
    if ($("#cmore")) $("#cmore").onclick = () => { catCfg.limit += 40; list(); };
  };
  $("#cs").oninput = e => { catCfg.s = e.target.value; catCfg.limit = 40; list(); };
  $("#csec").onchange = e => { catCfg.sec = e.target.value; catCfg.limit = 40; list(); };
  $("#clearn").onclick = () => { flashCfg.pool = "nummern"; flashCfg.nums = compactNums(result); flash = null; go("karten"); };
  $("#cprint").onclick = () => { printCfg.src = "nummern"; printCfg.nums = compactNums(result); printCfg.count = "alle"; printItems = null; go("drucken"); };
  list();
}

render();
initSync();
if (!IN_ARTIFACT && "serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
