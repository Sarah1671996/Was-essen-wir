// Server-Teil der App „Was essen wir?“: verschickt Push-Benachrichtigungen.
// Läuft als Firebase Cloud Functions in Frankfurt (europe-west3), wie die Datenbank.
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { weekOf, openChores, responsibleFor } from "./cleaning-logic.js";

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

// 🛒 Neuer Eintrag auf der Einkaufsliste (nur an die, die das eingeschaltet haben)
export const onShoppingAdded = onDocumentCreated("rooms/{room}/shopping/{id}", async event => {
  const item = event.data?.data();
  if (!item) return;
  const { room } = event.params;
  const name = await memberName(room, item.by);
  const body = item.from ? `${name}: ${item.text} (für ${item.from})` : `${name}: ${item.text}`;
  const others = (await members(room)).filter(m => m.id !== item.by);
  await Promise.all(others.map(m => notify(room, m.id, "shopping",
    { title: "🛒 Neu auf der Einkaufsliste", body, tag: "shopping", tab: "shop" })));
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

// „Nochmal erinnern“-Knopf in der App
export const onPing = onDocumentCreated("rooms/{room}/pings/{id}", async event => {
  const ping = event.data?.data();
  if (!ping) return;
  try {
    await cleaningReminder(event.params.room, ping.by);
  } finally {
    await event.data.ref.delete();
  }
});
