// Starter-Logik ohne Oberfläche: Sorten, Fälligkeit, Erinnerungen und Abgleich zwischen Geräten.
// Alles reine Funktionen, getestet in starters.test.mjs und app.test.mjs.
//
// Datenstand: { state, starters: { <id>: Starter }, recipes: { <id>: Rezept }, diary: { <id>: Eintrag } }
//   Jeder Eintrag und der Backplan (state) tragen u = Zeitpunkt der letzten Änderung durch die Nutzerin.
//   Beim Abgleich gewinnt pro Eintrag die neuere Fassung. Gelöschte bleiben als { id, del: true, u } stehen.
export const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
export const MAX_STARTERS = 12;
const KEEP_UNSENT = 6 * HOUR; // so lange schickt der Server Überfälliges noch nach

// warm: ab dieser Raumtemperatur alle 12 statt alle 24 Stunden füttern
export const FLOURS = {
  weizen:     { name: "Weizen", mehl: "Weizenmehl", days: 7, warm: 25,
    tip: "Weizen-Starter wird im Kühlschrank schneller sauer als Roggen. Länger als 7–10 Tage ohne Futter macht ihn träge." },
  weizenvk:   { name: "Weizenvollkorn", mehl: "Weizenvollkornmehl", days: 5, warm: 23,
    tip: "Vollkorn gärt schneller und bindet mehr Wasser. Wirkt er zu fest, gib beim Füttern 5–10 g Wasser mehr dazu." },
  roggen:     { name: "Roggen", mehl: "Roggenmehl", days: 10, warm: 25,
    tip: "Roggen-Starter ist robust und hält im Kühlschrank 10–14 Tage ohne Futter gut durch. Er wird zäh wie Brei und wächst weniger sichtbar als Weizen." },
  dinkel:     { name: "Dinkel", mehl: "Dinkelmehl", days: 7, warm: 24,
    tip: "Dinkel-Starter fällt nach dem Höhepunkt schnell zusammen. Zum Backen lieber etwas früher verwenden." },
  dinkelvk:   { name: "Dinkelvollkorn", mehl: "Dinkelvollkornmehl", days: 5, warm: 23,
    tip: "Dinkelvollkorn gärt schnell und wird rasch sauer. Lieber etwas öfter füttern als bei hellem Mehl." },
  glutenfrei: { name: "Glutenfrei", mehl: "glutenfreies Mehl (z. B. Vollkornreis oder Buchweizen)", days: 5, warm: 23,
    tip: "Glutenfreier Starter geht weniger hoch auf als Weizen. Achte auf Blasen, lockere Oberfläche und säuerlichen Geruch." },
  anderes:    { name: "Anderes Mehl", mehl: "Mehl", days: 7, warm: 25, tip: "" }
};
export const flourOf = s => FLOURS[s.flour] || FLOURS.anderes;

export function newStarter(id, flour, now, extra = {}) {
  return { id, name: flourOf({ flour }).name + "-Sauerteig", flour, mode: "aktiv", lastFed: new Date(now).toISOString(),
    fridgeSince: null, fridgeDays: flourOf({ flour }).days, log: [], remind: true, u: now, ...extra };
}
// Platzhalter beim allerersten Start; verschwindet, sobald es einen echten Starter gibt
export const exampleStarter = now => newStarter("s1", "weizen", now - 10 * HOUR, { example: true, u: 0 });

export const roomHours = (s, temp) => (temp >= flourOf(s).warm ? 12 : 24);

export function starterInfo(s, temp, now) {
  const last = new Date(s.lastFed), fridge = s.mode === "kuehlschrank";
  const intervalMs = fridge ? s.fridgeDays * DAY : roomHours(s, temp) * HOUR;
  const next = new Date(last.getTime() + intervalMs);
  const left = next - now;
  let level = "ok";
  if (left < 0) level = left < -(fridge ? 3 * DAY : 12 * HOUR) ? "bad" : "warn";
  else if (left < (fridge ? DAY : 3 * HOUR)) level = "soon";
  return { last, next, left, elapsed: now - last, intervalMs, level, fridge,
    fridgeFor: fridge && s.fridgeSince ? now - new Date(s.fridgeSince) : 0 };
}

export const ratio = s => (s.mode === "kuehlschrank" ? [20, 60, 60] : [20, 40, 40]);

// ---------- Höhepunkt messen ----------
// s.peaks = [{ h: Stunden bis zum Höhepunkt, temp, fedAt, t }]. Umgerechnet auf 24 °C, Mittelwert (Median) der letzten 5.
const warmth = temp => Math.pow(1.09, 24 - temp);
export function peakHours24(s) {
  const x = (s?.peaks || []).slice(0, 5).map(p => p.h / warmth(p.temp)).sort((a, b) => a - b);
  if (!x.length) return null;
  return x.length % 2 ? x[(x.length - 1) / 2] : (x[x.length / 2 - 1] + x[x.length / 2]) / 2;
}
// Minuten vom Füttern (1:2:2) bis zum Höhepunkt; ohne Messung 5 Stunden bei 24 °C
export const peakMin = (s, temp) => (peakHours24(s) ?? 5) * 60 * warmth(temp);
export function canMeasure(s, now) {
  const since = now - new Date(s.lastFed);
  return !s.example && s.mode !== "kuehlschrank" && since >= 1.5 * HOUR && since <= 24 * HOUR && s.peaks?.[0]?.fedAt !== s.lastFed;
}
export const withPeak = (s, temp, now) => [{ h: Math.round((now - new Date(s.lastFed)) / HOUR * 100) / 100, temp, fedAt: s.lastFed, t: new Date(now).toISOString() }, ...(s.peaks || [])].slice(0, 10);

// ---------- Urlaub ----------
// trip = { from: "2026-12-20", to: "2027-01-03" } (Abreise- und Rückkehrtag)
export function tripDates(trip) {
  if (!trip?.from || !trip?.to) return null;
  const from = new Date(trip.from + "T00:00"), to = new Date(trip.to + "T00:00");
  if (isNaN(from) || isNaN(to) || to <= from) return null;
  return { from, back: new Date(trip.to + "T18:00"), days: Math.round((to - from) / DAY) };
}
// Was vor und nach der Reise zu tun ist. kind: fridge (normal), stiff (fest füttern), dry (zusätzlich trocknen)
export function tripAdvice(s, trip) {
  const d = tripDates(trip); if (!d) return null;
  const f = flourOf(s), gf = s.flour === "glutenfrei";
  const kind = d.days <= f.days ? "fridge" : d.days <= 2 * f.days ? "stiff" : "dry";
  const stiff = gf ? `Dick füttern: 20 g Starter + 100 g ${f.mehl} + 80 g Wasser zu einem dicken Brei verrühren und gleich in den Kühlschrank stellen.`
    : `Fest füttern: 20 g Starter + 100 g ${f.mehl} + 60 g Wasser zu einer festen Kugel kneten und gleich in den Kühlschrank stellen.`;
  const before = kind === "fridge"
    ? [`Am Vortag füttern: 20 g Starter + 60 g ${f.mehl} + 60 g Wasser, 1–2 h anspringen lassen, dann in den Kühlschrank.`]
    : kind === "stiff" ? ["Am Vortag: " + stiff]
    : ["3 Tage vorher: 2 EL aktiven Starter dünn auf Backpapier streichen, 1–2 Tage an der Luft trocknen lassen, zerbröseln und im Schraubglas aufheben (Sicherung).",
       "Am Vortag: " + stiff];
  const after = kind === "fridge" ? ["Nach der Rückkehr einmal füttern. Dunkle Flüssigkeit abgießen."]
    : ["Nach der Rückkehr 2–3 Mal bei Raumtemperatur füttern, bis er wieder kräftig ist."
       + (kind === "dry" ? " Kommt er nach 3 Tagen nicht in Gang: 10 g getrockneten Starter in 20 g warmem Wasser auflösen und mit 20 g Mehl neu starten." : "")];
  return { kind, days: d.days, before, after, prepAt: new Date(d.from.getTime() - (kind === "dry" ? 3 : 1) * DAY + 18 * HOUR) };
}
export function tripReminders(s, trip) {
  if (s.del || s.example || s.remind === false) return [];
  const a = tripAdvice(s, trip); if (!a) return [];
  const nm = s.name || flourOf(s).name, d = tripDates(trip), base = { tag: "trip-" + s.id, view: "starter-" + s.id, fed: false };
  const list = [{ ...base, at: a.prepAt.getTime(), title: `Vor dem Urlaub: ${nm} vorbereiten`, body: a.before[0] }];
  if (a.kind === "dry") list.push({ ...base, at: d.from.getTime() - DAY + 18 * HOUR, title: `Vor dem Urlaub: ${nm} versorgen`, body: a.before[1] });
  return list;
}

// Alle Erinnerungen eines Starters, auch gerade eben verstrichene (die filtert dueList).
// Während eines Urlaubs kommt nichts; was dann fällig wäre, kommt am Abend der Rückkehr.
export function starterReminders(s, temp, now, trip = null) {
  if (s.del || s.example || s.remind === false) return [];
  const i = starterInfo(s, temp, now), [a, m, w] = ratio(s);
  const how = i.fridge
    ? `Auf ca. ${a} g abnehmen, mit ${m} g ${flourOf(s).mehl} und ${w} g Wasser füttern, 1–2 h anspringen lassen, zurück in den Kühlschrank.`
    : `${a} g Starter + ${m} g ${flourOf(s).mehl} + ${w} g Wasser.`;
  const nm = s.name || flourOf(s).name, base = { tag: "starter-" + s.id, view: "starter-" + s.id, fed: true };
  const d = tripDates(trip), away = t => d && t >= d.from.getTime() && t < d.back.getTime();
  const back = away(i.next.getTime()), first = back ? d.back.getTime() : i.next.getTime();
  return [
    { ...base, at: first, title: back ? `Wieder da? ${nm} hat Hunger` : `${nm} hat Hunger`, body: back ? tripAdvice(s, trip).after[0] : how },
    { ...base, at: first + (i.fridge ? DAY : 4 * HOUR), title: `${nm} wartet noch aufs Futter`,
      body: "Du hast die letzte Fütterung noch nicht eingetragen. " + how }
  ].filter(x => !away(x.at));
}

const dueKey = d => d.tag + "|" + d.at;
// Was noch kommt, plus Fälliges, das der Server noch nicht verschickt hat (steht noch in remoteDue).
// So geht keine Erinnerung verloren, wenn die App zwischen Fälligkeit und Versand geöffnet wird, und keine kommt doppelt.
export function dueList(all, remoteDue, now) {
  const unsent = new Set((remoteDue || []).map(dueKey));
  return all.filter(d => d.at > now || (d.at > now - KEEP_UNSENT && unsent.has(dueKey(d))))
    .sort((a, b) => a.at - b.at || (a.tag < b.tag ? -1 : 1)).slice(0, 50);
}

// JSON mit fester Reihenfolge der Felder, damit zwei Geräte denselben Text erzeugen
export function canonical(x) {
  if (Array.isArray(x)) return "[" + x.map(v => canonical(v === undefined ? null : v)).join(",") + "]";
  if (x && typeof x === "object") return "{" + Object.keys(x).filter(k => x[k] !== undefined).sort()
    .map(k => JSON.stringify(k) + ":" + canonical(x[k])).join(",") + "}";
  return JSON.stringify(x);
}

// Liest gespeicherten Text. Version 1 kannte nur einen Starter (Feld starter); der wird zu s1.
export function parse(text) {
  let r;
  try { r = JSON.parse(text); } catch { return null; }
  if (!r || typeof r !== "object") return null;
  const { state, starter, ...rest } = r;
  const data = normalize({ ...rest, state: state ? { u: 0, ...state } : null });
  if (!r.starters && starter) data.starters.s1 = { ...fromV1(starter), remind: state?.starterRemind !== false };
  return data;
}
// Alle Sammlungen vorhanden, nur Einträge mit passender Kennung. Unbekannte Sammlungen (neuere App) bleiben erhalten.
export function normalize(x) {
  const out = { state: x.state || null };
  for (const k of new Set(["starters", "recipes", "diary", ...Object.keys(x)])) {
    if (k === "state") continue;
    out[k] = Object.fromEntries(Object.entries(x[k] && typeof x[k] === "object" ? x[k] : {}).filter(([id, v]) => v && v.id === id));
  }
  return out;
}
export function fromV1(s) {
  const { example, ...rest } = s;
  const t = Math.max(0, Date.parse(s.lastFed) || 0, Date.parse(s.log?.[0]?.t) || 0);
  return { ...newStarter("s1", "weizen", 0), ...rest, id: "s1", ...(example ? { example: true } : {}), u: example ? 0 : t };
}

const newer = (a, b) => {
  if (!a || !b) return a || b;
  const ua = a.u || 0, ub = b.u || 0;
  if (ua !== ub) return ua > ub ? a : b;
  return canonical(a) >= canonical(b) ? a : b; // gleich alt: auf allen Geräten dieselbe Wahl
};
export function merge(a, b) {
  a = normalize(a); b = normalize(b);
  const out = { state: newer(a.state, b.state) };
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (k === "state") continue;
    const x = a[k] || {}, y = b[k] || {};
    out[k] = {};
    for (const id of new Set([...Object.keys(x), ...Object.keys(y)])) out[k][id] = newer(x[id], y[id]);
  }
  // Beispiel nur behalten, solange es nichts Echtes gibt
  const st = out.starters;
  if (Object.values(st).some(s => !s.example)) for (const [id, s] of Object.entries(st)) if (s.example) delete st[id];
  return out;
}

// Was in Firestore stehen soll. remote = Dokument oder null; reminders(data) liefert alle Erinnerungen zum Stand.
// Ergebnis: { data, doc } mit doc = null, wenn nichts zu schreiben ist.
export function buildSave(remote, local, reminders, now) {
  const theirs = remote?.j ? parse(remote.j) : null;
  const data = theirs ? merge(local, theirs) : normalize(local);
  const real = Object.entries(data).some(([k, x]) => k !== "state" && Object.values(x).some(v => !v.example));
  if (!theirs && !real && !(data.state?.u > 0)) return { data, doc: null };
  const j = canonical(data), due = dueList(reminders(data), remote?.due, now);
  if (remote && remote.j === j && canonical(remote.due || []) === canonical(due)) return { data, doc: null };
  return { data, doc: { j, due, next: due.length ? due[0].at : null, st: now } };
}
