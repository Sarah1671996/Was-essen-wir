// Wann buchen? Einschätzung aus den eigenen Preis-Einträgen und groben Erfahrungswerten.
// Echte historische Preisdaten geben Airlines und Portale nicht frei heraus – die Spannen unten sind
// Erfahrungswerte (Stand 2025/26) und dienen nur zur Einordnung, nicht als Garantie.

const WEST = new Set(["YVR", "YYC", "YEG", "YLW", "YXY", "YYJ", "YKA"]);

// Saison nach Reisemonat: Hochsaison Juli/August (und Ende Juni), Nebensaison Mai/Juni/September/Oktober
export function season(iso) {
  const m = Number(String(iso).slice(5, 7)), d = Number(String(iso).slice(8, 10));
  if (m === 7 || m === 8 || (m === 6 && d >= 20) || m === 12 && d >= 18) return "hoch";
  if (m >= 5 && m <= 10) return "neben";
  return "nieder";
}
export const SEASON_LABEL = { hoch: "Hochsaison", neben: "Nebensaison", nieder: "Wintersaison" };

// Hin- und Rückflug Economy ab Deutschland, pro Person in Euro
const FLIGHT_RANGE = {
  west: { hoch: [1000, 1700], neben: [750, 1250], nieder: [600, 1000] },
  ost: { hoch: [800, 1400], neben: [600, 1050], nieder: [480, 850] }
};
// Mietwagen Mittelklasse-SUV mit Rundum-Versicherung über Vermittler, pro Tag in Euro (ohne Einweggebühr)
const CAR_RANGE = { hoch: [90, 170], neben: [60, 120], nieder: [40, 90] };
// Mittelklasse-Hotel/Cabin pro Nacht in CAD: Nationalpark-Orte sind am teuersten
const BED_RANGE = { park: { hoch: [250, 500], neben: [170, 350], nieder: [120, 250] }, sonst: { hoch: [170, 350], neben: [130, 260], nieder: [100, 200] } };

// Buchungsfenster in Tagen vor Abflug: [ab wann sinnvoll, bis wann spätestens]
const FLIGHT_WINDOW = { hoch: [270, 90], neben: [210, 60], nieder: [150, 40] };

export function flightRange(to, date, persons) {
  const r = FLIGHT_RANGE[WEST.has(to) ? "west" : "ost"][season(date)];
  return [r[0] * persons, r[1] * persons];
}
// Wo liegt ein Preis in der Spanne: 0 = ganz unten, 1 = ganz oben
const pos = (p, [lo, hi]) => Math.max(0, Math.min(1, (p - lo) / (hi - lo)));
const fmtDate = (iso, add) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + add); return d.toISOString().slice(0, 10); };
const de = iso => new Date(iso + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });

// Trend der eigenen Einträge: Euro pro Woche (lineare Regression über die letzten Einträge)
function trend(prices) {
  const ps = prices.slice(-10);
  if (ps.length < 3) return null;
  const xs = ps.map(p => p.at / 6048e5), ys = ps.map(p => p.p);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  const num = xs.reduce((t, x, i) => t + (x - mx) * (ys[i] - my), 0), den = xs.reduce((t, x) => t + (x - mx) ** 2, 0);
  return den ? num / den : 0;
}

// f: beobachteter Flug { to, date, prices, target, booked }, today: ISO-Datum, persons: Anzahl Reisende
export function flightAdvice(f, today, persons) {
  const days = Math.round((new Date(f.date + "T12:00:00") - new Date(today + "T12:00:00")) / 864e5);
  const s = season(f.date), [early, late] = FLIGHT_WINDOW[s];
  const range = flightRange(f.to, f.date, persons);
  const last = f.prices.at(-1)?.p, min = f.prices.length ? Math.min(...f.prices.map(p => p.p)) : null;
  const max = f.prices.length ? Math.max(...f.prices.map(p => p.p)) : null;
  const tr = trend(f.prices);
  const window = { from: fmtDate(f.date, -early), until: fmtDate(f.date, -late) };
  const phase = days > early ? "früh" : days > late ? "ideal" : days > 14 ? "spät" : "kurz";
  const out = { days, season: s, range, window, phase, last, min, max, trend: tr, n: f.prices.length, reasons: [] };

  if (days < 0) return { ...out, verdict: "vorbei", tone: "", text: "Der Flug liegt in der Vergangenheit." };
  if (last == null) {
    out.reasons.push(phase === "früh" ? `Das beste Buchungsfenster beginnt etwa am ${de(window.from)}.` : phase === "ideal" ? "Du bist im typischen Buchungsfenster." : "Das typische Buchungsfenster ist schon vorbei.");
    return { ...out, verdict: "unbekannt", tone: "", text: "Trag ein paar Preise ein (z. B. per Screenshot), dann kann die App einschätzen, ob der Preis gut ist." };
  }
  const p = pos(last, range);
  const level = p < 0.25 ? "günstig" : p < 0.65 ? "normal" : "teuer";
  out.level = level;
  out.reasons.push(`Für ${SEASON_LABEL[s]} sind etwa ${range[0].toLocaleString("de-DE")}–${range[1].toLocaleString("de-DE")} € für ${persons === 1 ? "eine Person" : persons + " Personen"} üblich – dein Preis ist ${level}.`);
  if (out.n >= 2) out.reasons.push(last <= min ? "Das ist dein bisher günstigster Preis." : `Dein Tiefstwert war ${min.toLocaleString("de-DE")} €, ${Math.round(last - min).toLocaleString("de-DE")} € weniger.`);
  if (tr != null && Math.abs(tr) >= 5) out.reasons.push(`Trend deiner Einträge: ${tr > 0 ? "steigend" : "fallend"}, etwa ${Math.round(Math.abs(tr))} € pro Woche.`);
  out.reasons.push(phase === "früh" ? `Noch ${days} Tage bis zum Abflug – das typische Buchungsfenster beginnt etwa am ${de(window.from)}.`
    : phase === "ideal" ? `Noch ${days} Tage – du bist im typischen Buchungsfenster (bis etwa ${de(window.until)}).`
    : `Nur noch ${days} Tage – ab jetzt steigen die Preise meist deutlich.`);

  let verdict, tone, text;
  if (f.target && last <= f.target) { verdict = "buchen"; tone = "good"; text = "Zielpreis erreicht – jetzt buchen."; }
  else if (phase === "spät" || phase === "kurz") { verdict = "buchen"; tone = "warn"; text = level === "teuer" ? "Nicht mehr warten – günstiger wird es so kurz vorher selten." : "Jetzt buchen – kurz vor Abflug wird es meist teurer."; }
  else if ((level === "günstig" || (out.n >= 3 && last <= min && level !== "teuer")) && tr != null && tr < -10 && days > 120) { verdict = "beobachten"; tone = "good"; text = "Guter Preis – und er fällt gerade noch. Ein paar Tage beobachten ist drin, bei deinem Zielpreis sofort buchen."; }
  else if (level === "günstig" || (out.n >= 3 && last <= min && level !== "teuer")) { verdict = "buchen"; tone = "good"; text = "Guter Preis – zuschlagen lohnt sich."; }
  else if (tr != null && tr > 10 && phase === "ideal") { verdict = "buchen"; tone = "warn"; text = "Die Preise ziehen an – eher bald buchen."; }
  else if (phase === "früh") { verdict = "warten"; tone = ""; text = level === "teuer" ? "Noch warten und beobachten – es ist früh und der Preis eher hoch." : "Noch etwas beobachten – bei einem guten Angebot ruhig zuschlagen."; }
  else { verdict = "beobachten"; tone = ""; text = level === "teuer" ? "Eher teuer – weiter beobachten, aber das Fenster schließt sich." : "Normaler Preis – beobachten und bei einem Rückgang buchen."; }
  // Wie sicher ist die Einschätzung? Mehr eigene Einträge = sicherer
  out.confidence = out.n >= 6 ? "gut" : out.n >= 3 ? "mittel" : "gering";
  return { ...out, verdict, tone, text };
}

// Mietwagen: pro Tag mit der Spanne vergleichen; mit kostenloser Stornierung lohnt sich früh buchen fast immer
export function carAdvice(car, totalEur, days, today) {
  const s = season(car.pickDate || today), range = CAR_RANGE[s];
  const perDay = days > 0 ? totalEur / days : 0;
  const daysTo = car.pickDate ? Math.round((new Date(car.pickDate + "T12:00:00") - new Date(today + "T12:00:00")) / 864e5) : null;
  const level = !perDay ? "" : perDay < range[0] * 1.1 ? "günstig" : perDay < (range[0] + range[1]) / 2 * 1.1 ? "normal" : "teuer";
  const reasons = [`Für ein Mittelklasse-SUV mit Rundum-Schutz sind in der ${SEASON_LABEL[s]} etwa ${range[0]}–${range[1]} € pro Tag üblich (plus Einweggebühr)${perDay ? ` – du zahlst ${Math.round(perDay)} €/Tag, das ist ${level}` : ""}.`];
  reasons.push("Mietwagen in Kanada werden zur Hochsaison knapp und eher teurer – früh mit kostenloser Stornierung buchen und später nochmal vergleichen ist meist am günstigsten.");
  let text, tone = "";
  if (car.status !== "gebucht") { text = daysTo != null && daysTo < 60 ? "Jetzt buchen – kurzfristig wird es knapp und teuer." : "Jetzt mit kostenloser Stornierung buchen und weiter vergleichen."; tone = daysTo != null && daysTo < 60 ? "warn" : "good"; }
  else if (car.cancelUntil) { text = "Gebucht – vor Ende der Stornofrist nochmal vergleichen (etwa 6–8 und 2–3 Wochen vorher)."; tone = "good"; }
  else text = "Gebucht ohne kostenlose Stornierung – hier lohnt sich kein Weitersuchen mehr.";
  return { season: s, range, perDay, level, text, tone, reasons, checks: car.pickDate ? [fmtDate(car.pickDate, -56), fmtDate(car.pickDate, -18)] : [] };
}

// Unterkunft: pro Nacht mit der Spanne vergleichen
export function lodgingAdvice(perNightCad, checkIn, park) {
  const s = season(checkIn), range = BED_RANGE[park ? "park" : "sonst"][s];
  const level = !perNightCad ? "" : perNightCad < range[0] * 1.1 ? "günstig" : perNightCad < (range[0] + range[1]) / 2 ? "normal" : "teuer";
  return { season: s, range, level };
}

// Buchungs-Fahrplan: wann was am besten erledigt wird (in Tagen vor Reisebeginn)
export function bookingPlan(start, hasPark) {
  const s = season(start), [early, late] = FLIGHT_WINDOW[s];
  const items = [
    { icon: "🏕️", what: "Parks-Canada-Campingplätze", from: hasPark ? fmtDate(start, -300) : null, until: fmtDate(start, -150), note: "Werden im Winter/Frühjahr freigeschaltet und sind in Stunden weg – Termin auf reservation.pc.gc.ca prüfen." },
    { icon: "🏡", what: "Unterkünfte in Nationalpark-Orten", from: fmtDate(start, -330), until: fmtDate(start, -180), note: "Banff, Lake Louise, Jasper & Co. sind im Sommer früh ausgebucht – mit kostenloser Stornierung buchen." },
    { icon: "✈️", what: "Flüge", from: fmtDate(start, -early), until: fmtDate(start, -late), note: "In diesem Fenster sind die Preise meist am besten. Vorher beobachten, danach steigen sie." },
    { icon: "🚗", what: "Mietwagen", from: fmtDate(start, -270), until: fmtDate(start, -90), note: "Früh mit kostenloser Stornierung buchen und 6–8 bzw. 2–3 Wochen vorher nochmal vergleichen." },
    { icon: "🎟️", what: "Shuttles & Touren (Moraine Lake, Bootstouren)", from: fmtDate(start, -120), until: fmtDate(start, -30), note: "Die Parks-Canada-Shuttles öffnen meist im Frühjahr; ein Teil der Plätze wird 48 Stunden vorher freigegeben." }
  ];
  return items.filter(x => x.from || x.until);
}
