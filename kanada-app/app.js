import { BASES, SIGHTS, TAGS, REGIONS, AIRPORTS, HOME_AIRPORTS, CHECKLIST, PACKLIST, TIPS } from "./data.js";
import * as P from "./plan.js";
import * as St from "./store.js";
import { flightLinks, lodgingLinks, mapsPlace, mapsRoute, GOOGLE_ALERT_HELP } from "./links.js";

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
const num = v => { const n = parseFloat(String(v ?? "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
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
  St.save(T);
  if (rerender) render();
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
function ctxFor(stop) {
  const list = stops(), i = list.indexOf(stop);
  const prev = list[i - 1], next = list[i + 1];
  return {
    prev: prev ? { lat: prev.lat, lng: prev.lng, name: prev.name } : null,
    prevMode: stop.mode || "auto", next,
    pace: T.pace, dayStart: T.dayStart, dayEnd: T.dayEnd,
    others: list.filter(s => s !== stop).map(s => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng }))
  };
}
function planFor(stop) {
  const ctx = ctxFor(stop);
  const pts = [stop, ctx.prev, ...stop.wishes.map(P.wishPoint)].filter(Boolean);
  P.prefetch(pts);
  return P.planStop(stop, ctx);
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
  tage() { drawDayMap(); fillWeatherDays(); }
};

/* ---------- Start ---------- */
function viewStart() {
  if (!T) return viewSetup();
  const [a, b] = range();
  const L = P.legs(stops());
  const driveKm = L.filter(l => l.mode === "auto").reduce((t, l) => t + l.km, 0);
  const nights = a && b ? P.daysBetween(a, b) : 0;
  let hero = "";
  if (a) {
    const d = daysUntil(a), e = daysUntil(b);
    hero = d > 0 ? `<p class="countdown"><strong>${d}</strong> ${d === 1 ? "Tag" : "Tage"} bis Kanada 🍁</p>`
      : e >= 0 ? `<p class="countdown">Tag <strong>${1 - d}</strong> von ${nights + 1} – gute Reise! 🍁</p>`
      : `<p class="countdown">Willkommen zurück! 🍁</p>`;
  }
  const alerts = collectAlerts();
  return `
  <section class="hero">
    ${hero}
    <p class="small">${a ? `${fmtD(a)} – ${fmtD(b)} · ${plural(nights, "Nacht", "Nächte")}` : "Noch kein Reisedatum"} · ${plural(pax().adults, "Erwachsener", "Erwachsene")}${pax().children ? ` · ${plural(pax().children, "Kind", "Kinder")}` : ""}</p>
    <div class="stats">
      <div><strong>${stops().length}</strong><span>Orte</span></div>
      <div><strong>${Math.round(driveKm).toLocaleString("de-DE")}</strong><span>km Auto</span></div>
      <div><strong>${stops().reduce((t, s) => t + s.wishes.length, 0)}</strong><span>Wünsche</span></div>
    </div>
  </section>
  ${todayCard()}
  ${alerts.length ? `<h2 class="sec">Wichtig gerade</h2><div class="alerts">${alerts.map(x => `
    <button class="alert ${x.tone || ""}" data-act="${x.act || "tab"}" data-tab="${x.tab || ""}" data-id="${esc(x.id || "")}">
      <span class="ai">${x.icon}</span><span>${x.html}</span><span class="chev">›</span></button>`).join("")}</div>` : ""}
  ${!stops().length ? `<div class="card empty"><p><strong>Los geht's:</strong> Lege fest, wann du wo bist. Die App rechnet dann Fahrzeiten, plant die Tage und schlägt dir schöne Orte vor.</p>
    <button class="btn" data-act="stop-add">+ Ersten Ort hinzufügen</button></div>` : ""}
  <div class="quick">
    <button data-act="tab" data-tab="route"><span>🗺️</span>Route</button>
    <button data-act="tab" data-tab="tage"><span>🗓️</span>Tagesplan</button>
    <button data-act="tab" data-tab="fluege"><span>✈️</span>Flüge</button>
    <button data-act="tab" data-tab="unterkunft"><span>🏡</span>Unterkünfte</button>
  </div>
  <div id="wxStart"></div>
  ${budgetMini()}`;
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

function budgetMini() {
  const b = budget();
  if (!b.total) return "";
  return `<section class="card"><h2>Budget</h2><p class="big">${money(b.total)}</p><p class="small">${b.perDay ? `≈ ${money(b.perDay)} pro Tag` : ""}${b.perPerson ? ` · ${money(b.perPerson)} pro Person` : ""}</p></section>`;
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
  const sug = P.suggestNear(s, T.criteria, allPlanned, { maxMin: 110, limit: 8, from: s.from, to: s.to });
  const dayOpts = plan.days.map((d, i) => `<option value="${d.date}">Tag ${i + 1} (${fmtShort(d.date)})</option>`).join("");

  return `
  <div class="stopchips" role="tablist">${list.map((x, i) => `<button role="tab" aria-selected="${x === s}" data-act="tage-stop" data-id="${x.id}">${i + 1}. ${esc(x.name)}</button>`).join("")}</div>
  <section class="card">
    <div class="sechead"><h2>${esc(s.name)}</h2><button class="linkbtn" data-act="stop-edit" data-id="${s.id}">Daten ändern</button></div>
    <p class="small">${fmtD(s.from)} – ${fmtD(s.to)} · ${plan.nights ? plural(plan.nights, "Nacht", "Nächte") : "Durchreise"}</p>
    <div class="pace">
      <label>Tempo<select data-change="pace">${Object.entries(P.PACE).map(([k, v]) => `<option value="${k}" ${k === T.pace ? "selected" : ""}>${v.label}</option>`).join("")}</select></label>
      <label>Los um<input type="time" data-change="dayStart" value="${T.dayStart}"></label>
      <label>Zurück bis<input type="time" data-change="dayEnd" value="${T.dayEnd}"></label>
    </div>
  </section>

  <h2 class="sec">Das möchte ich sehen/machen</h2>
  <ul class="wishes">
    ${s.wishes.map(w => wishRow(s, w, dayOpts)).join("") || `<li class="small pad">Noch nichts ausgewählt. Füge Orte hinzu – oder schau unten in die Vorschläge.</li>`}
  </ul>
  <button class="btn wide" data-act="wish-add">+ Sehenswürdigkeit oder eigenen Ort hinzufügen</button>
  <button class="btn ghost wide" data-act="list-import">📋 Ganze Liste hochladen und automatisch zuordnen</button>

  ${plan.hints.length ? `<h2 class="sec">Tipps & Verbesserungen</h2>${hintList(plan.hints)}` : ""}

  <h2 class="sec">Dein Plan</h2>
  <div class="split">
    <div class="mapwrap"><div id="dayMap" class="map" role="img" aria-label="Karte der Tagesrouten"></div></div>
    <div class="days">${plan.days.map((d, i) => dayCard(s, d, i)).join("")}</div>
  </div>
  ${plan.unplaced.length ? `<div class="card warnbox"><strong>Passt nicht mehr rein:</strong> ${plan.unplaced.map(w => esc(w.name)).join(", ")}</div>` : ""}

  <h2 class="sec">Vorschläge in der Nähe</h2>
  <p class="small">Wonach suchst du? Die Vorschläge richten sich danach.</p>
  <div class="chips">${Object.entries(TAGS).map(([k, t]) => `<button class="chip" aria-pressed="${T.criteria.includes(k)}" data-act="crit" data-tag="${k}">${t.icon} ${t.label}</button>`).join("")}</div>
  <div class="sugs">${sug.map(r => sugCard(r, plan)).join("") || `<p class="small">Hier in der Nähe kennt die App nichts Passendes mehr. Probier andere Vorlieben.</p>`}</div>`;
}
function wishRow(s, w, dayOpts) {
  const p = P.wishPoint(w);
  if (!p) return "";
  return `<li class="wish">
    <div class="wishmain"><strong>${esc(p.name)}</strong>
      <span class="small">${p.res ? "🎟️ " : ""}${p.when === "früh" ? "🌅 " : p.when === "abends" ? "🌇 " : ""}${P.dur(P.travel(s, p).min)} von der Unterkunft</span></div>
    <div class="wishctl">
      <div class="seg" role="group" aria-label="Wie wichtig?">
        ${[[2, "Muss"], [1, "Gern"], [0, "Optional"]].map(([v, l]) => `<button aria-pressed="${p.prio === v}" data-act="wish-prio" data-id="${w.id}" data-v="${v}">${l}</button>`).join("")}
      </div>
      <select data-change="wish-dur" data-id="${w.id}" aria-label="Dauer vor Ort">
        ${[0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8].concat([p.dur]).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b).map(v => `<option value="${v}" ${v === p.dur ? "selected" : ""}>${v < 1 ? v * 60 + " min" : String(v).replace(".", ",") + " h"}</option>`).join("")}
      </select>
      <select data-change="wish-day" data-id="${w.id}" aria-label="An welchem Tag?"><option value="">Tag: automatisch</option>${dayOpts.replace(`value="${w.day}"`, `value="${w.day}" selected`)}</select>
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
    if (x.type === "pause") rows.push(`<li class="st lunch"><span class="time">${P.hhmm(x.start)}</span><span>🍽️ Mittagspause</span></li>`);
    if (x.type === "besuch") rows.push(`<li class="st visit"><span class="time">${P.hhmm(x.start)}</span><span><a href="${mapsPlace(x.w)}" target="_blank" rel="noopener"><strong>${esc(x.w.name)}</strong></a>
      <span class="small">bis ${P.hhmm(x.start + x.min)}${x.w.res ? " · 🎟️ reservieren" : ""}${x.w.tip ? ` · ${esc(x.w.tip)}` : ""}</span></span></li>`);
  }
  rows.push(`<li class="st end"><span class="time">${P.hhmm(d.finish)}</span><span>🏡 ${d.kind === "abreise" && !d.items.length ? "Abreise" : "Zurück in der Unterkunft"}${d.free >= 30 ? ` · noch ${P.dur(d.free)} frei` : ""}</span></li>`);
  return `<article class="day" style="--c:${dayColor(i)}">
    <header><h3>Tag ${i + 1} · ${fmtD(d.date)}</h3>${label ? `<span class="tag">${label}</span>` : ""}</header>
    <p class="wx small" data-wx="${d.date}"></p>
    ${d.items.length ? `<ol class="timeline">${rows.join("")}</ol>
      <a class="small" href="${esc(mapsRoute(pts))}" target="_blank" rel="noopener">Route in Google Maps ↗</a>` : `<p class="small">${d.kind === "abreise" ? "Abreisetag." : "Noch frei – Zeit zum Treibenlassen oder für einen Vorschlag unten."}</p>`}
  </article>`;
}
function sugCard(r, plan) {
  const x = r.x, need = x.dur * 60 * plan.pace.buf + 2 * r.t;
  const fit = plan.days.findIndex(d => d.free >= need && d.kind !== "abreise");
  return `<article class="sug">
    <div><strong>${esc(x.name)}</strong>
      <p class="small">${P.dur(r.t)} entfernt · ${String(x.dur).replace(".", ",")} h vor Ort${fit >= 0 ? ` · passt an Tag ${fit + 1}` : ""}${r.offSeason ? " · nicht die beste Jahreszeit" : ""}</p>
      <p class="small">${P.matchLabels(x, T.criteria).join(" · ")}</p>
      ${x.t ? `<p class="small tip">${esc(x.t)}</p>` : ""}</div>
    <button class="btn small" data-act="sug-add" data-sid="${x.id}">+ Dazu</button>
  </article>`;
}
const DAY_COLORS = ["#c0392b", "#1f6f8b", "#7a8b1f", "#8e44ad", "#d35400", "#16a085", "#2c3e50", "#b7950b"];
const dayColor = i => DAY_COLORS[i % DAY_COLORS.length];

/* ---------- Flüge ---------- */
function viewFlights() {
  const list = stops(), [a, b] = range();
  const home = T.home || "FRA";
  const sugg = [];
  if (list.length && a) {
    const inAp = P.nearestAirport(list[0]).code, outAp = P.nearestAirport(list.at(-1)).code;
    if (inAp === outAp) sugg.push({ title: `Hin & zurück ${home} ⇄ ${inAp}`, f: { from: home, to: inAp, date: a, ret: b } });
    else {
      sugg.push({ title: `Gabelflug: rein in ${AIRPORTS[inAp].name}, raus aus ${AIRPORTS[outAp].name}`, note: `Du fliegst nach ${AIRPORTS[inAp].name} und von ${AIRPORTS[outAp].name} zurück und sparst dir die lange Rückfahrt. Die Einweggebühr beim Mietwagen ist meist günstiger als zwei verlorene Urlaubstage.`, f: { from: home, to: inAp, date: a, ret: b, retFrom: outAp, retTo: home } });
      sugg.push({ title: `Nur Hinflug ${home} → ${inAp}`, f: { from: home, to: inAp, date: a } });
      sugg.push({ title: `Nur Rückflug ${outAp} → ${home}`, f: { from: outAp, to: home, date: b } });
    }
    P.legs(list).filter(l => l.mode === "flug").forEach(l => {
      const x = P.nearestAirport(l.a).code, y = P.nearestAirport(l.b).code;
      if (x !== y) sugg.push({ title: `Inlandsflug ${AIRPORTS[x].name} → ${AIRPORTS[y].name}`, f: { from: x, to: y, date: l.b.from } });
    });
  } else if (a) sugg.push({ title: `Hin & zurück ${home} ⇄ YVR`, f: { from: home, to: "YVR", date: a, ret: b } });

  return `
  <section class="card info">
    <h2>So funktioniert der Preiswächter</h2>
    <p>Fluggesellschaften und Vergleichsportale geben ihre Preise nicht frei heraus, deshalb öffnet die App die fertig ausgefüllte Suche. Den gefundenen Preis trägst du mit zwei Tipps ein – die App merkt sich den Verlauf, erinnert dich alle <select data-change="checkEvery" class="inline">${[1, 2, 3, 5, 7].map(n => `<option value="${n}" ${n === (T.checkEvery || 3) ? "selected" : ""}>${n}</option>`).join("")}</select> Tage ans Nachsehen und schlägt Alarm, sobald dein Zielpreis erreicht ist.</p>
    <p class="small">Tipp: Bei <strong>Google Flights</strong> „Preise beobachten“ einschalten – dann kommt zusätzlich automatisch eine E-Mail, wenn der Preis fällt. <a href="${GOOGLE_ALERT_HELP}" target="_blank" rel="noopener">So geht's ↗</a></p>
  </section>

  <h2 class="sec">Passende Flugsuchen</h2>
  ${sugg.map((x, i) => `<article class="card flight">
    <h3>${esc(x.title)}</h3>
    <p class="small">${fmtD(x.f.date)}${x.f.ret ? ` – ${fmtD(x.f.ret)}` : ""} · ${pax().adults + pax().children} ${pax().adults + pax().children === 1 ? "Person" : "Personen"}</p>
    ${x.note ? `<p class="small">${esc(x.note)}</p>` : ""}
    ${linkBtns(flightLinks(x.f, pax()))}
    <button class="btn small ghost" data-act="flight-watch" data-f="${esc(JSON.stringify(x.f))}">🔔 Preis beobachten</button>
  </article>`).join("") || `<p class="small">Lege zuerst deine Reisedaten fest.</p>`}
  <button class="btn ghost wide" data-act="flight-watch">+ Eigene Flugsuche beobachten</button>

  <h2 class="sec">Preiswächter</h2>
  ${T.flights.map(flightCard).join("") || `<p class="small pad">Noch keine Flüge unter Beobachtung.</p>`}

  <section class="card">
    <h2>Gut zu wissen</h2>
    <ul class="plain small">
      <li>Für Juli/August am besten 4–8 Monate vorher buchen, für Juni/September reicht oft weniger.</li>
      <li>Direktflüge nach Kanada gibt es vor allem ab Frankfurt und München (z. B. nach Vancouver, Calgary, Toronto, Montréal, Halifax) – im Sommer auch von anderen Flughäfen.</li>
      <li>Dienstag- und Mittwochflüge sind oft günstiger. Mit „± 3 Tage“ in der Suche siehst du das sofort.</li>
      <li>Ein Gabelflug kostet meist kaum mehr als hin und zurück, spart aber einen ganzen Fahrtag.</li>
    </ul>
  </section>`;
}
function flightCard(f) {
  const last = f.prices.at(-1), min = f.prices.length ? Math.min(...f.prices.map(x => x.p)) : 0;
  const status = f.booked ? `<span class="tag good">Gebucht${f.bookedPrice ? " · " + money(f.bookedPrice) : ""}</span>`
    : !last ? `<span class="tag">Noch kein Preis</span>`
    : f.target && last.p <= f.target ? `<span class="tag good">🎉 Unter Zielpreis!</span>`
    : f.target ? `<span class="tag">noch ${money(last.p - f.target)} drüber</span>` : "";
  const due = !f.booked && (!last || Date.now() - last.at > (T.checkEvery || 3) * 864e5);
  return `<article class="card watch ${due ? "due" : ""}">
    <div class="sechead"><h3>${esc(f.from)} → ${esc(f.to)}${f.retFrom && f.retFrom !== f.to ? ` · ${esc(f.retFrom)} → ${esc(f.retTo || f.from)}` : f.ret ? " · zurück" : ""}</h3>${status}</div>
    <p class="small">${fmtD(f.date)}${f.ret ? ` – ${fmtD(f.ret)}` : ""}${f.flex ? ` · ± ${f.flex} Tage` : ""}${f.direct ? " · nur direkt" : ""}${f.target ? ` · Ziel: ${money(f.target)}` : ""}</p>
    ${f.prices.length ? `<div class="pricerow"><div><span class="small">Zuletzt (${ago(last.at)})</span><strong>${money(last.p)}</strong></div><div><span class="small">Bisher günstigster</span><strong>${money(min)}</strong></div>${spark(f)}</div>` : ""}
    ${linkBtns(flightLinks(f, pax()))}
    ${f.booked ? "" : `<form class="priceform" data-form="flight-price" data-id="${f.id}">
      <input name="p" inputmode="decimal" placeholder="Heutiger Preis in € (gesamt)" aria-label="Heutiger Preis" required>
      <button class="btn small">Eintragen</button></form>`}
    <div class="btnrow">
      <button class="btn small ghost" data-act="flight-booked" data-id="${f.id}">${f.booked ? "Doch nicht gebucht" : "✓ Gebucht"}</button>
      <button class="btn small ghost" data-act="flight-edit" data-id="${f.id}">Bearbeiten</button>
    </div>
  </article>`;
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
    <button class="btn small ghost" data-act="lodge-add" data-id="${s.id}">+ Unterkunft eintragen</button>
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
      ${T.expenses.map(e => `<tr><td>${esc(e.text)} <button class="iconbtn sm" data-act="exp-del" data-id="${e.id}" aria-label="entfernen">✕</button></td><td>${money(toEur(e.amount, e.cur))}${e.cur === "CAD" ? `<span class="small block">${money(e.amount, "CAD")}</span>` : ""}</td></tr>`).join("")}
      <tr class="sum"><td>Gesamt</td><td>${money(b.total)}</td></tr>
    </tbody></table>
    <p class="small">${b.perDay ? `≈ ${money(b.perDay)} pro Tag · ` : ""}1 CAD ≈ ${rate().toFixed(3).replace(".", ",")} €</p>
    <form class="expform" data-form="expense">
      <input name="text" placeholder="z. B. Mietwagen, Parks Pass" maxlength="60" required aria-label="Wofür">
      <input name="amount" inputmode="decimal" placeholder="Betrag" required aria-label="Betrag">
      <select name="cur" aria-label="Währung"><option>EUR</option><option>CAD</option></select>
      <button class="btn small">+</button>
    </form>
    <p class="small">Umrechner: <input class="mini" inputmode="decimal" data-change="conv" placeholder="CAD"> CAD = <strong id="convOut">–</strong></p>
  </details>

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
function budget() {
  const flights = T.flights.filter(f => f.booked).reduce((t, f) => t + num(f.bookedPrice), 0);
  const lodging = T.lodgings.filter(l => l.status === "gebucht").reduce((t, l) => t + lodgeEur(l), 0);
  const extra = T.expenses.reduce((t, e) => t + toEur(e.amount, e.cur), 0);
  const total = flights + lodging + extra;
  const [a, b] = range();
  const days = a && b ? P.daysBetween(a, b) + 1 : 0;
  const people = pax().adults + pax().children;
  return { flights, lodging, extra, total, perDay: days ? total / days : 0, perPerson: people > 1 ? total / people : 0 };
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

async function geocode(q) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=ca&accept-language=de&q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(res.status);
  return (await res.json()).map(x => ({ name: x.name || x.display_name.split(",")[0], full: x.display_name, lat: +x.lat, lng: +x.lon }));
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
      ${isNew ? `<label class="check"><input type="checkbox" name="auto" checked><span>Typische Sehenswürdigkeiten gleich als Wünsche vormerken</span></label>` : ""}
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
        P.suggestNear(ns, [], taken, { maxMin: 75, limit: n, from: ns.from, to: ns.to }).forEach(r => ns.wishes.push({ id: St.newId(), sid: r.x.id, prio: 1 }));
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
      <span class="small">${P.dur(r.t)} · ${String(r.x.dur).replace(".", ",")} h · ${r.x.tags.filter(t => TAGS[t]).map(t => TAGS[t].icon).join(" ")}${r.x.r ? " · 🎟️" : ""}</span></button>`).join("")
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
      <div class="row2"><label>Dauer (h)<input name="dur" inputmode="decimal" value="1,5"></label><button type="button" class="btn ghost" id="ownSearch">Suchen</button></div>
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
      try {
        const res = await geocode(q + " " + s.name);
        const res2 = res.length ? res : await geocode(q);
        out.innerHTML = res2.map(x => `<button type="button" class="placebtn" data-geo="${esc(JSON.stringify(x))}"><strong>${esc(x.name)}</strong><span class="small">${esc(x.full)}</span></button>`).join("") || `<p class="small">Nichts gefunden.</p>`;
      } catch { out.innerHTML = `<p class="small">Suche geht gerade nicht.</p>`; }
    };
    out.onclick = e => {
      const r = e.target.closest("[data-geo]"); if (!r) return;
      const x = JSON.parse(r.dataset.geo);
      f.elements.lat.value = x.lat; f.elements.lng.value = x.lng;
      if (!f.elements.q.value.trim()) f.elements.q.value = x.name;
      out.innerHTML = `<p class="small goodtext">✓ ${esc(x.full)}</p>`;
    };
    f.onsubmit = e => {
      e.preventDefault();
      const lat = parseFloat(f.elements.lat.value), lng = parseFloat(f.elements.lng.value);
      if (!Number.isFinite(lat)) { toast("Bitte zuerst suchen und einen Treffer antippen."); return; }
      s.wishes.push({ id: St.newId(), name: f.elements.q.value.trim().slice(0, 60), lat, lng, dur: Math.max(0.25, num(f.elements.dur.value) || 1.5), prio: 1 });
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
      <label>Zielpreis für alle zusammen (€)<input name="target" inputmode="decimal" value="${v.target || ""}" placeholder="z. B. 1600"></label>
      ${f?.booked ? `<label>Bezahlter Preis (€)<input name="bookedPrice" inputmode="decimal" value="${f.bookedPrice || ""}"></label>` : ""}
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
    if (isNew) T.flights.push({ id: St.newId(), prices: [], booked: false, ...data });
    else Object.assign(f, data);
    commit();
    toast(isNew ? "Wird beobachtet 🔔" : "Gespeichert");
  });
}

function lodgeSheet(l, stopId) {
  const s = stopById(l?.stopId || stopId);
  const isNew = !l;
  const v = l || { name: "", platform: "Airbnb", url: "", address: "", checkIn: s?.from || "", checkOut: s?.to || "", total: "", cur: "EUR", status: "gebucht", cancelUntil: "", note: "" };
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
        <label>Preis gesamt<input name="total" inputmode="decimal" value="${v.total || ""}" placeholder="inkl. Gebühren"></label>
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
  for (const x of SIGHTS) {
    const sn = norm(x.name), sw = words(x.name);
    let sc = 0;
    if (sn === qn) sc = 3;
    else if (qn.length >= 4 && (sn.includes(qn) || qn.includes(sn))) sc = 2;
    else if (qw.length && sw.length) {
      const common = qw.filter(w => sw.includes(w)).length;
      const r = common / Math.max(qw.length, 1);
      if (r >= 0.5 && qw.some(w => w.length >= 5 && sw.includes(w))) sc = 1 + r * 0.5;
    }
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
function importSheet() {
  if (!stops().length) { toast("Lege zuerst in der Route deine Orte mit Datum an."); return; }
  openSheet("Liste mit Wünschen hochladen", `
    <p class="small">Ein Ort pro Zeile – z. B. aus deinen Notizen kopiert. Die App erkennt bekannte Sehenswürdigkeiten, sucht den Rest auf der Karte
      und ordnet alles dem Ort deiner Route zu, von dem es am wenigsten Fahrzeit kostet (oder plant es auf der Fahrt dorthin ein).</p>
    <form class="form">
      <label>Deine Liste<textarea name="text" rows="8" placeholder="Moraine Lake&#10;Johnston Canyon&#10;Spirit Island&#10;Kayak fahren auf dem Emerald Lake&#10;…"></textarea></label>
      <label class="btn ghost small">📄 Datei wählen (.txt oder .csv)<input type="file" name="file" accept=".txt,.csv,text/plain,text/csv" hidden></label>
      <p class="small" id="fileName"></p>
      <button class="btn big">Zuordnen</button>
    </form>`, null, body => {
    const f = body.querySelector("form");
    f.elements.file.onchange = async () => {
      const file = f.elements.file.files[0]; if (!file) return;
      f.elements.text.value = await file.text();
      body.querySelector("#fileName").textContent = `✓ ${file.name}`;
    };
    f.onsubmit = e => { e.preventDefault(); resolveList(parseList(f.elements.text.value)); };
  });
}
async function resolveList(names) {
  if (!names.length) { toast("Die Liste ist leer."); return; }
  const body = $("#sheetBody");
  const taken = new Set(stops().flatMap(s => s.wishes.map(w => w.sid).filter(Boolean)));
  const rows = [], missing = [];
  let webCalls = 0;
  for (const [i, name] of names.entries()) {
    body.innerHTML = `<p>Ordne zu … ${i + 1} von ${names.length}</p><p class="small">${esc(name)}</p>`;
    const x = matchSight(name);
    if (x) { rows.push({ name: x.name, given: name, sid: x.id, lat: x.lat, lng: x.lng, dur: x.dur, known: true, dup: taken.has(x.id) }); continue; }
    // Ortssuche erlaubt höchstens eine Anfrage pro Sekunde
    if (webCalls++) await new Promise(r => setTimeout(r, 1100));
    try {
      const hit = (await geocode(name))[0];
      if (hit) rows.push({ name, given: name, lat: hit.lat, lng: hit.lng, dur: 1.5, full: hit.full });
      else missing.push(name);
    } catch { missing.push(name); }
  }
  rows.forEach(r => { r.best = bestStop(r); r.stop = r.best.id; r.on = !r.dup; });
  const opts = sel => stops().map(s => `<option value="${s.id}" ${s.id === sel ? "selected" : ""}>${esc(s.name)}</option>`).join("");
  body.innerHTML = `
    <p class="small">${plural(rows.length, "Ort", "Orte")} erkannt${missing.length ? `, ${missing.length} nicht gefunden` : ""}. Prüf die Zuordnung und ändere sie bei Bedarf.</p>
    <ul class="importlist">${rows.map((r, i) => `<li>
      <label class="check"><input type="checkbox" data-i="${i}" ${r.on ? "checked" : ""}>
        <span><strong>${esc(r.name)}</strong>${r.known ? "" : ` <span class="small">(${esc(r.full.split(",").slice(0, 3).join(","))})</span>`}
        <span class="small block">${r.dup ? "schon eingeplant · " : ""}${r.best.how === "unterwegs" ? `auf der Fahrt von ${esc(r.best.from)}` : `≈ ${P.dur(r.best.t)} entfernt`}${r.best.t > 180 && r.best.how !== "unterwegs" ? " · ⚠️ weit weg von deiner Route" : ""}</span></span></label>
      <select data-i="${i}" aria-label="Zu welchem Ort?">${opts(r.stop)}</select></li>`).join("")}</ul>
    ${missing.length ? `<p class="small warntext">Nicht gefunden: ${missing.map(esc).join(", ")} – füge sie im Tagesplan über „Eigener Ort“ hinzu.</p>` : ""}
    <button class="btn big" id="importGo">Übernehmen</button>`;
  body.querySelector(".importlist").onchange = e => {
    const r = rows[e.target.dataset.i]; if (!r) return;
    if (e.target.type === "checkbox") r.on = e.target.checked; else r.stop = e.target.value;
  };
  body.querySelector("#importGo").onclick = () => {
    let n = 0;
    for (const r of rows.filter(x => x.on)) {
      const s = stopById(r.stop); if (!s) continue;
      const day = r.best.how === "unterwegs" && r.stop === r.best.id ? s.from : "";
      s.wishes.push(r.sid ? { id: St.newId(), sid: r.sid, prio: 1, day } : { id: St.newId(), name: r.name.slice(0, 60), lat: r.lat, lng: r.lng, dur: r.dur, prio: 1, day });
      n++;
    }
    closeSheet(); commit();
    toast(`${plural(n, "Wunsch", "Wünsche")} eingeplant`);
  };
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
  tab(d) { if (d.tab) { UI.tab = d.tab; ls.set("ka.tab", d.tab); render(); } },
  "setup-demo"() { T = demoTrip(); UI.tab = "start"; commit(); toast("Beispielreise geladen – schau dich um!"); },
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
  "exp-del"(d) { T.expenses = T.expenses.filter(e => e.id !== d.id); commit(); },
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
const findWish = id => { for (const s of stops()) { const w = s.wishes.find(x => x.id === id); if (w) return w; } return null; };

async function joinCode(code, fromUser) {
  if (code.length < 10) { toast("Der Reisecode hat 10 Zeichen."); return; }
  try { await St.connect(code, T, false); if (!T) T = St.loadLocal(); toast("Verbunden ☁"); render(); }
  catch (e) { if (fromUser || e.message === "notfound") toast(e.message === "notfound" ? "Diesen Reisecode gibt es nicht." : "Verbinden hat nicht geklappt. Bist du online?"); }
}

const CHANGE = {
  "leg-mode"(el) { const s = stopById(el.dataset.id); if (s) { s.mode = el.value; commit(); } },
  pace(el) { T.pace = el.value; commit(); },
  dayStart(el) { if (el.value) { T.dayStart = el.value; commit(); } },
  dayEnd(el) { if (el.value) { T.dayEnd = el.value; commit(); } },
  "wish-dur"(el) { const w = findWish(el.dataset.id); if (w) { w.dur = Number(el.value); commit(); } },
  "wish-day"(el) { const w = findWish(el.dataset.id); if (w) { w.day = el.value; commit(); } },
  checkEvery(el) { T.checkEvery = Number(el.value); commit(false); },
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
  "flight-price"(fd, form) {
    const f = T.flights.find(x => x.id === form.dataset.id), p = num(fd.get("p"));
    if (!f || p <= 0) return;
    f.prices.push({ at: Date.now(), p });
    commit();
    toast(f.target && p <= f.target ? "🎉 Unter deinem Zielpreis – jetzt zuschlagen!" : f.prices.length > 1 && p < f.prices.at(-2).p ? "Günstiger als letztes Mal 📉" : "Eingetragen");
  },
  expense(fd) {
    T.expenses.push({ id: St.newId(), text: String(fd.get("text")).trim().slice(0, 60), amount: num(fd.get("amount")), cur: fd.get("cur") });
    commit();
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
    document.querySelectorAll("[data-wx]").forEach(el => { el.textContent = wxLine(w.days[el.dataset.wx], w.kind); });
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
    expenses: [{ id: St.newId(), text: "Mietwagen (Einwegmiete)", amount: 1450, cur: "EUR" }, { id: St.newId(), text: "Parks Canada Discovery Pass", amount: 151, cur: "CAD" }],
    checks: { pass: true }
  });
}

/* ---------- Start ---------- */
St.onSync(t => { T = t; render(); }, mode => { $("#syncBadge").hidden = mode !== "sync"; $("#syncBadge").classList.toggle("err", mode === "fehler"); });
document.querySelectorAll(".nav button").forEach(b => b.onclick = () => ACT.tab({ tab: b.dataset.tab }));
if (T) T = Object.assign(blankTrip(), T);
render();
if (St.canSync) {
  const fromLink = St.cleanCode(new URLSearchParams(location.search).get("code"));
  if (fromLink) { try { history.replaceState(null, "", location.pathname); } catch {} }
  const code = fromLink || St.savedCode();
  if (code) joinCode(code, !!fromLink);
}
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
