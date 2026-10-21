import { createStore, hasFirebase, randomCode } from "./store.js";
import { CATS, CAT, norm, keyOf, guessCat as guessFrom, splitQty } from "./cats.js";

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
  stores: [], items: [], members: [], known: [],
  current: null,          // geöffneter Laden (id)
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
const guessCat = text => guessFrom(text, S.known);
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

const storeById = id => S.stores.find(s => s.id === id);
const itemsOf = id => S.items.filter(i => i.storeId === id);
const openOf = id => itemsOf(id).filter(i => !i.done);
const sortedStores = () => [...S.stores].sort((a, b) => (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0));

/* ---------- Einrichtung ---------- */
async function boot() {
  applyBigText(ls.get("ek.bigText") === "1");
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
    if (!(await store.exists(code))) { $("#setupError").textContent = "Diesen Code gibt es nicht. Tippfehler?"; return; }
  } catch (e) { console.error(e); $("#setupError").textContent = "Keine Verbindung. Bist du online?"; return; }
  history.replaceState(null, "", location.pathname);
  enter(code);
}

function enter(code) {
  S.code = code; ls.set("ek.code", code);
  house = store.open(code);
  if (!S.name) { showSetup(); return; }
  house.set("members", S.uid, { name: S.name, seenAt: Date.now() }).catch(() => {});

  const onErr = e => { console.error(e); toast("Verbindung unterbrochen. Änderungen werden nachgeholt."); };
  unsubs.forEach(u => u());
  unsubs = [
    house.watch("stores", l => { S.stores = l; renderAll(); }, onErr),
    house.watch("items", l => { S.items = l; renderAll(); }, onErr),
    house.watch("members", l => { S.members = l; renderMembers(); }, onErr),
    house.watch("known", l => { S.known = l; if (S.current) renderOften(); }, onErr)
  ];

  $("#setup").hidden = true;
  $("#app").hidden = false;
  $("#hello").textContent = `Hallo ${S.name}`;
  const fromHash = decodeURIComponent(location.hash.slice(1));
  showView(fromHash || null, true);
}

/* ---------- Ansichten ---------- */
function showView(storeId, replace = false) {
  S.current = storeId || null;
  $("#home").hidden = !!S.current;
  $("#list").hidden = !S.current;
  const url = location.pathname + location.search + (S.current ? "#" + encodeURIComponent(S.current) : "");
  if (replace) history.replaceState({ s: S.current }, "", url);
  else history.pushState({ s: S.current }, "", url);
  if (S.current) { S.visitSeen = S.seen[S.current] || 0; markSeen(S.current); $("#addInput").value = ""; hideSuggest(); }
  wakeLock(!!S.current);
  renderAll();
  $("#listScroll").scrollTop = 0;
}
window.addEventListener("popstate", e => {
  if (S.current) markSeen(S.current);
  S.current = e.state?.s || null;
  if (S.current) S.visitSeen = S.seen[S.current] || 0;
  $("#home").hidden = !!S.current;
  $("#list").hidden = !S.current;
  wakeLock(!!S.current);
  renderAll();
});
$("#backBtn").onclick = () => history.state?.s && history.length > 1 ? history.back() : showView(null, true);

function markSeen(id) {
  S.seen[id] = Date.now();
  ls.set("ek.seen", JSON.stringify(S.seen));
}
// Während ich eine Liste anschaue, gilt als "neu", was seit meinem vorigen Besuch dazukam
const isNew = i => i.by !== S.uid && i.at > (i.storeId === S.current ? S.visitSeen : S.seen[i.storeId] || 0);

function renderAll() {
  if (S.current && !storeById(S.current) && S.stores.length) { showView(null, true); return; }
  if (S.current) renderList(); else renderHome();
}

/* ---------- Übersicht ---------- */
function renderHome() {
  const box = $("#stores");
  box.textContent = "";
  for (const s of sortedStores()) {
    const open = openOf(s.id);
    const card = el("button", "store");
    card.style.setProperty("--c", s.color || COLORS[0]);
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

async function createStore_(name, color) {
  const used = new Set(S.stores.map(s => s.color));
  const pick = color || COLORS.find(c => !used.has(c)) || COLORS[hash(name) % COLORS.length];
  const now = Date.now();
  try { await house.add("stores", { name, color: pick, createdAt: now, order: now, by: S.uid }); }
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
  $("#storeDlg").showModal();
}
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
  if (S.stores.some(x => x !== editStore && norm(x.name) === norm(name))) { $("#sError").textContent = "Diesen Laden gibt es schon."; return; }
  try {
    if (editStore) await house.update("stores", editStore.id, { name, color: pickedColor });
    else await createStore_(name, pickedColor);
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
  $("#listTop").style.setProperty("--c", s.color);
  document.querySelector("#list").style.setProperty("--c", s.color);

  const box = $("#items");
  box.textContent = "";
  const all = itemsOf(s.id);
  const open = all.filter(i => !i.done), done = all.filter(i => i.done);

  if (!all.length) {
    box.appendChild(el("div", "notice", `Die Liste für ${s.name} ist leer. Schreib oben rein, was fehlt. Alle sehen es sofort.`));
  }

  // Dringendes ganz oben, der Rest nach Abteilungen
  const groups = [{ label: "❗ Dringend", list: open.filter(i => i.urgent) }, ...CATS.map(cat => ({
    label: `${cat.emoji} ${cat.name}`,
    list: open.filter(i => !i.urgent && (CAT[i.cat] ? i.cat : "sonst") === cat.id)
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
  renderOften();
}

function itemRow(i) {
  const li = el("li", "item" + (i.done ? " isdone" : "") + (i.urgent ? " urgent" : "") + (i.missing ? " missing" : ""));
  const check = el("button", "tick");
  check.setAttribute("aria-label", i.done ? `${i.text} wieder auf die Liste` : `${i.text} abhaken`);
  check.setAttribute("aria-pressed", i.done ? "true" : "false");
  check.onclick = () => toggleDone(i);
  li.appendChild(check);

  const body = el("button", "itembody");
  body.setAttribute("aria-label", `${i.text} bearbeiten`);
  const line = el("span", "itemline");
  if (i.qty) line.appendChild(el("span", "qty", i.qty));
  line.appendChild(el("span", "itemtext", i.text));
  body.appendChild(line);
  if (i.note) body.appendChild(el("span", "note", i.note));
  const meta = el("span", "itemmeta");
  if (i.urgent && !i.done) meta.appendChild(el("span", "tag urgent", "dringend"));
  if (i.missing && !i.done) meta.appendChild(el("span", "tag missing", `gab's nicht · ${when(i.missingAt)}`));
  if (isNew(i) && !i.done) meta.appendChild(el("span", "tag new", "neu"));
  meta.appendChild(document.createTextNode(i.done
    ? `${i.doneBy === S.uid ? "von dir" : "von " + nameOf(i.doneBy)} besorgt`
    : `von ${nameOf(i.by)} · ${when(i.at)}`));
  body.appendChild(meta);
  body.onclick = () => openItemDlg(i);
  li.appendChild(body);

  if (i.photo) {
    const img = el("img", "thumb");
    img.src = i.photo; img.alt = "";
    img.onclick = () => openItemDlg(i);
    li.appendChild(img);
  }
  return li;
}

function toggleDone(i) {
  const data = i.done ? { done: false } : { done: true, doneBy: S.uid, doneAt: Date.now(), missing: false };
  house.update("items", i.id, data).catch(fail("Abhaken"));
  if (!i.done && navigator.vibrate) navigator.vibrate(15);
}

function clearDone() {
  const done = itemsOf(S.current).filter(i => i.done);
  const backup = done.map(({ id, ...data }) => ({ id, data }));
  house.batch(done.map(i => ({ type: "delete", c: "items", id: i.id })))
    .then(() => toast(`${done.length} erledigte Einträge entfernt`, {
      label: "Rückgängig",
      run: () => house.batch(backup.map(b => ({ c: "items", id: b.id, data: b.data }))).catch(fail("Wiederherstellen"))
    }))
    .catch(fail("Aufräumen"));
}

/* ---------- Hinzufügen ---------- */
async function addItem(raw, extra = {}) {
  const { qty, text } = splitQty(raw);
  if (!text) return;
  const dup = openOf(S.current).find(i => norm(i.text) === norm(text));
  if (dup) {
    toast(`„${dup.text}“ steht schon drauf`);
    return;
  }
  const cat = extra.cat || guessCat(text);
  const now = Date.now();
  const k = S.known.find(x => x.id === keyOf(text));
  try {
    await house.batch([
      { c: "items", data: { text, qty, note: "", cat, storeId: S.current, done: false, urgent: false, by: S.uid, at: now } },
      { c: "known", id: keyOf(text), data: { text, cat, count: (k?.count || 0) + 1, last: now, stores: { ...(k?.stores || {}), [S.current]: now } } }
    ]);
  } catch (e) { console.error(e); fail("Speichern")(); }
}

$("#addForm").onsubmit = e => {
  e.preventDefault();
  const v = $("#addInput").value.trim();
  if (!v) return;
  $("#addInput").value = "";
  hideSuggest();
  addItem(v);
  $("#addInput").focus();
};

// Vorschläge beim Tippen aus allem, was schon mal auf einer Liste stand
$("#addInput").oninput = () => {
  const { text } = splitQty($("#addInput").value);
  const q = norm(text);
  const box = $("#suggest");
  if (q.length < 2) return hideSuggest();
  const openNow = new Set(openOf(S.current).map(i => norm(i.text)));
  const hits = S.known
    .filter(k => !openNow.has(norm(k.text)) && norm(k.text) !== q && norm(k.text).includes(q))
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
function renderOften() {
  const id = S.current;
  const openNow = new Set(openOf(id).map(i => norm(i.text)));
  const list = S.known
    .filter(k => k.stores?.[id] && !openNow.has(norm(k.text)) && (k.count || 0) >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  $("#often").hidden = !list.length;
  const box = $("#oftenChips");
  box.textContent = "";
  list.forEach(k => {
    const b = el("button", "chip", "+ " + k.text);
    b.onclick = () => addItem(k.text, { cat: k.cat });
    box.appendChild(b);
  });
}

/* ---------- Eintrag-Dialog ---------- */
let editItem = null, editPhoto = null, editStoreId = null;
$("#fCat").append(...CATS.map(c => { const o = el("option", "", `${c.emoji} ${c.name}`); o.value = c.id; return o; }));

function openItemDlg(i) {
  editItem = i; editPhoto = i.photo || null; editStoreId = i.storeId;
  $("#fText").value = i.text;
  $("#fQty").value = i.qty || "";
  $("#fNote").value = i.note || "";
  $("#fCat").value = CAT[i.cat] ? i.cat : "sonst";
  $("#fUrgent").checked = !!i.urgent;
  $("#fError").textContent = "";
  $("#fMissing").hidden = i.done;
  $("#fMissing").textContent = i.missing ? "Doch wieder suchen" : "Gab's nicht";
  $("#fMeta").textContent = `Eingetragen von ${nameOf(i.by)}, ${when(i.at)}` + (i.done ? ` · besorgt ${when(i.doneAt)}` : "");
  renderPhoto();
  renderStoreChips();
  $("#itemDlg").showModal();
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
    b.style.setProperty("--c", s.color);
    b.onclick = () => { editStoreId = s.id; renderStoreChips(); };
    box.appendChild(b);
  });
}
$("#fPhotoInput").onchange = async e => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try { editPhoto = await compressImage(file); renderPhoto(); }
  catch { $("#fError").textContent = "Das Foto ließ sich nicht verarbeiten."; }
};
$("#fPhotoDel").onclick = () => { editPhoto = null; renderPhoto(); };
$("#fCancel").onclick = () => $("#itemDlg").close();

$("#itemForm").onsubmit = async e => {
  e.preventDefault();
  const text = $("#fText").value.trim();
  if (!text) return;
  const cat = $("#fCat").value;
  const data = {
    text, qty: $("#fQty").value.trim(), note: $("#fNote").value.trim(), cat,
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
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let side = 900;
      for (let tries = 0; tries < 6; tries++) {
        const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        for (const q of [0.8, 0.7, 0.6]) {
          const out = c.toDataURL("image/jpeg", q);
          if (out.length < 250_000) return resolve(out);
        }
        side = Math.round(side * 0.75);
      }
      reject(new Error("Bild zu groß"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Bild nicht lesbar")); };
    img.src = url;
  });
}

/* ---------- Einstellungen ---------- */
const inviteLink = () => location.origin + location.pathname + "?join=" + S.code;
$("#settingsBtn").onclick = () => {
  $("#myName").value = S.name;
  $("#myCode").textContent = S.code;
  $("#bigText").checked = ls.get("ek.bigText") === "1";
  $("#keepAwake").checked = ls.get("ek.awake") !== "0";
  $("#keepAwake").parentElement.hidden = !("wakeLock" in navigator);
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
$("#saveName").onclick = async () => {
  const n = $("#myName").value.trim();
  if (!n) return;
  S.name = n; ls.set("ek.name", n);
  $("#hello").textContent = `Hallo ${n}`;
  await house.set("members", S.uid, { name: n, seenAt: Date.now() }).catch(fail("Speichern"));
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
