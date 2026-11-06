// Server-Teil der App „Was essen wir?“: verschickt Push-Benachrichtigungen.
// Läuft als Firebase Cloud Functions in Frankfurt (europe-west3), wie die Datenbank.
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentCreated, onDocumentWritten, onDocumentUpdated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { weekOf, openChores, responsibleFor } from "./cleaning-logic.js";
import { guessCat, splitQty, norm } from "./einkauf-cats.js";

initializeApp();
setGlobalOptions({ region: "europe-west3", maxInstances: 3 });
const db = getFirestore();

const APP_URL = "https://sarah1671996.github.io/Was-essen-wir/essen-match-app/";
// Gleiche Standardwerte wie in der App (PUSH_DEFAULTS in app.js)
const PUSH_DEFAULTS = { cleaning: true, todo: true, match: true, round: true, shopping: false };
const DEAD_TOKEN = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"];

async function memberName(room, uid) {
  const snap = await db.doc(`rooms/${room}/members/${uid}`).get();
  return snap.get("name") || "Jemand";
}
async function members(room) {
  return (await db.collection(`rooms/${room}/members`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
}

// Schickt eine Nachricht an alle Geräte der Person uid, falls ihre Einstellung `pref` eingeschaltet ist
async function notify(room, uid, pref, { title, body, tag, tab }) {
  const ref = db.doc(`rooms/${room}/tokens/${uid}`);
  const snap = await ref.get();
  const { tokens = [], prefs = {} } = snap.exists ? snap.data() : {};
  if (!tokens.length || !{ ...PUSH_DEFAULTS, ...prefs }[pref]) {
    logger.info("push übersprungen", { room, pref, reason: tokens.length ? "ausgeschaltet" : "keine Benachrichtigungen erlaubt" });
    return;
  }

  const res = await getMessaging().sendEachForMulticast({
    tokens,
    data: { title, body, tag: tag || "", link: APP_URL + (tab ? "#" + tab : "") },
    webpush: { headers: { Urgency: "high", TTL: "86400" } }
  });
  const dead = res.responses
    .map((r, i) => (!r.success && DEAD_TOKEN.includes(r.error?.code) ? tokens[i] : null))
    .filter(Boolean);
  if (dead.length) await ref.update({ tokens: FieldValue.arrayRemove(...dead) });
  logger.info("push", { room, pref, ok: res.successCount, failed: res.failureCount });
}

// 🎉 Neues Match: jemand hat ein Gericht geliked, das ein anderer in derselben Runde auch mag
export const onMatch = onDocumentWritten("rooms/{room}/members/{uid}", async event => {
  const before = event.data.before.data() || {};
  const after = event.data.after.data();
  if (!after) return;
  const { room, uid } = event.params;
  const round = after.round || 0;
  const roundChanged = (before.round || 0) !== round;
  const newLikes = Object.entries(after.votes || {})
    .filter(([id, v]) => v === 1 && (roundChanged || before.votes?.[id] !== 1))
    .map(([id]) => id);
  if (!newLikes.length) return;

  const others = (await members(room)).filter(m => m.id !== uid && (m.round || 0) === round);
  for (const m of others) {
    const matched = newLikes.filter(id => m.votes?.[id] === 1);
    if (!matched.length) continue;
    const names = await Promise.all(matched.map(async id =>
      (await db.doc(`rooms/${room}/dishes/${id}`).get()).get("name") || "ein Gericht"));
    await notify(room, m.id, "match", {
      title: "🎉 Neues Match!",
      body: `Du und ${after.name || "dein Schatz"} wollt beide: ${names.join(", ")}`,
      tag: "match", tab: "match"
    });
  }
});

// 🛒 Neuer Eintrag auf der Einkaufsliste: Benachrichtigung (nur wer es eingeschaltet hat)
// und, falls verbunden, auf die Liste der Einkaufs-App übertragen
export const onShoppingAdded = onDocumentCreated("rooms/{room}/shopping/{id}", async event => {
  const item = event.data?.data();
  if (!item) return;
  const { room } = event.params;
  const name = await memberName(room, item.by);
  const body = item.from ? `${name}: ${item.text} (für ${item.from})` : `${name}: ${item.text}`;
  const others = (await members(room)).filter(m => m.id !== item.by);
  await Promise.all([
    ...others.map(m => notify(room, m.id, "shopping",
      { title: "🛒 Neu auf der Einkaufsliste", body, tag: "shopping", tab: "shop" })),
    pushToEinkauf(room, event.data.ref, item, name)
  ]);
});

/* ---------- Brücke zur Einkaufs-App (households/<code>) ----------
   bridges/<room>        { house, storeId, storeName }   Essens-Küche → Familienliste
   bridgeHouses/<house>  { room, storeId }               Rückweg
   Beide Sammlungen sind für Handys gesperrt (keine Regel); der Code der Familienliste
   erreicht so nie das Handy des Partners. Verknüpft wird pro Eintrag über shopping.extId. */
const bridgeOf = async room => (await db.doc(`bridges/${room}`).get()).data() || null;

async function pushToEinkauf(room, ref, item, name) {
  const bridge = await bridgeOf(room);
  if (!bridge || item.extId || item.done) return;
  const house = db.doc(`households/${bridge.house}`);
  const [known, custom] = await Promise.all([
    house.collection("known").get().then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
    house.collection("categories").get().then(s => s.docs.map(d => ({ id: d.id, ...d.data() })))
  ]);
  const { qty, text } = splitQty(item.text);
  // Schon offen auf der Liste? Dann nur verknüpfen statt doppelt anlegen
  const open = await house.collection("items").where("storeId", "==", bridge.storeId).where("done", "==", false).get();
  const same = open.docs.find(d => norm(d.get("text") || "") === norm(text));
  let extId = same?.id;
  if (!extId) {
    const note = `von ${name} (Essens-App)${item.from ? ", für " + item.from : ""}`.slice(0, 200);
    const created = await house.collection("items").add({
      text: text.slice(0, 100), qty: qty.slice(0, 30), note, cat: guessCat(text, known, custom),
      storeId: bridge.storeId, done: false, urgent: false, by: null, at: Date.now()
    });
    extId = created.id;
  }
  await ref.update({ extId });
  logger.info("einkauf übertragen", { room, linked: !!same });
}

// Abhaken/Löschen in der Essens-App → Einkaufs-App
export const onShoppingChanged = onDocumentUpdated("rooms/{room}/shopping/{id}", async event => {
  const before = event.data.before.data(), after = event.data.after.data();
  if (!after.extId || before.done === after.done) return;
  const bridge = await bridgeOf(event.params.room);
  if (!bridge) return;
  const ref = db.doc(`households/${bridge.house}/items/${after.extId}`);
  const snap = await ref.get();
  if (!snap.exists || snap.get("done") === !!after.done) return;
  await ref.update(after.done ? { done: true, doneBy: null, doneAt: Date.now(), missing: false } : { done: false });
});
export const onShoppingRemoved = onDocumentDeleted("rooms/{room}/shopping/{id}", async event => {
  const item = event.data?.data();
  if (!item?.extId || item.done) return; // Erledigtes bleibt drüben, bis dort aufgeräumt wird
  const bridge = await bridgeOf(event.params.room);
  if (!bridge) return;
  const ref = db.doc(`households/${bridge.house}/items/${item.extId}`);
  const snap = await ref.get();
  if (snap.exists && !snap.get("done")) await ref.delete();
});

// Abhaken/Löschen in der Einkaufs-App → Essens-App
export const onEinkaufItem = onDocumentWritten("households/{house}/items/{id}", async event => {
  const link = (await db.doc(`bridgeHouses/${event.params.house}`).get()).data();
  if (!link) return;
  const found = await db.collection(`rooms/${link.room}/shopping`).where("extId", "==", event.params.id).limit(1).get();
  if (found.empty) return;
  const ours = found.docs[0];
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (!after) {
    // Drüben gelöscht: abgehakt + aufgeräumt → bei uns abhaken, sonst ebenfalls entfernen
    const wasDone = event.data.before.get("done");
    if (wasDone) { if (!ours.get("done")) await ours.ref.update({ done: true, doneAt: Date.now(), doneBy: null }); }
    else await ours.ref.delete();
    return;
  }
  if (!!after.done !== !!ours.get("done")) {
    await ours.ref.update(after.done
      ? { done: true, doneAt: after.doneAt || Date.now(), doneBy: null, doneElsewhere: true }
      : { done: false, doneElsewhere: false });
  }
});

// Verbinden/Trennen: die App legt rooms/<room>/linkRequests/<id> { house, by } an
export const onLinkRequest = onDocumentCreated("rooms/{room}/linkRequests/{id}", async event => {
  const req = event.data?.data();
  const { room } = event.params;
  const status = db.doc(`rooms/${room}/meta/einkauf`);
  try {
    const old = await bridgeOf(room);
    if (!req?.house) { // Trennen
      if (old) await Promise.all([db.doc(`bridges/${room}`).delete(), db.doc(`bridgeHouses/${old.house}`).delete()]);
      await status.set({ connected: false, at: Date.now(), by: req?.by || null });
      return;
    }
    const house = String(req.house).trim().toLowerCase();
    const hs = await db.doc(`households/${house}`).get();
    if (!hs.exists || hs.get("closedAt")) {
      await status.set({ connected: !!old, storeName: old?.storeName || null, error: "Diesen Code gibt es in der Einkaufs-App nicht.", at: Date.now() });
      return;
    }
    const stores = (await hs.ref.collection("stores").get()).docs;
    const store = stores.find(s => norm(s.get("name") || "").includes("kaufland"));
    if (!store) {
      await status.set({ connected: !!old, storeName: old?.storeName || null, error: "In der Einkaufs-App gibt es keine Kaufland-Liste.", at: Date.now() });
      return;
    }
    if (old && old.house !== house) await db.doc(`bridgeHouses/${old.house}`).delete();
    const bridge = { house, storeId: store.id, storeName: store.get("name") };
    await Promise.all([
      db.doc(`bridges/${room}`).set(bridge),
      db.doc(`bridgeHouses/${house}`).set({ room, storeId: store.id })
    ]);
    await status.set({ connected: true, storeName: bridge.storeName, at: Date.now(), by: req.by || null });
    // Was schon offen auf unserer Liste steht, gleich mit übertragen
    const open = await db.collection(`rooms/${room}/shopping`).where("done", "==", false).get();
    for (const d of open.docs) {
      if (!d.get("extId")) await pushToEinkauf(room, d.ref, d.data(), await memberName(room, d.get("by")));
    }
  } finally {
    await event.data?.ref.delete();
  }
});

// ✎ Jemand legt für eine andere Person ein To-do an (private To-dos liegen woanders und lösen nichts aus)
export const onTodoAdded = onDocumentCreated("rooms/{room}/todos/{id}", async event => {
  const todo = event.data?.data();
  if (!todo?.for || todo.for === todo.by) return;
  const { room } = event.params;
  const name = await memberName(room, todo.by);
  const due = todo.due ? ` (bis ${todo.due.split("-").reverse().join(".")})` : "";
  await notify(room, todo.for, "todo", { title: `✎ Neues To-do von ${name}`, body: todo.text + due, tag: "todo", tab: "todo" });
});

// 🔄 Neue Runde gestartet
export const onNewRound = onDocumentWritten("rooms/{room}/meta/round", async event => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!after || (before && before.n === after.n)) return;
  const { room } = event.params;
  const name = await memberName(room, after.by);
  const others = (await members(room)).filter(m => m.id !== after.by);
  await Promise.all(others.map(m => notify(room, m.id, "round",
    { title: "🔄 Neue Runde!", body: `${name} hat eine neue Runde gestartet. Jetzt swipen!`, tag: "round", tab: "swipe" })));
});

// 🧽 Putzplan: Erinnerung an die Person, die diese Woche dran ist, falls noch etwas offen ist
async function cleaningReminder(room, byUid = null) {
  const config = (await db.doc(`rooms/${room}/cleaning/config`).get()).data();
  const wk = weekOf();
  const who = responsibleFor(config, wk);
  if (!who || who === byUid) return;
  const chores = (await db.collection(`rooms/${room}/chores`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const open = openChores(chores, wk);
  logger.info("putzplan", { room, week: wk.key, open: open.length, manual: !!byUid });
  if (!open.length) return;
  const title = byUid ? `🔔 ${await memberName(room, byUid)} erinnert dich ans Putzen` : "🧽 Du bist diese Woche mit Putzen dran";
  await notify(room, who, "cleaning", {
    title, body: `Noch offen: ${open.map(c => c.title).join(", ")}`, tag: "cleaning", tab: "clean"
  });
}

// Täglich um 17 Uhr deutscher Zeit
export const dailyCleaning = onSchedule({ schedule: "0 17 * * *", timeZone: "Europe/Berlin" }, async () => {
  const configs = await db.collectionGroup("cleaning").get();
  for (const d of configs.docs) {
    if (d.id !== "config") continue;
    await cleaningReminder(d.ref.parent.parent.id).catch(e => logger.error("cleaning", e));
  }
});

// Test-Benachrichtigung an das eigene Gerät; das Ergebnis landet in meta/pushtest_<uid>,
// damit die App anzeigen kann, woran es hakt
async function pushTest(room, uid) {
  const result = { at: Date.now(), tokens: 0, sent: 0, failed: 0, errors: [] };
  const ref = db.doc(`rooms/${room}/tokens/${uid}`);
  const snap = await ref.get();
  const tokens = snap.exists ? snap.get("tokens") || [] : [];
  result.tokens = tokens.length;
  if (tokens.length) {
    const res = await getMessaging().sendEachForMulticast({
      tokens,
      data: { title: "🔔 Test-Benachrichtigung", body: "Wenn du das liest, funktionieren die Benachrichtigungen.", tag: "test", link: APP_URL + "#home" },
      webpush: { headers: { Urgency: "high", TTL: "600" } }
    });
    result.sent = res.successCount;
    result.failed = res.failureCount;
    result.errors = res.responses.filter(r => !r.success).map(r => r.error?.code || "unbekannt");
    const dead = res.responses.map((r, i) => (!r.success && DEAD_TOKEN.includes(r.error?.code) ? tokens[i] : null)).filter(Boolean);
    if (dead.length) await ref.update({ tokens: FieldValue.arrayRemove(...dead) });
  }
  logger.info("pushtest", { room, ...result });
  await db.doc(`rooms/${room}/meta/pushtest_${uid}`).set(result);
}

// „Nochmal erinnern“-Knopf (kind "cleaning") und Test-Benachrichtigung (kind "test")
export const onPing = onDocumentCreated("rooms/{room}/pings/{id}", async event => {
  const ping = event.data?.data();
  if (!ping) return;
  try {
    if (ping.kind === "test") await pushTest(event.params.room, ping.by);
    else await cleaningReminder(event.params.room, ping.by);
  } finally {
    await event.data.ref.delete();
  }
});
