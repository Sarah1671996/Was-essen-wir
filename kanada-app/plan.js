// Planung: Fahrzeiten, Tagesplan pro Ort, Hinweise zur Route und Vorschläge.
// Fahrzeiten kommen vom freien OSRM-Routenserver (OpenStreetMap). Solange die noch nicht da sind
// (oder offline), schätzt die App aus der Luftlinie.
import { SIGHTS, BASES, AIRPORTS, TAGS } from "./data.js";

export const PACE = {
  entspannt: { label: "Entspannt", buf: 1.25, lunch: 60 },
  normal: { label: "Normal", buf: 1.1, lunch: 45 },
  straff: { label: "Viel sehen", buf: 1.0, lunch: 30 }
};

/* ---------- Zeit & Datum ---------- */
export const toMin = hhmm => { const [h, m] = String(hhmm || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
export const hhmm = min => { min = Math.round(min); const h = Math.floor(min / 60) % 24, m = min % 60; return `${h}:${String(m).padStart(2, "0")}`; };
export function dur(min) {
  min = Math.round(min);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = Math.round((min % 60) / 5) * 5;
  return m ? `${h} h ${m === 60 ? 55 : m} min` : `${h} h`;
}
export const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);
export const monthOf = iso => Number(iso.slice(5, 7));
const inMonths = (m, [a, b]) => a <= b ? m >= a && m <= b : m >= a || m <= b;
const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
export const monthRange = ([a, b]) => a === b ? MONTHS[a - 1] : `${MONTHS[a - 1]}–${MONTHS[b - 1]}`;

/* ---------- Entfernungen ---------- */
export function km(a, b) {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}
export function estimate(a, b) {
  const d = km(a, b) * 1.3;
  const speed = d < 15 ? 35 : d < 60 ? 60 : 80;
  return { km: d, min: d / speed * 60 + (d > 1 ? 3 : 0), real: false };
}

const keyOf = p => p.lat.toFixed(4) + "," + p.lng.toFixed(4);
const pairKey = (a, b) => keyOf(a) + "|" + keyOf(b);
const OSRM = "https://router.project-osrm.org";
const routeCache = new Map(readLs("ka.routes", []));
const geoCache = new Map();
let listener = () => {}, saveTimer = null, queue = new Map(), queueTimer = null, offline = false;

function readLs(k, fb) { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } }
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const all = [...routeCache.entries()];
    try { localStorage.setItem("ka.routes", JSON.stringify(all.slice(-4000))); } catch {}
  }, 800);
}
export function onRoutesUpdated(fn) { listener = fn; }

// Fahrzeit a → b in Minuten (echte Route, falls schon geladen)
export function travel(a, b) {
  if (!a || !b) return { km: 0, min: 0, real: true };
  if (Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lng - b.lng) < 1e-4) return { km: 0, min: 0, real: true };
  const c = routeCache.get(pairKey(a, b));
  if (c) return { km: c[0], min: c[1], real: true };
  return estimate(a, b);
}

// Fahrzeiten zwischen allen Punkten im Hintergrund holen (ein Aufruf pro Punktgruppe)
export function prefetch(points) {
  const uniq = [...new Map(points.filter(Boolean).map(p => [keyOf(p), p])).values()];
  if (uniq.length < 2 || uniq.length > 80 || offline) return;
  const missing = uniq.some(a => uniq.some(b => a !== b && !routeCache.has(pairKey(a, b))));
  if (!missing) return;
  queue.set(uniq.map(keyOf).sort().join(";"), uniq);
  clearTimeout(queueTimer);
  queueTimer = setTimeout(runQueue, 250);
}
async function runQueue() {
  const jobs = [...queue.values()]; queue.clear();
  let changed = false;
  for (const pts of jobs) {
    try {
      const coords = pts.map(p => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(";");
      const res = await fetch(`${OSRM}/table/v1/driving/${coords}?annotations=duration,distance`);
      if (!res.ok) throw new Error(res.status);
      const j = await res.json();
      pts.forEach((a, i) => pts.forEach((b, k) => {
        if (i === k) return;
        const t = j.durations?.[i]?.[k], d = j.distances?.[i]?.[k];
        // OSRM rechnet mit Tempolimit; mit Fotostopps und Baustellen dauert es real etwas länger.
        // Unter 25 km/h über mehr als 5 km ist meist ein falsch eingerasteter Punkt (Forstweg, Bergstation) – dann mit 50 km/h rechnen.
        if (t != null && d != null) {
          const slow = d > 5000 && d / t < 25 / 3.6;
          routeCache.set(pairKey(a, b), [Math.round(d / 100) / 10, Math.round((slow ? d / (50 / 3.6) : t) / 60 * 1.1)]);
        }
      }));
      changed = true;
    } catch (e) {
      if (!navigator.onLine) offline = true;
      console.warn("Fahrzeiten nicht geladen", e);
    }
  }
  if (changed) { persist(); listener(); }
}
addEventListener("online", () => { offline = false; });

// Straßenverlauf für die Karte, über beliebig viele Punkte
export async function pathGeometry(points) {
  const k = points.map(keyOf).join("|");
  if (geoCache.has(k)) return geoCache.get(k);
  const coords = points.map(p => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(";");
  const res = await fetch(`${OSRM}/route/v1/driving/${coords}?overview=simplified&geometries=geojson`);
  if (!res.ok) throw new Error(res.status);
  const j = await res.json();
  const r = j.routes?.[0];
  if (!r) throw new Error("keine Route");
  const line = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  geoCache.set(k, line);
  if (points.length === 2 && !routeCache.has(k)) { routeCache.set(k, [Math.round(r.distance / 100) / 10, Math.round(r.duration / 60 * 1.1)]); persist(); }
  return line;
}
export const legGeometry = (a, b) => pathGeometry([a, b]);

export function nearestAirport(p) {
  let best = null;
  for (const [code, a] of Object.entries(AIRPORTS)) {
    const d = km(p, a);
    if (!best || d < best.km) best = { code, ...a, km: d };
  }
  return best;
}

/* ---------- Sehenswürdigkeiten ---------- */
const sightById = new Map(SIGHTS.map(x => [x.id, x]));
export const sight = id => sightById.get(id);

// Wunsch (aus der Datenbank oder selbst angelegt) in einen planbaren Punkt verwandeln
export function wishPoint(w) {
  const base = w.sid ? sight(w.sid) : null;
  const src = base || w;
  if (src.lat == null || src.lng == null) return null;
  return {
    wid: w.id, sid: w.sid || null, name: w.name || base?.name || "Ort", lat: src.lat, lng: src.lng,
    dur: Number(w.dur) || base?.dur || 1.5, prio: w.prio ?? 1, when: w.when || base?.w || "",
    res: base?.r || "", months: base?.m || null, tip: base?.t || "", tags: base?.tags || w.tags || [],
    fixDay: w.day || "", c: base ? base.c : w.c, cn: base?.cn || "", place: w.place || "", meal: !!w.meal
  };
}

/* ---------- Tagesplan für einen Ort ---------- */
// stop: { name, lat, lng, from, to, wishes, arrive, depart }
// ctx:  { prev (Punkt, von dem man am ersten Tag losfährt), prevMode, next, pace, dayStart, dayEnd, others }
export function planStop(stop, ctx) {
  const pace = PACE[ctx.pace] || PACE.normal;
  const base = { lat: stop.lat, lng: stop.lng, name: stop.name };
  const nights = Math.max(0, daysBetween(stop.from, stop.to));
  const dayStart = toMin(ctx.dayStart || "08:30"), dayEnd = toMin(ctx.dayEnd || "19:00");
  const wishes = (stop.wishes || []).map(wishPoint).filter(Boolean);

  // Tage anlegen: jeder Übernachtungstag, beim letzten Ort auch der Abreisetag
  const days = [];
  const count = Math.max(1, nights + (ctx.next ? 0 : 1));
  for (let i = 0; i < count; i++) {
    const date = addDays(stop.from, i);
    let start = dayStart, end = dayEnd, startPt = base, kind = "";
    if (i === 0) {
      if (ctx.prev && ctx.prevMode === "auto") { startPt = ctx.prev; kind = "reise"; }
      else { start = Math.max(dayStart, toMin(stop.arrive || (ctx.prev ? "13:00" : "16:00"))); kind = "ankunft"; }
    }
    if (!ctx.next && i === count - 1 && i > 0) { end = Math.min(dayEnd, toMin(stop.depart || "12:00")); kind = "abreise"; }
    days.push({ i, date, start, end, startPt, endPt: base, kind, items: [] });
  }

  const visitMin = w => w.dur * 60 * pace.buf;
  const routeMin = (d, list) => {
    let t = 0, p = d.startPt;
    for (const w of list) { t += travel(p, w).min + visitMin(w); p = w; }
    return t + travel(p, d.endPt).min;
  };
  // Ist ein Restaurant eingeplant, ersetzt es die Mittagspause
  const lunchOf = (d, t, list = d.items) => (d.end - d.start > 300 && t > 240 && !list.some(w => w.meal) ? pace.lunch : 0);
  const load = (d, list = d.items) => { const t = routeMin(d, list); return t + lunchOf(d, t, list); };
  const budget = d => d.end - d.start;
  const penalty = (d, list) => {
    let p = 0;
    list.forEach((w, k) => {
      if (w.when === "früh" && (k > 0 || d.kind === "reise" || d.kind === "ankunft")) p += 75;
      if (w.when === "abends" && k < list.length - 1) p += 60;
    });
    const f = load(d, list) / Math.max(60, budget(d));
    return p + f * f * 120;
  };
  const score = d => load(d) + penalty(d, d.items);
  const fits = (d, list) => load(d, list) <= budget(d) + 5;

  function bestInsert(w, onlyDay) {
    let best = null;
    for (const d of days) {
      if (onlyDay != null && d.i !== onlyDay) continue;
      const before = score(d);
      for (let k = 0; k <= d.items.length; k++) {
        const list = [...d.items.slice(0, k), w, ...d.items.slice(k)];
        if (!fits(d, list)) continue;
        const delta = load(d, list) + penalty(d, list) - before;
        if (!best || delta < best.delta) best = { d, k, delta };
      }
    }
    return best;
  }

  // Erst Muss, dann Gern, dann Optional; innerhalb davon weit entfernte zuerst
  const order = [...wishes].sort((a, b) => b.prio - a.prio || travel(base, b).min - travel(base, a).min || b.dur - a.dur);
  const unplaced = [];
  for (const w of order) {
    const fixed = w.fixDay ? days.find(d => d.date === w.fixDay) : null;
    const b = bestInsert(w, fixed ? fixed.i : null) || (fixed ? bestInsert(w) : null);
    if (b) b.d.items.splice(b.k, 0, w); else unplaced.push(w);
  }

  // Verbessern: Reihenfolge je Tag und Punkte zwischen Tagen verschieben
  for (let round = 0; round < 3; round++) {
    for (const d of days) d.items = bestOrder(d, d.items, l => load(d, l) + penalty(d, l));
    let moved = false;
    for (const d of days) {
      for (const w of [...d.items]) {
        if (w.fixDay) continue;
        const rest = d.items.filter(x => x !== w);
        const gain = score(d) - (load(d, rest) + penalty(d, rest));
        const keep = d.items; d.items = rest;
        const b = bestInsert(w);
        if (b && b.d !== d && b.delta < gain - 5) { b.d.items.splice(b.k, 0, w); moved = true; }
        else d.items = keep;
      }
    }
    // Was vorher nicht passte, nochmal versuchen
    for (const w of [...unplaced]) {
      const b = bestInsert(w);
      if (b) { b.d.items.splice(b.k, 0, w); unplaced.splice(unplaced.indexOf(w), 1); moved = true; }
    }
    if (!moved) break;
  }

  // Zeitplan mit Uhrzeiten
  for (const d of days) {
    // Steht als Erstes etwas an, das früh am schönsten ist: um 7 Uhr los
    if (d.items[0]?.when === "früh" && d.kind !== "reise" && d.kind !== "ankunft" && d.start > 7 * 60) { d.early = true; d.start = 7 * 60; }
    const steps = [];
    let t = d.start, p = d.startPt, lunchDone = false, driveSum = 0, visitSum = 0, kmSum = 0;
    const longDay = d.end - d.start > 300;
    const lunch = from => {
      if (lunchDone || !longDay || t < from || d.items.some(w => w.meal)) return;
      steps.push({ type: "pause", start: t, min: pace.lunch }); t += pace.lunch; lunchDone = true;
    };
    const drive = to => {
      const r = travel(p, to);
      if (r.min >= 2) steps.push({ type: "fahrt", start: t, min: r.min, km: r.km, real: r.real, to: to.name });
      t += r.min; driveSum += r.min; kmSum += r.km; p = to;
    };
    for (const w of d.items) {
      drive(w);
      lunch(11.75 * 60);
      const m = visitMin(w);
      steps.push({ type: "besuch", start: t, min: m, w });
      t += m; visitSum += m;
      lunch(12 * 60);
    }
    drive(d.endPt);
    d.steps = steps;
    d.finish = t;
    d.drive = driveSum; d.visit = visitSum; d.km = kmSum;
    d.busy = load(d); d.free = Math.max(0, budget(d) - d.busy);
  }

  return { days, unplaced, wishes, base, nights, pace, hints: stopHints(stop, ctx, days, unplaced, wishes, budget, pace, base) };
}

// Beste Reihenfolge innerhalb eines Tages: bis 7 Punkte alle Möglichkeiten, sonst 2-opt
function bestOrder(d, list, cost) {
  if (list.length < 2) return list;
  if (list.length <= 7) {
    let best = list, bestC = cost(list);
    const perm = (arr, n) => {
      if (n === 1) { const c = cost(arr); if (c < bestC) { bestC = c; best = [...arr]; } return; }
      for (let i = 0; i < n; i++) { perm(arr, n - 1); const j = n % 2 ? 0 : i; [arr[j], arr[n - 1]] = [arr[n - 1], arr[j]]; }
    };
    perm([...list], list.length);
    return best;
  }
  let cur = [...list], c = cost(cur), better = true;
  while (better) {
    better = false;
    for (let i = 0; i < cur.length - 1; i++) for (let k = i + 1; k < cur.length; k++) {
      const t = [...cur.slice(0, i), ...cur.slice(i, k + 1).reverse(), ...cur.slice(k + 1)];
      const tc = cost(t);
      if (tc < c - 0.5) { cur = t; c = tc; better = true; }
    }
  }
  return cur;
}

function stopHints(stop, ctx, days, unplaced, wishes, budget, pace, base) {
  const H = [];
  const month = monthOf(stop.from), monthEnd = monthOf(stop.to);
  if (unplaced.length) {
    const need = unplaced.reduce((t, w) => t + w.dur * 60 * pace.buf + 2 * travel(base, w).min, 0);
    const per = Math.max(240, toMin(ctx.dayEnd || "19:00") - toMin(ctx.dayStart || "08:30"));
    const extra = Math.max(1, Math.ceil(need / per));
    H.push({ kind: "warn", icon: "⏳", text: `Passt nicht mehr rein: ${unplaced.map(w => w.name).join(", ")}. Dafür bräuchtest du etwa ${extra === 1 ? "eine Nacht" : extra + " Nächte"} mehr – oder du streichst etwas mit „Optional“.`, action: { type: "nights", n: extra } });
  }
  days.forEach((d, n) => {
    const label = `Tag ${n + 1}`;
    if (d.busy > budget(d) * 0.95 && d.items.length) H.push({ kind: "warn", icon: "🔥", text: `${label} ist randvoll – ${dur(d.busy)} unterwegs. Etwas Luft tut gut.` });
    if (d.drive > 240 && d.kind !== "reise") H.push({ kind: "info", icon: "🚗", text: `${label}: ${dur(d.drive)} im Auto. Vielleicht eine Unterkunft näher dran?` });
  });
  for (const w of wishes) {
    if (w.months && !inMonths(month, w.months) && !inMonths(monthEnd, w.months))
      H.push({ kind: "warn", icon: "📅", text: `${w.name}: lohnt sich meist nur ${monthRange(w.months)}.` });
  }
  for (const d of days) for (const [k, w] of d.items.entries()) {
    if (w.when === "früh") H.push({ kind: "tip", icon: "🌅", text: k === 0 && d.kind !== "reise" && d.kind !== "ankunft" ? `${w.name}: Tag ${days.indexOf(d) + 1} geht schon um ${hhmm(d.start)} los – früh ist es dort am schönsten und noch leer.` : `${w.name} ist am frühen Morgen am schönsten (und leerer) – passt hier aber nicht an den Tagesanfang.` });
    if (w.when === "abends" && k !== d.items.length - 1) H.push({ kind: "tip", icon: "🌇", text: `${w.name} ist abends am schönsten.` });
    if (w.res) H.push({ kind: "res", icon: "🎟️", text: `${w.name}: ${w.res}` });
  }
  // Liegt etwas viel näher an einem anderen Ort der Reise?
  for (const w of wishes) {
    const here = travel(base, w).min;
    let best = null;
    for (const o of ctx.others || []) {
      const t = travel(o, w).min;
      if (t < here - 45 && (!best || t < best.t)) best = { o, t };
    }
    if (best && here > 60) H.push({ kind: "move", icon: "📍", text: `${w.name} liegt von ${best.o.name} aus näher (${dur(best.t)} statt ${dur(here)}).`, action: { type: "move", wid: w.wid, to: best.o.id } });
  }
  const freeDays = days.filter(d => d.free >= 240 && d.kind !== "abreise");
  if (freeDays.length && wishes.length) H.push({ kind: "idea", icon: "✨", text: `${freeDays.length === 1 ? "Ein Tag hat" : freeDays.length + " Tage haben"} noch viel Zeit frei. Unten findest du passende Vorschläge.` });
  return H;
}

/* ---------- Vorschläge ---------- */
// Punktzahl einer Sehenswürdigkeit für die gewählten Vorlieben
export function interestScore(x, criteria) {
  let sc = 0;
  if (!criteria.length) sc += x.tags.includes("sight") ? 2 : x.tags.includes("natur") ? 1.5 : 1;
  else if (x.tags.includes("sight")) sc += 0.8;
  for (const c of criteria) if (x.tags.includes(c)) sc += 2;
  if (criteria.includes("ruhe")) { if (x.tags.includes("geheim")) sc += 1.5; if (x.tags.includes("voll")) sc -= 2.5; }
  if (criteria.includes("sight") && x.tags.includes("voll")) sc += 0.5;
  return sc;
}
export function suggestNear(point, criteria, exclude, { maxMin = 100, limit = 8, from, to } = {}) {
  const m1 = from ? monthOf(from) : 0, m2 = to ? monthOf(to) : m1;
  // „Kostenlos“ ist ein echter Filter, keine Vorliebe
  const freeOnly = criteria.includes("gratis");
  criteria = criteria.filter(c => c !== "gratis");
  return SIGHTS.filter(x => !exclude.has(x.id) && (!freeOnly || x.c === 0))
    .map(x => {
      const t = travel(point, x).min;
      let sc = interestScore(x, criteria) - t / 50;
      const offSeason = m1 && x.m && !inMonths(m1, x.m) && !inMonths(m2, x.m);
      if (offSeason) sc -= 4;
      return { x, t, sc, offSeason };
    })
    .filter(r => r.t <= maxMin && r.sc > 0)
    .sort((a, b) => b.sc - a.sc).slice(0, limit);
}
export function matchLabels(x, criteria) {
  return x.tags.filter(t => TAGS[t] && t !== "gratis" && (criteria.includes(t) || (!criteria.length && t !== "voll"))).slice(0, 3).map(t => TAGS[t].icon + " " + TAGS[t].label);
}

/* ---------- Ganze Route ---------- */
export const MODES = { auto: "🚗 Auto", flug: "✈️ Flug", faehre: "⛴️ Fähre", zug: "🚆 Zug" };

export function legs(stops) {
  const out = [];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1], b = stops[i], mode = b.mode || "auto";
    const r = mode === "flug" ? { km: km(a, b), min: km(a, b) / 750 * 60 + 150, real: false } : travel(a, b);
    out.push({ a, b, mode, ...r });
  }
  return out;
}

export function routeHints(stops, criteria, tripStart) {
  const H = [];
  const L = legs(stops);
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1], b = stops[i];
    if (a.to && b.from && a.to !== b.from) {
      const gap = daysBetween(a.to, b.from);
      H.push({ kind: "warn", icon: "📅", text: gap > 0 ? `Zwischen ${a.name} und ${b.name} fehlen ${gap === 1 ? "eine Nacht" : gap + " Nächte"}.` : `${a.name} und ${b.name} überschneiden sich um ${-gap === 1 ? "eine Nacht" : -gap + " Nächte"}.`, action: { type: "chain", from: i } });
    }
  }
  if (tripStart && stops[0] && stops[0].from !== tripStart) H.push({ kind: "info", icon: "📅", text: `Die Reise beginnt am ${fmtDay(tripStart)}, der erste Ort aber erst am ${fmtDay(stops[0].from)}.` });
  L.forEach((l, i) => {
    if (l.mode !== "auto") return;
    if (l.km > 1500) { H.push({ kind: "warn", icon: "✈️", text: `${l.a.name} → ${l.b.name}: ${Math.round(l.km)} km, ca. ${dur(l.min)} Fahrt. Hier lohnt sich ein Inlandsflug.`, action: { type: "mode", stop: l.b.id, mode: "flug" } }); return; }
    if (l.min > 300) {
      const along = alongRoute(l.a, l.b, criteria, new Set(stops.flatMap(st => (st.wishes || []).map(w => w.sid).filter(Boolean))));
      H.push({ kind: "info", icon: "🛣️", text: `${l.a.name} → ${l.b.name}: ${dur(l.min)} Fahrt. ${l.min > 480 ? "Das ist sehr lang – besser mit einer Übernachtung unterwegs." : "Plane Pausen ein."}${along.length ? " Schön unterwegs: " + along.map(r => r.x.name).join(", ") + "." : ""}`, action: along.length ? { type: "along", stop: l.b.id, ids: along.map(r => r.x.id) } : null });
      const mid = l.min > 480 ? overnight(l.a, l.b, stops) : null;
      if (mid) H.push({ kind: "idea", icon: "🛏️", text: `Übernachtung unterwegs in ${mid.b.name}: ${dur(mid.ta)} hin, am nächsten Tag noch ${dur(mid.tb)}.`, action: { type: "insert", base: mid.b.id, after: l.a.id } });
    }
  });
  const better = betterOrder(stops);
  if (better) H.push({ kind: "idea", icon: "🔀", text: `Andere Reihenfolge spart etwa ${dur(better.saved)} Fahrt: ${better.order.map(s => s.name).join(" → ")}.`, action: { type: "order", ids: better.order.map(s => s.id) } });
  return H;
}
const fmtDay = iso => new Date(iso + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "short" });

// Sehenswürdigkeiten mit wenig Umweg zwischen zwei Orten
// (alles mit der Schätzung gerechnet, damit echte und geschätzte Zeiten nicht gemischt werden;
// Orte direkt am Start oder Ziel zählen nicht, die besucht man von dort aus)
export function alongRoute(a, b, criteria, exclude, limit = 3) {
  const direct = estimate(a, b).min;
  return SIGHTS.filter(x => !exclude.has(x.id) && x.dur <= 3)
    .map(x => ({ x, ta: estimate(a, x).min, tb: estimate(x, b).min }))
    .filter(r => r.ta > 25 && r.tb > 25)
    .map(r => ({ x: r.x, detour: r.ta + r.tb - direct }))
    .filter(r => r.detour <= Math.min(45, Math.max(25, direct * 0.1)))
    .map(r => ({ ...r, sc: interestScore(r.x, criteria) - r.detour / 30 }))
    .filter(r => r.sc > 0)
    .sort((p, q) => q.sc - p.sc).slice(0, limit);
}

// Ort für eine Übernachtung etwa in der Mitte einer langen Fahrt
function overnight(a, b, stops) {
  const direct = estimate(a, b).min;
  return BASES.filter(x => !stops.some(s => s.baseId === x.id))
    .map(x => ({ b: x, ta: estimate(a, x).min, tb: estimate(x, b).min }))
    .filter(r => r.ta + r.tb - direct <= 60 && r.ta > direct * 0.25 && r.tb > direct * 0.25)
    .sort((p, q) => Math.abs(p.ta - p.tb) - Math.abs(q.ta - q.tb))[0] || null;
}

// Reihenfolge der Zwischenstopps prüfen (Start und Ziel bleiben gleich)
function betterOrder(stops) {
  if (stops.length < 4 || stops.length > 9 || stops.some((s, i) => i && (s.mode || "auto") !== "auto")) return null;
  const cost = list => list.reduce((t, s, i) => i ? t + travel(list[i - 1], s).min : 0, 0);
  const first = stops[0], last = stops.at(-1), mid = stops.slice(1, -1);
  const now = cost(stops);
  let best = null;
  const perm = (arr, n) => {
    if (n === 1) { const c = cost([first, ...arr, last]); if (!best || c < best.c) best = { c, order: [first, ...arr, last] }; return; }
    for (let i = 0; i < n; i++) { perm(arr, n - 1); const j = n % 2 ? 0 : i; [arr[j], arr[n - 1]] = [arr[n - 1], arr[j]]; }
  };
  perm([...mid], mid.length);
  return best && now - best.c > 60 ? { saved: now - best.c, order: best.order } : null;
}
