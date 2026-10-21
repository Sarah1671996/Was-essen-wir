import { createStore, hasFirebase, randomCode } from "./store.js";
import { STARTER_DISHES } from "./starter-dishes.js";

// Die Beispielgerichte der ersten Version. Sie werden beim Übernehmen der neuen Liste entfernt.
const OLD_STARTER_NAMES = new Set(["Spaghetti Carbonara", "Pizza Margherita", "Lasagne", "Pilz-Risotto", "Sushi", "Ramen",
  "Tacos", "Burrito", "Chili sin Carne", "Burger mit Pommes", "Chicken Tikka Masala", "Pad Thai", "Käsespätzle",
  "Schnitzel mit Kartoffelsalat", "Flammkuchen", "Falafel-Bowl", "Dumplings", "Poke Bowl", "Paella", "Raclette",
  "Döner", "Kürbissuppe", "Shakshuka", "Pancakes", "Salat mit Ziegenkäse", "Ofenlachs mit Gemüse"]);

const $ = s => document.querySelector(s);
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};

const S = {
  uid: null, code: null, name: "",
  dishes: [], members: [], wishes: [], shopping: [],
  myVotes: {}, history: [], salt: ls.get("em.salt") || "1",
  votesLoaded: false,
  // Runden: Wer "Neue Runde" startet, erhöht round. Jedes Handy leert dann seine eigenen Swipes.
  round: 0, myRound: 0, roundLoaded: false
};
let store, room, unsubs = [];

/* ---------- kleine Helfer ---------- */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; }
function hueFor(s) { return hash(s || "x") % 360; }
function paint(node, d, emojiClass = "emo") {
  node.textContent = "";
  if (d.image) {
    node.style.background = "";
    node.style.backgroundImage = `url("${d.image}")`;
  } else {
    const h = hueFor(d.cuisine || d.name);
    node.style.backgroundImage = "";
    node.style.background = `radial-gradient(circle at 30% 25%, hsl(${h} 75% 86%), hsl(${(h + 20) % 360} 55% 62%))`;
    node.appendChild(el("span", emojiClass, d.emoji || "🍽️"));
  }
}
function metaChips(d) {
  const box = el("div", "meta");
  if (d.course) box.appendChild(el("span", "chip", d.course));
  if (d.cuisine) box.appendChild(el("span", "chip", d.cuisine));
  if (d.mins) box.appendChild(el("span", "chip", `ca. ${d.mins} Min.`));
  if (d.ingredients || d.steps || d.link) box.appendChild(el("span", "chip", "Rezept"));
  return box;
}
function toast(msg, match = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.toggle("match", match);
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 2400);
}
function avatar(m) {
  const a = el("span", "avatar", (m.name || "?").trim().charAt(0).toUpperCase());
  a.style.background = `hsl(${hueFor(m.id)} 45% 42%)`;
  a.title = m.name || "";
  return a;
}
const others = () => S.members.filter(m => m.id !== S.uid);
const nameOf = uid => uid === S.uid ? "Du" : (S.members.find(m => m.id === uid)?.name || "Jemand");
const inRound = m => (m.round || 0) === S.round;
const likersOf = id => others().filter(m => inRound(m) && m.votes?.[id] === 1);
function fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString("de-DE", { day: "numeric", month: "short" }) : ""; }

/* ---------- Einrichtung ---------- */
async function boot() {
  try {
    store = await createStore();
  } catch (e) {
    console.error(e);
    showSetup();
    $("#setupError").textContent = "Verbindung zu Firebase fehlgeschlagen. Prüfe die Internetverbindung und die Werte in firebase-config.js.";
    return;
  }
  S.uid = store.uid;
  $("#demoNote").hidden = hasFirebase;

  const invite = new URLSearchParams(location.search).get("k");
  S.name = ls.get("em.name") || "";
  const saved = ls.get("em.code");
  if (S.name && (saved || invite)) {
    const code = invite || saved;
    if (await tryEnter(code, false)) return;
  }
  showSetup(invite);
}

function showSetup(invite) {
  $("#app").hidden = true;
  $("#setup").hidden = false;
  $("#setupName").value = S.name;
  $("#setupInvite").hidden = !invite;
  $("#setupChoice").hidden = !!invite;
  $("#setupJoinInvite").onclick = () => withName(() => tryEnter(invite, false));
  $("#setupCreate").onclick = () => withName(() => tryEnter(randomCode(), true));
  $("#setupJoin").onclick = () => withName(() => tryEnter($("#setupCode").value.trim().toLowerCase(), false));
}
async function withName(fn) {
  const n = $("#setupName").value.trim();
  if (!n) { $("#setupError").textContent = "Bitte gib zuerst deinen Namen ein."; $("#setupName").focus(); return; }
  S.name = n; ls.set("em.name", n);
  $("#setupError").textContent = "";
  document.querySelectorAll("#setup button").forEach(b => b.disabled = true);
  const ok = await fn();
  document.querySelectorAll("#setup button").forEach(b => b.disabled = false);
  if (!ok && !$("#setupError").textContent) $("#setupError").textContent = "Das hat nicht geklappt. Versuch es nochmal.";
}

async function tryEnter(code, create) {
  if (!code) { $("#setupError").textContent = "Bitte gib den Einladungscode ein."; return false; }
  try {
    if (create) {
      await store.createRoom(code);
      const now = Date.now();
      await store.room(code).addMany("dishes", STARTER_DISHES.map((d, i) => ({ ...d, starter: true, createdAt: now + i, createdBy: S.uid })));
    } else if (!(await store.roomExists(code))) {
      $("#setupError").textContent = hasFirebase
        ? "Diesen Code gibt es nicht. Prüf ihn nochmal oder lass dir den Link schicken."
        : "Im Demo-Modus gibt es nur Küchen auf diesem Gerät. Leg eine neue an.";
      return false;
    }
  } catch (e) {
    console.error(e);
    $("#setupError").textContent = "Keine Verbindung. Prüfe dein Internet und versuch es nochmal.";
    return false;
  }
  S.code = code;
  ls.set("em.code", code);
  if (location.search) history.replaceState(null, "", location.pathname);
  enterRoom();
  return true;
}

function enterRoom() {
  $("#setup").hidden = true;
  $("#app").hidden = false;
  unsubs.forEach(u => u());
  S.votesLoaded = false;
  S.roundLoaded = false;
  starterSynced = false;
  room = store.room(S.code);
  const onErr = e => { console.error(e); toast("Verbindung unterbrochen. Lade die App neu."); };
  unsubs = [
    room.watch("dishes", list => { S.dishes = list; syncStarterData(); renderAll(); }, { field: "createdAt" }, onErr),
    room.watch("members", list => {
      S.members = list;
      const mine = list.find(m => m.id === S.uid);
      if (!S.votesLoaded) {
        S.votesLoaded = true;
        S.myVotes = { ...(mine?.votes || {}), ...S.myVotes };
        S.myRound = mine?.round || 0;
        if (!mine || mine.name !== S.name) saveMe();
        checkRound();
      }
      renderAll();
    }, null, onErr),
    room.watch("wishes", list => { S.wishes = list; renderWishes(); }, { field: "at", dir: "desc" }, onErr),
    room.watch("shopping", list => { S.shopping = list; renderShopping(); }, { field: "at" }, onErr),
    room.watch("meta", list => {
      S.round = list.find(x => x.id === "round")?.n || 0;
      S.roundLoaded = true;
      checkRound();
      renderAll();
    }, null, onErr)
  ];
  renderAll();
}

// Startgerichte, die vor dem Zutaten-Import angelegt wurden, bekommen Kategorie und Zutaten nachgetragen.
// Läuft einmal pro Start; selbst eingetragene Zutaten werden nie überschrieben.
let starterSynced = false;
function syncStarterData() {
  if (starterSynced || !S.dishes.length) return;
  starterSynced = true;
  const byName = new Map(STARTER_DISHES.map(d => [d.name, d]));
  const changes = S.dishes
    .filter(d => d.starter && d.course === undefined && byName.has(d.name))
    .map(d => {
      const s = byName.get(d.name);
      const data = { course: s.course || "" };
      if (!d.ingredients && s.ingredients) data.ingredients = s.ingredients;
      return { id: d.id, data };
    });
  if (changes.length) room.updateMany("dishes", changes).catch(e => console.error(e));
}

// Hat jemand eine neue Runde gestartet, leert dieses Handy seine eigenen Swipes
function checkRound() {
  if (!S.votesLoaded || !S.roundLoaded || S.myRound >= S.round) return;
  const fresh = S.myRound > 0 || Object.keys(S.myVotes).length;
  S.myRound = S.round;
  S.myVotes = {}; S.history = []; S.front = null;
  S.salt = String(Date.now()); ls.set("em.salt", S.salt);
  saveMe();
  renderDeck(true);
  if (fresh) toast("Neue Runde! Alle Gerichte sind wieder im Stapel.", true);
}

/* ---------- eigene Swipes speichern (immer nur ein Schreibvorgang gleichzeitig) ---------- */
let saving = false, again = false;
async function saveMe() {
  if (saving) { again = true; return; }
  saving = true;
  try {
    await room.setMember({ name: S.name, votes: { ...S.myVotes }, round: S.myRound, updatedAt: Date.now() });
  } catch (e) {
    console.error(e);
    toast("Speichern hat nicht geklappt.");
  }
  saving = false;
  if (again) { again = false; saveMe(); }
}

/* ---------- Swipen ---------- */
/* Kategorie-Filter für den Stapel (pro Gerät gespeichert) */
const NO_COURSE = "Ohne Kategorie";
const courseOf = d => (d.course || "").trim() || NO_COURSE;
let filter = ls.get("em.filter") || "Alle";
function renderFilter() {
  const bar = $("#filterBar");
  const counts = {};
  S.dishes.forEach(d => { const c = courseOf(d); counts[c] = (counts[c] || 0) + 1; });
  const courses = Object.keys(counts).sort((a, b) =>
    (a === NO_COURSE) - (b === NO_COURSE) || (b === "Hauptgericht") - (a === "Hauptgericht") || a.localeCompare(b, "de"));
  if (filter !== "Alle" && !counts[filter]) filter = "Alle";
  bar.hidden = courses.length < 2;
  bar.textContent = "";
  ["Alle", ...courses].forEach(c => {
    const open = S.dishes.filter(d => !(d.id in S.myVotes) && (c === "Alle" || courseOf(d) === c)).length;
    const b = el("button", "fchip", `${c} · ${open}`);
    b.setAttribute("aria-pressed", c === filter);
    b.onclick = () => { filter = c; ls.set("em.filter", c); renderFilter(); renderDeck(true); };
    bar.appendChild(b);
  });
}
function deckQueue() {
  return S.dishes
    .filter(d => !(d.id in S.myVotes))
    .filter(d => filter === "Alle" || courseOf(d) === filter)
    .sort((a, b) => (b.id === S.front) - (a.id === S.front) || hash(S.salt + a.id) - hash(S.salt + b.id));
}
let deckKey = "";
function renderDeck(force = false) {
  const q = deckQueue();
  const key = q.slice(0, 2).map(d => d.id + ":" + (d.updatedAt || 0)).join("|");
  if (!force && key === deckKey && $("#deck").children.length) return;
  deckKey = key;
  const deck = $("#deck");
  deck.textContent = "";
  $("#votebar").hidden = q.length === 0;
  if (!q.length) {
    const box = el("div", "empty");
    if (!S.dishes.length) {
      box.append(el("strong", null, "Noch keine Gerichte"), el("span", null, "Leg unter „Gerichte“ das erste an."));
    } else if (filter !== "Alle" && S.dishes.some(d => !(d.id in S.myVotes))) {
      box.append(el("strong", null, `${filter}: alles durchgeswipt`),
        el("span", null, "In anderen Kategorien warten noch Gerichte."));
      const b = el("button", "btn", "Alle Kategorien zeigen");
      b.onclick = () => { filter = "Alle"; ls.set("em.filter", filter); renderFilter(); renderDeck(true); };
      box.appendChild(b);
    } else {
      box.append(el("strong", null, "Alles durchgeswipt"),
        el("span", null, "Schau bei den Matches, was ihr beide wollt, oder leg neue Gerichte an."));
      const b = el("button", "btn", "Matches ansehen");
      b.onclick = () => showTab("match");
      box.appendChild(b);
    }
    deck.appendChild(box);
    return;
  }
  q.slice(0, 2).reverse().forEach((d, i, arr) => {
    const top = i === arr.length - 1;
    const card = el("div", "card" + (top ? "" : " behind"));
    const pic = el("div", "pic");
    paint(pic, d);
    pic.append(el("span", "stamp yes", "Lecker"), el("span", "stamp no", "Nö"));
    const info = el("div", "info");
    info.append(el("h2", null, d.name), metaChips(d));
    if (d.ingredients || d.steps) info.appendChild(el("span", "more", "Tippen für das Rezept"));
    card.append(pic, info);
    if (top) { card.dataset.id = d.id; attachDrag(card, d); }
    deck.appendChild(card);
  });
}
function attachDrag(card, d) {
  let x0 = 0, dx = 0, t0 = 0, active = false;
  const yes = card.querySelector(".stamp.yes"), no = card.querySelector(".stamp.no");
  card.addEventListener("pointerdown", e => {
    active = true; x0 = e.clientX; dx = 0; t0 = Date.now();
    card.setPointerCapture(e.pointerId); card.classList.add("dragging");
  });
  card.addEventListener("pointermove", e => {
    if (!active) return;
    dx = e.clientX - x0;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    yes.style.opacity = Math.max(0, Math.min(1, dx / 90));
    no.style.opacity = Math.max(0, Math.min(1, -dx / 90));
  });
  const end = () => {
    if (!active) return;
    active = false; card.classList.remove("dragging");
    if (Math.abs(dx) > 100) return fling(card, dx > 0);
    card.style.transform = ""; yes.style.opacity = 0; no.style.opacity = 0;
    if (Math.abs(dx) < 6 && Date.now() - t0 < 400) openDetail(d.id);
  };
  card.addEventListener("pointerup", end);
  card.addEventListener("pointercancel", end);
}
function fling(card, like) {
  if (card.dataset.gone) return;
  card.dataset.gone = "1";
  card.querySelector(like ? ".stamp.yes" : ".stamp.no").style.opacity = 1;
  card.style.transform = `translateX(${like ? 600 : -600}px) rotate(${like ? 30 : -30}deg)`;
  setTimeout(() => vote(card.dataset.id, like), 180);
}
function vote(id, like) {
  S.myVotes[id] = like ? 1 : 0;
  S.history.push(id);
  if (S.front === id) S.front = null;
  if (like) {
    const fans = likersOf(id);
    if (fans.length) toast(`Match mit ${fans.map(m => m.name).join(" & ")}! 🎉`, true);
  }
  saveMe();
  renderAll();
}
const topCard = () => $("#deck .card:not(.behind)");
$("#btnYes").onclick = () => { const c = topCard(); if (c) fling(c, true); };
$("#btnNo").onclick = () => { const c = topCard(); if (c) fling(c, false); };
$("#btnUndo").onclick = () => {
  const id = S.history.pop();
  if (!id) { toast("Nichts zum Rückgängigmachen"); return; }
  delete S.myVotes[id];
  S.front = id; // zurückgeholte Karte liegt wieder oben
  saveMe();
  renderAll();
};
document.addEventListener("keydown", e => {
  if ($("#view-swipe").hidden || document.querySelector("dialog[open]") || /input|textarea/i.test(e.target.tagName)) return;
  if (e.key === "ArrowRight") $("#btnYes").click();
  if (e.key === "ArrowLeft") $("#btnNo").click();
});

/* ---------- Matches ---------- */
function dishRow(d, sub, onClick) {
  const r = el(onClick ? "button" : "div", "row");
  const th = el("div", "thumb");
  paint(th, d, "");
  const txt = el("div", "txt");
  txt.append(el("div", "t", d.name), el("div", "s", sub));
  r.append(th, txt);
  if (onClick) r.onclick = onClick;
  return r;
}
function renderMatches() {
  const list = $("#matchList");
  list.textContent = "";
  const both = S.dishes.filter(d => S.myVotes[d.id] === 1 && likersOf(d.id).length);
  const waiting = S.dishes.filter(d => !(d.id in S.myVotes) && likersOf(d.id).length);
  const onlyMe = S.dishes.filter(d => S.myVotes[d.id] === 1 && !likersOf(d.id).length);
  $("#matchCount").textContent = both.length || "";

  if (!others().length) {
    const n = el("div", "notice");
    n.append("Noch ist niemand außer dir in der Küche. ");
    const b = el("button", "btn mini", "Jemanden einladen");
    b.onclick = openRoom;
    n.appendChild(b);
    list.appendChild(n);
  }
  list.appendChild(el("div", "sectlabel", `Ihr wollt beide (${both.length})`));
  if (both.length) {
    both.forEach(d => {
      const who = others().length > 1 ? "Mit " + likersOf(d.id).map(m => m.name).join(", ") : [d.cuisine, d.mins && `ca. ${d.mins} Min.`].filter(Boolean).join(" · ");
      list.appendChild(dishRow(d, who || "Match", () => openDetail(d.id)));
    });
  } else {
    list.appendChild(el("div", "notice", "Noch kein Match. Weiterswipen!"));
  }
  if (waiting.length) {
    list.appendChild(el("div", "sectlabel", "Wartet auf dich"));
    const n = el("div", "notice", `${waiting.length} Gericht${waiting.length > 1 ? "e haben" : " hat"} schon ein Herz bekommen, aber du hast noch nicht geswipt. `);
    const b = el("button", "btn mini", "Jetzt swipen");
    b.onclick = () => showTab("swipe");
    n.appendChild(b);
    list.appendChild(n);
  }
  if (onlyMe.length) {
    list.appendChild(el("div", "sectlabel", `Nur du willst (${onlyMe.length})`));
    onlyMe.forEach(d => list.appendChild(dishRow(d, "Wartet auf ein zweites Herz", () => openDetail(d.id))));
  }
  const roundBox = el("div", "panel round");
  list.appendChild(roundBox);
  renderRoundBox(roundBox);
}

/* ---------- Neue Runde: Swipes und Matches für alle löschen ---------- */
function renderRoundBox(box) {
  box.textContent = "";
  box.appendChild(el("p", "small", "Neue Woche, neue Runde: Die Swipes und Matches von euch allen werden gelöscht, und ihr swipt wieder von vorn. Gerichte, Wünsche und Einkaufsliste bleiben."));
  const b = el("button", "btn ghost", "Neue Runde starten");
  b.onclick = () => {
    box.textContent = "";
    box.appendChild(el("p", "small", "Wirklich alle Swipes und Matches löschen?"));
    const row = el("div", "joinrow");
    const yes = el("button", "btn danger", "Ja, neue Runde");
    const no = el("button", "btn ghost", "Abbrechen");
    yes.onclick = async () => {
      yes.disabled = no.disabled = true;
      try {
        await room.set("meta", "round", { n: S.round + 1, at: Date.now(), by: S.uid });
        showTab("swipe");
      } catch (e) {
        console.error(e);
        toast("Das hat nicht geklappt. Versuch es nochmal.");
        renderRoundBox(box);
      }
    };
    no.onclick = () => renderRoundBox(box);
    row.append(yes, no);
    box.appendChild(row);
  };
  box.appendChild(b);
}

/* ---------- Einkaufsliste ---------- */
function shopRow(item) {
  const r = el("div", "row" + (item.done ? " done" : ""));
  const c = el("button", "check", item.done ? "✓" : "");
  c.setAttribute("aria-label", item.done ? "Wieder offen" : "Abhaken");
  c.onclick = () => room.update("shopping", item.id, { done: !item.done, doneBy: S.uid, doneAt: Date.now() })
    .catch(() => toast("Konnte nicht speichern"));
  const txt = el("div", "txt");
  const who = item.done
    ? `abgehakt von ${item.doneBy === S.uid ? "dir" : nameOf(item.doneBy)}`
    : `${nameOf(item.by)}${item.from ? " · für " + item.from : ""}`;
  txt.append(el("div", "t", item.text), el("div", "s", who));
  const del = el("button", "iconbtn", "✕");
  del.setAttribute("aria-label", "Eintrag löschen");
  del.onclick = () => room.remove("shopping", item.id).catch(() => toast("Löschen hat nicht geklappt"));
  r.append(c, txt, del);
  return r;
}
function renderShopping() {
  const open = S.shopping.filter(i => !i.done), done = S.shopping.filter(i => i.done);
  $("#shopCount").textContent = open.length || "";
  const list = $("#shopList"), doneList = $("#shopDone");
  list.textContent = ""; doneList.textContent = "";
  if (!S.shopping.length) {
    list.appendChild(el("div", "notice", "Die Einkaufsliste ist leer. Trag oben ein, was fehlt. Ihr seht beide sofort alle Änderungen."));
  }
  open.forEach(i => list.appendChild(shopRow(i)));
  if (done.length) {
    const head = el("div", "toolbar");
    head.style.alignItems = "center";
    const lbl = el("div", "sectlabel", `Erledigt (${done.length})`);
    lbl.style.flex = "1";
    const clear = el("button", "btn mini ghost", "Erledigte löschen");
    clear.onclick = () => room.replace("shopping", done.map(i => i.id), []).catch(() => toast("Löschen hat nicht geklappt"));
    head.append(lbl, clear);
    doneList.appendChild(head);
    done.forEach(i => doneList.appendChild(shopRow(i)));
  }
}
$("#shopForm").addEventListener("submit", async e => {
  e.preventDefault();
  const text = $("#shopText").value.trim();
  if (!text) return;
  $("#shopText").value = "";
  try { await room.add("shopping", { text, by: S.uid, at: Date.now(), done: false }); }
  catch { $("#shopText").value = text; toast("Konnte nicht speichern"); }
  $("#shopText").focus();
});
async function addIngredientsToShopping(d) {
  const lines = (d.ingredients || "").split("\n").map(x => x.trim()).filter(Boolean);
  const have = new Set(S.shopping.filter(i => !i.done).map(i => i.text.toLowerCase()));
  const now = Date.now();
  const items = lines.filter(l => !have.has(l.toLowerCase()))
    .map((text, i) => ({ text, by: S.uid, at: now + i, done: false, from: d.name }));
  if (!items.length) { toast("Steht schon alles auf der Liste"); return; }
  try { await room.addMany("shopping", items); toast(`${items.length} Zutaten auf der Einkaufsliste`); }
  catch { toast("Konnte nicht speichern"); }
}

/* ---------- Gerichte-Liste ---------- */
function renderDishes() {
  const q = $("#dishSearch").value.trim().toLowerCase();
  const list = $("#dishList");
  list.textContent = "";
  const items = S.dishes.filter(d => !q || (d.name + " " + (d.cuisine || "")).toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  if (!items.length) {
    list.appendChild(el("div", "notice", q ? "Nichts gefunden." : "Noch keine Gerichte. Tipp auf „+ Neu“."));
    return;
  }
  items.forEach(d => {
    const v = S.myVotes[d.id];
    const mine = v === 1 ? "♥ von dir" : v === 0 ? "✕ von dir" : "noch nicht geswipt";
    const sub = [d.cuisine, mine].filter(Boolean).join(" · ");
    list.appendChild(dishRow(d, sub, () => openDetail(d.id)));
  });
}
$("#dishSearch").addEventListener("input", renderDishes);
$("#newDishBtn").onclick = () => openForm();

/* ---------- Was kann ich mit meinen Zutaten kochen? ---------- */
const norm = s => (s || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
// Grober Wortstamm, damit "Zwiebel" auch "Zwiebeln" findet und "Tomaten" auch "Tomate"
const stem = s => norm(s).trim().replace(/(en|n|e|s)$/, "");
$("#cookBtn").onclick = () => { $("#cookResults").textContent = ""; $("#cookDlg").showModal(); $("#cookText").focus(); };
$("#cookClose").onclick = () => $("#cookDlg").close();
$("#cookForm").addEventListener("submit", e => {
  e.preventDefault();
  const terms = $("#cookText").value.split(/[,;\n]+/).map(t => t.trim()).filter(t => t.length > 1);
  const out = $("#cookResults");
  out.textContent = "";
  if (!terms.length) { out.appendChild(el("p", "small", "Gib mindestens eine Zutat ein.")); return; }

  const hits = S.dishes.map(d => {
    const hay = norm(d.name + "\n" + (d.ingredients || ""));
    const found = terms.filter(t => hay.includes(stem(t)));
    const total = (d.ingredients || "").split("\n").filter(x => x.trim()).length;
    return { d, found, total };
  }).filter(h => h.found.length)
    .sort((a, b) => b.found.length - a.found.length || (a.total || 99) - (b.total || 99));

  out.appendChild(el("div", "sectlabel", `Aus euren Gerichten (${hits.length})`));
  if (!hits.length) out.appendChild(el("p", "small", "Keins eurer Gerichte enthält diese Zutaten. Schau auf Chefkoch."));
  hits.slice(0, 15).forEach(h => {
    const sub = `${h.found.length} von ${terms.length} Zutaten: ${h.found.join(", ")}`;
    out.appendChild(dishRow(h.d, sub, () => { $("#cookDlg").close(); openDetail(h.d.id); }));
  });

  const q = terms.map(t => encodeURIComponent(t)).join("+");
  const a = el("a", "ext-link", "Rezepte mit diesen Zutaten auf Chefkoch.de ↗");
  a.href = `https://www.chefkoch.de/rs/s0/${q}/Rezepte.html`;
  a.target = "_blank"; a.rel = "noopener";
  out.appendChild(a);

  if (store.suggestRecipes) {
    const box = el("div", "stack");
    out.appendChild(el("div", "sectlabel", "Neue Ideen von der KI"));
    out.appendChild(box);
    const b = el("button", "btn", "✨ Rezepte erfinden lassen");
    b.type = "button";
    b.onclick = () => askAi(box, terms);
    box.appendChild(b);
  }
});

let aiBusy = false;
async function askAi(box, terms) {
  if (aiBusy) return;
  aiBusy = true;
  box.textContent = "";
  box.appendChild(el("p", "small", "Die KI überlegt sich Rezepte … das dauert ein paar Sekunden."));
  const known = S.dishes.map(d => d.name).slice(0, 80).join(", ");
  const prompt = [
    "Du bist ein Koch für eine deutsche Haushalts-App. Antworte auf Deutsch.",
    `Vorhandene Zutaten: ${terms.join(", ")}.`,
    "Schlage 3 unterschiedliche, alltagstaugliche Gerichte vor, die vor allem diese Zutaten verwenden.",
    "Grundzutaten wie Salz, Pfeffer, Öl, Butter, Mehl, Zucker, Gewürze und Wasser darf man voraussetzen.",
    "Alles, was darüber hinaus gekauft werden müsste, gehört in 'missing' (möglichst wenig, gern leer).",
    "'ingredients' enthält alle Zutaten mit Mengen für 2 Personen, 'steps' kurze Arbeitsschritte, 'mins' die Gesamtzeit in Minuten,",
    "'description' einen Satz, warum das Gericht gut passt.",
    `Diese Gerichte kennen wir schon, schlage bitte etwas anderes vor: ${known}.`
  ].join("\n");
  try {
    const { recipes = [] } = await store.suggestRecipes(prompt);
    box.textContent = "";
    if (!recipes.length) throw new Error("leer");
    recipes.forEach(r => box.appendChild(aiCard(r)));
    const again = el("button", "btn ghost", "Andere Vorschläge");
    again.type = "button";
    again.onclick = () => askAi(box, terms);
    box.appendChild(again);
  } catch (e) {
    console.error(e);
    box.textContent = "";
    const msg = String(e?.code || "") + " " + String(e?.message || e);
    box.appendChild(el("p", "notice", /api-not-enabled|requires the Firebase AI API|PERMISSION_DENIED|403/i.test(msg)
      ? "Die KI ist im Firebase-Projekt noch nicht eingeschaltet."
      : /quota|429|RESOURCE_EXHAUSTED/i.test(msg)
        ? "Das kostenlose KI-Kontingent ist gerade aufgebraucht. Versuch es später nochmal."
        : "Die KI hat gerade nicht geantwortet. Versuch es nochmal."));
    const retry = el("button", "btn ghost", "Nochmal versuchen");
    retry.type = "button";
    retry.onclick = () => askAi(box, terms);
    box.appendChild(retry);
  }
  aiBusy = false;
}

function aiCard(r) {
  const card = el("div", "panel");
  card.appendChild(el("h3", null, r.name || "Rezeptidee"));
  const meta = el("div", "meta");
  if (r.mins) meta.appendChild(el("span", "chip", `ca. ${r.mins} Min.`));
  meta.appendChild(el("span", "chip", r.missing?.length ? `${r.missing.length} Zutat${r.missing.length > 1 ? "en" : ""} fehlen` : "Alles da"));
  card.appendChild(meta);
  if (r.description) card.appendChild(el("p", "small", r.description));
  if (r.missing?.length) card.appendChild(el("p", "small", "Fehlt noch: " + r.missing.join(", ")));

  const det = el("details");
  det.appendChild(el("summary", null, "Rezept anzeigen"));
  det.appendChild(el("h3", null, "Zutaten"));
  const ul = el("ul"); (r.ingredients || []).forEach(x => ul.appendChild(el("li", null, x))); det.appendChild(ul);
  det.appendChild(el("h3", null, "Zubereitung"));
  const ol = el("ol"); (r.steps || []).forEach(x => ol.appendChild(el("li", null, x))); det.appendChild(ol);
  card.appendChild(det);

  const row = el("div", "sheet-actions");
  const save = el("button", "btn", "Zu unseren Gerichten");
  save.type = "button";
  save.onclick = async () => {
    save.disabled = true;
    try {
      await room.add("dishes", {
        name: (r.name || "Rezeptidee").slice(0, 60), emoji: "✨", cuisine: "KI-Idee", course: "Hauptgericht",
        mins: Number(r.mins) || null, ingredients: (r.ingredients || []).join("\n"), steps: (r.steps || []).join("\n"),
        link: "", image: null, createdAt: Date.now(), updatedAt: Date.now(), createdBy: S.uid
      });
      save.textContent = "Gespeichert ✓";
      toast("Gericht ist im Stapel");
    } catch { save.disabled = false; toast("Konnte nicht speichern"); }
  };
  row.appendChild(save);
  if (r.missing?.length) {
    const shop = el("button", "btn ghost", "Fehlendes auf die Einkaufsliste");
    shop.type = "button";
    shop.onclick = async () => {
      shop.disabled = true;
      const now = Date.now();
      try {
        await room.addMany("shopping", r.missing.map((text, i) => ({ text, by: S.uid, at: now + i, done: false, from: r.name })));
        shop.textContent = "Auf der Liste ✓";
      } catch { shop.disabled = false; toast("Konnte nicht speichern"); }
    };
    row.appendChild(shop);
  }
  card.appendChild(row);
  return card;
}

/* ---------- Detailansicht ---------- */
let detailId = null;
function openDetail(id) {
  const d = S.dishes.find(x => x.id === id);
  if (!d) return;
  detailId = id;
  paint($("#detailPic"), d);
  $("#detailName").textContent = d.name;
  $("#detailMeta").replaceWith(Object.assign(metaChips(d), { id: "detailMeta" }));

  const votes = [];
  const mv = S.myVotes[id];
  votes.push(`Du: ${mv === 1 ? "♥" : mv === 0 ? "✕" : "–"}`);
  others().forEach(m => {
    const ov = m.votes?.[id];
    // Stimmen der anderen erst zeigen, wenn du selbst geswipt hast
    const shown = inRound(m) ? ov : undefined;
    votes.push(`${m.name}: ${mv === undefined ? "?" : shown === 1 ? "♥" : shown === 0 ? "✕" : "–"}`);
  });
  $("#detailVotes").textContent = votes.join("   ");

  const r = $("#detailRecipe");
  r.textContent = "";
  const lines = s => (s || "").split("\n").map(x => x.trim()).filter(Boolean);
  const ing = lines(d.ingredients), steps = lines(d.steps);
  if (ing.length) {
    r.appendChild(el("h3", null, "Zutaten"));
    const ul = el("ul"); ing.forEach(x => ul.appendChild(el("li", null, x))); r.appendChild(ul);
  }
  if (steps.length) {
    r.appendChild(el("h3", null, "Zubereitung"));
    const ol = el("ol"); steps.forEach(x => ol.appendChild(el("li", null, x))); r.appendChild(ol);
  }
  if (d.link && /^https?:\/\//i.test(d.link)) {
    const a = el("a", "recipe-link", "Rezept öffnen ↗");
    a.href = d.link; a.target = "_blank"; a.rel = "noopener";
    r.appendChild(a);
  }
  if (!ing.length && !steps.length && !d.link) r.appendChild(el("p", "small", "Noch kein Rezept hinterlegt. Über „Bearbeiten“ kannst du eins eintragen."));
  if (d.createdBy && S.members.length > 1) r.appendChild(el("p", "small", `Angelegt von ${nameOf(d.createdBy)}`));
  $("#detailShop").hidden = !ing.length;
  $("#detailShop").onclick = () => addIngredientsToShopping(d);
  $("#detailDlg").showModal();
}
$("#detailClose").onclick = () => $("#detailDlg").close();
$("#detailEdit").onclick = () => { $("#detailDlg").close(); openForm(detailId); };

/* ---------- Gericht anlegen / bearbeiten ---------- */
let formId = null, formImage = null, fromWish = null;
function openForm(id = null, preset = {}) {
  formId = id;
  const d = id ? S.dishes.find(x => x.id === id) : { ...preset };
  formImage = d.image || null;
  $("#formTitle").textContent = id ? "Gericht bearbeiten" : "Neues Gericht";
  $("#dishName").value = d.name || "";
  $("#dishEmoji").value = d.emoji || "";
  $("#dishCuisine").value = d.cuisine || "";
  $("#dishCourse").value = d.course || "";
  $("#dishMins").value = d.mins || "";
  $("#dishIngredients").value = d.ingredients || "";
  $("#dishSteps").value = d.steps || "";
  $("#dishLink").value = d.link || "";
  $("#dishPhoto").value = "";
  $("#formError").textContent = "";
  resetDeleteBtn();
  $("#formDelete").hidden = !id;
  updatePreview();
  $("#formDlg").showModal();
}
function updatePreview() {
  paint($("#photoPreview"), {
    image: formImage, emoji: $("#dishEmoji").value.trim() || "🍽️",
    cuisine: $("#dishCuisine").value, name: $("#dishName").value
  }, "");
  $("#photoRemove").hidden = !formImage;
}
["#dishEmoji", "#dishCuisine"].forEach(s => $(s).addEventListener("input", updatePreview));
$("#photoRemove").onclick = () => { formImage = null; updatePreview(); };
$("#dishPhoto").addEventListener("change", async e => {
  const f = e.target.files[0];
  if (!f) return;
  $("#formError").textContent = "";
  $("#formSave").disabled = true;
  try {
    formImage = await compressImage(f);
    updatePreview();
  } catch (err) {
    console.error(err);
    $("#formError").textContent = "Dieses Bild konnte nicht gelesen werden. Versuch ein JPG oder PNG.";
  }
  $("#formSave").disabled = false;
});
$("#formCancel").onclick = () => $("#formDlg").close();
$("#dishForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name = $("#dishName").value.trim();
  if (!name) { $("#formError").textContent = "Bitte gib einen Namen ein."; return; }
  const data = {
    name,
    emoji: $("#dishEmoji").value.trim() || "🍽️",
    cuisine: $("#dishCuisine").value.trim(),
    course: $("#dishCourse").value.trim(),
    mins: Number($("#dishMins").value) || null,
    ingredients: $("#dishIngredients").value.trim(),
    steps: $("#dishSteps").value.trim(),
    link: $("#dishLink").value.trim(),
    image: formImage || null,
    updatedAt: Date.now()
  };
  $("#formSave").disabled = true;
  try {
    if (formId) {
      await room.update("dishes", formId, data);
      toast("Gespeichert");
    } else {
      await room.add("dishes", { ...data, createdAt: Date.now(), createdBy: S.uid });
      toast("Gericht ist im Stapel");
      if (fromWish) { await room.remove("wishes", fromWish).catch(() => {}); }
    }
    fromWish = null;
    $("#formDlg").close();
  } catch (err) {
    console.error(err);
    $("#formError").textContent = hasFirebase
      ? "Speichern hat nicht geklappt. Ist das Foto vielleicht sehr groß? Versuch es nochmal."
      : "Speichern hat nicht geklappt. Im Demo-Modus ist der Speicher für Fotos knapp.";
  }
  $("#formSave").disabled = false;
});
function resetDeleteBtn() {
  const b = $("#formDelete");
  b.textContent = "Löschen";
  b.dataset.armed = "";
}
$("#formDelete").onclick = async () => {
  const b = $("#formDelete");
  if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Wirklich löschen?"; return; }
  try {
    await room.remove("dishes", formId);
    delete S.myVotes[formId];
    saveMe();
    toast("Gericht gelöscht");
    $("#formDlg").close();
  } catch { $("#formError").textContent = "Löschen hat nicht geklappt."; }
};

// Fotos verkleinern, damit sie in die Datenbank passen (max. ca. 600 KB)
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let side = 1100;
      for (let tries = 0; tries < 6; tries++) {
        const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        for (const q of [0.82, 0.72, 0.62]) {
          const out = c.toDataURL("image/jpeg", q);
          if (out.length < 600_000) return resolve(out);
        }
        side = Math.round(side * 0.75);
      }
      reject(new Error("Bild zu groß"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Bild nicht lesbar")); };
    img.src = url;
  });
}

/* ---------- Wünsche (Freitext) ---------- */
function renderWishes() {
  const box = $("#wishList");
  box.textContent = "";
  $("#wishCount").textContent = S.wishes.length || "";
  if (!S.wishes.length) {
    box.appendChild(el("div", "notice", "Noch keine Wünsche. Schreib oben rein, worauf du Lust hast, auch wenn es nicht im Stapel ist."));
    return;
  }
  S.wishes.forEach(w => {
    const r = el("div", "row");
    const txt = el("div", "txt");
    txt.append(el("div", "t", w.text), el("div", "s", `${nameOf(w.by)} · ${fmtDate(w.at)}`));
    const actions = el("div", "actions");
    const add = el("button", "btn mini ghost", "Zum Stapel");
    add.title = "Als Gericht zum Swipen anlegen";
    add.onclick = () => { fromWish = w.id; openForm(null, { name: w.text.slice(0, 60) }); };
    const del = el("button", "iconbtn", "🗑");
    del.setAttribute("aria-label", "Wunsch löschen");
    del.onclick = async () => {
      if (!del.dataset.armed) { del.dataset.armed = "1"; del.textContent = "Löschen?"; del.classList.add("btn", "mini", "danger"); return; }
      try { await room.remove("wishes", w.id); } catch { toast("Löschen hat nicht geklappt"); }
    };
    actions.append(add, del);
    r.append(txt, actions);
    box.appendChild(r);
  });
}
$("#wishForm").addEventListener("submit", async e => {
  e.preventDefault();
  const text = $("#wishText").value.trim();
  if (!text) return;
  $("#wishText").value = "";
  try {
    await room.add("wishes", { text, by: S.uid, at: Date.now() });
    toast("Wunsch eingetragen");
  } catch {
    $("#wishText").value = text;
    toast("Konnte nicht speichern");
  }
});

/* ---------- Küche / Einstellungen ---------- */
function inviteUrl() {
  return location.origin + location.pathname + "?k=" + S.code;
}
function openRoom() {
  const list = $("#memberList");
  list.textContent = "";
  S.members.forEach(m => {
    const r = el("div", "row");
    const swiped = Object.keys(m.votes || {}).length;
    const txt = el("div", "txt");
    txt.append(el("div", "t", m.id === S.uid ? `${m.name} (du)` : m.name), el("div", "s", `${swiped} von ${S.dishes.length} geswipt`));
    r.append(avatar(m), txt);
    list.appendChild(r);
  });
  $("#inviteLink").value = inviteUrl();
  $("#roomCode").textContent = S.code;
  $("#nameEdit").value = S.name;
  $("#modeLine").textContent = hasFirebase ? "" : "Demo-Modus: Daten bleiben nur auf diesem Gerät, bis Firebase eingerichtet ist.";
  renderResetBox();
  renderListBox();
  $("#roomDlg").showModal();
}

// Alte Beispielgerichte gegen die aktuelle Startliste tauschen. Selbst angelegte oder
// bearbeitete Gerichte (mit Foto oder Rezept) bleiben erhalten.
function listUpdate() {
  const remove = S.dishes.filter(d => !d.starter &&
    OLD_STARTER_NAMES.has(d.name) && !d.image && !d.ingredients && !d.steps && !d.link);
  const removeIds = new Set(remove.map(d => d.id));
  const keptNames = new Set(S.dishes.filter(d => !removeIds.has(d.id)).map(d => d.name.toLowerCase()));
  const add = STARTER_DISHES.filter(d => !keptNames.has(d.name.toLowerCase()));
  return { remove, add };
}
function renderListBox(box = $("#listBox")) {
  box.textContent = "";
  box.dataset.confirming = "";
  const { remove, add } = listUpdate();
  // Nur anbieten, solange noch alte Beispielgerichte da sind
  const current = !remove.length;
  if (box.id === "listNotice") box.hidden = current || !S.dishes.length;
  if (current) return;
  box.appendChild(el("p", "small", `Es gibt eine neue Gerichteliste mit ${STARTER_DISHES.length} Gerichten.`));
  const b = el("button", "btn", "Neue Gerichteliste übernehmen");
  b.onclick = () => {
    box.textContent = "";
    box.dataset.confirming = "1";
    box.appendChild(el("p", "small",
      `${remove.length} alte Beispielgerichte werden entfernt, ${add.length} Gerichte kommen dazu. Eure eigenen Gerichte und Wünsche bleiben.`));
    const row = el("div", "joinrow");
    const yes = el("button", "btn", "Übernehmen");
    const no = el("button", "btn ghost", "Abbrechen");
    yes.onclick = async () => {
      yes.disabled = no.disabled = true;
      try {
        const now = Date.now();
        await room.replace("dishes", remove.map(d => d.id),
          add.map((d, i) => ({ ...d, starter: true, createdAt: now + i, createdBy: S.uid })));
        remove.forEach(d => { delete S.myVotes[d.id]; });
        saveMe();
        renderListBox(box);
        $("#roomDlg").close();
        showTab("swipe");
        toast("Neue Gerichte sind da!");
      } catch (e) {
        console.error(e);
        yes.disabled = no.disabled = false;
        toast("Das hat nicht geklappt. Versuch es nochmal.");
      }
    };
    no.onclick = () => renderListBox(box);
    row.append(yes, no);
    box.appendChild(row);
  };
  box.appendChild(b);
}
$("#peopleBtn").onclick = openRoom;
$("#roomClose").onclick = () => $("#roomDlg").close();
$("#inviteShare").onclick = async () => {
  const url = inviteUrl();
  if (navigator.share) {
    try { await navigator.share({ title: "Was essen wir?", text: "Komm in meine Küche und swipe mit!", url }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(url); toast("Link kopiert"); }
  catch { $("#inviteLink").select(); toast("Link markiert, jetzt kopieren"); }
};
$("#nameSave").onclick = () => {
  const n = $("#nameEdit").value.trim();
  if (!n) return;
  S.name = n; ls.set("em.name", n); saveMe(); toast("Name geändert");
};
function renderResetBox() {
  const box = $("#resetBox");
  box.textContent = "";
  const b = el("button", "btn ghost", "Meine Swipes zurücksetzen");
  b.onclick = () => {
    box.textContent = "";
    box.appendChild(el("p", "small", "Alle deine Swipes löschen und neu anfangen?"));
    const row = el("div", "joinrow");
    const yes = el("button", "btn danger", "Ja, zurücksetzen");
    const no = el("button", "btn ghost", "Abbrechen");
    yes.onclick = () => {
      S.myVotes = {}; S.history = [];
      S.salt = String(Date.now()); ls.set("em.salt", S.salt);
      saveMe(); renderAll(); $("#roomDlg").close(); showTab("swipe"); toast("Neue Runde!");
    };
    no.onclick = renderResetBox;
    row.append(yes, no);
    box.appendChild(row);
  };
  box.appendChild(b);
}
$("#leaveBtn").onclick = () => {
  const b = $("#leaveBtn");
  if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Wirklich verlassen?"; return; }
  b.dataset.armed = ""; b.textContent = "Küche verlassen";
  unsubs.forEach(u => u()); unsubs = [];
  ls.del("em.code");
  S.code = null; S.myVotes = {}; S.history = []; S.members = []; S.dishes = []; S.wishes = []; S.shopping = [];
  S.round = 0; S.myRound = 0;
  $("#roomDlg").close();
  showSetup();
};

/* ---------- Tabs & Rendern ---------- */
function showTab(t) {
  document.querySelectorAll(".tabbar button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
  for (const v of ["swipe", "match", "dishes", "shop", "wish"]) $("#view-" + v).hidden = v !== t;
  ls.set("em.tab", t);
}
document.querySelectorAll(".tabbar button").forEach(b => b.onclick = () => showTab(b.dataset.tab));

function renderPeople() {
  const box = $("#avatars");
  box.textContent = "";
  const ms = S.members.length ? S.members : [{ id: S.uid, name: S.name }];
  ms.slice(0, 4).forEach(m => box.appendChild(avatar(m)));
}
function renderAll() {
  renderFilter();
  renderDeck();
  renderMatches();
  renderDishes();
  renderWishes();
  renderShopping();
  renderPeople();
  if (!$("#listNotice").dataset.confirming) renderListBox($("#listNotice"));
}

showTab(ls.get("em.tab") || "swipe");
boot();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
