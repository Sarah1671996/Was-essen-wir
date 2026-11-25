// Starter-Logik ohne Oberfläche: Sorten, Fälligkeit, Erinnerungen und Abgleich zwischen Geräten.
// Alles reine Funktionen, getestet in starters.test.mjs (node --test sauerteig-app/).
//
// Datenstand: { state, starters: { <id>: Starter } }
//   Jeder Starter und der Backplan tragen u = Zeitpunkt der letzten Änderung durch die Nutzerin.
//   Beim Abgleich gewinnt pro Starter die neuere Fassung. Gelöschte bleiben als { id, del: true, u } stehen.
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

// Alle Erinnerungen eines Starters, auch gerade eben verstrichene (die filtert dueList)
export function starterReminders(s, temp, now) {
  if (s.del || s.example || s.remind === false) return [];
  const i = starterInfo(s, temp, now), [a, m, w] = ratio(s);
  const how = i.fridge
    ? `Auf ca. ${a} g abnehmen, mit ${m} g ${flourOf(s).mehl} und ${w} g Wasser füttern, 1–2 h anspringen lassen, zurück in den Kühlschrank.`
    : `${a} g Starter + ${m} g ${flourOf(s).mehl} + ${w} g Wasser.`;
  const nm = s.name || flourOf(s).name, first = i.next.getTime(), base = { tag: "starter-" + s.id, view: "starter-" + s.id, fed: true };
  return [
    { ...base, at: first, title: `${nm} hat Hunger`, body: how },
    { ...base, at: first + (i.fridge ? DAY : 4 * HOUR), title: `${nm} wartet noch aufs Futter`,
      body: "Du hast die letzte Fütterung noch nicht eingetragen. " + how }
  ];
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
  const starters = {};
  if (r.starters && typeof r.starters === "object") {
    for (const [id, s] of Object.entries(r.starters)) if (s && s.id === id) starters[id] = s;
  } else if (r.starter) starters.s1 = { ...fromV1(r.starter), remind: r.state?.starterRemind !== false };
  return { state: r.state ? { u: 0, ...r.state } : null, starters };
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
  const starters = {};
  for (const id of new Set([...Object.keys(a.starters), ...Object.keys(b.starters)]))
    starters[id] = newer(a.starters[id], b.starters[id]);
  // Beispiel nur behalten, solange es nichts Echtes gibt
  if (Object.values(starters).some(s => !s.example))
    for (const [id, s] of Object.entries(starters)) if (s.example) delete starters[id];
  return { state: newer(a.state, b.state), starters };
}

// Was in Firestore stehen soll. remote = Dokument oder null; reminders(data) liefert alle Erinnerungen zum Stand.
// Ergebnis: { data, doc } mit doc = null, wenn nichts zu schreiben ist.
export function buildSave(remote, local, reminders, now) {
  const theirs = remote?.j ? parse(remote.j) : null;
  const data = theirs ? merge(local, theirs) : local;
  if (!theirs && !Object.values(data.starters).some(s => !s.example) && !(data.state?.u > 0)) return { data, doc: null };
  const j = canonical(data), due = dueList(reminders(data), remote?.due, now);
  if (remote && remote.j === j && canonical(remote.due || []) === canonical(due)) return { data, doc: null };
  return { data, doc: { j, due, next: due.length ? due[0].at : null, st: now } };
}
