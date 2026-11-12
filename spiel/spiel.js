// Sonnenhof – Hof (Schritt 1). Reines JavaScript, keine Bibliotheken.
import { GROESSE } from "./img/groessen.js";
import {
  WAREN, PFLANZEN, TIERE, FABRIKEN, WARTESCHLANGE, GEBAEUDE, WEIDEN, FELD_BREITE, FELDPLAETZE, START_FELDER,
  feldPreis, BAUTEN, WELT, xpFuer, SCHEUNE, FREISCHALTUNG, AUFTRAGS_WAREN, SCHRITTE,
  WERKZEUGE,
} from "./daten.js";
import { inselStarten } from "./insel.js";
import { puzzleStarten } from "./puzzle.js";
import { syncStarten } from "./sync.js";

/* ================= Hilfen ================= */
const $ = s => document.querySelector(s);
const jetzt = () => Date.now();
const bildUrl = n => `img/${n}.webp`;
const hoehe = (n, b) => { const g = GROESSE[n]; return g ? b * g[1] / g[0] : b; };
const icon = (ware, cls = "ic") => `<img class="${cls}" src="${bildUrl(WAREN[ware].icon)}" alt="${WAREN[ware].name}">`;
const muenze = (cls = "ic") => `<img class="${cls}" src="${bildUrl("i-muenze")}" alt="Münzen">`;
const stern = (cls = "ic") => `<img class="${cls}" src="${bildUrl("i-stern")}" alt="Erfahrung">`;
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
      { typ: "busch", x: 760, y: 300 }, { typ: "laubbaum", x: 1560, y: 520 }, { typ: "tanne", x: 1640, y: 610 },
      { typ: "busch", x: 120, y: 1150 }, { typ: "laubbaum", x: 1500, y: 980 }, { typ: "tanne", x: 980, y: 230 },
    ],
    auftraege: [], schritt: 0,
  };
}
let S;
try { S = JSON.parse(localStorage.getItem(SPEICHER) || "null"); } catch { S = null; }
if (!S || S.v !== 1) S = neuerStand();
S.dekoFrei ??= {};
let speicherTimer = 0, sync = null;
function lokalSichern() { try { localStorage.setItem(SPEICHER, JSON.stringify(S)); } catch {} }
// Nach jeder Aktion: merken, wann sich etwas geändert hat (für den Abgleich zwischen Geräten)
function speichern() {
  S.geaendert = Date.now();
  clearTimeout(speicherTimer);
  speicherTimer = setTimeout(lokalSichern, 200);
  sync?.aenderung();
}

const einwohner = () => S.bauten.reduce((n, b) => n + (BAUTEN[b.typ].einwohner || 0), 0);
const kapazitaet = () => SCHEUNE.start + (S.scheuneLvl - 1) * SCHEUNE.plus;
const belegt = () => Object.values(S.lager).reduce((a, b) => a + b, 0);
const hat = z => Object.entries(z).every(([k, n]) => (S.lager[k] || 0) >= n);
function nehmen(z) { for (const [k, n] of Object.entries(z)) S.lager[k] = (S.lager[k] || 0) - n; }
function geben(ware, n) {
  if (belegt() + n > kapazitaet()) { meldung("Die Scheune ist voll. Liefere Aufträge oder baue die Scheune aus."); return false; }
  S.lager[ware] = (S.lager[ware] || 0) + n; return true;
}

/* ================= Fortschritt ================= */
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
function verfuegbareWaren() {
  const w = [];
  for (let l = 1; l <= S.level; l++) w.push(...(AUFTRAGS_WAREN[l] || []));
  return w;
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
const cam = { s: 1, x: 0, y: 0 };
function grenzen() {
  const W = innerWidth, H = innerHeight;
  const min = Math.max(W / WELT.b, H / WELT.h);
  cam.s = Math.min(1.6, Math.max(min, cam.s));
  const w = WELT.b * cam.s, h = WELT.h * cam.s;
  cam.x = Math.min(0, Math.max(W - w, cam.x)); cam.y = Math.min(0, Math.max(H - h, cam.y));
}
function kameraSetzen() { grenzen(); welt.style.transform = `translate(${cam.x}px,${cam.y}px) scale(${cam.s})`; }
function startKamera() {
  const W = innerWidth, H = innerHeight;
  cam.s = Math.max(W / WELT.b, H / WELT.h, W < 700 ? 0.62 : 0.8);
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
view.addEventListener("pointerdown", e => {
  zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (zeiger.size === 1) { bewegt = false; start = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; }
  if (zeiger.size === 2) { const [a, b] = [...zeiger.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: cam.s }; bewegt = true; }
});
addEventListener("pointermove", e => {
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
  zeiger.delete(e.pointerId);
  if (zeiger.size < 2) pinch = null;
  if (zeiger.size === 0) { view.classList.remove("zieht"); start = null; }
}
addEventListener("pointerup", zeigerEnde); addEventListener("pointercancel", zeigerEnde);
view.addEventListener("wheel", e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX, e.clientY); }, { passive: false });
view.addEventListener("click", e => {
  if (bewegt) return;
  const p = zuWelt(e.clientX, e.clientY);
  if (platzieren) { geistSetzen(p.x, p.y); return; }
  const el = e.target.closest(".ding");
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
  for (let k = 0; k < 160; k++) {
    g.fillStyle = r() < .5 ? "rgba(255,255,220,.06)" : "rgba(40,80,10,.06)";
    g.beginPath(); g.ellipse(r() * WELT.b, r() * WELT.h, 40 + r() * 90, 20 + r() * 40, 0, 0, 7); g.fill();
  }
  // Wasser unten rechts (für den Steg)
  g.save();
  g.beginPath(); g.moveTo(1300, WELT.h); g.bezierCurveTo(1380, 1260, 1520, 1180, 1660, 1170); g.bezierCurveTo(1730, 1165, 1780, 1120, WELT.b, 1060);
  g.lineTo(WELT.b, WELT.h); g.closePath();
  g.fillStyle = "#e7d39b"; g.fill();
  g.translate(18, 22); g.beginPath(); g.moveTo(1330, WELT.h); g.bezierCurveTo(1410, 1280, 1540, 1205, 1670, 1195); g.bezierCurveTo(1740, 1190, 1785, 1150, WELT.b, 1090);
  g.lineTo(WELT.b, WELT.h); g.closePath();
  const wg = g.createLinearGradient(1400, 1100, 1800, 1400); wg.addColorStop(0, "#5cc2dc"); wg.addColorStop(1, "#2f8fc0");
  g.fillStyle = wg; g.fill();
  g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 3; g.stroke();
  g.restore();
  for (let k = 0; k < 28; k++) {
    const x = 1450 + r() * 350, y = 1250 + r() * 150; if (y < 1330 - (x - 1450) * 0.4) continue;
    g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 8 + r() * 14, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  }
  // Wege
  g.lineCap = "round"; g.lineJoin = "round";
  const wege = [
    [[1270, 340], [1180, 420], [1060, 500], [1010, 600], [965, 790], [900, 900], [760, 1000], [560, 980], [330, 910]],
    [[1010, 600], [1190, 610], [1385, 730], [1500, 900], [1600, 1130]],
    [[965, 790], [1080, 900], [1130, 990]],
    [[560, 980], [460, 760], [300, 580]],
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
  for (let k = 0; k < 1500; k++) {
    const x = r() * WELT.b, y = r() * WELT.h; if (y > 1300 - (x - 1300) * 0.5 && x > 1300) continue;
    g.strokeStyle = r() < .5 ? "#5e9935" : "#a3d46c"; g.lineWidth = 2;
    for (let b = -1; b <= 1; b++) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + b * 3, y - 5, x + b * 5, y - 9 - r() * 4); g.stroke(); }
  }
  const fc = ["#fff", "#ffd84d", "#ff9fb2", "#c9a2ff", "#9fd0ff"];
  for (let k = 0; k < 260; k++) {
    const x = r() * WELT.b, y = r() * WELT.h; if (Math.hypot(x - 620, (y - 560) * 1.7) < 380) continue;
    if (x > 1300 && y > 1300 - (x - 1300) * 0.5) continue;
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
  for (const d of dinge.values()) d.el.remove();
  dinge.clear();
  // Felder
  S.felder.forEach((f, i) => {
    const p = FELDPLAETZE[i];
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
  if (S.felder.length < FELDPLAETZE.length) {
    const p = FELDPLAETZE[S.felder.length];
    const d = neuesDing("neuesfeld", "feld-leer", p.x, p.y, FELD_BREITE, { cls: "bauplatz", tipp: feldKaufen });
    overlay(d, `<div class="schild">${muenze("ic klein")} ${feldPreis(S.felder.length)}<br><small>Neues Feld</small></div>`);
  }
  // feste Gebäude
  for (const [key, g] of Object.entries(GEBAEUDE)) {
    if (key === "schafweide") continue;
    if (!S.gebaut[key] && key !== "steg") { bauplatz(key, g); continue; }
    neuesDing(key, g.bild, g.x, g.y, g.breite, { cls: "gebaeude", tipp: () => gebaeudeTipp(key), upd: d => gebaeudeUpd(key, d) });
  }
  if (!S.gebaut.schafweide) bauplatz("schafweide", GEBAEUDE.schafweide);
  else weideZaun();
  // Tiere
  for (const [art, liste] of Object.entries(S.tiere)) liste.forEach((_, i) => tierErzeugen(art, i));
  // Häuser und Deko
  S.bauten.forEach((b, i) => {
    const B = BAUTEN[b.typ];
    neuesDing("bau" + i, B.bild, b.x, b.y, B.breite, { cls: B.art, tipp: () => bauTipp(i) });
  });
}
function bauplatz(key, g) {
  const d = neuesDing(key, "kachel", g.x, g.y, g.breite * .8, { cls: "bauplatz", tipp: () => bauplatzTipp(key) });
  const offen = S.level >= g.level;
  overlay(d, `<div class="schild">${offen ? `${muenze("ic klein")} ${g.preis}` : `🔒 Level ${g.level}`}<br><small>${g.name}</small></div>`);
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
    t.t = null; erfahrung(T.xp); huepf(d); fliegt(d, T.ware, 1); ereignis("sammeln");
  }
  speichern(); aktualisieren();
}

/* ---------- Felder ---------- */
let saat = null; // gewählte Pflanze für schnelles Säen
function feldTipp(i) {
  const f = S.felder[i], d = dinge.get("feld" + i);
  if (f.p && f.t <= jetzt()) {
    const P = PFLANZEN[f.p];
    if (!geben(f.p, P.ertrag)) return;
    fliegt(d, f.p, P.ertrag); erfahrung(P.xp); ereignis("ernte");
    f.p = null; f.t = 0; huepf(d);
  } else if (f.p) {
    meldung(`${WAREN[f.p].name} wächst noch ${dauer(f.t - jetzt())}`); return;
  } else if (saat) {
    saeen(i, saat);
  } else {
    saatAuswahl(i); return;
  }
  speichern(); aktualisieren();
}
function saeen(i, p) {
  const f = S.felder[i]; f.p = p; f.t = jetzt() + PFLANZEN[p].zeit * 1000; huepf(dinge.get("feld" + i));
}
function saatAuswahl(i) {
  oeffnen("saat", () => `
    <div class="kopf"><h2>Was möchtest du säen?</h2>${zu()}</div>
    <div class="raster3">${Object.entries(PFLANZEN).map(([k, P]) => {
      const frei = S.level >= P.level;
      return `<button class="karte" data-aktion="saeen" data-p="${k}" data-i="${i}" ${frei ? "" : "disabled"}>
        ${icon(k, "ic gross")}<b>${WAREN[k].name}</b>
        <small>${frei ? `${dauer(P.zeit * 1000)} · ergibt ${P.ertrag}` : `ab Level ${P.level}`}</small></button>`;
    }).join("")}</div>
    <p class="hinweis">Danach kannst du weitere leere Felder einfach antippen, um dasselbe zu säen.</p>`);
}
function feldKaufen() {
  const preis = feldPreis(S.felder.length);
  oeffnen("feldkauf", () => `
    <div class="kopf"><h2>Neues Feld</h2>${zu()}</div>
    <p>Ein weiteres Feld für mehr Ernte.</p>
    <button class="los" data-aktion="feldkaufen" ${S.muenzen >= preis ? "" : "disabled"}>${muenze()} ${preis} – Kaufen</button>`);
}

/* ---------- Gebäude ---------- */
function gebaeudeUpd(key, d) {
  if (FABRIKEN[key]) {
    fabrikWeiter(key);
    const F = S.fabrik[key];
    if (F.fertig.length) overlay(d, blase(icon(F.fertig[0].ware, "ic mittel"), -10));
    else if (F.q.length) {
      const q = F.q[0], R = FABRIKEN[key].rezepte[q.r];
      overlay(d, uhr(q.ende - jetzt(), R.zeit, -6) + `<div class="rauch"><i></i><i></i><i></i></div>`);
    } else overlay(d, "");
  } else if (key === "tafel") {
    const n = S.auftraege.filter(a => a.ab <= jetzt() && hat(a.waren)).length;
    overlay(d, n ? blase(`<b class="zahl">${n}</b>`, -30) : "");
  } else if (key === "kuhstall" || key === "huehnerstall") {
    const art = key === "kuhstall" ? "kuh" : "huhn";
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
  else if (key === "kuhstall") stallPanel("kuh");
  else if (key === "huehnerstall") stallPanel("huhn");
  else if (key === "schafweide") stallPanel("schaf");
  else if (key === "steg") oeffnen("steg", () => `
    <div class="kopf"><h2>Steg zur Insel</h2>${zu()}</div>
    <div class="insel-vorschau"><img src="${bildUrl("insel")}" alt="Die Abenteuerinsel"></div>
    <p>Mit dem Boot geht es zur Abenteuerinsel: Wege freiräumen, Schätze finden, Brücken reparieren und Quests erfüllen.</p>
    <button class="los" data-aktion="zurinsel" ${S.level >= 2 ? "" : "disabled"}>${S.level >= 2 ? "Losfahren" : "Ab Level 2"}</button>`);
}
function abholen(key) {
  const F = S.fabrik[key], e = F.fertig[0];
  if (!geben(e.ware, e.menge)) return;
  F.fertig.shift(); erfahrung(e.xp); fliegt(dinge.get(key), e.ware, e.menge); huepf(dinge.get(key));
  speichern(); aktualisieren();
}
function fabrikPanel(key) {
  oeffnen("fabrik:" + key, () => {
    fabrikWeiter(key);
    const F = S.fabrik[key], Fa = FABRIKEN[key];
    const plaetze = [];
    for (let k = 0; k < WARTESCHLANGE; k++) {
      if (k < F.fertig.length) plaetze.push(`<button class="platz fertig" data-aktion="abholen" data-k="${key}">${icon(F.fertig[k].ware)}<small>abholen</small></button>`);
      else {
        const qi = k - F.fertig.length;
        if (qi < F.q.length) plaetze.push(`<div class="platz laeuft">${icon(Fa.rezepte[F.q[qi].r].ware)}<small>${qi === 0 ? dauer(F.q[0].ende - jetzt()) : "wartet"}</small></div>`);
        else plaetze.push(`<div class="platz"><small>frei</small></div>`);
      }
    }
    const voll = F.q.length + F.fertig.length >= WARTESCHLANGE;
    return `<div class="kopf"><h2>${Fa.name}</h2>${zu()}</div>
      <div class="rezepte">${Fa.rezepte.map((R, r) => {
        const frei = S.level >= R.level;
        return `<div class="rezept ${frei ? "" : "gesperrt"}">
          <div class="aus">${icon(R.ware, "ic gross")}<span>${R.menge > 1 ? "×" + R.menge : ""}</span></div>
          <div class="ein">${Object.entries(R.zutaten).map(([w, n]) => `<span class="${(S.lager[w] || 0) >= n ? "" : "fehlt"}">${icon(w)}${S.lager[w] || 0}/${n}</span>`).join("")}
            <small>${frei ? dauer(R.zeit * 1000) : "ab Level " + R.level}</small></div>
          <button class="los" data-aktion="herstellen" data-k="${key}" data-r="${r}" ${frei && !voll && hat(R.zutaten) ? "" : "disabled"}>Herstellen</button>
        </div>`;
      }).join("")}</div>
      <div class="plaetze">${plaetze.join("")}</div>`;
  });
}
function stallPanel(art) {
  oeffnen("stall:" + art, () => {
    const T = TIERE[art], liste = S.tiere[art];
    const hungrig = liste.filter(t => t.t === null).length, fertig = liste.filter(t => t.t !== null && t.t <= jetzt()).length;
    return `<div class="kopf"><h2>${GEBAEUDE[T.stall].name}</h2>${zu()}</div>
      <p>${liste.length} ${liste.length === 1 ? T.name : T.name === "Schaf" ? "Schafe" : T.name === "Kuh" ? "Kühe" : "Hühner"} · 1 ${icon("futter", "ic klein")} ergibt 1 ${icon(T.ware, "ic klein")} in ${dauer(T.zeit * 1000)}</p>
      <div class="knoepfe">
        <button class="los" data-aktion="allefuettern" data-a="${art}" ${hungrig && S.lager.futter ? "" : "disabled"}>Alle füttern (${hungrig})</button>
        <button class="los" data-aktion="allesammeln" data-a="${art}" ${fertig ? "" : "disabled"}>Alles einsammeln (${fertig})</button>
      </div>
      <button class="los zweit" data-aktion="tierkaufen" data-a="${art}" ${liste.length < T.max && S.muenzen >= T.preis ? "" : "disabled"}>
        ${liste.length < T.max ? `${T.name} kaufen · ${muenze("ic klein")} ${T.preis}` : "Der Stall ist voll"}</button>`;
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

/* ---------- Lager ---------- */
function lagerPanel() {
  oeffnen("lager", () => {
    const preis = SCHEUNE.preis(S.scheuneLvl);
    const waren = Object.keys(WAREN).filter(w => S.lager[w] > 0);
    return `<div class="kopf"><h2>Scheune</h2>${zu()}</div>
      <div class="fuellstand"><span>${belegt()} von ${kapazitaet()} Plätzen belegt</span><i style="width:${belegt() / kapazitaet() * 100}%"></i></div>
      <div class="lagerraster">${waren.length ? waren.map(w => `<div class="lagerding">${icon(w, "ic gross")}<b>${S.lager[w]}</b><small>${WAREN[w].name}</small></div>`).join("") : `<p class="hinweis">Die Scheune ist leer. Ernte Felder und sammle bei den Tieren ein.</p>`}</div>
      <button class="los zweit" data-aktion="scheuneausbauen" ${S.muenzen >= preis ? "" : "disabled"}>Scheune ausbauen (+${SCHEUNE.plus}) · ${muenze("ic klein")} ${preis}</button>`;
  });
}

/* ---------- Bauen und Platzieren ---------- */
let platzieren = null; // { typ, index? } index = vorhandenes Ding verschieben
function baumenu() {
  oeffnen("bauen", () => `
    <div class="kopf"><h2>Bauen</h2>${zu()}</div>
    <div class="baumenu">${Object.entries(BAUTEN).filter(([k, B]) => !B.insel || S.dekoFrei[k] > 0).map(([k, B]) => {
      if (B.insel) return `<button class="karte geschenk" data-aktion="platzieren" data-t="${k}">
        <img class="bauicon" src="${bildUrl(B.bild)}" alt=""><b>${B.name}</b><small>Belohnung · ${S.dekoFrei[k]}× frei</small></button>`;
      const frei = S.level >= B.level, geld = S.muenzen >= B.preis;
      return `<button class="karte" data-aktion="platzieren" data-t="${k}" ${frei && geld ? "" : "disabled"}>
        <img class="bauicon" src="${bildUrl(B.bild)}" alt=""><b>${B.name}</b>
        <small>${frei ? `${muenze("ic klein")} ${B.preis}${B.einwohner ? ` · +${B.einwohner} Einwohner` : ""}` : `ab Level ${B.level}`}</small></button>`;
    }).join("")}</div>
    <p class="hinweis">Um etwas umzustellen, tippe es auf dem Hof an.</p>`);
}
function bauTipp(i) {
  const b = S.bauten[i], B = BAUTEN[b.typ];
  oeffnen("bau" + i, () => `
    <div class="kopf"><h2>${B.name}</h2>${zu()}</div>
    ${B.einwohner ? `<p>Hier wohnen ${B.einwohner} Einwohner.</p>` : `<p>Schön sieht es aus.</p>`}
    <button class="los" data-aktion="verschieben" data-i="${i}">Umstellen</button>`);
}
const geist = $("#geist");
function platzierenStart(typ, index = null) {
  schliessen();
  platzieren = { typ, index, x: null, y: null };
  const B = BAUTEN[typ];
  geist.innerHTML = `<img src="${bildUrl(B.bild)}" alt="">`;
  geist.style.width = B.breite + "px";
  if (index !== null) dinge.get("bau" + index).el.classList.add("weg");
  const mitte = zuWelt(innerWidth / 2, innerHeight / 2);
  geistSetzen(mitte.x, mitte.y);
  $("#platzleiste").hidden = false;
  welt.appendChild(geist); geist.hidden = false;
}
function hindernisse() {
  const h = [];
  S.felder.forEach((_, i) => h.push({ x: FELDPLAETZE[i].x, y: FELDPLAETZE[i].y - 55, r: 85 }));
  if (S.felder.length < FELDPLAETZE.length) { const p = FELDPLAETZE[S.felder.length]; h.push({ x: p.x, y: p.y - 55, r: 85 }); }
  for (const [k, g] of Object.entries(GEBAEUDE)) if (g.r) h.push({ x: g.x, y: g.y - g.r * .5, r: g.r });
  for (const w of Object.values(WEIDEN)) h.push({ x: w.x, y: w.y + 10, r: Math.max(w.rx, w.ry * 1.6) * .85 });
  S.bauten.forEach((b, i) => { if (platzieren && platzieren.index === i) return; const B = BAUTEN[b.typ]; h.push({ x: b.x, y: b.y - B.r * .5, r: B.r }); });
  return h;
}
function platzFrei(x, y, typ) {
  const B = BAUTEN[typ];
  if (x < 60 || x > WELT.b - 60 || y < 120 || y > WELT.h - 30) return false;
  if (x > 1300 && y > 1240 - (x - 1300) * 0.45) return false; // Wasser
  return hindernisse().every(o => Math.hypot(o.x - x, o.y - (y - B.r * .5)) > (o.r + B.r) * .82);
}
function geistSetzen(x, y) {
  const B = BAUTEN[platzieren.typ];
  platzieren.x = Math.round(x); platzieren.y = Math.round(y + hoehe(B.bild, B.breite) * .35);
  const h = hoehe(B.bild, B.breite);
  geist.style.left = (platzieren.x - B.breite / 2) + "px"; geist.style.top = (platzieren.y - h) + "px";
  geist.style.height = h + "px"; geist.style.zIndex = 5000;
  const ok = platzFrei(platzieren.x, platzieren.y, platzieren.typ);
  geist.classList.toggle("schlecht", !ok);
  $("#platz-ok").disabled = !ok;
}
function geistBewegen(e) { if (e.pointerType === "mouse") { const p = zuWelt(e.clientX, e.clientY); geistSetzen(p.x, p.y); } }
function platzierenEnde(ok) {
  if (ok && platzieren && platzFrei(platzieren.x, platzieren.y, platzieren.typ)) {
    const B = BAUTEN[platzieren.typ];
    if (platzieren.index !== null) Object.assign(S.bauten[platzieren.index], { x: platzieren.x, y: platzieren.y });
    else {
      if (S.muenzen < B.preis) return;
      if (B.insel) { if (!(S.dekoFrei[platzieren.typ] > 0)) return; S.dekoFrei[platzieren.typ]--; }
      S.muenzen -= B.preis; S.bauten.push({ typ: platzieren.typ, x: platzieren.x, y: platzieren.y });
      erfahrung(B.xp); if (B.art === "haus") ereignis("bauen:haus");
      meldung(`${B.name} gebaut${B.einwohner ? `: +${B.einwohner} Einwohner` : ""}`);
    }
  }
  platzieren = null; geist.hidden = true; $("#platzleiste").hidden = true;
  weltAufbauen(); speichern(); aktualisieren();
}
$("#platz-ok").onclick = () => platzierenEnde(true);
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
    const preis = feldPreis(S.felder.length);
    if (S.muenzen >= preis) { S.muenzen -= preis; S.felder.push({ p: null, t: 0 }); erfahrung(3); schliessen(); weltAufbauen(); }
  }
  if (a === "herstellen") {
    const key = b.dataset.k, R = FABRIKEN[key].rezepte[+b.dataset.r], F = S.fabrik[key];
    if (!hat(R.zutaten) || F.q.length + F.fertig.length >= WARTESCHLANGE) return;
    nehmen(R.zutaten);
    const letzt = F.q.length ? F.q[F.q.length - 1].ende : t;
    F.q.push({ r: +b.dataset.r, ende: Math.max(t, letzt) + R.zeit * 1000 });
    huepf(dinge.get(key)); ereignis("herstellen:" + R.ware);
  }
  if (a === "abholen") abholen(b.dataset.k);
  if (a === "allefuettern") {
    const art = b.dataset.a, T = TIERE[art];
    S.tiere[art].forEach((tier, i) => { if (tier.t === null && S.lager.futter > 0) { S.lager.futter--; tier.t = t + T.zeit * 1000; huepf(dinge.get(art + i)); ereignis("fuettern"); } });
  }
  if (a === "allesammeln") {
    const art = b.dataset.a, T = TIERE[art];
    S.tiere[art].forEach((tier, i) => { if (tier.t !== null && tier.t <= t && geben(T.ware, 1)) { tier.t = null; erfahrung(T.xp); fliegt(dinge.get(art + i), T.ware, 1); ereignis("sammeln"); } });
  }
  if (a === "tierkaufen") {
    const art = b.dataset.a, T = TIERE[art];
    if (S.muenzen >= T.preis && S.tiere[art].length < T.max) { S.muenzen -= T.preis; S.tiere[art].push({ t: null }); tierErzeugen(art, S.tiere[art].length - 1); erfahrung(2); }
  }
  if (a === "gebaeudebauen") {
    const key = b.dataset.k, g = GEBAEUDE[key];
    if (S.muenzen >= g.preis && S.level >= g.level && einwohner() >= g.einwohner) {
      S.muenzen -= g.preis; S.gebaut[key] = 1; erfahrung(10);
      if (FABRIKEN[key]) S.fabrik[key] = { q: [], fertig: [] };
      if (key === "huehnerstall") S.tiere.huhn = [{ t: null }, { t: null }];
      if (key === "schafweide") S.tiere.schaf = [{ t: null }, { t: null }];
      schliessen(); weltAufbauen(); meldung(`${g.name} ist fertig!`);
    }
  }
  if (a === "liefern") {
    const i = +b.dataset.i, A = S.auftraege[i];
    if (!hat(A.waren)) return;
    nehmen(A.waren); S.muenzen += A.muenzen; erfahrung(A.xp);
    if (A.werkzeug) { S.werkzeug ??= { axt: 3, schaufel: 2, spitzhacke: 2 }; S.werkzeug[A.werkzeug]++; }
    insel.ereignis("auftrag");
    S.auftraege[i] = { ...neuerAuftrag(), ab: t + 8000 };
    fliegtMuenzen(dinge.get("tafel")); ereignis("liefern");
  }
  if (a === "ablehnen") { const i = +b.dataset.i; S.auftraege[i] = { ...neuerAuftrag(), ab: t + 20000 }; }
  if (a === "scheuneausbauen") { const p = SCHEUNE.preis(S.scheuneLvl); if (S.muenzen >= p) { S.muenzen -= p; S.scheuneLvl++; erfahrung(5); } }
  if (a === "platzieren") { platzierenStart(b.dataset.t); return; }
  if (a === "zurinsel") { insel.betreten(); return; }
  if (a === "verschieben") { platzierenStart(S.bauten[+b.dataset.i].typ, +b.dataset.i); return; }
  speichern(); aktualisieren();
});
function saatLeiste() {
  const l = $("#saatleiste");
  l.innerHTML = `${icon(saat, "ic")}<span>Tippe weitere leere Felder an, um ${WAREN[saat].name} zu säen.</span><button id="saat-fertig">Fertig</button>`;
  l.hidden = false;
  $("#saat-fertig").onclick = () => { saat = null; l.hidden = true; };
}

/* ================= Anzeigen ================= */
function meldung(text) {
  const m = $("#meldung"); m.textContent = text; m.hidden = false;
  m.classList.remove("neu"); void m.offsetWidth; m.classList.add("neu");
  clearTimeout(meldung.t); meldung.t = setTimeout(() => { m.hidden = true; }, 2600);
}
function fliegt(d, ware, n) {
  if (!d) return;
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
  const bd = $("#auftrag-zahl"); bd.hidden = !n; bd.textContent = n;
  for (const d of dinge.values()) d.upd(d);
  insel.aktualisieren();
  fensterZeichnen();
}

/* ================= Insel ================= */
const insel = inselStarten({
  S: () => S, speichern, meldung, oeffnen, schliessen, zu, icon, muenze, bildUrl, hoehe, hat, nehmen, dauer, aktualisieren,
});

/* ================= Puzzle ================= */
const puzzle = puzzleStarten({
  S: () => S, speichern, meldung, schliessen, bildUrl, muenze, aktualisieren, inselEreignis: t => insel.ereignis(t),
});
$("#knopf-puzzle").onclick = () => puzzle.oeffnen();
$("#knopf-puzzle2").onclick = () => puzzle.oeffnen();

/* ================= Start ================= */
addEventListener("keydown", e => { if (e.key === "Escape") { if (platzieren) platzierenEnde(false); else schliessen(); } });
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
  if (platzieren) { platzieren = null; geist.hidden = true; $("#platzleiste").hidden = true; }
  S = neu; S.dekoFrei ??= {};
  if (insel.aktiv) insel.verlassen();
  auftraegeAuffuellen(); lokalSichern();
  weltAufbauen(); zeichneSchritt(); aktualisieren();
}
sync = syncStarten({ getS: () => S, setS: standUebernehmen, meldung, oeffnen, zu, schliessen, neustartFragen });
$("#knopf-neu").onclick = () => sync.panel();
host.addEventListener("click", e => {
  if (e.target.closest("[data-aktion='neustart']")) { S = neuerStand(); S.dekoFrei = {}; if (insel.aktiv) insel.verlassen(); auftraegeAuffuellen(); try { localStorage.removeItem(SPEICHER); } catch {} schliessen(); weltAufbauen(); zeichneSchritt(); aktualisieren(); speichern(); }
});
zeichneBoden();
weltAufbauen();
startKamera();
zeichneSchritt();
aktualisieren();
setInterval(aktualisieren, 500);
setInterval(lokalSichern, 5000);
addEventListener("visibilitychange", () => { if (document.hidden) lokalSichern(); });
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
