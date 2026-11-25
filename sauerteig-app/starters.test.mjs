// node --test sauerteig-app/starters.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { newStarter, exampleStarter, starterInfo, starterReminders, dueList, parse, merge, buildSave, HOUR, DAY, MIN } from "./starters.js";

const T = Date.parse("2026-11-25T12:00:00Z");
const st = (u, x = {}) => ({ bread: "klassisch", temp: 22, u, ...x });
const all = d => Object.values(d.starters).flatMap(s => starterReminders(s, d.state.temp, T));

test("Version 1 wird ohne Verlust zu Starter s1", () => {
  const old = { state: { bread: "koerner" }, starter: { name: "Hermann", flour: "roggen", mode: "kuehlschrank", lastFed: new Date(T - DAY).toISOString(),
    fridgeSince: new Date(T - DAY).toISOString(), fridgeDays: 9, log: [{ type: "feed", t: new Date(T - DAY).toISOString() }], example: false } };
  const r = parse(JSON.stringify(old));
  assert.equal(r.starters.s1.name, "Hermann");
  assert.equal(r.starters.s1.fridgeDays, 9);
  assert.equal(r.starters.s1.u, T - DAY);
  assert.equal(r.starters.s1.example, undefined);
  assert.equal(r.state.bread, "koerner");
});

test("Neuere Fütterung gewinnt, egal von welchem Gerät und in welcher Reihenfolge", () => {
  const a = { state: st(1), starters: { s1: newStarter("s1", "weizen", T - DAY), g: newStarter("g", "glutenfrei", T) } };
  const b = { state: st(5, { bread: "oliven" }), starters: { s1: newStarter("s1", "weizen", T - HOUR) } };
  for (const m of [merge(a, b), merge(b, a)]) {
    assert.equal(m.starters.s1.u, T - HOUR);
    assert.ok(m.starters.g);
    assert.equal(m.state.bread, "oliven");
  }
  assert.deepEqual(merge(a, b), merge(b, a));
});

test("Gelöschter Starter kommt vom anderen Gerät nicht zurück", () => {
  const a = { state: st(1), starters: { s1: { id: "s1", del: true, u: T } } };
  const b = { state: st(1), starters: { s1: newStarter("s1", "weizen", T - DAY) } };
  assert.equal(merge(a, b).starters.s1.del, true);
});

test("Beispiel verschwindet, sobald es einen echten Starter gibt, und erinnert nie", () => {
  const a = { state: st(-1), starters: { s1: exampleStarter(T) } };
  const b = { state: st(1), starters: { x: newStarter("x", "roggen", T) } };
  assert.deepEqual(Object.keys(merge(a, b).starters), ["x"]);
  assert.deepEqual(starterReminders(exampleStarter(T), 22, T), []);
});

test("Jeder Starter hat eigene Erinnerungen; abgeschaltete nicht", () => {
  const d = { state: st(1), starters: {
    a: newStarter("a", "weizen", T), b: newStarter("b", "glutenfrei", T, { mode: "kuehlschrank", fridgeDays: 5 }), c: newStarter("c", "roggen", T, { remind: false }) } };
  const r = all(d);
  assert.deepEqual(r.map(x => x.tag), ["starter-a", "starter-a", "starter-b", "starter-b"]);
  assert.equal(r[0].at, T + DAY);
  assert.equal(r[2].at, T + 5 * DAY);
  assert.equal(r[2].view, "starter-b");
});

test("Vollkorn und glutenfrei werden bei Wärme früher fällig als Weizen", () => {
  assert.equal(starterInfo(newStarter("a", "weizen", T), 24, T).intervalMs, DAY);
  assert.equal(starterInfo(newStarter("a", "weizenvk", T), 24, T).intervalMs, 12 * HOUR);
  assert.equal(starterInfo(newStarter("a", "glutenfrei", T), 24, T).intervalMs, 12 * HOUR);
});

test("Fällige, noch nicht verschickte Erinnerung bleibt; verschickte kommt nicht wieder", () => {
  const d = { state: st(1), starters: { a: newStarter("a", "weizen", T - DAY - 2 * MIN) } };
  const [first, second] = all(d);
  assert.equal(dueList([first, second], [first, second], T).length, 2);
  assert.deepEqual(dueList([first, second], [second], T), [second]);
});

// Firestore-Ersatz mit zwei Geräten
const device = (doc, data) => ({ data, sync(now = T) {
  const r = buildSave(doc.v, this.data, all, now); this.data = r.data;
  if (r.doc) { doc.v = { ...(doc.v || {}), ...r.doc }; doc.writes++; } return r; } });

test("Altes Gerät überschreibt nichts Neues und löscht keine Erinnerungen", () => {
  const doc = { v: null, writes: 0 };
  const base = { state: st(1), starters: { s1: newStarter("s1", "weizen", T - 2 * DAY) } };
  const handy = device(doc, structuredClone(base)), pc = device(doc, structuredClone(base));
  handy.data.starters.s1 = newStarter("s1", "weizen", T - HOUR);
  handy.sync(); pc.sync();
  const now = parse(doc.v.j);
  assert.equal(now.starters.s1.u, T - HOUR);
  assert.equal(pc.data.starters.s1.u, T - HOUR);
  assert.equal(doc.v.due.length, 2);
});

test("Zwei Geräte schreiben sich nicht endlos hin und her", () => {
  const doc = { v: null, writes: 0 };
  const a = device(doc, { state: st(3), starters: { x: newStarter("x", "weizen", T) } });
  const b = device(doc, { state: st(3, { bread: "dinkel" }), starters: { y: newStarter("y", "roggen", T) } });
  for (let i = 0; i < 6; i++) { a.sync(); b.sync(); }
  const w = doc.writes;
  for (let i = 0; i < 6; i++) { a.sync(); b.sync(); }
  assert.equal(doc.writes, w);
  assert.ok(w <= 3);
  assert.deepEqual(Object.keys(parse(doc.v.j).starters).sort(), ["x", "y"]);
});

test("Alte App-Version, die nur einen Starter kennt, löscht die anderen nicht", () => {
  const doc = { v: null, writes: 0 };
  const neu = device(doc, { state: st(3), starters: { s1: newStarter("s1", "weizen", T), g: newStarter("g", "glutenfrei", T) } });
  neu.sync();
  doc.v.j = JSON.stringify({ state: { bread: "oliven" }, starter: { name: "alt", flour: "weizen", lastFed: new Date(T - DAY).toISOString(), log: [] } });
  neu.sync();
  assert.deepEqual(Object.keys(parse(doc.v.j).starters).sort(), ["g", "s1"]);
  assert.equal(parse(doc.v.j).starters.s1.u, T);
});

test("Nur geöffnet, nichts eingetragen: es wird nichts gespeichert", () => {
  const doc = { v: null, writes: 0 };
  device(doc, { state: st(-1), starters: { s1: exampleStarter(T) } }).sync();
  assert.equal(doc.writes, 0);
});
