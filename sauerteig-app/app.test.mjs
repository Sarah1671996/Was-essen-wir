// node --test sauerteig-app/app.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { BREADS, amounts, fromRecipe, toGrams, checkRecipe } from "./recipes.js";
import { buildPlan, tick, untick, later, allReminders, breadOf } from "./plan.js";
import { newStarter, peakMin, canMeasure, withPeak, tripAdvice, tripReminders, starterReminders, merge, parse, canonical, HOUR, DAY, MIN } from "./starters.js";

const T = new Date("2026-11-28T10:00").getTime();
const st = newStarter("a", "weizen", T - 5 * DAY);
const S = x => ({ bread: "klassisch", target: new Date(T), count: 1, weight: 1000, temp: 22, cold: true, coldH: 12, ...x });
const at = (p, k) => p.ev.find(e => e.key === k).time.getTime();
const MODES = [{ cold: true }, { cold: false }, { temp: 18 }, { temp: 28, cold: false }, { coldH: 6 }, { coldH: 18 }];

test("Zutaten ergeben bei jedem Brot zusammen die gewünschte Teigmenge", () => {
  for (const [k, b] of Object.entries(BREADS)) {
    const { F } = amounts(b, 2000);
    const sum = F * (b.flours.reduce((a, x) => a + x[1], 0) + b.liquids.reduce((a, x) => a + x[1], 0) + b.starter + b.salt + b.extras.flatMap(x => x.items).reduce((a, x) => a + x[1], 0)) / 100;
    assert.ok(Math.abs(sum - 2000) < 0.01, k);
    assert.equal(b.flours.reduce((a, x) => a + x[1], 0), 100, k);
    const am = amounts(b, 4800);
    assert.ok(5 * am.feed >= am.need + 20, k + ": Fütterung reicht");
  }
});

test("Jeder Plan ist in sich stimmig und endet am gewünschten Termin", () => {
  for (const b of Object.keys(BREADS)) for (const m of MODES) for (const mode of ["aktiv", "kuehlschrank"]) {
    const p = buildPlan(S({ ...m, bread: b }), { ...st, mode }, BREADS[b]), n = b + JSON.stringify(m) + mode;
    assert.equal(at(p, "bake"), T, n);
    for (const [x, y] of [["feed", "auto"], ["auto", "mix"], ["mix", "shape"], ["shape", "proof"], ["proof", "bake"], ["heat", "bake"], ["bake", "out"], ["out", "cut"]]) assert.ok(at(p, x) < at(p, y), n + x + y);
    const last = p.ev.filter(e => e.key.startsWith("fold")).pop();
    if (last) assert.ok(last.time.getTime() < at(p, "pre"), n + " Falten vor Vorformen");
    assert.equal(p.ev.some(e => e.key === "wake"), mode === "kuehlschrank");
  }
});

test("Glutenfrei: kein Falten, kein Vorformen, eigenes Mehl", () => {
  const p = buildPlan(S({ bread: "glutenfrei" }), newStarter("g", "glutenfrei", T), BREADS.glutenfrei);
  assert.ok(!p.ev.some(e => /fold|pre$/.test(e.key)));
  assert.ok(!/(?<!buch)weizen|dinkel|roggen/i.test(JSON.stringify(BREADS.glutenfrei.flours) + p.ev.map(e => e.det).join()));
});

test("Ein Haken zur geplanten Zeit verschiebt nichts", () => {
  for (const m of MODES) {
    const s = S(m), p0 = buildPlan(s, st, BREADS.klassisch);
    for (const e of p0.ev.filter(x => x.chain)) {
      const r = tick(s, st, BREADS.klassisch, e.key, e.time.getTime());
      const p1 = buildPlan({ ...s, run: r.run }, st, BREADS.klassisch);
      for (const x of p0.ev) assert.equal(at(p1, x.key), x.time.getTime(), e.key + "→" + x.key);
    }
  }
});

test("1 Stunde später gemischt: alles rückt nach, die Kühlschrank-Gare fängt es auf", () => {
  const s = S(), p0 = buildPlan(s, st, BREADS.klassisch);
  const p1 = buildPlan({ ...s, run: tick(s, st, BREADS.klassisch, "mix", at(p0, "mix") + HOUR).run }, st, BREADS.klassisch);
  for (const k of ["fold1", "fold4", "pre", "shape", "proof"]) assert.equal(at(p1, k) - at(p0, k), HOUR, k);
  assert.equal(at(p1, "bake"), T);
  assert.equal(at(p1, "heat"), T - HOUR);
});

test("Bei Raumtemperatur-Gare verschiebt sich auch das Backen samt Ofen", () => {
  const s = S({ cold: false }), p0 = buildPlan(s, st, BREADS.klassisch);
  const p1 = buildPlan({ ...s, run: tick(s, st, BREADS.klassisch, "mix", at(p0, "mix") + HOUR).run }, st, BREADS.klassisch);
  for (const k of ["bake", "heat", "out", "cut"]) assert.equal(at(p1, k) - at(p0, k), HOUR, k);
});

test("Sehr spät: mindestens 6 h Kühlschrank, dann verschiebt sich das Backen", () => {
  const s = S(), p0 = buildPlan(s, st, BREADS.klassisch);
  const p1 = buildPlan({ ...s, run: tick(s, st, BREADS.klassisch, "proof", at(p0, "proof") + 8 * HOUR).run }, st, BREADS.klassisch);
  assert.equal(at(p1, "bake") - at(p1, "proof"), 6 * HOUR);
});

test("Verspätetes Falten verlängert die Stockgare nicht", () => {
  const s = S(), p0 = buildPlan(s, st, BREADS.klassisch);
  const p1 = buildPlan({ ...s, run: tick(s, st, BREADS.klassisch, "fold1", at(p0, "fold1") + 20 * MIN).run }, st, BREADS.klassisch);
  assert.equal(at(p1, "fold2") - at(p0, "fold2"), 20 * MIN);
  assert.equal(at(p1, "pre"), at(p0, "pre"));
});

test("Später-Knopf, Rückgängig und vergessene frühere Haken", () => {
  const s = S({ cold: false }), b = BREADS.klassisch, p0 = buildPlan(s, st, b);
  const run = later(s, st, b, "mix", 30, at(p0, "auto"));
  assert.equal(at(buildPlan({ ...s, run }, st, b), "bake") - T, 30 * MIN);
  const heat = later(s, st, b, "heat", 30, at(p0, "proof"));
  const ph = buildPlan({ ...s, run: heat }, st, b);
  assert.equal(at(ph, "bake") - T, 30 * MIN);
  assert.equal(at(ph, "cut") - at(p0, "cut"), 30 * MIN);
  const r = tick(s, st, b, "fold2", at(p0, "fold2"));
  assert.deepEqual(r.auto.map(x => x.key), ["feed", "auto", "mix", "fold1"]);
  assert.equal(untick({ done: { feed: 1 }, moved: {} }, "feed"), null);
});

test("Starter wacht während des Backtags auf: der Plan bleibt gleich", () => {
  const cold = { ...st, mode: "kuehlschrank" }, s = S(), p0 = buildPlan(s, cold, BREADS.klassisch);
  const run = tick(s, cold, BREADS.klassisch, "wake", at(p0, "wake")).run;
  const p1 = buildPlan({ ...s, run }, { ...st, mode: "aktiv" }, BREADS.klassisch);
  assert.deepEqual(p1.ev.map(e => [e.key, +e.time]), p0.ev.map(e => [e.key, +e.time]));
});

test("Erinnerungen: erledigte Schritte nicht mehr, verschobene zur neuen Zeit", () => {
  const s = S({ bakeRemind: true, cold: false }), p0 = buildPlan(s, st, BREADS.klassisch);
  const run = tick(s, st, BREADS.klassisch, "mix", at(p0, "mix") + HOUR).run;
  const r = allReminders({ state: { ...s, run, target: s.target.toISOString() }, starters: { a: st }, recipes: {} }, T - 2 * DAY);
  assert.ok(!r.some(x => x.tag === "bake-mix" || x.tag === "bake-feed" || x.tag === "bake-quiet"));
  assert.equal(r.find(x => x.tag === "bake-bake").at, T + HOUR);
});

test("Höhepunkt: Messung zählt für den Plan und wird auf die Temperatur umgerechnet", () => {
  const x = { ...st, lastFed: new Date(T - 8 * HOUR).toISOString() };
  assert.ok(canMeasure(x, T));
  x.peaks = withPeak(x, 22, T);
  assert.ok(!canMeasure(x, T), "nur einmal pro Fütterung");
  assert.ok(Math.abs(peakMin(x, 22) - 480) < 0.5);
  assert.ok(peakMin(x, 26) < 480);
  assert.equal(Math.round(peakMin(st, 24)), 300);
  x.peaks = [{ h: 8, temp: 24 }, { h: 7, temp: 24 }, { h: 20, temp: 24 }];
  assert.equal(Math.round(peakMin(x, 24)), 480, "Ausreißer stört nicht");
  assert.ok(!canMeasure({ ...x, mode: "kuehlschrank" }, T));
});

test("Urlaub: Rat nach Länge, Ruhe währenddessen, Erinnerung davor und danach", () => {
  const trip = { from: "2026-12-20", to: "2026-12-25" };
  assert.equal(tripAdvice(st, trip).kind, "fridge");
  assert.equal(tripAdvice(newStarter("g", "glutenfrei", T), { from: "2026-12-20", to: "2026-12-28" }).kind, "stiff");
  assert.equal(tripAdvice(st, { from: "2026-12-20", to: "2027-01-10" }).kind, "dry");
  assert.equal(tripAdvice(st, { from: "2026-12-20", to: "2026-12-20" }), null);
  const x = { ...st, mode: "kuehlschrank", fridgeDays: 4, lastFed: new Date("2026-12-19T18:00").toISOString() };
  const r = starterReminders(x, 22, T, trip);
  assert.equal(r[0].at, new Date("2026-12-25T18:00").getTime());
  assert.ok(/Wieder da/.test(r[0].title));
  for (const y of r) assert.ok(y.at >= new Date("2026-12-25T18:00").getTime());
  assert.equal(tripReminders(x, trip)[0].at, new Date("2026-12-19T18:00").getTime());
  const spaet = { ...x, fridgeDays: 10 };
  assert.equal(starterReminders(spaet, 22, T, trip)[0].at, new Date("2026-12-29T18:00").getTime());
});

test("Eigene Rezepte: Vorlage aus jedem Brot ergibt wieder dieselben Verhältnisse", () => {
  for (const [k, b] of Object.entries(BREADS)) {
    const r = toGrams(b), x = fromRecipe({ id: "r", u: 1, ...r });
    assert.equal(checkRecipe(r), "", k);
    assert.ok(Math.abs(amounts(x, 1000).hydr - amounts(b, 1000).hydr) < 0.6, k);
    assert.equal(x.extras.flatMap(e => e.items).length, b.extras.flatMap(e => e.items).length, k);
    buildPlan(S(), st, x);
  }
  const r = { ...toGrams(BREADS.klassisch), name: "X" };
  assert.match(checkRecipe({ ...r, flours: [] }), /Mehl/);
  assert.match(checkRecipe({ ...r, starter: 0 }), /Anstellgut/);
  assert.equal(breadOf("weg", { weg: { id: "weg", del: true } }).name, "Klassisch");
});

test("Abgleich behält Rezepte, Tagebuch und Sammlungen neuerer App-Versionen", () => {
  const a = { state: { u: 1 }, starters: {}, recipes: { r: { id: "r", u: 5, name: "neu" } }, diary: {} };
  const b = { state: { u: 2 }, starters: { x: newStarter("x", "weizen", T) }, recipes: { r: { id: "r", u: 1, name: "alt" } }, diary: { d: { id: "d", u: 1 } }, zukunft: { z: { id: "z", u: 1 } } };
  const m = merge(a, b);
  assert.equal(m.recipes.r.name, "neu");
  assert.ok(m.diary.d && m.zukunft.z && m.starters.x);
  assert.equal(canonical(merge(b, a)), canonical(m));
  assert.equal(canonical(parse(canonical(m))), canonical(m));
});
