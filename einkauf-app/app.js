import { createStore, hasFirebase, randomCode } from "./store.js";
import { allCats, norm, keyOf, guessCat as guessFrom, splitQty } from "./cats.js";

const $ = s => document.querySelector(s);
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};

const COLORS = ["#c0392b", "#d9822b", "#c9a227", "#2e8b57", "#1f7a8c", "#2f5aa8", "#7b4fa8", "#b0487a", "#6b6b6b"];
const STORE_NAMES = ["Kaufland", "Netto", "Edeka", "Aldi", "Lidl", "Rewe", "Penny", "dm", "Rossmann", "Apotheke", "Bäcker", "Wochenmarkt", "Drogerie", "Baumarkt"];

const S = {
  uid: null, code: null, name: "",
  stores: [], items: [], members: [], known: [], receipts: [], cats: [],
  view: "home",           // home | list | money
  current: null,          // geöffneter Laden (id)
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // Ausgaben: angezeigter Monat
  visitSeen: 0,
  seen: JSON.parse(ls.get("ek.seen") || "{}") // wann ich welchen Laden zuletzt angeschaut habe
};
let store, house, unsubs = [];

/* ---------- kleine Helfer ---------- */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const guessCat = text => guessFrom(text, S.known, S.cats);
// Was unter "Sonstiges" gelandet ist, wird mit der aktuellen Erkennung neu einsortiert (z. B. ältere "Entenbrust")
const shownCat = i => catById(i.cat) && i.cat !== "sonst" ? i.cat : guessCat(i.text);
// Alle Abteilungen: feste und selbst angelegte
const cats = () => allCats(S.cats);
const catById = id => cats().find(c => c.id === id);
function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; }

function toast(msg, action) {
  const t = $("#toast"), btn = $("#toastAction");
  $("#toastText").textContent = msg;
  btn.hidden = !action;
  if (action) { btn.textContent = action.label; btn.onclick = () => { t.classList.remove("show"); action.run(); }; }
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), action ? 5000 : 2600);
}
const fail = what => () => toast(what + " hat nicht geklappt. Bist du online?");

const nameOf = uid => uid === S.uid ? "dir" : (S.members.find(m => m.id === uid)?.name || "jemandem");
function when(ts) {
  if (!ts) return "";
  const d = new Date(ts), now = new Date();
  const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const days = Math.round((new Date(now.toDateString()) - new Date(d.toDateString())) / 864e5);
  if (days === 0) return "heute " + time;
  if (days === 1) return "gestern " + time;
  if (days < 7) return d.toLocaleDateString("de-DE", { weekday: "long" });
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

// Nur Werte anzeigen, die die App selbst erzeugt: Fotos als eingebettetes JPEG, Farben als #rrggbb.
// So kann auch ein manipulierter Eintrag keine fremden Seiten laden oder das Layout kapern.
const safePhoto = p => typeof p === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p) ? p : null;
const safeColor = c => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#6b6b6b";
const euro = cents => (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const uid20 = () => randomCode(20);

const storeById = id => S.stores.find(s => s.id === id);
// Abteilungen in der Reihenfolge, die für diesen Laden festgelegt wurde
function catsFor(s) {
  const order = s?.catOrder || [];
  const list = cats();
  return [...list].sort((a, b) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    return (ia < 0 ? 99 + list.indexOf(a) : ia) - (ib < 0 ? 99 + list.indexOf(b) : ib);
  });
}
// Wer ist gerade unterwegs bzw. hat vor kurzem eingekauft
const TRIP_HOURS = 4, DONE_HOURS = 8;
function tripOf(m) {
  const t = m.trip;
  if (!t || !storeById(t.storeId)) return null;
  const age = (Date.now() - (t.state === "fertig" ? t.doneAt : t.at)) / 36e5;
  return age < (t.state === "fertig" ? DONE_HOURS : TRIP_HOURS) ? t : null;
}
const myTrip = () => tripOf(S.members.find(m => m.id === S.uid) || {});
const itemsOf = id => S.items.filter(i => i.storeId === id);
const openOf = id => itemsOf(id).filter(i => !i.done);
// Wer braucht den Eintrag (uid → eigene Menge)? Ohne "wants" nur die Person, die ihn eingetragen hat
const wantsOf = i => i.wants && Object.keys(i.wants).length ? i.wants : { [i.by]: i.qty || splitQty(i.text).qty };
// Gleicher Eintrag? Ohne Menge, Groß/Klein, Satzzeichen und einfache Mehrzahl ("Möhre"/"Möhren", "Entenbrust 2x"/"entenbrust")
const sameKey = text => norm(splitQty(text).text).replace(/[^\p{L}\p{N}]+/gu, "").replace(/(en|n|e|s)$/, "");
const forName = uid => uid === S.uid ? "dich" : (S.members.find(m => m.id === uid)?.name || "jemanden");
// Gesamtmenge: "", "", "2x" → "4x"; sonst nebeneinander, z. B. "1l + 1"
function sumQty(wants) {
  const v = Object.values(wants).map(q => (q || "").trim());
  if (v.length < 2) return v[0] || "";
  if (v.every(q => /^(\d+\s*x?)?$/i.test(q))) return `${v.reduce((t, q) => t + (parseInt(q) || 1), 0)}x`;
  return v.map(q => q || "1").join(" + ");
}
const sortedStores = () => [...S.stores].sort((a, b) => (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0));

/* ---------- Einrichtung ---------- */
async function boot() {
  applyBigText(ls.get("ek.bigText") === "1");
  applySimple(ls.get("ek.simple") === "1");
  try {
    store = await createStore();
  } catch (e) {
    console.error(e);
    showSetup("Keine Verbindung zur Datenbank. Prüf das Internet und lade neu.");
    return;
  }
  S.uid = store.uid;
  S.name = ls.get("ek.name") || "";

  const invite = new URLSearchParams(location.search).get("join");
  const saved = ls.get("ek.code");
  if (saved && !invite) return enter(saved);
  if (saved && invite === saved) { history.replaceState(null, "", location.pathname); return enter(saved); }
  showSetup("", invite);
}

function showSetup(err = "", invite = null) {
  $("#app").hidden = true;
  $("#setup").hidden = false;
  $("#setupName").value = S.name;
  $("#setupError").textContent = err;
  $("#demoNote").hidden = hasFirebase;
  $("#setupInvite").hidden = !invite;
  $("#setupChoice").hidden = !!invite;
  $("#setupJoinInvite").onclick = () => join(invite);
}

function takeName() {
  const n = $("#setupName").value.trim();
  if (!n) { $("#setupError").textContent = "Bitte gib zuerst deinen Namen ein."; $("#setupName").focus(); return null; }
  S.name = n; ls.set("ek.name", n);
  return n;
}

$("#setupCreate").onclick = async () => {
  if (!takeName() || !store) return;
  const code = randomCode(10);
  try { await store.create(code); } catch (e) { console.error(e); $("#setupError").textContent = "Anlegen hat nicht geklappt. Bist du online?"; return; }
  enter(code);
};
$("#setupJoin").onclick = () => join($("#setupCode").value.trim().toLowerCase());
$("#setupCode").onkeydown = e => { if (e.key === "Enter") $("#setupJoin").click(); };

async function join(code) {
  if (!takeName() || !store) return;
  if (!/^[a-z0-9]{10}$/.test(code || "")) { $("#setupError").textContent = "Der Code hat 10 Zeichen."; return; }
  try {
    if (!(await store.exists(code))) { $("#setupError").textContent = "Diesen Code gibt es nicht (mehr). Tippfehler, oder wurde ein neuer Code erzeugt?"; return; }
  } catch (e) { console.error(e); $("#setupError").textContent = "Keine Verbindung. Bist du online?"; return; }
  history.replaceState(null, "", location.pathname);
  enter(code);
}

function enter(code) {
  S.code = code; ls.set("ek.code", code);
  house = store.open(code);
  if (!S.name) { showSetup(); return; }
  house.patch("members", S.uid, { name: S.name, seenAt: Date.now() }).catch(() => {});

  const onErr = e => { console.error(e); toast("Verbindung unterbrochen. Änderungen werden nachgeholt."); };
  unsubs.forEach(u => u());
  unsubs = [
    house.watch("stores", l => { S.stores = l; renderAll(); }, onErr),
    house.watch("items", l => { S.items = l; renderAll(); }, onErr),
    house.watch("members", l => { S.members = l; renderMembers(); renderAll(); }, onErr),
    house.watch("known", l => { S.known = l; if (S.current) renderOften(); }, onErr),
    house.watch("receipts", l => { S.receipts = l; renderAll(); }, onErr),
    house.watch("categories", l => { S.cats = l; renderAll(); if ($("#storeDlg").open) syncOrder(); }, onErr),
    house.watchHouse(h => { if (h?.closedAt) houseClosed(); }, onErr)
  ];

  $("#setup").hidden = true;
  $("#app").hidden = false;
  $("#hello").textContent = `Hallo ${S.name}`;
  const fromHash = decodeURIComponent(location.hash.slice(1));
  if (fromHash === "ausgaben") setView("money", null, true);
  else showView(fromHash || null, true);
}

/* ---------- Ansichten ---------- */
function setView(view, storeId = null, replace = false) {
  if (S.current) markSeen(S.current);
  applyView(view, storeId);
  const hash = view === "list" ? "#" + encodeURIComponent(storeId) : view === "money" ? "#ausgaben" : "";
  const url = location.pathname + location.search + hash;
  if (replace) history.replaceState({ v: view, s: storeId }, "", url);
  else history.pushState({ v: view, s: storeId }, "", url);
  // Angefangener Text bleibt pro Laden liegen, auch wenn die App zwischendurch geschlossen wird
  if (S.current) { $("#addInput").value = ls.get("ek.draft." + S.current) || ""; hideSuggest(); }
  document.querySelectorAll(".scroll").forEach(s => { s.scrollTop = 0; });
}
function applyView(view, storeId) {
  S.view = view;
  S.current = view === "list" ? storeId : null;
  if (S.current) { S.visitSeen = S.seen[S.current] || 0; markSeen(S.current); }
  $("#home").hidden = view !== "home";
  $("#list").hidden = view !== "list";
  $("#money").hidden = view !== "money";
  wakeLock(view === "list");
  renderAll();
}
const showView = (storeId, replace = false) => setView(storeId ? "list" : "home", storeId, replace);
window.addEventListener("popstate", e => {
  if (S.current) markSeen(S.current);
  const st = e.state || {};
  applyView(st.v || (st.s ? "list" : "home"), st.s || null);
});
// Zurück: echte Browser-Historie nutzen, wenn wir selbst dorthin navigiert sind
const goHome = () => history.state?.v && history.state.v !== "home" && history.length > 1 ? history.back() : showView(null, true);
$("#backBtn").onclick = goHome;
$("#moneyBack").onclick = goHome;
$("#moneyBtn").onclick = () => setView("money");

function markSeen(id) {
  S.seen[id] = Date.now();
  ls.set("ek.seen", JSON.stringify(S.seen));
}
// Während ich eine Liste anschaue, gilt als "neu", was seit meinem vorigen Besuch dazukam
const isNew = i => i.by !== S.uid && i.at > (i.storeId === S.current ? S.visitSeen : S.seen[i.storeId] || 0);

function renderAll() {
  if (S.current && !storeById(S.current) && S.stores.length) { showView(null, true); return; }
  if (S.view === "list") renderList();
  else if (S.view === "money") renderMoney();
  else renderHome();
}

/* ---------- Übersicht ---------- */
// "Sarah ist gerade bei Kaufland" / "Sarah hat bei Kaufland eingekauft"
function tripBanner(m, t, here = false) {
  const s = storeById(t.storeId);
  const who = m.id === S.uid ? "Du" : m.name;
  const b = el(here ? "div" : "button", "trip" + (t.state === "fertig" ? " finished" : ""));
  b.style.setProperty("--c", safeColor(s.color));
  const icon = el("span", "tripicon", t.state === "fertig" ? "✅" : "🛒");
  const txt = el("span", "triptext");
  if (t.state === "fertig") {
    txt.appendChild(el("strong", "", `${who} ${m.id === S.uid ? "hast" : "hat"} bei ${s.name} eingekauft`));
    txt.appendChild(el("span", "small", `${when(t.doneAt)}${t.count ? ` · ${t.count} ${t.count === 1 ? "Sache" : "Sachen"}` : ""}`));
    if (t.msg) txt.appendChild(el("span", "tripmsg", `„${t.msg}“`));
  } else {
    txt.appendChild(el("strong", "", here && m.id !== S.uid
      ? `${who} ist gerade hier einkaufen`
      : `${who} ${m.id === S.uid ? "bist" : "ist"} gerade bei ${s.name}`));
    txt.appendChild(el("span", "small", m.id === S.uid ? `seit ${when(t.at)}` : `seit ${when(t.at)} · trag schnell ein, was noch fehlt`));
  }
  b.append(icon, txt);
  if (!here) b.onclick = () => showView(s.id);
  return b;
}

function renderHome() {
  const trips = $("#trips");
  trips.textContent = "";
  S.members.forEach(m => { const t = tripOf(m); if (t) trips.appendChild(tripBanner(m, t)); });

  const openList = S.receipts.filter(r => !r.settled);
  const open = openList.reduce((sum, r) => sum + (r.amount || 0), 0);
  $("#moneyBtn").classList.toggle("due", open > 0);
  $("#moneyTitle").textContent = open ? `${euro(open)} noch offen` : "Ausgaben";
  renderPay($("#payBox"));
  $("#moneySummary").textContent = open
    ? `${openList.length} ${openList.length === 1 ? "Kassenbon" : "Kassenbons"} noch nicht erstattet`
    : "Alles erstattet · Kassenbons ansehen";

  const box = $("#stores");
  box.textContent = "";
  for (const s of sortedStores()) {
    const open = openOf(s.id);
    const card = el("button", "store");
    card.style.setProperty("--c", safeColor(s.color));
    const head = el("div", "storehead");
    head.appendChild(el("span", "storename", s.name));
    const count = el("span", "count", open.length ? String(open.length) : "✓");
    if (!open.length) count.classList.add("empty");
    head.appendChild(count);
    card.appendChild(head);

    const news = open.filter(isNew);
    const urgent = open.filter(i => i.urgent);
    const preview = [...urgent, ...open.filter(i => !i.urgent)].slice(0, 4).map(i => i.text).join(" · ");
    card.appendChild(el("p", "preview", open.length ? preview + (open.length > 4 ? " …" : "") : "Nichts zu holen"));
    if (news.length || urgent.length) {
      const tags = el("div", "tags");
      if (urgent.length) tags.appendChild(el("span", "tag urgent", `${urgent.length} dringend`));
      if (news.length) tags.appendChild(el("span", "tag new", `${news.length} neu von ${nameOf(news[0].by)}`));
      card.appendChild(tags);
    }
    card.onclick = () => showView(s.id);
    box.appendChild(card);
  }

  // Am Anfang Läden zum Antippen anbieten
  const few = S.stores.length < 3;
  $("#storeSuggest").hidden = !few;
  if (few) {
    const chips = $("#storeSuggestChips");
    chips.textContent = "";
    const taken = new Set(S.stores.map(x => norm(x.name)));
    STORE_NAMES.filter(n => !taken.has(norm(n))).slice(0, 9).forEach(n => {
      const c = el("button", "chip", n);
      c.onclick = () => createStore_(n);
      chips.appendChild(c);
    });
  }
}

async function createStore_(name, color, catOrder = null) {
  const used = new Set(S.stores.map(s => s.color));
  const pick = color || COLORS.find(c => !used.has(c)) || COLORS[hash(name) % COLORS.length];
  const now = Date.now();
  try { await house.add("stores", { name, color: pick, createdAt: now, order: now, by: S.uid, catOrder }); }
  catch (e) { console.error(e); fail("Anlegen")(); }
}

/* ---------- Laden-Dialog ---------- */
let editStore = null, pickedColor = COLORS[0];
function openStoreDlg(s = null) {
  editStore = s;
  $("#storeDlgTitle").textContent = s ? "Laden bearbeiten" : "Neuer Laden";
  $("#sName").value = s?.name || "";
  $("#sDelete").hidden = !s;
  $("#sError").textContent = "";
  const used = new Set(S.stores.map(x => x.color));
  pickedColor = s?.color || COLORS.find(c => !used.has(c)) || COLORS[0];

  const chips = $("#sNameChips");
  chips.textContent = "";
  chips.hidden = !!s;
  const taken = new Set(S.stores.map(x => norm(x.name)));
  STORE_NAMES.filter(n => !taken.has(norm(n))).forEach(n => {
    const c = el("button", "chip", n);
    c.type = "button";
    c.onclick = () => { $("#sName").value = n; };
    chips.appendChild(c);
  });
  renderSwatches();
  editOrder = catsFor(s).map(c => c.id);
  renderOrder();
  $("#storeDlg").showModal();
}
// Reihenfolge der Abteilungen: einmal mit ↑ ↓ festlegen, wird am Laden gespeichert
let editOrder = [];
function renderOrder() {
  const box = $("#sOrder");
  box.textContent = "";
  editOrder.forEach((id, n) => {
    const c = catById(id);
    const li = el("li", "catrow");
    li.appendChild(el("span", "catname", `${c.emoji} ${c.name}`));
    // Eigene Abteilungen lassen sich umbenennen oder löschen
    if (c.custom) {
      const edit = el("button", "iconbtn small", "✎");
      edit.type = "button";
      edit.setAttribute("aria-label", `${c.name} bearbeiten`);
      edit.onclick = () => openCatDlg(S.cats.find(x => x.id === id));
      li.appendChild(edit);
    }
    const move = (d, label, sym) => {
      const b = el("button", "iconbtn small", sym);
      b.type = "button";
      b.setAttribute("aria-label", `${c.name} ${label}`);
      b.disabled = n + d < 0 || n + d >= editOrder.length;
      b.onclick = () => { [editOrder[n], editOrder[n + d]] = [editOrder[n + d], editOrder[n]]; renderOrder(); };
      return b;
    };
    li.append(move(-1, "nach oben", "↑"), move(1, "nach unten", "↓"));
    box.appendChild(li);
  });
}
// Neue oder gelöschte eigene Abteilungen in die gerade bearbeitete Reihenfolge übernehmen
function syncOrder() {
  const ids = cats().map(c => c.id);
  editOrder = editOrder.filter(id => ids.includes(id));
  ids.filter(id => !editOrder.includes(id)).forEach(id => {
    const at = editOrder.indexOf("sonst");
    editOrder.splice(at < 0 ? editOrder.length : at, 0, id);
  });
  renderOrder();
}
$("#sAddCat").onclick = () => openCatDlg(null);

/* ---------- Eigene Abteilungen ---------- */
const CAT_EMOJIS = ["🏷️", "🐾", "💊", "🌸", "🍷", "🥚", "🧂", "🍝", "🧃", "🍎", "🧻", "🎁", "🌱", "👶", "🧹", "🔧"];
let editCat = null, catEmoji = CAT_EMOJIS[0], catDone = null;
function openCatDlg(c, onDone = null) {
  editCat = c; catDone = onDone;
  catEmoji = c?.emoji || CAT_EMOJIS[0];
  $("#catTitle").textContent = c ? "Abteilung bearbeiten" : "Neue Abteilung";
  $("#cName").value = c?.name || "";
  $("#cWords").value = c?.words || "";
  $("#cDelete").hidden = !c;
  $("#cError").textContent = "";
  renderCatEmojis();
  $("#catDlg").showModal();
}
function renderCatEmojis() {
  const box = $("#cEmojis");
  box.textContent = "";
  CAT_EMOJIS.forEach(e => {
    const b = el("button", "chip emoji" + (e === catEmoji ? " on" : ""), e);
    b.type = "button";
    b.onclick = () => { catEmoji = e; renderCatEmojis(); };
    box.appendChild(b);
  });
}
$("#cCancel").onclick = () => $("#catDlg").close();
$("#catForm").onsubmit = async e => {
  e.preventDefault();
  const name = $("#cName").value.trim();
  if (!name) return;
  if (cats().some(c => c.id !== editCat?.id && norm(c.name) === norm(name))) { $("#cError").textContent = "Diese Abteilung gibt es schon."; return; }
  const data = { name, emoji: catEmoji, words: $("#cWords").value.trim() };
  try {
    let id = editCat?.id;
    if (editCat) await house.update("categories", id, data);
    else {
      const full = { ...data, createdAt: Date.now(), by: S.uid };
      id = await house.add("categories", full);
      // sofort verfügbar machen, auch wenn die Datenbank-Meldung noch unterwegs ist
      if (!S.cats.some(x => x.id === id)) S.cats = [...S.cats, { id, ...full }];
    }
    $("#catDlg").close();
    toast(editCat ? "Abteilung geändert" : `Abteilung „${name}“ angelegt`);
    catDone?.(id);
  } catch (err) { console.error(err); $("#cError").textContent = "Speichern hat nicht geklappt."; }
};
$("#cDelete").onclick = async () => {
  const c = editCat, n = S.items.filter(i => i.cat === c.id).length;
  if (!confirm(`Abteilung „${c.name}“ löschen?` + (n ? ` ${n} Einträge landen dann unter „Sonstiges“.` : ""))) return;
  try {
    await house.batch([
      { type: "delete", c: "categories", id: c.id },
      ...S.items.filter(i => i.cat === c.id).map(i => ({ type: "update", c: "items", id: i.id, data: { cat: "sonst" } }))
    ]);
    $("#catDlg").close();
  } catch (err) { console.error(err); $("#cError").textContent = "Löschen hat nicht geklappt."; }
};
function renderSwatches() {
  const box = $("#sColors");
  box.textContent = "";
  COLORS.forEach(c => {
    const b = el("button", "swatch" + (c === pickedColor ? " on" : ""));
    b.type = "button";
    b.style.background = c;
    b.setAttribute("aria-label", "Farbe " + c);
    b.onclick = () => { pickedColor = c; renderSwatches(); };
    box.appendChild(b);
  });
}
$("#newStoreBtn").onclick = () => openStoreDlg();
$("#storeEditBtn").onclick = () => openStoreDlg(storeById(S.current));
$("#sCancel").onclick = () => $("#storeDlg").close();
$("#storeForm").onsubmit = async e => {
  e.preventDefault();
  const name = $("#sName").value.trim();
  if (!name) return;
  if (S.stores.some(x => x.id !== editStore?.id && norm(x.name) === norm(name))) { $("#sError").textContent = "Diesen Laden gibt es schon."; return; }
  try {
    if (editStore) await house.update("stores", editStore.id, { name, color: pickedColor, catOrder: editOrder });
    else await createStore_(name, pickedColor, editOrder);
    $("#storeDlg").close();
  } catch (err) { console.error(err); $("#sError").textContent = "Speichern hat nicht geklappt."; }
};
$("#sDelete").onclick = async () => {
  const s = editStore, n = itemsOf(s.id).length;
  if (!confirm(`„${s.name}“ löschen?` + (n ? ` Die ${n} Einträge darauf werden auch gelöscht.` : ""))) return;
  try {
    await house.batch([{ type: "delete", c: "stores", id: s.id }, ...itemsOf(s.id).map(i => ({ type: "delete", c: "items", id: i.id }))]);
    $("#storeDlg").close();
    showView(null, true);
  } catch (err) { console.error(err); $("#sError").textContent = "Löschen hat nicht geklappt."; }
};

/* ---------- Liste ---------- */
function renderList() {
  const s = storeById(S.current);
  if (!s) { $("#listTitle").textContent = "…"; return; }
  $("#listTitle").textContent = s.name;
  $("#listTop").style.setProperty("--c", safeColor(s.color));
  document.querySelector("#list").style.setProperty("--c", safeColor(s.color));

  const box = $("#items");
  box.textContent = "";
  const all = itemsOf(s.id);
  const open = all.filter(i => !i.done), done = all.filter(i => i.done);
  $("#listSub").textContent = open.length || done.length
    ? [open.length ? `${open.length} offen` : "alles besorgt", done.length ? `${done.length} im Wagen` : ""].filter(Boolean).join(" · ")
    : "";

  if (!all.length) {
    box.appendChild(el("div", "notice", `Die Liste für ${s.name} ist leer. Schreib oben rein, was fehlt. Alle sehen es sofort.`));
  }

  renderTripBar(s);

  // Dringendes ganz oben, der Rest nach Abteilungen in der Reihenfolge des Ladens
  const groups = [{ label: "❗ Dringend", list: open.filter(i => i.urgent) }, ...catsFor(s).map(cat => ({
    label: `${cat.emoji} ${cat.name}`,
    list: open.filter(i => !i.urgent && shownCat(i) === cat.id)
  }))];
  for (const g of groups) {
    if (!g.list.length) continue;
    box.appendChild(el("p", "sectionlabel", g.label));
    const ul = el("ul", "items");
    g.list.sort((a, b) => a.at - b.at).forEach(i => ul.appendChild(itemRow(i)));
    box.appendChild(ul);
  }

  if (done.length) {
    const head = el("div", "donehead");
    head.appendChild(el("p", "sectionlabel", `Im Wagen (${done.length})`));
    const clear = el("button", "btn ghost small", "Erledigte entfernen");
    clear.onclick = clearDone;
    head.appendChild(clear);
    box.appendChild(head);
    const ul = el("ul", "items done");
    done.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).forEach(i => ul.appendChild(itemRow(i)));
    box.appendChild(ul);
  }
  $("#swipeHint").hidden = !open.length || ls.get("ek.swiped") === "1";
  renderOften();
}

// Leiste unter dem Kopf: "Ich gehe los" / "Fertig eingekauft" / wer gerade hier ist
function renderTripBar(s) {
  const bar = $("#tripBar");
  bar.textContent = "";
  S.members.filter(m => m.id !== S.uid).forEach(m => {
    const t = tripOf(m);
    if (t && t.storeId === s.id) bar.appendChild(tripBanner(m, t, true));
  });
  const mine = myTrip();
  const row = el("div", "triprow adv");
  if (mine?.state === "los" && mine.storeId === s.id) {
    row.appendChild(el("span", "small", `Du bist unterwegs, seit ${when(mine.at)}`));
    const fin = el("button", "btn small", "✅ Fertig eingekauft");
    fin.onclick = openFinish;
    const stop = el("button", "btn ghost small", "Doch nicht");
    stop.onclick = () => house.patch("members", S.uid, { trip: null }).catch(fail("Speichern"));
    row.append(stop, fin);
  } else {
    const go = el("button", "btn ghost small", `🛒 Ich gehe jetzt zu ${s.name}`);
    go.onclick = () => house.patch("members", S.uid, { trip: { storeId: s.id, at: Date.now(), state: "los" } })
      .then(() => toast("Die anderen sehen jetzt, dass du unterwegs bist"))
      .catch(fail("Speichern"));
    row.appendChild(go);
  }
  bar.appendChild(row);
}

// Nach rechts wischen = abhaken (bzw. bei Erledigtem: wieder auf die Liste)
function swipeable(li, row, onSwipe) {
  let x0 = 0, y0 = 0, dx = 0, active = false, decided = false, swiped = false;
  const LIMIT = 90;
  li.addEventListener("touchstart", e => {
    const t = e.touches[0];
    x0 = t.clientX; y0 = t.clientY; dx = 0; active = true; decided = false; swiped = false;
  }, { passive: true });
  li.addEventListener("touchmove", e => {
    if (!active) return;
    const t = e.touches[0], mx = t.clientX - x0, my = t.clientY - y0;
    if (!decided) {
      if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
      decided = true;
      if (Math.abs(my) > Math.abs(mx) || mx < 0) { active = false; return; } // Scrollen hat Vorrang
    }
    dx = Math.max(0, mx);
    row.style.transform = `translateX(${dx}px)`;
    li.classList.toggle("ready", dx > LIMIT);
  }, { passive: true });
  li.addEventListener("touchend", () => {
    if (!active) return;
    active = false;
    row.style.transform = "";
    li.classList.remove("ready");
    if (dx > LIMIT) { swiped = true; ls.set("ek.swiped", "1"); onSwipe(); }
  });
  // Nach dem Wischen kein "Antippen" auslösen
  li.addEventListener("click", e => { if (swiped) { e.stopPropagation(); e.preventDefault(); swiped = false; } }, true);
}

function showPhoto(src) {
  if (!safePhoto(src)) return;
  $("#photoBig").src = src;
  $("#photoDlg").showModal();
}
$("#photoClose").onclick = () => $("#photoDlg").close();
$("#photoDlg").onclick = e => { if (e.target.id !== "photoClose") $("#photoDlg").close(); };

function itemRow(i) {
  const li = el("li", "swipe");
  li.appendChild(el("span", "swipebg", i.done ? "↩ wieder auf die Liste" : "✓ abhaken"));
  const row = el("div", "item" + (i.done ? " isdone" : "") + (i.urgent ? " urgent" : "") + (i.missing ? " missing" : ""));
  li.appendChild(row);
  swipeable(li, row, () => toggleDone(i));
  const check = el("button", "tick");
  check.setAttribute("aria-label", i.done ? `${i.text} wieder auf die Liste` : `${i.text} abhaken`);
  check.setAttribute("aria-pressed", i.done ? "true" : "false");
  check.onclick = () => toggleDone(i);
  row.appendChild(check);

  const body = el("button", "itembody");
  body.setAttribute("aria-label", `${i.text} bearbeiten`);
  const line = el("span", "itemline");
  // Menge steht rechts; ältere Einträge wie "Maggi 2x" werden beim Anzeigen auch aufgeteilt
  const p = splitQty(i.text);
  const shown = { text: p.text, qty: [i.qty, p.qty].filter(Boolean).join(" · ") };
  line.appendChild(el("span", "itemtext", shown.text));
  if (shown.qty) line.appendChild(el("span", "qty", shown.qty));
  body.appendChild(line);
  if (i.note) body.appendChild(el("span", "note", i.note));
  // Zusatzzeile nur, wenn sie etwas sagt: von jemand anderem, neu oder "gab's nicht" (eigene Einträge bleiben einzeilig)
  const meta = el("span", "itemmeta");
  const wants = Object.entries(wantsOf(i));
  if (wants.length > 1) meta.appendChild(el("span", "tag forall",
    "für " + wants.map(([uid, q]) => forName(uid) + (q ? ` (${q})` : "")).join(" + ")));
  if (!i.done) {
    if (i.missing) meta.appendChild(el("span", "tag missing", `gab's nicht · ${when(i.missingAt)}`));
    if (isNew(i)) meta.appendChild(el("span", "tag new", "neu"));
    if (i.by !== S.uid && wants.length < 2) meta.appendChild(document.createTextNode(`von ${nameOf(i.by)} · ${when(i.at)}`));
  } else if (i.doneBy && i.doneBy !== S.uid) meta.appendChild(document.createTextNode(`von ${nameOf(i.doneBy)} besorgt`));
  if (meta.childNodes.length) body.appendChild(meta);
  body.onclick = () => openItemDlg(i);
  row.appendChild(body);

  if (safePhoto(i.photo)) {
    const img = el("button", "thumb");
    img.style.backgroundImage = `url("${safePhoto(i.photo)}")`;
    img.setAttribute("aria-label", `Foto von ${i.text} groß anzeigen`);
    img.onclick = () => showPhoto(safePhoto(i.photo));
    row.appendChild(img);
  }
  return li;
}

function toggleDone(i) {
  const data = i.done ? { done: false } : { done: true, doneBy: S.uid, doneAt: Date.now(), missing: false };
  house.update("items", i.id, data).catch(fail("Abhaken"));
  if (!i.done && navigator.vibrate) navigator.vibrate(15);
}

// Abgehakte Einträge wandern in den Verlauf (ohne Foto, das bleibt klein)
function archiveOps(done) {
  const hist = done.map(i => ({ id: uid20(), data: {
    text: i.text, qty: i.qty || "", cat: i.cat, storeId: i.storeId, by: i.by, at: i.at,
    doneBy: i.doneBy || S.uid, doneAt: i.doneAt || Date.now()
  } }));
  const ops = [
    ...done.map(i => ({ type: "delete", c: "items", id: i.id })),
    ...hist.map(h => ({ c: "history", id: h.id, data: h.data }))
  ];
  const undo = [
    ...done.map(({ id, ...data }) => ({ c: "items", id, data })),
    ...hist.map(h => ({ type: "delete", c: "history", id: h.id }))
  ];
  return { ops, undo };
}
function clearDone() {
  const done = itemsOf(S.current).filter(i => i.done);
  const { ops, undo } = archiveOps(done);
  house.batch(ops)
    .then(() => toast(`${done.length} erledigte Einträge im Verlauf`, {
      label: "Rückgängig",
      run: () => house.batch(undo).catch(fail("Wiederherstellen"))
    }))
    .catch(fail("Aufräumen"));
}

/* ---------- Hinzufügen ---------- */
const addItem = (raw, extra = {}) => addItems([raw], extra);

// Mehrere Einträge auf einmal, z. B. "Milch, Eier, Brot" oder eine eingefügte WhatsApp-Liste
async function addItems(raws, extra = {}) {
  const open = new Map(openOf(S.current).map(i => [sameKey(i.text), i]));
  const ops = [], added = [], skipped = [], joined = [], elsewhere = [];
  const now = Date.now();
  for (const raw of raws) {
    const { qty, text } = splitQty(raw);
    if (!text) continue;
    const key = sameKey(text);
    const have = open.get(key);
    if (have !== undefined) {
      // Steht schon drauf: von mir → nichts tun; von jemand anderem → ich brauche es auch
      if (!have || S.uid in wantsOf(have)) { skipped.push(text); continue; }
      const wants = { ...wantsOf(have), [S.uid]: qty };
      ops.push({ type: "update", c: "items", id: have.id, data: { wants, qty: sumQty(wants), text: splitQty(have.text).text } });
      open.set(key, null);
      joined.push({ text: splitQty(have.text).text, wants });
      continue;
    }
    open.set(key, null);
    // Steht es auf einer anderen Liste? Dann trotzdem hier eintragen, aber Bescheid sagen
    const other = S.items.find(i => !i.done && i.storeId !== S.current && sameKey(i.text) === key);
    if (other) elsewhere.push(`„${text}“ steht auch auf ${storeById(other.storeId)?.name || "einer anderen Liste"}`);
    const cat = extra.cat || guessCat(text);
    const at = now + added.length;
    const k = S.known.find(x => x.id === keyOf(text));
    ops.push(
      { c: "items", data: { text, qty, note: "", cat, storeId: S.current, done: false, urgent: false, by: S.uid, at } },
      { c: "known", id: keyOf(text), data: { text, cat, count: (k?.count || 0) + 1, last: at, stores: { ...(k?.stores || {}), [S.current]: at } } }
    );
    added.push(text);
  }
  if (skipped.length && !joined.length) toast(skipped.length === 1 ? `„${skipped[0]}“ steht schon drauf` : `Stand schon drauf: ${skipped.join(", ")}`);
  if (!ops.length) return;
  try {
    await house.batch(ops);
    if (joined.length === 1 && !skipped.length) {
      const { text, wants } = joined[0];
      toast(`„${text}“ stand schon drauf, jetzt für ${Object.keys(wants).map(forName).join(" und ")} (${sumQty(wants)})`);
    } else if (joined.length) toast(`Jetzt auch für dich: ${joined.map(j => j.text).join(", ")}` + (skipped.length ? ` · schon drauf: ${skipped.join(", ")}` : ""));
    else if (elsewhere.length) toast(elsewhere.join(" · "));
    else if (added.length > 1 && !skipped.length) toast(`${added.length} Einträge hinzugefügt`);
  } catch (e) { console.error(e); fail("Speichern")(); }
}

// Liste auseinandernehmen: Zeilen, Kommas, Semikolons, Aufzählungszeichen; beim Sprechen auch "und"
function splitList(text, spoken = false) {
  return text.split(spoken ? /\s*(?:[,;\n]|\bund\b|\bsowie\b)\s*/i : /\s*[,;\n]\s*/)
    .map(x => x.replace(/^\s*(?:[-•*–]|\[ ?\])\s*/, "").trim())
    .filter(Boolean);
}

function addFromInput(refocus) {
  const v = $("#addInput").value.trim();
  if (!v) return;
  $("#addInput").value = "";
  ls.del("ek.draft." + S.current);
  hideSuggest();
  addItems(splitList(v));
  if (refocus) $("#addInput").focus();
}
$("#addForm").onsubmit = e => { e.preventDefault(); addFromInput(true); };
// Manche Handy-Tastaturen schicken beim ✓ kein Enter, sondern einen Zeilenumbruch oder schließen nur die Tastatur:
// beides zählt auch als "übernehmen"
$("#addInput").addEventListener("beforeinput", e => {
  if (e.inputType === "insertLineBreak" || e.inputType === "insertParagraph") { e.preventDefault(); addFromInput(true); }
});
$("#addInput").addEventListener("blur", () => {
  const store = S.current;
  // Kurz abwarten: App-Wechsel oder Zurück zur Übersicht lassen den Text als Entwurf stehen
  setTimeout(() => {
    if (document.visibilityState !== "visible" || !document.hasFocus()) return;
    if (document.activeElement === $("#addInput") || S.current !== store) return;
    addFromInput(false);
  }, 300);
});
$("#addInput").addEventListener("input", () => {
  if (!S.current) return;
  const v = $("#addInput").value;
  v.trim() ? ls.set("ek.draft." + S.current, v) : ls.del("ek.draft." + S.current);
});
$("#addInput").onpaste = e => {
  const text = e.clipboardData?.getData("text") || "";
  if (!/[\n,;]/.test(text.trim())) return; // ein einzelner Begriff wird ganz normal eingefügt
  e.preventDefault();
  addItems(splitList(text));
};

// Einsprechen: "Butter, Eier und Brot" → drei Einträge
const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
if (Speech) {
  $("#micBtn").hidden = false;
  let rec = null;
  $("#micBtn").onclick = () => {
    if (rec) { rec.stop(); return; }
    rec = new Speech();
    rec.lang = "de-DE";
    rec.interimResults = true;
    const btn = $("#micBtn"), input = $("#addInput");
    btn.classList.add("listening");
    input.placeholder = "Ich höre zu …";
    rec.onresult = e => {
      const r = e.results[e.results.length - 1];
      input.value = r[0].transcript;
      if (r.isFinal) { input.value = ""; ls.del("ek.draft." + S.current); addItems(splitList(r[0].transcript, true)); }
    };
    rec.onerror = e => { if (e.error === "not-allowed") toast("Bitte erlaube den Zugriff aufs Mikrofon"); };
    rec.onend = () => { rec = null; btn.classList.remove("listening"); input.placeholder = "Was fehlt?"; };
    rec.start();
  };
}

// Vorschläge beim Tippen aus allem, was schon mal auf einer Liste stand
$("#addInput").oninput = () => {
  const { text } = splitQty($("#addInput").value);
  const q = norm(text);
  const box = $("#suggest");
  if (q.length < 2) return hideSuggest();
  const openNow = new Set(openOf(S.current).map(i => sameKey(i.text)));
  const hits = S.known
    .filter(k => !openNow.has(sameKey(k.text)) && norm(k.text) !== q && norm(k.text).includes(q))
    .sort((a, b) => (norm(b.text).startsWith(q) - norm(a.text).startsWith(q)) || b.count - a.count)
    .slice(0, 5);
  if (!hits.length) return hideSuggest();
  box.textContent = "";
  hits.forEach(k => {
    const b = el("button", "chip", k.text);
    b.type = "button";
    b.onmousedown = ev => ev.preventDefault(); // Tastatur bleibt offen
    b.onclick = () => {
      const { qty } = splitQty($("#addInput").value);
      $("#addInput").value = "";
      ls.del("ek.draft." + S.current);
      hideSuggest();
      addItem((qty ? qty + " " : "") + k.text, { cat: k.cat });
      $("#addInput").focus();
    };
    box.appendChild(b);
  });
  box.hidden = false;
};
function hideSuggest() { $("#suggest").hidden = true; }

// "Oft gekauft": was hier schon öfter drauf stand und gerade fehlt
let oftenAll = false, oftenEditing = false;

// Vorschläge entfernen: nur für diesen Laden; steht ein Vorschlag nirgends mehr, wird er ganz gelöscht
async function removeSuggestions(list) {
  const id = S.current;
  const ops = list.map(k => {
    const stores = { ...(k.stores || {}) };
    delete stores[id];
    return Object.keys(stores).length
      ? { type: "update", c: "known", id: k.id, data: { stores } }
      : { type: "delete", c: "known", id: k.id };
  });
  const undo = list.map(({ id: kid, ...data }) => ({ c: "known", id: kid, data }));
  try {
    for (const part of chunks(ops)) await house.batch(part);
    toast(list.length === 1 ? `„${list[0].text}“ aus den Vorschlägen entfernt` : `${list.length} Vorschläge entfernt`, {
      label: "Rückgängig",
      run: async () => { try { for (const part of chunks(undo)) await house.batch(part); } catch { fail("Wiederherstellen")(); } }
    });
  } catch (err) { console.error(err); fail("Entfernen")(); }
}
$("#oftenEdit").onclick = () => { oftenEditing = !oftenEditing; renderOften(); };
$("#oftenClear").onclick = () => {
  const all = S.known.filter(k => k.stores?.[S.current] && (k.count || 0) >= 2);
  if (!all.length || !confirm(`Alle ${all.length} Vorschläge für diesen Laden entfernen?`)) return;
  oftenEditing = false;
  removeSuggestions(all);
};

function renderOften() {
  const id = S.current;
  const openNow = new Set(openOf(id).map(i => sameKey(i.text)));
  const all = S.known
    .filter(k => k.stores?.[id] && !openNow.has(sameKey(k.text)) && (k.count || 0) >= 2)
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, "de"));
  if (!all.length) oftenEditing = false;
  // Beim Bearbeiten immer alle zeigen
  const list = oftenAll || oftenEditing ? all : all.slice(0, 10);
  $("#often").hidden = !list.length;
  $("#oftenMore").hidden = all.length <= 10 || oftenEditing;
  $("#oftenMore").textContent = oftenAll ? "Weniger anzeigen" : `Alle ${all.length} anzeigen`;
  $("#oftenEdit").textContent = oftenEditing ? "Fertig" : "Bearbeiten";
  $("#oftenEditHint").hidden = !oftenEditing;
  if (oftenEditing) {
    const box = $("#oftenChips");
    box.textContent = "";
    list.forEach(k => {
      const b = el("button", "chip removable", "✕ " + k.text);
      b.setAttribute("aria-label", `${k.text} aus den Vorschlägen entfernen`);
      b.onclick = () => removeSuggestions([k]);
      box.appendChild(b);
    });
    return;
  }
  const box = $("#oftenChips");
  box.textContent = "";
  list.forEach(k => {
    const b = el("button", "chip", "+ " + k.text);
    b.onclick = () => addItem(k.text, { cat: k.cat });
    box.appendChild(b);
  });
}

/* ---------- Eintrag-Dialog ---------- */
let editItem = null, editPhoto = null, editStoreId = null, editWants = {};
// Abteilungs-Auswahl im Eintrag-Dialog in der Reihenfolge des Ladens, mit "Neue Abteilung …" am Ende
function fillCatSelect(value) {
  const sel = $("#fCat");
  sel.textContent = "";
  catsFor(storeById(editStoreId)).forEach(c => { const o = el("option", "", `${c.emoji} ${c.name}`); o.value = c.id; sel.appendChild(o); });
  const add = el("option", "", "＋ Neue Abteilung …");
  add.value = "__new";
  sel.appendChild(add);
  sel.value = catById(value) ? value : "sonst";
  sel.dataset.prev = sel.value;
}
$("#fCat").onchange = e => {
  if (e.target.value !== "__new") { e.target.dataset.prev = e.target.value; return; }
  e.target.value = e.target.dataset.prev;
  openCatDlg(null, id => fillCatSelect(id));
};

function openItemDlg(i) {
  editItem = i; editPhoto = safePhoto(i.photo); editStoreId = i.storeId;
  $("#fText").value = i.text;
  $("#fQty").value = i.qty || "";
  $("#fNote").value = i.note || "";
  fillCatSelect(shownCat(i));
  $("#fUrgent").checked = !!i.urgent;
  $("#fError").textContent = "";
  $("#fMissing").hidden = i.done;
  $("#fMissing").textContent = i.missing ? "Doch wieder suchen" : "Gab's nicht";
  $("#fMeta").textContent = `Eingetragen von ${nameOf(i.by)}, ${when(i.at)}` + (i.done ? ` · besorgt ${when(i.doneAt)}` : "");
  editWants = { ...wantsOf(i) };
  renderPhoto();
  renderStoreChips();
  renderWantChips();
  $("#itemDlg").showModal();
}
// "Für wen?": jede Person antippbar, mindestens eine bleibt
function renderWantChips() {
  const box = $("#fWants");
  box.textContent = "";
  $("#fWantsRow").hidden = S.members.length < 2;
  S.members.forEach(m => {
    const on = m.id in editWants;
    const b = el("button", "chip" + (on ? " on" : ""), m.id === S.uid ? `${m.name} (du)` : m.name);
    b.type = "button";
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.onclick = () => {
      if (on && Object.keys(editWants).length > 1) delete editWants[m.id];
      else if (!on) editWants[m.id] = "";
      renderWantChips();
    };
    box.appendChild(b);
  });
}
function renderPhoto() {
  $("#fPhoto").hidden = !editPhoto;
  if (editPhoto) $("#fPhoto").src = editPhoto;
  $("#fPhotoDel").hidden = !editPhoto;
  $("#fPhotoLabel").textContent = editPhoto ? "Neues Foto" : "Foto machen";
}
function renderStoreChips() {
  const box = $("#fStores");
  box.textContent = "";
  sortedStores().forEach(s => {
    const b = el("button", "chip" + (s.id === editStoreId ? " on" : ""), s.name);
    b.type = "button";
    b.style.setProperty("--c", safeColor(s.color));
    b.onclick = () => { editStoreId = s.id; renderStoreChips(); fillCatSelect($("#fCat").value); }; // Abteilungen in der Reihenfolge des neuen Ladens
    box.appendChild(b);
  });
}
// Kamera und Galerie liefern beide eine Bilddatei
$("#fPhotoInput").onchange = $("#fGalleryInput").onchange = async e => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try { editPhoto = await compressImage(file); renderPhoto(); }
  catch { $("#fError").textContent = "Das Foto ließ sich nicht verarbeiten."; }
};
$("#fPhotoDel").onclick = () => { editPhoto = null; renderPhoto(); };
$("#fPhoto").onclick = () => showPhoto(editPhoto);
$("#fCancel").onclick = () => $("#itemDlg").close();
// Schließen ohne "Abbrechen" speichert: Zurück-Taste, daneben tippen oder nach unten wischen
const saveItemDlg = () => $("#itemForm").requestSubmit();
$("#itemDlg").addEventListener("cancel", e => { e.preventDefault(); saveItemDlg(); });
$("#itemDlg").addEventListener("click", e => { if (e.target === e.currentTarget) saveItemDlg(); });
swipeDown($("#itemDlg"), saveItemDlg);

// Dialog mit dem Finger nach unten ziehen; weit genug → onDone, sonst zurückschnappen
function swipeDown(dlg, onDone) {
  let y0 = null, dy = 0;
  dlg.addEventListener("touchstart", e => {
    y0 = dlg.scrollTop <= 0 && !e.target.closest("select") ? e.touches[0].clientY : null;
    dy = 0;
  }, { passive: true });
  dlg.addEventListener("touchmove", e => {
    if (y0 === null) return;
    dy = Math.max(0, e.touches[0].clientY - y0 - 8); // ein kleines Zittern beim Antippen zählt nicht
    if (dlg.scrollTop > 0) { y0 = null; dy = 0; }
    if (dy && e.cancelable) e.preventDefault(); // sonst lädt der Browser die Seite neu ("Ziehen zum Aktualisieren")
    dlg.style.transform = dy ? `translateY(${dy}px)` : "";
    dlg.style.opacity = dy ? String(Math.max(.4, 1 - dy / 500)) : "";
  }, { passive: false });
  const end = () => {
    if (y0 === null) return;
    const done = dy > 100;
    y0 = null; dy = 0;
    dlg.style.transition = "transform .18s, opacity .18s";
    dlg.style.transform = ""; dlg.style.opacity = "";
    setTimeout(() => { dlg.style.transition = ""; }, 200);
    if (done) onDone();
  };
  dlg.addEventListener("touchend", end);
  dlg.addEventListener("touchcancel", () => { dy = 0; end(); });
}

$("#itemForm").onsubmit = async e => {
  e.preventDefault();
  let text = $("#fText").value.trim(), qty = $("#fQty").value.trim();
  if (!text) return;
  if (!qty) ({ qty, text } = splitQty(text)); // "Möhren 200g" im Namensfeld → Menge 200g
  // Für mehrere Personen: Gesamtmenge neu rechnen, solange niemand die Menge von Hand geändert hat
  const people = Object.keys(editWants);
  const sameKeys = people.length === Object.keys(wantsOf(editItem)).length && people.every(u => u in wantsOf(editItem));
  if (!sameKeys && qty === (editItem.qty || "")) qty = sumQty(editWants);
  if (people.length === 1) editWants[people[0]] = qty;
  const cat = $("#fCat").value;
  const data = {
    text, qty, note: $("#fNote").value.trim(), cat, wants: people.length > 1 ? editWants : null,
    urgent: $("#fUrgent").checked, photo: editPhoto || null, storeId: editStoreId
  };
  const ops = [{ type: "update", c: "items", id: editItem.id, data }];
  // Geänderte Abteilung merken, damit sie beim nächsten Mal stimmt
  const k = S.known.find(x => x.id === keyOf(text));
  if (cat !== editItem.cat || !k) ops.push({ c: "known", id: keyOf(text), data: { text, cat, count: k?.count || 1, last: Date.now(), stores: { ...(k?.stores || {}), [editStoreId]: Date.now() } } });
  try {
    await house.batch(ops);
    $("#itemDlg").close();
    if (editStoreId !== editItem.storeId) toast(`Verschoben nach ${storeById(editStoreId)?.name}`);
  } catch (err) { console.error(err); $("#fError").textContent = "Speichern hat nicht geklappt" + (editPhoto ? " (Foto zu groß?)." : "."); }
};
$("#fMissing").onclick = async () => {
  const missing = !editItem.missing;
  try {
    await house.update("items", editItem.id, missing ? { missing: true, missingAt: Date.now(), missingBy: S.uid } : { missing: false });
    $("#itemDlg").close();
    if (missing) toast("Markiert. Bleibt auf der Liste fürs nächste Mal.");
  } catch { $("#fError").textContent = "Hat nicht geklappt."; }
};
$("#fDelete").onclick = async () => {
  const i = editItem;
  const { id, ...data } = i;
  try {
    await house.remove("items", id);
    $("#itemDlg").close();
    toast(`„${i.text}“ gelöscht`, { label: "Rückgängig", run: () => house.set("items", id, data).catch(fail("Wiederherstellen")) });
  } catch { $("#fError").textContent = "Löschen hat nicht geklappt."; }
};

// Fotos verkleinern, damit sie in die Datenbank passen (max. ca. 250 KB)
function compressImage(file, maxSide = 900, maxLen = 250_000) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let side = maxSide;
      for (let tries = 0; tries < 6; tries++) {
        const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        for (const q of [0.8, 0.7, 0.6]) {
          const out = c.toDataURL("image/jpeg", q);
          if (out.length < maxLen) return resolve(out);
        }
        side = Math.round(side * 0.75);
      }
      reject(new Error("Bild zu groß"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Bild nicht lesbar")); };
    img.src = url;
  });
}

/* ---------- Einkauf abschließen ---------- */
const FINISH_MSGS = ["Bin gleich bei dir", "Bin in 30 Minuten da", "Komme heute Abend vorbei", "Bringe es morgen vorbei"];
function openFinish() {
  const s = storeById(S.current);
  const done = itemsOf(s.id).filter(i => i.done).length, open = openOf(s.id).length;
  $("#finishInfo").textContent = `${done} ${done === 1 ? "Sache" : "Sachen"} abgehakt` + (open ? `, ${open} noch offen (bleiben auf der Liste)` : "") + ".";
  $("#finishMsg").value = "";
  const chips = $("#finishChips");
  chips.textContent = "";
  FINISH_MSGS.forEach(m => {
    const c = el("button", "chip", m);
    c.type = "button";
    c.onclick = () => { $("#finishMsg").value = m; };
    chips.appendChild(c);
  });
  $("#finishReceipt").checked = false;
  $("#finishDlg").showModal();
}
$("#finishCancel").onclick = () => $("#finishDlg").close();
$("#finishForm").onsubmit = async e => {
  e.preventDefault();
  const s = storeById(S.current);
  const done = itemsOf(s.id).filter(i => i.done);
  const started = myTrip(), now = Date.now();
  const trip = { ...(started || { at: now }), storeId: s.id, state: "fertig", doneAt: now, count: done.length, msg: $("#finishMsg").value.trim() };
  const ops = $("#finishClear").checked ? archiveOps(done).ops : [];
  // Dauer merken, wenn vorher "Ich gehe jetzt …" getippt wurde (für "Meine Einkaufszeit")
  if (started?.state === "los" && now - started.at >= 60000)
    ops.push({ c: "trips", data: { by: S.uid, storeId: s.id, start: started.at, end: now, count: done.length } });
  try {
    await Promise.all([house.patch("members", S.uid, { trip }), ops.length ? house.batch(ops) : null]);
    $("#finishDlg").close();
    toast("Die anderen sehen jetzt, dass du fertig bist");
    if ($("#finishReceipt").checked) openReceiptDlg(null, s.id);
  } catch (err) { console.error(err); fail("Abschließen")(); }
};

/* ---------- Meine Einkaufszeit ---------- */
function fmtDur(ms) {
  const min = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} Std${m ? ` ${m} Min` : ""}` : `${m} Min`;
}
async function openTimes() {
  const body = $("#timeBody");
  body.textContent = "Lädt …";
  $("#timeDlg").showModal();
  let trips;
  try { trips = (await house.getAll("trips")).filter(t => t.by === S.uid).sort((a, b) => b.start - a.start); }
  catch (e) { console.error(e); body.textContent = "Konnte nicht geladen werden."; return; }
  body.textContent = "";
  if (!trips.length) {
    body.appendChild(el("p", "empty", "Noch keine Einkäufe gezählt. Tipp beim Losgehen auf „🛒 Ich gehe jetzt zu …“ und am Ende auf „✅ Fertig eingekauft“."));
    return;
  }
  const monthKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const months = new Map();
  for (const t of trips) {
    const k = monthKey(t.start), m = months.get(k) || { ms: 0, n: 0, ts: t.start };
    m.ms += t.end - t.start; m.n++;
    months.set(k, m);
  }
  // Großer Wert oben: dieser Monat
  const cur = months.get(monthKey(Date.now())) || { ms: 0, n: 0 };
  const hero = el("div", "timehero");
  hero.append(el("span", "small", "Diesen Monat"), el("strong", "", cur.n ? fmtDur(cur.ms) : "noch nichts"));
  if (cur.n) hero.appendChild(el("span", "small", `${cur.n} ${cur.n === 1 ? "Einkauf" : "Einkäufe"} · im Schnitt ${fmtDur(cur.ms / cur.n)}`));
  body.appendChild(hero);

  body.appendChild(el("p", "sectionlabel", "Pro Monat"));
  const max = Math.max(...[...months.values()].map(m => m.ms));
  const list = el("div", "timemonths");
  [...months.values()].slice(0, 12).forEach(m => {
    const row = el("div", "timemonth");
    row.appendChild(el("span", "", new Date(m.ts).toLocaleDateString("de-DE", { month: "long", year: "numeric" })));
    const bar = el("span", "timebar");
    bar.style.setProperty("--w", `${Math.max(4, Math.round(m.ms / max * 100))}%`);
    row.append(bar, el("strong", "", `${fmtDur(m.ms)} · ${m.n}×`));
    list.appendChild(row);
  });
  body.appendChild(list);

  body.appendChild(el("p", "sectionlabel", "Letzte Einkäufe"));
  const last = el("div", "timemonths");
  trips.slice(0, 15).forEach(t => {
    const row = el("div", "timemonth");
    const day = new Date(t.start).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" });
    row.append(el("span", "", `${storeById(t.storeId)?.name || "Laden"} · ${day}`), el("strong", "", fmtDur(t.end - t.start)));
    last.appendChild(row);
  });
  body.appendChild(last);
}
$("#timeBtn").onclick = openTimes;
$("#timeClose").onclick = () => $("#timeDlg").close();

/* ---------- Verlauf ---------- */
let historyFilter = null, historyData = [];
async function openHistory() {
  historyFilter = S.current;
  $("#historyList").textContent = "Lädt …";
  $("#historyDlg").showModal();
  try { historyData = await house.getAll("history"); }
  catch (e) { console.error(e); $("#historyList").textContent = "Der Verlauf ließ sich nicht laden."; return; }
  renderHistory();
}
function renderHistory() {
  const filter = $("#historyFilter");
  filter.textContent = "";
  [{ id: null, name: "Alle Läden" }, ...sortedStores()].forEach(s => {
    const c = el("button", "chip" + (historyFilter === s.id ? " on" : ""), s.name);
    if (s.color) c.style.setProperty("--c", safeColor(s.color));
    c.onclick = () => { historyFilter = s.id; renderHistory(); };
    filter.appendChild(c);
  });
  const box = $("#historyList");
  box.textContent = "";
  const list = historyData.filter(h => !historyFilter || h.storeId === historyFilter).sort((a, b) => b.doneAt - a.doneAt).slice(0, 200);
  if (!list.length) { box.appendChild(el("p", "notice", "Noch nichts im Verlauf. Abgehakte Sachen landen hier, sobald die Liste aufgeräumt wird.")); return; }
  let lastDay = "";
  for (const h of list) {
    const day = new Date(h.doneAt).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
    if (day !== lastDay) { box.appendChild(el("p", "sectionlabel", day)); lastDay = day; }
    const row = el("div", "histrow");
    const s = storeById(h.storeId);
    const dot = el("span", "dot");
    dot.style.background = s?.color || "var(--muted)";
    const txt = el("span", "histtext", `${h.qty ? h.qty + " " : ""}${h.text}`);
    const meta = el("span", "small", `${s?.name || "?"} · besorgt von ${nameOf(h.doneBy)}`);
    const again = el("button", "btn ghost small", "+ Liste");
    again.setAttribute("aria-label", `${h.text} wieder auf die Liste`);
    again.disabled = !S.current;
    again.onclick = () => { addItem((h.qty ? h.qty + " " : "") + h.text, { cat: h.cat }); again.textContent = "✓"; again.disabled = true; };
    const col = el("span", "histcol");
    col.append(txt, meta);
    row.append(dot, col, again);
    box.appendChild(row);
  }
}
$("#historyBtn").onclick = openHistory;
$("#historyClose").onclick = () => $("#historyDlg").close();

/* ---------- Ausgaben ---------- */
const monthKey = d => `${d.getFullYear()}-${d.getMonth()}`;
// Ein Bon gehört zu einem Laden mit Liste (storeId) oder nur zu einem Namen (storeName, z. B. "Bäcker")
const receiptName = r => storeById(r.storeId)?.name || r.storeName || "?";
const receiptColor = r => storeById(r.storeId) ? safeColor(storeById(r.storeId).color) : (r.storeName ? COLORS[hash(norm(r.storeName)) % COLORS.length] : "var(--muted)");
function renderMoney() {
  const m = S.month;
  $("#monthLabel").textContent = m.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const inMonth = S.receipts.filter(r => monthKey(new Date(r.date)) === monthKey(m)).sort((a, b) => b.date - a.date);
  const sum = inMonth.reduce((t, r) => t + (r.amount || 0), 0);
  const open = S.receipts.filter(r => !r.settled).reduce((t, r) => t + (r.amount || 0), 0);
  $("#monthTotal").textContent = euro(sum);
  renderPay($("#payBoxMoney"));
  $("#openTotal").textContent = euro(open);

  // Summe pro Laden als kleine Balken
  const per = $("#perStore");
  per.textContent = "";
  const byStore = {};
  inMonth.forEach(r => {
    const k = norm(receiptName(r));
    byStore[k] ||= { r, cents: 0 };
    byStore[k].cents += r.amount;
  });
  Object.values(byStore).sort((a, b) => b.cents - a.cents).forEach(({ r, cents }) => {
    const row = el("div", "barrow");
    row.style.setProperty("--c", receiptColor(r));
    row.appendChild(el("span", "barname", receiptName(r)));
    const bar = el("span", "bar");
    const fill = el("span", "barfill");
    fill.style.width = (sum ? Math.max(4, cents / sum * 100) : 0) + "%";
    bar.appendChild(fill);
    row.append(bar, el("span", "baramount", euro(cents)));
    per.appendChild(row);
  });

  const box = $("#receipts");
  box.textContent = "";
  if (!inMonth.length) { box.appendChild(el("p", "notice", "In diesem Monat noch keine Kassenbons.")); return; }
  inMonth.forEach(r => {
    const row = el("div", "receipt" + (r.settled ? " settled" : ""));
    row.style.setProperty("--c", receiptColor(r));
    const main = el("button", "receiptmain");
    main.setAttribute("aria-label", `Kassenbon ${receiptName(r)} ${euro(r.amount)} bearbeiten`);
    const col = el("span", "histcol");
    col.append(el("strong", "", receiptName(r)),
      el("span", "small", `${new Date(r.date).toLocaleDateString("de-DE", { day: "numeric", month: "short" })} · bezahlt von ${r.by === S.uid ? "dir" : nameOf(r.by)}${r.note ? " · " + r.note : ""}`));
    main.append(col, el("span", "amount", euro(r.amount)));
    main.onclick = () => openReceiptDlg(r);
    row.appendChild(main);
    if (safePhoto(r.photo)) {
      const img = el("button", "thumb");
      img.style.backgroundImage = `url("${safePhoto(r.photo)}")`;
      img.setAttribute("aria-label", "Kassenbon groß anzeigen");
      img.onclick = () => showPhoto(safePhoto(r.photo));
      row.appendChild(img);
    }
    const settle = el("button", "chip settle" + (r.settled ? " on" : ""), r.settled ? "✓ erstattet" : "offen");
    settle.setAttribute("aria-pressed", r.settled ? "true" : "false");
    settle.onclick = () => house.update("receipts", r.id, { settled: !r.settled, settledAt: Date.now() }).catch(fail("Speichern"));
    row.appendChild(settle);
    box.appendChild(row);
  });
}
$("#monthPrev").onclick = () => { S.month = new Date(S.month.getFullYear(), S.month.getMonth() - 1, 1); renderMoney(); };
$("#monthNext").onclick = () => { S.month = new Date(S.month.getFullYear(), S.month.getMonth() + 1, 1); renderMoney(); };
$("#newReceiptBtn").onclick = () => openReceiptDlg(null);

let editReceipt = null, receiptPhoto = null, receiptStore = null, receiptOther = "";
const isoDay = ts => { const d = new Date(ts); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
function openReceiptDlg(r, storeId = null) {
  editReceipt = r;
  receiptPhoto = safePhoto(r?.photo);
  receiptOther = r && !r.storeId ? r.storeName || "" : "";
  receiptStore = receiptOther ? null : r?.storeId || storeId || myTrip()?.storeId || sortedStores()[0]?.id || null;
  $("#rOtherRow").hidden = true;
  $("#rOther").value = "";
  $("#receiptTitle").textContent = r ? "Kassenbon bearbeiten" : "Kassenbon erfassen";
  $("#rAmount").value = r ? (r.amount / 100).toFixed(2).replace(".", ",") : "";
  $("#rDate").value = isoDay(r?.date || Date.now());
  $("#rNote").value = r?.note || "";
  $("#rSettled").checked = !!r?.settled;
  $("#rDelete").hidden = !r;
  $("#rError").textContent = "";
  scanRun++;
  $("#rScan").hidden = true;
  $("#rMeta").textContent = r ? `Erfasst von ${nameOf(r.by)}, ${when(r.at)}` : "";
  renderReceiptStores();
  renderReceiptPhoto();
  $("#receiptDlg").showModal();
}
// Läden mit Liste, dann früher benutzte freie Namen (Bäcker, Apotheke …), dann "+ Anderer Laden"
function renderReceiptStores() {
  const box = $("#rStores");
  box.textContent = "";
  const chip = (label, on, color, pick) => {
    const b = el("button", "chip" + (on ? " on" : ""), label);
    b.type = "button";
    b.style.setProperty("--c", color);
    b.onclick = pick;
    box.appendChild(b);
  };
  sortedStores().forEach(s => chip(s.name, s.id === receiptStore, s.color, () => {
    receiptStore = s.id; receiptOther = ""; $("#rOtherRow").hidden = true; renderReceiptStores();
  }));
  const taken = new Set(S.stores.map(s => norm(s.name)));
  const others = [];
  [...S.receipts].sort((a, b) => b.date - a.date).forEach(r => {
    if (!r.storeId && r.storeName && !taken.has(norm(r.storeName)) && !others.some(o => norm(o) === norm(r.storeName))) others.push(r.storeName);
  });
  if (receiptOther && !others.some(o => norm(o) === norm(receiptOther))) others.unshift(receiptOther);
  others.slice(0, 8).forEach(n => chip(n, !receiptStore && norm(n) === norm(receiptOther),
    receiptColor({ storeName: n }), () => { receiptStore = null; receiptOther = n; $("#rOtherRow").hidden = true; renderReceiptStores(); }));
  chip("+ Anderer Laden", false, "var(--accent)", () => {
    $("#rOtherRow").hidden = false;
    $("#rOther").focus();
  });
}
// Freier Name: übernehmen, sobald getippt wird (Laden mit gleichem Namen wird direkt gewählt)
$("#rOther").oninput = e => {
  const n = e.target.value.trim();
  const s = S.stores.find(x => norm(x.name) === norm(n));
  receiptStore = s ? s.id : null;
  receiptOther = s ? "" : n;
  renderReceiptStores();
};
function renderReceiptPhoto() {
  $("#rPhoto").hidden = !receiptPhoto;
  if (receiptPhoto) $("#rPhoto").src = receiptPhoto;
  $("#rPhotoLabel").textContent = receiptPhoto ? "Neues Foto" : "Bon fotografieren";
}
$("#rPhoto").onclick = () => showPhoto(receiptPhoto);
$("#rPhotoInput").onchange = $("#rGalleryInput").onchange = async e => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  // Bons sind lang und schmal: etwas größer lassen, damit man die Zahlen lesen kann
  try { receiptPhoto = await compressImage(file, 1400, 600_000); renderReceiptPhoto(); }
  catch { $("#rError").textContent = "Das Foto ließ sich nicht verarbeiten."; return; }
  scanReceipt(receiptPhoto);
};

// "2026-10-21" oder "21.10.2026" / "21.10.26" → Datum (mittags, damit die Zeitzone nichts verschiebt)
function parseDay(s) {
  let m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s || "");
  if (m) return new Date(+m[1], m[2] - 1, +m[3], 12);
  m = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(s || "");
  if (m) return new Date(m[3].length === 2 ? 2000 + +m[3] : +m[3], m[2] - 1, +m[1], 12);
  return null;
}

// Betrag, Datum und Laden vom Bon lesen lassen (KI über Firebase, nicht im Demo-Modus)
let scanRun = 0;
async function scanReceipt(photo) {
  if (!store.readReceipt) return;
  const run = ++scanRun, info = $("#rScan");
  info.hidden = false;
  info.className = "scan busy";
  info.textContent = "Ich lese den Betrag vom Bon …";
  try {
    const r = await store.readReceipt(photo);
    if (run !== scanRun || !$("#receiptDlg").open) return;
    if (!(r?.total > 0)) { info.className = "scan"; info.textContent = "Betrag nicht erkannt, bitte selbst eintragen."; return; }
    const cents = Math.round(r.total * 100);
    $("#rAmount").value = (cents / 100).toFixed(2).replace(".", ",");
    // Datum nur übernehmen, wenn es plausibel ist (nicht in der Zukunft, höchstens 90 Tage alt)
    const d = parseDay(r.date);
    const okDate = d && d <= new Date() && Date.now() - d < 90 * 864e5;
    if (okDate) $("#rDate").value = isoDay(d);
    const s = r.store ? sortedStores().find(x => norm(r.store).includes(norm(x.name)) || norm(x.name).includes(norm(r.store))) : null;
    if (s) { receiptStore = s.id; receiptOther = ""; renderReceiptStores(); }
    // Kein passender Laden mit Liste: erkannten Namen als freien Namen nehmen (z. B. "Bäckerei Müller")
    else if (r.store && r.store.trim()) { receiptStore = null; receiptOther = r.store.trim().slice(0, 30); renderReceiptStores(); }
    info.className = "scan ok";
    info.textContent = `Erkannt: ${euro(cents)}${okDate ? ", " + d.toLocaleDateString("de-DE") : ""}${s ? ", " + s.name : receiptOther ? ", " + receiptOther : ""}. Bitte kurz prüfen.`;
  } catch (err) {
    console.error(err);
    if (run !== scanRun) return;
    info.className = "scan";
    info.textContent = "Betrag konnte nicht gelesen werden, bitte selbst eintragen.";
  }
}
$("#rCancel").onclick = () => $("#receiptDlg").close();
$("#receiptForm").onsubmit = async e => {
  e.preventDefault();
  const amount = Math.round(parseFloat($("#rAmount").value.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")) * 100);
  if (!amount || amount < 0) { $("#rError").textContent = "Bitte einen Betrag eingeben, z. B. 23,45."; return; }
  if (!receiptStore && !receiptOther) { $("#rError").textContent = "Bitte einen Laden wählen oder eintippen."; return; }
  const [y, mo, d] = $("#rDate").value.split("-").map(Number);
  const data = {
    storeId: receiptStore || null, storeName: receiptStore ? "" : receiptOther, amount, date: new Date(y, mo - 1, d, 12).getTime(), note: $("#rNote").value.trim(),
    photo: receiptPhoto || null, settled: $("#rSettled").checked
  };
  try {
    if (editReceipt) await house.update("receipts", editReceipt.id, data);
    else await house.add("receipts", { ...data, by: S.uid, at: Date.now() });
    $("#receiptDlg").close();
    S.month = new Date(y, mo - 1, 1);
    if (S.view !== "money") toast(`Kassenbon über ${euro(amount)} gespeichert`, { label: "Ansehen", run: () => setView("money") });
    else renderMoney();
  } catch (err) { console.error(err); $("#rError").textContent = "Speichern hat nicht geklappt" + (receiptPhoto ? " (Foto zu groß?)." : "."); }
};
$("#rDelete").onclick = async () => {
  if (!confirm("Diesen Kassenbon löschen?")) return;
  try { await house.remove("receipts", editReceipt.id); $("#receiptDlg").close(); }
  catch { $("#rError").textContent = "Löschen hat nicht geklappt."; }
};

/* ---------- PayPal.Me: offene Bons mit einem Tipp bezahlen ---------- */
// Akzeptiert "SarahK", "paypal.me/SarahK" oder "https://www.paypal.com/paypalme/SarahK/5EUR"; null = ungültig
function paypalName(input) {
  let s = (input || "").trim();
  const m = s.match(/paypal(?:\.me|\.com\/paypalme)\/([A-Za-z0-9_-]+)/i);
  if (m) s = m[1];
  return /^[A-Za-z0-9_-]{1,40}$/.test(s) ? s : null;
}
const payLink = (name, cents) => `https://www.paypal.com/paypalme/${encodeURIComponent(name)}/${(cents / 100).toFixed(2)}EUR`;

// Pro Person, die etwas ausgelegt hat und PayPal.Me eingetragen hat: ein großer Knopf mit der offenen Summe
function renderPay(box) {
  box.textContent = "";
  const byPayer = {};
  S.receipts.filter(r => !r.settled && r.by && r.by !== S.uid).forEach(r => { (byPayer[r.by] ||= []).push(r); });
  for (const [uid, list] of Object.entries(byPayer)) {
    const m = S.members.find(x => x.id === uid);
    const name = m?.paypal ? paypalName(m.paypal) : null;
    if (!name) continue;
    const cents = list.reduce((t, r) => t + (r.amount || 0), 0);
    const b = el("button", "btn paypal", `💸 ${euro(cents)} an ${m.name} mit PayPal zahlen`);
    b.onclick = () => payNow(m, name, list, cents);
    box.appendChild(b);
  }
}
// PayPal öffnen; wenn man zurückkommt, fragen, ob bezahlt wurde
let pendingPay = null;
function payNow(m, name, list, cents) {
  pendingPay = { m, ids: list.map(r => r.id), cents, at: Date.now() };
  window.open(payLink(name, cents), "_blank", "noopener");
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !pendingPay || Date.now() - pendingPay.at < 1500) return;
  const p = pendingPay;
  $("#paidInfo").textContent = `Hast du ${euro(p.cents)} an ${p.m.name} gesendet? Dann werden ${p.ids.length === 1 ? "der Kassenbon" : `die ${p.ids.length} Kassenbons`} als erstattet markiert.`;
  if (!$("#paidDlg").open) $("#paidDlg").showModal();
});
$("#paidNo").onclick = () => { pendingPay = null; $("#paidDlg").close(); };
$("#paidForm").onsubmit = async e => {
  e.preventDefault();
  const p = pendingPay;
  pendingPay = null;
  $("#paidDlg").close();
  if (!p) return;
  const now = Date.now();
  try {
    await house.batch(p.ids.map(id => ({ type: "update", c: "receipts", id, data: { settled: true, settledAt: now } })));
    toast(`Danke! ${euro(p.cents)} als erstattet markiert`);
  } catch (err) { console.error(err); fail("Speichern")(); }
};

/* ---------- Liste aus einer anderen App übernehmen ---------- */
// Zeilen säubern: Kästchen, Haken, Aufzählungszeichen und Nummern vorne weg; Kommas nur trennen, wenn keine Zahl folgt ("1,5 l Milch")
function parseImport(text) {
  const seen = new Set(), out = [];
  for (let line of text.split(/\r?\n|;|,(?!\d)/)) {
    for (let n = 0; n < 2; n++) line = line.replace(/^\s*(?:[-•*–·▪◦]|[☐☑☒✓✔✗✘]|\[[ xX✓]?\]|\d+[.)](?!\d))\s*/u, "");
    line = line.replace(/\s+/g, " ").trim();
    // Überschriften wie "Einkaufsliste:" oder "Kaufland:" überspringen
    if (!line || line.endsWith(":") || line.length > 100 || seen.has(norm(line))) continue;
    seen.add(norm(line));
    out.push(line);
  }
  return out;
}
function renderImportPreview() {
  const list = parseImport($("#importText").value);
  $("#importCount").textContent = list.length ? `${list.length} ${list.length === 1 ? "Sache" : "Sachen"} erkannt:` : "";
  const box = $("#importPreview");
  box.textContent = "";
  list.slice(0, 40).forEach(t => box.appendChild(el("span", "chip static", t)));
  if (list.length > 40) box.appendChild(el("span", "small", `… und ${list.length - 40} weitere`));
}
$("#importBtn").onclick = () => {
  $("#importText").value = "";
  $("#importError").textContent = "";
  renderImportPreview();
  $("#importDlg").showModal();
};
$("#importText").oninput = renderImportPreview;
$("#importPaste").onclick = async () => {
  try {
    $("#importText").value = await navigator.clipboard.readText();
    renderImportPreview();
  } catch {
    $("#importError").textContent = "Die Zwischenablage ließ sich nicht lesen. Tippe lange in das Feld und wähle „Einfügen“.";
    $("#importText").focus();
  }
};
$("#importCancel").onclick = () => $("#importDlg").close();
$("#importToList").onclick = async () => {
  const list = parseImport($("#importText").value);
  if (!list.length) { $("#importError").textContent = "Füge zuerst eure Liste ein."; return; }
  $("#importDlg").close();
  await addItems(list);
};
// Als Vorschläge: landen nicht auf der Liste, sondern unter "Oft gekauft" und beim Tippen
$("#importForm").onsubmit = async e => {
  e.preventDefault();
  const list = parseImport($("#importText").value);
  if (!list.length) { $("#importError").textContent = "Füge zuerst eure Liste ein."; return; }
  const now = Date.now(), sid = S.current, ops = new Map();
  list.forEach((raw, n) => {
    const { text } = splitQty(raw);
    const id = keyOf(text), k = S.known.find(x => x.id === id);
    if (!text || ops.has(id)) return;
    ops.set(id, { c: "known", id, data: {
      text: k?.text || text, cat: k?.cat || guessCat(text), count: Math.max(k?.count || 0, 2), last: k?.last || now - n,
      stores: { ...(k?.stores || {}), [sid]: k?.stores?.[sid] || now - n }
    } });
  });
  try {
    for (const part of chunks([...ops.values()])) await house.batch(part);
    $("#importDlg").close();
    oftenAll = true;
    renderOften();
    $("#listScroll").scrollTop = 0;
    toast(`${ops.size} Vorschläge gespeichert. Antippen setzt sie auf die Liste.`);
  } catch (err) { console.error(err); $("#importError").textContent = "Speichern hat nicht geklappt."; }
};

/* ---------- Neuer Code (z. B. wenn der Einladungslink weitergegeben wurde) ---------- */
const HOUSE_COLS = ["stores", "items", "known", "history", "receipts", "categories", "trips"];
// Schreibvorgänge in Pakete teilen (Firestore: höchstens 500 pro Paket und etwa 10 MB)
function chunks(ops) {
  const out = [];
  let cur = [], size = 0;
  for (const o of ops) {
    const n = JSON.stringify(o.data || {}).length;
    if (cur.length && (cur.length >= 300 || size + n > 5e6)) { out.push(cur); cur = []; size = 0; }
    cur.push(o); size += n;
  }
  if (cur.length) out.push(cur);
  return out;
}
async function rotateCode() {
  if (!confirm("Neuen Code erzeugen?\n\nAlle Listen, Kassenbons und der Verlauf ziehen in eine neue Familienliste um. " +
    "Der alte Code und alle alten Einladungslinks funktionieren danach nicht mehr.\n\n" +
    "Alle anderen (z. B. Mama) brauchen danach den neuen Einladungslink.")) return;
  const btn = $("#rotateBtn");
  btn.disabled = true;
  btn.textContent = "Ziehe um …";
  const old = house;
  let code = null;
  try {
    // 1. alles lesen und in eine neue Familienliste kopieren (IDs bleiben gleich, damit Bezüge stimmen)
    const data = {};
    for (const c of HOUSE_COLS) data[c] = await old.getAll(c);
    code = randomCode(10);
    await store.create(code);
    const neu = store.open(code);
    for (const part of chunks(HOUSE_COLS.flatMap(c => data[c].map(({ id, ...rest }) => ({ c, id, data: rest })))))
      await neu.batch(part);
    // 2. umschalten, dann die alte Liste leeren und schließen
    unsubs.forEach(u => u());
    unsubs = [];
    $("#settingsDlg").close();
    enter(code);
    try {
      for (const part of chunks(HOUSE_COLS.flatMap(c => data[c].map(x => ({ type: "delete", c, id: x.id })))))
        await old.batch(part);
      await old.remove("members", S.uid).catch(() => {});
      await old.close();
      toast("Neuer Code ist aktiv. Schick Mama jetzt den neuen Einladungslink.");
    } catch (err) {
      console.error(err);
      toast("Neuer Code ist aktiv, aber die alte Liste ließ sich nicht ganz leeren. Bitte später noch mal versuchen.");
    }
    $("#settingsBtn").click();
  } catch (err) {
    console.error(err);
    toast("Code-Wechsel hat nicht geklappt. Es wurde nichts gelöscht, der alte Code gilt weiter.");
  } finally {
    btn.disabled = false;
    btn.textContent = "🔑 Neuen Code erzeugen";
  }
}
// Jemand anderes hat einen neuen Code erzeugt: diese Liste ist geschlossen
function houseClosed() {
  unsubs.forEach(u => u());
  unsubs = [];
  ls.del("ek.code");
  history.replaceState(null, "", location.pathname);
  showSetup("Für eure Familienliste wurde ein neuer Code erzeugt. Lass dir bitte den neuen Einladungslink schicken.");
}
$("#rotateBtn").onclick = rotateCode;

/* ---------- Einstellungen ---------- */
const inviteLink = () => location.origin + location.pathname + "?join=" + S.code;
$("#settingsBtn").onclick = () => {
  $("#myName").value = S.name;
  $("#myCode").textContent = S.code;
  $("#myPaypal").value = S.members.find(m => m.id === S.uid)?.paypal || "";
  $("#bigText").checked = ls.get("ek.bigText") === "1";
  $("#keepAwake").checked = ls.get("ek.awake") !== "0";
  $("#keepAwake").parentElement.hidden = !("wakeLock" in navigator);
  $("#simpleMode").checked = ls.get("ek.simple") === "1";
  $("#modeNote").textContent = store.mode === "local" ? "Demo-Modus: Alles bleibt nur auf diesem Gerät." : "";
  renderMembers();
  $("#settingsDlg").showModal();
};
$("#settingsClose").onclick = () => $("#settingsDlg").close();
function renderMembers() {
  const box = $("#members");
  if (!box) return;
  box.textContent = "";
  S.members.forEach(m => {
    const p = el("span", "member", m.id === S.uid ? `${m.name} (du)` : m.name);
    p.style.setProperty("--c", `hsl(${hash(m.id) % 360} 45% 42%)`);
    box.appendChild(p);
  });
}
$("#savePaypal").onclick = async () => {
  const raw = $("#myPaypal").value.trim();
  const name = raw ? paypalName(raw) : "";
  if (name === null) { toast("Das sieht nicht wie ein PayPal.Me-Name aus, z. B. SarahK"); return; }
  $("#myPaypal").value = name;
  try {
    await house.patch("members", S.uid, { paypal: name });
    toast(name ? `Gespeichert: paypal.me/${name}` : "PayPal.Me entfernt");
  } catch (err) { console.error(err); fail("Speichern")(); }
};
$("#oftenMore").onclick = () => { oftenAll = !oftenAll; renderOften(); };
$("#saveName").onclick = async () => {
  const n = $("#myName").value.trim();
  if (!n) return;
  S.name = n; ls.set("ek.name", n);
  $("#hello").textContent = `Hallo ${n}`;
  await house.patch("members", S.uid, { name: n, seenAt: Date.now() }).catch(fail("Speichern"));
  toast("Name geändert");
};
$("#shareBtn").onclick = async () => {
  const text = `Komm in unsere Einkaufsliste! Code: ${S.code}`;
  if (navigator.share) {
    try { await navigator.share({ title: "Einkauf", text, url: inviteLink() }); } catch {}
  } else $("#copyBtn").click();
};
$("#copyBtn").onclick = async () => {
  try { await navigator.clipboard.writeText(inviteLink()); toast("Link kopiert"); }
  catch { prompt("Diesen Link verschicken:", inviteLink()); }
};
$("#bigText").onchange = e => { ls.set("ek.bigText", e.target.checked ? "1" : "0"); applyBigText(e.target.checked); };
$("#keepAwake").onchange = e => { ls.set("ek.awake", e.target.checked ? "1" : "0"); wakeLock(!!S.current); };
function applyBigText(on) { document.documentElement.classList.toggle("big", on); }
// Einfacher Modus: blendet alles mit der Klasse "adv" aus (Läden bearbeiten, Ausgaben, Verlauf, Löschen …)
$("#simpleMode").onchange = e => { ls.set("ek.simple", e.target.checked ? "1" : "0"); applySimple(e.target.checked); };
function applySimple(on) { document.documentElement.classList.toggle("simple", on); }
$("#leaveBtn").onclick = () => {
  if (!confirm("Auf diesem Gerät abmelden? Mit dem Code kommst du jederzeit wieder rein.")) return;
  unsubs.forEach(u => u());
  ls.del("ek.code");
  location.href = location.pathname;
};

// Bildschirm anlassen, solange eine Liste offen ist (Einkaufen mit vollen Händen)
let lock = null;
async function wakeLock(want) {
  want = want && ls.get("ek.awake") !== "0" && "wakeLock" in navigator;
  if (want && !lock && document.visibilityState === "visible") {
    try { lock = await navigator.wakeLock.request("screen"); lock.addEventListener("release", () => { lock = null; }); } catch {}
  } else if (!want && lock) { lock.release(); lock = null; }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { wakeLock(!!S.current); if (S.current) renderList(); }
  else if (S.current) markSeen(S.current);
});

if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});

boot();
