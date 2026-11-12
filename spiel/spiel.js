// Sonnenhof – Hof (Schritt 1). Reines JavaScript, keine Bibliotheken.
import { GROESSE } from "./img/groessen.js";
import {
  WAREN, PFLANZEN, TIERE, FABRIKEN, WARTESCHLANGE, GEBAEUDE, WEIDEN, FELD_BREITE, FELDPLAETZE, START_FELDER,
  feldPreis, felderMax, FELD_R, BAUTEN, WELT, SEE, xpFuer, SCHEUNE, FREISCHALTUNG, AUFTRAGS_WAREN, SCHRITTE,
  WERKZEUGE, HELFER, START_HELFER, TAGESLOHN, EIL, AUSBAU, DICKICHT, APFEL, BEWOHNER, BEWOHNER_PAUSE_MIN, HERZ_MAX,
  EVENTS, EVENT_STUFEN, EVENT_QUELLEN, FUNDSTUECK, MARKT, ERFOLGE, ERFOLG_LOHN, TOUR, EVENT_AUFGABEN, EVENT_AUFGABEN_AKTIV, EVENT_BONUS_ABSTAND, eventBonusLohn,
  WETTBEWERBE, WETTBEWERB_LOHN, GAESTE, GAST, WAHRZEICHEN, GOLD_QUELLEN, HAUS_STUFEN, ABRISS_ERSTATTUNG, OBSTHOF, FRUCHT,
} from "./daten.js";
import { inselStarten } from "./insel.js";
import { puzzleStarten } from "./puzzle.js";
import { syncStarten } from "./sync.js";
import { lebenStarten } from "./leben.js";
import { minispieleStarten } from "./minispiele.js";

/* ================= Hilfen ================= */
const $ = s => document.querySelector(s);
const jetzt = () => Date.now();
const bildUrl = n => `img/${n}.webp`;
const hoehe = (n, b) => { const g = GROESSE[n]; return g ? b * g[1] / g[0] : b; };
const icon = (ware, cls = "ic") => `<img class="${cls}" src="${bildUrl(WAREN[ware].icon)}" alt="${WAREN[ware].name}">`;
const muenze = (cls = "ic") => `<img class="${cls}" src="${bildUrl("i-muenze")}" alt="Münzen">`;
const stern = (cls = "ic") => `<img class="${cls}" src="${bildUrl("i-stern")}" alt="Erfahrung">`;
const helferIcon = (k, cls = "ic") => GROESSE[HELFER[k].bild] ? `<img class="${cls}" src="${bildUrl(HELFER[k].bild)}" alt="${HELFER[k].name}">` : `<span class="${cls} zeichen" role="img" aria-label="${HELFER[k].name}">${HELFER[k].zeichen}</span>`;
const werkzeugIcon = (k, cls = "ic") => `<img class="${cls}" src="${bildUrl(WERKZEUGE[k].bild)}" alt="${WERKZEUGE[k].name}">`;
const stufe = key => S.ausbau[key] || 1;
const plaetzeVon = key => AUSBAU.plaetze(stufe(key));
const zeitVon = (key, R) => R.zeit * AUSBAU.tempo(stufe(key));
const tierMax = art => TIERE[art].max + (stufe(TIERE[art].stall) - 1) * AUSBAU.stallPlus;
const dauer = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s} s`; };
const zufall = (a, b) => a + Math.random() * (b - a);
const wahl = arr => arr[Math.floor(Math.random() * arr.length)];

/* ================= Spielstand ================= */
const SPEICHER = "sonnenhof-v1";
function neuerStand() {
  const t = jetzt();
  return {
    v: 1, muenzen: 150, xp: 0, level: 1,
    lager: { weizen: 4, futter: 2 }, scheuneLvl: 1,
    felder: Array.from({ length: START_FELDER }, (_, i) => i < 3 ? { p: "weizen", t: t - 1 } : { p: null, t: 0 }),
    tiere: { kuh: [{ t: null }, { t: null }], huhn: [], schaf: [] },
    gebaut: { scheune: 1, tafel: 1, muehle: 1, kuhstall: 1 },
    fabrik: { muehle: { q: [], fertig: [] } },
    bauten: [
      { typ: "haus1", x: 250, y: 560 }, { typ: "laubbaum", x: 120, y: 330 }, { typ: "tanne", x: 190, y: 260 },
      { typ: "busch", x: 880, y: 250 }, { typ: "laubbaum", x: 1660, y: 470 }, { typ: "tanne", x: 1660, y: 640 },
      { typ: "busch", x: 120, y: 1150 }, { typ: "laubbaum", x: 1400, y: 960 }, { typ: "tanne", x: 980, y: 230 },
    ],
    auftraege: [], schritt: 0,
  };
}
let S;
try { S = JSON.parse(localStorage.getItem(SPEICHER) || "null"); } catch { S = null; }
if (!S || S.v !== 1) S = neuerStand();
function ergaenzen(s) {
  s.dekoFrei ??= {}; s.helfer ??= { ...START_HELFER }; s.ausbau ??= {}; s.dickicht ??= [];
  s.werkzeug ??= { axt: 3, schaufel: 2, spitzhacke: 2 };
  s.tag ??= { zuletzt: "", serie: 0 };
  s.bewohner ??= {}; s.pos ??= {}; s.wz ??= {};
  s.felder.forEach((f, i) => { if (f.x == null) { f.x = FELDPLAETZE[i].x; f.y = FELDPLAETZE[i].y; } });
  for (const k of Object.keys(TIERE)) s.tiere[k] ??= []; s.zaehler ??= {}; s.erfolge ??= {};
  // Deko, die auf einem neuen Bauplatz steht, ein Stück zur Seite rücken
  for (const [k, g] of Object.entries(GEBAEUDE)) {
    if (!g.r || s.gebaut[k]) continue;
    for (const b of s.bauten) {
      if (BAUTEN[b.typ].art !== "deko") continue;
      const d = Math.hypot(b.x - g.x, b.y - g.y);
      if (d < g.r + 30) { const w = Math.atan2(b.y - g.y, b.x - g.x) || 0; b.x = Math.round(g.x + Math.cos(w) * (g.r + 70)); b.y = Math.round(g.y + Math.sin(w) * (g.r + 50)); }
    }
  }
  // Dickicht, in dem schon etwas gebaut wurde, gilt als freigeräumt
  for (const z of DICKICHT) if (!s.dickicht.includes(z.id) && s.bauten.some(b => ((b.x - z.x) / z.rx) ** 2 + ((b.y - z.y) / z.ry) ** 2 < 1)) s.dickicht.push(z.id);
  return s;
}
ergaenzen(S);
let speicherTimer = 0, sync = null;
function lokalSichern() { try { localStorage.setItem(SPEICHER, JSON.stringify(S)); } catch {} }
// Nach jeder Aktion: merken, wann sich etwas geändert hat (für den Abgleich zwischen Geräten)
function speichern() {
  S.geaendert = Date.now();
  clearTimeout(speicherTimer);
  speicherTimer = setTimeout(lokalSichern, 200);
  sync?.aenderung();
}

const hausEinwohner = b => Math.round((BAUTEN[b.typ].einwohner || 0) * HAUS_STUFEN[(b.stufe || 1) - 1].faktor);
const einwohner = () => S.bauten.reduce((n, b) => n + hausEinwohner(b), 0);
// Position eines festen Gebäudes (umgestellt oder Standard)
const gpos = key => ({ ...GEBAEUDE[key], ...(S.pos?.[key] || {}) });
const VERSCHIEBBAR = key => S.gebaut[key] && !["steg", "schafweide"].includes(key);
const kapazitaet = () => SCHEUNE.start + (S.scheuneLvl - 1) * SCHEUNE.plus;
const belegt = () => Object.values(S.lager).reduce((a, b) => a + b, 0);
const hat = z => Object.entries(z).every(([k, n]) => (S.lager[k] || 0) >= n);
function nehmen(z) { for (const [k, n] of Object.entries(z)) S.lager[k] = (S.lager[k] || 0) - n; }
function geben(ware, n) {
  if (belegt() + n > kapazitaet()) { meldung("Die Scheune ist voll. Liefere Aufträge oder baue die Scheune aus."); return false; }
  S.lager[ware] = (S.lager[ware] || 0) + n; return true;
}

/* ================= Fortschritt ================= */
function zaehle(k, n = 1) { S.zaehler[k] = (S.zaehler[k] || 0) + n; }
function erfahrung(n) {
  S.xp += n;
  while (S.xp >= xpFuer(S.level)) { S.xp -= xpFuer(S.level); S.level++; levelAuf(); }
}
function ereignis(name) {
  const s = SCHRITTE[S.schritt];
  if (s && (s.ereignis === name || name.startsWith(s.ereignis))) {
    S.muenzen += s.belohnung; S.schritt++;
    meldung(`Geschafft! +${s.belohnung} Münzen`);
    zeichneSchritt();
  }
}

/* ================= Aufträge ================= */
// Kann die Ware gerade hergestellt werden (Level erreicht und Gebäude/Baum vorhanden)?
function herstellbar(w) {
  if (PFLANZEN[w]) return S.level >= PFLANZEN[w].level;
  for (const T of Object.values(TIERE)) if (T.ware === w) return !!(S.gebaut[T.stall] && S.tiere[TIERE_ART(T)]?.length);
  for (const [typ, Fr] of Object.entries(FRUCHT)) if (Fr.ware === w) return S.level >= Fr.level && S.bauten.some(b => b.typ === typ);
  for (const [k, F] of Object.entries(FABRIKEN)) for (const R of F.rezepte)
    if (R.ware === w && S.gebaut[k] && S.level >= R.level && Object.keys(R.zutaten).every(herstellbar)) return true;
  return false;
}
const TIERE_ART = T => Object.keys(TIERE).find(k => TIERE[k] === T);
function verfuegbareWaren() {
  const w = [];
  for (let l = 1; l <= S.level; l++) w.push(...(AUFTRAGS_WAREN[l] || []));
  const ok = w.filter(herstellbar);
  return ok.length ? ok : w;
}
function neuerAuftrag() {
  const pool = verfuegbareWaren().sort(() => Math.random() - .5);
  const n = Math.min(pool.length, Math.random() < .45 ? 1 : Math.random() < .75 ? 2 : 3);
  const waren = {}; let wert = 0;
  for (const w of pool.slice(0, n)) {
    const roh = WAREN[w].wert < 8;
    const m = roh ? 2 + Math.floor(Math.random() * (2 + S.level)) : 1 + Math.floor(Math.random() * 2);
    waren[w] = m; wert += m * WAREN[w].wert;
  }
  const werkzeug = Math.random() < .6 ? wahl(Object.keys(WERKZEUGE)) : null;
  return { waren, muenzen: Math.round(wert * 1.3 + S.level * 2), xp: Math.round(wert / 4) + 2, werkzeug, ab: 0 };
}
function auftraegeAuffuellen() {
  const anzahl = Math.min(6, 3 + Math.floor(S.level / 2));
  while (S.auftraege.length < anzahl) S.auftraege.push(neuerAuftrag());
}
auftraegeAuffuellen();

/* ================= Welt / Kamera ================= */
const view = $("#welt-rahmen"), welt = $("#welt");
welt.style.width = WELT.b + "px"; welt.style.height = WELT.h + "px";
const breite = () => S.obsthof ? WELT.b : OBSTHOF.grenze + 140;
const cam = { s: 1, x: 0, y: 0 };
function grenzen() {
  const W = innerWidth, H = innerHeight;
  // so weit heraus, dass der ganze Hof auf den Bildschirm passt
  const min = Math.max(Math.min(W / breite(), H / WELT.h) * .96, Math.min(.22, Math.max(W / breite(), H / WELT.h)));
  cam.s = Math.min(1.6, Math.max(min, cam.s));
  const w = breite() * cam.s, h = WELT.h * cam.s;
  cam.x = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, cam.x));
  cam.y = h <= H ? (H - h) / 2 : Math.min(0, Math.max(H - h, cam.y));
}
function kameraSetzen() { grenzen(); welt.style.transform = `translate(${cam.x}px,${cam.y}px) scale(${cam.s})`; }
function startKamera() {
  const W = innerWidth, H = innerHeight;
  cam.s = W < 700 ? 0.55 : 0.7;
  const mx = W < 700 ? 640 : 760; cam.x = W / 2 - mx * cam.s; cam.y = H / 2 - 640 * cam.s;
  kameraSetzen();
}
addEventListener("resize", kameraSetzen);
const zuWelt = (cx, cy) => ({ x: (cx - cam.x) / cam.s, y: (cy - cam.y) / cam.s });
function zoom(f, cx, cy) {
  const p = zuWelt(cx, cy); cam.s *= f; grenzen();
  cam.x = cx - p.x * cam.s; cam.y = cy - p.y * cam.s; kameraSetzen();
}

// Ziehen, Zwei-Finger-Zoom, Mausrad. Ein Tippen ohne Bewegung zählt als Klick.
const zeiger = new Map(); let bewegt = false, start = null, pinch = null;
/* ---------- Mit dem Finger über Felder wischen: ernten oder säen ---------- */
let wisch = null; // { art: "ernte" | "saat", p, x, y, aktiv, anzahl }
const werkzeugZeiger = document.createElement("div"); werkzeugZeiger.id = "werkzeug-zeiger"; werkzeugZeiger.hidden = true; document.body.appendChild(werkzeugZeiger);
const SICHEL = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 52 L26 40" stroke="#8a5a2b" stroke-width="7" stroke-linecap="round"/><path d="M24 42 C 10 22, 30 4, 54 10 C 40 12, 28 22, 30 38 Z" fill="#dfe6ee" stroke="#5d6873" stroke-width="3" stroke-linejoin="round"/></svg>`;
function feldBei(cx, cy) {
  const p = zuWelt(cx, cy); let best = -1, bd = 1.1;
  S.felder.forEach((f, i) => { const d = Math.abs((p.x - f.x) / 100) + Math.abs((p.y - (f.y - 55)) / 54); if (d < bd) { bd = d; best = i; } });
  return best;
}
function wischStart(art, p, x, y) {
  wisch = { art, p, x, y, aktiv: false, anzahl: 0, gesehen: new Set() };
  werkzeugZeiger.innerHTML = art === "ernte" ? SICHEL : icon(p, "ic gross");
}
function wischAn(cx, cy) {
  werkzeugZeiger.hidden = false;
  werkzeugZeiger.style.transform = `translate(${cx - 34}px,${cy - 64}px)`;
  const i = feldBei(cx, cy); if (i < 0 || wisch.gesehen.has(i)) return;
  const f = S.felder[i];
  if (wisch.art === "ernte" && f.p && f.t <= jetzt()) { wisch.gesehen.add(i); if (feldErnten(i)) wisch.anzahl++; else wischEnde(); }
  else if (wisch.art === "saat" && !f.p) {
    if (S.level < PFLANZEN[wisch.p].level) return;
    wisch.gesehen.add(i); saeen(i, wisch.p); dinge.get("feld" + i)?.upd(dinge.get("feld" + i)); wisch.anzahl++; leben.ton("treffer", wisch.anzahl % 8);
  }
}
function wischEnde() {
  if (!wisch) return;
  const w = wisch; wisch = null; werkzeugZeiger.hidden = true;
  if (w.aktiv) { bewegt = true; if (w.art === "saat") { saat = w.p; } speichern(); aktualisieren(); }
}
view.addEventListener("pointerdown", e => {
  if (zeiger.size === 0 && !platzieren && !bearbeiten) {
    const i = feldBei(e.clientX, e.clientY);
    if (i >= 0 && e.target.closest(".feld")) {
      const f = S.felder[i];
      if (f.p && f.t <= jetzt()) wischStart("ernte", null, e.clientX, e.clientY);
      else if (!f.p && saat) wischStart("saat", saat, e.clientX, e.clientY);
    }
  }
  zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (zeiger.size === 1) { bewegt = false; start = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; }
  if (zeiger.size === 2) { const [a, b] = [...zeiger.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: cam.s }; bewegt = true; }
});
addEventListener("pointermove", e => {
  if (wisch && zeiger.size <= 1) {
    if (!wisch.aktiv && Math.hypot(e.clientX - wisch.x, e.clientY - wisch.y) > 10) {
      wisch.aktiv = true; bewegt = true;
      if (offen === "saat") schliessen();
      wischAn(wisch.x, wisch.y);
    }
    if (wisch.aktiv) { e.preventDefault(); wischAn(e.clientX, e.clientY); return; }
  }
  if (!zeiger.has(e.pointerId)) { if (platzieren) geistBewegen(e); return; }
  zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (zeiger.size === 2 && pinch) {
    const [a, b] = [...zeiger.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    zoom(pinch.s * d / pinch.d / cam.s, mx, my); return;
  }
  if (!start) return;
  const dx = e.clientX - start.x, dy = e.clientY - start.y;
  if (!bewegt && Math.hypot(dx, dy) > 8) { bewegt = true; view.classList.add("zieht"); }
  if (bewegt) { cam.x = start.cx + dx; cam.y = start.cy + dy; kameraSetzen(); }
});
function zeigerEnde(e) {
  wischEnde();
  zeiger.delete(e.pointerId);
  if (zeiger.size < 2) pinch = null;
  if (zeiger.size === 0) { view.classList.remove("zieht"); start = null; }
}
addEventListener("pointerup", zeigerEnde); addEventListener("pointercancel", zeigerEnde);
view.addEventListener("wheel", e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX, e.clientY); }, { passive: false });
let bearbeiten = false;
function bearbeitenAn() { schliessen(); bearbeiten = true; document.body.classList.add("bearbeiten"); $("#bearbeitleiste").hidden = false; }
function bearbeitenAus() { bearbeiten = false; document.body.classList.remove("bearbeiten"); $("#bearbeitleiste").hidden = true; schliessen(); }
view.addEventListener("click", e => {
  if (bewegt) return;
  const p = zuWelt(e.clientX, e.clientY);
  if (platzieren) { geistSetzen(p.x, p.y); return; }
  const el = e.target.closest(".ding");
  if (bearbeiten && el) {
    const id = el.dataset.id;
    if (/^bau\d+$/.test(id)) { bauTipp(+id.slice(3)); return; }
    if (/^feld\d+$/.test(id)) { feldBearbeiten(+id.slice(4)); return; }
    if (GEBAEUDE[id] && VERSCHIEBBAR(id)) { gebaeudeBearbeiten(id); return; }
    meldung("Das kann man nicht umstellen."); return;
  }
  if (el && dinge.has(el.dataset.id)) { dinge.get(el.dataset.id).tipp(e); return; }
  if (offen) schliessen();
});

/* ================= Boden ================= */
function zeichneBoden() {
  const c = $("#boden"); c.width = WELT.b; c.height = WELT.h;
  const g = c.getContext("2d");
  let seed = 11; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gr = g.createRadialGradient(800, 600, 100, 800, 700, 1200);
  gr.addColorStop(0, "#8cc95a"); gr.addColorStop(1, "#6eae42");
  g.fillStyle = gr; g.fillRect(0, 0, WELT.b, WELT.h);
  const flaeche = WELT.b * WELT.h / (1800 * 1400);
  const imSee = (x, y, rand = 1.1) => ((x - SEE.x) / (SEE.rx * rand)) ** 2 + ((y - SEE.y) / (SEE.ry * rand)) ** 2 < 1;
  for (let k = 0; k < 160 * flaeche; k++) {
    g.fillStyle = r() < .5 ? "rgba(255,255,220,.06)" : "rgba(40,80,10,.06)";
    g.beginPath(); g.ellipse(r() * WELT.b, r() * WELT.h, 40 + r() * 90, 20 + r() * 40, 0, 0, 7); g.fill();
  }
  // See am Steg
  const see = (dx, dy, wx = 0) => { g.beginPath(); for (let k = 0; k <= 48; k++) { const w = k / 48 * Math.PI * 2, wob = 1 + Math.sin(w * 3) * .05 + Math.cos(w * 5) * .03;
    const px = SEE.x + Math.cos(w) * (SEE.rx + wx) * wob + dx, py = SEE.y + Math.sin(w) * (SEE.ry + wx * .55) * wob + dy; k ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); };
  see(0, 0, 34); g.fillStyle = "#e7d39b"; g.fill();
  see(0, 0); const wg = g.createLinearGradient(SEE.x - SEE.rx, SEE.y - SEE.ry, SEE.x + SEE.rx, SEE.y + SEE.ry);
  wg.addColorStop(0, "#5cc2dc"); wg.addColorStop(1, "#2f8fc0"); g.fillStyle = wg; g.fill();
  g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 3; g.stroke();
  for (let k = 0; k < 30; k++) {
    const w = r() * Math.PI * 2, rr = Math.sqrt(r()) * .8, x = SEE.x + Math.cos(w) * SEE.rx * rr, y = SEE.y + Math.sin(w) * SEE.ry * rr;
    g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 8 + r() * 14, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  }
  // Fluss zum Obsthof
  { const [a, b] = OBSTHOF.fluss, m = (a + b) / 2;
    const ufer = (off, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath();
      for (let y = 0; y <= WELT.h; y += 20) { const x = m + Math.sin(y / 160) * 22 + off; y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); };
    g.lineCap = "round"; ufer(0, "#e7d39b", b - a + 34); ufer(0, "#4fb3d6", b - a);
    for (let k = 0; k < 40; k++) { const y = r() * WELT.h, x = m + Math.sin(y / 160) * 22 + (r() - .5) * 50;
      g.strokeStyle = "rgba(255,255,255,.45)"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 6 + r() * 10, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    // Brücke
    const B = OBSTHOF.bruecke; g.save(); g.translate(B.x, B.y);
    g.fillStyle = "#8a5a2b"; g.fillRect(-90, -34, 180, 68);
    for (let k = -84; k < 84; k += 14) { g.fillStyle = k % 28 ? "#c98b4b" : "#b9783c"; g.fillRect(k, -30, 12, 60); }
    g.fillStyle = "#6b4420"; g.fillRect(-92, -40, 184, 8); g.fillRect(-92, 32, 184, 8); g.restore(); }
  // Wege
  g.lineCap = "round"; g.lineJoin = "round";
  const wege = [
    [[1270, 340], [1180, 420], [1060, 500], [1010, 600], [965, 790], [900, 900], [760, 1000], [560, 980], [330, 910]],
    [[1010, 600], [1190, 610], [1385, 730], [1500, 900], [1600, 1130]],
    [[965, 790], [1080, 900], [1130, 990]],
    [[560, 980], [460, 760], [300, 580]],
    [[1385, 730], [1800, 780], [2200, 700], [2550, 760]],
    [[1130, 990], [1060, 1350], [980, 1700], [1050, 1990]],
    [[1980, 1200], [2050, 1500], [2400, 1700]],
    [[1800, 780], [1980, 1200]],
    [[2550, 760], [2650, 980], [2850, 1000], [3150, 760]],
    [[2850, 1000], [3300, 1060], [3550, 1100], [3800, 1000]],
    [[3300, 1060], [3200, 1470], [3500, 1750]],
  ];
  for (const [w, col] of [[64, "#c7a36c"], [52, "#dcc090"]]) for (const weg of wege) {
    g.strokeStyle = col; g.lineWidth = w; g.beginPath(); weg.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
  }
  for (const weg of wege) for (let k = 0; k < 40; k++) {
    const i = Math.floor(r() * (weg.length - 1)), f = r(), [a, b] = [weg[i], weg[i + 1]];
    g.fillStyle = r() < .5 ? "#cfae78" : "#ead6a8"; g.beginPath();
    g.ellipse(a[0] + (b[0] - a[0]) * f + (r() - .5) * 34, a[1] + (b[1] - a[1]) * f + (r() - .5) * 20, 5 + r() * 6, 3 + r() * 3, 0, 0, 7); g.fill();
  }
  // Weiden und Ackerfläche
  for (const w of Object.values(WEIDEN)) {
    g.fillStyle = "rgba(160,215,95,.55)"; g.beginPath(); g.ellipse(w.x, w.y, w.rx + 20, w.ry + 14, 0, 0, 7); g.fill();
  }
  g.fillStyle = "rgba(95,70,30,.16)"; g.beginPath(); g.ellipse(620, 560, 330, 190, 0, 0, 7); g.fill();
  // Grasbüschel und Blumen
  for (let k = 0; k < 1500 * flaeche; k++) {
    const x = r() * WELT.b, y = r() * WELT.h; if (imSee(x, y) || (x > OBSTHOF.fluss[0] - 20 && x < OBSTHOF.fluss[1] + 20)) continue;
    g.strokeStyle = r() < .5 ? "#5e9935" : "#a3d46c"; g.lineWidth = 2;
    for (let b = -1; b <= 1; b++) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + b * 3, y - 5, x + b * 5, y - 9 - r() * 4); g.stroke(); }
  }
  const fc = ["#fff", "#ffd84d", "#ff9fb2", "#c9a2ff", "#9fd0ff"];
  for (let k = 0; k < 260 * flaeche; k++) {
    const x = r() * WELT.b, y = r() * WELT.h; if (Math.hypot(x - 620, (y - 560) * 1.7) < 380) continue;
    if (imSee(x, y) || (x > OBSTHOF.fluss[0] - 20 && x < OBSTHOF.fluss[1] + 20)) continue;
    g.fillStyle = fc[k % fc.length];
    for (let p = 0; p < 5; p++) { const a = p * 1.2566; g.beginPath(); g.arc(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 2.4, 0, 7); g.fill(); }
    g.fillStyle = "#f5b82e"; g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill();
  }
}

/* ================= Dinge in der Welt ================= */
const dinge = new Map();
function neuesDing(id, bild, x, y, breite, opt = {}) {
  const el = document.createElement("div");
  el.className = "ding " + (opt.cls || ""); el.dataset.id = id;
  const h = hoehe(bild, breite);
  el.style.cssText = `left:${x - breite / 2}px;top:${y - h}px;width:${breite}px;height:${h}px;z-index:${Math.round(y)}`;
  el.innerHTML = `<img class="spr" src="${bildUrl(bild)}" alt="" draggable="false"><div class="ov"></div>`;
  welt.appendChild(el);
  const d = { id, el, img: el.firstChild, ov: el.lastChild, x, y, breite, h, bild, tipp: opt.tipp || (() => {}), upd: opt.upd || (() => {}), ovHtml: "" };
  dinge.set(id, d); return d;
}
function bildWechseln(d, bild) {
  if (d.bild === bild) return;
  d.bild = bild; d.img.src = bildUrl(bild);
  const h = hoehe(bild, d.breite); d.h = h;
  d.el.style.height = h + "px"; d.el.style.top = (d.y - h) + "px";
}
function overlay(d, html) { if (d.ovHtml !== html) { d.ovHtml = html; d.ov.innerHTML = html; } }
function huepf(d) { d.el.classList.remove("huepf"); void d.el.offsetWidth; d.el.classList.add("huepf"); }
const uhr = (rest, ges, oben = 0) =>
  `<div class="uhr" style="top:${oben}px"><span>${dauer(rest)}</span><span class="balken"><i style="width:${Math.min(100, 100 - rest / ges / 10)}%"></i></span></div>`;
const blase = (inhalt, oben = -46) => `<div class="blase" style="top:${oben}px">${inhalt}</div>`;

function weltAufbauen() {
  naechsterFeldplatzCache = null; naechsterFeldplatzCache = naechsterFeldplatz();
  for (const d of dinge.values()) d.el.remove();
  dinge.clear();
  // Felder
  S.felder.forEach((f, i) => {
    const p = S.felder[i];
    neuesDing("feld" + i, "feld-leer", p.x, p.y, FELD_BREITE, {
      cls: "feld",
      tipp: () => feldTipp(i),
      upd: d => {
        const f = S.felder[i], t = jetzt();
        if (!f.p) { bildWechseln(d, "feld-leer"); overlay(d, ""); return; }
        if (f.t > t) { bildWechseln(d, "feld-jung"); overlay(d, uhr(f.t - t, PFLANZEN[f.p].zeit, d.h * .2)); d.el.classList.remove("reif"); }
        else { bildWechseln(d, PFLANZEN[f.p].bild); overlay(d, ""); d.el.classList.add("reif"); }
      },
    });
  });
  const naechster = naechsterFeldplatz();
  if (naechster) {
    const p = naechster;
    const d = neuesDing("neuesfeld", "feld-leer", p.x, p.y, FELD_BREITE, { cls: "bauplatz", tipp: feldKaufen });
    overlay(d, `<div class="schild">${muenze("ic klein")} ${feldPreis(S.felder.length)}<br><small>Neues Feld</small></div>`);
  }
  // feste Gebäude
  for (const [key, g] of Object.entries(GEBAEUDE)) {
    if (key === "schafweide") continue;
    if (g.obsthof && !S.obsthof) continue;
    if (!S.gebaut[key] && key !== "steg") { bauplatz(key, g); continue; }
    const q = gpos(key);
    neuesDing(key, g.bild, q.x, q.y, g.breite, { cls: "gebaeude", tipp: () => gebaeudeTipp(key), upd: d => gebaeudeUpd(key, d) });
  }
  if (!S.gebaut.schafweide) bauplatz("schafweide", GEBAEUDE.schafweide);
  else weideZaun();
  // Tiere
  for (const [art, liste] of Object.entries(S.tiere)) liste.forEach((_, i) => tierErzeugen(art, i));
  // Dickicht am Rand
  for (const z of DICKICHT) if (!S.dickicht.includes(z.id)) dickichtErzeugen(z);
  // Bewohner
  for (const [k, B] of Object.entries(BEWOHNER)) {
    if (S.level < B.level) continue;
    neuesDing("bewohner-" + k, B.bild, B.x, B.y, 64, { cls: "bewohner", tipp: () => bewohnerPanel(k),
      upd: d => { const w = wunsch(k); overlay(d, w && w.ab <= jetzt() ? blase(`<img class="ic mittel" src="${bildUrl("i-herz")}" alt="Wunsch">`, -44) : ""); } });
  }
  // Obsthof: Nebel und Kaufschild, solange er nicht gekauft ist
  $("#nebel").hidden = !!S.obsthof;
  if (!S.obsthof) {
    const d = neuesDing("obsthof-schild", "tafel", OBSTHOF.bruecke.x + 150, OBSTHOF.bruecke.y + 60, 110, { cls: "gebaeude", tipp: () => obsthofPanel() });
    overlay(d, `<div class="schild" style="top:-30px">${S.level >= OBSTHOF.level ? `${muenze("ic klein")} ${OBSTHOF.preis}` : `🔒 Level ${OBSTHOF.level}`}<br><small>Obsthof</small></div>`);
  }
  // Lieferwagen für Touren
  if (S.level >= TOUR.level) neuesDing("tour", "lieferwagen", TOUR.x, TOUR.y, TOUR.breite, { cls: "gebaeude", tipp: () => tourPanel(),
    upd: d => { const T = tourStand(); d.el.classList.toggle("weg", !!T.unterwegs);
      const n = T.kisten.filter(k => !k.voll && (S.lager[k.w] || 0) >= k.n).length;
      overlay(d, T.unterwegs ? uhr(T.unterwegs - jetzt(), TOUR.fahrtMin * 60, -10) : n ? blase(`<b class="zahl">${n}</b>`, -30) : ""); } });
  // Wahrzeichen
  for (const [k, W] of Object.entries(WAHRZEICHEN)) {
    if (W.obsthof && !S.obsthof) continue;
    const ab = S.wz[k] || 0, fertig = ab >= W.abschnitte.length;
    if (S.level < W.level && !ab) {
      const d = neuesDing("wz-" + k, "kachel", W.x, W.y, 150, { cls: "bauplatz", tipp: () => wahrzeichenPanel(k) });
      overlay(d, `<div class="schild">🔒 Level ${W.level}<br><small>${W.name}</small></div>`);
      continue;
    }
    const d = neuesDing("wz-" + k, fertig ? W.bild : "baustelle", W.x, W.y, fertig ? W.breite : 200, { cls: fertig ? "gebaeude wahrzeichen" : "gebaeude", tipp: () => wahrzeichenPanel(k) });
    if (!fertig) overlay(d, `<div class="schild" style="top:-20px">🏗️ ${ab}/${W.abschnitte.length}<br><small>${W.name}</small></div>`);
  }
  // Gast an der Auftragstafel
  if (S.gast?.waren && S.gast.bis > jetzt()) {
    const T = gpos("tafel"), Gs = GAESTE[S.gast.g];
    const d = neuesDing("gast", Gs.bild, T.x + 95, T.y + 20, 70, { cls: "bewohner gast", tipp: () => gastPanel() });
    overlay(d, blase(`<b class="zahl">✨</b>`, -44));
  }
  // Fundstücke des Jahreszeiten-Events
  setTimeout(fundstueckeZeigen, 0);
  // Lieferwagen, solange ein Eilauftrag läuft
  neuesDing("lieferwagen", "lieferwagen", 1090, 905, 120, { cls: "lieferwagen", tipp: () => auftragsPanel(),
    upd: d => { d.el.hidden = !eilAktiv(); } });
  // Häuser und Deko
  S.bauten.forEach((b, i) => {
    const B = BAUTEN[b.typ];
    const Fr = FRUCHT[b.typ];
    if (Fr) {
      neuesDing("bau" + i, B.bild, b.x, b.y, B.breite, { cls: B.art, tipp: () => apfelTipp(i),
        upd: d => {
          if (S.level < Fr.level) { overlay(d, ""); return; }
          const t = S.bauten[i]?.t || 0;
          overlay(d, t <= jetzt() ? blase(icon(Fr.ware, "ic mittel"), -36) : uhr(t - jetzt(), Fr.zeit, d.h * .15));
        } });
    } else {
      const d = neuesDing("bau" + i, B.bild, b.x, b.y, B.breite * (1 + ((b.stufe || 1) - 1) * .06), { cls: B.art, tipp: () => bauTipp(i) });
      if (B.art === "haus" && (b.stufe || 1) > 1) overlay(d, `<div class="hausstufe">${"★".repeat(b.stufe)}</div>`);
    }
  });
}
function bauplatz(key, g) {
  const d = neuesDing(key, "kachel", g.x, g.y, g.breite * .8, { cls: "bauplatz", tipp: () => bauplatzTipp(key) });
  const offen = S.level >= g.level;
  overlay(d, `<div class="schild">${offen ? `${muenze("ic klein")} ${g.preis}` : `🔒 Level ${g.level}`}<br><small>${g.name}</small></div>`);
}
function dickichtErzeugen(z) {
  const breite = Math.max(z.rx * 2.4, z.ry * 3.4);
  const d = neuesDing(`dickicht-${z.id}`, "dickicht", z.x, z.y + z.ry * .9, breite, { cls: "dickicht", tipp: () => dickichtTipp(z) });
  overlay(d, `<div class="schild" style="top:38%">${S.level >= z.level ? `${muenze("ic klein")} ${z.muenzen}` : `🔒 Level ${z.level}`}<br><small>Dickicht</small></div>`);
}
function dickichtTipp(z) {
  oeffnen("dickicht:" + z.id, () => {
    const lv = S.level >= z.level, geld = S.muenzen >= z.muenzen;
    const wz = Object.entries(z.werkzeug).every(([w, n]) => (S.werkzeug[w] || 0) >= n);
    return `<div class="kopf"><h2>Dickicht freiräumen</h2>${zu()}</div>
      <p>Hinter den Bäumen wartet freies Land für neue Häuser und Deko.</p>
      <ul class="beding">
        <li class="${lv ? "ok" : ""}">Level ${z.level}</li>
        <li class="${geld ? "ok" : ""}">${muenze("ic klein")} ${z.muenzen}</li>
        <li class="${wz ? "ok" : ""}">${Object.entries(z.werkzeug).map(([w, n]) => `${werkzeugIcon(w, "ic klein")} ${n} ${WERKZEUGE[w].name} (hast ${S.werkzeug[w] || 0})`).join(" · ")}</li>
      </ul>
      ${!wz ? `<p class="hinweis">Werkzeuge gibt es für Aufträge, im Puzzle, in der Tagesbelohnung und auf der Insel.</p>` : ""}
      <button class="los" data-aktion="dickicht" data-id="${z.id}" ${lv && geld && wz ? "" : "disabled"}>Freiräumen</button>`;
  });
}
function weideZaun() {
  const w = WEIDEN.schaf;
  const stuecke = [];
  for (let k = 0; k < 4; k++) stuecke.push({ x: w.x - w.rx - 10 + k * 62, y: w.y + 20 + k * 28, flip: true });
  for (let k = 0; k < 4; k++) stuecke.push({ x: w.x + 60 + k * 62, y: w.y + 104 - k * 28, flip: false });
  stuecke.forEach((s, k) => {
    const d = neuesDing("weidezaun" + k, "zaun", s.x, s.y, 74, { cls: "zaunteil", tipp: () => gebaeudeTipp("schafweide") });
    if (s.flip) d.img.style.transform = "scaleX(-1)";
  });
}

/* ---------- Tiere ---------- */
function tierErzeugen(art, i) {
  const T = TIERE[art], w = WEIDEN[art];
  const pos = () => { const a = zufall(0, Math.PI * 2), r = Math.sqrt(Math.random()); return { x: w.x + Math.cos(a) * w.rx * r, y: w.y + Math.sin(a) * w.ry * r + 20 }; };
  const p = pos();
  const d = neuesDing(`${art}${i}`, T.bild, p.x, p.y, T.breite, {
    cls: "tier",
    tipp: () => tierTipp(art, i, d),
    upd: d => {
      const t = S.tiere[art][i]; if (!t) return;
      if (t.t === null) overlay(d, blase(icon("futter", "ic mittel"), -40));
      else if (t.t > jetzt()) overlay(d, uhr(t.t - jetzt(), T.zeit, -18));
      else overlay(d, blase(icon(T.ware, "ic mittel"), -40));
    },
  });
  if (Math.random() < .5) d.img.style.transform = "scaleX(-1)";
  d.el.style.animationDelay = `${-Math.random() * 3}s`;
  const laufen = () => {
    if (!dinge.has(d.id)) return;
    const q = pos();
    d.img.style.transform = q.x < d.x ? "" : "scaleX(-1)";
    d.x = q.x; d.y = q.y;
    d.el.style.left = (q.x - d.breite / 2) + "px"; d.el.style.top = (q.y - d.h) + "px"; d.el.style.zIndex = Math.round(q.y);
    setTimeout(laufen, zufall(4000, 9000));
  };
  setTimeout(laufen, zufall(1500, 6000));
}
function tierTipp(art, i, d) {
  const T = TIERE[art], t = S.tiere[art][i];
  if (t.t === null) {
    if (!(S.lager.futter > 0)) { meldung("Kein Futter da. Stelle in der Futtermühle welches her."); return; }
    S.lager.futter--; t.t = jetzt() + T.zeit * 1000; huepf(d); ereignis("fuettern");
  } else if (t.t > jetzt()) {
    meldung(`${T.name}: noch ${dauer(t.t - jetzt())}`);
  } else {
    if (!geben(T.ware, 1)) return;
    t.t = null; erfahrung(T.xp); huepf(d); fliegt(d, T.ware, 1); ereignis("sammeln"); zaehle("tiere");
  }
  speichern(); aktualisieren();
}

/* ---------- Felder ---------- */
let saat = null; // gewählte Pflanze für schnelles Säen
function feldErnten(i) {
  const f = S.felder[i], d = dinge.get("feld" + i);
  if (!f?.p || f.t > jetzt()) return false;
  const P = PFLANZEN[f.p];
  if (!geben(f.p, P.ertrag)) return false;
  fliegt(d, f.p, P.ertrag); erfahrung(P.xp); ereignis("ernte"); zaehle("ernte");
  if (Math.random() < EVENT_QUELLEN.ernteChance) eventGeben(1, d);
  f.p = null; f.t = 0; huepf(d); d?.upd(d);
  return true;
}
function feldTipp(i) {
  const f = S.felder[i];
  if (f.p && f.t <= jetzt()) {
    if (!feldErnten(i)) return;
  } else if (f.p) {
    meldung(`${WAREN[f.p].name} wächst noch ${dauer(f.t - jetzt())}`); return;
  } else if (saat) {
    saeen(i, saat);
  } else {
    saatAuswahl(i); return;
  }
  speichern(); aktualisieren();
}
const wzFertig = k => (S.wz?.[k] || 0) >= WAHRZEICHEN[k].abschnitte.length;
const feldFaktor = () => wzFertig("windmuehle") ? .9 : 1;
const lieferFaktor = () => wzFertig("leuchtturm") ? 1.15 : 1;
const auftragFaktor = () => wzFertig("rathaus") ? 1.15 : 1;
function saeen(i, p) {
  const f = S.felder[i]; f.p = p; f.t = jetzt() + PFLANZEN[p].zeit * 1000 * feldFaktor(); huepf(dinge.get("feld" + i));
}
function saatAuswahl(i) {
  oeffnen("saat", () => `
    <div class="kopf"><h2>Was möchtest du säen?</h2>${zu()}</div>
    <div class="raster3">${Object.entries(PFLANZEN).map(([k, P]) => {
      const frei = S.level >= P.level;
      return `<button class="karte" data-aktion="saeen" data-p="${k}" data-i="${i}" ${frei ? "" : "disabled"}>
        ${icon(k, "ic gross")}<b>${P.name || WAREN[k].name}</b>
        <small>${frei ? `${dauer(P.zeit * 1000)} · ergibt ${P.ertrag}` : `ab Level ${P.level}`}</small></button>`;
    }).join("")}</div>
    <p class="hinweis">Tipp: Zieh eine Pflanze mit dem Finger über mehrere leere Felder. Reife Felder erntest du, indem du mit dem Finger darüberwischst.</p>`);
}
document.querySelector("#fenster").addEventListener("pointerdown", e => {
  const k = e.target.closest('.karte[data-aktion="saeen"]'); if (!k || k.disabled) return;
  wischStart("saat", k.dataset.p, e.clientX, e.clientY);
});
// Nächster freier Platz im Feldraster (für den „Neues Feld“-Platz neben den Feldern)
const FELD_DEF = { name: "Feld", bild: "feld-leer", breite: FELD_BREITE, r: FELD_R };
function naechsterFeldplatz() {
  if (S.felder.length >= felderMax(S.level)) return null;
  return FELDPLAETZE.find(p => S.felder.every(f => Math.hypot(f.x - p.x, f.y - p.y) > 60) && platzFrei(p.x, p.y, FELD_DEF, true)) || null;
}
function feldKaufen() {
  const preis = feldPreis(S.felder.length);
  oeffnen("feldkauf", () => `
    <div class="kopf"><h2>Neues Feld</h2>${zu()}</div>
    <p>Ein weiteres Feld für mehr Ernte.</p>
    <button class="los" data-aktion="feldkaufen" ${S.muenzen >= preis && naechsterFeldplatzCache ? "" : "disabled"}>${muenze()} ${preis} – Hier kaufen</button>
    <button class="los zweit" data-aktion="feldfrei" ${S.muenzen >= preis ? "" : "disabled"}>Woanders aufstellen</button>`);
}

/* ---------- Gebäude ---------- */
function gebaeudeUpd(key, d) {
  if (FABRIKEN[key]) {
    fabrikWeiter(key);
    const F = S.fabrik[key];
    if (F.fertig.length) overlay(d, blase(icon(F.fertig[0].ware, "ic mittel"), -10));
    else if (F.q.length) {
      const q = F.q[0], R = FABRIKEN[key].rezepte[q.r];
      overlay(d, uhr(q.ende - jetzt(), q.zeit || R.zeit, -6) + `<div class="rauch"><i></i><i></i><i></i></div>`);
    } else overlay(d, "");
  } else if (key === "tafel") {
    const n = S.auftraege.filter(a => a.ab <= jetzt() && hat(a.waren)).length;
    overlay(d, eilAktiv() ? blase(`<b class="zahl eil">⏰</b>`, -30) : n ? blase(`<b class="zahl">${n}</b>`, -30) : "");
  } else if (Object.values(TIERE).some(T => T.stall === key) && key !== "schafweide") {
    const art = Object.keys(TIERE).find(k => TIERE[k].stall === key);
    const fertig = S.tiere[art].filter(t => t.t !== null && t.t <= jetzt()).length;
    overlay(d, fertig ? blase(icon(TIERE[art].ware, "ic mittel"), -10) : "");
  }
}
function fabrikWeiter(key) {
  const F = S.fabrik[key]; if (!F) return;
  while (F.q.length && F.q[0].ende <= jetzt()) {
    const q = F.q.shift(), R = FABRIKEN[key].rezepte[q.r];
    F.fertig.push({ ware: R.ware, menge: R.menge, xp: Math.ceil(R.zeit / 12) });
  }
}
function gebaeudeTipp(key) {
  if (FABRIKEN[key]) {
    fabrikWeiter(key);
    if (S.fabrik[key].fertig.length) { abholen(key); return; }
    fabrikPanel(key);
  } else if (key === "tafel") auftragsPanel();
  else if (key === "scheune") lagerPanel();
  else if (Object.values(TIERE).some(T => T.stall === key)) stallPanel(Object.keys(TIERE).find(k => TIERE[k].stall === key));
  else if (key === "steg") oeffnen("steg", () => `
    <div class="kopf"><h2>Steg zur Insel</h2>${zu()}</div>
    <p>Mit dem Boot geht es auf Entdeckungsreise: Wege freiräumen, Schätze finden, Brücken reparieren und Quests erfüllen.</p>
    <div class="reiseziele">
      <button class="reiseziel" data-aktion="zurinsel" data-w="sommer" ${S.level >= 2 ? "" : "disabled"}><img src="${bildUrl("insel")}" alt=""><b>Abenteuerinsel</b><small>${S.level >= 2 ? "Losfahren" : "ab Level 2"}</small></button>
      <button class="reiseziel" data-aktion="zurinsel" data-w="winter" ${S.level >= 8 ? "" : "disabled"}><img src="${bildUrl("schneeinsel")}" alt=""><b>Schneeinsel</b><small>${S.level >= 8 ? "Losfahren · wertvollere Schätze" : "🔒 ab Level 8"}</small></button>
      <button class="reiseziel" data-aktion="zurinsel" data-w="wueste" ${S.level >= 40 ? "" : "disabled"}><img src="${bildUrl("wuesteninsel")}" alt=""><b>Wüsteninsel</b><small>${S.level >= 40 ? "Losfahren · Goldbarren!" : "🔒 ab Level 40"}</small></button>
    </div>`);
}
function abholen(key) {
  const F = S.fabrik[key], e = F.fertig[0];
  if (!geben(e.ware, e.menge)) return;
  F.fertig.shift(); erfahrung(e.xp); zaehle("fabrik"); fliegt(dinge.get(key), e.ware, e.menge); huepf(dinge.get(key));
  speichern(); aktualisieren();
}
function fabrikPanel(key) {
  oeffnen("fabrik:" + key, () => {
    fabrikWeiter(key);
    const F = S.fabrik[key], Fa = FABRIKEN[key];
    const plaetze = [];
    const P = plaetzeVon(key);
    for (let k = 0; k < P; k++) {
      if (k < F.fertig.length) plaetze.push(`<button class="platz fertig" data-aktion="abholen" data-k="${key}">${icon(F.fertig[k].ware)}<small>abholen</small></button>`);
      else {
        const qi = k - F.fertig.length;
        if (qi < F.q.length) plaetze.push(`<div class="platz laeuft">${icon(Fa.rezepte[F.q[qi].r].ware)}<small>${qi === 0 ? dauer(F.q[0].ende - jetzt()) : "wartet"}</small></div>`);
        else plaetze.push(`<div class="platz"><small>frei</small></div>`);
      }
    }
    const voll = F.q.length + F.fertig.length >= P;
    return `<div class="kopf"><h2>${Fa.name} <small class="stufe-tag">Stufe ${stufe(key)}</small></h2>${zu()}</div>
      <div class="rezepte">${Fa.rezepte.map((R, r) => {
        const frei = S.level >= R.level;
        return `<div class="rezept ${frei ? "" : "gesperrt"}">
          <div class="aus">${icon(R.ware, "ic gross")}<span>${R.menge > 1 ? "×" + R.menge : ""}</span></div>
          <div class="ein">${Object.entries(R.zutaten).map(([w, n]) => `<span class="${(S.lager[w] || 0) >= n ? "" : "fehlt"}">${icon(w)}${S.lager[w] || 0}/${n}</span>`).join("")}
            <small>${frei ? dauer(zeitVon(key, R) * 1000) : "ab Level " + R.level}</small></div>
          <button class="los" data-aktion="herstellen" data-k="${key}" data-r="${r}" ${frei && !voll && hat(R.zutaten) ? "" : "disabled"}>Herstellen</button>
        </div>`;
      }).join("")}</div>
      <div class="plaetze">${plaetze.join("")}</div>
      ${ausbauKnopf(key)}`;
  });
}
function ausbauKnopf(key) {
  const st = stufe(key);
  if (st >= AUSBAU.maxStufe) return `<p class="hinweis">Höchste Stufe erreicht.</p>`;
  const lv = AUSBAU.stufeLevel(st + 1);
  if (S.level < lv) return `<p class="hinweis">Stufe ${st + 1} kannst du ab Level ${lv} ausbauen.</p>`;
  const istStall = !FABRIKEN[key];
  const preis = istStall ? AUSBAU.stallPreis(st) : AUSBAU.fabrikPreis(st), wz = istStall ? 0 : AUSBAU.fabrikWerkzeug(st);
  const ok = S.muenzen >= preis && (S.werkzeug.spitzhacke || 0) >= wz && (S.werkzeug.axt || 0) >= wz;
  const nutzen = istStall ? `+${AUSBAU.stallPlus} Plätze für Tiere` : `${AUSBAU.plaetze(st + 1)} Plätze, ${Math.round((1 - AUSBAU.tempo(st + 1)) * 100)} % schneller`;
  return `<button class="los zweit" data-aktion="ausbauen" data-k="${key}" ${ok ? "" : "disabled"}>
    Auf Stufe ${st + 1} ausbauen (${nutzen}) · ${muenze("ic klein")} ${preis}${wz ? ` ${werkzeugIcon("spitzhacke", "ic klein")}${wz} ${werkzeugIcon("axt", "ic klein")}${wz}` : ""}</button>`;
}
function stallPanel(art) {
  oeffnen("stall:" + art, () => {
    const T = TIERE[art], liste = S.tiere[art];
    const hungrig = liste.filter(t => t.t === null).length, fertig = liste.filter(t => t.t !== null && t.t <= jetzt()).length;
    const max = tierMax(art);
    return `<div class="kopf"><h2>${GEBAEUDE[T.stall].name} <small class="stufe-tag">Stufe ${stufe(T.stall)}</small></h2>${zu()}</div>
      <p>${liste.length} ${liste.length === 1 ? T.name : T.mehrzahl} · 1 ${icon("futter", "ic klein")} ergibt 1 ${icon(T.ware, "ic klein")} in ${dauer(T.zeit * 1000)}</p>
      <div class="knoepfe">
        <button class="los" data-aktion="allefuettern" data-a="${art}" ${hungrig && S.lager.futter ? "" : "disabled"}>Alle füttern (${hungrig})</button>
        <button class="los" data-aktion="allesammeln" data-a="${art}" ${fertig ? "" : "disabled"}>Alles einsammeln (${fertig})</button>
      </div>
      <button class="los zweit" data-aktion="tierkaufen" data-a="${art}" ${liste.length < max && S.muenzen >= T.preis ? "" : "disabled"}>
        ${liste.length < max ? `${T.name} kaufen (${liste.length}/${max}) · ${muenze("ic klein")} ${T.preis}` : `Der Stall ist voll (${max} Plätze)`}</button>
      ${ausbauKnopf(T.stall)}`;
  });
}
function bauplatzTipp(key) {
  const g = GEBAEUDE[key];
  oeffnen("bauplatz:" + key, () => {
    const lv = S.level >= g.level, ew = einwohner() >= g.einwohner, geld = S.muenzen >= g.preis;
    return `<div class="kopf"><h2>${g.name} bauen</h2>${zu()}</div>
      ${g.bild ? `<div class="bauvorschau"><img src="${bildUrl(g.bild)}" alt=""></div>` : ""}
      <ul class="beding">
        <li class="${lv ? "ok" : ""}">Level ${g.level}</li>
        <li class="${ew ? "ok" : ""}">${g.einwohner} Einwohner (du hast ${einwohner()})</li>
        <li class="${geld ? "ok" : ""}">${muenze("ic klein")} ${g.preis}</li>
      </ul>
      ${!ew && lv ? `<p class="hinweis">Mehr Einwohner bekommst du, wenn du über „Bauen“ Häuser aufstellst.</p>` : ""}
      <button class="los" data-aktion="gebaeudebauen" data-k="${key}" ${lv && ew && geld ? "" : "disabled"}>Bauen</button>`;
  });
}

/* ---------- Aufträge ---------- */
function auftragsPanel() {
  oeffnen("auftraege", () => `
    <div class="kopf"><h2>Aufträge</h2>${zu()}</div>
    ${eilKarte()}
    <div class="auftraege">${S.auftraege.map((a, i) => {
      if (a.ab > jetzt()) return `<div class="auftrag warte"><small>Neuer Auftrag in ${dauer(a.ab - jetzt())}</small></div>`;
      const ok = hat(a.waren);
      return `<div class="auftrag ${ok ? "bereit" : ""}">
        <div class="waren">${Object.entries(a.waren).map(([w, n]) => `<span class="${(S.lager[w] || 0) >= n ? "" : "fehlt"}">${icon(w)}${Math.min(S.lager[w] || 0, n)}/${n}</span>`).join("")}</div>
        <div class="lohn"><span>${muenze("ic klein")}${a.muenzen}</span><span>${stern("ic klein")}${a.xp}</span>${a.werkzeug ? `<span><img class="ic klein" src="${bildUrl(WERKZEUGE[a.werkzeug].bild)}" alt="${WERKZEUGE[a.werkzeug].name}">1</span>` : ""}</div>
        <div class="knoepfe"><button class="los" data-aktion="liefern" data-i="${i}" ${ok ? "" : "disabled"}>Liefern</button>
        <button class="weg" data-aktion="ablehnen" data-i="${i}" aria-label="Auftrag ablehnen">✕</button></div>
      </div>`;
    }).join("")}</div>`);
}

/* ---------- Eilaufträge ---------- */
const eilAktiv = () => S.eil && S.eil.waren && S.eil.bis > jetzt();
function eilPruefen() {
  if (S.level < EIL.level) return;
  const t = jetzt();
  if (S.eil?.waren && S.eil.bis <= t) { S.eil = { naechster: t + EIL.pauseMin * 60000 }; meldung("Der Eilauftrag ist abgelaufen. Bald kommt ein neuer."); speichern(); }
  if (!S.eil) S.eil = { naechster: t + 60000 };
  if (!S.eil.waren && S.eil.naechster <= t) {
    const pool = verfuegbareWaren().sort(() => Math.random() - .5).slice(0, Math.min(3, 2 + Math.floor(S.level / 4)));
    const waren = {}; let wert = 0;
    for (const w of pool) { const m = WAREN[w].wert < 8 ? 6 + Math.floor(Math.random() * (3 + S.level)) : 2 + Math.floor(Math.random() * 3); waren[w] = m; wert += m * WAREN[w].wert; }
    S.eil = { waren, muenzen: Math.round(wert * EIL.faktor), xp: Math.round(wert / 3) + 5, helfer: wahl(Object.keys(HELFER)), werkzeug: 2, bis: t + EIL.dauerMin * 60000 };
    meldung("Ein Eilauftrag ist da! Schau auf die Auftragstafel."); speichern();
  }
}
function eilKarte() {
  if (S.level < EIL.level) return "";
  if (!eilAktiv()) return `<div class="auftrag eil warte"><small>⏰ Nächster Eilauftrag in ${dauer((S.eil?.naechster || jetzt()) - jetzt())}</small></div>`;
  const A = S.eil, ok = hat(A.waren);
  return `<div class="auftrag eil ${ok ? "bereit" : ""}">
    <b class="eil-titel">⏰ Eilauftrag · noch ${dauer(A.bis - jetzt())}</b>
    <div class="waren">${Object.entries(A.waren).map(([w, n]) => `<span class="${(S.lager[w] || 0) >= n ? "" : "fehlt"}">${icon(w)}${Math.min(S.lager[w] || 0, n)}/${n}</span>`).join("")}</div>
    <div class="lohn"><span>${muenze("ic klein")}${A.muenzen}</span><span>${stern("ic klein")}${A.xp}</span><span>${helferIcon(A.helfer, "ic klein")}1</span><span>🧰 ${A.werkzeug}</span></div>
    <button class="los" data-aktion="eilliefern" ${ok ? "" : "disabled"}>Liefern</button>
  </div>`;
}

/* ---------- Tagesbelohnung ---------- */
const heute = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const gestern = () => { const d = new Date(Date.now() - 864e5); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const tagOffen = () => S.tag.zuletzt !== heute();
const tagIndex = () => (S.tag.zuletzt === gestern() ? S.tag.serie : 0) % 7;
function lohnText(L, gross = false) {
  const c = gross ? "ic mittel" : "ic klein", t = [];
  if (L.muenzen) t.push(`${muenze(c)}${L.muenzen}`);
  if (L.werkzeug) t.push(`🧰${L.werkzeug}`);
  if (L.gold) t.push(`${icon("gold", c)}${L.gold}`);
  if (L.helfer) for (const [h, n] of Object.entries(L.helfer)) t.push(`${helferIcon(h, c)}${n}`);
  return t.join(" ");
}
function tagesPanel() {
  oeffnen("tag", () => {
    const i = tagIndex(), offen = tagOffen();
    return `<div class="kopf"><h2>Tagesbelohnung</h2>${zu()}</div>
      <p>${offen ? "Schön, dass du da bist! Komm jeden Tag vorbei, dann werden die Geschenke größer." : "Für heute hast du dein Geschenk schon. Morgen gibt es das nächste!"}</p>
      <div class="tage">${TAGESLOHN.map((L, k) => {
        const geholt = offen ? k < i : k <= (S.tag.serie - 1) % 7;
        return `<div class="tagkarte ${k === i && offen ? "heute" : ""} ${geholt ? "geholt" : ""} ${L.truhe ? "gross" : ""}">
          <small>Tag ${k + 1}</small>${L.truhe ? `<img class="ic gross" src="${bildUrl("truhe")}" alt="Truhe">` : ""}<span>${lohnText(L)}</span>${geholt ? `<b class="haken">✓</b>` : ""}</div>`;
      }).join("")}</div>
      <button class="los" data-aktion="tagholen" ${offen ? "" : "disabled"}>${offen ? "Abholen" : "Morgen wieder"}</button>`;
  });
}
function lohnGeben(L) {
  if (L.muenzen) S.muenzen += L.muenzen;
  const erhalten = [];
  for (let k = 0; k < (L.werkzeug || 0); k++) { const w = wahl(Object.keys(WERKZEUGE)); S.werkzeug[w]++; erhalten.push(WERKZEUGE[w].name); }
  if (L.helfer) for (const [h, n] of Object.entries(L.helfer)) S.helfer[h] = (S.helfer[h] || 0) + n;
  return erhalten;
}

/* ---------- Obsthof ---------- */
function obsthofPanel() {
  oeffnen("obsthof", () => {
    const lv = S.level >= OBSTHOF.level, geld = S.muenzen >= OBSTHOF.preis;
    return `<div class="kopf"><h2>Der Obsthof</h2>${zu()}</div>
      <div class="gastgeberin"><img src="${bildUrl("opa")}" alt=""><p>„Hinter dem Fluss liegt der alte Obsthof meines Bruders. Er sucht jemanden, der ihn weiterführt. Wie wär's mit dir?“</p></div>
      <p>Mit dem Obsthof bekommst du viel neues Land, Erdbeeren, Sonnenblumen, Weintrauben, Kirsch- und Birnbäume und drei neue Fabriken: Marmeladenküche, Kelterei und Ölmühle.</p>
      <ul class="beding"><li class="${lv ? "ok" : ""}">Level ${OBSTHOF.level}</li><li class="${geld ? "ok" : ""}">${muenze("ic klein")} ${OBSTHOF.preis}</li></ul>
      <button class="los" data-aktion="obsthofkaufen" ${lv && geld ? "" : "disabled"}>Obsthof kaufen</button>`;
  });
}

/* ---------- 1: Woher kommt eine Ware? ---------- */
function herkunft(w) {
  const t = [];
  if (PFLANZEN[w]) t.push(`auf einem Feld säen${PFLANZEN[w].level > 1 ? ` (ab Level ${PFLANZEN[w].level})` : ""}, wächst ${dauer(PFLANZEN[w].zeit * 1000)}`);
  for (const [k, T] of Object.entries(TIERE)) if (T.ware === w) t.push(`${T.name} mit Futter füttern (${GEBAEUDE[T.stall].name}${GEBAEUDE[T.stall].level ? `, ab Level ${GEBAEUDE[T.stall].level}` : ""})`);
  for (const [typ, Fr] of Object.entries(FRUCHT)) if (Fr.ware === w) t.push(`vom ${BAUTEN[typ].name} ernten (im Bauen-Menü, trägt ab Level ${Fr.level})`);
  for (const [k, F] of Object.entries(FABRIKEN)) for (const R of F.rezepte) if (R.ware === w) {
    t.push(`${F.name}: ${Object.entries(R.zutaten).map(([z, n]) => `${n} ${WAREN[z].name}`).join(" + ")}${R.level > 1 ? ` (ab Level ${R.level})` : ""}`); break;
  }
  return `${WAREN[w].name}: ${t.join(" · ") || "unbekannt"}`;
}
// Fehlende Waren antippen zeigt, woher sie kommen
document.querySelector("#fenster").addEventListener("click", e => {
  const f = e.target.closest(".fehlt"); if (!f) return;
  const img = f.querySelector("img[alt]"); if (!img) return;
  const w = Object.keys(WAREN).find(k => WAREN[k].name === img.alt); if (!w) return;
  e.stopPropagation(); meldung(herkunft(w), 6000);
}, true);

/* ---------- 2: Alles ernten ---------- */
function allesErnten() {
  const t = jetzt(), geerntet = [];
  let voll = false;
  S.felder.forEach((f, i) => {
    if (!f.p || f.t > t || voll) return;
    const P = PFLANZEN[f.p];
    if (belegt() + P.ertrag > kapazitaet()) { voll = true; return; }
    S.lager[f.p] = (S.lager[f.p] || 0) + P.ertrag; erfahrung(P.xp); zaehle("ernte"); ereignis("ernte");
    if (Math.random() < EVENT_QUELLEN.ernteChance) eventGeben(1);
    geerntet.push({ i, p: f.p }); f.p = null; f.t = 0; huepf(dinge.get("feld" + i));
  });
  const obst = {};
  S.bauten.forEach((b, i) => {
    const Fr = FRUCHT[b.typ];
    if (!Fr || S.level < Fr.level || (b.t || 0) > t || voll) return;
    if (belegt() + Fr.ertrag > kapazitaet()) { voll = true; return; }
    S.lager[Fr.ware] = (S.lager[Fr.ware] || 0) + Fr.ertrag; b.t = t + Fr.zeit * 1000; erfahrung(2); zaehle("ernte");
    obst[Fr.ware] = (obst[Fr.ware] || 0) + Fr.ertrag;
    huepf(dinge.get("bau" + i));
  });
  const aepfel = Object.values(obst).reduce((a, n) => a + n, 0);
  if (!geerntet.length && !aepfel) { meldung(voll ? "Die Scheune ist voll." : "Gerade ist nichts reif."); return; }
  leben.ton("ernte");
  const summe = {}; for (const g of geerntet) summe[g.p] = (summe[g.p] || 0) + PFLANZEN[g.p].ertrag;
  for (const [w, n] of Object.entries(obst)) summe[w] = (summe[w] || 0) + n;
  const text = Object.entries(summe).map(([w, n]) => `${n} ${WAREN[w].name}`).join(", ");
  speichern(); aktualisieren();
  if (!geerntet.length) { meldung(`Geerntet: ${text}${voll ? " · Die Scheune ist voll." : ""}`); return; }
  letzteErnte = geerntet;
  oeffnen("ernte", () => `<div class="kopf"><h2>Geerntet!</h2>${zu()}</div>
    <p>${Object.entries(summe).map(([w, n]) => `<span class="it">${icon(w)} ${n}</span>`).join(" ")}</p>
    ${voll ? `<p class="fehlt">Die Scheune ist voll, ein paar Felder sind noch reif.</p>` : ""}
    <p><b>Soll ich auf den ${geerntet.length} Feldern dasselbe wieder säen?</b></p>
    <div class="knoepfe"><button class="los" data-aktion="nachsaeen">Ja, dasselbe säen</button><button class="los zweit" data-aktion="zu">Nein, danke</button></div>`);
}
let letzteErnte = [];

/* ---------- 4: Markt ---------- */
const preisVon = w => Math.max(1, Math.round(WAREN[w].wert * MARKT.verkauf));
function marktTag() {
  const h = heute();
  if (S.markt?.tag === h) return S.markt;
  const pool = verfuegbareWaren().filter((w, i, a) => a.indexOf(w) === i).sort(() => Math.random() - .5);
  const sonder = pool.slice(0, MARKT.sonderAnzahl).map(w => ({ w, rest: 5 + Math.floor(Math.random() * 6) }));
  const selten = pool.filter(w => WAREN[w].wert >= 9).sort((a, b) => WAREN[b].wert - WAREN[a].wert)[0] || pool[0];
  S.markt = { tag: h, sonder, kauf: { w: selten, rest: 3 } };
  return S.markt;
}
function marktPanel() {
  oeffnen("markt", () => {
    const M = marktTag(), waren = Object.keys(WAREN).filter(w => S.lager[w] > 0);
    const sonderPreis = w => preisVon(w) * MARKT.sonderFaktor, kaufPreis = Math.round(WAREN[M.kauf.w].wert * MARKT.kaufFaktor);
    return `<div class="kopf"><h2>Markt</h2>${zu()}</div>
      <div class="gastgeberin"><img src="${bildUrl("handwerker")}" alt=""><p>„Willkommen auf dem Markt! Heute zahle ich für ein paar Waren besonders gut.“</p></div>
      <h3>Heute besonders gefragt</h3>
      <div class="rezepte">${M.sonder.map((o, k) => `<div class="rezept">
        <div class="aus">${icon(o.w, "ic gross")}</div><div class="ein"><b>${WAREN[o.w].name}</b><small>noch ${o.rest} Stück · du hast ${S.lager[o.w] || 0}</small></div>
        <button class="los" data-aktion="sonderverkauf" data-k="${k}" ${o.rest > 0 && S.lager[o.w] > 0 ? "" : "disabled"}>Verkaufen ${muenze("ic klein")} ${sonderPreis(o.w)}</button></div>`).join("")}
      <div class="rezept"><div class="aus">${icon(M.kauf.w, "ic gross")}</div><div class="ein"><b>Angebot: ${WAREN[M.kauf.w].name}</b><small>noch ${M.kauf.rest} Stück zu kaufen</small></div>
        <button class="los" data-aktion="marktkauf" ${M.kauf.rest > 0 && S.muenzen >= kaufPreis ? "" : "disabled"}>Kaufen ${muenze("ic klein")} ${kaufPreis}</button></div></div>
      <h3 class="lager-zwischen">Aus der Scheune verkaufen</h3>
      <div class="lagerraster">${waren.length ? waren.map(w => `<div class="lagerding">${icon(w, "ic gross")}<b>${S.lager[w]}</b><small>${WAREN[w].name}</small>
        <button class="los mini-los" data-aktion="verkaufen" data-w="${w}">${muenze("ic klein")} ${preisVon(w)}</button></div>`).join("") : `<p class="hinweis">Die Scheune ist leer.</p>`}</div>
      <p class="hinweis">Neue Angebote gibt es jeden Tag.</p>`;
  });
}

/* ---------- 5: Erfolge ---------- */
function erfolgWert(id) {
  if (id === "herzen") return Object.values(S.bewohner).reduce((n, b) => n + (b.herzen || 0), 0);
  if (id === "puzzle") return S.puzzle?.gewonnen || 0;
  if (id === "sterne") return Object.values(S.puzzle?.sterne || {}).filter(n => n >= 3).length;
  if (id === "einwohner") return einwohner();
  if (id === "level") return S.level;
  return S.zaehler[id] || 0;
}
const erfolgeBereit = () => ERFOLGE.filter(E => { const st = S.erfolge[E.id] || 0; return st < E.stufen.length && erfolgWert(E.id) >= E.stufen[st]; }).length;
/* ---------- Wahrzeichen ---------- */
function wahrzeichenPanel(k) {
  oeffnen("wz:" + k, () => {
    const W = WAHRZEICHEN[k], ab = S.wz[k] || 0, fertig = ab >= W.abschnitte.length;
    if (S.level < W.level && !ab) return `<div class="kopf"><h2>${W.name}</h2>${zu()}</div>
      <div class="bauvorschau"><img src="${bildUrl(W.bild)}" alt=""></div><p>Ab Level ${W.level} kannst du hier bauen.</p><p><b>Bonus, wenn fertig:</b> ${W.bonus}</p>`;
    if (fertig) return `<div class="kopf"><h2>${W.name} ✨</h2>${zu()}</div>
      <div class="bauvorschau"><img src="${bildUrl(W.bild)}" alt=""></div><p>Fertig! <b>Dein Bonus:</b> ${W.bonus}.</p>`;
    const Z = W.abschnitte[ab];
    return `<div class="kopf"><h2>${W.name}</h2>${zu()}</div>
      <div class="bauvorschau"><img src="${bildUrl(W.bild)}" alt=""></div>
      <p><b>Bonus, wenn fertig:</b> ${W.bonus}</p>
      <div class="wz-fortschritt">${W.abschnitte.map((_, i) => `<i class="${i < ab ? "fertig" : i === ab ? "jetzt" : ""}"></i>`).join("")}</div>
      <p>Bauabschnitt ${ab + 1} von ${W.abschnitte.length}:</p>
      <div class="waren gross-waren">${Object.entries(Z).map(([w, n]) => `<span class="${(S.lager[w] || 0) >= n ? "" : "fehlt"}">${icon(w)} ${Math.min(S.lager[w] || 0, n)}/${n} ${WAREN[w].name}</span>`).join("")}</div>
      <button class="los" data-aktion="wzbauen" data-k="${k}" ${hat(Z) ? "" : "disabled"}>Bauabschnitt fertigstellen</button>
      <p class="hinweis">Goldbarren gibt es für Eilaufträge, Gäste, Bosslevel im Puzzle, Gold im Wochen-Wettbewerb und in Truhen, besonders auf der Wüsteninsel.</p>`;
  });
}

/* ---------- Gäste ---------- */
function gastPruefen() {
  if (S.level < GAST.level) return;
  const t = jetzt();
  if (S.gast?.waren && S.gast.bis <= t) { S.gast = { naechster: t + GAST.pauseMin * 60000 }; weltAufbauen(); }
  if (!S.gast) S.gast = { naechster: t + 5 * 60000 };
  if (!S.gast.waren && S.gast.naechster <= t) {
    const pool = verfuegbareWaren().filter(w => WAREN[w].wert >= 9).sort(() => Math.random() - .5).slice(0, 3);
    if (!pool.length) return;
    const waren = {}; let wert = 0;
    for (const w of pool) { const n = 2 + Math.floor(Math.random() * 3); waren[w] = n; wert += n * WAREN[w].wert; }
    S.gast = { g: Math.floor(Math.random() * GAESTE.length), waren, muenzen: Math.round(wert * 2.5), xp: Math.round(wert / 2), helfer: wahl(Object.keys(HELFER)), bis: t + GAST.dauerMin * 60000 };
    meldung(`Besuch! ${GAESTE[S.gast.g].name} wartet an der Auftragstafel.`); weltAufbauen(); speichern();
  }
}
function gastPanel() {
  oeffnen("gast", () => {
    const G = S.gast; if (!G?.waren) return `<div class="kopf"><h2>Besuch</h2>${zu()}</div><p>Der Gast ist schon weitergezogen.</p>`;
    const Gs = GAESTE[G.g], ok = hat(G.waren);
    return `<div class="kopf"><h2>${Gs.name}</h2>${zu()}</div>
      <div class="gastgeberin"><img src="${bildUrl(Gs.bild)}" alt=""><p>„${Gs.text}“</p></div>
      <div class="waren gross-waren">${Object.entries(G.waren).map(([w, n]) => `<span class="${(S.lager[w] || 0) >= n ? "" : "fehlt"}">${icon(w)} ${Math.min(S.lager[w] || 0, n)}/${n} ${WAREN[w].name}</span>`).join("")}</div>
      <p class="hinweis">Dafür: ${muenze("ic klein")} ${G.muenzen} · ${stern("ic klein")} ${G.xp} · ${helferIcon(G.helfer, "ic klein")} 2 · 🧰 3 · noch ${dauer(G.bis - jetzt())}</p>
      <button class="los" data-aktion="gastschenken" ${ok ? "" : "disabled"}>Schenken</button>`;
  });
}

/* ---------- Wochen-Wettbewerb ---------- */
function wocheMontag() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)); }
function wocheId() { const t = wocheMontag(); return t.getFullYear() + "-" + (t.getMonth() + 1) + "-" + t.getDate(); }
function wettbewerb() {
  const id = wocheId();
  if (!S.wette || S.wette.id !== id) {
    const nr = Math.round(wocheMontag().getTime() / 6048e5);
    const W = WETTBEWERBE[((nr % WETTBEWERBE.length) + WETTBEWERBE.length) % WETTBEWERBE.length];
    S.wette = { id, typ: W.typ, start: zaehlerWert(W.typ), geholt: 0 };
  }
  return S.wette;
}
const wetteStand = w => Math.max(0, zaehlerWert(w.typ) - w.start);
const wetteBereit = () => { const w = wettbewerb(), W = WETTBEWERBE.find(x => x.typ === w.typ); return w.geholt < 3 && wetteStand(w) >= W.stufen[w.geholt]; };
function wetteKarte() {
  const w = wettbewerb(), W = WETTBEWERBE.find(x => x.typ === w.typ), st = wetteStand(w);
  const ende = new Date(); ende.setDate(ende.getDate() + (7 - ((ende.getDay() + 6) % 7))); ende.setHours(0, 0, 0, 0);
  const tage = Math.max(1, Math.ceil((ende - jetzt()) / 864e5));
  return `<div class="wette"><div class="wette-kopf"><b>🏅 ${W.name}</b><small>noch ${tage} ${tage === 1 ? "Tag" : "Tage"}</small></div>
    <p>${W.text}: <b>${st}</b></p>
    <div class="wette-stufen">${W.stufen.map((n, k) => {
      const L = WETTBEWERB_LOHN[k], geholt = k < w.geholt, bereit = k === w.geholt && st >= n;
      return `<div class="wette-stufe ${["bronze", "silber", "gold"][k]} ${geholt ? "geholt" : ""}"><b>${L.name}</b><small>${n}</small><span>${lohnText(L)}</span>
        ${geholt ? `<span class="haken">✓</span>` : `<button class="los mini-los" data-aktion="wette" ${bereit ? "" : "disabled"}>Holen</button>`}</div>`;
    }).join("")}</div></div>`;
}
function erfolgePanel() {
  oeffnen("erfolge", () => `<div class="kopf"><h2>Erfolge</h2>${zu()}</div>
    ${wetteKarte()}
    <div class="quests">${ERFOLGE.map(E => {
      const st = S.erfolge[E.id] || 0, fertig = st >= E.stufen.length, ziel = E.stufen[Math.min(st, E.stufen.length - 1)];
      const wert = erfolgWert(E.id), bereit = !fertig && wert >= ziel;
      return `<div class="quest erfolg ${bereit ? "bereit" : ""}"><div><b>${E.name} ${"★".repeat(st)}<span class="leerstern">${"★".repeat(E.stufen.length - st)}</span></b>
        <small>${fertig ? "Alle Stufen geschafft!" : `${E.text(ziel)} · ${Math.min(wert, ziel)}/${ziel}`}</small></div>
        ${fertig ? `<span class="haken">✓</span>` : bereit ? `<button class="los" data-aktion="erfolg" data-id="${E.id}">Holen</button>` : `<span class="stufenlohn">${lohnText(ERFOLG_LOHN[st])}</span>`}
        <i class="questbalken"><i style="width:${fertig ? 100 : Math.min(1, wert / ziel) * 100}%"></i></i></div>`;
    }).join("")}</div>`);
}

/* ---------- 7: Lieferwagen-Touren ---------- */
function tourNeu() {
  const pool = verfuegbareWaren();
  const kisten = Array.from({ length: TOUR.kisten }, () => {
    const w = wahl(pool), n = WAREN[w].wert < 10 ? 4 + Math.floor(Math.random() * (3 + S.level / 2)) : 1 + Math.floor(Math.random() * 3);
    return { w, n, voll: false };
  });
  return { kisten, unterwegs: 0 };
}
function tourStand() {
  if (!S.tour) S.tour = tourNeu();
  if (S.tour.unterwegs && S.tour.unterwegs <= jetzt()) { S.tour = tourNeu(); meldung("Der Lieferwagen ist zurück und hat neue Bestellungen dabei!"); speichern(); }
  return S.tour;
}
function tourLohn(T) {
  let wert = 0; for (const k of T.kisten) if (k.voll) wert += k.n * WAREN[k.w].wert;
  const alle = T.kisten.every(k => k.voll);
  return { muenzen: Math.round(wert * (alle ? 1.8 : 1.3)), xp: Math.round(wert / 4), helfer: alle, werkzeug: alle ? 3 : 1 };
}
function tourPanel() {
  oeffnen("tour", () => {
    const T = tourStand();
    if (T.unterwegs) return `<div class="kopf"><h2>Lieferwagen</h2>${zu()}</div>
      <div class="bauvorschau"><img src="${bildUrl("lieferwagen")}" alt=""></div>
      <p>Der Lieferwagen ist unterwegs und bringt deine Waren in die Stadt. Zurück in <b>${dauer(T.unterwegs - jetzt())}</b>.</p>`;
    const n = T.kisten.filter(k => k.voll).length, L = tourLohn(T);
    return `<div class="kopf"><h2>Lieferwagen</h2>${zu()}</div>
      <p>Fülle die Kisten mit Waren. Sind alle ${TOUR.kisten} voll, gibt es einen großen Bonus mit Puzzle-Helfer.</p>
      <div class="kisten">${T.kisten.map((k, i) => `<div class="kiste-tour ${k.voll ? "voll" : ""}">
        ${icon(k.w, "ic gross")}<b>${k.n}</b><small>${k.voll ? "gepackt" : `hast ${S.lager[k.w] || 0}`}</small>
        ${k.voll ? `<span class="haken">✓</span>` : `<button class="los mini-los" data-aktion="kiste" data-i="${i}" ${(S.lager[k.w] || 0) >= k.n ? "" : "disabled"}>Packen</button>`}</div>`).join("")}</div>
      <p class="hinweis">Lohn jetzt: ${muenze("ic klein")} ${L.muenzen} · ${stern("ic klein")} ${L.xp} · 🧰 ${L.werkzeug}${L.helfer ? " · ein Puzzle-Helfer" : ""}</p>
      <button class="los" data-aktion="tourlos" ${n ? "" : "disabled"}>${!n ? "Pack zuerst eine Kiste" : n === TOUR.kisten ? "Losschicken!" : `Mit ${n} von ${TOUR.kisten} Kisten losschicken`}</button>
      <button class="los zweit" data-aktion="tourneu">Andere Bestellungen</button>`;
  });
}

/* ---------- Jahreszeiten-Event ---------- */
function eventJetzt() {
  const d = new Date(), m = d.getMonth() + 1;
  const [key, E] = Object.entries(EVENTS).find(([, e]) => e.monate.includes(m));
  const jahr = m <= 2 ? d.getFullYear() - 1 : d.getFullYear();
  const letzterMonat = E.monate[2], endJahr = letzterMonat < m ? d.getFullYear() + 1 : d.getFullYear();
  const ende = new Date(endJahr, letzterMonat, 1).getTime();
  return { id: `${key}-${jahr}`, key, E, ende };
}
function eventStand() {
  const J = eventJetzt();
  if (!S.event || S.event.id !== J.id) S.event = { id: J.id, menge: 0, stufe: 0, liegen: [], naechstes: jetzt() + 30000 };
  const ev = S.event;
  ev.aufgaben ??= []; ev.runde ??= 0; ev.naechsteA ??= Math.floor(Math.random() * EVENT_AUFGABEN.length);
  while (ev.aufgaben.length < EVENT_AUFGABEN_AKTIV) {
    const A = EVENT_AUFGABEN[ev.naechsteA % EVENT_AUFGABEN.length];
    if (ev.aufgaben.some(a => a.typ === A.typ)) { ev.naechsteA++; continue; }
    const f = 1 + ev.runde * .25;
    ev.aufgaben.push({ typ: A.typ, n: Math.max(1, Math.round(A.n * f)), lohn: Math.round(A.lohn * f), start: zaehlerWert(A.typ) });
    ev.naechsteA++; ev.runde++;
  }
  return ev;
}
function zaehlerWert(typ) { return typ === "puzzle" ? (S.puzzle?.gewonnen || 0) : (S.zaehler[typ] || 0); }
const aufgabeStand = a => Math.min(a.n, zaehlerWert(a.typ) - a.start);
// Stufe k: feste Stufen, danach endlose Bonusstufen
function eventStufe(k) {
  if (k < EVENT_STUFEN.length) return EVENT_STUFEN[k];
  const b = k - EVENT_STUFEN.length;
  return { n: EVENT_STUFEN[EVENT_STUFEN.length - 1].n + EVENT_BONUS_ABSTAND * (b + 1), ...eventBonusLohn(b), bonus: b + 1 };
}
function eventGeben(n, d) {
  if (!n) return;
  const ev = eventStand(), J = eventJetzt();
  ev.menge += n;
  if (d) {
    const f = document.createElement("div"); f.className = "float-event";
    f.innerHTML = `<img src="${bildUrl(J.E.token)}" alt=""><b>+${n}</b>`;
    const r = d.el.getBoundingClientRect(); f.style.left = (r.left + r.width / 2) + "px"; f.style.top = (r.top + r.height * .2) + "px";
    document.body.appendChild(f); setTimeout(() => f.remove(), 1300);
  }
  speichern();
}
function fundstueckePruefen() {
  const ev = eventStand();
  if (ev.liegen.length >= FUNDSTUECK.max || ev.naechstes > jetzt()) return;
  for (let k = 0; k < 40; k++) {
    const x = 150 + Math.random() * (breite() - 300), y = 200 + Math.random() * (WELT.h - 300);
    if (!platzFrei(x, y, "busch")) continue;
    ev.liegen.push({ x: Math.round(x), y: Math.round(y) }); ev.naechstes = jetzt() + FUNDSTUECK.minuten * 60000;
    fundstueckeZeigen(); speichern(); return;
  }
}
function fundstueckeZeigen() {
  for (const id of [...dinge.keys()]) if (id.startsWith("fund-")) { dinge.get(id).el.remove(); dinge.delete(id); }
  const ev = eventStand(), J = eventJetzt();
  ev.liegen.forEach((p, i) => {
    const d = neuesDing("fund-" + i, J.E.token, p.x, p.y, 54, { cls: "fundstueck", tipp: () => {
      ev.liegen.splice(i, 1); eventGeben(EVENT_QUELLEN.fundstueck, d); leben.ton("muenze"); fundstueckeZeigen(); aktualisieren();
    } });
  });
}
function eventPanel() {
  oeffnen("event", () => {
    const ev = eventStand(), J = eventJetzt(), tage = Math.max(1, Math.ceil((J.ende - jetzt()) / 864e5));
    const tok = c => `<img class="ic ${c}" src="${bildUrl(J.E.token)}" alt="${J.E.mehrzahl}">`;
    return `<div class="kopf"><h2>${J.E.name}</h2>${zu()}</div>
      <div class="event-kopf">${tok("riesig")}<div><p>${J.E.text}</p><p><b>${ev.menge} ${J.E.mehrzahl}</b> gesammelt · noch ${tage} ${tage === 1 ? "Tag" : "Tage"}</p></div></div>
      <h3>Festaufgaben</h3>
      <div class="quests">${ev.aufgaben.map((a, i) => {
        const A = EVENT_AUFGABEN.find(x => x.typ === a.typ), st = aufgabeStand(a), ok = st >= a.n;
        return `<div class="quest ${ok ? "erfolg bereit" : ""}"><div><b>${A.text(a.n)}</b><small>${st}/${a.n}</small></div>
          ${ok ? `<button class="los" data-aktion="eventaufgabe" data-i="${i}">+${a.lohn} ${tok("klein")}</button>` : `<span class="questpunkte">+${a.lohn} ${tok("klein")}</span>`}
          <i class="questbalken"><i style="width:${st / a.n * 100}%"></i></i></div>`;
      }).join("")}</div>
      <h3 class="lager-zwischen">Belohnungen</h3>
      <div class="pfad">${Array.from({ length: Math.max(EVENT_STUFEN.length, ev.stufe + 1) }, (_, k) => k).filter(k => k >= ev.stufe - 2 || k < EVENT_STUFEN.length).map(k => {
        const St = eventStufe(k), geholt = k < ev.stufe, bereit = k === ev.stufe && ev.menge >= St.n;
        return `<div class="stufe ${geholt ? "geholt" : bereit ? "bereit" : ""} ${St.bonus ? "bonusstufe" : ""}">
          <span class="stufenpunkte">${tok("klein")} ${St.n}</span><span class="stufenlohn">${St.bonus ? `<b>Bonus ${St.bonus}:</b> ` : ""}${lohnText(St)}</span>
          ${geholt ? `<span class="haken">✓</span>` : `<button class="los" data-aktion="eventholen" ${bereit ? "" : "disabled"}>Holen</button>`}</div>`;
      }).join("")}</div>
      ${ev.stufe >= EVENT_STUFEN.length ? `<p class="hinweis">Stark! Alle festen Stufen sind geschafft. Jetzt gibt es alle ${EVENT_BONUS_ABSTAND} ${J.E.mehrzahl} eine Bonusstufe, und jede wird größer.</p>` : ""}
      <p class="hinweis">${J.E.mehrzahl} bekommst du beim Ernten, für Aufträge und Eilaufträge, für Wünsche der Bewohner, im Puzzle, in Schatztruhen auf den Inseln, in der Tagesbelohnung und wenn du sie auf dem Hof findest.</p>`;
  });
}

/* ---------- Bewohner ---------- */
function wunsch(k) {
  const B = BEWOHNER[k];
  S.bewohner[k] ??= { herzen: 0, w: null };
  const st = S.bewohner[k];
  if (!st.w) {
    const moeglich = B.waren.filter(w => verfuegbareWaren().includes(w));
    const pool = (moeglich.length ? moeglich : verfuegbareWaren()).sort(() => Math.random() - .5).slice(0, Math.random() < .5 ? 1 : 2);
    const waren = {}; let wert = 0;
    for (const w of pool) { const m = WAREN[w].wert < 10 ? 3 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 2); waren[w] = m; wert += m * WAREN[w].wert; }
    st.w = { waren, muenzen: Math.round(wert * 1.2), xp: Math.round(wert / 3) + 3, ab: st.w === null && st.herzen === 0 ? 0 : jetzt() };
  }
  return st.w;
}
function herzen(n) {
  return `<div class="herzen">${Array.from({ length: HERZ_MAX }, (_, k) => `<img class="ic klein ${k < n ? "" : "leer"}" src="${bildUrl("i-herz")}" alt="">`).join("")}</div>`;
}
function freundLohnText(L) {
  const t = [];
  if (L.muenzen) t.push(`${muenze("ic klein")} ${L.muenzen}`);
  if (L.werkzeug) t.push(`🧰 ${L.werkzeug}`);
  if (L.helfer) t.push(`${helferIcon(L.helfer, "ic klein")} ${HELFER[L.helfer].name}`);
  return t.join(" · ");
}
function bewohnerPanel(k) {
  oeffnen("bewohner:" + k, () => {
    const B = BEWOHNER[k], st = S.bewohner[k] || { herzen: 0 }, w = wunsch(k);
    const bereit = w.ab <= jetzt(), ok = bereit && hat(w.waren);
    return `<div class="kopf"><h2>${B.name}</h2>${zu()}</div>
      <div class="gastgeberin"><img src="${bildUrl(B.bild)}" alt=""><div><p>„${B.text}“</p>${herzen(st.herzen)}</div></div>
      ${bereit ? `<p><b>Mein Wunsch:</b></p>
        <div class="waren gross-waren">${Object.entries(w.waren).map(([x, n]) => `<span class="${(S.lager[x] || 0) >= n ? "" : "fehlt"}">${icon(x)} ${Math.min(S.lager[x] || 0, n)}/${n} ${WAREN[x].name}</span>`).join("")}</div>
        <p class="hinweis">Dafür: ${muenze("ic klein")} ${w.muenzen} · ${stern("ic klein")} ${w.xp} · ein Herz${st.herzen < HERZ_MAX ? ` und ${freundLohnText(B.lohn)}` : ""}</p>
        <button class="los" data-aktion="wunsch" data-k="${k}" ${ok ? "" : "disabled"}>Schenken</button>`
      : `<p>Danke noch mal! Bald habe ich einen neuen Wunsch (in ${dauer(w.ab - jetzt())}).</p>`}`;
  });
}

/* ---------- Lager ---------- */
function lagerPanel() {
  oeffnen("lager", () => {
    const preis = SCHEUNE.preis(S.scheuneLvl);
    const waren = Object.keys(WAREN).filter(w => S.lager[w] > 0);
    return `<div class="kopf"><h2>Scheune</h2>${zu()}</div>
      <div class="fuellstand"><span>${belegt()} von ${kapazitaet()} Plätzen belegt</span><i style="width:${belegt() / kapazitaet() * 100}%"></i></div>
      <div class="lagerraster">${waren.length ? waren.map(w => `<div class="lagerding">${icon(w, "ic gross")}<b>${S.lager[w]}</b><small>${WAREN[w].name}</small></div>`).join("") : `<p class="hinweis">Die Scheune ist leer. Ernte Felder und sammle bei den Tieren ein.</p>`}</div>
      <div class="knoepfe"><button class="los" data-aktion="zummarkt">Zum Markt</button>
      <button class="los zweit" style="width:auto;margin:0;flex:1" data-aktion="scheuneausbauen" ${S.muenzen >= preis ? "" : "disabled"}>Ausbauen (+${SCHEUNE.plus}) · ${muenze("ic klein")} ${preis}</button></div>
      <h3 class="lager-zwischen">Werkzeuge und Puzzle-Helfer</h3>
      <p class="hinweis">Brauchen keinen Platz in der Scheune.</p>
      <div class="lagerraster">${Object.keys(WERKZEUGE).map(w => `<div class="lagerding">${werkzeugIcon(w, "ic gross")}<b>${S.werkzeug[w] || 0}</b><small>${WERKZEUGE[w].name}</small></div>`).join("")}
      ${Object.keys(HELFER).map(h => `<div class="lagerding">${helferIcon(h, "ic gross")}<b>${S.helfer[h] || 0}</b><small>${HELFER[h].name}</small></div>`).join("")}</div>`;
  });
}

/* ---------- Bauen und Platzieren ---------- */
let platzieren = null; // { typ, index? } index = vorhandenes Ding verschieben
function baumenu() {
  oeffnen("bauen", () => `
    <div class="kopf"><h2>Bauen</h2>${zu()}</div>
    <div class="baumenu"><button class="karte" data-aktion="feldfrei" ${S.muenzen >= feldPreis(S.felder.length) && S.felder.length < felderMax(S.level) ? "" : "disabled"}>
        <img class="bauicon" src="${bildUrl("feld-leer")}" alt=""><b>Feld</b><small>${S.felder.length < felderMax(S.level) ? `${muenze("ic klein")} ${feldPreis(S.felder.length)} · ${S.felder.length}/${felderMax(S.level)}` : "Maximum erreicht"}</small></button>
      ${Object.entries(BAUTEN).filter(([k, B]) => !B.insel || S.dekoFrei[k] > 0).map(([k, B]) => {
      if (B.insel) return `<button class="karte geschenk" data-aktion="platzieren" data-t="${k}">
        <img class="bauicon" src="${bildUrl(B.bild)}" alt=""><b>${B.name}</b><small>Belohnung · ${S.dekoFrei[k]}× frei</small></button>`;
      const frei = S.level >= B.level, geld = S.muenzen >= B.preis;
      return `<button class="karte" data-aktion="platzieren" data-t="${k}" ${frei && geld ? "" : "disabled"}>
        <img class="bauicon" src="${bildUrl(B.bild)}" alt=""><b>${B.name}</b>
        <small>${frei ? `${muenze("ic klein")} ${B.preis}${B.einwohner ? ` · +${B.einwohner} Einwohner` : ""}` : `ab Level ${B.level}`}</small></button>`;
    }).join("")}</div>
    <button class="los zweit" data-aktion="bearbeiten">Umstellen und abreißen</button>
    <p class="hinweis">Häuser kannst du antippen und ausbauen: das bringt mehr Einwohner, ohne mehr Platz zu brauchen.</p>`);
}
function apfelTipp(i) {
  const b = S.bauten[i], d = dinge.get("bau" + i), Fr = FRUCHT[b.typ];
  if (S.level < Fr.level) { bauTipp(i); return; }
  if ((b.t || 0) > jetzt()) { meldung(`Die ${Fr.name} reifen noch ${dauer(b.t - jetzt())}`); return; }
  if (!geben(Fr.ware, Fr.ertrag)) return;
  b.t = jetzt() + Fr.zeit * 1000; erfahrung(2); huepf(d); fliegt(d, Fr.ware, Fr.ertrag); zaehle("ernte");
  speichern(); aktualisieren();
}
let abrissFrage = null;
function bauTipp(i) {
  abrissFrage = null;
  oeffnen("bau" + i, () => {
    const b = S.bauten[i]; if (!b) return "";
    const B = BAUTEN[b.typ], st = b.stufe || 1, N = HAUS_STUFEN[st];
    const erstattung = B.insel ? 0 : Math.floor(B.preis * ABRISS_ERSTATTUNG);
    let ausbau = "";
    if (B.art === "haus") {
      if (!N) ausbau = `<p class="hinweis">Höchste Stufe erreicht.</p>`;
      else {
        const preis = Math.round(B.preis * N.preis), mehr = Math.round(B.einwohner * N.faktor) - hausEinwohner(b);
        const wz = N.werkzeug || {}, okWz = Object.entries(wz).every(([w, n]) => (S.werkzeug[w] || 0) >= n);
        const ok = S.level >= N.level && S.muenzen >= preis && okWz;
        ausbau = `<button class="los zweit" data-aktion="hausausbau" data-i="${i}" ${ok ? "" : "disabled"}>
          ${S.level < N.level ? `Ausbau auf Stufe ${st + 1} ab Level ${N.level}` : `Auf Stufe ${st + 1} ausbauen (+${mehr} Einwohner) · ${muenze("ic klein")} ${preis}${Object.entries(wz).map(([w, n]) => ` ${werkzeugIcon(w, "ic klein")}${n}`).join("")}`}</button>`;
      }
    }
    return `<div class="kopf"><h2>${B.name}${B.art === "haus" ? ` <small class="stufe-tag">Stufe ${st}</small>` : ""}</h2>${zu()}</div>
      ${B.einwohner ? `<p>Hier wohnen ${hausEinwohner(b)} Einwohner.</p>` : `<p>Schön sieht es aus.</p>`}
      ${ausbau}
      ${abrissFrage === i
        ? `<p class="fehlt"><b>Wirklich abreißen?</b> ${B.einwohner ? `Dir fehlen dann ${hausEinwohner(b)} Einwohner. ` : ""}Du bekommst ${erstattung} Münzen zurück${B.insel ? " (Belohnungs-Deko kommt zurück ins Bauen-Menü)" : ""}.</p>
           <div class="knoepfe"><button class="los rot" data-aktion="abreissen" data-i="${i}">Ja, abreißen</button><button class="los zweit" style="width:auto;margin:0" data-aktion="abrissnein">Nein</button></div>`
        : `<div class="knoepfe"><button class="los" data-aktion="verschieben" data-i="${i}">Umstellen</button><button class="los rot" data-aktion="abrissfrage" data-i="${i}">Abreißen</button></div>`}`;
  });
}
function feldBearbeiten(i) {
  oeffnen("fb" + i, () => {
    const f = S.felder[i]; if (!f) return "";
    return `<div class="kopf"><h2>Feld</h2>${zu()}</div>
      <p>${f.p ? `Hier wächst ${WAREN[f.p].name}. Ernte es, bevor du das Feld abreißt.` : "Ein leeres Feld."}</p>
      <div class="knoepfe"><button class="los" data-aktion="feldumstellen" data-i="${i}">Umstellen</button>
      <button class="los rot" data-aktion="feldweg" data-i="${i}" ${f.p || S.felder.length <= 1 ? "disabled" : ""}>Abreißen (${muenze("ic klein")} 20 zurück)</button></div>`;
  });
}
function gebaeudeBearbeiten(key) {
  oeffnen("gb:" + key, () => `<div class="kopf"><h2>${GEBAEUDE[key].name}</h2>${zu()}</div>
    <p>Feste Gebäude kannst du umstellen, aber nicht abreißen.</p>
    <div class="knoepfe"><button class="los" data-aktion="gebaeudeumstellen" data-k="${key}">Umstellen</button>
    <button class="los zweit" style="width:auto;margin:0" data-aktion="gebaeudeoeffnen" data-k="${key}">Öffnen</button></div>`);
}
const geist = $("#geist");
// Was gerade aufgestellt wird: Bild, Breite und Platzbedarf
const pdef = () => platzieren.feld != null ? FELD_DEF : platzieren.gebaeude ? GEBAEUDE[platzieren.gebaeude] : BAUTEN[platzieren.typ];
function feldPlatzieren(wer) {
  schliessen();
  if (wer === "neu" && S.felder.length >= felderMax(S.level)) { meldung(`Mehr als ${felderMax(S.level)} Felder gehen nicht.`); return; }
  platzieren = { feld: wer, index: null, x: null, y: null };
  geist.innerHTML = `<img src="${bildUrl("feld-leer")}" alt="">`; geist.style.width = FELD_BREITE + "px";
  let q;
  if (wer !== "neu") { dinge.get("feld" + wer)?.el.classList.add("weg"); q = S.felder[wer]; }
  else q = zuWelt(innerWidth / 2, innerHeight / 2);
  geistSetzen(q.x, q.y - hoehe("feld-leer", FELD_BREITE) * .35);
  $("#platzleiste").hidden = false; $("#bearbeitleiste").hidden = true; welt.appendChild(geist); geist.hidden = false;
}
function gebaeudeUmstellen(key) {
  schliessen();
  platzieren = { gebaeude: key, index: null, x: null, y: null };
  const G = GEBAEUDE[key];
  geist.innerHTML = `<img src="${bildUrl(G.bild)}" alt="">`; geist.style.width = G.breite + "px";
  dinge.get(key)?.el.classList.add("weg");
  const q = gpos(key); geistSetzen(q.x, q.y - hoehe(G.bild, G.breite) * .35);
  $("#platzleiste").hidden = false; $("#bearbeitleiste").hidden = true; welt.appendChild(geist); geist.hidden = false;
}
function platzierenStart(typ, index = null) {
  schliessen();
  platzieren = { typ, index, x: null, y: null };
  const B = BAUTEN[typ];
  geist.innerHTML = `<img src="${bildUrl(B.bild)}" alt="">`;
  geist.style.width = B.breite + "px";
  if (index !== null) dinge.get("bau" + index).el.classList.add("weg");
  const mitte = zuWelt(innerWidth / 2, innerHeight / 2);
  geistSetzen(mitte.x, mitte.y);
  $("#platzleiste").hidden = false; $("#bearbeitleiste").hidden = true;
  welt.appendChild(geist); geist.hidden = false;
}
let ohneNeuesFeld = false, naechsterFeldplatzCache = null;
// Kästchen im Rautenraster, in dem ein Punkt liegt
function zelle(x, y) {
  const dx = (x - RASTER.x0) / RASTER.ax, dy = (y - RASTER.y0) / RASTER.ay;
  return Math.round((dx + dy) / 2) + "," + Math.round((dy - dx) / 2);
}
// Belegte Kästchen (Felder, Häuser, Deko, Gebäude, Lieferwagen) und runde Sperrflächen (Weiden, Dickicht)
function hindernisse() {
  const zellen = new Set(), runde = [];
  S.felder.forEach((f, i) => { if (platzieren && platzieren.feld === i) return; zellen.add(zelle(f.x, f.y)); });
  if (!ohneNeuesFeld) { const p = naechsterFeldplatzCache; if (p) zellen.add(zelle(p.x, p.y)); }
  for (const [k, g] of Object.entries(GEBAEUDE)) if (g.r && !(platzieren && platzieren.gebaeude === k)) { if (g.obsthof && !S.obsthof) continue; const q = gpos(k); zellen.add(zelle(q.x, q.y)); }
  S.bauten.forEach((b, i) => { if (platzieren && platzieren.index === i) return; zellen.add(zelle(b.x, b.y)); });
  zellen.add(zelle(TOUR.x, TOUR.y));
  for (const [k, W] of Object.entries(WAHRZEICHEN)) if (!W.obsthof || S.obsthof) zellen.add(zelle(W.x, W.y));
  for (const w of Object.values(WEIDEN)) runde.push({ x: w.x, y: w.y + 10, rx: w.rx + 40, ry: w.ry + 30 });
  for (const z of DICKICHT) if (!S.dickicht.includes(z.id)) runde.push({ x: z.x, y: z.y, rx: z.rx * 1.15 + 40, ry: z.ry * 1.15 + 30 });
  return { zellen, runde };
}
function platzFrei(x, y, typ, fuerRaster = false) {
  const B = typ && typeof typ === "object" ? typ : BAUTEN[typ];
  ohneNeuesFeld = fuerRaster;
  try { return platzFreiIntern(x, y, B); } finally { ohneNeuesFeld = false; }
}
function platzFreiIntern(x, y, B) {
  if (x < 60 || x > breite() - 60 || y < 120 || y > WELT.h - 30) return false;
  if (x > OBSTHOF.fluss[0] - 30 && x < OBSTHOF.fluss[1] + 30) return false; // Fluss
  if (((x - SEE.x) / (SEE.rx + 50)) ** 2 + ((y - SEE.y) / (SEE.ry + 40)) ** 2 < 1) return false; // See
  const H = hindernisse();
  // jedes Objekt belegt genau ein Kästchen, direkt daneben darf das nächste stehen
  if (H.zellen.has(zelle(x, y))) return false;
  return H.runde.every(o => ((x - o.x) / o.rx) ** 2 + ((y - 30 - o.y) / o.ry) ** 2 > 1);
}
/* ---------- Raster: dasselbe Rautenraster wie die Felder (ein Kästchen = ein Feld) ---------- */
const RASTER = { x0: FELDPLAETZE[0].x, y0: FELDPLAETZE[0].y, ax: 100, ay: 54 };
function einrasten(x, y) {
  const dx = (x - RASTER.x0) / RASTER.ax, dy = (y - RASTER.y0) / RASTER.ay;
  const c = Math.round((dx + dy) / 2), r = Math.round((dy - dx) / 2);
  return { x: RASTER.x0 + (c - r) * RASTER.ax, y: RASTER.y0 + (c + r) * RASTER.ay };
}
const rasterEl = document.createElement("canvas"); rasterEl.id = "raster"; rasterEl.hidden = true; welt.appendChild(rasterEl);
function rasterZeichnen(px, py, ok) {
  const R = 520, q = 1, w = R * 2, h = R * 1.3;
  rasterEl.width = w * q; rasterEl.height = h * q;
  rasterEl.style.cssText = `left:${px - R}px;top:${py - 55 - h / 2}px;width:${w}px;height:${h}px`;
  const g = rasterEl.getContext("2d"), ox = R - px, oy = h / 2 - (py - 55);
  g.clearRect(0, 0, w, h);
  const raute = (x, y) => { g.beginPath(); g.moveTo(x + ox, y - RASTER.ay + oy); g.lineTo(x + RASTER.ax + ox, y + oy); g.lineTo(x + ox, y + RASTER.ay + oy); g.lineTo(x - RASTER.ax + ox, y + oy); g.closePath(); };
  for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
    const x = px + (i - j) * RASTER.ax, y = py - 55 + (i + j) * RASTER.ay;
    const d = Math.hypot((x - px) / R, (y - py + 55) / (h / 2)); if (d > 1) continue;
    raute(x, y); g.strokeStyle = `rgba(255,255,255,${.75 * (1 - d)})`; g.lineWidth = 2; g.stroke();
  }
  raute(px, py - 55); g.fillStyle = ok ? "rgba(110,230,90,.35)" : "rgba(255,80,60,.35)"; g.fill();
  g.strokeStyle = ok ? "rgba(70,200,50,.95)" : "rgba(230,60,40,.95)"; g.lineWidth = 4; g.stroke();
  rasterEl.hidden = false;
}
function geistSetzen(x, y) {
  const B = pdef();
  const p = einrasten(x, y + hoehe(B.bild, B.breite) * .35);
  platzieren.x = p.x; platzieren.y = p.y;
  const h = hoehe(B.bild, B.breite);
  geist.style.left = (platzieren.x - B.breite / 2) + "px"; geist.style.top = (platzieren.y - h) + "px";
  geist.style.height = h + "px"; geist.style.zIndex = 5000;
  const ok = platzFrei(platzieren.x, platzieren.y, pdef());
  geist.classList.toggle("schlecht", !ok);
  $("#platz-ok").disabled = !ok;
  rasterZeichnen(platzieren.x, platzieren.y, ok);
}
function geistBewegen(e) { if (e.pointerType === "mouse") { const p = zuWelt(e.clientX, e.clientY); geistSetzen(p.x, p.y); } }
function platzierenEnde(ok) {
  if (ok && platzieren && platzFrei(platzieren.x, platzieren.y, pdef())) {
    const B = pdef();
    if (platzieren.feld === "neu") {
      const preis = feldPreis(S.felder.length);
      if (S.muenzen >= preis) { S.muenzen -= preis; S.felder.push({ p: null, t: 0, x: platzieren.x, y: platzieren.y }); erfahrung(3); meldung("Neues Feld!"); }
    } else if (platzieren.feld != null) { Object.assign(S.felder[platzieren.feld], { x: platzieren.x, y: platzieren.y }); meldung("Feld umgestellt"); }
    else if (platzieren.gebaeude) { S.pos[platzieren.gebaeude] = { x: platzieren.x, y: platzieren.y }; meldung(`${B.name} umgestellt`); }
    else if (platzieren.index !== null) Object.assign(S.bauten[platzieren.index], { x: platzieren.x, y: platzieren.y });
    else {
      if (S.muenzen < B.preis) return;
      if (B.insel) { if (!(S.dekoFrei[platzieren.typ] > 0)) return; S.dekoFrei[platzieren.typ]--; }
      S.muenzen -= B.preis; S.bauten.push({ typ: platzieren.typ, x: platzieren.x, y: platzieren.y });
      erfahrung(B.xp); if (B.art === "haus") ereignis("bauen:haus");
      meldung(`${B.name} gebaut${B.einwohner ? `: +${B.einwohner} Einwohner` : ""}`);
    }
  }
  platzieren = null; geist.hidden = true; rasterEl.hidden = true; $("#platzleiste").hidden = true;
  weltAufbauen(); speichern(); aktualisieren();
  if (bearbeiten) $("#bearbeitleiste").hidden = false;
}
$("#platz-ok").onclick = () => platzierenEnde(true);
$("#bearbeit-fertig").onclick = () => bearbeitenAus();
$("#platz-ab").onclick = () => platzierenEnde(false);

/* ================= Fenster (unten) ================= */
let offen = null, fensterHtml = null, fensterKey = "", gezeichnet = null;
const host = $("#fenster");
const zu = () => `<button class="zu" data-aktion="zu" aria-label="Schließen">✕</button>`;
function oeffnen(name, html) { offen = name; fensterHtml = html; fensterKey = ""; fensterZeichnen(); }
function schliessen() { offen = null; fensterHtml = null; gezeichnet = null; host.innerHTML = ""; }
function fensterZeichnen() {
  if (!offen) return;
  const html = fensterHtml();
  if (html === fensterKey) return;
  fensterKey = html;
  const scroll = host.querySelector(".karteninhalt")?.scrollTop || 0;
  const still = gezeichnet === offen; gezeichnet = offen;
  host.innerHTML = `<div class="fenster"><div class="karteninhalt${still ? " still" : ""}">${html}</div></div>`;
  host.querySelector(".karteninhalt").scrollTop = scroll;
}
host.addEventListener("click", e => {
  const b = e.target.closest("[data-aktion]"); if (!b || b.disabled) return;
  const a = b.dataset.aktion, t = jetzt();
  if (a === "zu") { schliessen(); return; }
  if (a === "saeen") { saat = b.dataset.p; saeen(+b.dataset.i, saat); schliessen(); saatLeiste(); }
  if (a === "feldkaufen") {
    const preis = feldPreis(S.felder.length), p = naechsterFeldplatzCache;
    if (S.muenzen >= preis && p) { S.muenzen -= preis; S.felder.push({ p: null, t: 0, x: p.x, y: p.y }); erfahrung(3); schliessen(); weltAufbauen(); }
  }
  if (a === "feldfrei") { feldPlatzieren("neu"); return; }

  if (a === "herstellen") {
    const key = b.dataset.k, R = FABRIKEN[key].rezepte[+b.dataset.r], F = S.fabrik[key];
    if (!hat(R.zutaten) || F.q.length + F.fertig.length >= plaetzeVon(key)) return;
    nehmen(R.zutaten);
    const letzt = F.q.length ? F.q[F.q.length - 1].ende : t;
    F.q.push({ r: +b.dataset.r, ende: Math.max(t, letzt) + zeitVon(key, R) * 1000, zeit: zeitVon(key, R) });
    huepf(dinge.get(key)); ereignis("herstellen:" + R.ware);
  }
  if (a === "abholen") abholen(b.dataset.k);
  if (a === "allefuettern") {
    const art = b.dataset.a, T = TIERE[art];
    S.tiere[art].forEach((tier, i) => { if (tier.t === null && S.lager.futter > 0) { S.lager.futter--; tier.t = t + T.zeit * 1000; huepf(dinge.get(art + i)); ereignis("fuettern"); } });
  }
  if (a === "allesammeln") {
    const art = b.dataset.a, T = TIERE[art];
    S.tiere[art].forEach((tier, i) => { if (tier.t !== null && tier.t <= t && geben(T.ware, 1)) { tier.t = null; erfahrung(T.xp); fliegt(dinge.get(art + i), T.ware, 1); ereignis("sammeln"); zaehle("tiere"); } });
  }
  if (a === "tierkaufen") {
    const art = b.dataset.a, T = TIERE[art];
    if (S.muenzen >= T.preis && S.tiere[art].length < tierMax(art)) { S.muenzen -= T.preis; S.tiere[art].push({ t: null }); tierErzeugen(art, S.tiere[art].length - 1); erfahrung(2); }
  }
  if (a === "gebaeudebauen") {
    const key = b.dataset.k, g = GEBAEUDE[key];
    if (S.muenzen >= g.preis && S.level >= g.level && einwohner() >= g.einwohner) {
      S.muenzen -= g.preis; S.gebaut[key] = 1; erfahrung(10);
      if (FABRIKEN[key]) S.fabrik[key] = { q: [], fertig: [] };
      for (const [art, T] of Object.entries(TIERE)) if (T.stall === key && !S.tiere[art]?.length) S.tiere[art] = [{ t: null }, { t: null }];
      schliessen(); weltAufbauen(); meldung(`${g.name} ist fertig!`);
    }
  }
  if (a === "liefern") {
    const i = +b.dataset.i, A = S.auftraege[i];
    if (!hat(A.waren)) return;
    nehmen(A.waren); S.muenzen += Math.round(A.muenzen * auftragFaktor()); erfahrung(Math.round(A.xp * auftragFaktor()));
    if (A.werkzeug) { S.werkzeug ??= { axt: 3, schaufel: 2, spitzhacke: 2 }; S.werkzeug[A.werkzeug]++; }
    insel.ereignis("auftrag");
    S.auftraege[i] = { ...neuerAuftrag(), ab: t + 8000 };
    fliegtMuenzen(dinge.get("tafel")); ereignis("liefern"); zaehle("liefern"); eventGeben(EVENT_QUELLEN.auftrag, dinge.get("tafel"));
  }
  if (a === "ausbauen") {
    const key = b.dataset.k, st = stufe(key), istStall = !FABRIKEN[key];
    const preis = istStall ? AUSBAU.stallPreis(st) : AUSBAU.fabrikPreis(st), wz = istStall ? 0 : AUSBAU.fabrikWerkzeug(st);
    if (st < AUSBAU.maxStufe && S.level >= AUSBAU.stufeLevel(st + 1) && S.muenzen >= preis && S.werkzeug.spitzhacke >= wz && S.werkzeug.axt >= wz) {
      S.muenzen -= preis; S.werkzeug.spitzhacke -= wz; S.werkzeug.axt -= wz; S.ausbau[key] = st + 1; erfahrung(8 * st);
      huepf(dinge.get(key)); leben.ton("level"); meldung(`Ausgebaut auf Stufe ${st + 1}!`);
    }
  }
  if (a === "dickicht") {
    const z = DICKICHT.find(d => d.id === b.dataset.id);
    const wz = Object.entries(z.werkzeug).every(([w, n]) => (S.werkzeug[w] || 0) >= n);
    if (S.level >= z.level && S.muenzen >= z.muenzen && wz) {
      S.muenzen -= z.muenzen; for (const [w, n] of Object.entries(z.werkzeug)) S.werkzeug[w] -= n;
      S.dickicht.push(z.id); erfahrung(15); schliessen();
      for (const [id, d] of dinge) if (id.startsWith("dickicht-" + z.id)) d.el.classList.add("verschwindet");
      leben.ton("level"); meldung("Neues Land frei! Stell dort Häuser oder Deko auf.");
      setTimeout(() => { weltAufbauen(); aktualisieren(); }, 550);
    }
  }
  if (a === "eilliefern") {
    const A = S.eil;
    if (!eilAktiv() || !hat(A.waren)) return;
    nehmen(A.waren); S.muenzen += Math.round(A.muenzen * lieferFaktor()); erfahrung(A.xp); S.lager.gold = (S.lager.gold || 0) + 1;
    S.helfer[A.helfer] = (S.helfer[A.helfer] || 0) + 1; lohnGeben({ werkzeug: A.werkzeug });
    S.eil = { naechster: t + EIL.pauseMin * 60000 };
    insel.ereignis("auftrag"); zaehle("eil"); zaehle("liefern"); fliegtMuenzen(dinge.get("tafel")); eventGeben(EVENT_QUELLEN.eil, dinge.get("tafel"));
    meldung(`Eilauftrag geschafft! +${A.muenzen} Münzen, ein ${HELFER[A.helfer].name} und Werkzeuge`);
  }
  if (a === "tagholen") {
    if (!tagOffen()) return;
    const i = tagIndex(), L = TAGESLOHN[i];
    const w = lohnGeben(L);
    S.tag = { zuletzt: heute(), serie: i + 1 };
    eventGeben(EVENT_QUELLEN.tag);
    leben.ton("muenze");
    meldung(`Tag ${i + 1}: ${[L.muenzen ? L.muenzen + " Münzen" : "", ...w, ...Object.entries(L.helfer || {}).map(([h, n]) => `${n} ${HELFER[h].name}`)].filter(Boolean).join(", ")}`);
    $("#tag-zahl").hidden = true;
  }
  if (a === "tonumschalten") { leben.tonUmschalten(); }
  if (a === "zummarkt") { marktPanel(); return; }
  if (a === "obsthofkaufen") {
    if (S.obsthof || S.level < OBSTHOF.level || S.muenzen < OBSTHOF.preis) return;
    S.muenzen -= OBSTHOF.preis; S.obsthof = true; erfahrung(30); leben.ton("level"); schliessen(); weltAufbauen();
    cam.x -= 600 * cam.s; kameraSetzen(); meldung("Der Obsthof gehört jetzt dir!");
  }
  if (a === "abrissfrage") { abrissFrage = +b.dataset.i; fensterKey = ""; fensterZeichnen(); return; }
  if (a === "abrissnein") { abrissFrage = null; fensterKey = ""; fensterZeichnen(); return; }
  if (a === "abreissen") {
    const i = +b.dataset.i, x = S.bauten[i]; if (!x) return;
    const B = BAUTEN[x.typ];
    if (B.insel) S.dekoFrei[x.typ] = (S.dekoFrei[x.typ] || 0) + 1; else S.muenzen += Math.floor(B.preis * ABRISS_ERSTATTUNG);
    S.bauten.splice(i, 1); abrissFrage = null; schliessen(); weltAufbauen(); meldung(`${B.name} abgerissen`);
  }
  if (a === "hausausbau") {
    const i = +b.dataset.i, x = S.bauten[i], B = BAUTEN[x.typ], st = x.stufe || 1, N = HAUS_STUFEN[st];
    if (!N) return;
    const preis = Math.round(B.preis * N.preis), wz = N.werkzeug || {};
    if (S.level < N.level || S.muenzen < preis || !Object.entries(wz).every(([w, n]) => (S.werkzeug[w] || 0) >= n)) return;
    const vorher = hausEinwohner(x);
    S.muenzen -= preis; for (const [w, n] of Object.entries(wz)) S.werkzeug[w] -= n;
    x.stufe = st + 1; erfahrung(6 * st); leben.ton("level");
    meldung(`${B.name} auf Stufe ${x.stufe}: +${hausEinwohner(x) - vorher} Einwohner`);
    weltAufbauen(); huepf(dinge.get("bau" + i));
  }
  if (a === "feldumstellen") { feldPlatzieren(+b.dataset.i); return; }
  if (a === "feldweg") {
    const i = +b.dataset.i, f = S.felder[i];
    if (!f || f.p || S.felder.length <= 1) return;
    S.felder.splice(i, 1); S.muenzen += 20; schliessen(); weltAufbauen(); meldung("Feld abgerissen");
  }
  if (a === "gebaeudeumstellen") { gebaeudeUmstellen(b.dataset.k); return; }
  if (a === "gebaeudeoeffnen") { const k = b.dataset.k; schliessen(); gebaeudeTipp(k); return; }
  if (a === "bearbeiten") { bearbeitenAn(); return; }
  if (a === "nachsaeen") {
    for (const g of letzteErnte) { const f = S.felder[g.i]; if (f && !f.p && S.level >= PFLANZEN[g.p].level) saeen(g.i, g.p); }
    letzteErnte = []; schliessen(); meldung("Alles wieder gesät!");
  }
  if (a === "verkaufen") { const w = b.dataset.w; if (S.lager[w] > 0) { S.lager[w]--; S.muenzen += preisVon(w); leben.ton("muenze"); } }
  if (a === "sonderverkauf") {
    const o = marktTag().sonder[+b.dataset.k];
    if (o && o.rest > 0 && S.lager[o.w] > 0) { S.lager[o.w]--; o.rest--; S.muenzen += preisVon(o.w) * MARKT.sonderFaktor; leben.ton("muenze"); }
  }
  if (a === "marktkauf") {
    const K = marktTag().kauf, p = Math.round(WAREN[K.w].wert * MARKT.kaufFaktor);
    if (K.rest > 0 && S.muenzen >= p && geben(K.w, 1)) { S.muenzen -= p; K.rest--; }
  }
  if (a === "wzbauen") {
    const k = b.dataset.k, W = WAHRZEICHEN[k], ab = S.wz[k] || 0, Z = W.abschnitte[ab];
    if (!Z || !hat(Z)) return;
    nehmen(Z); S.wz[k] = ab + 1; erfahrung(40 * (ab + 1)); leben.ton("level");
    if (S.wz[k] >= W.abschnitte.length) { meldung(`${W.name} ist fertig! ${W.bonus}.`); schliessen(); }
    else meldung(`Bauabschnitt ${ab + 1} geschafft!`);
    weltAufbauen();
  }
  if (a === "wette") {
    const w = wettbewerb(), W = WETTBEWERBE.find(x => x.typ === w.typ);
    if (w.geholt < 3 && wetteStand(w) >= W.stufen[w.geholt]) { lohnGeben(WETTBEWERB_LOHN[w.geholt]); S.lager.gold = (S.lager.gold || 0) + GOLD_QUELLEN.wette[w.geholt]; meldung(`${W.name}: ${WETTBEWERB_LOHN[w.geholt].name} geschafft!`); w.geholt++; leben.ton("level"); }
  }
  if (a === "gastschenken") {
    const G = S.gast; if (!G || G.bis < t || !hat(G.waren)) return;
    nehmen(G.waren); S.muenzen += G.muenzen; erfahrung(G.xp); lohnGeben({ werkzeug: 3, helfer: { [G.helfer]: 2 } }); S.lager.gold = (S.lager.gold || 0) + GOLD_QUELLEN.gast;
    leben.ton("level"); meldung(`${GAESTE[G.g].name} bedankt sich: +${G.muenzen} Münzen, 2 ${HELFER[G.helfer].name} und Werkzeuge!`);
    S.gast = { naechster: t + GAST.pauseMin * 60000 }; schliessen(); weltAufbauen();
  }
  if (a === "erfolg") {
    const E = ERFOLGE.find(x => x.id === b.dataset.id), st = S.erfolge[E.id] || 0;
    if (st < E.stufen.length && erfolgWert(E.id) >= E.stufen[st]) { lohnGeben(ERFOLG_LOHN[st]); S.erfolge[E.id] = st + 1; leben.ton("level"); meldung(`Erfolg „${E.name}“ Stufe ${st + 1}!`); }
  }
  if (a === "kiste") {
    const k = tourStand().kisten[+b.dataset.i];
    if (k && !k.voll && (S.lager[k.w] || 0) >= k.n) { S.lager[k.w] -= k.n; k.voll = true; leben.ton("ernte"); }
  }
  if (a === "tourneu") { const T = tourStand(); if (!T.unterwegs) { const alt = T.kisten.filter(k => k.voll); for (const k of alt) S.lager[k.w] = (S.lager[k.w] || 0) + k.n; S.tour = tourNeu(); } }
  if (a === "tourlos") {
    const T = tourStand(); if (T.unterwegs || !T.kisten.some(k => k.voll)) return;
    const L = tourLohn(T);
    S.muenzen += Math.round(L.muenzen * lieferFaktor()); erfahrung(L.xp); lohnGeben({ werkzeug: L.werkzeug, helfer: L.helfer ? { [wahl(Object.keys(HELFER))]: 1 } : null });
    if (T.kisten.every(k => k.voll)) zaehle("tour");
    eventGeben(EVENT_QUELLEN.eil, dinge.get("tour")); insel.ereignis("auftrag");
    T.unterwegs = t + TOUR.fahrtMin * 60000; fliegtMuenzen(dinge.get("tour")); leben.ton("level");
    meldung(`Der Lieferwagen fährt los! +${L.muenzen} Münzen`); schliessen();
  }
  if (a === "eventaufgabe") {
    const ev = eventStand(), A = ev.aufgaben[+b.dataset.i];
    if (!A || aufgabeStand(A) < A.n) return;
    ev.aufgaben.splice(+b.dataset.i, 1); ev.menge += A.lohn; eventStand(); leben.ton("level");
    meldung(`Festaufgabe geschafft: +${A.lohn}`);
  }
  if (a === "eventholen") {
    const ev = eventStand(), St = eventStufe(ev.stufe);
    if (ev.menge < St.n) return;
    lohnGeben(St); if (St.bonus) S.lager.gold = (S.lager.gold || 0) + GOLD_QUELLEN.eventBonus; ev.stufe++; leben.ton("level"); meldung("Event-Belohnung abgeholt!");
  }
  if (a === "wunsch") {
    const k = b.dataset.k, B = BEWOHNER[k], st = S.bewohner[k], w = st?.w;
    if (!w || w.ab > t || !hat(w.waren)) return;
    nehmen(w.waren); S.muenzen += w.muenzen; erfahrung(w.xp);
    if (st.herzen < HERZ_MAX) {
      st.herzen++;
      lohnGeben({ muenzen: B.lohn.muenzen, werkzeug: B.lohn.werkzeug, helfer: B.lohn.helfer ? { [B.lohn.helfer]: 1 } : null });
    }
    st.w = null; wunsch(k); st.w.ab = t + BEWOHNER_PAUSE_MIN * 60000;
    huepf(dinge.get("bewohner-" + k)); leben.ton("level"); eventGeben(EVENT_QUELLEN.wunsch, dinge.get("bewohner-" + k));
    meldung(`${B.name} freut sich riesig! Freundschaft: ${st.herzen} von ${HERZ_MAX} Herzen`);
  }
  if (a === "ablehnen") { const i = +b.dataset.i; S.auftraege[i] = { ...neuerAuftrag(), ab: t + 20000 }; }
  if (a === "scheuneausbauen") { const p = SCHEUNE.preis(S.scheuneLvl); if (S.muenzen >= p) { S.muenzen -= p; S.scheuneLvl++; erfahrung(5); } }
  if (a === "platzieren") { platzierenStart(b.dataset.t); return; }
  if (a === "zurinsel") { insel.betreten(b.dataset.w); return; }
  if (a === "verschieben") { platzierenStart(S.bauten[+b.dataset.i].typ, +b.dataset.i); return; }
  speichern(); aktualisieren();
});
function saatLeiste() {
  const l = $("#saatleiste");
  l.innerHTML = `${icon(saat, "ic")}<span>Tippe oder wische über leere Felder, um ${WAREN[saat].name} zu säen.</span><button id="saat-fertig">Fertig</button>`;
  l.hidden = false;
  $("#saat-fertig").onclick = () => { saat = null; l.hidden = true; };
}

/* ================= Anzeigen ================= */
function meldung(text, ms = 2600) {
  const m = $("#meldung"); m.textContent = text; m.hidden = false;
  m.classList.remove("neu"); void m.offsetWidth; m.classList.add("neu");
  clearTimeout(meldung.t); meldung.t = setTimeout(() => { m.hidden = true; }, ms);
}
function fliegt(d, ware, n) {
  if (!d) return;
  leben.ton("ernte");
  const r = d.el.getBoundingClientRect(), ziel = $("#knopf-lager").getBoundingClientRect();
  const f = document.createElement("div"); f.className = "flieger";
  f.innerHTML = `${icon(ware, "ic gross")}<b>+${n}</b>`;
  const sx = r.left + r.width / 2 - 24, sy = r.top + r.height * .3;
  f.style.left = sx + "px"; f.style.top = sy + "px"; document.body.appendChild(f);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    f.style.transform = `translate(${ziel.left + ziel.width / 2 - 24 - sx}px,${ziel.top - sy}px) scale(.6)`; f.style.opacity = ".4";
  }));
  setTimeout(() => f.remove(), 900);
}
function fliegtMuenzen(d) {
  if (!d) return;
  leben.ton("muenze");
  const r = d.el.getBoundingClientRect(), ziel = $("#anz-muenzen").getBoundingClientRect();
  for (let k = 0; k < 5; k++) {
    const f = document.createElement("div"); f.className = "flieger";
    f.innerHTML = muenze("ic gross");
    const sx = r.left + r.width / 2 - 24 + zufall(-30, 30), sy = r.top + r.height * .3 + zufall(-20, 20);
    f.style.left = sx + "px"; f.style.top = sy + "px"; f.style.transitionDelay = k * 70 + "ms"; document.body.appendChild(f);
    requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transform = `translate(${ziel.left - sx}px,${ziel.top - sy}px) scale(.5)`; }));
    setTimeout(() => f.remove(), 1200);
  }
}
function levelAuf() {
  leben.ton("level");
  const neu = FREISCHALTUNG[S.level] || [];
  const d = document.createElement("div"); d.className = "levelauf";
  d.innerHTML = `<div class="fenster mitte"><div class="karteninhalt">
    <div class="grossstern">${stern("ic riesig")}<b>${S.level}</b></div>
    <h2>Level ${S.level}!</h2>
    ${neu.length ? `<p>Neu freigeschaltet:</p><ul class="neu">${neu.map(n => `<li>${n}</li>`).join("")}</ul>` : `<p>Weiter so! Dein Hof wächst.</p>`}
    <button class="los">Weiter</button></div></div>`;
  document.body.appendChild(d);
  d.querySelector("button").onclick = () => { d.remove(); weltAufbauen(); };
  auftraegeAuffuellen();
}
function zeichneSchritt() {
  const s = SCHRITTE[S.schritt], el = $("#schritt");
  if (!s) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<b>Erste Schritte ${S.schritt + 1}/${SCHRITTE.length}</b><span>${s.text}</span><small>${muenze("ic klein")} ${s.belohnung}</small>`;
}
function aktualisieren() {
  $("#anz-level").textContent = S.level;
  $("#anz-xp").style.width = Math.min(100, S.xp / xpFuer(S.level) * 100) + "%";
  $("#anz-muenzen b").textContent = S.muenzen;
  $("#anz-einwohner b").textContent = einwohner();
  const n = S.auftraege.filter(a => a.ab <= jetzt() && hat(a.waren)).length;
  eilPruefen();
  const bd = $("#auftrag-zahl"); bd.hidden = !n && !eilAktiv(); bd.textContent = eilAktiv() && !n ? "⏰" : n;
  $("#tag-zahl").hidden = !tagOffen();
  { const n = erfolgeBereit() + (wetteBereit() ? 1 : 0), z = $("#erfolg-zahl"); z.hidden = !n; z.textContent = n; }
  gastPruefen();
  { const t = jetzt(), n = S.felder.filter(f => f.p && f.t <= t).length + S.bauten.filter(b => FRUCHT[b.typ] && S.level >= FRUCHT[b.typ].level && (b.t || 0) <= t).length;
    const z = $("#ernte-zahl"); z.hidden = !n; z.textContent = n; }
  { const ev = eventStand(), J = eventJetzt(), St0 = eventStufe(ev.stufe), St = ev.menge >= St0.n || ev.aufgaben.some(a => aufgabeStand(a) >= a.n) ? { n: 0 } : St0;
    $("#anz-event img").src = bildUrl(J.E.token); $("#anz-event b").textContent = ev.menge;
    $("#event-zahl").hidden = !(St && ev.menge >= St.n); fundstueckePruefen(); }
  for (const d of dinge.values()) d.upd(d);
  insel.aktualisieren();
  fensterZeichnen();
}

/* ================= Leben (Tiere in der Luft, Tageszeit, Töne) ================= */
const leben = lebenStarten({ welt, WELT });

/* ================= Minispiele ================= */
const mini = minispieleStarten({
  bildUrl, ton: (a, n) => leben.ton(a, n),
  symbole: () => [...new Set([...Object.values(WAREN).map(w => w.icon), ...Object.values(WERKZEUGE).map(w => w.bild), ...Object.values(HELFER).map(h => h.bild)])].filter(b => GROESSE[b]),
});

/* ================= Insel ================= */
const insel = inselStarten({
  S: () => S, speichern, meldung, oeffnen, schliessen, zu, icon, muenze, bildUrl, hoehe, hat, nehmen, dauer, aktualisieren,
  helferIcon: (h, c) => helferIcon(h, c), eventGeben: (n, d) => eventGeben(n, d), zaehle,
  wimmelbild: o => mini.wimmelbild(o), memory: o => mini.memory(o), unterschiede: o => mini.unterschiede(o), schiebepuzzle: o => mini.schiebepuzzle(o), puzzleOeffnen: () => puzzle.oeffnen(),
});

/* ================= Puzzle ================= */
const puzzle = puzzleStarten({
  S: () => S, speichern, meldung, schliessen, bildUrl, muenze, aktualisieren, inselEreignis: t => insel.ereignis(t),
  helferIcon, ton: (a, n) => leben.ton(a, n), eventGeben: n => eventGeben(n),
});
$("#knopf-puzzle").onclick = () => puzzle.oeffnen();
$("#knopf-puzzle2").onclick = () => puzzle.oeffnen();

/* ================= Start ================= */
addEventListener("keydown", e => { if (e.key === "Escape") { if (platzieren) platzierenEnde(false); else schliessen(); } });
function zoomKnopf(f) {
  const r = document.querySelector(insel.aktiv ? "#insel-rahmen" : "#welt-rahmen");
  r.dispatchEvent(new WheelEvent("wheel", { deltaY: f > 1 ? -1 : 1, clientX: innerWidth / 2, clientY: innerHeight / 2, bubbles: true, cancelable: true }));
}
$("#zoom-rein").onclick = () => { zoomKnopf(1.1); zoomKnopf(1.1); };
$("#zoom-raus").onclick = () => { zoomKnopf(.9); zoomKnopf(.9); };
$("#knopf-auftraege").onclick = () => auftragsPanel();
$("#knopf-lager").onclick = () => lagerPanel();
$("#knopf-bauen").onclick = () => baumenu();
function neustartFragen() { oeffnen("neu", () => `
  <div class="kopf"><h2>Spiel neu beginnen?</h2>${zu()}</div>
  <p>Dein ganzer Hof wird gelöscht und du fängst wieder bei Level 1 an.</p>
  <div class="knoepfe"><button class="los rot" data-aktion="neustart">Ja, neu beginnen</button><button class="los zweit" data-aktion="zu">Abbrechen</button></div>`); }
// Spielstand vom anderen Gerät übernehmen
function standUebernehmen(neu) {
  if (!neu || neu.v !== 1) return;
  if (platzieren) { platzieren = null; geist.hidden = true; rasterEl.hidden = true; $("#platzleiste").hidden = true; }
  if (bearbeiten) bearbeitenAus();
  S = ergaenzen(neu);
  if (insel.aktiv) insel.verlassen();
  auftraegeAuffuellen(); lokalSichern();
  weltAufbauen(); zeichneSchritt(); aktualisieren();
}
sync = syncStarten({ getS: () => S, setS: standUebernehmen, meldung, oeffnen, zu, schliessen, neustartFragen,
  zusatz: () => `<h3>Töne</h3><button class="los zweit" data-aktion="tonumschalten">${leben.tonAn() ? "🔊 Töne sind an · ausschalten" : "🔇 Töne sind aus · einschalten"}</button>` });
$("#knopf-tag").onclick = () => tagesPanel();
$("#anz-event").onclick = () => eventPanel();
$("#knopf-erfolge").onclick = () => erfolgePanel();
$("#knopf-ernten").onclick = () => allesErnten();
$("#knopf-neu").onclick = () => sync.panel();
host.addEventListener("click", e => {
  if (e.target.closest("[data-aktion='neustart']")) { S = ergaenzen(neuerStand()); if (insel.aktiv) insel.verlassen(); auftraegeAuffuellen(); try { localStorage.removeItem(SPEICHER); } catch {} schliessen(); weltAufbauen(); zeichneSchritt(); aktualisieren(); speichern(); }
});
zeichneBoden();
weltAufbauen();
startKamera();
zeichneSchritt();
aktualisieren();
setInterval(aktualisieren, 500);
if (tagOffen()) setTimeout(() => { if (!offen && !document.body.classList.contains("im-puzzle")) tagesPanel(); }, 1200);
setInterval(lokalSichern, 5000);
addEventListener("visibilitychange", () => { if (document.hidden) lokalSichern(); });
// Querformat: auf Handys hochkant einen Hinweis zeigen; Android dreht die installierte App selbst
{
  const KEY = "sonnenhof-hochkant";
  const handy = matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 600;
  let erlaubt = false; try { erlaubt = localStorage.getItem(KEY) === "1"; } catch {}
  const pruefen = () => { $("#drehen").hidden = !handy || erlaubt || innerWidth > innerHeight; };
  addEventListener("resize", pruefen); screen.orientation?.addEventListener?.("change", pruefen); pruefen();
  $("#drehen-trotzdem").onclick = () => { erlaubt = true; try { localStorage.setItem(KEY, "1"); } catch {} pruefen(); };
  addEventListener("pointerdown", () => { try { screen.orientation?.lock?.("landscape").catch(() => {}); } catch {} }, { once: true });
}
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
