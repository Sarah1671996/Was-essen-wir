// Einkaufslisten von der Kommandozeile aus lesen und ändern, z. B. wenn Claude im Chat etwas eintragen soll.
// Spricht direkt mit Firestore (REST), mit derselben anonymen Anmeldung und denselben Regeln wie die App.
//
//   node einkauf-app/cli.mjs code <code> [name]          Familienliste verbinden (Code steht in der App unter ⚙)
//   node einkauf-app/cli.mjs liste [laden]               Offene Einträge aller Läden oder eines Ladens
//   node einkauf-app/cli.mjs neu <laden> "<a, b, c>" [--dringend] [--notiz "…"]
//   node einkauf-app/cli.mjs ab <laden> "<eintrag>"      Abhaken (zurueck = wieder auf die Liste)
//   node einkauf-app/cli.mjs weg <laden> "<eintrag>"     Löschen
//   node einkauf-app/cli.mjs verschieben <von> "<eintrag>" <nach>
//   node einkauf-app/cli.mjs aufraeumen <laden>          Abgehakte Einträge entfernen
//   node einkauf-app/cli.mjs laden-neu <name>
//
// Einstellungen liegen in ~/.einkauf.json (nicht im Repo, der Code ist der Schlüssel zur Liste).
// Alternativ über Umgebungsvariablen EINKAUF_CODE und EINKAUF_NAME.
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { firebaseConfig } from "../essen-match-app/firebase-config.js";
import { allCats, norm, keyOf, guessCat, splitQty } from "./cats.js";

const CONFIG = join(homedir(), ".einkauf.json");
const COLORS = ["#c0392b", "#d9822b", "#c9a227", "#2e8b57", "#1f7a8c", "#2f5aa8", "#7b4fa8", "#b0487a", "#6b6b6b"];

function loadConfig() {
  let c = {};
  try { c = JSON.parse(readFileSync(CONFIG, "utf8")); } catch {}
  if (process.env.EINKAUF_CODE) c.code = process.env.EINKAUF_CODE;
  if (process.env.EINKAUF_NAME) c.name = process.env.EINKAUF_NAME;
  return c;
}
const saveConfig = c => { try { writeFileSync(CONFIG, JSON.stringify(c, null, 2)); } catch {} };
const cfg = loadConfig();

function die(msg) { console.error(msg); process.exit(1); }

/* ---------- Anmeldung (anonym, Token wird wiederverwendet) ---------- */
async function auth() {
  const key = firebaseConfig.apiKey;
  if (cfg.refreshToken) {
    const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${key}`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(cfg.refreshToken)
    });
    if (r.ok) { const j = await r.json(); return { token: j.id_token, uid: j.user_id }; }
  }
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${key}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ returnSecureToken: true })
  });
  if (!r.ok) die("Anmeldung bei Firebase fehlgeschlagen: " + (await r.text()));
  const j = await r.json();
  cfg.refreshToken = j.refreshToken;
  saveConfig(cfg);
  return { token: j.idToken, uid: j.localId };
}

/* ---------- Firestore REST ---------- */
const enc = v => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
  return { stringValue: String(v) };
};
const dec = f => {
  if ("stringValue" in f) return f.stringValue;
  if ("booleanValue" in f) return f.booleanValue;
  if ("integerValue" in f) return Number(f.integerValue);
  if ("doubleValue" in f) return f.doubleValue;
  if ("mapValue" in f) return Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, x]) => [k, dec(x)]));
  return null;
};
const fields = data => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)]));

let session;
function db() {
  const base = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/households/${cfg.code}`;
  async function call(method, path, body) {
    const r = await fetch(base + path, {
      method, headers: { authorization: "Bearer " + session.token, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    if (r.status === 404 && method === "GET" && !path) return null;
    if (!r.ok) die(`Firestore-Fehler (${r.status}): ${await r.text()}`);
    return r.status === 204 ? null : r.json();
  }
  const mask = data => Object.keys(data).map(k => "updateMask.fieldPaths=" + encodeURIComponent(k)).join("&");
  return {
    exists: async () => !!(await call("GET", "")),
    async list(col) {
      const out = [];
      let page = "";
      do {
        const j = await call("GET", `/${col}?pageSize=300${page ? "&pageToken=" + page : ""}`);
        for (const d of j.documents || []) out.push({ id: d.name.split("/").pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, dec(v)])) });
        page = j.nextPageToken;
      } while (page);
      return out;
    },
    add: (col, data) => call("POST", `/${col}`, { fields: fields(data) }),
    set: (col, id, data) => call("PATCH", `/${col}/${encodeURIComponent(id)}`, { fields: fields(data) }),
    update: (col, id, data) => call("PATCH", `/${col}/${id}?${mask(data)}&currentDocument.exists=true`, { fields: fields(data) }),
    remove: (col, id) => call("DELETE", `/${col}/${id}`)
  };
}

/* ---------- Hilfen ---------- */
function findStore(stores, name) {
  if (!name) die("Welcher Laden? Vorhanden: " + stores.map(s => s.name).join(", "));
  const q = norm(name);
  const hit = stores.find(s => norm(s.name) === q) || stores.filter(s => norm(s.name).startsWith(q)).at(0)
    || stores.filter(s => norm(s.name).includes(q)).at(0);
  if (!hit) die(`Laden „${name}“ gibt es nicht. Vorhanden: ${stores.map(s => s.name).join(", ") || "(keine)"}. Neu anlegen mit: laden-neu ${name}`);
  return hit;
}
function findItem(items, text, storeName) {
  const q = norm(splitQty(text).text);
  const exact = items.filter(i => norm(i.text) === q);
  if (exact.length) return exact[0];
  const part = items.filter(i => norm(i.text).includes(q));
  if (part.length === 1) return part[0];
  if (part.length > 1) die(`„${text}“ ist nicht eindeutig: ${part.map(i => i.text).join(", ")}`);
  die(`„${text}“ steht nicht auf der Liste für ${storeName}.`);
}
const memberName = (members, uid) => members.find(m => m.id === uid)?.name || "?";
const day = ts => ts ? new Date(ts).toLocaleString("de-DE", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

function printStore(s, items, members, detail, custom) {
  const list = allCats(custom), known = new Set(list.map(c => c.id));
  // Reihenfolge der Abteilungen, wie sie für den Laden festgelegt wurde
  const order = s.catOrder || [];
  const sorted = [...list].sort((a, b) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    return (ia < 0 ? 99 + list.indexOf(a) : ia) - (ib < 0 ? 99 + list.indexOf(b) : ib);
  });
  const open = items.filter(i => i.storeId === s.id && !i.done);
  const done = items.filter(i => i.storeId === s.id && i.done);
  console.log(`\n${s.name}: ${open.length ? open.length + " offen" : "nichts offen"}${done.length ? `, ${done.length} abgehakt` : ""}`);
  const groups = [{ name: "Dringend", list: open.filter(i => i.urgent) },
    ...sorted.map(c => ({ name: c.name, list: open.filter(i => !i.urgent && (known.has(i.cat) ? i.cat : "sonst") === c.id) }))];
  for (const g of groups) {
    if (!g.list.length) continue;
    if (detail) console.log(`  ${g.name}:`);
    for (const i of g.list.sort((a, b) => a.at - b.at)) {
      const extra = [!detail && i.urgent ? "dringend" : "", i.note, i.missing ? "gab's nicht" : "", i.photo ? "mit Foto" : "", detail ? `von ${memberName(members, i.by)}, ${day(i.at)}` : ""].filter(Boolean);
      console.log(`  ${detail ? "  " : ""}- ${i.qty ? i.qty + " " : ""}${i.text}${extra.length ? ` (${extra.join("; ")})` : ""}`);
    }
  }
  if (detail && done.length) console.log(`  Abgehakt: ${done.map(i => i.text).join(", ")}`);
}

/* ---------- Befehle ---------- */
const [cmd, ...rest] = process.argv.slice(2);
const flags = { dringend: false, notiz: "" };
const args = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--dringend") flags.dringend = true;
  else if (rest[i] === "--notiz") flags.notiz = rest[++i] || "";
  else args.push(rest[i]);
}

if (!cmd || cmd === "hilfe") {
  console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").filter(l => l.startsWith("//")).slice(0, 13).map(l => l.slice(3)).join("\n"));
  process.exit(0);
}

if (cmd === "code") {
  if (!/^[a-z0-9]{10}$/.test(args[0] || "")) die("Der Code hat 10 Zeichen (in der App unter ⚙ → Code).");
  cfg.code = args[0];
  if (args[1]) cfg.name = args.slice(1).join(" ");
}
if (!cfg.code) die("Noch keine Familienliste verbunden. Den Code aus der App (⚙ → Code) eintragen mit: node einkauf-app/cli.mjs code <code> [dein Name]");

session = await auth();
const d = db();
if (!(await d.exists())) die(`Die Familienliste mit dem Code ${cfg.code} gibt es nicht.`);
const name = (cfg.name || "Claude") + " (über Claude)";
await d.set("members", session.uid, { name, seenAt: Date.now() });

if (cmd === "code") {
  saveConfig(cfg);
  console.log(`Verbunden. Einträge erscheinen in der App als „${name}“.`);
  process.exit(0);
}

const [stores, items, members, custom] = await Promise.all([d.list("stores"), d.list("items"), d.list("members"), d.list("categories")]);
stores.sort((a, b) => (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0));

switch (cmd) {
  case "liste": {
    if (args[0]) printStore(findStore(stores, args[0]), items, members, true, custom);
    else if (!stores.length) console.log("Noch keine Läden angelegt.");
    else stores.forEach(s => printStore(s, items, members, false, custom));
    break;
  }
  case "neu": {
    const s = findStore(stores, args[0]);
    const known = await d.list("known");
    const open = new Set(items.filter(i => i.storeId === s.id && !i.done).map(i => norm(i.text)));
    const added = [], skipped = [];
    // Mehrere Einträge mit Komma oder Zeilenumbruch getrennt
    for (const raw of args.slice(1).join(",").split(/[,\n]/).map(x => x.trim()).filter(Boolean)) {
      const { qty, text } = splitQty(raw);
      if (open.has(norm(text))) { skipped.push(text); continue; }
      const cat = guessCat(text, known, custom);
      const now = Date.now() + added.length;
      await d.add("items", { text, qty, note: flags.notiz, cat, storeId: s.id, done: false, urgent: flags.dringend, by: session.uid, at: now });
      const k = known.find(x => x.id === keyOf(text));
      await d.set("known", keyOf(text), { text, cat, count: (k?.count || 0) + 1, last: now, stores: { ...(k?.stores || {}), [s.id]: now } });
      open.add(norm(text));
      added.push((qty ? qty + " " : "") + text);
    }
    if (added.length) console.log(`Auf ${s.name}: ${added.join(", ")}${flags.dringend ? " (dringend)" : ""}`);
    if (skipped.length) console.log(`Stand schon drauf: ${skipped.join(", ")}`);
    if (!added.length && !skipped.length) die("Was soll auf die Liste?");
    break;
  }
  case "ab":
  case "zurueck": {
    const s = findStore(stores, args[0]);
    const i = findItem(items.filter(x => x.storeId === s.id && x.done === (cmd === "zurueck")), args.slice(1).join(" "), s.name);
    await d.update("items", i.id, cmd === "ab" ? { done: true, doneBy: session.uid, doneAt: Date.now(), missing: false } : { done: false });
    console.log(cmd === "ab" ? `Abgehakt: ${i.text} (${s.name})` : `Wieder auf der Liste: ${i.text} (${s.name})`);
    break;
  }
  case "weg": {
    const s = findStore(stores, args[0]);
    const i = findItem(items.filter(x => x.storeId === s.id), args.slice(1).join(" "), s.name);
    await d.remove("items", i.id);
    console.log(`Gelöscht: ${i.text} (${s.name})`);
    break;
  }
  case "verschieben": {
    const from = findStore(stores, args[0]), to = findStore(stores, args[2]);
    const i = findItem(items.filter(x => x.storeId === from.id && !x.done), args[1] || "", from.name);
    await d.update("items", i.id, { storeId: to.id });
    console.log(`${i.text}: von ${from.name} nach ${to.name} verschoben`);
    break;
  }
  case "aufraeumen": {
    const s = findStore(stores, args[0]);
    const done = items.filter(x => x.storeId === s.id && x.done);
    // Wie in der App: abgehakte Einträge wandern in den Verlauf
    for (const i of done) {
      await d.set("history", crypto.randomUUID().replace(/-/g, "").slice(0, 20), {
        text: i.text, qty: i.qty || "", cat: i.cat, storeId: i.storeId, by: i.by, at: i.at,
        doneBy: i.doneBy || session.uid, doneAt: i.doneAt || Date.now()
      });
      await d.remove("items", i.id);
    }
    console.log(`${done.length} abgehakte Einträge bei ${s.name} in den Verlauf gelegt`);
    break;
  }
  case "laden-neu": {
    const n = args.join(" ").trim();
    if (!n) die("Wie heißt der Laden?");
    if (stores.some(s => norm(s.name) === norm(n))) die(`${n} gibt es schon.`);
    const used = new Set(stores.map(s => s.color));
    const now = Date.now();
    await d.add("stores", { name: n, color: COLORS.find(c => !used.has(c)) || COLORS[0], createdAt: now, order: now, by: session.uid });
    console.log(`Laden angelegt: ${n}`);
    break;
  }
  default:
    die(`Unbekannter Befehl „${cmd}“. Hilfe: node einkauf-app/cli.mjs hilfe`);
}
