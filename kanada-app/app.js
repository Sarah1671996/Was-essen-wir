import { BASES, SIGHTS, TAGS, REGIONS, AIRPORTS, HOME_AIRPORTS, HOME_AP_POS, AIRLINES, CAR_SITES, CAR_INS, CHECKLIST, PACKLIST, TIPS, COST_LABEL, TZ_LABEL, costLabel } from "./data.js";
import * as P from "./plan.js";
import * as St from "./store.js";
import { lodgingLinks, mapsPlace, mapsRoute } from "./links.js";
import * as Adv from "./advice.js";
import { fillPhotos } from "./photos.js";

/* ---------- kleine Helfer ---------- */
const $ = s => document.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};
const todayIso = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const fmtD = (iso, opt = { weekday: "short", day: "numeric", month: "short" }) => iso ? new Date(iso + "T12:00:00").toLocaleDateString("de-DE", opt) : "";
const fmtShort = iso => fmtD(iso, { day: "numeric", month: "short" });
const safeUrl = u => /^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "";
// Zahl aus „580,15“, „580.15“, „1.250“, „1.250,50“ oder „1,250.50“ lesen
function num(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v ?? "").replace(/[^\d.,-]/g, "");
  const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // Beide kommen vor: das hintere Zeichen trennt die Nachkommastellen
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) && s.split(",").length > 2 ? s.replace(/,/g, "") : s.replace(/,/g, ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
// Zahl so ins Formular schreiben, wie man sie tippt: 580,15
const numIn = n => n ? String(Math.round(n * 100) / 100).replace(".", ",") : "";
const money = (n, cur = "EUR") => new Intl.NumberFormat("de-DE", { style: "currency", currency: cur, maximumFractionDigits: n >= 100 ? 0 : 2 }).format(n || 0);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const ago = ts => { const d = Math.floor((Date.now() - ts) / 864e5); return d <= 0 ? "heute" : d === 1 ? "gestern" : `vor ${d} Tagen`; };
const daysUntil = iso => P.daysBetween(todayIso(), iso);
const linkBtns = list => `<div class="links">${list.map(l => `<a class="linkchip" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.name)} ↗</a>`).join("")}</div>`;

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 2800);
}

/* ---------- Zustand ---------- */
let T = St.loadLocal();
const UI = { tab: ls.get("ka.tab") || "start", stop: ls.get("ka.stop") || null, addFilter: "", addTag: "" };
const pax = () => ({ adults: T.adults || 2, children: T.children || 0 });
const stops = () => T?.stops || [];
const stopById = id => stops().find(s => s.id === id);
function range() {
  const s = stops();
  return s.length ? [s[0].from, s.at(-1).to] : [T.start, T.end];
}
const rate = () => Number(JSON.parse(ls.get("ka.rate") || "null")?.cadEur) || 0.67;
const toEur = (n, cur) => cur === "CAD" ? n * rate() : n;

function commit(rerender = true) {
  noteDeleted();
  St.save(T);
  if (rerender) render();
}

/* ---------- Zusammenführen, wenn zwei Geräte gleichzeitig planen ---------- */
// Alle Einträge mit id (Orte, Wünsche, Flüge, Unterkünfte, Angebote, Ausgaben)
function idsOf(t) {
  const ids = new Set();
  const add = list => (list || []).forEach(x => x?.id && ids.add(x.id));
  add(t?.stops); (t?.stops || []).forEach(s => add(s.wishes));
  add(t?.flights); add(t?.lodgings); (t?.lodgings || []).forEach(l => add(l.offers));
  add(t?.expenses); add(t?.car?.offers); add(t?.people);
  return ids;
}
// Was seit dem letzten Speichern verschwunden ist, wurde gelöscht – merken, damit es beim Zusammenführen nicht zurückkommt
let knownIds = idsOf(T);
function noteDeleted() {
  if (!T) return;
  const now = idsOf(T), gone = T.gone ||= {}, cut = Date.now() - 90 * 864e5;
  for (const id of knownIds) if (!now.has(id)) gone[id] = Date.now();
  for (const [id, at] of Object.entries(gone)) if (at < cut) delete gone[id];
  knownIds = now;
}
// Zwei Listen nach id vereinen; bei Einträgen in beiden gewinnt die neuere Fassung, Gelöschtes bleibt weg
function mergeList(a = [], b = [], preferB, gone, nest) {
  const A = new Map(a.filter(x => x?.id).map(x => [x.id, x])), B = new Map(b.filter(x => x?.id).map(x => [x.id, x]));
  const out = [], seen = new Set();
  for (const x of preferB ? [...b, ...a] : [...a, ...b]) {
    if (!x?.id || seen.has(x.id) || gone[x.id]) continue;
    seen.add(x.id);
    const ax = A.get(x.id), bx = B.get(x.id);
    let m = ax && bx ? (preferB ? { ...ax, ...bx } : { ...bx, ...ax }) : (ax || bx);
    if (ax && bx && nest) m = nest(ax, bx, m);
    out.push(m);
  }
  return out;
}
const mergePrices = (a = [], b = []) => [...new Map([...a, ...b].map(p => [p.at, p])).values()].sort((x, y) => x.at - y.at);
function mergeTrip(L, R) {
  if (!L) return R;
  const preferR = (R.st || 0) >= (L.st || 0), newer = preferR ? R : L, older = preferR ? L : R;
  const gone = { ...(L.gone || {}), ...(R.gone || {}) };
  const out = { ...older, ...newer, gone };
  out.stops = mergeList(L.stops, R.stops, preferR, gone, (a, b, m) => ({ ...m, wishes: mergeList(a.wishes, b.wishes, preferR, gone) }));
  // Ein verschobener Wunsch soll nur an einem Ort stehen: dort, wo ihn der neuere Stand hat
  const home = new Map(); (newer.stops || []).forEach(s => (s.wishes || []).forEach(w => home.set(w.id, s.id)));
  out.stops.forEach(s => { s.wishes = (s.wishes || []).filter(w => !home.has(w.id) || home.get(w.id) === s.id); });
  out.flights = mergeList(L.flights, R.flights, preferR, gone, (a, b, m) => ({ ...m, prices: mergePrices(a.prices, b.prices) }));
  out.lodgings = mergeList(L.lodgings, R.lodgings, preferR, gone, (a, b, m) => ({ ...m, offers: mergeList(a.offers, b.offers, preferR, gone) }));
  out.expenses = mergeList(L.expenses, R.expenses, preferR, gone);
  out.people = mergeList(L.people, R.people, preferR, gone);
  if (L.car || R.car) out.car = newer.car === null && older.car ? null : { ...(older.car || {}), ...(newer.car || {}), offers: mergeList(L.car?.offers, R.car?.offers, preferR, gone) };
  for (const k of ["checks", "packed", "dayTimes"]) out[k] = { ...(older[k] || {}), ...(newer[k] || {}) };
  return out;
}
// Stand vom anderen Gerät kommt an
function receiveRemote(R) {
  const merged = Object.assign(blankTrip(), mergeTrip(T, R));
  const same = JSON.stringify({ ...merged, st: 0 }) === JSON.stringify({ ...Object.assign(blankTrip(), R), st: 0 });
  T = merged;
  knownIds = idsOf(T);
  if (same) St.adopt(T); else St.save(T); // Eigene Änderungen waren dabei → zurückschicken
  repairAndTell();
  render();
}

// Neuer Plan mit sinnvollen Grundwerten
function blankTrip(o = {}) {
  return {
    v: 1, name: "Kanada", start: "", end: "", adults: 2, children: 0, home: "FRA",
    pace: "normal", dayStart: "08:30", dayEnd: "19:00", criteria: ["natur", "aussicht"], checkEvery: 3,
    stops: [], flights: [], lodgings: [], expenses: [], checks: {}, packed: {}, ...o
  };
}

/* ---------- Plan je Ort ---------- */
// Wo man wirklich schläft: gebuchte Unterkunft mit bekannter Lage, sonst der Ort selbst
function homeOf(stop) {
  // Liegt die Unterkunft weit weg vom Ort, ist die gefundene Adresse vermutlich falsch – dann lieber den Ort nehmen
  const l = T.lodgings.find(x => x.stopId === stop.id && x.status === "gebucht" && x.lat != null && !lodgeFar(x, stop));
  return l ? { ...stop, lat: l.lat, lng: l.lng, lodging: l.name } : stop;
}
const lodgeFar = (l, stop) => l.lat != null && stop && P.km(l, stop) > 60;
function ctxFor(stop) {
  const list = stops(), i = list.indexOf(stop);
  const prev = list[i - 1] && homeOf(list[i - 1]), next = list[i + 1];
  return {
    prev: prev ? { lat: prev.lat, lng: prev.lng, name: prev.lodging || prev.name } : null,
    prevMode: stop.mode || "auto", next,
    pace: T.pace, dayStart: T.dayStart, dayEnd: T.dayEnd, dayTimes: T.dayTimes || {},
    others: list.filter(s => s !== stop).map(s => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng }))
  };
}
function planFor(stop) {
  const ctx = ctxFor(stop), home = homeOf(stop);
  const pts = [home, ctx.prev, ...stop.wishes.map(P.wishPoint)].filter(Boolean);
  P.prefetch(pts);
  return P.planStop(home, ctx);
}

/* ---------- Kilometer & Kosten der ganzen Reise ---------- */
// Alle Fahrten: Etappen zwischen den Orten und Ausflüge zu den Sehenswürdigkeiten (aus den Tagesplänen)
function tripTotals() {
  const days = stops().flatMap(s => planFor(s).days);
  const km = days.reduce((t, d) => t + d.km, 0), min = days.reduce((t, d) => t + d.drive, 0);
  const legKm = P.legs(stops()).filter(l => l.mode === "auto").reduce((t, l) => t + l.km, 0);
  const fuel = T.fuel || {};
  const l100 = fuel.l100 || 10, price = fuel.price || 1.7;
  const liters = km * l100 / 100;
  return { days, km, min, legKm, tripKm: Math.max(0, km - legKm), liters, fuelCad: liters * price, fuelEur: liters * price * rate(), l100, price };
}
P.onRoutesUpdated(() => render());

/* ---------- Darstellung ---------- */
const TABS = { start: viewStart, route: viewRoute, tage: viewTage, fluege: viewFlights, unterkunft: viewLodging, mehr: viewMore };
function render() {
  if (!T) { UI.tab = "start"; }
  document.querySelectorAll(".nav button").forEach(b => b.setAttribute("aria-current", b.dataset.tab === UI.tab ? "page" : "false"));
  $("#tripName").textContent = T ? T.name : "Kanada-Reiseplaner";
  $("#nav").hidden = !T;
  const main = $("#main"), y = main.dataset.tab === UI.tab ? scrollY : 0;
  clearMaps();
  main.dataset.tab = UI.tab;
  main.innerHTML = TABS[UI.tab]();
  scrollTo(0, y);
  afterRender[UI.tab]?.();
}
const afterRender = {
  start() { fillWeatherStart(); },
  route() { drawRouteMap(); },
  tage() { drawDayMap(); fillWeatherDays(); fillPhotos(); }
};

/* ---------- Start ---------- */
function viewStart() {
  if (!T) return viewSetup();
  const [a, b] = range();
  const nights = a && b ? P.daysBetween(a, b) : 0;
  const B = budget(), tt = B.tt;
  let hero = "";
  if (a) {
    const d = daysUntil(a), e = daysUntil(b);
    hero = d > 0 ? `<p class="countdown"><strong>${d}</strong> ${d === 1 ? "Tag" : "Tage"} bis Kanada 🍁</p>${d > 13 ? `<p class="small">Das sind ${Math.floor(d / 7)} Wochen${d % 7 ? ` und ${plural(d % 7, "Tag", "Tage")}` : ""}.</p>` : ""}`
      : e >= 0 ? `<p class="countdown">Tag <strong>${1 - d}</strong> von ${nights + 1} – gute Reise! 🍁</p>`
      : `<p class="countdown">Willkommen zurück! 🍁</p>`;
  }
  const alerts = collectAlerts();
  // Fortschritt beim Buchen
  const needBeds = stops().filter(s => P.daysBetween(s.from, s.to) > 0);
  const beds = needBeds.filter(s => T.lodgings.some(l => l.stopId === s.id && l.status === "gebucht")).length;
  const flightsBooked = T.flights.filter(f => f.booked).length;
  const checks = CHECKLIST.filter(c => T.checks[c.id]).length;
  const bar = (label, n, of, tab) => `<button class="prog" data-act="tab" data-tab="${tab}"><span>${label}</span><span class="small">${n} / ${of}</span><span class="track"><span style="width:${of ? Math.round(n / of * 100) : 0}%"></span></span></button>`;
  const parts = [["✈️ Flüge", B.flights, ""], ["🏡 Unterkünfte", B.lodging, ""], ["🚗 Mietwagen", B.car, ""], ["⛽ Sprit", B.fuel, "geschätzt"], ["🎟️ Eintritte", B.entryEur, "geschätzt"], ["💳 Ausgaben", B.extra, ""]].filter(p => p[1] > 0);
  const maxPart = Math.max(1, ...parts.map(p => p[1]));
  return `
  <section class="hero">
    ${hero}
    <p class="small">${a ? `${fmtD(a)} – ${fmtD(b)} · ${plural(nights, "Nacht", "Nächte")}` : "Noch kein Reisedatum"} · ${plural(pax().adults, "Erwachsener", "Erwachsene")}${pax().children ? ` · ${plural(pax().children, "Kind", "Kinder")}` : ""}</p>
    <div class="stats">
      <div><strong>${stops().length}</strong><span>Orte</span></div>
      <div><strong>${Math.round(tt.km).toLocaleString("de-DE")}</strong><span>km insgesamt</span></div>
      <div><strong>${Math.round(tt.min / 60)} h</strong><span>im Auto</span></div>
    </div>
  </section>
  ${todayCard()}

  <div class="dash">
    <section class="card tile"><span class="small">Bisher gebucht</span><strong>${money(B.total)}</strong><span class="small">${B.perPerson ? `${money(B.total / (pax().adults + pax().children))} pro Person` : "&nbsp;"}</span></section>
    <section class="card tile"><span class="small">Voraussichtlich gesamt</span><strong>${money(B.expected)}</strong><span class="small">${B.perDay ? `≈ ${money(B.perDay)} pro Tag` : "&nbsp;"}</span></section>
    <section class="card tile"><span class="small">Kilometer</span><strong>${Math.round(tt.km).toLocaleString("de-DE")} km</strong><span class="small">${Math.round(tt.legKm).toLocaleString("de-DE")} Etappen · ${Math.round(tt.tripKm).toLocaleString("de-DE")} Ausflüge</span></section>
    <section class="card tile"><span class="small">Sprit (geschätzt)</span><strong>${money(B.fuel)}</strong><span class="small">${Math.round(tt.liters).toLocaleString("de-DE")} l · ${money(tt.fuelCad, "CAD")}${B.fuelPaid ? ` · getankt: ${money(B.fuelPaid)}` : ""}</span></section>
  </div>
  <button class="btn ghost wide" data-act="exp-add">💳 Ausgabe eintragen</button>

  <section class="card">
    <h2>Wohin geht das Geld?</h2>
    ${parts.length ? `<ul class="costbars">${parts.map(p => `<li><span>${p[0]}${p[2] ? ` <span class="small">${p[2]}</span>` : ""}</span><span class="track"><span style="width:${Math.round(p[1] / maxPart * 100)}%"></span></span><strong>${money(p[1])}</strong></li>`).join("")}</ul>` : `<p class="small">Noch nichts gebucht.</p>`}
    <details class="fuelset"><summary class="small">⛽ Spritrechnung anpassen</summary>
      <div class="row2">
        <label>Verbrauch (l/100 km)<input inputmode="decimal" data-change="fuel-l100" value="${numIn(tt.l100)}"></label>
        <label>Spritpreis (CAD/l)<input inputmode="decimal" data-change="fuel-price" value="${numIn(tt.price)}"></label>
      </div>
      <p class="small">Kompaktwagen ca. 7–8, SUV ca. 9–11, Camper ca. 16–20 l/100 km. Benzin kostet in Kanada meist 1,50–1,95 CAD/l (in BC am teuersten).</p>
    </details>
  </section>

  ${bookingPlanCard()}

  <section class="card">
    <h2>Stand der Planung</h2>
    <div class="progs">
      ${bar("✈️ Flüge gebucht", flightsBooked, Math.max(1, T.flights.length), "fluege")}
      ${bar("🏡 Unterkünfte gebucht", beds, needBeds.length, "unterkunft")}
      ${bar("🚗 Mietwagen", T.car?.status === "gebucht" ? 1 : 0, 1, "fluege")}
      ${bar("✅ Vorbereitung", checks, CHECKLIST.length, "mehr")}
    </div>
  </section>
  ${alerts.length ? `<h2 class="sec">Wichtig gerade</h2><div class="alerts">${alerts.map(x => `
    <button class="alert ${x.tone || ""}" data-act="${x.act || "tab"}" data-tab="${x.tab || ""}" data-sub="${x.sub || ""}" data-id="${esc(x.id || "")}">
      <span class="ai">${x.icon}</span><span>${x.html}</span><span class="chev">›</span></button>`).join("")}</div>` : ""}
  ${!stops().length ? `<div class="card empty"><p><strong>Los geht's:</strong> Lege fest, wann du wo bist. Die App rechnet dann Fahrzeiten, plant die Tage und schlägt dir schöne Orte vor.</p>
    <button class="btn" data-act="stop-add">+ Ersten Ort hinzufügen</button></div>` : ""}
  <div class="quick">
    <button data-act="tab" data-tab="route"><span>🗺️</span>Route</button>
    <button data-act="tab" data-tab="tage"><span>🗓️</span>Tagesplan</button>
    <button data-act="tab" data-tab="fluege"><span>✈️</span>Flug &amp; Auto</button>
    <button data-act="tab" data-tab="unterkunft"><span>🏡</span>Unterkünfte</button>
  </div>
  <div id="wxStart"></div>`;
}

function collectAlerts() {
  const out = [];
  const every = T.checkEvery || 3;
  for (const f of T.flights) {
    if (f.booked) continue;
    const last = f.prices.at(-1);
    if (last && f.target && last.p <= f.target) out.push({ icon: "🎉", tone: "good", tab: "fluege", html: `<strong>Preisalarm ${esc(f.from)} → ${esc(f.to)}:</strong> ${money(last.p)} – unter deinem Ziel von ${money(f.target)}. Jetzt buchen?` });
    else if (!last || Date.now() - last.at > every * 864e5) out.push({ icon: "🔔", tab: "fluege", html: `Flugpreis ${esc(f.from)} → ${esc(f.to)} prüfen${last ? ` (zuletzt ${ago(last.at)})` : ""}` });
  }
  for (const l of T.lodgings) {
    if (l.status !== "gebucht") continue;
    const best = cheapestOffer(l);
    if (best) out.push({ icon: "💸", tone: "good", tab: "unterkunft", html: `<strong>${esc(best.name || "Ein Angebot")}</strong> ist ${money(lodgeEur(l) - toEur(best.total, best.cur))} günstiger als ${esc(l.name)}.` });
    if (l.cancelUntil) {
      const d = daysUntil(l.cancelUntil);
      if (d >= 0 && d <= 10) out.push({ icon: "⏰", tone: d <= 3 ? "warn" : "", tab: "unterkunft", html: `Kostenlos stornieren bei <strong>${esc(l.name)}</strong> nur noch ${d === 0 ? "heute" : `${plural(d, "Tag", "Tage")}`}. Letzte Chance, günstiger zu finden.` });
    }
  }
  const c = T.car;
  if (c) {
    const mine = toEur(num(c.total), c.cur), ic = insCheck(c.ins, c);
    const better = (c.offers || []).filter(o => toEur(num(o.total), o.cur) < mine - 1 && insCheck(o.ins, c).score >= ic.score).sort((x, y) => toEur(num(x.total), x.cur) - toEur(num(y.total), y.cur))[0];
    if (better) out.push({ icon: "🚗", tone: "good", tab: "fluege", sub: "auto", html: `Mietwagen: <strong>${esc(better.name)}</strong> ist ${money(mine - toEur(num(better.total), better.cur))} günstiger und mindestens gleich gut versichert.` });
    if (ic.score < 70) out.push({ icon: "🛡️", tone: "warn", tab: "fluege", sub: "auto", html: `Mietwagen ist ${ic.label} – es fehlt: ${ic.missing.slice(0, 2).map(x => esc(x.label)).join(", ")}` });
    const dl = c.cancelUntil ? daysUntil(c.cancelUntil) : null;
    if (dl != null && dl >= 0 && dl <= 10) out.push({ icon: "⏰", tone: dl <= 3 ? "warn" : "", tab: "fluege", sub: "auto", html: `Mietwagen kostenlos stornieren nur noch ${dl === 0 ? "heute" : plural(dl, "Tag", "Tage")}.` });
  } else if (stops().length) out.push({ icon: "🚗", tab: "fluege", sub: "auto", html: "Noch kein Mietwagen eingetragen" });
  const open = stops().filter(s => P.daysBetween(s.from, s.to) > 0 && !T.lodgings.some(l => l.stopId === s.id && l.status === "gebucht"));
  if (open.length) out.push({ icon: "🛏️", tab: "unterkunft", html: `Noch keine Unterkunft gebucht in <strong>${open.map(s => esc(s.name)).join(", ")}</strong>` });
  const [a] = range();
  if (a) for (const c of CHECKLIST) {
    if (T.checks[c.id]) continue;
    const left = daysUntil(a);
    if (left >= 0 && left <= c.when) out.push({ icon: "✅", tab: "mehr", html: `${esc(c.text)}` });
  }
  for (const h of P.routeHints(stops(), T.criteria, null).filter(h => h.action?.type === "chain")) out.push({ icon: "📅", tone: "warn", tab: "route", html: esc(h.text) });
  return out.slice(0, 9);
}

// Während der Reise: was heute ansteht
function todayCard() {
  const t = todayIso();
  const s = stops().find(x => x.from <= t && t < x.to) || stops().find(x => x.to === t && x === stops().at(-1));
  if (!s) return "";
  const plan = planFor(s), d = plan.days.find(x => x.date === t);
  if (!d) return "";
  const pts = [d.startPt, ...d.items, d.endPt];
  return `<section class="card today"><h2>Heute in ${esc(s.name)}</h2>
    ${d.items.length ? `<ol class="todaylist">${d.steps.filter(x => x.type === "besuch").map(x => `<li><span class="time">${P.hhmm(x.start)}</span> <a href="${mapsPlace(x.w)}" target="_blank" rel="noopener">${esc(x.w.name)}</a></li>`).join("")}</ol>
    <a class="btn wide" href="${esc(mapsRoute(pts))}" target="_blank" rel="noopener">Ganze Tagesroute in Google Maps</a>` : `<p class="small">Heute ist nichts geplant – genieß den freien Tag.</p>`}
  </section>`;
}


/* ---------- Einrichtung ---------- */
function viewSetup() {
  const next = new Date(); next.setMonth(next.getMonth() + 6);
  const iso = next.toISOString().slice(0, 10);
  return `<section class="setup">
    <div class="logo" aria-hidden="true">🍁</div>
    <h1>Kanada-Reiseplaner</h1>
    <p class="lead">Route planen, Tage einteilen, Flüge und Unterkünfte im Blick – mit Preiswächter und Vorschlägen für schöne Orte.</p>
    <form id="setupForm" class="form">
      <label>Name der Reise<input name="name" value="Kanada ${next.getFullYear()}" maxlength="40" required></label>
      <div class="row2">
        <label>Hinflug<input type="date" name="start" value="${iso}" required></label>
        <label>Rückflug<input type="date" name="end" value="${P.addDays(iso, 21)}" required></label>
      </div>
      <div class="row2">
        <label>Erwachsene<input type="number" name="adults" min="1" max="9" value="2"></label>
        <label>Kinder<input type="number" name="children" min="0" max="9" value="0"></label>
      </div>
      <label>Abflughafen<select name="home">${Object.entries(HOME_AIRPORTS).map(([c, n]) => `<option value="${c}">${n} (${c})</option>`).join("")}</select></label>
      <button class="btn big">Reise anlegen</button>
    </form>
    <div class="divider"><span>oder</span></div>
    <button class="btn ghost wide" data-act="setup-demo">Beispielreise ansehen (Westkanada, 15 Tage)</button>
    ${St.canSync ? `<button class="btn ghost wide" data-act="sync-join">Reisecode von einem anderen Gerät eingeben</button>` : ""}
  </section>`;
}

/* ---------- Route ---------- */
function viewRoute() {
  const list = stops();
  const L = P.legs(list);
  P.prefetch(list);
  const hints = P.routeHints(list, T.criteria, T.start);
  const total = L.filter(l => l.mode === "auto").reduce((t, l) => ({ km: t.km + l.km, min: t.min + l.min }), { km: 0, min: 0 });
  return `
  <div class="split">
    <div class="mapwrap"><div id="routeMap" class="map" role="img" aria-label="Karte der Reiseroute"></div></div>
    <div>
      <div class="sechead"><h2 class="sec">Deine Route</h2>${list.length ? `<span class="small">${Math.round(total.km).toLocaleString("de-DE")} km · ${P.dur(total.min)} Fahrt</span>` : ""}</div>
      ${list.length ? "" : `<div class="card empty"><p>Füge die Orte hinzu, an denen du übernachten willst – mit Datum von/bis.</p></div>`}
      <div class="stops">
        ${list.map((s, i) => `${i ? legRow(L[i - 1]) : ""}${stopCard(s, i)}`).join("")}
      </div>
      <button class="btn wide" data-act="stop-add">+ Ort hinzufügen</button>
      ${list.length ? `<button class="btn ghost wide" data-act="list-import">📋 Liste mit Wünschen hochladen</button>` : ""}
      ${hints.length ? `<h2 class="sec">Verbesserungen</h2>${hintList(hints)}` : ""}
    </div>
  </div>`;
}
function stopCard(s, i) {
  const n = P.daysBetween(s.from, s.to);
  const booked = T.lodgings.find(l => l.stopId === s.id && l.status === "gebucht");
  return `<article class="stop">
    <div class="stopnum">${i + 1}</div>
    <div class="stopbody">
      <h3>${esc(s.name)}</h3>
      <p class="small">${fmtD(s.from)} – ${fmtD(s.to)} · ${n ? plural(n, "Nacht", "Nächte") : "Durchreise"}</p>
      <p class="small">${s.wishes.length ? `📍 ${plural(s.wishes.length, "Wunsch", "Wünsche")}` : "📍 noch keine Wünsche"} · ${booked ? `🏡 ${esc(booked.name)}` : n ? "🛏️ Unterkunft fehlt" : ""}</p>
      <div class="btnrow">
        <button class="btn small" data-act="tage-stop" data-id="${s.id}">Tage planen</button>
        <button class="btn small ghost" data-act="stop-edit" data-id="${s.id}">Bearbeiten</button>
        <button class="iconbtn sm" data-act="stop-move" data-id="${s.id}" data-dir="-1" aria-label="nach oben" ${i === 0 ? "disabled" : ""}>↑</button>
        <button class="iconbtn sm" data-act="stop-move" data-id="${s.id}" data-dir="1" aria-label="nach unten" ${i === stops().length - 1 ? "disabled" : ""}>↓</button>
      </div>
    </div>
  </article>`;
}
function legRow(l) {
  const time = l.mode === "auto" ? `${l.real ? "" : "≈ "}${Math.round(l.km)} km · ${P.dur(l.min)}` : l.mode === "flug" ? `Flug, ca. ${Math.round(l.km)} km Luftlinie` : P.MODES[l.mode];
  return `<div class="leg ${l.min > 300 && l.mode === "auto" ? "long" : ""}">
    <select data-change="leg-mode" data-id="${l.b.id}" aria-label="Wie reist du nach ${esc(l.b.name)}?">
      ${Object.entries(P.MODES).map(([k, v]) => `<option value="${k}" ${k === l.mode ? "selected" : ""}>${v}</option>`).join("")}
    </select>
    <span>${time}</span>
    ${l.mode === "auto" ? `<a href="${esc(mapsRoute([l.a, l.b]))}" target="_blank" rel="noopener" class="small">Karte ↗</a>` : ""}
  </div>`;
}
function hintList(hints) {
  return `<ul class="hints">${hints.map((h, i) => `<li class="hint ${h.kind}"><span class="ai">${h.icon}</span><span>${esc(h.text)}</span>${h.action ? `<button class="btn small" data-act="hint" data-h="${esc(JSON.stringify(h.action))}">${hintLabel(h.action)}</button>` : ""}</li>`).join("")}</ul>`;
}
function hintLabel(a) {
  return { nights: `+${a.n} ${a.n === 1 ? "Nacht" : "Nächte"}`, move: "Verschieben", mode: "Flug wählen", along: "Unterwegs einplanen", order: "Übernehmen", chain: "Daten anpassen", insert: "Einfügen" }[a.type] || "OK";
}

/* ---------- Tagesplan ---------- */
let lastPlan = null;
function viewTage() {
  const list = stops();
  if (!list.length) return `<div class="card empty"><p>Lege zuerst in der Route fest, wann du wo bist.</p><button class="btn" data-act="stop-add">+ Ort hinzufügen</button></div>`;
  let s = stopById(UI.stop) || list[0];
  UI.stop = s.id;
  const plan = lastPlan = planFor(s);
  const planned = new Set(s.wishes.map(w => w.sid).filter(Boolean));
  const allPlanned = new Set(list.flatMap(x => x.wishes.map(w => w.sid).filter(Boolean)));
  const sugAll = P.suggestNear(homeOf(s), T.criteria, allPlanned, { maxMin: 110, limit: 24, from: s.from, to: s.to });
  const sug = sugAll.slice(0, UI.sugMore ? 24 : 8);
  P.prefetch([homeOf(s), ...sug.map(r => r.x)]);
  const autoCount = s.wishes.filter(w => w.auto).length;
  const dayOpts = plan.days.map((d, i) => `<option value="${d.date}">Tag ${i + 1} (${fmtShort(d.date)})</option>`).join("");

  return `
  <div class="stopchips" role="tablist">${list.map((x, i) => `<button role="tab" aria-selected="${x === s}" data-act="tage-stop" data-id="${x.id}">${i + 1}. ${esc(x.name)}</button>`).join("")}</div>
  <section class="card">
    <div class="sechead"><h2>${esc(s.name)}</h2><button class="linkbtn" data-act="stop-edit" data-id="${s.id}">Daten ändern</button></div>
    <p class="small">${fmtD(s.from)} – ${fmtD(s.to)} · ${plan.nights ? plural(plan.nights, "Nacht", "Nächte") : "Durchreise"}</p>
    ${plan.wishes.length ? `<p class="small">Kosten laut Plan: ${costLine(costSum(plan.days.flatMap(d => d.items))) || "–"}</p>` : ""}
    <div class="pace">
      <label>Tempo<select data-change="pace">${Object.entries(P.PACE).map(([k, v]) => `<option value="${k}" ${k === T.pace ? "selected" : ""}>${v.label}</option>`).join("")}</select></label>
      <label>Standard: los um<input type="time" data-change="dayStart" value="${T.dayStart}"></label>
      <label>zurück bis<input type="time" data-change="dayEnd" value="${T.dayEnd}"></label>
    </div>
  </section>

  <h2 class="sec">Das möchte ich sehen/machen</h2>
  ${wishesByDay(s, plan, dayOpts)}
  ${autoCount ? `<button class="btn small ghost danger" data-act="wish-auto-del">🗑 ${plural(autoCount, "automatisch vorgemerkten Vorschlag", "automatisch vorgemerkte Vorschläge")} entfernen</button>` : ""}
  <button class="btn wide" data-act="wish-add">+ Sehenswürdigkeit oder eigenen Ort hinzufügen</button>
  <button class="btn ghost wide" data-act="list-import">📋 Ganze Liste hochladen und automatisch zuordnen</button>

  ${plan.hints.length ? `<h2 class="sec">Tipps & Verbesserungen</h2>${hintList(plan.hints)}` : ""}

  <h2 class="sec">Dein Plan</h2>
  <div class="split">
    <div class="mapwrap"><div id="dayMap" class="map" role="img" aria-label="Karte der Tagesrouten"></div></div>
    <div class="days">${plan.days.map((d, i) => dayCard(s, d, i)).join("")}</div>
  </div>
  ${plan.unplaced.length ? `<div class="card warnbox"><strong>Passt nicht mehr rein:</strong> ${plan.unplaced.map(w => esc(w.name)).join(", ")}</div>` : ""}

  <h2 class="sec">Empfehlungen in der Nähe</h2>
  <p class="small">Wonach suchst du? Die Empfehlungen richten sich danach.</p>
  <div class="chips">${Object.entries(TAGS).map(([k, t]) => `<button class="chip" aria-pressed="${T.criteria.includes(k)}" data-act="crit" data-tag="${k}">${t.icon} ${t.label}</button>`).join("")}</div>
  <div class="sugs">${sug.map(r => sugCard(r, plan)).join("") || `<p class="small">Hier in der Nähe kennt die App nichts Passendes mehr. Probier andere Vorlieben.</p>`}</div>
  ${sugAll.length > sug.length ? `<button class="btn ghost wide" data-act="sug-more">Weitere ${sugAll.length - sug.length} Empfehlungen zeigen</button>` : ""}`;
}
/* ---------- Restaurants unterwegs (OpenStreetMap über Overpass) ---------- */
const CUISINE = { italian: "Italienisch", pizza: "Pizza", burger: "Burger", american: "Amerikanisch", canadian: "Kanadisch", regional: "Regional",
  seafood: "Fisch & Meeresfrüchte", fish_and_chips: "Fish & Chips", steak_house: "Steakhaus", sushi: "Sushi", japanese: "Japanisch",
  chinese: "Chinesisch", indian: "Indisch", mexican: "Mexikanisch", thai: "Thai", french: "Französisch", greek: "Griechisch",
  vietnamese: "Vietnamesisch", korean: "Koreanisch", coffee_shop: "Café", breakfast: "Frühstück", vegan: "Vegan", vegetarian: "Vegetarisch",
  sandwich: "Sandwiches", bakery: "Bäckerei", crepe: "Crêpes", poutine: "Poutine", diner: "Diner", pub: "Pub", bbq: "Barbecue" };
const restMem = new Map();
async function restaurantsNear(p, radius = 2500) {
  const key = `${p.lat.toFixed(3)},${p.lng.toFixed(3)},${radius}`;
  if (restMem.has(key)) return restMem.get(key);
  // Schon einmal gesucht? Dann aus dem Gerätespeicher (geht auch offline in den Bergen)
  const saved = JSON.parse(ls.get("ka.rest") || "{}");
  if (saved[key] && Date.now() - saved[key].at < 60 * 864e5) {
    const hit = Promise.resolve(saved[key].list.map(r => ({ ...r, d: P.km(p, r) })));
    restMem.set(key, hit);
    return hit;
  }
  const q = `[out:json][timeout:20];nwr["amenity"~"^(restaurant|cafe|pub)$"]["name"](around:${radius},${p.lat},${p.lng});out center tags 80;`;
  // Der Hauptserver ist oft überlastet, dann die öffentlichen Spiegel versuchen
  const servers = ["https://overpass-api.de", "https://overpass.kumi.systems", "https://overpass.private.coffee"];
  const ask = async () => {
    for (const s of servers) {
      try {
        const r = await fetch(`${s}/api/interpreter?data=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(12000) });
        if (r.ok) return await r.json();
      } catch {}
    }
    throw new Error("kein Overpass-Server erreichbar");
  };
  const job = ask()
    .then(j => j.elements.map(e => {
      const t = e.tags || {}, lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
      const d = P.km(p, { lat, lng });
      // Ohne Bewertungen: gepflegte Einträge (Küche, Webseite, Öffnungszeiten) sind meist etablierte Lokale
      const sc = (t.cuisine ? 1 : 0) + (t.website || t["contact:website"] ? 1 : 0) + (t.opening_hours ? 0.7 : 0) + (t.amenity === "restaurant" ? 0.5 : 0) - d / 1.5;
      return { name: t.name, lat, lng, d, sc, amenity: t.amenity, web: safeUrl(t.website || t["contact:website"]),
        cuisine: (t.cuisine || "").split(";").map(c => CUISINE[c.trim()] || "").filter(Boolean).slice(0, 2).join(", ") };
    }).filter(r => r.lat != null && !/tim hortons|mcdonald|subway|a&w|starbucks|wendy|burger king|dairy queen|kfc|domino/i.test(r.name))
      .sort((a, b) => b.sc - a.sc).slice(0, 6))
    .then(list => {
      const all = JSON.parse(ls.get("ka.rest") || "{}");
      all[key] = { at: Date.now(), list: list.map(({ d, sc, ...r }) => r) };
      // Höchstens 80 Orte merken, die ältesten fliegen raus
      const keep = Object.entries(all).sort((x, y) => y[1].at - x[1].at).slice(0, 80);
      ls.set("ka.rest", JSON.stringify(Object.fromEntries(keep)));
      return list;
    });
  restMem.set(key, job);
  job.catch(() => restMem.delete(key));
  return job;
}
async function showRestaurants(btn) {
  const box = btn.nextElementSibling, p = { lat: +btn.dataset.lat, lng: +btn.dataset.lng };
  box.innerHTML = `<p class="small">Suche Restaurants …</p>`;
  try {
    const list = await restaurantsNear(p);
    box.innerHTML = list.length ? `<ul class="rests">${list.map(r => `<li>
      <div><strong>${esc(r.name)}</strong><span class="small block">${r.amenity === "cafe" ? "☕ Café" : r.amenity === "pub" ? "🍺 Pub" : "🍽️ Restaurant"}${r.cuisine ? ` · ${esc(r.cuisine)}` : ""} · ${r.d < 1 ? Math.round(r.d * 1000) + " m" : r.d.toFixed(1).replace(".", ",") + " km"}</span>
        <span class="small block"><a href="https://www.google.com/maps/search/${encodeURIComponent(r.name)}/@${r.lat},${r.lng},17z" target="_blank" rel="noopener">⭐ Bewertungen ↗</a>${r.web ? ` · <a href="${esc(r.web)}" target="_blank" rel="noopener noreferrer">Webseite ↗</a>` : ""}</span></div>
      <button class="btn small ghost" data-act="rest-add" data-r="${esc(JSON.stringify({ name: r.name, lat: r.lat, lng: r.lng }))}" data-date="${btn.dataset.date}">+ Einplanen</button></li>`).join("")}</ul>`
      : `<p class="small">In der Nähe kennt OpenStreetMap kein Restaurant – unterwegs ist Picknick angesagt.</p>`;
  } catch { box.innerHTML = `<p class="small warntext">Die freie Restaurant-Datenbank (OpenStreetMap) ist gerade überlastet oder du bist offline. Probier es gleich nochmal – oder nimm den Google-Maps-Link darunter.</p>`; }
}

/* ---------- Kosten ---------- */
const costChip = c => { const l = costLabel(c); return l ? `<span class="cost ${c === 0 ? "free" : ""}">${l}</span>` : ""; };
// Was kostet eine Liste von Punkten: Eintritte (bekannte Beträge), Pässe, offene Preise
function costSum(items) {
  items = items.filter(w => !w.meal); // Essen ist kein Eintritt
  const r = { cad: 0, park: false, passes: new Set(), open: 0, free: 0, unknown: 0, n: items.length };
  for (const w of items) {
    if (typeof w.c === "number" && w.c > 0) r.cad += w.c;
    else if (w.c === 0) r.free++;
    else if (w.c === -1) r.open++;
    else if (w.c === "park") r.park = true;
    else if (w.c) r.passes.add(w.c);
    else r.unknown++;
  }
  return r;
}
function costLine(r, perPerson = true) {
  if (!r.n) return "";
  const parts = [];
  if (r.cad) parts.push(`💲 ca. ${r.cad} CAD ${perPerson ? "p. P." : ""} Eintritt (≈ ${money(r.cad * rate() * (pax().adults + pax().children))} für alle)`);
  if (r.park) parts.push("🎫 Nationalpark-Pass nötig");
  for (const p of r.passes) parts.push("🎫 " + COST_LABEL[p]);
  if (r.open) parts.push(`${r.open}× Preis vor Ort`);
  if (!parts.length && r.free === r.n) return "🆓 alles kostenlos";
  if (r.free) parts.push(`🆓 ${r.free}× kostenlos`);
  if (r.unknown) parts.push(`${r.unknown}× Preis unbekannt`);
  return parts.join(" · ");
}

// Wünsche so ordnen wie im Plan: nach Tag, innerhalb des Tages nach Uhrzeit; was nicht reinpasst, ans Ende
function wishesByDay(s, plan, dayOpts) {
  if (!s.wishes.length) return `<ul class="wishes"><li class="small pad">Noch nichts ausgewählt. Füge Orte hinzu – oder schau unten in die Empfehlungen.</li></ul>`;
  const slot = new Map();
  plan.days.forEach((d, i) => d.steps.forEach(x => { if (x.type === "besuch") slot.set(x.w.wid, { day: i, start: x.start }); }));
  const groups = plan.days.map((d, i) => ({ title: `Tag ${i + 1} · ${fmtD(d.date)}`, color: dayColor(i), list: [] }));
  const rest = [];
  for (const w of s.wishes) {
    const at = slot.get(w.id);
    if (at) groups[at.day].list.push({ w, start: at.start }); else rest.push(w);
  }
  return groups.filter(g => g.list.length).map(g => `
    <h3 class="daygroup" style="--c:${g.color}">${esc(g.title)}</h3>
    <ul class="wishes">${g.list.sort((a, b) => a.start - b.start).map(x => wishRow(s, x.w, dayOpts, x.start)).join("")}</ul>`).join("")
    + (rest.length ? `<h3 class="daygroup rest">Passt nicht mehr rein</h3><ul class="wishes">${rest.map(w => wishRow(s, w, dayOpts)).join("")}</ul>` : "");
}

function wishRow(s, w, dayOpts, start) {
  const p = P.wishPoint(w);
  if (!p) return "";
  const home = homeOf(s), tr = P.travel(home, p);
  const base = w.sid ? P.sight(w.sid) : null;
  return `<li class="wish">
    <div class="thumb" data-photo="${esc(p.name)}" data-lat="${p.lat}" data-lng="${p.lng}" aria-hidden="true"></div>
    <div class="wishmain"><strong>${start != null ? `<span class="wtime">${P.hhmm(start)}</span> ` : ""}${esc(p.name)}</strong>
      <span class="small">${p.res ? "🎟️ " : ""}${p.when === "früh" ? "🌅 " : p.when === "abends" ? "🌇 " : ""}${tr.real ? "" : "≈ "}${P.dur(tr.min)} von ${esc(home.lodging || "der Unterkunft")}
        · <a href="${esc(mapsRoute([home, p]))}" target="_blank" rel="noopener">Strecke in Google Maps ↗</a>${w.sid ? "" : ` · <a href="${mapsPlace(p)}" target="_blank" rel="noopener">📍 ${esc(p.place || "Ort ansehen")}</a>`}</span>
      <span class="small costedit">${costChip(p.c)}${p.cOwn ? ` <span class="tag">eigener Preis</span>` : p.cn ? ` ${esc(p.cn)}` : ""}
        <label class="inline">✎ <input class="mini" inputmode="decimal" data-change="wish-cost" data-id="${w.id}" value="${w.c == null ? "" : w.c === 0 ? "0" : numIn(w.c)}" placeholder="${base && typeof base.c === "number" && base.c > 0 ? base.c : "?"}" aria-label="Eintritt in CAD pro Person"> CAD p. P.</label>
        ${p.cOwn ? `<button class="linkbtn" data-act="wish-cost-reset" data-id="${w.id}" title="Zurück zum hinterlegten Preis">↺</button>` : ""}</span></div>
    <div class="wishctl">
      <div class="seg" role="group" aria-label="Wie wichtig?">
        ${[[2, "Muss"], [1, "Gern"], [0, "Optional"]].map(([v, l]) => `<button aria-pressed="${p.prio === v}" data-act="wish-prio" data-id="${w.id}" data-v="${v}">${l}</button>`).join("")}
      </div>
      <select data-change="wish-dur" data-id="${w.id}" aria-label="Dauer vor Ort">
        ${[0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8].concat([p.dur]).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b).map(v => `<option value="${v}" ${v === p.dur ? "selected" : ""}>${v < 1 ? v * 60 + " min" : String(v).replace(".", ",") + " h"}</option>`).join("")}
      </select>
      <select data-change="wish-day" data-id="${w.id}" aria-label="An welchem Tag?"><option value="">Tag: automatisch</option>${dayOpts.replace(`value="${w.day}"`, `value="${w.day}" selected`)}</select>
      <label class="inline small attime">um <input type="time" data-change="wish-at" data-id="${w.id}" value="${esc(w.at || "")}" aria-label="Feste Uhrzeit (optional)"></label>
      <button class="iconbtn sm" data-act="wish-del" data-id="${w.id}" aria-label="${esc(p.name)} entfernen">✕</button>
    </div>
  </li>`;
}
function dayCard(s, d, i) {
  const label = { reise: "Reisetag", ankunft: "Ankunft", abreise: "Abreise" }[d.kind] || "";
  const pts = [d.startPt, ...d.items, d.endPt];
  const rows = [];
  rows.push(`<li class="st start"><span class="time">${P.hhmm(d.start)}</span><span>${d.kind === "reise" ? `Abfahrt in ${esc(d.startPt.name)}` : d.kind === "ankunft" ? "Ankunft" : "Los geht's"}</span></li>`);
  for (const x of d.steps) {
    if (x.type === "fahrt") rows.push(`<li class="st drive"><span class="time"></span><span>🚗 ${x.real ? "" : "≈ "}${P.dur(x.min)} · ${Math.round(x.km)} km</span></li>`);
    if (x.type === "zeit") rows.push(`<li class="st drive tz"><span class="time"></span><span>🕐 Uhr ${x.shift > 0 ? "vorstellen" : "zurückstellen"}: ${x.shift > 0 ? "+" : "−"}${Math.abs(x.shift) / 60} h – jetzt ${TZ_LABEL[x.tz] || ""}</span></li>`);
    if (x.type === "warten") rows.push(`<li class="st drive"><span class="time"></span><span>☕ ${P.dur(x.min)} Zeit bis zum festen Termin</span></li>`);
    if (x.type === "besuch") rows.push(`<li class="st visit"><span class="time">${P.hhmm(x.start)}</span><span><a href="${mapsPlace(x.w)}" target="_blank" rel="noopener"><strong>${esc(x.w.name)}</strong></a>${x.w.fixDay ? ` <span title="Fest auf diesen Tag gelegt">📌</span>` : ""}${x.w.at ? ` <span class="tag">um ${esc(x.w.at)}</span>` : ""}
      <span class="small">bis ${P.hhmm(x.start + x.min)}${costLabel(x.w.c) ? " · " + costLabel(x.w.c) : ""}${x.w.res ? " · 🎟️ reservieren" : ""}${x.w.tip ? ` · ${esc(x.w.tip)}` : ""}</span></span></li>`);
  }
  const cost = costLine(costSum(d.items));
  rows.push(`<li class="st end"><span class="time">${P.hhmm(d.finish)}</span><span>🏡 ${d.kind === "abreise" && !d.items.length ? "Abreise" : "Zurück in der Unterkunft"}${d.free >= 30 ? ` · noch ${P.dur(d.free)} frei` : ""}</span></li>`);
  return `<article class="day" style="--c:${dayColor(i)}">
    <header><h3>Tag ${i + 1} · ${fmtD(d.date)}</h3>${label ? `<span class="tag">${label}</span>` : ""}</header>
    ${d.kind === "abreise" ? "" : `<div class="daytimes small">
      <label>Los <input type="time" data-change="day-start" data-date="${d.date}" value="${esc(T.dayTimes?.[d.date]?.start || "")}" placeholder="${T.dayStart}" aria-label="Startzeit an diesem Tag"></label>
      <label>zurück bis <input type="time" data-change="day-end" data-date="${d.date}" value="${esc(T.dayTimes?.[d.date]?.end || "")}" placeholder="${T.dayEnd}" aria-label="Ende an diesem Tag"></label>
      ${d.ownStart || d.ownEnd ? `<button class="linkbtn" data-act="day-times-reset" data-date="${d.date}">↺ Standard</button>` : `<span class="muted">leer = ${T.dayStart}–${T.dayEnd}</span>`}
    </div>`}
    ${(() => { const out = d.steps.filter(x => x.type === "besuch" && x.w.tags?.some(t => ["wandern", "natur", "aussicht", "wasser"].includes(t))).at(-1); return `<p class="wx small" data-wx="${d.date}"${out ? ` data-out="${Math.round(out.start + out.min)}" data-outname="${esc(out.w.name)}"` : ""}></p>`; })()}
    ${cost ? `<p class="small costline">${cost}</p>` : ""}
    ${d.items.length || d.kind === "reise" ? `<ol class="timeline">${rows.join("")}</ol>
      <a class="small" href="${esc(mapsRoute(pts))}" target="_blank" rel="noopener">Route in Google Maps ↗</a>` : `<p class="small">${d.kind === "abreise" ? "Abreisetag." : "Noch frei – Zeit zum Treibenlassen oder für einen Vorschlag unten."}</p>`}
    ${restBlock(d)}
  </article>`;
}
// Wo isst man an diesem Tag: mittags am Programmpunkt rund um die Mittagszeit, abends bei der Unterkunft
function restBlock(d) {
  const spots = [];
  const visits = d.steps.filter(x => x.type === "besuch" && !x.w.meal);

  // Mittags: der Programmpunkt, bei dem man um die Mittagszeit ist
  const lunchAt = visits.find(x => x.start + x.min >= 11.5 * 60) || visits.at(-1);
  if (lunchAt && !d.items.some(w => w.meal)) spots.push({ label: `Mittags bei ${lunchAt.w.name}`, p: lunchAt.w });
  if (d.kind !== "abreise") spots.push({ label: `Abends bei der Unterkunft`, p: d.endPt });
  if (!spots.length) return "";
  return `<details class="restwrap"><summary class="small">🍽️ Restaurants für diesen Tag</summary>
    ${spots.map(s => `<div class="restspot"><button class="btn small ghost" data-act="rest" data-lat="${s.p.lat}" data-lng="${s.p.lng}" data-date="${d.date}">${esc(s.label)} suchen</button><div></div>
      <a class="small" href="https://www.google.com/maps/search/restaurants/@${s.p.lat},${s.p.lng},15z" target="_blank" rel="noopener">oder bei Google Maps mit Bewertungen ↗</a></div>`).join("")}
    <p class="small">Aus OpenStreetMap, ohne Ketten. Bewertungen findest du über „⭐ Bewertungen“ bei Google Maps.</p>
  </details>`;
}
function sugCard(r, plan) {
  const x = r.x, need = x.dur * 60 * plan.pace.buf + 2 * r.t;
  const fit = plan.days.findIndex(d => d.free >= need && d.kind !== "abreise");
  return `<article class="sug photo">
    <div class="ph" data-photo="${esc(x.name)}" data-lat="${x.lat}" data-lng="${x.lng}"></div>
    <div class="sugbody">
      <strong>${esc(x.name)}</strong>
      <p class="small" data-wikitext></p>
      <ul class="facts small">
        <li>🚗 ${r.real ? "" : "≈ "}${P.dur(r.t)} von der Unterkunft</li>
        <li>⏱ ${String(x.dur).replace(".", ",")} h vor Ort${fit >= 0 ? ` · <span class="goodtext">passt an Tag ${fit + 1}</span>` : ""}</li>
        <li>${costChip(x.c)}${x.cn ? ` <span class="small">${esc(x.cn)}</span>` : ""}</li>
        ${x.close ? `<li>🔒 schließt meist gegen ${x.close}</li>` : ""}
        ${x.r ? `<li>🎟️ ${esc(x.r)}</li>` : ""}
        ${r.offSeason ? `<li class="warntext">📅 nicht die beste Jahreszeit</li>` : ""}
      </ul>
      <p class="small">${P.matchLabels(x, T.criteria).join(" · ")}</p>
      ${x.t ? `<p class="small tip">💡 ${esc(x.t)}</p>` : ""}
      <div class="btnrow"><button class="btn small" data-act="sug-add" data-sid="${x.id}">+ Dazu</button>
        <a class="small" href="${mapsPlace(x)}" target="_blank" rel="noopener">Karte ↗</a></div>
    </div>
  </article>`;
}
const DAY_COLORS = ["#c0392b", "#1f6f8b", "#7a8b1f", "#8e44ad", "#d35400", "#16a085", "#2c3e50", "#b7950b"];
const dayColor = i => DAY_COLORS[i % DAY_COLORS.length];

/* ---------- Flüge ---------- */
// Flugplanung: Wohnort, Abflughafen, Zug zum Flughafen, Ziel- und Rückflughafen (Gabelflug)
function flyPlan() {
  const list = stops();
  const f = T.fly ||= {};
  const inAp = f.inAp || (list.length ? P.nearestAirport(homeOf(list[0])).code : "YVR");
  const outAp = f.gabel === false ? inAp : f.outAp || (list.length ? P.nearestAirport(homeOf(list.at(-1))).code : inAp);
  // Mehrere Abflughäfen zum Vergleichen; der erste ist der Hauptflughafen
  const aps = (f.aps?.length ? f.aps : [T.home || "FRA"]).filter(c => HOME_AIRPORTS[c] || /^[A-Z]{3}$/.test(c));
  return { place: f.place || null, aps, ap: aps[0] || "FRA", station: f.station || "", rail: f.rail !== false, gabel: inAp !== outAp, inAp, outAp };
}
// Zug ab Bahnhof im Flugticket? Lufthansa Express Rail fährt zu den Drehkreuzen Frankfurt und München.
function railIncluded(al, ap) {
  return ["incl", "partner"].includes(al.railMode) && ["FRA", "MUC"].includes(ap);
}
// Fliegt die Airline diese Strecke – direkt, mit Umstieg oder gar nicht?
function airlineFit(al, from, to) {
  if (!al.to.includes(to)) return null;
  if (al.from.includes(from)) return { direct: true, text: `${from} → ${to} direkt` };
  if (al.hubs?.includes(from)) return { direct: false, text: `${from} → ${to} mit Umstieg in ${al.via}` };
  // Lufthansa-Gruppe bringt einen mit Zubringerflug nach Frankfurt/München
  if (["lh", "4y", "ac"].includes(al.id) && HOME_AP_POS[from] && from !== "ZRH" && from !== "AMS") return { direct: false, text: `${from} → ${to} mit Umstieg in ${al.from[0]}` };
  return null;
}
const trainTime = km => km * 1.3 / 95 * 60 + 25;

function viewFlights() {
  const [a, b] = range();
  const fp = flyPlan();
  const people = pax().adults + pax().children;
  const paxText = `${plural(pax().adults, "Erwachsener", "Erwachsene")}${pax().children ? `, ${plural(pax().children, "Kind", "Kinder")}` : ""}`;
  // Buchungsdaten für eine Airline ab einem Flughafen (mit Bahnhof, wenn der Zug im Ticket enthalten ist)
  const bookText = (ap, withRail) => {
    const from = withRail ? `${fp.station} (Zug) → ${ap}` : ap;
    const back = withRail ? `${ap} → ${fp.station} (Zug)` : ap;
    return (fp.gabel ? `Gabelflug ${from} → ${fp.inAp} am ${fmtShort(a)}, zurück ${fp.outAp} → ${back} am ${fmtShort(b)}`
      : `${from} → ${fp.inAp} am ${fmtShort(a)}, zurück ${fp.inAp} → ${back} am ${fmtShort(b)}`) + `, ${paxText}`;
  };
  // Abflughäfen nach Entfernung vom Wohnort
  const aps = fp.place ? Object.entries(HOME_AP_POS).map(([code, [lat, lng]]) => {
    const km = P.km(fp.place, { lat, lng }) * 1.25;
    const direct = AIRLINES.filter(al => airlineFit(al, code, fp.inAp)?.direct).length;
    return { code, km, train: trainTime(km), direct };
  }).sort((x, y) => x.km - y.km) : [];
  // Pro Airline: welche der gewählten Abflughäfen passen? Direkte Verbindungen zuerst.
  const fits = AIRLINES.map(al => {
    const opts = fp.aps.map(ap => ({ ap, hin: airlineFit(al, ap, fp.inAp), rueck: airlineFit(al, ap, fp.outAp) }))
      .filter(o => o.hin && o.rueck)
      .map(o => ({ ...o, score: o.hin.direct + o.rueck.direct, rail: !!fp.station && fp.rail && railIncluded(al, o.ap) }))
      .sort((x, y) => (y.score - x.score) || (y.rail - x.rail));
    return { al, opts };
  }).filter(x => x.opts.length).sort((x, y) => (y.opts[0].score - x.opts[0].score) || (y.opts[0].rail - x.opts[0].rail));
  const caOpts = sel => Object.entries(AIRPORTS).map(([c, x]) => `<option value="${c}" ${c === sel ? "selected" : ""}>${x.name} (${c})</option>`).join("");

  return `
  <div class="seg tabs2" role="tablist">
    <button role="tab" aria-pressed="${UI.sub !== "auto"}" data-act="sub" data-v="flug">✈️ Flüge</button>
    <button role="tab" aria-pressed="${UI.sub === "auto"}" data-act="sub" data-v="auto">🚗 Mietwagen</button>
  </div>
  ${UI.sub === "auto" ? viewCar() : `
  <section class="card">
    <h2>Deine Anreise</h2>
    <form class="form" data-form="fly-place">
      <label>Von wo fährst du los? (Wohnort)<input name="q" value="${esc(fp.place?.name || "")}" placeholder="z. B. Köln, Kassel, Freiburg" autocomplete="address-level2"></label>
      <button class="btn small ghost">📍 Übernehmen</button>
    </form>
    <p class="small"><strong>Abflughäfen</strong> – tippe alle an, die für dich in Frage kommen${fp.place ? ` (sortiert nach Entfernung von ${esc(fp.place.name)})` : ""}:</p>
    <div class="aplist">${(aps.length ? aps : Object.keys(HOME_AIRPORTS).map(code => ({ code }))).map(x => {
      const on = fp.aps.includes(x.code);
      return `<button class="placebtn ${on ? "on" : ""}" data-act="fly-ap" data-v="${x.code}" aria-pressed="${on}">
        <strong>${on ? "✓ " : "+ "}${esc(HOME_AIRPORTS[x.code] || x.code)} (${x.code})</strong>
        ${x.km != null ? `<span class="small">≈ ${Math.round(x.km)} km · mit dem Zug ca. ${P.dur(x.train)} · ${x.direct ? `${plural(x.direct, "Airline", "Airlines")} direkt nach ${AIRPORTS[fp.inAp].name}` : "kein Direktflug, mit Umstieg"}</span>` : ""}</button>`;
    }).join("")}</div>
    <label class="check"><input type="checkbox" data-change="fly-rail" ${fp.rail ? "checked" : ""}><span>Mit dem Zug zum Flughafen</span></label>
    ${fp.rail ? `<label>Abfahrtsbahnhof <span class="small">(für Zug im Flugticket)</span><input data-change="fly-station" value="${esc(fp.station)}" maxlength="40" placeholder="z. B. Essen Hbf"></label>
      <p class="small">🚆 ${fp.station
        ? `Ab <strong>${esc(fp.station)}</strong>: Bei Lufthansa (und Lufthansa-Partnern) ab Frankfurt oder München kann die Zugfahrt als <strong>Lufthansa Express Rail</strong> Teil des Flugtickets sein – dann ist sie im Flugpreis enthalten und dein Anschluss bei Zugverspätung abgesichert. Condor bietet <strong>Rail&Fly</strong> meist gegen Aufpreis an. Bei den anderen kaufst du das Zugticket extra.`
        : "Trag deinen Bahnhof ein – dann zeigt die App, bei welcher Airline der Zug im Flugpreis enthalten ist."}
        Plane mindestens 3 Stunden vor Abflug am Flughafen ein. <a href="https://www.bahn.de/" target="_blank" rel="noopener">Fahrplan bei bahn.de ↗</a></p>` : ""}
    <div class="row2">
      <label>Hinflug nach<select data-change="fly-in">${caOpts(fp.inAp)}</select></label>
      <label>Rückflug ab<select data-change="fly-out" ${fp.gabel ? "" : "disabled"}>${caOpts(fp.outAp)}</select></label>
    </div>
    <label class="check"><input type="checkbox" data-change="fly-gabel" ${fp.gabel ? "checked" : ""}><span><strong>Gabelflug</strong> – an einem Ort ankommen, von einem anderen zurückfliegen</span></label>
    ${fp.gabel ? `<p class="small">Passt zu deiner Route: Ankunft in ${AIRPORTS[fp.inAp].name} (erster Ort), Rückflug ab ${AIRPORTS[fp.outAp].name} (letzter Ort). Das spart die Rückfahrt quer durchs Land.</p>` : ""}
    <p class="small">${a ? `${fmtD(a)} – ${fmtD(b)} · ${plural(people, "Person", "Personen")}` : "Lege zuerst die Reisedaten fest."}</p>
  </section>

  <h2 class="sec">Direkt bei der Fluggesellschaft buchen</h2>
  <p class="small pad">${fp.gabel ? `Gabelflug nach ${AIRPORTS[fp.inAp].name}, zurück ab ${AIRPORTS[fp.outAp].name}` : `Nach ${AIRPORTS[fp.inAp].name} und zurück`} · ab ${fp.aps.join(", ")} · ${esc(paxText)}.
    Die Airlines lassen sich nicht vorausfüllen – tippe auf „Daten kopieren“ und füge sie dort ein. Flugpläne sind saisonal, bitte auf der Airline-Seite prüfen.</p>
  ${fits.map(({ al, opts }) => {
    const best = opts[0];
    return `<article class="card airline">
    <div class="sechead"><h3>${esc(al.name)}</h3><span>${best.score === 2 ? `<span class="tag good">Direkt</span>` : `<span class="tag">mit Umstieg</span>`}${best.rail ? ` <span class="tag good">🚆 Zug inklusive</span>` : ""}</span></div>
    <ul class="plain small apfits">${opts.map(o => `<li>✈️ <strong>${o.ap}</strong>: hin ${o.hin.direct ? "direkt" : esc(o.hin.text.replace(/^.*mit /, "mit "))} · zurück ${o.rueck.direct ? "direkt" : esc(o.rueck.text.replace(/^.*mit /, "mit "))}${o.rail ? ` · 🚆 ab ${esc(fp.station)} im Preis` : ""}</li>`).join("")}</ul>
    ${fp.gabel ? `<p class="small">🔀 Gabelflug: ${esc(al.gabel)}</p>` : ""}
    ${fp.rail ? `<p class="small">🚆 ${esc(al.rail)}</p>` : ""}
    <div class="btnrow">
      <a class="btn small" href="${esc(al.url)}" target="_blank" rel="noopener noreferrer">Zu ${esc(al.name)} ↗</a>
      ${opts.map(o => `<button class="btn small ghost" data-act="copy" data-text="${esc(bookText(o.ap, o.rail))}">📋 Daten ab ${o.ap}${o.rail ? " + Zug" : ""}</button>`).join("")}
      <button class="btn small ghost" data-act="flight-watch" data-f="${esc(JSON.stringify({ airline: al.id, from: best.ap, to: fp.inAp, date: a, ret: b, ...(best.rail ? { station: fp.station } : {}), ...(fp.gabel ? { retFrom: fp.outAp, retTo: best.ap } : {}) }))}">🔔 Preis beobachten</button>
    </div>
  </article>`;
  }).join("") || `<p class="small pad">Für diese Kombination kennt die App keine Airline. Wähl weitere Abflughäfen oder einen anderen Zielflughafen.</p>`}

  <section class="card info">
    <h2>Preiswächter</h2>
    <p class="small">Die Airlines geben ihre Preise nicht frei heraus. Trag den Preis ein, den du auf der Airline-Seite siehst – die App merkt sich den Verlauf, erinnert dich alle <select data-change="checkEvery" class="inline">${[1, 2, 3, 5, 7].map(n => `<option value="${n}" ${n === (T.checkEvery || 3) ? "selected" : ""}>${n}</option>`).join("")}</select> Tage ans Nachsehen und meldet sich, sobald dein Zielpreis erreicht ist.</p>
  </section>
  ${T.flights.map(flightCard).join("") || `<p class="small pad">Noch keine Flüge unter Beobachtung.</p>`}
  ${St.canAi ? `<button class="btn wide" data-act="flight-ai">✨ Gebuchten Flug aus Bestätigung auslesen</button>` : ""}
  <button class="btn ghost wide" data-act="flight-watch">+ Anderen Flug beobachten</button>

  <section class="card">
    <h2>Gut zu wissen</h2>
    <ul class="plain small">
      <li>Für Juli/August am besten 4–8 Monate vorher buchen, für Juni/September reicht oft weniger.</li>
      <li>Ein Gabelflug kostet bei den Airlines meist kaum mehr als hin und zurück, spart aber einen ganzen Fahrtag.</li>
      <li>Direkt bei der Airline gebucht, ist Umbuchen und Hilfe bei Verspätung meist einfacher als über Portale.</li>
    </ul>
  </section>`}`;
}

/* ---------- Mietwagen ---------- */
function insCheck(ins = {}, car = {}) {
  const sameplace = norm(car.pickPlace || "") && norm(car.pickPlace || "") === norm(car.dropPlace || "");
  let score = 0; const missing = [];
  for (const x of CAR_INS) {
    const ok = ins[x.id] || (x.id === "oneway" && sameplace) || (x.id === "driver" && pax().adults < 2);
    if (ok) score += x.w; else missing.push(x);
  }
  return { score, missing, label: score >= 90 ? "sehr gut versichert" : score >= 70 ? "gut versichert" : score >= 45 ? "lückenhaft" : "schlecht versichert" };
}
function carDefaults() {
  const fp = flyPlan(), [a, b] = range();
  return {
    pickPlace: `Flughafen ${AIRPORTS[fp.inAp]?.name || ""} (${fp.inAp})`, pickDate: a || "", pickTime: "15:00",
    dropPlace: `Flughafen ${AIRPORTS[fp.outAp]?.name || ""} (${fp.outAp})`, dropDate: b || "", dropTime: "10:00"
  };
}
function viewCar() {
  const c = T.car, tt = tripTotals();
  const d = { ...carDefaults(), ...(c || {}) };
  const info = `Mietwagen ab ${d.pickPlace} am ${fmtShort(d.pickDate)} ${d.pickTime}, Rückgabe ${d.dropPlace} am ${fmtShort(d.dropDate)} ${d.dropTime}${c?.cls ? `, ${c.cls}` : ""}`;
  const oneWay = norm(d.pickPlace) !== norm(d.dropPlace);
  const sites = linkBtns(CAR_SITES.map(s => ({ name: `${s.name} · ${s.kind}`, url: s.url })));
  if (!c) return `
  <section class="card">
    <h2>Mietwagen</h2>
    <p class="small">Passend zu deiner Reise: ${esc(info)}. Ihr fahrt laut Plan ca. <strong>${Math.round(tt.km).toLocaleString("de-DE")} km</strong>${oneWay ? " – Abgabe an einem anderen Ort, also auf die Einweggebühr achten" : ""}.</p>
    <button class="btn small ghost" data-act="copy" data-text="${esc(info)}">📋 Daten kopieren</button>
    <p class="small"><strong>Vergleichen</strong> – deutsche Vermittler haben oft Pakete ohne Selbstbeteiligung und mit hoher Zusatzhaftpflicht:</p>
    ${sites}
    ${St.canAi ? `<button class="btn wide" data-act="car-ai">✨ Buchung automatisch auslesen</button>` : ""}
    <button class="btn wide ${St.canAi ? "ghost" : ""}" data-act="car-edit">+ Mietwagen selbst eintragen</button>
  </section>
  ${insHelp()}`;
  const total = toEur(num(c.total), c.cur), ic = insCheck(c.ins, c);
  const offers = (c.offers || []).map(o => ({ ...o, eur: toEur(num(o.total), o.cur), ic: insCheck(o.ins, c) })).sort((x, y) => x.eur - y.eur);
  const dl = c.cancelUntil ? daysUntil(c.cancelUntil) : null;
  return `
  <section class="card">
    <div class="sechead"><h2>🚗 ${safeUrl(c.url) ? `<a href="${esc(safeUrl(c.url))}" target="_blank" rel="noopener noreferrer">${esc(c.provider || "Mietwagen")} ↗</a>` : esc(c.provider || "Mietwagen")}</h2>
      ${c.status === "gebucht" ? `<span class="tag good">Gebucht</span>` : `<span class="tag">Angebot</span>`}</div>
    <p class="small">${c.via ? `über ${esc(c.via)} · ` : ""}${esc(c.cls || "")}${c.cls ? " · " : ""}${total ? `${money(total)}${c.cur === "CAD" ? ` (${money(num(c.total), "CAD")})` : ""} · ${money(total / Math.max(1, P.daysBetween(d.pickDate, d.dropDate)))}/Tag` : "Preis fehlt"}</p>
    <p class="small">📍 ${esc(d.pickPlace)}, ${fmtD(d.pickDate)} ${esc(d.pickTime)} → ${esc(d.dropPlace)}, ${fmtD(d.dropDate)} ${esc(d.dropTime)}</p>
    ${c.cancelUntil ? `<p class="small ${dl != null && dl >= 0 && dl <= 7 ? "warntext" : ""}">${dl < 0 ? "Kostenlose Stornierung abgelaufen" : `Kostenlos stornierbar bis ${fmtD(c.cancelUntil)} (noch ${plural(dl, "Tag", "Tage")})`}</p>` : ""}
    ${(() => { const ca = Adv.carAdvice(c, total, P.daysBetween(d.pickDate, d.dropDate), todayIso()); return `<div class="advice ${ca.tone}"><p><strong>${ca.tone === "warn" ? "⚠️" : "✅"} ${esc(ca.text)}</strong></p><ul class="plain small">${ca.reasons.map(r => `<li>${esc(r)}</li>`).join("")}${c.status === "gebucht" && c.cancelUntil && ca.checks.length ? `<li>Gute Termine zum Nachvergleichen: ${ca.checks.map(fmtShort).join(" und ")}.</li>` : ""}</ul><p class="small muted">Grobe Erfahrungswerte, keine Live-Daten.</p></div>`; })()}
    <div class="inscheck">
      <div class="sechead"><strong>Versicherung: ${ic.label}</strong><span class="small">${ic.score} / 100</span></div>
      <span class="track"><span style="width:${ic.score}%" class="${ic.score >= 70 ? "ok" : "bad"}"></span></span>
      <ul class="plain small">${CAR_INS.map(x => { const ok = !ic.missing.includes(x); return `<li class="${ok ? "goodtext" : "warntext"}">${ok ? "✓" : "✗"} ${esc(x.label)}${ok ? "" : ` – ${esc(x.why)}`}</li>`; }).join("")}</ul>
      ${c.deductible ? `<p class="small">Selbstbeteiligung: ${money(num(c.deductible), c.cur || "EUR")}</p>` : ""}
      ${aiBox(c)}
      ${!c.ins?.km && tt.km > 1500 ? `<p class="small warntext">Ihr fahrt ca. ${Math.round(tt.km).toLocaleString("de-DE")} km – ohne unbegrenzte Kilometer kann das teuer werden.</p>` : ""}
    </div>
    <div class="btnrow"><button class="btn small ghost" data-act="car-edit">Bearbeiten</button>${St.canAi ? `<button class="btn small ghost" data-act="car-ai">✨ Neu auslesen</button>` : ""}${c.status !== "gebucht" ? `<button class="btn small" data-act="car-book">✓ Gebucht</button>` : ""}</div>
  </section>

  <section class="card">
    <h2>💸 Günstiger oder besser versichert?</h2>
    <p class="small">Such mit denselben Daten bei anderen Anbietern und trag gefundene Angebote samt Versicherung ein – die App vergleicht Preis <em>und</em> Schutz.</p>
    <button class="btn small ghost" data-act="copy" data-text="${esc(info)}">📋 Daten kopieren</button>
    ${sites}
    ${offers.length ? `<ul class="offers">${offers.map(o => {
      const diff = total - o.eur, better = o.ic.score - ic.score;
      const verdict = diff > 0 && better >= 0 ? `<span class="goodtext">−${money(diff)} und ${better > 0 ? "besser" : "gleich gut"} versichert 👍</span>`
        : diff > 0 ? `<span class="warntext">−${money(diff)}, aber schlechter versichert (fehlt: ${o.ic.missing.filter(x => !ic.missing.includes(x)).map(x => x.label).join(", ") || "–"})</span>`
        : better > 0 ? `<span class="small">+${money(-diff)}, dafür besser versichert</span>` : `<span class="small">teurer, nicht besser</span>`;
      return `<li><span>${safeUrl(o.url) ? `<a href="${esc(safeUrl(o.url))}" target="_blank" rel="noopener noreferrer">${esc(o.name || "Angebot")}</a>` : esc(o.name || "Angebot")} · ${money(num(o.total), o.cur || "EUR")} · ${o.ic.score}/100<br>${verdict}</span>
        <button class="iconbtn sm" data-act="car-offer-del" data-o="${o.id}" aria-label="Angebot entfernen">✕</button></li>`;
    }).join("")}</ul>` : ""}
    <button class="btn small ghost" data-act="car-offer">+ Angebot vergleichen</button>
  </section>
  ${insHelp()}`;
}
function insHelp() {
  return `<details class="card more"><summary><h2>🛡️ Worauf bei der Versicherung achten?</h2></summary>
    <ul class="plain small">${CAR_INS.map(x => `<li><strong>${esc(x.label)}:</strong> ${esc(x.why)}</li>`).join("")}
    <li>Bei Buchung über deutsche Vermittler gilt oft deutsches Recht und die Selbstbeteiligung wird erstattet – am Schalter dann keine zweite Versicherung abschließen.</li>
    <li>Kreditkarte für die Kaution mitnehmen (meist 250–500 CAD, nicht Debitkarte).</li></ul>
  </details>`;
}
/* KI liest Buchung, Angebot oder Tarifbedingungen und füllt das Formular vor */
// Bilder verkleinern (spart Datenvolumen), PDFs und kleine Bilder so lassen
function fileToPart(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => {
      const url = String(r.result);
      if (!file.type.startsWith("image/") || file.size < 1.5e6) return resolve({ mimeType: file.type || "application/pdf", data: url.split(",")[1] });
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1800 / Math.max(img.width, img.height)), cv = document.createElement("canvas");
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        resolve({ mimeType: "image/jpeg", data: cv.toDataURL("image/jpeg", 0.85).split(",")[1] });
      };
      img.onerror = () => reject(new Error("Bild nicht lesbar"));
      img.src = url;
    };
    r.readAsDataURL(file);
  });
}
// Allgemeines KI-Formular: Text einfügen oder Screenshot/PDF wählen, die KI liest es aus
function aiDocSheet(kind, { title, intro, withUrl = false, onResult }) {
  if (!St.canAi) { toast("Automatisch auslesen geht nur in der installierten App (nicht im Demo-Modus)."); return; }
  const [a, b] = range();
  openSheet(title, `
    <p class="small">${intro}</p>
    <form class="form">
      ${withUrl ? `<label>Link <span class="small">(nur öffentliche Seiten)</span><input name="url" type="url" placeholder="https://…"></label>` : ""}
      <label>Text einfügen <span class="small">(z. B. aus der Bestätigungsmail)</span><textarea name="text" rows="5"></textarea></label>
      <label class="btn ghost small">📄 Screenshot oder PDF wählen<input type="file" name="files" accept="image/*,application/pdf" multiple hidden></label>
      <p class="small" id="aiFiles"></p>
      <button class="btn big">✨ Auslesen</button>
      <p class="small">Die Angaben gehen zur Auswertung an Google Gemini. Danach prüfst du alles.</p>
    </form>`, null, body => {
    const f = body.querySelector("form");
    f.elements.files.onchange = () => { body.querySelector("#aiFiles").textContent = [...f.elements.files.files].map(x => "✓ " + x.name).join("  "); };
    f.onsubmit = async e => {
      e.preventDefault();
      const files = [...f.elements.files.files].slice(0, 4);
      const input = { text: f.elements.text.value.trim(), url: withUrl ? safeUrl(f.elements.url.value) : "", trip: a ? `Reise ${a} bis ${b}` : "" };
      if (!input.text && !input.url && !files.length) { toast("Text einfügen oder eine Datei wählen."); return; }
      body.innerHTML = `<p>✨ Lese … das dauert ein paar Sekunden.</p>`;
      try {
        input.files = await Promise.all(files.map(fileToPart));
        await onResult(await St.readDocument(kind, input));
      } catch (err) {
        console.error(err);
        body.innerHTML = `<p class="warntext">Das Auslesen hat nicht geklappt (${esc(err.message || "Fehler")}).</p><p class="small">Probier es mit dem Text der Mail oder einem deutlicheren Screenshot – oder trag es selbst ein.</p>`;
      }
    };
  });
}
const aiStr = (v, n = 80) => typeof v === "string" ? v.trim().slice(0, n) : "";
const aiDate = v => /^\d{4}-\d{2}-\d{2}$/.test(aiStr(v)) ? aiStr(v) : "";
const aiTime = v => /^\d{1,2}:\d{2}$/.test(aiStr(v)) ? aiStr(v).padStart(5, "0") : "";

// Unterkunft: Formular vorausfüllen, Lage über die Adresse suchen und zum passenden Ort der Route legen
function aiLodging(stopId) {
  aiDocSheet("lodging", {
    title: "✨ Unterkunft aus Buchung auslesen",
    intro: "Bestätigungsmail von Airbnb, Booking.com oder dem Hotel einfügen – oder einen Screenshot bzw. das PDF wählen. Die App sucht auch die Adresse auf der Karte, damit Kilometer und Tagesplan ab der echten Unterkunft rechnen.",
    withUrl: true,
    async onResult(r) {
      const d = {
        name: aiStr(r.name) || "Unterkunft", platform: ["Airbnb", "Booking.com", "Vrbo", "Expedia", "Hotel direkt", "Camping", "Sonstiges"].includes(r.platform) ? r.platform : "Sonstiges",
        address: aiStr(r.address, 120) || aiStr(r.city), checkIn: aiDate(r.checkIn), checkOut: aiDate(r.checkOut), total: num(r.total), cur: r.cur === "CAD" ? "CAD" : "EUR",
        cancelUntil: aiDate(r.cancelUntil), url: safeUrl(r.url), status: "gebucht",
        note: [aiTime(r.checkInTime) ? `Check-in ab ${aiTime(r.checkInTime)}` : "", ...(Array.isArray(r.notes) ? r.notes.map(n => aiStr(n, 120)) : [])].filter(Boolean).join(" · ").slice(0, 300)
      };
      // Lage suchen (erst genaue Adresse, dann Name + Ort)
      for (const q of [d.address, `${d.name} ${aiStr(r.city)}`].filter(Boolean)) {
        try { const hit = (await geocode(q))[0]; if (hit) { d.lat = hit.lat; d.lng = hit.lng; break; } } catch {}
        await new Promise(res => setTimeout(res, 1100));
      }
      const s = stops().find(x => d.checkIn && x.from <= d.checkIn && d.checkIn < x.to) || (d.lat != null ? stops().slice().sort((x, y) => P.km(x, d) - P.km(y, d))[0] : null);
      lodgeSheet(null, s?.id || stopId, d);
      toast(d.lat != null ? "Ausgefüllt – Lage gefunden 📍" : "Ausgefüllt – bitte prüfen");
    }
  });
}

// Flugbuchung: als gebuchten Flug speichern und Ankunfts-/Abflugzeit in den Tagesplan übernehmen
function aiFlight() {
  aiDocSheet("flight", {
    title: "✨ Flugbuchung auslesen",
    intro: "Buchungsbestätigung der Airline einfügen oder als Screenshot/PDF wählen. Die App trägt den Flug als gebucht ein und übernimmt die Ankunftszeit in Kanada und die Rückflugzeit in den Tagesplan.",
    async onResult(r) {
      const o = r.out || {}, bk = r.back || {};
      const code = v => /^[A-Z]{3}$/.test(aiStr(v).toUpperCase()) ? aiStr(v).toUpperCase() : "";
      const al = AIRLINES.find(x => aiStr(r.airline).toLowerCase().includes(x.name.toLowerCase().split(" ")[0]));
      const f = {
        id: St.newId(), prices: [], booked: true, airline: al?.id || "", airlineName: al ? "" : aiStr(r.airline, 40),
        from: code(o.from) || flyPlan().ap, to: code(o.to) || flyPlan().inAp, date: aiDate(o.date) || range()[0],
        ret: aiDate(bk.date), retFrom: code(bk.from), retTo: code(bk.to), bookedPrice: toEur(num(r.total), r.cur === "CAD" ? "CAD" : "EUR"),
        code: aiStr(r.code, 12), station: r.rail ? aiStr(r.station, 40) : "",
        times: { dep: aiTime(o.dep), arr: aiTime(o.arr), retDep: aiTime(bk.dep), retArr: aiTime(bk.arr), flight: aiStr(o.flight, 30), retFlight: aiStr(bk.flight, 30) },
        notes: Array.isArray(r.notes) ? r.notes.map(n => aiStr(n, 150)).slice(0, 6) : []
      };
      // Gleichen beobachteten Flug ersetzen statt doppelt anlegen
      const same = T.flights.find(x => x.from === f.from && x.to === f.to && x.date === f.date);
      if (same) Object.assign(same, { ...f, id: same.id, prices: same.prices, target: same.target });
      else T.flights.push(f);
      const applied = [];
      const first = stops()[0], last = stops().at(-1);
      // Nach der Landung: Einreise, Gepäck, Mietwagen – etwa 1,5 Stunden
      if (first && f.times.arr && f.date === first.from) { first.arrive = P.hhmm(P.toMin(f.times.arr) + 90).padStart(5, "0"); applied.push(`Ankunft in ${first.name} ab ${first.arrive}`); }
      // Vor dem Rückflug: Auto abgeben, einchecken – 3 Stunden vorher am Flughafen
      if (last && f.times.retDep && f.ret === last.to) { last.depart = P.hhmm(Math.max(0, P.toMin(f.times.retDep) - 180)).padStart(5, "0"); applied.push(`letzter Tag bis ${last.depart}`); }
      commit();
      openSheet("✈️ Flug eingetragen", `
        <p><strong>${esc(al?.name || f.airlineName || "Flug")}</strong>${f.code ? ` · Buchungscode ${esc(f.code)}` : ""}${f.bookedPrice ? ` · ${money(f.bookedPrice)}` : ""}</p>
        <p class="small">Hin: ${esc(f.from)} → ${esc(f.to)} ${fmtD(f.date)}${f.times.dep ? ` · ${f.times.dep} → ${f.times.arr || "?"}` : ""}${f.times.flight ? ` · ${esc(f.times.flight)}` : ""}</p>
        ${f.ret ? `<p class="small">Zurück: ${esc(f.retFrom || f.to)} → ${esc(f.retTo || f.from)} ${fmtD(f.ret)}${f.times.retDep ? ` · ${f.times.retDep} → ${f.times.retArr || "?"}` : ""}${f.times.retFlight ? ` · ${esc(f.times.retFlight)}` : ""}</p>` : ""}
        ${f.station ? `<p class="small">🚆 Zug ab ${esc(f.station)} inklusive</p>` : ""}
        ${applied.length ? `<p class="small goodtext">Im Tagesplan übernommen: ${applied.map(esc).join(", ")}.</p>` : ""}
        ${f.notes.length ? `<ul class="plain small">${f.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
        <button class="btn big" data-act="sheet-close">OK</button>`);
    }
  });
}

// Preis-Screenshot von der Airline-Seite in den Preiswächter übernehmen
function aiPrice(f) {
  aiDocSheet("price", {
    title: "📷 Preis aus Screenshot",
    intro: "Mach auf der Airline-Seite einen Screenshot vom Suchergebnis (mit dem Preis) und wähl ihn hier aus. Die App liest den Preis und trägt ihn in den Verlauf ein.",
    async onResult(r) {
      let p = num(r.price);
      if (!p) throw new Error("kein Preis erkannt");
      if (r.perPerson) p *= pax().adults + pax().children;
      const eur = r.cur && r.cur !== "EUR" ? toEur(p, r.cur === "CAD" ? "CAD" : "EUR") : p;
      f.prices.push({ at: Date.now(), p: Math.round(eur), src: "screenshot" });
      commit(); closeSheet();
      toast(`${money(eur)} eingetragen${r.perPerson ? " (Preis pro Person × Reisende)" : ""}${f.target && eur <= f.target ? " – 🎉 unter deinem Zielpreis!" : ""}`);
    }
  });
}

function aiCarSheet(target = "car") {
  if (!St.canAi) { toast("Automatisch ausfüllen geht nur in der installierten App (nicht im Demo-Modus)."); return; }
  const c = target === "car" ? T.car : null, [a, b] = range();
  openSheet(target === "car" ? "✨ Mietwagen automatisch ausfüllen" : "✨ Angebot automatisch auslesen", `
    <p class="small">Gib so viel an, wie du hast. Am zuverlässigsten ist der <strong>Text der Bestätigungsmail</strong> oder ein <strong>Screenshot/PDF</strong> –
      Buchungslinks sind oft nur mit Login sichtbar. Mit nur Anbieter und Vermittler sucht die KI die allgemeinen Tarifbedingungen im Netz.</p>
    <form class="form">
      <label>Link zur Buchung oder zum Angebot<input name="url" type="url" value="${esc(c?.url || "")}" placeholder="https://…"></label>
      <div class="row2">
        <label>Vermieter<input name="provider" value="${esc(c?.provider || "")}" placeholder="z. B. Avis"></label>
        <label>Gebucht über<input name="via" value="${esc(c?.via || "")}" placeholder="z. B. Sunny Cars, direkt"></label>
      </div>
      <label>Text der Buchung / Bedingungen <span class="small">(einfach aus der Mail kopieren)</span><textarea name="text" rows="5" placeholder="Buchungsbestätigung, Leistungen, Versicherungsbedingungen …"></textarea></label>
      <label class="btn ghost small">📄 Screenshot oder PDF wählen<input type="file" name="files" accept="image/*,application/pdf" multiple hidden></label>
      <p class="small" id="aiFiles"></p>
      <button class="btn big">✨ Auslesen</button>
      <p class="small">Die Angaben gehen zur Auswertung an Google Gemini (wie bei den Rezeptideen der Essens-App). Danach prüfst du alles und speicherst selbst.</p>
    </form>`, null, body => {
    const f = body.querySelector("form");
    f.elements.files.onchange = () => { body.querySelector("#aiFiles").textContent = [...f.elements.files.files].map(x => "✓ " + x.name).join("  "); };
    f.onsubmit = async e => {
      e.preventDefault();
      const input = {
        url: safeUrl(f.elements.url.value), provider: f.elements.provider.value.trim(), via: f.elements.via.value.trim(),
        text: f.elements.text.value.trim(), trip: a ? `${fmtShort(a)} bis ${fmtShort(b)}, Gabelflug ${flyPlan().inAp} → ${flyPlan().outAp}` : ""
      };
      if (!input.url && !input.provider && !input.via && !input.text && !f.elements.files.files.length) { toast("Bitte mindestens eine Angabe machen."); return; }
      const files = [...f.elements.files.files].slice(0, 4);
      body.innerHTML = `<p>✨ Lese ${files.length ? "die Datei" : input.text ? "den Text" : input.url ? "den Link" : "die Tarifbedingungen"} … das dauert bis zu einer Minute.</p>`;
      try {
        input.files = await Promise.all(files.map(fileToPart));
        const r = await St.readCarBooking(input);
        const draft = aiDraft(r, input);
        if (target === "car") carSheet(draft); else carOfferSheet(draft);
      } catch (err) {
        console.error(err);
        body.innerHTML = `<p class="warntext">Das Auslesen hat nicht geklappt (${esc(err.message || "Fehler")}).</p>
          <p class="small">Tipp: Kopier den Text der Bestätigungsmail und versuch es nochmal – oder trag die Angaben selbst ein.</p>
          <button class="btn" data-act="${target === "car" ? "car-edit" : "car-offer"}">Selbst eintragen</button>`;
      }
    };
  });
}
// KI-Antwort in Formularwerte übersetzen (nur, was wirklich drinsteht)
function aiDraft(r, input) {
  const str = (v, n = 80) => typeof v === "string" ? v.trim().slice(0, n) : "";
  const date = v => /^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : "";
  const time = v => /^\d{1,2}:\d{2}$/.test(str(v)) ? str(v).padStart(5, "0") : "";
  const d = { aiSource: ["dokument", "recherche", "wissen"].includes(r.source) ? r.source : "wissen", aiAt: Date.now(), linkUnread: !!r.linkUnread };
  for (const k of ["provider", "via", "cls", "pickPlace", "dropPlace"]) if (str(r[k])) d[k] = str(r[k], 60);
  for (const k of ["pickDate", "dropDate", "cancelUntil"]) if (date(r[k])) d[k] = date(r[k]);
  for (const k of ["pickTime", "dropTime"]) if (time(r[k])) d[k] = time(r[k]);
  if (num(r.total) > 0) d.total = num(r.total);
  if (r.cur === "CAD" || r.cur === "EUR") d.cur = r.cur;
  if (r.deductible != null && r.deductible !== "") d.deductible = num(r.deductible);
  if (str(r.sliSum)) d.sliSum = str(r.sliSum, 40);
  if (str(r.deposit)) d.deposit = str(r.deposit, 60);
  if (input.url) d.url = input.url;
  d.ins = {}; d.insUnknown = [];
  for (const x of CAR_INS) {
    const v = r.ins?.[x.id];
    if (v === true || v === false) d.ins[x.id] = v; else d.insUnknown.push(x.id);
  }
  d.aiNotes = Array.isArray(r.notes) ? r.notes.filter(n => typeof n === "string").map(n => n.slice(0, 200)).slice(0, 8) : [];
  return d;
}
const AI_SOURCE = { dokument: "aus deiner Buchung gelesen", recherche: "aus den allgemeinen Tarifbedingungen im Netz – deine Buchung kann abweichen", wissen: "nur aus dem allgemeinen Wissen der KI über diesen Anbieter geschätzt – bitte unbedingt mit deiner Buchung vergleichen" };
function aiBox(v) {
  if (!v.aiSource) return "";
  return `<div class="aibox"><p class="small"><strong>✨ Automatisch ausgefüllt</strong> – ${AI_SOURCE[v.aiSource]}.</p>
    ${v.linkUnread ? `<p class="small warntext">Den Link konnte die KI nicht öffnen (meist nur mit Login sichtbar). Kopier lieber den Text der Bestätigungsmail oder lade einen Screenshot hoch.</p>` : ""}
    ${v.insUnknown?.length ? `<p class="small warntext">Steht nicht drin, bitte selbst prüfen: ${v.insUnknown.map(id => esc(CAR_INS.find(x => x.id === id)?.label || id)).join(", ")}</p>` : ""}
    ${v.sliSum ? `<p class="small">Haftpflicht: ${esc(v.sliSum)}</p>` : ""}${v.deposit ? `<p class="small">Kaution: ${esc(v.deposit)}</p>` : ""}
    ${v.aiNotes?.length ? `<ul class="plain small">${v.aiNotes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}</div>`;
}

function carSheet(draft) {
  // Bei neuer Auswertung zählt nur, was die KI gefunden hat; Unbekanntes bleibt leer und wird angezeigt
  const c = T.car, v = { status: "gebucht", ...carDefaults(), ...(c || {}), ...(draft || {}), ins: draft ? { ...draft.ins } : { ...(c?.ins || {}) } };
  openSheet(draft ? "Mietwagen prüfen & speichern" : c ? "Mietwagen bearbeiten" : "Mietwagen eintragen", `
    ${draft ? aiBox(v) : St.canAi ? `<button type="button" class="btn ghost wide" data-act="car-ai">✨ Aus Link, Mail, Screenshot oder Anbieter automatisch ausfüllen</button>` : ""}
    <form class="form">
      <div class="row2">
        <label>Vermieter<input name="provider" value="${esc(v.provider || "")}" maxlength="60" placeholder="z. B. Avis, Hertz" required></label>
        <label>Gebucht über<input name="via" value="${esc(v.via || "")}" maxlength="60" placeholder="z. B. billiger-mietwagen.de"></label>
      </div>
      <div class="row2">
        <label>Status<select name="status"><option value="gebucht" ${v.status === "gebucht" ? "selected" : ""}>Gebucht</option><option value="angebot" ${v.status !== "gebucht" ? "selected" : ""}>Nur Angebot</option></select></label>
        <label>Fahrzeugklasse<input name="cls" value="${esc(v.cls || "")}" maxlength="60" placeholder="z. B. SUV (Ford Escape)"></label>
      </div>
      <label>Link<input name="url" type="url" value="${esc(v.url || "")}" placeholder="https://…"></label>
      <label>Abholung<input name="pickPlace" value="${esc(v.pickPlace)}" maxlength="80"></label>
      <div class="row2"><label>Datum<input type="date" name="pickDate" value="${v.pickDate}"></label><label>Uhrzeit<input type="time" name="pickTime" value="${v.pickTime}"></label></div>
      <label>Rückgabe<input name="dropPlace" value="${esc(v.dropPlace)}" maxlength="80"></label>
      <div class="row2"><label>Datum<input type="date" name="dropDate" value="${v.dropDate}"></label><label>Uhrzeit<input type="time" name="dropTime" value="${v.dropTime}"></label></div>
      <div class="row2">
        <label>Preis gesamt<input name="total" inputmode="decimal" value="${numIn(num(v.total))}"></label>
        <label>Währung<select name="cur"><option ${v.cur !== "CAD" ? "selected" : ""}>EUR</option><option ${v.cur === "CAD" ? "selected" : ""}>CAD</option></select></label>
      </div>
      <div class="row2">
        <label>Selbstbeteiligung<input name="deductible" inputmode="decimal" value="${numIn(num(v.deductible))}" placeholder="0"></label>
        <label>Kostenlos stornierbar bis<input type="date" name="cancelUntil" value="${v.cancelUntil || ""}"></label>
      </div>
      <p class="grouplabel">Was ist enthalten?</p>
      ${CAR_INS.map(x => `<label class="check"><input type="checkbox" name="ins_${x.id}" ${v.ins?.[x.id] ? "checked" : ""}><span>${esc(x.label)}</span></label>`).join("")}
      <label>Notiz<textarea name="note" rows="2" maxlength="300">${esc(v.note || "")}</textarea></label>
      <button class="btn big">Speichern</button>
      ${c ? `<button type="button" class="btn ghost danger wide" data-act="car-del">Mietwagen entfernen</button>` : ""}
    </form>`, fd => {
    const s = k => String(fd.get(k) || "").trim();
    T.car = {
      ...(T.car || {}), provider: s("provider").slice(0, 60), via: s("via").slice(0, 60), status: s("status"), cls: s("cls").slice(0, 60),
      url: safeUrl(s("url")), pickPlace: s("pickPlace").slice(0, 80), pickDate: s("pickDate"), pickTime: s("pickTime"),
      dropPlace: s("dropPlace").slice(0, 80), dropDate: s("dropDate"), dropTime: s("dropTime"), total: num(s("total")), cur: s("cur"),
      deductible: num(s("deductible")), cancelUntil: s("cancelUntil"), note: s("note").slice(0, 300),
      ins: Object.fromEntries(CAR_INS.map(x => [x.id, !!fd.get("ins_" + x.id)])), offers: T.car?.offers || []
    };
    // Hinweise der KI behalten (oder bei neuer Auswertung ersetzen)
    if (draft) Object.assign(T.car, { aiSource: v.aiSource, aiAt: v.aiAt, aiNotes: v.aiNotes || [], insUnknown: v.insUnknown || [], sliSum: v.sliSum || "", deposit: v.deposit || "" });
    commit(); toast("Gespeichert");
  });
}
function carOfferSheet(draft) {
  const v = { name: "", url: "", total: "", cur: "EUR", ins: {}, ...(draft || {}) };
  if (draft && !draft.name) v.name = [draft.via, draft.provider, draft.cls].filter(Boolean).join(" – ");
  openSheet(draft ? "Angebot prüfen & vergleichen" : "Mietwagen-Angebot vergleichen", `
    ${draft ? aiBox(v) : St.canAi ? `<button type="button" class="btn ghost wide" data-act="car-offer-ai">✨ Angebot automatisch auslesen</button>` : ""}
    <form class="form">
      <label>Anbieter<input name="name" maxlength="80" value="${esc(v.name)}" placeholder="z. B. Sunny Cars – SUV" required></label>
      <label>Link<input name="url" type="url" value="${esc(v.url)}" placeholder="https://…"></label>
      <div class="row2">
        <label>Preis gesamt<input name="total" inputmode="decimal" value="${numIn(num(v.total))}" required></label>
        <label>Währung<select name="cur"><option ${v.cur !== "CAD" ? "selected" : ""}>EUR</option><option ${v.cur === "CAD" ? "selected" : ""}>CAD</option></select></label>
      </div>
      <p class="grouplabel">Was ist enthalten?</p>
      ${CAR_INS.map(x => `<label class="check"><input type="checkbox" name="ins_${x.id}" ${v.ins[x.id] ? "checked" : ""}><span>${esc(x.label)}</span></label>`).join("")}
      <button class="btn big">Vergleichen</button>
    </form>`, fd => {
    const o = { id: St.newId(), name: String(fd.get("name")).trim().slice(0, 80), url: safeUrl(fd.get("url")), total: num(fd.get("total")), cur: fd.get("cur"),
      ins: Object.fromEntries(CAR_INS.map(x => [x.id, !!fd.get("ins_" + x.id)])), at: Date.now(), ...(draft?.aiNotes?.length ? { aiNotes: draft.aiNotes } : {}) };
    (T.car.offers ||= []).push(o);
    commit();
  });
}
function flightCard(f) {
  const last = f.prices.at(-1), min = f.prices.length ? Math.min(...f.prices.map(x => x.p)) : 0;
  const status = f.booked ? `<span class="tag good">Gebucht${f.bookedPrice ? " · " + money(f.bookedPrice) : ""}</span>`
    : !last ? `<span class="tag">Noch kein Preis</span>`
    : f.target && last.p <= f.target ? `<span class="tag good">🎉 Unter Zielpreis!</span>`
    : f.target ? `<span class="tag">noch ${money(last.p - f.target)} drüber</span>` : "";
  const due = !f.booked && (!last || Date.now() - last.at > (T.checkEvery || 3) * 864e5);
  return `<article class="card watch ${due ? "due" : ""}">
    <div class="sechead"><h3>${f.airline ? esc(AIRLINES.find(al => al.id === f.airline)?.name || "") + " · " : f.airlineName ? esc(f.airlineName) + " · " : ""}${f.station ? `${esc(f.station)} 🚆 ` : ""}${esc(f.from)} → ${esc(f.to)}${f.retFrom && f.retFrom !== f.to ? ` · ${esc(f.retFrom)} → ${esc(f.retTo || f.from)}` : f.ret ? " · zurück" : ""}</h3>${status}</div>
    <p class="small">${fmtD(f.date)}${f.ret ? ` – ${fmtD(f.ret)}` : ""}${f.flex ? ` · ± ${f.flex} Tage` : ""}${f.direct ? " · nur direkt" : ""}${f.target ? ` · Ziel: ${money(f.target)}` : ""}</p>
    ${f.times?.dep || f.code ? `<p class="small">${f.times?.dep ? `Hin ${f.times.dep} → ${f.times.arr || "?"}${f.times.flight ? ` (${esc(f.times.flight)})` : ""}` : ""}${f.times?.retDep ? ` · Zurück ${f.times.retDep} → ${f.times.retArr || "?"}${f.times.retFlight ? ` (${esc(f.times.retFlight)})` : ""}` : ""}${f.code ? ` · Buchungscode <strong>${esc(f.code)}</strong>` : ""}</p>` : ""}
    ${f.notes?.length ? `<ul class="plain small">${f.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
    ${f.prices.length ? `<div class="pricerow"><div><span class="small">Zuletzt (${ago(last.at)})</span><strong>${money(last.p)}</strong></div><div><span class="small">Bisher günstigster</span><strong>${money(min)}</strong></div>${spark(f)}</div>` : ""}
    ${f.booked ? "" : adviceBox(Adv.flightAdvice(f, todayIso(), pax().adults + pax().children))}
    ${linkBtns(AIRLINES.filter(al => f.airline ? al.id === f.airline : airlineFit(al, f.from, f.to)).map(al => ({ name: al.name, url: al.url })))}
    ${f.booked ? "" : `<form class="priceform" data-form="flight-price" data-id="${f.id}">
      <input name="p" inputmode="decimal" placeholder="Heutiger Preis in € (gesamt)" aria-label="Heutiger Preis" required>
      <button class="btn small">Eintragen</button>${St.canAi ? `<button type="button" class="btn small ghost" data-act="price-shot" data-id="${f.id}">📷 Screenshot</button>` : ""}</form>`}
    <div class="btnrow">
      <button class="btn small ghost" data-act="flight-booked" data-id="${f.id}">${f.booked ? "Doch nicht gebucht" : "✓ Gebucht"}</button>
      <button class="btn small ghost" data-act="flight-edit" data-id="${f.id}">Bearbeiten</button>
    </div>
  </article>`;
}
// Einschätzung „jetzt buchen oder warten?“ mit Preisspanne und Begründung
function adviceBox(a) {
  if (a.verdict === "vorbei") return "";
  const icon = { buchen: "✅", warten: "⏳", beobachten: "👀", unbekannt: "ℹ️" }[a.verdict] || "ℹ️";
  const mark = a.last != null ? Math.round(Math.max(0, Math.min(1, (a.last - a.range[0]) / (a.range[1] - a.range[0]))) * 100) : null;
  return `<div class="advice ${a.tone}">
    <p><strong>${icon} ${esc(a.text)}</strong></p>
    ${mark != null ? `<div class="range" title="Wo dein Preis in der üblichen Spanne liegt"><span class="track"><span class="mark" style="left:${mark}%"></span></span>
      <span class="small">${money(a.range[0])} günstig</span><span class="small">teuer ${money(a.range[1])}</span></div>` : ""}
    <ul class="plain small">${a.reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
    <p class="small muted">Aus ${a.n ? (a.n === 1 ? "deinem einen Eintrag" : `deinen ${a.n} Einträgen`) + " und " : ""}groben Erfahrungswerten für Kanada (keine Live-Daten der Airlines)${a.confidence ? ` · Sicherheit: ${a.confidence}` : ""}.</p>
  </div>`;
}
// Buchungs-Fahrplan: was wann am besten gebucht wird, mit Stand
function bookingPlanCard() {
  const [a] = range();
  if (!a) return "";
  const t = todayIso();
  const hasPark = stops().some(s => BASES.find(b => b.id === s.baseId)?.park);
  const needBeds = stops().filter(s => P.daysBetween(s.from, s.to) > 0);
  const done = {
    "Flüge": T.flights.some(f => f.booked),
    "Mietwagen": T.car?.status === "gebucht",
    "Unterkünfte in Nationalpark-Orten": needBeds.length > 0 && needBeds.every(s => T.lodgings.some(l => l.stopId === s.id && l.status === "gebucht"))
  };
  const rows = Adv.bookingPlan(a, hasPark).map(x => {
    const ok = done[x.what];
    const state = ok ? "✓ erledigt" : x.until && t > x.until ? "⚠️ höchste Zeit" : x.from && t < x.from ? `ab ${fmtShort(x.from)}` : "👉 jetzt";
    return `<li class="${ok ? "done" : state.startsWith("⚠️") ? "late" : state.startsWith("👉") ? "now" : ""}">
      <span class="ai">${x.icon}</span><div><strong>${esc(x.what)}</strong>
      <span class="small block">${x.from ? `${fmtShort(x.from)} – ` : "bis "}${fmtShort(x.until)} · ${esc(x.note)}</span></div><span class="tag">${state}</span></li>`;
  }).join("");
  return `<section class="card"><h2>📅 Wann am besten buchen?</h2><ul class="plan">${rows}</ul>
    <p class="small muted">Typische Zeitfenster für eine Reise ab ${fmtShort(a)} (${Adv.SEASON_LABEL[Adv.season(a)]}). Grobe Erfahrungswerte – keine Garantie.</p></section>`;
}
function spark(f) {
  const ps = f.prices.slice(-20);
  if (ps.length < 2) return "";
  const vals = ps.map(x => x.p).concat(f.target ? [f.target] : []);
  const lo = Math.min(...vals), hi = Math.max(...vals), w = 140, h = 44;
  const y = v => hi === lo ? h / 2 : h - 4 - (v - lo) / (hi - lo) * (h - 8);
  const pts = ps.map((x, i) => `${(i / (ps.length - 1) * w).toFixed(1)},${y(x.p).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="Preisverlauf">
    ${f.target ? `<line x1="0" x2="${w}" y1="${y(f.target)}" y2="${y(f.target)}" class="target"/>` : ""}
    <polyline points="${pts}"/></svg>`;
}

/* ---------- Unterkünfte ---------- */
const lodgeEur = l => toEur(num(l.total), l.cur || "EUR");
const nightsOf = l => Math.max(1, P.daysBetween(l.checkIn, l.checkOut));
function cheapestOffer(l) {
  const mine = lodgeEur(l);
  const cheaper = (l.offers || []).filter(o => toEur(o.total, o.cur) < mine - 1).sort((a, b) => toEur(a.total, a.cur) - toEur(b.total, b.cur));
  return cheaper[0] || null;
}
function viewLodging() {
  const list = stops().filter(s => P.daysBetween(s.from, s.to) > 0);
  if (!list.length) return `<div class="card empty"><p>Lege zuerst in der Route deine Orte mit Daten an – dann siehst du hier für jeden Ort passende Unterkünfte.</p><button class="btn" data-act="stop-add">+ Ort hinzufügen</button></div>`;
  const loose = T.lodgings.filter(l => !stopById(l.stopId));
  return `<p class="small pad">Trag ein, was du gebucht hast. Die App sucht dann mit denselben Daten nach günstigeren Angeboten in der Nähe und erinnert dich vor Ende der kostenlosen Stornierung.</p>
  ${St.canAi ? `<button class="btn wide" data-act="lodge-ai">✨ Buchungsbestätigung auslesen (Mail, Screenshot, PDF)</button>` : ""}
  ${list.map(lodgeStop).join("")}
  ${loose.length ? `<h2 class="sec">Ohne Ort</h2>${loose.map(l => lodgeCard(l, null)).join("")}` : ""}`;
}
function lodgeStop(s) {
  const n = P.daysBetween(s.from, s.to);
  const mine = T.lodgings.filter(l => l.stopId === s.id);
  const booked = mine.filter(l => l.status === "gebucht"), saved = mine.filter(l => l.status !== "gebucht");
  const base = BASES.find(b => b.id === s.baseId);
  const search = { place: s.searchName || s.name, lat: s.lat, lng: s.lng, checkIn: s.from, checkOut: s.to, maxNight: s.maxNight, park: base?.park };
  return `<section class="card lodgestop">
    <div class="sechead"><h2>${esc(s.name)}</h2><span class="small">${fmtShort(s.from)} – ${fmtShort(s.to)} · ${plural(n, "Nacht", "Nächte")}</span></div>
    ${booked.map(l => lodgeCard(l, s)).join("")}
    ${!booked.length ? `<div class="searchbox">
      <p class="small"><strong>Suchen</strong> – ${plural(pax().adults, "Erwachsener", "Erwachsene")}${pax().children ? `, ${plural(pax().children, "Kind", "Kinder")}` : ""}, sortiert nach Preis</p>
      <label class="inline">bis <input class="mini" inputmode="numeric" data-change="maxNight" data-id="${s.id}" value="${s.maxNight || ""}" placeholder="—"> € pro Nacht</label>
      ${linkBtns(lodgingLinks(search, pax()))}
    </div>` : ""}
    ${saved.length ? `<p class="small"><strong>Gemerkt</strong></p>${saved.map(l => lodgeCard(l, s)).join("")}` : ""}
    <div class="btnrow"><button class="btn small ghost" data-act="lodge-add" data-id="${s.id}">+ Unterkunft eintragen</button>${St.canAi ? `<button class="btn small ghost" data-act="lodge-ai" data-id="${s.id}">✨ Aus Buchung auslesen</button>` : ""}</div>
  </section>`;
}
function lodgeCard(l, s) {
  const total = lodgeEur(l), nights = nightsOf(l), per = total / nights;
  const url = safeUrl(l.url);
  const dl = l.cancelUntil ? daysUntil(l.cancelUntil) : null;
  const best = cheapestOffer(l);
  const booked = l.status === "gebucht";
  const near = { place: s?.searchName || s?.name || l.address || l.name, lat: l.lat ?? s?.lat, lng: l.lng ?? s?.lng, near: l.lat != null, checkIn: l.checkIn, checkOut: l.checkOut, maxNight: per > 0 ? per - 1 : 0 };
  return `<article class="lodge ${booked ? "booked" : ""}">
    <div class="sechead"><h3>${booked ? "🏡" : "⭐"} ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(l.name)} ↗</a>` : esc(l.name)}</h3>
      <button class="linkbtn" data-act="lodge-edit" data-id="${l.id}">Bearbeiten</button></div>
    <p class="small">${esc(l.platform || "")}${l.platform ? " · " : ""}${fmtShort(l.checkIn)} – ${fmtShort(l.checkOut)}${total ? ` · ${money(total)} (${money(per)}/Nacht)` : ""}${l.cur === "CAD" ? ` · ${money(num(l.total), "CAD")}` : ""}</p>
    ${(() => { if (!per) return ""; const la = Adv.lodgingAdvice(per / rate(), l.checkIn, !!BASES.find(b => b.id === s?.baseId)?.park); return `<p class="small">💶 ${money(per / rate(), "CAD")}/Nacht ist für ${Adv.SEASON_LABEL[la.season]} hier <strong class="${la.level === "teuer" ? "warntext" : la.level === "günstig" ? "goodtext" : ""}">${la.level}</strong> (üblich ca. ${la.range[0]}–${la.range[1]} CAD)</p>`; })()}
    ${lodgeFar(l, s) ? `<p class="small warntext">📍 Die gespeicherte Lage liegt ${Math.round(P.km(l, s))} km von ${esc(s.name)} entfernt – vermutlich falsch gefunden. Bitte unter „Bearbeiten“ → „📍 Lage suchen“ korrigieren. Bis dahin rechnet die App ab ${esc(s.name)}.</p>` : ""}
    ${l.cancelUntil ? `<p class="small ${dl != null && dl <= 7 && dl >= 0 ? "warntext" : ""}">${dl < 0 ? "Kostenlose Stornierung abgelaufen" : `Kostenlos stornierbar bis ${fmtD(l.cancelUntil)} (${dl === 0 ? "heute" : `noch ${plural(dl, "Tag", "Tage")}`})`}</p>` : ""}
    ${l.note ? `<p class="small">${esc(l.note)}</p>` : ""}
    ${booked && dl !== null && dl < 0 ? "" : booked ? `<details class="cheaper" ${best ? "open" : ""}>
      <summary>💸 Günstiger finden${best ? ` – <strong>${money(total - toEur(best.total, best.cur))} sparen</strong>` : ""}</summary>
      <p class="small">Gleiche Daten und Personen${l.lat != null ? ", nur im Umkreis von ca. 4 km" : ""}${per > 0 ? `, unter ${money(per)} pro Nacht` : ""}:</p>
      ${linkBtns(lodgingLinks(near, pax()))}
      ${(l.offers || []).length ? `<ul class="offers">${l.offers.map(o => {
        const diff = total - toEur(o.total, o.cur);
        return `<li><span>${safeUrl(o.url) ? `<a href="${esc(safeUrl(o.url))}" target="_blank" rel="noopener noreferrer">${esc(o.name || "Angebot")}</a>` : esc(o.name || "Angebot")} · ${money(num(o.total), o.cur || "EUR")}</span>
          <span class="${diff > 0 ? "goodtext" : "small"}">${diff > 0 ? `−${money(diff)}` : diff < 0 ? `+${money(-diff)}` : "gleich"}</span>
          <button class="iconbtn sm" data-act="offer-del" data-id="${l.id}" data-o="${o.id}" aria-label="Angebot entfernen">✕</button></li>`;
      }).join("")}</ul>` : ""}
      <button class="btn small ghost" data-act="offer-add" data-id="${l.id}">+ Gefundenes Angebot vergleichen</button>
      ${best && dl !== null && dl >= 0 ? `<p class="small goodtext">Du kannst bis ${fmtD(l.cancelUntil)} kostenlos stornieren und neu buchen.</p>` : ""}
    </details>` : `<button class="btn small" data-act="lodge-book" data-id="${l.id}">✓ Gebucht</button>`}
  </article>`;
}

/* ---------- Mehr ---------- */
function viewMore() {
  const [a] = range();
  const left = a ? daysUntil(a) : null;
  const b = budget();
  const code = St.syncCode();
  return `
  <details class="card more" open><summary><h2>✅ Vorbereitung</h2><span class="small">${CHECKLIST.filter(c => T.checks[c.id]).length}/${CHECKLIST.length}</span></summary>
    <ul class="checks">${CHECKLIST.map(c => {
      const due = left != null && left <= c.when && !T.checks[c.id];
      return `<li><label class="check"><input type="checkbox" data-change="check" data-id="${c.id}" ${T.checks[c.id] ? "checked" : ""}>
        <span><strong>${esc(c.text)}</strong>${due ? ` <span class="tag warn">jetzt</span>` : a ? ` <span class="small">spätestens ${fmtShort(P.addDays(a, -c.when))}</span>` : ""}${c.note ? `<span class="small block">${esc(c.note)}</span>` : ""}</span></label></li>`;
    }).join("")}</ul>
  </details>

  <details class="card more"><summary><h2>🎒 Packliste</h2><span class="small">${Object.values(T.packed).filter(Boolean).length} eingepackt</span></summary>
    ${PACKLIST.map(g => `<p class="grouplabel">${esc(g.cat)}</p><ul class="checks">${g.items.map(it => {
      const k = g.cat + "|" + it;
      return `<li><label class="check"><input type="checkbox" data-change="pack" data-k="${esc(k)}" ${T.packed[k] ? "checked" : ""}><span>${esc(it)}</span></label></li>`;
    }).join("")}</ul>`).join("")}
  </details>

  <details class="card more"><summary><h2>💶 Budget</h2><span class="small">${money(b.total)}</span></summary>
    <table class="budget"><tbody>
      <tr><td>Flüge (gebucht)</td><td>${money(b.flights)}</td></tr>
      <tr><td>Unterkünfte (gebucht)</td><td>${money(b.lodging)}</td></tr>
      <tr><td>Mietwagen (gebucht)</td><td>${money(b.car)}</td></tr>
      <tr><td>Ausgaben <span class="small block">${plural(T.expenses.length, "Eintrag", "Einträge")} – siehe „Ausgaben & Aufteilen“</span></td><td>${money(b.extra)}</td></tr>
      <tr class="sum"><td>Gebucht & ausgegeben</td><td>${money(b.total)}</td></tr>
      <tr><td>Sprit <span class="small block">geschätzt: ${Math.round(b.tt.km).toLocaleString("de-DE")} km × ${String(b.tt.l100).replace(".", ",")} l/100 km × ${String(b.tt.price).replace(".", ",")} CAD/l</span></td><td>≈ ${money(b.fuel)}</td></tr>
      <tr><td>Eintritte laut Tagesplan <span class="small block">geschätzt${b.parkDays ? ` · ${plural(b.parkDays, "Tag", "Tage")} im Nationalpark${b.parkDays >= 7 ? " – der Discovery Pass lohnt sich" : " – Tagespässe reichen"}` : ""}</span></td><td>≈ ${money(b.entryEur)}</td></tr>
      <tr class="sum"><td>Voraussichtlich gesamt</td><td>${money(b.expected)}</td></tr>
    </tbody></table>
    <p class="small">${b.perDay ? `≈ ${money(b.perDay)} pro Tag · ` : ""}1 CAD ≈ ${rate().toFixed(3).replace(".", ",")} €</p>
    <p class="small">Umrechner: <input class="mini" inputmode="decimal" data-change="conv" placeholder="CAD"> CAD = <strong id="convOut">–</strong></p>
  </details>

  ${expensesSection()}

  <details class="card more"><summary><h2>🍁 Kanada-Tipps</h2></summary>
    ${TIPS.map(t => `<p><strong>${t.icon} ${esc(t.title)}</strong><br>${esc(t.text)}</p>`).join("")}
  </details>

  <details class="card more"><summary><h2>⚙️ Reise</h2></summary>
    <form class="form" data-form="settings">
      <label>Name der Reise<input name="name" value="${esc(T.name)}" maxlength="40"></label>
      <div class="row2">
        <label>Hinflug<input type="date" name="start" value="${T.start || ""}"></label>
        <label>Rückflug<input type="date" name="end" value="${T.end || ""}"></label>
      </div>
      <div class="row2">
        <label>Erwachsene<input type="number" name="adults" min="1" max="9" value="${T.adults}"></label>
        <label>Kinder<input type="number" name="children" min="0" max="9" value="${T.children}"></label>
      </div>
      <label>Abflughafen (Code)<input name="home" value="${esc(T.home)}" maxlength="3" list="homeAps" autocapitalize="characters"></label>
      <datalist id="homeAps">${Object.entries(HOME_AIRPORTS).map(([c, n]) => `<option value="${c}">${n}</option>`).join("")}</datalist>
      <button class="btn">Speichern</button>
    </form>
  </details>

  <details class="card more" ${code ? "" : ""}><summary><h2>📱 Auf anderen Geräten & mit Mitreisenden</h2><span class="small">${code ? "☁ verbunden" : "nur hier"}</span></summary>
    ${!St.canSync ? `<p class="small">Im Demo-Modus nicht verfügbar.</p>` : code ? `
      <p>Deine Reise wird über diesen Reisecode abgeglichen. Am anderen Gerät die App öffnen und den Code eingeben – oder den Link schicken:</p>
      <p class="code">${esc(St.showCode(code))}</p>
      <div class="btnrow"><button class="btn small" data-act="sync-share">Link teilen</button><button class="btn small ghost" data-act="sync-leave">Trennen</button></div>`
    : `<p>Damit Handy, PC und Mitreisende dieselbe Reise sehen, erstelle einen Reisecode und gib ihn auf dem anderen Gerät ein.</p>
      <div class="btnrow"><button class="btn small" data-act="sync-new">Reisecode erstellen</button><button class="btn small ghost" data-act="sync-join">Code eingeben</button></div>`}
  </details>

  <details class="card more"><summary><h2>💾 Kalender & Sicherung</h2></summary>
    <div class="btnrow">
      <button class="btn small" data-act="ics">Tagesplan in den Kalender (.ics)</button>
      <button class="btn small ghost" data-act="export">Reise als Datei sichern</button>
      <label class="btn small ghost">Datei laden<input type="file" accept="application/json,.json" data-change="import" hidden></label>
    </div>
    <p class="small">Fahrzeiten: © OpenStreetMap-Mitwirkende, OSRM. Wetter: Open-Meteo. Kurse: EZB über Frankfurter.</p>
    <button class="btn small danger" data-act="reset">Reise löschen und neu anfangen</button>
  </details>`;
}
/* ---------- Ausgaben unterwegs & aufteilen ---------- */
const EXP_CATS = { tanken: "⛽ Tanken", essen: "🍽️ Essen", einkauf: "🛒 Einkauf", eintritt: "🎟️ Eintritt", unterkunft: "🏡 Unterkunft", auto: "🚗 Auto", flug: "✈️ Flug", sonst: "🧾 Sonstiges" };
// Mitreisende; beim ersten Mal aus der Zahl der Reisenden angelegt
function people() {
  if (!T.people?.length) {
    const n = Math.max(1, pax().adults + pax().children);
    T.people = Array.from({ length: n }, (_, i) => ({ id: St.newId(), name: i ? `Person ${i + 1}` : "Ich", paypal: "" }));
  }
  return T.people;
}
// Wer hat wie viel bezahlt, wer schuldet wem (in Euro)
function balances() {
  const ps = people(), net = Object.fromEntries(ps.map(p => [p.id, 0]));
  for (const e of T.expenses) {
    const eur = toEur(num(e.amount), e.cur);
    const forIds = (e.for?.length ? e.for : ps.map(p => p.id)).filter(id => id in net);
    if (!e.by || !(e.by in net) || !forIds.length) continue;
    net[e.by] += eur;
    for (const id of forIds) net[id] -= eur / forIds.length;
  }
  // Ausgleich: wer im Minus ist, zahlt an den, der im Plus ist
  const debt = ps.map(p => ({ p, v: net[p.id] })).filter(x => x.v < -0.5).sort((a, b) => a.v - b.v);
  const cred = ps.map(p => ({ p, v: net[p.id] })).filter(x => x.v > 0.5).sort((a, b) => b.v - a.v);
  const pay = [];
  for (const d of debt) for (const c of cred) {
    const amt = Math.min(-d.v, c.v);
    if (amt > 0.5) { pay.push({ from: d.p, to: c.p, amt }); d.v += amt; c.v -= amt; }
  }
  return { net, pay };
}
function expensesSection() {
  const ps = people(), name = id => ps.find(p => p.id === id)?.name || "?";
  const list = [...T.expenses].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const byCat = {};
  for (const e of T.expenses) byCat[e.cat || "sonst"] = (byCat[e.cat || "sonst"] || 0) + toEur(num(e.amount), e.cur);
  const { pay } = balances();
  return `<details class="card more" ${UI.openExp ? "open" : ""}><summary><h2>💳 Ausgaben & Aufteilen</h2><span class="small">${money(Object.values(byCat).reduce((t, v) => t + v, 0))}</span></summary>
    <button class="btn wide" data-act="exp-add">+ Ausgabe eintragen</button>
    ${Object.keys(byCat).length ? `<p class="small">${Object.entries(byCat).map(([k, v]) => `${EXP_CATS[k] || k} ${money(v)}`).join(" · ")}</p>` : ""}
    ${ps.length > 1 ? `<h3 class="sec">Wer schuldet wem?</h3>
      ${pay.length ? `<ul class="plain settle">${pay.map(x => `<li><span><strong>${esc(x.from.name)}</strong> → <strong>${esc(x.to.name)}</strong>: ${money(x.amt)}</span>
        ${x.to.paypal ? `<a class="btn small" href="https://www.paypal.com/paypalme/${encodeURIComponent(x.to.paypal)}/${x.amt.toFixed(2)}EUR" target="_blank" rel="noopener noreferrer">Mit PayPal zahlen</a>` : ""}</li>`).join("")}</ul>`
        : `<p class="small goodtext">Alles ausgeglichen 👍</p>`}` : ""}
    <ul class="explist">${list.map(e => `<li>
      <div><strong>${esc(e.text || EXP_CATS[e.cat] || "Ausgabe")}</strong>
        <span class="small block">${EXP_CATS[e.cat] || ""}${e.date ? ` · ${fmtShort(e.date)}` : ""}${ps.length > 1 && e.by ? ` · bezahlt von ${esc(name(e.by))}${e.for?.length && e.for.length < ps.length ? ` für ${e.for.map(name).map(esc).join(", ")}` : ""}` : ""}</span></div>
      <div class="expamt"><strong>${money(num(e.amount), e.cur || "EUR")}</strong>${e.cur === "CAD" ? `<span class="small block">${money(toEur(num(e.amount), "CAD"))}</span>` : ""}</div>
      <button class="iconbtn sm" data-act="exp-edit" data-id="${e.id}" aria-label="bearbeiten">✎</button></li>`).join("") || `<li class="small">Noch keine Ausgaben.</li>`}</ul>
    <details class="fuelset"><summary class="small">👥 Mitreisende & PayPal</summary>
      <form class="form" data-form="people">
        ${ps.map((p, i) => `<div class="row2"><label>Name<input name="name_${i}" value="${esc(p.name)}" maxlength="24"></label><label>PayPal.Me-Name<input name="pp_${i}" value="${esc(p.paypal || "")}" maxlength="40" placeholder="optional"></label></div>`).join("")}
        <div class="btnrow"><button class="btn small">Speichern</button><button type="button" class="btn small ghost" data-act="person-add">+ Person</button></div>
      </form>
    </details>
  </details>`;
}
function expenseSheet(e) {
  const ps = people(), [a, b] = range(), today = todayIso();
  const during = a && today >= a && today <= b;
  const v = e || { text: "", amount: "", cur: during ? "CAD" : "EUR", cat: "essen", date: today, by: ps[0].id, for: ps.map(p => p.id) };
  openSheet(e ? "Ausgabe bearbeiten" : "Ausgabe eintragen", `
    <form class="form">
      <div class="row2">
        <label>Betrag<input name="amount" inputmode="decimal" value="${numIn(num(v.amount))}" required autofocus></label>
        <label>Währung<select name="cur"><option ${v.cur !== "CAD" ? "selected" : ""}>EUR</option><option ${v.cur === "CAD" ? "selected" : ""}>CAD</option></select></label>
      </div>
      <div class="chips">${Object.entries(EXP_CATS).map(([k, l]) => `<label class="chip radio"><input type="radio" name="cat" value="${k}" ${k === (v.cat || "sonst") ? "checked" : ""}>${l}</label>`).join("")}</div>
      <label>Wofür <span class="small">(optional)</span><input name="text" value="${esc(v.text || "")}" maxlength="60" placeholder="z. B. Abendessen in Banff"></label>
      <label>Datum<input type="date" name="date" value="${v.date || today}"></label>
      ${ps.length > 1 ? `<label>Bezahlt von<select name="by">${ps.map(p => `<option value="${p.id}" ${p.id === v.by ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
      <p class="grouplabel">Für wen?</p>
      <div class="chips">${ps.map(p => `<label class="chip radio"><input type="checkbox" name="for" value="${p.id}" ${!v.for?.length || v.for.includes(p.id) ? "checked" : ""}>${esc(p.name)}</label>`).join("")}</div>` : ""}
      <button class="btn big">Speichern</button>
      ${e ? `<button type="button" class="btn ghost danger wide" data-act="exp-del" data-id="${e.id}">Löschen</button>` : ""}
    </form>`, fd => {
    const amount = num(fd.get("amount"));
    if (amount <= 0) { toast("Bitte einen Betrag eingeben."); return false; }
    const data = { amount, cur: fd.get("cur"), cat: fd.get("cat") || "sonst", text: String(fd.get("text") || "").trim().slice(0, 60),
      date: fd.get("date") || today, by: fd.get("by") || ps[0].id, for: ps.length > 1 ? fd.getAll("for") : [ps[0].id] };
    if (e) Object.assign(e, data); else T.expenses.push({ id: St.newId(), ...data });
    UI.openExp = true;
    commit(); toast("Gespeichert");
  });
}

// Gebucht = steht fest. Geschätzt = Sprit und Eintritte laut Plan.
function budget() {
  const tt = tripTotals();
  const entry = costSum(tt.days.flatMap(d => d.items));
  const parkDays = new Set(tt.days.filter(d => d.items.some(w => w.c === "park")).map(d => d.date)).size;
  const people = pax().adults + pax().children;
  const flights = T.flights.filter(f => f.booked).reduce((t, f) => t + num(f.bookedPrice), 0);
  const lodging = T.lodgings.filter(l => l.status === "gebucht").reduce((t, l) => t + lodgeEur(l), 0);
  const car = T.car?.status === "gebucht" ? toEur(num(T.car.total), T.car.cur) : 0;
  const extra = T.expenses.reduce((t, e) => t + toEur(num(e.amount), e.cur), 0);
  const fuelPaid = T.expenses.filter(e => e.cat === "tanken").reduce((t, e) => t + toEur(num(e.amount), e.cur), 0);
  const entryEur = entry.cad * rate() * people;
  const total = flights + lodging + car + extra;
  const expected = total + tt.fuelEur + entryEur;
  const [a, b] = range();
  const days = a && b ? P.daysBetween(a, b) + 1 : 0;
  return { tt, flights, lodging, car, extra, fuelPaid, total, fuel: tt.fuelEur, entryEur, entry, parkDays, expected,
    perDay: days ? expected / days : 0, perPerson: people > 1 ? expected / people : 0 };
}

/* ---------- Fenster (Formulare) ---------- */
const sheet = $("#sheet");
function openSheet(title, html, onSubmit, mount) {
  $("#sheetTitle").textContent = title;
  $("#sheetBody").innerHTML = html;
  const form = $("#sheetBody form");
  if (form && onSubmit) form.onsubmit = e => { e.preventDefault(); if (onSubmit(new FormData(form), form) !== false) closeSheet(); };
  mount?.($("#sheetBody"));
  if (!sheet.open) sheet.showModal();
}
function closeSheet() { if (sheet.open) sheet.close(); }
$("#sheetClose").onclick = closeSheet;
sheet.addEventListener("click", e => { if (e.target === sheet) closeSheet(); });

// Ortssuche: Natur, Sehenswürdigkeiten und Orte zuerst, Geschäfte und Gebäude (z. B. eine Bar gleichen Namens) nach hinten
const GEO_GOOD = new Set(["natural", "tourism", "leisure", "boundary", "historic", "waterway", "place", "mountain_pass"]);
const GEO_BAD = new Set(["amenity", "shop", "office", "building", "craft", "highway", "railway", "landuse", "man_made"]);
async function geocode(q) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&countrycodes=ca&accept-language=de&q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(res.status);
  return (await res.json()).map(x => {
    const parts = x.display_name.split(", ");
    const where = parts.slice(1).filter(p => !/\d/.test(p) && p !== "Kanada").slice(-3).join(", ");
    const score = (x.importance || 0) + (GEO_GOOD.has(x.category) ? 0.3 : 0) - (GEO_BAD.has(x.category) ? 0.3 : 0);
    return { name: x.name || parts[0], full: x.display_name, where, lat: +x.lat, lng: +x.lon, score };
  }).sort((a, b) => b.score - a.score);
}

// Ort für die Route wählen (aus der Liste oder frei gesucht)
function stopSheet(s) {
  const list = stops();
  const isNew = !s;
  const prev = list.at(-1);
  const from = s?.from || prev?.to || T.start || todayIso();
  const to = s?.to || P.addDays(from, 2);
  const idx = s ? list.indexOf(s) : list.length;
  const isLast = idx === list.length - (isNew ? 0 : 1);
  openSheet(isNew ? "Ort hinzufügen" : s.name, `
    <form class="form">
      <label>Wo übernachtest du?<input name="q" value="${esc(s?.name || "")}" placeholder="z. B. Banff, Jasper, Toronto …" autocomplete="off" required></label>
      <input type="hidden" name="lat" value="${s?.lat ?? ""}"><input type="hidden" name="lng" value="${s?.lng ?? ""}"><input type="hidden" name="baseId" value="${esc(s?.baseId || "")}">
      <div id="placeList" class="placelist"></div>
      <div class="row2">
        <label>Von (Anreise)<input type="date" name="from" value="${from}" required></label>
        <label>Bis (Abreise)<input type="date" name="to" value="${to}" required></label>
      </div>
      ${idx > 0 ? `<label>Anreise mit<select name="mode">${Object.entries(P.MODES).map(([k, v]) => `<option value="${k}" ${k === (s?.mode || "auto") ? "selected" : ""}>${v}</option>`).join("")}</select></label>` : ""}
      <div class="row2">
        <label>Ankunft ca. <span class="small">(optional)</span><input type="time" name="arrive" value="${s?.arrive || ""}"></label>
        ${isLast ? `<label>Abreise ca. <span class="small">(letzter Tag)</span><input type="time" name="depart" value="${s?.depart || ""}"></label>` : ""}
      </div>
      ${isNew ? `<label class="check"><input type="checkbox" name="auto"><span>Typische Sehenswürdigkeiten gleich als Wünsche vormerken</span></label>` : ""}
      <button class="btn big">${isNew ? "Hinzufügen" : "Speichern"}</button>
      ${!isNew ? `<button type="button" class="btn ghost danger wide" data-act="stop-del" data-id="${s.id}">Ort entfernen</button>` : ""}
    </form>`, fd => {
    const lat = parseFloat(fd.get("lat")), lng = parseFloat(fd.get("lng"));
    if (!Number.isFinite(lat)) { toast("Bitte einen Ort aus der Liste antippen."); return false; }
    if (fd.get("to") < fd.get("from")) { toast("„Bis“ liegt vor „Von“."); return false; }
    const data = { name: String(fd.get("q")).trim().slice(0, 60), lat, lng, baseId: fd.get("baseId") || "", from: fd.get("from"), to: fd.get("to"), mode: fd.get("mode") || "auto", arrive: fd.get("arrive") || "", depart: fd.get("depart") || "" };
    if (isNew) {
      const ns = { id: St.newId(), wishes: [], ...data };
      if (fd.get("auto")) {
        // Bis zu so viele Highlights vormerken, wie in die Tage passen könnten
        const n = Math.max(1, P.daysBetween(ns.from, ns.to)) * 2;
        const taken = new Set(stops().flatMap(x => x.wishes.map(w => w.sid)));
        P.suggestNear(ns, [], taken, { maxMin: 75, limit: n, from: ns.from, to: ns.to }).forEach(r => ns.wishes.push({ id: St.newId(), sid: r.x.id, prio: 1, auto: true }));
      }
      T.stops.push(ns);
      UI.stop = ns.id;
      toast(`${ns.name} hinzugefügt`);
    } else Object.assign(s, data);
    commit();
  }, body => {
    const f = body.querySelector("form"), q = f.elements.q, out = body.querySelector("#placeList");
    let t = null;
    const pick = p => { q.value = p.name; f.elements.lat.value = p.lat; f.elements.lng.value = p.lng; f.elements.baseId.value = p.baseId || ""; out.innerHTML = `<p class="small goodtext">✓ ${esc(p.full || p.name)}</p>`; };
    const show = () => {
      const v = q.value.trim().toLowerCase();
      f.elements.lat.value = "";
      const hits = BASES.filter(b => !v || b.name.toLowerCase().includes(v) || b.id.includes(v)).slice(0, v ? 8 : 40);
      out.innerHTML = (v ? "" : `<p class="small">Beliebte Orte – oder tippe einen beliebigen Ort ein:</p>`) + hits.map(b => `<button type="button" class="placebtn" data-base="${b.id}"><strong>${esc(b.name)}</strong><span class="small">${REGIONS[b.region]}</span></button>`).join("")
        + (v.length > 2 ? `<button type="button" class="placebtn web" data-web="1">🔎 „${esc(q.value.trim())}“ auf der Karte suchen</button>` : "");
    };
    out.onclick = async e => {
      const b = e.target.closest("[data-base]"), w = e.target.closest("[data-web]"), r = e.target.closest("[data-geo]");
      if (b) { const x = BASES.find(y => y.id === b.dataset.base); pick({ name: x.name, lat: x.lat, lng: x.lng, baseId: x.id }); }
      if (r) pick(JSON.parse(r.dataset.geo));
      if (w) {
        out.innerHTML = `<p class="small">Suche …</p>`;
        try {
          const res = await geocode(q.value.trim());
          out.innerHTML = res.map(x => `<button type="button" class="placebtn" data-geo="${esc(JSON.stringify(x))}"><strong>${esc(x.name)}</strong><span class="small">${esc(x.full)}</span></button>`).join("") || `<p class="small">Nichts gefunden.</p>`;
        } catch { out.innerHTML = `<p class="small">Suche geht gerade nicht. Bist du online?</p>`; }
      }
    };
    q.oninput = () => { clearTimeout(t); t = setTimeout(show, 120); };
    if (!s) show(); else out.innerHTML = `<p class="small goodtext">✓ ${esc(s.name)}</p>`;
    // Bis-Datum mitziehen, wenn Von geändert wird
    f.elements.from.onchange = () => { const n = P.daysBetween(from, to); f.elements.to.value = P.addDays(f.elements.from.value, Math.max(0, n)); };
  });
}

// Sehenswürdigkeiten zum Ort auswählen
function wishSheet(s) {
  const taken = () => new Set(s.wishes.map(w => w.sid));
  const pool = SIGHTS.map(x => ({ x, t: P.travel(s, x).min })).filter(r => r.t <= 150 || r.x.base === s.baseId).sort((a, b) => a.t - b.t);
  const listHtml = () => {
    const v = UI.addFilter.toLowerCase(), tag = UI.addTag, have = taken();
    const rows = pool.filter(r => (!v || r.x.name.toLowerCase().includes(v)) && (!tag || r.x.tags.includes(tag)));
    return rows.map(r => `<button type="button" class="placebtn ${have.has(r.x.id) ? "on" : ""}" data-sid="${r.x.id}">
      <strong>${have.has(r.x.id) ? "✓ " : "+ "}${esc(r.x.name)}</strong>
      <span class="small">${P.dur(r.t)} · ${String(r.x.dur).replace(".", ",")} h · ${r.x.tags.filter(t => TAGS[t] && t !== "gratis").map(t => TAGS[t].icon).join(" ")}${r.x.r ? " · 🎟️" : ""}</span>
      <span class="small">${costLabel(r.x.c)}</span></button>`).join("")
      || `<p class="small">Nichts in der Nähe gefunden – leg unten einen eigenen Ort an.</p>`;
  };
  openSheet(`Wünsche für ${s.name}`, `
    <input class="search" placeholder="Suchen …" value="${esc(UI.addFilter)}" id="wishQ" aria-label="Sehenswürdigkeiten durchsuchen">
    <div class="chips small-chips">${Object.entries(TAGS).map(([k, t]) => `<button type="button" class="chip" data-tag="${k}" aria-pressed="${UI.addTag === k}">${t.icon} ${t.label}</button>`).join("")}</div>
    <div id="wishList" class="placelist">${listHtml()}</div>
    <h3 class="sec">Eigener Ort</h3>
    <form class="form" id="ownForm">
      <label>Was möchtest du sehen?<input name="q" placeholder="z. B. Restaurant, Aussichtspunkt, Adresse" required></label>
      <div id="ownList" class="placelist"></div>
      <input type="hidden" name="lat"><input type="hidden" name="lng">
      <input type="hidden" name="place">
      <button type="button" class="btn ghost" id="ownSearch">🔎 Suchen</button>
      <div class="row2"><label>Dauer (h)<input name="dur" inputmode="decimal" value="1,5"></label><label>Eintritt (CAD p. P.)<input name="cost" inputmode="decimal" placeholder="? · 0 = kostenlos"></label></div>
      <button class="btn">Hinzufügen</button>
    </form>`, null, body => {
    const list = body.querySelector("#wishList");
    body.querySelector("#wishQ").oninput = e => { UI.addFilter = e.target.value; list.innerHTML = listHtml(); };
    body.querySelector(".chips").onclick = e => {
      const c = e.target.closest("[data-tag]"); if (!c) return;
      UI.addTag = UI.addTag === c.dataset.tag ? "" : c.dataset.tag;
      body.querySelectorAll(".chips .chip").forEach(b => b.setAttribute("aria-pressed", b.dataset.tag === UI.addTag));
      list.innerHTML = listHtml();
    };
    list.onclick = e => {
      const b = e.target.closest("[data-sid]"); if (!b) return;
      const i = s.wishes.findIndex(w => w.sid === b.dataset.sid);
      if (i >= 0) s.wishes.splice(i, 1); else s.wishes.push({ id: St.newId(), sid: b.dataset.sid, prio: 1 });
      commit(false); list.innerHTML = listHtml();
    };
    const f = body.querySelector("#ownForm"), out = body.querySelector("#ownList");
    body.querySelector("#ownSearch").onclick = async () => {
      const q = f.elements.q.value.trim(); if (!q) return;
      out.innerHTML = `<p class="small">Suche …</p>`;
      // Kennt die App den Ort schon, steht er oben (mit Dauer, Kosten und Tipps)
      const known = matchSight(q);
      const knownBtn = known ? `<button type="button" class="placebtn on" data-known="${known.id}"><strong>✓ ${esc(known.name)}</strong><span class="small">bekannte Sehenswürdigkeit · ${costLabel(known.c)}</span></button>` : "";
      try {
        const res = await geocode(q + " " + s.name);
        const res2 = res.length ? res : await geocode(q);
        out.innerHTML = knownBtn + res2.map(x => `<button type="button" class="placebtn" data-geo="${esc(JSON.stringify(x))}"><strong>${esc(x.name)}</strong><span class="small">📍 ${esc(x.where)} · ${P.dur(P.estimate(s, x).min)} entfernt</span></button>`).join("") || `<p class="small">Nichts gefunden.</p>`;
      } catch { out.innerHTML = knownBtn || `<p class="small">Suche geht gerade nicht.</p>`; }
    };
    out.onclick = e => {
      const k = e.target.closest("[data-known]");
      if (k) {
        if (!s.wishes.some(w => w.sid === k.dataset.known)) s.wishes.push({ id: St.newId(), sid: k.dataset.known, prio: 1 });
        commit(); closeSheet(); toast("Hinzugefügt"); return;
      }
      const r = e.target.closest("[data-geo]"); if (!r) return;
      const x = JSON.parse(r.dataset.geo);
      f.elements.lat.value = x.lat; f.elements.lng.value = x.lng; f.elements.place.value = x.where;
      if (!f.elements.q.value.trim()) f.elements.q.value = x.name;
      out.innerHTML = `<p class="small goodtext">✓ ${esc(x.full)}</p>`;
    };
    f.onsubmit = e => {
      e.preventDefault();
      const lat = parseFloat(f.elements.lat.value), lng = parseFloat(f.elements.lng.value);
      if (!Number.isFinite(lat)) { toast("Bitte zuerst suchen und einen Treffer antippen."); return; }
      const cost = f.elements.cost.value.trim();
      s.wishes.push({ id: St.newId(), name: f.elements.q.value.trim().slice(0, 60), lat, lng, place: f.elements.place.value.slice(0, 80), dur: Math.max(0.25, num(f.elements.dur.value) || 1.5), prio: 1, ...(cost !== "" ? { c: num(cost) } : {}) });
      commit(); closeSheet(); toast("Hinzugefügt");
    };
  });
  sheet.addEventListener("close", () => render(), { once: true });
}

function flightSheet(f, preset) {
  const isNew = !f;
  const [a, b] = range();
  const v = f || { from: T.home || "FRA", to: "YVR", date: a || todayIso(), ret: b || "", flex: 0, direct: false, target: "", ...preset };
  const aps = Object.keys(AIRPORTS).concat(Object.keys(HOME_AIRPORTS));
  openSheet(isNew ? "Flug beobachten" : "Flug bearbeiten", `
    <form class="form">
      <datalist id="aps">${aps.map(c => `<option value="${c}">${AIRPORTS[c]?.name || HOME_AIRPORTS[c]}</option>`).join("")}</datalist>
      <div class="row2">
        <label>Von<input name="from" value="${esc(v.from)}" list="aps" maxlength="3" required autocapitalize="characters"></label>
        <label>Nach<input name="to" value="${esc(v.to)}" list="aps" maxlength="3" required autocapitalize="characters"></label>
      </div>
      <div class="row2">
        <label>Hinflug<input type="date" name="date" value="${v.date}" required></label>
        <label>Rückflug <span class="small">(leer = nur hin)</span><input type="date" name="ret" value="${v.ret || ""}"></label>
      </div>
      <div class="row2">
        <label>Rückflug ab <span class="small">(Gabelflug)</span><input name="retFrom" value="${esc(v.retFrom && v.retFrom !== v.to ? v.retFrom : "")}" list="aps" maxlength="3" placeholder="wie Ziel" autocapitalize="characters"></label>
        <label>Flexibel<select name="flex">${[[0, "genaues Datum"], [1, "± 1 Tag"], [3, "± 3 Tage"]].map(([n, l]) => `<option value="${n}" ${n === (v.flex || 0) ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      </div>
      <label class="check"><input type="checkbox" name="direct" ${v.direct ? "checked" : ""}><span>Nur Direktflüge</span></label>
      <label>Zielpreis für alle zusammen (€)<input name="target" inputmode="decimal" value="${numIn(v.target)}" placeholder="z. B. 1600"></label>
      ${f?.booked ? `<label>Bezahlter Preis (€)<input name="bookedPrice" inputmode="decimal" value="${numIn(f.bookedPrice)}"></label>` : ""}
      ${f?.prices.length ? `<p class="small">Preisverlauf: ${f.prices.map(x => `${new Date(x.at).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" })}: ${money(x.p)}`).join(" · ")}</p>
        <button type="button" class="btn small ghost" data-act="flight-undo" data-id="${f.id}">Letzten Preis löschen</button>` : ""}
      <button class="btn big">${isNew ? "Beobachten" : "Speichern"}</button>
      ${!isNew ? `<button type="button" class="btn ghost danger wide" data-act="flight-del" data-id="${f.id}">Nicht mehr beobachten</button>` : ""}
    </form>`, fd => {
    const up = x => String(x || "").trim().toUpperCase().slice(0, 3);
    const data = {
      from: up(fd.get("from")), to: up(fd.get("to")), date: fd.get("date"), ret: fd.get("ret") || "",
      retFrom: up(fd.get("retFrom")) || "", retTo: "", flex: Number(fd.get("flex")) || 0, direct: !!fd.get("direct"), target: num(fd.get("target"))
    };
    if (data.retFrom) data.retTo = data.from;
    if (fd.has("bookedPrice")) data.bookedPrice = num(fd.get("bookedPrice"));
    if (isNew) T.flights.push({ id: St.newId(), prices: [], booked: false, ...(v.airline ? { airline: v.airline } : {}), ...(v.station ? { station: v.station } : {}), ...data });
    else Object.assign(f, data);
    commit();
    toast(isNew ? "Wird beobachtet 🔔" : "Gespeichert");
  });
}

function lodgeSheet(l, stopId, draft) {
  const s = stopById(l?.stopId || stopId);
  const isNew = !l;
  const v = l || { name: "", platform: "Airbnb", url: "", address: "", checkIn: s?.from || "", checkOut: s?.to || "", total: "", cur: "EUR", status: "gebucht", cancelUntil: "", note: "", ...(draft || {}) };
  openSheet(isNew ? `Unterkunft${s ? " in " + s.name : ""}` : v.name, `
    <form class="form">
      <label>Name<input name="name" value="${esc(v.name)}" maxlength="80" required placeholder="z. B. Blockhütte am See"></label>
      <div class="row2">
        <label>Über<select name="platform">${["Airbnb", "Booking.com", "Vrbo", "Expedia", "Hotel direkt", "Camping", "Sonstiges"].map(p => `<option ${p === v.platform ? "selected" : ""}>${p}</option>`).join("")}</select></label>
        <label>Status<select name="status"><option value="gebucht" ${v.status === "gebucht" ? "selected" : ""}>Gebucht</option><option value="merken" ${v.status !== "gebucht" ? "selected" : ""}>Nur gemerkt</option></select></label>
      </div>
      <label>Link zur Buchung/Anzeige<input name="url" type="url" value="${esc(v.url)}" placeholder="https://…"></label>
      <label>Adresse oder Gegend <span class="small">(für die Suche im Umkreis)</span><input name="address" value="${esc(v.address || "")}" maxlength="120" placeholder="z. B. 123 Banff Ave"></label>
      <input type="hidden" name="lat" value="${v.lat ?? ""}"><input type="hidden" name="lng" value="${v.lng ?? ""}">
      <div id="addrList" class="placelist">${v.lat != null ? `<p class="small goodtext">✓ Lage gespeichert</p>` : ""}</div>
      <button type="button" class="btn small ghost" id="addrSearch">📍 Lage suchen</button>
      <div class="row2">
        <label>Check-in<input type="date" name="checkIn" value="${v.checkIn}" required></label>
        <label>Check-out<input type="date" name="checkOut" value="${v.checkOut}" required></label>
      </div>
      <div class="row2">
        <label>Preis gesamt<input name="total" inputmode="decimal" value="${numIn(num(v.total))}" placeholder="inkl. Gebühren"></label>
        <label>Währung<select name="cur"><option ${v.cur !== "CAD" ? "selected" : ""}>EUR</option><option ${v.cur === "CAD" ? "selected" : ""}>CAD</option></select></label>
      </div>
      <label>Kostenlos stornierbar bis<input type="date" name="cancelUntil" value="${v.cancelUntil || ""}"></label>
      ${stops().length > 1 ? `<label>Gehört zu<select name="stopId">${stops().map(x => `<option value="${x.id}" ${x.id === s?.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>` : `<input type="hidden" name="stopId" value="${s?.id || ""}">`}
      <label>Notiz<textarea name="note" rows="2" maxlength="300">${esc(v.note || "")}</textarea></label>
      <button class="btn big">Speichern</button>
      ${!isNew ? `<button type="button" class="btn ghost danger wide" data-act="lodge-del" data-id="${l.id}">Entfernen</button>` : ""}
    </form>`, fd => {
    if (fd.get("checkOut") <= fd.get("checkIn")) { toast("Check-out muss nach dem Check-in sein."); return false; }
    const lat = parseFloat(fd.get("lat")), lng = parseFloat(fd.get("lng"));
    const data = {
      name: String(fd.get("name")).trim().slice(0, 80), platform: fd.get("platform"), status: fd.get("status"),
      url: safeUrl(fd.get("url")), address: String(fd.get("address") || "").trim().slice(0, 120),
      lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null,
      checkIn: fd.get("checkIn"), checkOut: fd.get("checkOut"), total: num(fd.get("total")), cur: fd.get("cur"),
      cancelUntil: fd.get("cancelUntil") || "", stopId: fd.get("stopId") || s?.id || "", note: String(fd.get("note") || "").slice(0, 300)
    };
    if (data.lat == null) { delete data.lat; delete data.lng; }
    if (isNew) T.lodgings.push({ id: St.newId(), offers: [], ...data });
    else Object.assign(l, data);
    commit();
    toast("Gespeichert");
  }, body => {
    const f = body.querySelector("form"), out = body.querySelector("#addrList");
    body.querySelector("#addrSearch").onclick = async () => {
      const q = f.elements.address.value.trim() || f.elements.name.value.trim();
      if (!q) { toast("Adresse eintragen"); return; }
      out.innerHTML = `<p class="small">Suche …</p>`;
      try {
        let res = await geocode(q + (s ? " " + s.name : ""));
        if (!res.length) res = await geocode(q);
        out.innerHTML = res.map(x => `<button type="button" class="placebtn" data-geo="${esc(JSON.stringify(x))}"><strong>${esc(x.name)}</strong><span class="small">${esc(x.full)}</span></button>`).join("") || `<p class="small">Nichts gefunden – dann sucht die App im ganzen Ort.</p>`;
      } catch { out.innerHTML = `<p class="small">Suche geht gerade nicht.</p>`; }
    };
    out.onclick = e => {
      const r = e.target.closest("[data-geo]"); if (!r) return;
      const x = JSON.parse(r.dataset.geo);
      f.elements.lat.value = x.lat; f.elements.lng.value = x.lng;
      out.innerHTML = `<p class="small goodtext">✓ ${esc(x.full)}</p>`;
    };
  });
}

/* ---------- Liste hochladen: Wünsche automatisch dem passenden Ort zuordnen ---------- */
const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const FILL = new Set(["the", "lake", "see", "der", "die", "das", "und", "and", "am", "im", "in", "zum", "zur", "von", "national", "park", "provincial", "np", "trail"]);
const words = s => norm(s).split(" ").filter(x => x.length > 1 && !FILL.has(x));
function splitCsv(line) {
  const out = []; let cur = "", q = false;
  for (const ch of line) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; }
  out.push(cur);
  return out.map(x => x.trim());
}
// Eine Zeile pro Ort; Aufzählungszeichen und Nummern fallen weg. CSV mit Kopfzeile (z. B. Google-Maps-Export) geht auch.
function parseList(text) {
  let lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const head = lines[0] ? splitCsv(lines[0]).map(h => norm(h)) : [];
  const col = head.findIndex(h => ["title", "name", "titel", "ort", "place"].includes(h));
  if (col >= 0 && head.length > 1) lines = lines.slice(1).map(l => splitCsv(l)[col] || "");
  else lines = lines.map(l => /[;\t]/.test(l) ? l.split(/[;\t]/)[0] : l);
  const clean = lines.map(l => l.replace(/^\s*([-*•–]|\d+[.)])\s*/, "").replace(/^"|"$/g, "").trim()).filter(l => l.length > 1);
  return [...new Map(clean.map(l => [norm(l), l])).values()].slice(0, 150);
}
// Bekannte Sehenswürdigkeit finden; bei mehreren Treffern die nächste zur Route
function matchSight(q) {
  const qn = norm(q), qw = words(q);
  let best = null;
  const scoreName = name => {
    const sn = norm(name), sw = words(name);
    if (sn === qn) return 3;
    if (qn.length >= 4 && (sn.includes(qn) || qn.includes(sn))) return 2;
    if (qw.length && sw.length) {
      const r = qw.filter(w => sw.includes(w)).length / qw.length;
      if (r >= 0.5 && qw.some(w => w.length >= 5 && sw.includes(w))) return 1 + r * 0.5;
    }
    return 0;
  };
  for (const x of SIGHTS) {
    const sc = Math.max(...[x.name, ...(x.a || [])].map(scoreName));
    if (!sc) continue;
    const near = Math.min(...stops().map(s => P.km(s, x)));
    if (!best || sc > best.sc || (sc === best.sc && near < best.near)) best = { x, sc, near };
  }
  return best?.x || null;
}
// Wohin passt ein Ort am besten: als Ausflug von einem Ort aus oder als Stopp auf der Fahrt dorthin?
function bestStop(p) {
  const list = stops();
  let best = null;
  list.forEach((s, i) => {
    const t = P.estimate(s, p).min;
    if (!best || 2 * t < best.cost) best = { id: s.id, cost: 2 * t, t, how: "ausflug" };
    if (i > 0 && (s.mode || "auto") === "auto") {
      const a = list[i - 1];
      const det = P.estimate(a, p).min + P.estimate(p, s).min - P.estimate(a, s).min;
      // Nur wenn der Ausflug von einem Standort aus deutlich mehr Fahrt kostet (sonst ist es ein normaler Tagesausflug)
      if (best.cost > 120 && det < best.cost * 0.5 && det < 60) best = { id: s.id, cost: det, t, how: "unterwegs", from: a.name };
    }
  });
  return best;
}
// Selbst angelegte Orte, die eigentlich eine bekannte Sehenswürdigkeit sind (z. B. „The Beehive“, früher von der
// Kartensuche in Vancouver gefunden), in die richtige Sehenswürdigkeit umwandeln und zum passenden Ort verschieben
function repairWishes() {
  if (!T || !stops().length) return [];
  const fixed = [];
  for (const s of stops()) for (const w of [...s.wishes]) {
    if (w.sid || !w.name) continue;
    const n = norm(w.name);
    const x = SIGHTS.find(y => norm(y.name) === n || (y.a || []).some(a => norm(a) === n));
    if (!x) continue;
    s.wishes.splice(s.wishes.indexOf(w), 1);
    const to = stopById(bestStop(x).id) || s;
    if (!to.wishes.some(v => v.sid === x.id)) to.wishes.push({ id: w.id, sid: x.id, prio: w.prio ?? 1, ...(w.dur ? { dur: w.dur } : {}) });
    fixed.push(`${w.name} → ${to.name}`);
  }
  return fixed;
}

function importSheet() {
  if (!stops().length) { toast("Lege zuerst in der Route deine Orte mit Datum an."); return; }
  openSheet("Liste mit Wünschen hochladen", `
    <p class="small">Ein Ort pro Zeile – z. B. aus deinen Notizen kopiert. Die App erkennt bekannte Sehenswürdigkeiten, sucht den Rest auf der Karte
      und ordnet alles dem Ort deiner Route zu, von dem es am wenigsten Fahrzeit kostet (oder plant es auf der Fahrt dorthin ein).</p>
    <form class="form">
      <label>Deine Liste<textarea name="text" rows="8" placeholder="Moraine Lake&#10;Johnston Canyon&#10;Spirit Island&#10;Kayak fahren auf dem Emerald Lake&#10;…"></textarea></label>
      <label class="btn ghost small">📄 Datei wählen (.txt oder .csv)<input type="file" name="file" accept=".txt,.csv,text/plain,text/csv" hidden></label>
      <p class="small" id="fileName"></p>
      <label class="check"><input type="checkbox" name="replace"><span><strong>Bisherige Wünsche ersetzen</strong> – danach stehen im Plan nur die Orte aus dieser Liste</span></label>
      <button class="btn big">Zuordnen</button>
    </form>`, null, body => {
    const f = body.querySelector("form");
    f.elements.file.onchange = async () => {
      const file = f.elements.file.files[0]; if (!file) return;
      f.elements.text.value = await file.text();
      body.querySelector("#fileName").textContent = `✓ ${file.name}`;
    };
    f.onsubmit = e => { e.preventDefault(); resolveList(parseList(f.elements.text.value), f.elements.replace.checked); };
  });
}
async function resolveList(names, replace = false) {
  if (!names.length) { toast("Die Liste ist leer."); return; }
  const body = $("#sheetBody");
  const taken = new Set(stops().flatMap(s => s.wishes.map(w => w.sid).filter(Boolean)));
  const rows = [], missing = [];
  let webCalls = 0;
  for (const [i, name] of names.entries()) {
    body.innerHTML = `<p>Ordne zu … ${i + 1} von ${names.length}</p><p class="small">${esc(name)}</p>`;
    const x = matchSight(name);
    if (x) { rows.push({ name: x.name, given: name, sid: x.id, lat: x.lat, lng: x.lng, dur: x.dur, c: x.c, known: true, dup: taken.has(x.id) }); continue; }
    // Ortssuche erlaubt höchstens eine Anfrage pro Sekunde
    if (webCalls++) await new Promise(r => setTimeout(r, 1100));
    try {
      const alts = (await geocode(name)).slice(0, 5);
      if (alts.length) rows.push({ name, given: name, alts, alt: 0, dur: 1.5 });
      else missing.push(name);
    } catch { missing.push(name); }
  }
  // Gefundenen Treffer übernehmen und den passenden Ort der Route neu bestimmen
  const place = r => {
    if (r.alts) { const a = r.alts[r.alt]; r.lat = a.lat; r.lng = a.lng; r.where = a.where; }
    r.best = bestStop(r); r.stop = r.best.id;
    r.far = Math.min(...stops().map(s => P.km(s, r))) > 150;
  };
  rows.forEach(r => { place(r); r.on = replace || !r.dup; });
  const opts = sel => stops().map(s => `<option value="${s.id}" ${s.id === sel ? "selected" : ""}>${esc(s.name)}</option>`).join("");
  const show = () => {
    body.innerHTML = `
    <p class="small">${plural(rows.length, "Ort", "Orte")} erkannt${missing.length ? `, ${missing.length} nicht gefunden` : ""}. Prüf die Zuordnung und ändere sie bei Bedarf –
      bei Orten aus der Kartensuche steht dabei, wo der Treffer liegt.</p>
    <ul class="importlist">${rows.map((r, i) => `<li>
      <label class="check"><input type="checkbox" data-i="${i}" ${r.on ? "checked" : ""}>
        <span><strong>${esc(r.name)}</strong>
        ${r.known ? `<span class="small block">✓ bekannte Sehenswürdigkeit${costLabel(r.c) ? " · " + costLabel(r.c) : ""}</span>` : `<span class="small block">📍 ${esc(r.where || "Kartensuche")}</span>`}
        <span class="small block">${r.dup ? "schon eingeplant · " : ""}${r.best.how === "unterwegs" ? `auf der Fahrt von ${esc(r.best.from)}` : `≈ ${P.dur(r.best.t)} entfernt`}${r.far || (r.best.t > 180 && r.best.how !== "unterwegs") ? ` · <span class="warntext">⚠️ weit weg von deiner Route – richtiger Ort?</span>` : ""}</span></span></label>
      <div class="importctl">
        ${r.alts && r.alts.length > 1 ? `<select data-alt="${i}" aria-label="Welcher Treffer?">${r.alts.map((a, k) => `<option value="${k}" ${k === r.alt ? "selected" : ""}>${esc(a.name)} – ${esc(a.where)}</option>`).join("")}</select>` : ""}
        <select data-i="${i}" aria-label="Zu welchem Ort?">${opts(r.stop)}</select>
      </div></li>`).join("")}</ul>
    ${missing.length ? `<p class="small warntext">Nicht gefunden: ${missing.map(esc).join(", ")} – füge sie im Tagesplan über „Eigener Ort“ hinzu.</p>` : ""}
    <button class="btn big" id="importGo">Übernehmen</button>`;
    body.querySelector(".importlist").onchange = e => {
      const t = e.target;
      if (t.dataset.alt != null) { const r = rows[t.dataset.alt]; r.alt = Number(t.value); place(r); show(); return; }
      const r = rows[t.dataset.i]; if (!r) return;
      if (t.type === "checkbox") r.on = t.checked; else r.stop = t.value;
    };
    body.querySelector("#importGo").onclick = () => {
      let n = 0;
      // Ersetzen: alle bisherigen Wünsche raus (eingeplante Restaurants bleiben), nur diese Liste zählt
      if (replace) {
        if (!confirm("Alle bisherigen Wünsche an allen Orten durch diese Liste ersetzen?")) return;
        stops().forEach(s => { s.wishes = s.wishes.filter(w => w.meal); });
      }
      for (const r of rows.filter(x => x.on)) {
        const s = stopById(r.stop); if (!s) continue;
        const day = r.best.how === "unterwegs" && r.stop === r.best.id ? s.from : "";
        if (r.sid && s.wishes.some(w => w.sid === r.sid)) continue;
        s.wishes.push(r.sid ? { id: St.newId(), sid: r.sid, prio: 1, day, mine: true } : { id: St.newId(), name: r.name.slice(0, 60), lat: r.lat, lng: r.lng, place: (r.where || "").slice(0, 80), dur: r.dur, prio: 1, day, mine: true });
        n++;
      }
      closeSheet(); commit();
      toast(`${plural(n, "Wunsch", "Wünsche")} eingeplant`);
    };
  };
  show();
}

function offerSheet(l) {
  openSheet("Angebot vergleichen", `
    <p class="small">Du hast etwas Günstigeres gesehen? Trag es ein – die App rechnet den Unterschied aus (gleiche Daten: ${fmtShort(l.checkIn)} – ${fmtShort(l.checkOut)}).</p>
    <form class="form">
      <label>Name<input name="name" maxlength="80" placeholder="z. B. Cabin mit Seeblick"></label>
      <label>Link<input name="url" type="url" placeholder="https://…"></label>
      <div class="row2">
        <label>Preis gesamt<input name="total" inputmode="decimal" required></label>
        <label>Währung<select name="cur"><option>EUR</option><option>CAD</option></select></label>
      </div>
      <button class="btn big">Vergleichen</button>
    </form>`, fd => {
    const o = { id: St.newId(), name: String(fd.get("name") || "").trim().slice(0, 80), url: safeUrl(fd.get("url")), total: num(fd.get("total")), cur: fd.get("cur"), at: Date.now() };
    (l.offers ||= []).push(o);
    commit();
    const diff = lodgeEur(l) - toEur(o.total, o.cur);
    toast(diff > 0 ? `Spart ${money(diff)} 🎉` : "Nicht günstiger – deine Buchung bleibt die beste.");
  });
}

/* ---------- Aktionen ---------- */
// Daten der Orte lückenlos aneinanderreihen (Nächte bleiben gleich)
function chain(fromIdx = 1) {
  const list = stops();
  for (let i = Math.max(1, fromIdx); i < list.length; i++) {
    const n = Math.max(0, P.daysBetween(list[i].from, list[i].to));
    list[i].from = list[i - 1].to;
    list[i].to = P.addDays(list[i].from, n);
  }
}

const ACT = {
  tab(d) { if (d.tab) { UI.tab = d.tab; UI.sub = d.sub || (d.tab === "fluege" ? UI.sub : ""); ls.set("ka.tab", d.tab); render(); } },
  "setup-demo"() { T = demoTrip(); UI.tab = "start"; commit(); toast("Beispielreise geladen – schau dich um!"); },
  sub(d) { UI.sub = d.v; render(); },
  "fly-ap"(d) {
    // Mehrere Abflughäfen an- und abwählen; mindestens einer bleibt
    const f = T.fly ||= {}, list = flyPlan().aps;
    f.aps = list.includes(d.v) ? (list.length > 1 ? list.filter(c => c !== d.v) : list) : [...list, d.v];
    T.home = f.aps[0]; commit();
  },
  async copy(d) {
    try { await navigator.clipboard.writeText(d.text); toast("Kopiert – auf der Seite einfügen"); }
    catch { prompt("Zum Kopieren markieren:", d.text); }
  },
  "car-edit"() { carSheet(); },
  "car-ai"() { aiCarSheet("car"); },
  "day-times-reset"(d) { if (T.dayTimes) { delete T.dayTimes[d.date]; commit(); } },
  "wish-auto-del"() {
    const s = stopById(UI.stop); if (!s) return;
    s.wishes = s.wishes.filter(w => !w.auto);
    commit(); toast("Vorgemerkte Vorschläge entfernt – sie stehen weiter unten bei den Empfehlungen");
  },
  "sug-more"() { UI.sugMore = true; render(); },
  "wish-cost-reset"(d) { const w = findWish(d.id); if (w) { delete w.c; commit(); } },
  "lodge-ai"(d) { aiLodging(d.id); },
  "flight-ai"() { aiFlight(); },
  "price-shot"(d) { const f = T.flights.find(x => x.id === d.id); if (f) aiPrice(f); },
  "sheet-close"() { closeSheet(); },
  "car-offer-ai"() { if (T.car) aiCarSheet("offer"); },
  "car-book"() { if (T.car) { T.car.status = "gebucht"; commit(); toast("Mietwagen gebucht – zählt jetzt zum Budget"); } },
  "car-del"() { if (confirm("Mietwagen entfernen?")) { T.car = null; closeSheet(); commit(); } },
  "car-offer"() { if (T.car) carOfferSheet(); },
  "car-offer-del"(d) { if (T.car) { T.car.offers = (T.car.offers || []).filter(o => o.id !== d.o); commit(); } },
  rest(d, el) { showRestaurants(el); },
  "rest-add"(d) {
    const r = JSON.parse(d.r), s = stops().find(x => x.from <= d.date && (d.date < x.to || x === stops().at(-1))) || stopById(UI.stop);
    if (!s) return;
    s.wishes.push({ id: St.newId(), name: r.name.slice(0, 60), lat: r.lat, lng: r.lng, dur: 1, prio: 1, day: d.date, meal: true });
    commit(); toast(`${r.name} eingeplant`);
  },
  "stop-add"() { stopSheet(null); },
  "list-import"() { importSheet(); },
  "stop-edit"(d) { stopSheet(stopById(d.id)); },
  "stop-del"(d) {
    const s = stopById(d.id);
    if (!s || !confirm(`${s.name} aus der Route entfernen?`)) return;
    T.stops = T.stops.filter(x => x !== s);
    T.lodgings.forEach(l => { if (l.stopId === s.id) l.stopId = ""; });
    closeSheet(); commit();
  },
  "stop-move"(d) {
    const list = T.stops, i = list.findIndex(x => x.id === d.id), j = i + Number(d.dir);
    if (j < 0 || j >= list.length) return;
    const first = list[0].from;
    [list[i], list[j]] = [list[j], list[i]];
    const n0 = P.daysBetween(list[0].from, list[0].to);
    list[0].from = first; list[0].to = P.addDays(first, n0);
    chain(1); commit();
    toast("Reihenfolge geändert, Daten angepasst");
  },
  "tage-stop"(d) { UI.stop = d.id; ls.set("ka.stop", d.id); UI.tab = "tage"; ls.set("ka.tab", "tage"); render(); },
  "wish-add"() { const s = stopById(UI.stop); if (s) wishSheet(s); },
  "wish-prio"(d) { const w = findWish(d.id); if (w) { w.prio = Number(d.v); commit(); } },
  "wish-del"(d) { for (const s of stops()) s.wishes = s.wishes.filter(w => w.id !== d.id); commit(); },
  "sug-add"(d) { const s = stopById(UI.stop); if (s) { s.wishes.push({ id: St.newId(), sid: d.sid, prio: 1 }); commit(); toast(`${P.sight(d.sid).name} eingeplant`); } },
  crit(d) {
    const c = T.criteria, i = c.indexOf(d.tag);
    if (i >= 0) c.splice(i, 1); else c.push(d.tag);
    commit();
  },
  hint(d) {
    const a = JSON.parse(d.h);
    if (a.type === "nights") {
      const s = stopById(UI.stop); if (!s) return;
      s.to = P.addDays(s.to, a.n);
      chain(stops().indexOf(s) + 1);
      if (T.end && stops().at(-1).to > T.end) T.end = stops().at(-1).to;
      commit(); toast(`${s.name}: ${plural(a.n, "Nacht", "Nächte")} länger – folgende Orte verschoben`);
    }
    if (a.type === "move") {
      const w = findWish(a.wid), to = stopById(a.to);
      if (!w || !to) return;
      for (const s of stops()) s.wishes = s.wishes.filter(x => x !== w);
      to.wishes.push(w); commit(); toast(`Nach ${to.name} verschoben`);
    }
    if (a.type === "mode") { const s = stopById(a.stop); if (s) { s.mode = a.mode; commit(); } }
    if (a.type === "along") {
      const s = stopById(a.stop); if (!s) return;
      a.ids.forEach(id => { if (!s.wishes.some(w => w.sid === id)) s.wishes.push({ id: St.newId(), sid: id, prio: 1, day: s.from }); });
      commit(); toast(`Auf der Fahrt nach ${s.name} eingeplant`);
    }
    if (a.type === "order") {
      const first = T.stops[0].from;
      T.stops = a.ids.map(stopById).filter(Boolean);
      const n0 = P.daysBetween(T.stops[0].from, T.stops[0].to);
      T.stops[0].from = first; T.stops[0].to = P.addDays(first, n0);
      chain(1); commit(); toast("Neue Reihenfolge übernommen");
    }
    if (a.type === "chain") { chain(a.from); commit(); toast("Daten angepasst"); }
    if (a.type === "insert") {
      const b = BASES.find(x => x.id === a.base), i = T.stops.findIndex(s => s.id === a.after);
      if (!b || i < 0) return;
      const from = T.stops[i].to;
      T.stops.splice(i + 1, 0, { id: St.newId(), name: b.name, lat: b.lat, lng: b.lng, baseId: b.id, from, to: P.addDays(from, 1), mode: "auto", arrive: "", depart: "", wishes: [] });
      chain(i + 2);
      if (T.end && stops().at(-1).to > T.end) T.end = stops().at(-1).to;
      commit(); toast(`${b.name} eingefügt – die folgenden Orte rücken einen Tag nach hinten`);
    }
  },
  "flight-watch"(d) { flightSheet(null, d.f ? JSON.parse(d.f) : {}); },
  "flight-edit"(d) { flightSheet(T.flights.find(f => f.id === d.id)); },
  "flight-del"(d) { if (!confirm("Diesen Flug nicht mehr beobachten?")) return; T.flights = T.flights.filter(f => f.id !== d.id); closeSheet(); commit(); },
  "flight-undo"(d) { const f = T.flights.find(x => x.id === d.id); if (f) { f.prices.pop(); commit(); closeSheet(); } },
  "flight-booked"(d) {
    const f = T.flights.find(x => x.id === d.id); if (!f) return;
    f.booked = !f.booked;
    if (f.booked && !f.bookedPrice) f.bookedPrice = f.prices.at(-1)?.p || 0;
    commit();
    if (f.booked) toast("Gebucht! Der Preis zählt jetzt zum Budget.");
  },
  "lodge-add"(d) { lodgeSheet(null, d.id); },
  "lodge-edit"(d) { lodgeSheet(T.lodgings.find(l => l.id === d.id)); },
  "lodge-del"(d) { if (!confirm("Unterkunft entfernen?")) return; T.lodgings = T.lodgings.filter(l => l.id !== d.id); closeSheet(); commit(); },
  "lodge-book"(d) { const l = T.lodgings.find(x => x.id === d.id); if (l) lodgeSheet(Object.assign(l, { status: "gebucht" })); },
  "offer-add"(d) { offerSheet(T.lodgings.find(l => l.id === d.id)); },
  "offer-del"(d) { const l = T.lodgings.find(x => x.id === d.id); if (l) { l.offers = l.offers.filter(o => o.id !== d.o); commit(); } },
  "exp-del"(d) { T.expenses = T.expenses.filter(e => e.id !== d.id); UI.openExp = true; closeSheet(); commit(); },
  "exp-add"() { expenseSheet(null); },
  "exp-edit"(d) { const e = T.expenses.find(x => x.id === d.id); if (e) expenseSheet(e); },
  "person-add"() { people().push({ id: St.newId(), name: `Person ${people().length + 1}`, paypal: "" }); UI.openExp = true; commit(); },
  async "sync-new"() {
    try { await St.connect(St.newId(10), T, true); toast("Reisecode erstellt"); render(); }
    catch (e) { console.error(e); toast("Das hat nicht geklappt. Bist du online?"); }
  },
  "sync-join"() {
    openSheet("Reisecode eingeben", `<form class="form"><label>Reisecode vom anderen Gerät<input name="code" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="xxxx-xxxx-xx" required></label>
      <p class="small">Die Reise vom anderen Gerät ersetzt die auf diesem Gerät, wenn sie neuer ist.</p><button class="btn big">Verbinden</button></form>`, fd => {
      joinCode(St.cleanCode(fd.get("code")), true);
    });
  },
  "sync-leave"() { if (confirm("Abgleich trennen? Die Reise bleibt auf diesem Gerät.")) { St.disconnect(); render(); } },
  async "sync-share"() {
    const url = location.origin + location.pathname + "?code=" + St.syncCode();
    try { if (navigator.share) await navigator.share({ title: T.name, text: "Unsere Kanada-Reise", url }); else { await navigator.clipboard.writeText(url); toast("Link kopiert"); } } catch {}
  },
  export() {
    download(`kanada-reise-${todayIso()}.json`, JSON.stringify(T, null, 1), "application/json");
  },
  ics() { download("kanada-tagesplan.ics", buildIcs(), "text/calendar"); },
  reset() {
    if (!confirm("Wirklich die ganze Reise auf diesem Gerät löschen?")) return;
    St.disconnect();
    try { localStorage.removeItem("ka.trip"); } catch {}
    T = null; render();
  }
};
// Eigene Start-/Endzeit für einen Tag (leer = Standardzeit)
function setDayTime(date, key, value) {
  const all = T.dayTimes ||= {}, day = all[date] ||= {};
  if (value) day[key] = value; else delete day[key];
  if (!day.start && !day.end) delete all[date];
  commit();
}
const findWish = id => { for (const s of stops()) { const w = s.wishes.find(x => x.id === id); if (w) return w; } return null; };

async function joinCode(code, fromUser) {
  if (code.length < 10) { toast("Der Reisecode hat 10 Zeichen."); return; }
  try { await St.connect(code, T, false); if (!T) T = St.loadLocal(); if (T) { T = Object.assign(blankTrip(), T); repairAndTell(); } toast("Verbunden ☁"); render(); }
  catch (e) { if (fromUser || e.message === "notfound") toast(e.message === "notfound" ? "Diesen Reisecode gibt es nicht." : "Verbinden hat nicht geklappt. Bist du online?"); }
}

const CHANGE = {
  "leg-mode"(el) { const s = stopById(el.dataset.id); if (s) { s.mode = el.value; commit(); } },
  pace(el) { T.pace = el.value; commit(); },
  dayStart(el) { if (el.value) { T.dayStart = el.value; commit(); } },
  dayEnd(el) { if (el.value) { T.dayEnd = el.value; commit(); } },
  "wish-dur"(el) { const w = findWish(el.dataset.id); if (w) { w.dur = Number(el.value); commit(); } },
  "wish-day"(el) { const w = findWish(el.dataset.id); if (w) { w.day = el.value; commit(); toast(el.value ? `Fest auf ${el.selectedOptions[0].textContent} gelegt` : "Tag wieder automatisch"); } },
  "day-start"(el) { setDayTime(el.dataset.date, "start", el.value); },
  "day-end"(el) { setDayTime(el.dataset.date, "end", el.value); },
  "wish-at"(el) { const w = findWish(el.dataset.id); if (w) { if (el.value) w.at = el.value; else delete w.at; commit(); } },
  "wish-cost"(el) { const w = findWish(el.dataset.id); if (w) { if (el.value.trim() === "") delete w.c; else w.c = num(el.value); commit(); } },
  checkEvery(el) { T.checkEvery = Number(el.value); commit(false); },
  "fuel-l100"(el) { const v = num(el.value); if (v > 0) { (T.fuel ||= {}).l100 = v; commit(); } },
  "fuel-price"(el) { const v = num(el.value); if (v > 0) { (T.fuel ||= {}).price = v; commit(); } },
  "fly-station"(el) { (T.fly ||= {}).station = el.value.trim().slice(0, 40); commit(); },
  "fly-rail"(el) { (T.fly ||= {}).rail = el.checked; commit(); },
  "fly-in"(el) { (T.fly ||= {}).inAp = el.value; commit(); },
  "fly-out"(el) { (T.fly ||= {}).outAp = el.value; commit(); },
  "fly-gabel"(el) { const f = T.fly ||= {}; f.gabel = el.checked; if (el.checked && f.outAp === flyPlan().inAp) delete f.outAp; commit(); },
  maxNight(el) { const s = stopById(el.dataset.id); if (s) { s.maxNight = num(el.value) || 0; commit(); } },
  check(el) { T.checks[el.dataset.id] = el.checked; commit(false); },
  pack(el) { T.packed[el.dataset.k] = el.checked; commit(false); },
  conv(el) { $("#convOut").textContent = money(num(el.value) * rate()); },
  async import(el) {
    const file = el.files[0]; if (!file) return;
    try {
      const t = JSON.parse(await file.text());
      if (!t || !Array.isArray(t.stops)) throw new Error("kein Plan");
      if (!confirm("Diese Datei laden? Die Reise auf diesem Gerät wird ersetzt.")) return;
      T = Object.assign(blankTrip(), t); commit(); toast("Reise geladen");
    } catch { toast("Die Datei ist keine Reise aus dieser App."); }
  }
};
const FORMS = {
  async "fly-place"(fd) {
    const q = String(fd.get("q") || "").trim();
    if (!q) return;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=de,at,ch,nl,lu,be,dk&accept-language=de&q=${encodeURIComponent(q)}`);
      const hit = (await r.json())[0];
      if (!hit) { toast("Ort nicht gefunden"); return; }
      const place = { name: hit.name || q, lat: +hit.lat, lng: +hit.lon };
      (T.fly ||= {}).place = place;
      // Nächsten Flughafen mit Direktflug vorschlagen
      const fp = flyPlan();
      const best = Object.entries(HOME_AP_POS).map(([code, [lat, lng]]) => ({ code, km: P.km(place, { lat, lng }), direct: AIRLINES.some(al => airlineFit(al, code, fp.inAp)?.direct) }))
        .sort((a, b) => (b.direct - a.direct) || a.km - b.km)[0];
      if (best) { T.fly.aps = [best.code]; T.home = best.code; }
      commit(); toast(`${place.name} übernommen – Abflug ab ${HOME_AIRPORTS[T.home]} vorgeschlagen`);
    } catch { toast("Suche geht gerade nicht. Bist du online?"); }
  },
  "flight-price"(fd, form) {
    const f = T.flights.find(x => x.id === form.dataset.id), p = num(fd.get("p"));
    if (!f || p <= 0) return;
    f.prices.push({ at: Date.now(), p });
    commit();
    toast(f.target && p <= f.target ? "🎉 Unter deinem Zielpreis – jetzt zuschlagen!" : f.prices.length > 1 && p < f.prices.at(-2).p ? "Günstiger als letztes Mal 📉" : "Eingetragen");
  },
  people(fd) {
    people().forEach((p, i) => {
      p.name = String(fd.get(`name_${i}`) || p.name).trim().slice(0, 24) || p.name;
      p.paypal = String(fd.get(`pp_${i}`) || "").trim().replace(/^.*paypal\.me\//i, "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
    });
    UI.openExp = true; commit(); toast("Gespeichert");
  },
  settings(fd) {
    Object.assign(T, {
      name: String(fd.get("name") || "Kanada").trim().slice(0, 40), start: fd.get("start"), end: fd.get("end"),
      adults: Math.max(1, Number(fd.get("adults")) || 1), children: Math.max(0, Number(fd.get("children")) || 0),
      home: String(fd.get("home") || "FRA").trim().toUpperCase().slice(0, 3)
    });
    commit(); toast("Gespeichert");
  }
};

document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el.dataset, el); }
});
document.addEventListener("change", e => {
  const el = e.target.closest("[data-change]");
  if (el && CHANGE[el.dataset.change]) CHANGE[el.dataset.change](el);
});
document.addEventListener("input", e => { if (e.target.dataset?.change === "conv") CHANGE.conv(e.target); });
document.addEventListener("submit", e => {
  const f = e.target;
  if (f.id === "setupForm") {
    e.preventDefault();
    const fd = new FormData(f);
    T = blankTrip({ name: String(fd.get("name")).trim().slice(0, 40) || "Kanada", start: fd.get("start"), end: fd.get("end"), adults: Number(fd.get("adults")) || 2, children: Number(fd.get("children")) || 0, home: fd.get("home") });
    commit(); setTimeout(() => stopSheet(null), 200);
    return;
  }
  const fn = FORMS[f.dataset?.form];
  if (fn) { e.preventDefault(); fn(new FormData(f), f); }
});

/* ---------- Karte (Leaflet + OpenStreetMap) ---------- */
let maps = [];
function clearMaps() { maps.forEach(m => m.remove()); maps = []; }
let leafletP = null;
function leaflet() {
  if (window.L) return Promise.resolve(window.L);
  return leafletP ||= new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    css.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="; css.crossOrigin = "";
    document.head.append(css);
    const js = document.createElement("script");
    js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="; js.crossOrigin = "";
    js.onload = () => resolve(window.L);
    js.onerror = () => { leafletP = null; reject(new Error("Karte nicht geladen")); };
    document.head.append(js);
  });
}
async function makeMap(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  let L;
  try { L = await leaflet(); } catch { el.innerHTML = `<p class="small pad">Karte gerade nicht verfügbar (offline?).</p>`; return null; }
  if (!document.body.contains(el)) return null;
  const m = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18, attribution: "© OpenStreetMap", referrerPolicy: "strict-origin-when-cross-origin"
  }).addTo(m);
  maps.push(m);
  return { L, m };
}
const pin = (L, text, color, cls = "") => L.divIcon({ className: "pinwrap", html: `<span class="pin ${cls}" style="background:${color}">${esc(text)}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] });

async function drawRouteMap() {
  const list = stops();
  const r = await makeMap("routeMap");
  if (!r) return;
  const { L, m } = r;
  if (!list.length) { m.setView([56, -96], 3); return; }
  const bounds = [];
  list.forEach((s, i) => {
    L.marker([s.lat, s.lng], { icon: pin(L, i + 1, "var(--accent)") }).addTo(m).bindPopup(`<strong>${esc(s.name)}</strong><br>${fmtShort(s.from)} – ${fmtShort(s.to)}`);
    bounds.push([s.lat, s.lng]);
  });
  m.fitBounds(bounds, { padding: [30, 30], maxZoom: 9 });
  for (const l of P.legs(list)) {
    const style = { color: "#c0392b", weight: 4, opacity: 0.8 };
    if (l.mode !== "auto") { L.polyline([[l.a.lat, l.a.lng], [l.b.lat, l.b.lng]], { ...style, dashArray: "6 8", color: "#1f6f8b" }).addTo(m); continue; }
    const straight = L.polyline([[l.a.lat, l.a.lng], [l.b.lat, l.b.lng]], { ...style, opacity: 0.35, dashArray: "4 6" }).addTo(m);
    P.legGeometry(l.a, l.b).then(line => { if (!maps.includes(m)) return; straight.remove(); L.polyline(line, style).addTo(m); }).catch(() => {});
  }
}
async function drawDayMap() {
  const plan = lastPlan;
  if (!plan) return;
  const r = await makeMap("dayMap");
  if (!r) return;
  const { L, m } = r;
  const bounds = [[plan.base.lat, plan.base.lng]];
  L.marker([plan.base.lat, plan.base.lng], { icon: pin(L, "🏡", "#2c3e50", "home") }).addTo(m).bindPopup("Unterkunft / Ort");
  plan.days.forEach((d, i) => {
    const route = [d.startPt, ...d.items, d.endPt];
    if (d.items.length) {
      const straight = L.polyline(route.map(p => [p.lat, p.lng]), { color: dayColor(i), weight: 3, opacity: 0.4, dashArray: "4 6" }).addTo(m);
      P.pathGeometry(route).then(line => { if (!maps.includes(m)) return; straight.remove(); L.polyline(line, { color: dayColor(i), weight: 4, opacity: 0.85 }).addTo(m); }).catch(() => {});
    }
    d.items.forEach((w, k) => {
      L.marker([w.lat, w.lng], { icon: pin(L, `${i + 1}${String.fromCharCode(97 + k)}`, dayColor(i)) }).addTo(m).bindPopup(`<strong>${esc(w.name)}</strong><br>Tag ${i + 1}`);
      bounds.push([w.lat, w.lng]);
    });
    if (d.kind === "reise") bounds.push([d.startPt.lat, d.startPt.lng]);
  });
  plan.unplaced.forEach(w => { L.marker([w.lat, w.lng], { icon: pin(L, "?", "#999") }).addTo(m).bindPopup(`${esc(w.name)} (passt nicht rein)`); bounds.push([w.lat, w.lng]); });
  if (bounds.length > 1) m.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 }); else m.setView(bounds[0], 10);
}

/* ---------- Wetter (Open-Meteo) ---------- */
// Bis 15 Tage vorher: Vorhersage. Sonst: wie war es letztes Jahr an diesen Tagen?
const wxMem = new Map();
async function weather(s) {
  const key = `${s.lat.toFixed(2)},${s.lng.toFixed(2)},${s.from},${s.to}`;
  if (wxMem.has(key)) return wxMem.get(key);
  const p = (async () => {
    const d0 = daysUntil(s.from), d1 = daysUntil(s.to);
    const daily = "temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset";
    let url, kind, shift = 0;
    if (d1 >= 0 && d0 <= 14) {
      const from = d0 < 0 ? todayIso() : s.from, to = d1 > 15 ? P.addDays(todayIso(), 15) : s.to;
      url = `https://api.open-meteo.com/v1/forecast?latitude=${s.lat}&longitude=${s.lng}&daily=${daily}&timezone=auto&start_date=${from}&end_date=${to}`;
      kind = "vorhersage";
    } else {
      // Gleiche Tage im Vorjahr (bzw. so weit zurück, dass sie sicher vorbei sind)
      shift = Math.max(1, Math.ceil((new Date(s.to) - new Date()) / (365 * 864e5)) + (d1 >= -7 ? 1 : 0));
      if (d1 < -7) shift = 0;
      const y = iso => (Number(iso.slice(0, 4)) - shift) + iso.slice(4);
      url = `https://archive-api.open-meteo.com/v1/archive?latitude=${s.lat}&longitude=${s.lng}&daily=${daily}&timezone=auto&start_date=${y(s.from)}&end_date=${y(s.to)}`;
      kind = "vorjahr";
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const j = await res.json();
    const days = {};
    j.daily.time.forEach((t, i) => {
      const date = shift ? (Number(t.slice(0, 4)) + shift) + t.slice(4) : t;
      days[date] = { max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i], rain: j.daily.precipitation_sum[i], rise: j.daily.sunrise[i]?.slice(11), set: j.daily.sunset[i]?.slice(11) };
    });
    return { kind, days };
  })();
  wxMem.set(key, p);
  p.catch(() => wxMem.delete(key));
  return p;
}
const wxLine = (x, kind) => x ? `${x.rain > 2 ? "🌧️" : x.max > 22 ? "☀️" : "⛅"} ${Math.round(x.min)}–${Math.round(x.max)} °C${x.rain >= 1 ? ` · ${Math.round(x.rain)} mm Regen` : ""} · Sonne ${x.rise}–${x.set}${kind === "vorjahr" ? " · so war es letztes Jahr" : ""}` : "";
async function fillWeatherDays() {
  const s = stopById(UI.stop); if (!s) return;
  try {
    const w = await weather(s);
    document.querySelectorAll("[data-wx]").forEach(el => {
      const x = w.days[el.dataset.wx];
      el.textContent = wxLine(x, w.kind);
      // Draußen unterwegs, wenn es dunkel wird?
      if (x?.set && el.dataset.out && Number(el.dataset.out) > P.toMin(x.set) - 20) {
        const warn = document.createElement("span");
        warn.className = "warntext block";
        warn.textContent = `🔦 ${el.dataset.outname} endet erst um ${P.hhmm(Number(el.dataset.out))}, Sonnenuntergang ca. ${x.set} – Stirnlampe mitnehmen oder früher starten.`;
        el.append(warn);
      }
    });
  } catch {}
}
async function fillWeatherStart() {
  const t = todayIso(), s = stops().find(x => x.to > t);
  const el = $("#wxStart"); if (!s || !el) return;
  try {
    const w = await weather(s);
    const vals = Object.values(w.days);
    if (!vals.length || !document.body.contains(el)) return;
    const min = Math.min(...vals.map(v => v.min)), max = Math.max(...vals.map(v => v.max)), rainy = vals.filter(v => v.rain >= 2).length;
    el.innerHTML = `<section class="card"><h2>Wetter in ${esc(s.name)}</h2><p>${Math.round(min)} bis ${Math.round(max)} °C${rainy ? `, ${plural(rainy, "Regentag", "Regentage")}` : ", kaum Regen"}</p>
      <p class="small">${w.kind === "vorhersage" ? "Vorhersage" : "So war das Wetter dort letztes Jahr zur gleichen Zeit"} · ${fmtShort(s.from)} – ${fmtShort(s.to)}</p></section>`;
  } catch {}
}

/* ---------- Wechselkurs ---------- */
(async () => {
  const r = JSON.parse(ls.get("ka.rate") || "null");
  if (r && Date.now() - r.at < 864e5) return;
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=CAD&symbols=EUR");
    const j = await res.json();
    if (j.rates?.EUR) ls.set("ka.rate", JSON.stringify({ cadEur: j.rates.EUR, at: Date.now() }));
  } catch {}
})();

/* ---------- Kalender & Datei ---------- */
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function buildIcs() {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kanada-Reiseplaner//DE", "CALSCALE:GREGORIAN"];
  const icsText = s => String(s).replace(/[\\,;]/g, m => "\\" + m).replace(/\n/g, "\\n");
  const dt = (iso, min) => { min = Math.min(1439, Math.round(min)); return iso.replace(/-/g, "") + "T" + String(Math.floor(min / 60)).padStart(2, "0") + String(min % 60).padStart(2, "0") + "00"; };
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  for (const s of stops()) {
    lines.push("BEGIN:VEVENT", `UID:${s.id}@kanada-planer`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${s.from.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${s.to.replace(/-/g, "")}`, `SUMMARY:${icsText("🍁 " + s.name)}`, "TRANSP:TRANSPARENT", "END:VEVENT");
    const plan = planFor(s);
    plan.days.forEach(d => d.steps.filter(x => x.type === "besuch").forEach((x, k) => {
      lines.push("BEGIN:VEVENT", `UID:${s.id}-${d.date}-${k}@kanada-planer`, `DTSTAMP:${stamp}`, `DTSTART:${dt(d.date, x.start)}`, `DTEND:${dt(d.date, x.start + x.min)}`,
        `SUMMARY:${icsText(x.w.name)}`, `GEO:${x.w.lat};${x.w.lng}`, `DESCRIPTION:${icsText([x.w.res, x.w.tip, mapsPlace(x.w)].filter(Boolean).join("\n"))}`, "END:VEVENT");
    }));
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/* ---------- Beispielreise ---------- */
function demoTrip() {
  // Im nächsten Sommer, Anfang Juli: dann sind alle Wege und Shuttles offen
  const now = new Date(), year = now.getFullYear() + (now.getMonth() >= 5 ? 1 : 0);
  const start = `${year}-07-04`;
  const st = (baseId, from, n, sids, extra = {}) => {
    const b = BASES.find(x => x.id === baseId);
    return { id: St.newId(), name: b.name, lat: b.lat, lng: b.lng, baseId, from: P.addDays(start, from), to: P.addDays(start, from + n), mode: "auto", arrive: "", depart: "", wishes: sids.map(([sid, prio]) => ({ id: St.newId(), sid, prio })), ...extra };
  };
  const list = [
    st("vancouver", 0, 3, [["stanley", 2], ["granville", 1], ["lynn", 1], ["gastown", 0], ["englishbay", 1]], { arrive: "15:00" }),
    st("whistler", 3, 2, [["seatosky", 1], ["shannon", 1], ["joffre", 2], ["brandywine", 1]]),
    st("wellsgray", 5, 1, [["helmcken", 2], ["dawsonfalls", 1]]),
    st("jasper", 6, 3, [["maligne", 1], ["spirit", 2], ["medicine", 1], ["pyramid", 1], ["athabasca", 1]]),
    st("lakelouise", 9, 2, [["icefield", 2], ["peyto", 1], ["moraine", 2], ["lakelouise", 2], ["agnes", 1]]),
    st("banff", 11, 3, [["johnston", 1], ["banffgondola", 0], ["minnewanka", 1], ["vermilion", 1], ["upperhot", 0]]),
    st("calgary", 14, 1, [["princes", 0]], { depart: "13:00" })
  ];
  const end = list.at(-1).to;
  const banff = list[5];
  const day = 864e5;
  return blankTrip({
    name: "Westkanada (Beispiel)", start, end, criteria: ["natur", "aussicht", "ruhe"], stops: list,
    flights: [{ id: St.newId(), from: "FRA", to: "YVR", date: start, ret: end, retFrom: "YYC", retTo: "FRA", flex: 0, direct: true, target: 1800, booked: false,
      prices: [{ at: Date.now() - 9 * day, p: 2140 }, { at: Date.now() - 6 * day, p: 2060 }, { at: Date.now() - 4 * day, p: 1985 }] }],
    lodgings: [
      { id: St.newId(), stopId: banff.id, name: "Tunnel Mountain Chalet", platform: "Booking.com", url: "", address: "Tunnel Mountain Rd, Banff", lat: 51.1890, lng: -115.5480, checkIn: banff.from, checkOut: banff.to, total: 1290, cur: "EUR", status: "gebucht", cancelUntil: P.addDays(banff.from, -14), note: "Frühstück inklusive",
        offers: [{ id: St.newId(), name: "Cabin am Bow River (Airbnb)", url: "", total: 1135, cur: "EUR", at: Date.now() - day }] },
      { id: St.newId(), stopId: list[3].id, name: "Blockhütte am Pyramid Lake", platform: "Airbnb", url: "", checkIn: list[3].from, checkOut: list[3].to, total: 980, cur: "EUR", status: "merken", offers: [] }
    ],
    expenses: [{ id: St.newId(), text: "Parks Canada Discovery Pass", amount: 151, cur: "CAD" }],
    car: { provider: "Avis", via: "billiger-mietwagen.de", status: "gebucht", cls: "SUV (Toyota RAV4)", url: "", pickPlace: "Flughafen Vancouver (YVR)", pickDate: start, pickTime: "16:00",
      dropPlace: "Flughafen Calgary (YYC)", dropDate: end, dropTime: "10:00", total: 1450, cur: "EUR", deductible: 0, cancelUntil: P.addDays(start, -3), note: "",
      ins: { cdw: true, sb0: true, sli: true, tp: true, glass: false, km: true, driver: true, oneway: true },
      offers: [{ id: St.newId(), name: "Sunny Cars – SUV", url: "", total: 1390, cur: "EUR", ins: { cdw: true, sb0: true, sli: true, tp: true, glass: true, km: true, driver: true, oneway: true }, at: Date.now() }] },
    fly: { place: { name: "Köln", lat: 50.9384, lng: 6.9599 }, rail: true },
    checks: { pass: true }
  });
}

/* ---------- Start ---------- */
function repairAndTell() {
  const fixed = repairWishes();
  if (fixed.length) { St.save(T); setTimeout(() => toast(`Korrigiert: ${fixed.join(", ")}`), 600); }
}
St.onSync(receiveRemote, mode => { $("#syncBadge").hidden = mode !== "sync"; $("#syncBadge").classList.toggle("err", mode === "fehler"); });
document.querySelectorAll(".nav button").forEach(b => b.onclick = () => ACT.tab({ tab: b.dataset.tab }));
// Mit Reisecode erst nach dem Abgleich reparieren, sonst würde der lokale Stand den neueren vom anderen Gerät überschreiben
if (T) { T = Object.assign(blankTrip(), T); if (!St.canSync || !St.savedCode()) repairAndTell(); }
render();
if (St.canSync) {
  const fromLink = St.cleanCode(new URLSearchParams(location.search).get("code"));
  if (fromLink) { try { history.replaceState(null, "", location.pathname); } catch {} }
  const code = fromLink || St.savedCode();
  if (code) joinCode(code, !!fromLink);
}
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
