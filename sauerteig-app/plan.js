// Zeitplan: rückwärts vom Ofen gerechnet, und Verschieben, wenn Schritte früher oder später erledigt werden.
// Reine Funktionen, getestet in app.test.mjs.
import { MIN, HOUR, DAY, flourOf, peakMin, starterReminders, tripReminders } from "./starters.js";
import { BREADS, fromRecipe, amounts } from "./recipes.js";

const add = (d, m) => new Date(d.getTime() + m * MIN);
const roundTo = (d, step = 5) => new Date(Math.round(d.getTime() / (step * MIN)) * step * MIN);
export const dur = m => { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? h + " h " + r + " min" : h + " h") : r + " min"; };
const de = x => String(x).replace(".", ",");
export const COLD_MIN = 6, COLD_MAX = 18; // Stunden im Kühlschrank, in denen der Teig gut bleibt

export function breadOf(id, recipes = {}) {
  const own = recipes[id];
  return BREADS[id] || (own && !own.del ? fromRecipe(own) : BREADS.klassisch);
}

// Plan ohne Haken. Jeder Schritt hat einen festen key und after = wovon er abhängt.
function basePlan(s, starter, b, fridge) {
  const f = Math.pow(1.09, 24 - s.temp);
  const bulkMin = (b.gf ? 180 : 270) * f * b.bulk, peak = peakMin(starter, s.temp);
  const proofMin = s.cold ? s.coldH * 60 : 100 * f * b.bulk, shapeMin = b.shape || 15;
  const bakeMin = b.bake.reduce((a, x) => a + x[1], 0);

  const bake = s.target, proof = roundTo(add(bake, -proofMin)), shape = roundTo(add(proof, -shapeMin));
  const pre = b.gf ? shape : add(shape, -30);
  const bulk = roundTo(add(pre, -bulkMin)), mix = add(bulk, -15), auto = add(mix, b.gf ? -15 : -45);
  const feed = roundTo(add(mix, -peak), 15), end = add(bake, bakeMin);
  const refs = { mix: [mix, "mix"], bulk: [bulk, "mix"], shape: [shape, "shape"], bake: [bake, "bake"], end: [end, "out"] };

  const ev = [], E = (key, time, title, det, kind = "act", x = {}) => ev.push({ key, time, title, det, kind, chain: true, after: [], ...x });
  const am = amounts(b, s.count * s.weight), need = am.need >= 50 ? Math.round(am.need / 5) * 5 : Math.round(am.need);
  const nm = starter?.name || "Anstellgut", mehl = flourOf(starter || {}).mehl;

  if (fridge) {
    const w = Math.max(20, Math.ceil((am.feed + 10) / 25) * 5); // 1:2:2 muss für die zweite Fütterung reichen
    E("wake", roundTo(add(feed, -12 * 60), 15), `${nm} aus dem Kühlschrank holen`,
      `Auf ca. ${w} g abnehmen, mit ${2 * w} g ${mehl} und ${2 * w} g Wasser füttern und bei Raumtemperatur stehen lassen.`, "starter", { feeds: "wake" });
  }
  E("feed", feed, fridge ? `${nm} ein zweites Mal füttern` : `${nm} füttern`,
    `${am.feed} g Anstellgut + ${2 * am.feed} g ${mehl} + ${2 * am.feed} g Wasser verrühren (1:2:2). Bei ${de(s.temp)} °C ist er nach etwa ${dur(peak)} auf dem Höhepunkt.`,
    "starter", { after: fridge ? ["wake"] : [], feeds: "feed" });
  if (b.gf) E("auto", auto, "Flohsamenschalen quellen lassen", "Flohsamenschalen mit Wasser, Öl und Honig kräftig verrühren, bis ein Gel entsteht. 15 min stehen lassen.", "act", { after: ["feed"] });
  else E("auto", auto, "Autolyse: Mehl + Wasser mischen",
    `Mehl und Wasser (ohne Salz und Anstellgut) grob verrühren, 45 min abgedeckt ruhen lassen. ${b.autoDet || ""}`.trim(), "act", { after: ["feed"] });
  E("mix", mix, b.gf ? "Teig mischen" : "Anstellgut und Salz einarbeiten",
    (b.gf ? `Mehle, Salz und ${need} g aktives Anstellgut mit dem Gel 5 min kräftig verrühren. Der Teig ist weich und klebrig, das gehört so.`
          : `${need} g aktives Anstellgut und das Salz 5–8 min einkneten.`)
    + ` ${b.mixDet || ""} Den Rest vom Starter (ca. 20 g) behalten und füttern.`.replace(/ +/g, " "), "act", { after: ["auto", "feed"] });
  E("rest", add(mix, 20), "Rest-Starter versorgen",
    "Rest mit Mehl und Wasser 1:2:2 füttern. Backst du die nächsten Tage nicht, nach 1–2 h in den Kühlschrank stellen und im Tab „Meine Starter“ eintragen.",
    "starter", { after: ["mix"], chain: false, feeds: "feed" });

  const folds = b.gf ? 0 : b.folds || 4;
  for (let i = 1; i <= folds; i++) E("fold" + i, add(bulk, 30 * i), `${i}. Dehnen & Falten`,
    i === 1 && b.foldIn ? b.foldIn : "Teig von allen Seiten hochziehen und übereinanderlegen, 4 Runden.", "act", { after: [i === 1 ? "mix" : "fold" + (i - 1)] });
  E("quiet", add(bulk, folds ? 30 * folds + 5 : 5), "Teig in Ruhe gehen lassen",
    `Abgedeckt bei ${de(s.temp)} °C stehen lassen. Gesamte Stockgare ca. ${dur(bulkMin)}. ` + (b.gf
      ? "Fertig, wenn der Teig um etwa ein Drittel gewachsen ist und kleine Blasen zeigt."
      : "Fertig, wenn der Teig um 50–75 % gewachsen ist, Blasen zeigt und wackelt."), "wait", { after: [folds ? "fold" + folds : "mix"], chain: false, silent: true });
  if (!b.gf) E("pre", pre, "Vorformen", "Teig auf die Arbeitsfläche geben, rund vorformen, 30 min entspannen lassen.", "act", { after: ["mix"] });
  E("shape", shape, b.gf ? "Formen" : "Formen und ins Gärkörbchen", b.shapeDet || (b.gf
    ? "Mit nassen Händen formen und in eine gefettete Kastenform oder ein bemehltes Gärkörbchen legen."
    : "Straff formen, mit der Naht nach oben in das bemehlte Gärkörbchen legen."), "act", { after: [b.gf ? "mix" : "pre"] });
  E("proof", proof, s.cold ? "Ab in den Kühlschrank" : "Stückgare bei Raumtemperatur",
    s.cold ? `Abgedeckt bei 4–6 °C ca. ${dur(proofMin)} gehen lassen. Wird direkt aus dem Kühlschrank gebacken.`
           : `Abgedeckt ca. ${dur(proofMin)} gehen lassen. ${b.gf ? "Fertig, wenn feine Risse an der Oberfläche erscheinen." : "Fingertest: Delle springt langsam zurück."}`,
    "wait", { after: ["shape"] });
  E("heat", add(bake, -60), "Ofen vorheizen", `Gusseisentopf mit Deckel bei ${b.bake[0][0]} °C Ober-/Unterhitze 60 min aufheizen.`, "act", { chain: false });
  E("bake", bake, "Einschießen und backen",
    b.bake.filter(x => x[1] > 0).map(x => `${x[1]} min bei ${x[0]} °C ${x[2] ? "mit Deckel" : "ohne Deckel"}`).join(", ") + (b.gf ? "." : ". Vorher einschneiden."), "bake", { after: ["proof"] });
  E("out", end, "Brot aus dem Ofen", b.gf ? "Klopftest: Es klingt hohl. Kerntemperatur ca. 98 °C." : "Klopftest: Es klingt hohl. Kerntemperatur ca. 96 °C.", "bake", { after: ["bake"] });
  (b.prep || []).forEach((p, i) => { const [t, k] = refs[p.ref]; E("prep" + i, roundTo(add(t, p.min)), p.title, p.det, "act", { after: [k], chain: false }); });
  E("cut", add(end, b.cut || 90), "Anschneiden", "Vorher auf einem Gitter auskühlen lassen, sonst wird die Krume klebrig.", "wait", { after: ["out"], chain: false });
  return { ev, folds };
}

// Fertiger Plan. s.run = laufender Backtag { fridge, done: {key: ms}, moved: {key: ms} } oder null.
//   done   wann ein Schritt wirklich erledigt wurde; alles Spätere rückt entsprechend nach
//   moved  „später“: frühestens dann
export function buildPlan(s, starter, b) {
  const run = s.run || null, done = run?.done || {}, moved = run?.moved || {};
  const fridge = run ? !!run.fridge : starter?.mode === "kuehlschrank";
  const { ev, folds } = basePlan(s, starter, b, fridge);
  const base = Object.fromEntries(ev.map(e => [e.key, e])), memo = {};
  const gap = (a, k) => base[k].time - base[a].time;

  const t = k => {
    if (k in memo) return memo[k];
    const e = base[k];
    let x;
    if (k in done) x = done[k];
    else {
      if (k === "pre") { // die Stockgare zählt ab dem Mischen; ein verspätetes Falten verlängert sie nicht
        x = t("mix") + gap("mix", "pre");
        if (folds) x = Math.max(x, t("fold" + folds) + Math.min(30 * MIN, gap("fold" + folds, "pre")));
      } else if (k === "bake") {
        // Kalte Gare ist dehnbar: der Backtermin bleibt, solange der Teig 6–18 h kühl steht
        if (!run || !s.cold) x = t("proof") + gap("proof", "bake");
        else x = Math.min(Math.max(e.time.getTime(), t("proof") + Math.min(COLD_MIN, s.coldH) * HOUR), t("proof") + Math.max(COLD_MAX, s.coldH) * HOUR);
        if (done.heat) x = Math.max(x, done.heat + 60 * MIN);
      } else if (k === "heat") {
        x = Math.max(t("bake") - 60 * MIN, 0);
      } else x = e.after.length ? Math.max(...e.after.map(a => t(a) + gap(a, k))) : e.time.getTime();
      if (moved[k]) x = Math.max(x, moved[k]);
    }
    return memo[k] = x;
  };
  ev.forEach(e => { e.plan = e.time; });
  const out = ev.map(e => ({ ...e, time: new Date(t(e.key)), done: e.key in done, order: ev.indexOf(e) }));
  // „Ofen später“ muss auch das Backen mitnehmen
  if (moved.heat && !("bake" in done)) {
    const late = moved.heat + 60 * MIN - t("bake");
    if (late > 0) out.forEach(e => { if (["bake", "out", "cut"].includes(e.key) || e.after.includes("out")) if (!e.done) e.time = new Date(e.time.getTime() + late); });
  }
  out.sort((a, c) => a.time - c.time || a.order - c.order);
  out.forEach(e => { const h = e.time.getHours(); e.night = e.kind !== "wait" && !e.done && (h >= 23 || h < 6); });
  const time = k => out.find(e => e.key === k).time;
  return { ev: out, start: out[0].time, bake: time("bake"), end: time("out"), last: out[out.length - 1].time,
    next: out.find(e => !e.done && !e.silent) || null, total: out.filter(e => !e.silent).length, doneCount: out.filter(e => e.done).length };
}

// Haken setzen. Frühere Hauptschritte ohne Haken gelten dann auch als erledigt.
export function tick(s, starter, b, key, at) {
  const p = buildPlan(s, starter, b), run = s.run || { fridge: starter?.mode === "kuehlschrank", done: {}, moved: {} };
  const done = { ...run.done }, e = p.ev.find(x => x.key === key), auto = [];
  if (e.chain) for (const x of p.ev) if (x.chain && !x.done && x.order < e.order) { done[x.key] = Math.min(x.time.getTime(), at); auto.push(x); }
  done[key] = at;
  return { run: { ...run, done }, auto, step: e };
}
export function untick(run, key) {
  const { [key]: _, ...done } = run.done;
  return Object.keys(done).length || Object.keys(run.moved).length ? { ...run, done } : null;
}
export function later(s, starter, b, key, minutes, now) {
  const p = buildPlan(s, starter, b), run = s.run || { fridge: starter?.mode === "kuehlschrank", done: {}, moved: {} };
  const e = p.ev.find(x => x.key === key);
  return { ...run, moved: { ...run.moved, [key]: Math.max(e.time.getTime(), now) + minutes * MIN } };
}

// Alle Erinnerungen zu einem Datenstand { state, starters, recipes }
export function allReminders(data, now) {
  const st = data.state || {}, temp = st.temp ?? 22;
  const alive = Object.values(data.starters).filter(x => !x.del);
  const list = alive.flatMap(x => [...starterReminders(x, temp, now, st.trip), ...tripReminders(x, st.trip)]);
  if (st.bakeRemind && st.target) {
    const s = { ...st, target: new Date(st.target) };
    const starter = alive.find(x => x.id === s.starterId) || alive[0];
    for (const e of buildPlan(s, starter, breadOf(s.bread, data.recipes)).ev) if (!e.done && !e.silent)
      list.push({ at: e.time.getTime(), title: e.title, body: e.det.slice(0, 300), tag: "bake-" + e.key, view: "backen", fed: false });
  }
  return list;
}
