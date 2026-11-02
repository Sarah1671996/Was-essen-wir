// Putzplan-Logik: Kalenderwochen und welche Aufgaben fällig sind.
// Wird von der App UND (als Kopie in functions/cleaning-logic.js) vom Server benutzt.
// Bei Änderungen beide Dateien gleich halten.

const DAY = 864e5;
const TZ = "Europe/Berlin";

// Kalendertag (Jahr, Monat, Tag) in deutscher Zeit, egal wo der Code läuft
function berlinYMD(ms) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date(ms));
  const get = t => Number(p.find(x => x.type === t).value);
  return [get("year"), get("month"), get("day")];
}

// ISO-Kalenderwoche: { key: "2026-W45", year, week, monday (UTC-Mitternacht des Montags in ms) }
export function weekOf(ms = Date.now()) {
  const [y, m, d] = berlinYMD(ms);
  const day = Date.UTC(y, m - 1, d);
  const dow = (new Date(day).getUTCDay() + 6) % 7; // Montag = 0
  const monday = day - dow * DAY;
  const thursday = monday + 3 * DAY;
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / DAY / 7) + 1;
  return { key: `${year}-W${String(week).padStart(2, "0")}`, year, week, monday };
}

export function weeksBetween(a, b) {
  return Math.round((b.monday - a.monday) / (7 * DAY));
}

// Wer ist diese Woche dran? Ungerade KW -> config.odd, gerade KW -> config.even
export function responsibleFor(config, wk = weekOf()) {
  return (wk.week % 2 ? config?.odd : config?.even) || null;
}

// Zustand einer Aufgabe in der Woche wk:
// "due" fällig, "done" diese Woche erledigt, "skipped" auf nächste Woche verschoben,
// "later" erst später fällig (dann in = Wochen bis fällig), "none" einmalige Aufgabe einer anderen Woche
export function choreState(c, wk = weekOf()) {
  const doneWk = c.lastDone ? weekOf(c.lastDone) : null;
  const doneThisWeek = doneWk && doneWk.key === wk.key;
  if (!c.every) {
    if (c.week !== wk.key) return { state: "none" };
    return { state: doneThisWeek ? "done" : "due" };
  }
  if (doneThisWeek) return { state: "done" };
  if (c.skipWeek === wk.key) return { state: "skipped", in: 1 };
  if (!doneWk) return { state: "due" };
  const diff = weeksBetween(doneWk, wk);
  return diff >= c.every ? { state: "due" } : { state: "later", in: c.every - diff };
}

export function openChores(chores, wk = weekOf()) {
  return chores.filter(c => choreState(c, wk).state === "due");
}

export function rhythmText(every) {
  if (!every) return "nur diese Woche";
  if (every === 1) return "jede Woche";
  return `alle ${every} Wochen`;
}
