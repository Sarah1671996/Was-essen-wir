import { createStore, hasFirebase, randomCode } from "./store.js";
import { STARTER_IDEAS, WHERE, COST, TIME, MOODS } from "./ideas.js";
import { STARTER_QUESTIONS } from "./questions.js";

const $ = s => document.querySelector(s);
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
function readJson(k, fallback) { try { return JSON.parse(ls.get(k)) ?? fallback; } catch { return fallback; } }

const NO_FILTER = { where: [], cost: [], time: [], mood: [] };
const S = {
  uid: null, code: null, name: "",
  members: [], ideasDb: [], swipes: [], answers: [], dates: [], questions: [], tweaks: [], planner: null,
  tab: "ideen",
  secret: false,          // Planer offen (nur im Speicher, nie gespeichert)
  hiddenAt: 0,
  filters: { ...NO_FILTER, ...readJson("dt.filters", {}) },
  skipped: new Set(),     // "später nochmal" im Kartenstapel, nur für diese Sitzung
  qSkipped: readJson("dt.qskip", []), // Fragen, die ich nach hinten geschoben habe
  editQ: null,            // Frage, deren Antwort ich gerade ändere
  allFilter: "alle",
  deckKey: ""
};
let store, couple, unsubs = [];

/* ---------- kleine Helfer ---------- */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function button(cls, text, onclick) { const b = el("button", cls, text); b.type = "button"; b.onclick = onclick; return b; }
function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; }
const str = (v, max) => typeof v === "string" ? v.slice(0, max) : "";

function toast(msg, action) {
  const t = $("#toast"), btn = $("#toastAction");
  $("#toastText").textContent = msg;
  btn.hidden = !action;
  if (action) { btn.textContent = action.label; btn.onclick = () => { t.classList.remove("show"); action.run(); }; }
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), action ? 5000 : 2600);
}
const fail = what => e => { console.error(e); toast(what + " hat nicht geklappt. Bist du online?"); };

const DAY = 864e5;
const startOfDay = d => new Date(new Date(d).toDateString()).getTime();
function fmtDate(ts, withTime = true) {
  const d = new Date(ts);
  const day = d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
  return withTime ? `${day}, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr` : day;
}
function relDay(ts) {
  const n = Math.round((startOfDay(ts) - startOfDay(Date.now())) / DAY);
  if (n === 0) return "heute";
  if (n === 1) return "morgen";
  if (n === -1) return "gestern";
  return n > 0 ? `in ${n} Tagen` : `vor ${-n} Tagen`;
}

/* ---------- wer ist wer ---------- */
const others = () => S.members.filter(m => m.id !== S.uid);
const owners = () => Array.isArray(S.planner?.owners) ? S.planner.owners : [];
const isOwner = () => owners().includes(S.uid);
// Für wen der Planer gedacht ist: alle, die ihn nicht selbst geöffnet haben
const partners = () => others().filter(m => !owners().includes(m.id));
const partnerName = () => partners().map(p => str(p.name, 24)).join(" & ") || "Partner";
// Sehe ich die Ideen so, wie der Planer sie für mich eingestellt hat?
const forMe = () => !!S.planner && !isOwner();
const tweakOf = id => S.tweaks.find(t => t.id === id);

/* ---------- Ideen ---------- */
function clean(d) {
  return {
    id: d.id, emoji: str(d.emoji, 8) || "💡", title: str(d.title, 80), text: str(d.text, 400),
    where: WHERE.some(w => w[0] === d.where) ? d.where : "zuhause",
    cost: [0, 1, 2, 3].includes(d.cost) ? d.cost : 1,
    time: TIME.some(t => t[0] === d.time) ? d.time : "abend",
    moods: Array.isArray(d.moods) ? d.moods.filter(m => MOODS.some(x => x[0] === m)) : [],
    removed: !!d.removed, at: d.at || 0
  };
}
function allIdeas() {
  const db = new Map(S.ideasDb.map(d => [d.id, d]));
  const list = STARTER_IDEAS.map(s => {
    const o = db.get(s.id);
    if (!o) return s;
    return o.removed ? null : { ...clean({ ...s, ...o }), starter: true };
  }).filter(Boolean);
  S.ideasDb.filter(d => !d.id.startsWith("s-") && !d.removed && d.title).forEach(d => list.push(clean(d)));
  return list;
}
const ideaById = id => allIdeas().find(i => i.id === id);
// So, wie ich die Idee sehen soll (für den Partner ggf. mit geändertem Text)
function shown(idea) {
  const t = forMe() && tweakOf(idea.id);
  if (!t) return idea;
  return { ...idea, title: str(t.title, 80) || idea.title, text: str(t.text, 400) || idea.text };
}
const hiddenForMe = idea => forMe() && !!tweakOf(idea.id)?.hide;
const boostedForMe = idea => forMe() && !!tweakOf(idea.id)?.boost;
const likesOf = uid => S.swipes.find(s => s.id === uid)?.likes || {};

function matchesFilter(i) {
  const f = S.filters;
  return (!f.where.length || f.where.includes(i.where)) && (!f.cost.length || f.cost.includes(i.cost))
    && (!f.time.length || f.time.includes(i.time)) && (!f.mood.length || i.moods.some(m => f.mood.includes(m)));
}
const filtersActive = () => Object.values(S.filters).some(v => v.length);

function deckList() {
  const mine = likesOf(S.uid);
  const seed = String(Math.floor(Date.now() / DAY));
  // Was der andere schon mag, kommt etwas früher, damit ihr schneller zusammenfindet
  const theyLike = i => others().some(o => likesOf(o.id)[i.id] === 1);
  return allIdeas()
    .filter(i => !hiddenForMe(i) && !(i.id in mine) && !S.skipped.has(i.id) && matchesFilter(i))
    .map(i => ({ i, k: (boostedForMe(i) ? 0 : 2) + (theyLike(i) ? 0 : 1), h: hash(i.id + S.uid + seed) }))
    .sort((a, b) => a.k - b.k || a.h - b.h)
    .map(x => x.i);
}

function tagsFor(i, max = 6) {
  const box = el("div", "tags");
  const w = WHERE.find(x => x[0] === i.where), c = COST.find(x => x[0] === i.cost), t = TIME.find(x => x[0] === i.time);
  const parts = [w && `${w[1]} ${w[2]}`, c && `${c[1]} ${c[2]}`, t && `${t[1]} ${t[2]}`,
    ...i.moods.map(m => MOODS.find(x => x[0] === m)).filter(Boolean).map(x => `${x[1]} ${x[2]}`)];
  parts.filter(Boolean).slice(0, max).forEach(p => box.append(el("span", "tag", p)));
  return box;
}

/* ---------- Einrichtung ---------- */
async function boot() {
  try {
    store = await createStore();
  } catch (e) {
    console.error(e);
    showSetup("Keine Verbindung zur Datenbank. Prüf das Internet und lade neu.");
    return;
  }
  S.uid = store.uid;
  S.name = ls.get("dt.name") || "";

  const invite = new URLSearchParams(location.search).get("join");
  const saved = ls.get("dt.code");
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
  S.name = n; ls.set("dt.name", n);
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
    if (!(await store.exists(code))) { $("#setupError").textContent = "Diesen Code gibt es nicht. Vielleicht ein Tippfehler?"; return; }
  } catch (e) { console.error(e); $("#setupError").textContent = "Keine Verbindung. Bist du online?"; return; }
  history.replaceState(null, "", location.pathname);
  enter(code);
}

function enter(code) {
  S.code = code; ls.set("dt.code", code);
  couple = store.open(code);
  if (!S.name) { showSetup(); return; }
  couple.set("members", S.uid, { name: S.name, seenAt: Date.now() }).catch(() => {});

  const onErr = e => { console.error(e); toast("Verbindung unterbrochen. Änderungen werden nachgeholt."); };
  const watch = (c, key) => couple.watch(c, l => { S[key] = l; renderAll(); }, onErr);
  unsubs.forEach(u => u());
  unsubs = [
    watch("members", "members"), watch("ideas", "ideasDb"), watch("swipes", "swipes"), watch("answers", "answers"),
    watch("dates", "dates"), watch("questions", "questions"), watch("tweaks", "tweaks"),
    couple.watch("planner", l => { S.planner = l.find(d => d.id === "config") || null; renderAll(); }, onErr)
  ];

  $("#setup").hidden = true;
  $("#app").hidden = false;
  $("#hello").textContent = `Hallo ${S.name}`;
  renderFilters();
  setTab(["ideen", "dates", "fragen"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "ideen", true);
}

/* ---------- Bereiche ---------- */
function setTab(tab, replace = false) {
  S.tab = tab;
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  ["ideen", "dates", "fragen"].forEach(t => { $("#tab-" + t).hidden = t !== tab; });
  history[replace ? "replaceState" : "pushState"]({ tab }, "", location.pathname + location.search + "#" + tab);
  $("#tab-" + tab).scrollTop = 0;
  renderAll();
}
document.querySelectorAll(".tabs button").forEach(b => { b.onclick = () => setTab(b.dataset.tab); });
window.addEventListener("popstate", e => { if (e.state?.tab) setTab(e.state.tab, true); });

function renderAll() {
  if (!couple) return;
  document.querySelectorAll(".pname").forEach(s => { s.textContent = partnerName(); });
  $("#secretBadge").hidden = !S.secret;
  $("#sSecret").hidden = !S.secret;
  renderDeck();
  renderPlannerIdeas();
  renderDates();
  renderQuestions();
  renderMembers();
  if ($("#allDlg").open) renderAllList();
}

/* ---------- Filter ---------- */
const GROUPS = [
  ["where", "#fWhere", WHERE], ["cost", "#fCost", COST], ["time", "#fTime", TIME], ["mood", "#fMood", MOODS]
];
function renderFilters() {
  GROUPS.forEach(([key, sel, opts]) => {
    const box = $(sel);
    box.replaceChildren(...opts.map(([v, icon, label]) => {
      const on = S.filters[key].includes(v);
      const b = button("chip" + (on ? " on" : ""), `${icon} ${label}`, () => {
        const list = S.filters[key];
        S.filters[key] = on ? list.filter(x => x !== v) : [...list, v];
        ls.set("dt.filters", JSON.stringify(S.filters));
        renderFilters();
        renderDeck();
      });
      b.setAttribute("aria-pressed", on);
      return b;
    }));
  });
  const labels = GROUPS.flatMap(([key, , opts]) => opts.filter(o => S.filters[key].includes(o[0])).map(o => o[2]));
  $("#filterSummary").textContent = labels.length ? labels.join(" · ") : "Alles ist möglich. Tippe hier zum Auswählen.";
  $("#filterReset").hidden = !labels.length;
}
$("#filterReset").onclick = () => {
  S.filters = { ...NO_FILTER };
  ls.set("dt.filters", JSON.stringify(S.filters));
  renderFilters();
  renderDeck();
};

/* ---------- Kartenstapel ---------- */
let top = null; // { card, idea }
function renderDeck(force = false) {
  const list = deckList();
  const key = list.slice(0, 2).map(i => i.id + (tweakOf(i.id)?.at || "")).join("|") + S.secret + list.length;
  if (!force && key === S.deckKey && $("#deck").childElementCount) return;
  S.deckKey = key;
  const deck = $("#deck");
  deck.replaceChildren();
  $("#deckBtns").hidden = !list.length;
  $("#deckHint").hidden = !list.length || Object.keys(likesOf(S.uid)).length > 3;
  top = null;
  if (!list.length) { deck.append(emptyDeck()); return; }
  if (list[1]) deck.append(cardFor(list[1], true));
  const card = cardFor(list[0]);
  deck.append(card);
  top = { card, idea: list[0] };
  enableDrag(card, list[0]);
}

function cardFor(idea, behind = false) {
  const i = shown(idea);
  const card = el("article", "card" + (behind ? " behind" : ""));
  card.append(el("span", "stamp yes", "LUST!"), el("span", "stamp no", "NÖ"));
  if (S.secret && tweakOf(idea.id)?.boost) card.append(el("span", "boostmark", "🔒 bei " + partnerName() + " zuerst"));
  card.append(el("div", "emoji", i.emoji), el("h3", null, i.title));
  if (i.text) card.append(el("p", null, i.text));
  card.append(tagsFor(i));
  return card;
}

function emptyDeck() {
  const box = el("div", "empty");
  const noes = Object.entries(likesOf(S.uid)).filter(([, v]) => v === -1).length;
  box.append(el("div", "big", "🌷"),
    el("strong", null, filtersActive() ? "Zu dieser Auswahl gibt's gerade nichts Neues." : "Du hast alle Ideen gesehen!"),
    el("p", "small", "Schau bei „Unsere Dates“, worauf ihr beide Lust habt, oder denk dir selbst etwas aus."));
  const btns = el("div", "stack");
  if (S.skipped.size) btns.append(button("btn ghost", "Übersprungene nochmal zeigen", () => { S.skipped.clear(); renderDeck(true); }));
  if (filtersActive()) btns.append(button("btn ghost", "Auswahl zurücksetzen", () => $("#filterReset").click()));
  if (noes) btns.append(button("btn ghost", `Abgelehnte nochmal ansehen (${noes})`, resetNoes));
  btns.append(button("btn", "+ Eigene Idee", () => openIdea(null)));
  box.append(btns);
  return box;
}

async function resetNoes() {
  const likes = Object.fromEntries(Object.entries(likesOf(S.uid)).filter(([, v]) => v === 1));
  await saveLikes(likes);
}
async function saveLikes(likes) {
  const doc = S.swipes.find(s => s.id === S.uid);
  if (doc) doc.likes = likes; else S.swipes.push({ id: S.uid, likes });
  renderAll();
  await couple.set("swipes", S.uid, { likes, at: Date.now() }).catch(fail("Speichern"));
}

async function swipe(idea, v) {
  const before = { ...likesOf(S.uid) };
  await saveLikes({ ...before, [idea.id]: v });
  const match = v === 1 && others().some(o => likesOf(o.id)[idea.id] === 1);
  if (match) showMatch(idea);
  else toast(v === 1 ? "Gemerkt ♥" : "Okay, weg damit", { label: "Rückgängig", run: () => saveLikes(before) });
}

function fly(card, v, idea) {
  card.classList.remove("dragging");
  card.style.transform = `translateX(${v * 520}px) rotate(${v * 24}deg)`;
  card.style.opacity = "0";
  setTimeout(() => swipe(idea, v), 180);
}

function enableDrag(card, idea) {
  let x0 = null, y0 = 0, dx = 0;
  const stamps = () => {
    card.querySelector(".stamp.yes").style.opacity = Math.max(0, Math.min(1, dx / 90));
    card.querySelector(".stamp.no").style.opacity = Math.max(0, Math.min(1, -dx / 90));
  };
  card.addEventListener("pointerdown", e => {
    x0 = e.clientX; y0 = e.clientY; dx = 0;
    card.setPointerCapture(e.pointerId);
    card.classList.add("dragging");
  });
  card.addEventListener("pointermove", e => {
    if (x0 == null) return;
    dx = e.clientX - x0;
    if (Math.abs(e.clientY - y0) > Math.abs(dx) * 1.5 && Math.abs(dx) < 20) return;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 22}deg)`;
    stamps();
  });
  const end = () => {
    if (x0 == null) return;
    x0 = null;
    card.classList.remove("dragging");
    if (Math.abs(dx) > 100) return fly(card, dx > 0 ? 1 : -1, idea);
    card.style.transform = "";
    const tap = Math.abs(dx) < 6;
    dx = 0; stamps();
    if (tap) openIdea(idea);
  };
  card.addEventListener("pointerup", end);
  card.addEventListener("pointercancel", end);
}

$("#btnYes").onclick = () => top && fly(top.card, 1, top.idea);
$("#btnNo").onclick = () => top && fly(top.card, -1, top.idea);
$("#btnSkip").onclick = () => { if (top) { S.skipped.add(top.idea.id); renderDeck(true); } };
$("#newIdeaBtn").onclick = () => openIdea(null);
$("#allBtn").onclick = () => { S.allFilter = "alle"; $("#allSearch").value = ""; renderAllList(); $("#allDlg").showModal(); };

function showMatch(idea) {
  $("#matchIdea").textContent = `${shown(idea).emoji} ${shown(idea).title}`;
  $("#matchPlan").onclick = () => { $("#matchDlg").close(); openDate(null, idea); };
  $("#matchLater").onclick = () => $("#matchDlg").close();
  $("#matchDlg").showModal();
}

/* ---------- Alle Ideen ---------- */
function allFilters() {
  const p = partnerName();
  const f = [["alle", "Alle"], ["mine", "♥ Meine"], ["eigene", "✍️ Eigene"]];
  if (S.secret) f.push(["pyes", `🔒 ♥ ${p}`], ["pno", `🔒 ✕ ${p}`], ["boost", "🔒 Bevorzugt"], ["hide", "🔒 Versteckt"]);
  return f;
}
function renderAllList() {
  if (!allFilters().some(f => f[0] === S.allFilter)) S.allFilter = "alle";
  $("#allFilter").replaceChildren(...allFilters().map(([k, label]) =>
    button("chip" + (k === S.allFilter ? " on" : ""), label, () => { S.allFilter = k; renderAllList(); })));
  const q = $("#allSearch").value.trim().toLowerCase();
  const mine = likesOf(S.uid);
  const pLikes = Object.assign({}, ...partners().map(p => likesOf(p.id)));
  const test = {
    alle: () => true, mine: i => mine[i.id] === 1, eigene: i => !i.starter,
    pyes: i => pLikes[i.id] === 1, pno: i => pLikes[i.id] === -1,
    boost: i => tweakOf(i.id)?.boost, hide: i => tweakOf(i.id)?.hide
  }[S.allFilter];
  const list = allIdeas().filter(i => !hiddenForMe(i)).map(shown)
    .filter(i => test(i) && (!q || (i.title + " " + i.text).toLowerCase().includes(q)));
  const box = $("#allList");
  if (!list.length) { box.replaceChildren(el("p", "small center", "Nichts gefunden.")); return; }
  box.replaceChildren(...list.map(i => {
    const row = button("item", null, () => openIdea(ideaById(i.id)));
    const t = el("span", "it");
    t.append(el("strong", null, i.title));
    const tags = tagsFor(i, 3);
    if (mine[i.id] === 1) tags.prepend(el("span", "tag", "♥ du"));
    if (S.secret) {
      const pv = pLikes[i.id], tw = tweakOf(i.id);
      tags.prepend(el("span", "tag secret", pv === 1 ? `♥ ${partnerName()}` : pv === -1 ? `✕ ${partnerName()}` : `? ${partnerName()}`));
      if (tw?.boost) tags.append(el("span", "tag secret", "bevorzugt"));
      if (tw?.hide) tags.append(el("span", "tag secret", "versteckt"));
      if (tw?.title || tw?.text) tags.append(el("span", "tag secret", "eigener Text"));
    }
    t.append(tags);
    row.append(el("span", "ie", i.emoji), t, el("span", "go", "›"));
    return row;
  }));
}
$("#allSearch").oninput = renderAllList;
$("#allClose").onclick = () => $("#allDlg").close();

/* ---------- Idee bearbeiten ---------- */
let editing = null; // { idea, where, cost, time, moods }
function chipPicker(sel, opts, get, set, multi = false) {
  const draw = () => $(sel).replaceChildren(...opts.map(([v, icon, label]) => {
    const on = multi ? get().includes(v) : get() === v;
    return button("chip" + (on ? " on" : ""), `${icon} ${label}`, () => {
      set(multi ? (on ? get().filter(x => x !== v) : [...get(), v]) : v);
      draw();
    });
  }));
  draw();
}
function openIdea(idea) {
  const base = idea ? (forMe() ? shown(idea) : idea) : { emoji: "💡", title: "", text: "", where: "zuhause", cost: 1, time: "abend", moods: [] };
  editing = { idea, where: base.where, cost: base.cost, time: base.time, moods: [...base.moods] };
  $("#ideaTitle").textContent = idea ? "Idee" : (S.secret ? `Idee für ${partnerName()}` : "Eigene Idee");
  $("#iEmoji").value = base.emoji;
  $("#iTitle").value = base.title;
  $("#iText").value = base.text;
  chipPicker("#iWhere", WHERE, () => editing.where, v => { editing.where = v; });
  chipPicker("#iCost", COST, () => editing.cost, v => { editing.cost = v; });
  chipPicker("#iTime", TIME, () => editing.time, v => { editing.time = v; });
  chipPicker("#iMoods", MOODS, () => editing.moods, v => { editing.moods = v; }, true);

  const tw = idea && tweakOf(idea.id);
  $("#iSecret").hidden = !S.secret;
  if (S.secret) {
    const pv = idea && partners().map(p => likesOf(p.id)[idea.id]).find(v => v != null);
    $("#iPartnerSwipe").textContent = !idea ? "" : pv === 1 ? `${partnerName()} hat Lust drauf ♥` :
      pv === -1 ? `${partnerName()} hat „eher nicht“ gewählt.` : `${partnerName()} hat die Idee noch nicht gesehen.`;
    $("#iBoost").checked = idea ? !!tw?.boost : true;
    $("#iHide").checked = !!tw?.hide;
    $("#iPTitle").value = str(tw?.title, 80);
    $("#iPText").value = str(tw?.text, 400);
  }
  $("#iDelete").hidden = !idea;
  $("#iPlan").hidden = !idea;
  $("#iError").textContent = "";
  $("#ideaDlg").showModal();
}
$("#iCancel").onclick = () => $("#ideaDlg").close();
$("#iPlan").onclick = () => { const i = editing.idea; $("#ideaDlg").close(); openDate(null, i); };
$("#iDelete").onclick = async () => {
  const i = editing.idea;
  if (!i || !confirm(`„${shown(i).title}“ löschen? Sie verschwindet für euch beide.`)) return;
  $("#ideaDlg").close();
  try {
    if (i.starter) await couple.set("ideas", i.id, { removed: true, at: Date.now() });
    else await couple.remove("ideas", i.id);
    if (tweakOf(i.id)) await couple.remove("tweaks", i.id);
  } catch (e) { fail("Löschen")(e); }
};
$("#ideaForm").onsubmit = async e => {
  e.preventDefault();
  const title = $("#iTitle").value.trim();
  if (!title) { $("#iError").textContent = "Bitte gib der Idee einen Titel."; return; }
  const idea = editing.idea;
  const id = idea?.id || "c-" + randomCode(12);
  const data = {
    emoji: [...($("#iEmoji").value.trim() || "💡")].slice(0, 2).join(""), title, text: $("#iText").value.trim(),
    where: editing.where, cost: editing.cost, time: editing.time, moods: editing.moods, by: S.uid, at: Date.now()
  };
  const before = idea && (forMe() ? shown(idea) : idea);
  const changed = !idea || ["emoji", "title", "text", "where", "cost", "time"].some(k => data[k] !== before[k])
    || data.moods.join() !== before.moods.join();
  $("#ideaDlg").close();
  try {
    if (changed) await couple.set("ideas", id, data);
    if (S.secret) {
      const tw = { boost: $("#iBoost").checked, hide: $("#iHide").checked, title: $("#iPTitle").value.trim(), text: $("#iPText").value.trim(), at: Date.now() };
      if (tw.boost || tw.hide || tw.title || tw.text) await couple.set("tweaks", id, tw);
      else if (tweakOf(id)) await couple.remove("tweaks", id);
    }
    toast(idea ? "Gespeichert" : "Neue Idee ist im Stapel");
  } catch (err) { fail("Speichern")(err); }
};

/* ---------- Planer: Ideen ---------- */
function renderPlannerIdeas() {
  const box = $("#plannerIdeas");
  box.hidden = !S.secret;
  if (!S.secret) return;
  const p = partnerName();
  box.replaceChildren(el("h2", "sectionlabel", "🔒 Für " + p));
  if (!partners().length) {
    box.append(el("p", "small", "Sobald dein Partner mit dem Einladungslink beigetreten ist, siehst du hier, worauf er Lust hat."));
  } else {
    const pl = Object.assign({}, ...partners().map(x => likesOf(x.id)));
    const ideas = allIdeas();
    const yes = ideas.filter(i => pl[i.id] === 1), no = ideas.filter(i => pl[i.id] === -1);
    box.append(el("p", "small", `♥ ${yes.length} Lust drauf · ✕ ${no.length} eher nicht · ${ideas.length - yes.length - no.length} noch nicht gesehen`));
    if (yes.length) {
      const chips = el("div", "likes");
      yes.slice(-12).reverse().forEach(i => chips.append(button("chip", `${i.emoji} ${i.title}`, () => openIdea(i))));
      box.append(chips);
    }
  }
  const row = el("div", "row2");
  row.append(button("btn small", "+ Idee für " + p, () => openIdea(null)),
    button("btn ghost small", "Alle mit Antworten", () => { S.allFilter = "pyes"; $("#allSearch").value = ""; renderAllList(); $("#allDlg").showModal(); }));
  box.append(row);
}

/* ---------- Dates ---------- */
const openDates = () => S.dates.filter(d => !d.done).sort((a, b) => (a.when || 9e15) - (b.when || 9e15));
const doneDates = () => S.dates.filter(d => d.done).sort((a, b) => (b.doneAt || b.when || 0) - (a.doneAt || a.when || 0));
function matchList() {
  const planned = new Set(S.dates.map(d => d.ideaId)); // geplant oder schon gemacht
  const mine = likesOf(S.uid);
  return allIdeas().filter(i => mine[i.id] === 1 && !hiddenForMe(i) && !planned.has(i.id)
    && others().some(o => likesOf(o.id)[i.id] === 1)).map(shown);
}

function renderDates() {
  const upcoming = openDates();
  const next = upcoming.find(d => d.when && d.when > Date.now() - 6 * 36e5);
  const nd = $("#nextDate");
  if (next) {
    const b = button("nextdate", null, () => openDate(next));
    b.append(el("span", "k", "Nächstes Date · " + relDay(next.when)), el("strong", null, `${str(next.emoji, 8)} ${str(next.title, 80)}`),
      el("span", "w", fmtDate(next.when, !next.allDay)));
    if (next.note) b.append(el("span", "w", str(next.note, 200)));
    nd.replaceChildren(b);
  } else {
    const b = button("nextdate", null, () => setTab("ideen"));
    b.append(el("span", "k", "Noch nichts geplant"), el("strong", null, "Zeit für ein Date? 💌"), el("span", "w", "Sucht euch eine Idee aus, worauf ihr beide Lust habt."));
    nd.replaceChildren(b);
  }
  const last = doneDates()[0];
  const lastAt = last && (last.when || last.doneAt);
  $("#sinceLast").textContent = !lastAt ? "" : `Euer letztes Date war ${relDay(Math.min(lastAt, Date.now()))}. 💛`;

  const m = matchList();
  $("#matches").replaceChildren(...(m.length ? m.map(i => {
    const row = el("div", "item");
    const t = el("span", "it");
    t.append(el("strong", null, i.title), el("span", "small", i.text));
    row.append(el("span", "ie", i.emoji), t, button("btn small", "📅 Planen", () => openDate(null, i)));
    return row;
  }) : [el("p", "small", others().length ? "Noch keine. Wenn ihr beide bei einer Idee ♥ wählt, steht sie hier." : "Lade zuerst deinen Partner ein (⚙ oben rechts).")]));
  const badge = $("#datesBadge");
  badge.hidden = !m.length || S.tab === "dates";
  badge.textContent = m.length;

  $("#planned").replaceChildren(...(upcoming.length ? upcoming.map(d => dateRow(d)) : [el("p", "small", "Noch kein Date eingetragen.")]));
  const done = doneDates();
  $("#memories").replaceChildren(...(done.length ? done.map(d => dateRow(d)) : [el("p", "small", "Hier sammeln sich eure gemeinsamen Dates.")]));
}

function dateRow(d) {
  const row = button("item", null, () => openDate(d));
  const t = el("span", "it");
  t.append(el("strong", null, str(d.title, 80)));
  if (d.when) t.append(el("span", "small", (d.done ? "" : relDay(d.when) + " · ") + fmtDate(d.when, !d.allDay && !d.done)));
  else if (!d.done) t.append(el("span", "small", "Noch ohne Termin"));
  if (d.done && d.rating) t.append(el("span", null, "💛".repeat(Math.min(5, d.rating))));
  if (d.done && d.memo) t.append(el("span", "small memo", "„" + str(d.memo, 600) + "“"));
  else if (d.note) t.append(el("span", "small", str(d.note, 200)));
  row.append(el("span", "ie", str(d.emoji, 8) || "💞"), t, el("span", "go", "›"));
  return row;
}

/* ---------- Date planen ---------- */
let dEdit = null; // { date, idea, done, rating }
const pad = n => String(n).padStart(2, "0");
function openDate(date, idea = null) {
  dEdit = { date, idea, done: !!date?.done, rating: date?.rating || 0 };
  $("#dateTitle").textContent = date ? (date.done ? "Erinnerung" : "Unser Date") : "Date planen";
  $("#dName").value = date ? str(date.title, 80) : idea ? shown(idea).title : "";
  if (date?.when) {
    const w = new Date(date.when);
    $("#dDay").value = `${w.getFullYear()}-${pad(w.getMonth() + 1)}-${pad(w.getDate())}`;
    $("#dTime").value = date.allDay ? "" : `${pad(w.getHours())}:${pad(w.getMinutes())}`;
  } else { $("#dDay").value = ""; $("#dTime").value = ""; }
  $("#dNote").value = str(date?.note, 200);
  $("#dMemo").value = str(date?.memo, 600);
  $("#dDelete").hidden = !date;
  $("#dDone").hidden = !date || dEdit.done;
  $("#dDoneBox").hidden = !dEdit.done;
  const by = date && S.members.find(m => m.id === date.by);
  $("#dMeta").textContent = by ? `Eingetragen von ${by.id === S.uid ? "dir" : str(by.name, 24)}` : "";
  $("#dError").textContent = "";
  drawHearts();
  $("#dateDlg").showModal();
}
function drawHearts() {
  $("#dRating").replaceChildren(...[1, 2, 3, 4, 5].map(n => {
    const b = button(n <= dEdit.rating ? "on" : "", "💛", () => { dEdit.rating = n; drawHearts(); });
    b.setAttribute("aria-label", `${n} von 5`);
    return b;
  }));
}
$("#dDone").onclick = () => {
  dEdit.done = true;
  $("#dDoneBox").hidden = false; $("#dDone").hidden = true;
  if (!$("#dDay").value) { const n = new Date(); $("#dDay").value = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`; }
  $("#dMemo").focus();
};
$("#dCancel").onclick = () => $("#dateDlg").close();
$("#dDelete").onclick = async () => {
  if (!confirm("Dieses Date löschen?")) return;
  $("#dateDlg").close();
  await couple.remove("dates", dEdit.date.id).catch(fail("Löschen"));
};
$("#dateForm").onsubmit = async e => {
  e.preventDefault();
  const title = $("#dName").value.trim();
  if (!title) { $("#dError").textContent = "Was habt ihr vor?"; return; }
  const day = $("#dDay").value, time = $("#dTime").value;
  const when = day ? new Date(`${day}T${time || "00:00"}`).getTime() : null;
  const d = dEdit.date;
  const data = {
    title, note: $("#dNote").value.trim(), when, allDay: !time,
    ideaId: d?.ideaId ?? dEdit.idea?.id ?? null,
    emoji: d?.emoji || (dEdit.idea ? shown(dEdit.idea).emoji : "💞"),
    done: dEdit.done, doneAt: dEdit.done ? (d?.doneAt || Date.now()) : null,
    rating: dEdit.done ? dEdit.rating : 0, memo: dEdit.done ? $("#dMemo").value.trim() : "",
    by: d?.by || S.uid, at: d?.at || Date.now()
  };
  $("#dateDlg").close();
  try {
    if (d) await couple.set("dates", d.id, data);
    else await couple.add("dates", data);
    toast(dEdit.done ? "Schön! Steht jetzt bei euren Erinnerungen 💛" : "Date eingetragen 💞");
  } catch (err) { fail("Speichern")(err); }
};
$("#newDateBtn").onclick = () => openDate(null);

/* ---------- Fragen ---------- */
const answersOf = uid => S.answers.find(a => a.id === uid)?.a || {};
// Eigene Fragen aus dem Planer kommen zuerst, dann die Fragen der App. Übersprungene nach hinten.
function questionPool(uid) {
  const custom = S.questions.filter(q => q.text && (q.forUid ? q.forUid === uid : q.by !== uid))
    .sort((a, b) => (a.at || 0) - (b.at || 0)).map(q => ({ id: q.id, text: str(q.text, 300), custom: true }));
  return [...custom, ...STARTER_QUESTIONS];
}
function currentQuestion(uid, skipped = []) {
  const a = answersOf(uid);
  const open = questionPool(uid).filter(q => !a[q.id]?.t);
  return open.find(q => !skipped.includes(q.id)) || open[0] || null;
}

function renderQuestions() {
  const mine = answersOf(S.uid);
  const q = S.editQ ? { id: S.editQ, text: mine[S.editQ]?.q || "" } : currentQuestion(S.uid, S.qSkipped);
  $("#qCard").hidden = !q;
  $("#qAllDone").hidden = !!q;
  if (q) {
    if ($("#qText").dataset.id !== q.id) {
      $("#qText").dataset.id = q.id;
      $("#qAnswer").value = S.editQ ? str(mine[q.id]?.t, 1500) : (ls.get("dt.qdraft." + q.id) || "");
    }
    $("#qText").textContent = q.text;
    $("#qSkip").textContent = S.editQ ? "Abbrechen" : "Andere Frage";
    $("#qSave").textContent = S.editQ ? "Ändern" : "Antworten";
  }
  const unansweredCustom = questionPool(S.uid).filter(x => x.custom && !mine[x.id]?.t).length;
  const badge = $("#fragenBadge");
  badge.hidden = !unansweredCustom || S.tab === "fragen";
  badge.textContent = unansweredCustom;

  $("#myAnswers").replaceChildren(...answerCards(S.uid, true));
  if (!$("#myAnswers").childElementCount) $("#myAnswers").append(el("p", "small", "Noch nichts beantwortet."));

  const panel = $("#plannerQuestions");
  panel.hidden = !S.secret;
  if (!S.secret) return;
  const pa = partners().flatMap(p => {
    const cards = answerCards(p.id, false);
    const cur = currentQuestion(p.id);
    const head = partners().length > 1 ? [el("p", "small", str(p.name, 24))] : [];
    const now = cur ? [el("p", "small", `Als Nächstes bekommt ${str(p.name, 24)}: „${cur.text}“`)] : [];
    return [...head, ...now, ...(cards.length ? cards : [el("p", "small", `${str(p.name, 24)} hat noch nichts beantwortet.`)])];
  });
  $("#partnerAnswers").replaceChildren(...(pa.length ? pa : [el("p", "small", "Dein Partner ist noch nicht beigetreten.")]));
  const own = S.questions.filter(x => x.by === S.uid).sort((a, b) => (b.at || 0) - (a.at || 0));
  $("#myQuestions").replaceChildren(...own.map(x => {
    const answered = partners().some(p => answersOf(p.id)[x.id]?.t);
    const card = el("div", "answer");
    card.append(el("p", "q", str(x.text, 300)));
    const w = el("p", "when");
    w.append(el("span", null, answered ? "✓ beantwortet" : "noch offen"),
      button("linkbtn", "Löschen", async () => { if (confirm("Diese Frage löschen?")) await couple.remove("questions", x.id).catch(fail("Löschen")); }));
    card.append(w);
    return card;
  }));
}

function answerCards(uid, editable) {
  return Object.entries(answersOf(uid)).filter(([, v]) => v && v.t)
    .sort((a, b) => (b[1].at || 0) - (a[1].at || 0))
    .map(([id, v]) => {
      const card = el("div", "answer");
      card.append(el("p", "q", str(v.q, 300)), el("p", "a", str(v.t, 1500)));
      const w = el("p", "when");
      w.append(el("span", null, fmtDate(v.at, false)));
      if (editable) w.append(button("linkbtn", "Ändern", () => {
        S.editQ = id; $("#qText").dataset.id = ""; renderQuestions();
        $("#tab-fragen").scrollTop = 0; $("#qAnswer").focus();
      }));
      card.append(w);
      return card;
    });
}

$("#qAnswer").oninput = () => { if (!S.editQ) ls.set("dt.qdraft." + $("#qText").dataset.id, $("#qAnswer").value); };
$("#qSkip").onclick = () => {
  if (S.editQ) { S.editQ = null; $("#qText").dataset.id = ""; renderQuestions(); return; }
  const id = $("#qText").dataset.id;
  S.qSkipped = [...S.qSkipped.filter(x => x !== id), id];
  // Wenn alles übersprungen ist, von vorn
  const open = questionPool(S.uid).filter(q => !answersOf(S.uid)[q.id]?.t);
  if (open.every(q => S.qSkipped.includes(q.id))) S.qSkipped = [id];
  ls.set("dt.qskip", JSON.stringify(S.qSkipped));
  renderQuestions();
};
$("#qSave").onclick = async () => {
  const id = $("#qText").dataset.id, t = $("#qAnswer").value.trim();
  if (!t) { $("#qAnswer").focus(); return; }
  const a = { ...answersOf(S.uid), [id]: { q: $("#qText").textContent, t, at: Date.now() } };
  const doc = S.answers.find(x => x.id === S.uid);
  if (doc) doc.a = a; else S.answers.push({ id: S.uid, a });
  ls.del("dt.qdraft." + id);
  S.qSkipped = S.qSkipped.filter(x => x !== id);
  ls.set("dt.qskip", JSON.stringify(S.qSkipped));
  const wasEdit = !!S.editQ;
  S.editQ = null;
  renderQuestions();
  try {
    await couple.set("answers", S.uid, { a, at: Date.now() });
    toast(wasEdit ? "Geändert" : "Danke für deine Antwort 💛");
  } catch (e) { fail("Speichern")(e); }
};
$("#newQSave").onclick = async () => {
  const text = $("#newQText").value.trim();
  if (!text) { $("#newQText").focus(); return; }
  const p = partners();
  try {
    await couple.add("questions", { text, by: S.uid, forUid: p.length === 1 ? p[0].id : null, at: Date.now() });
    $("#newQText").value = "";
    toast(`Frage gestellt. ${partnerName()} bekommt sie als Nächstes.`);
  } catch (e) { fail("Speichern")(e); }
};

/* ---------- Planer öffnen (Herz lange drücken) ---------- */
let pressTimer, growTimer;
const brand = $("#brand");
brand.addEventListener("pointerdown", () => {
  if (S.secret) return;
  growTimer = setTimeout(() => brand.classList.add("pressing"), 600);
  pressTimer = setTimeout(() => { brand.classList.remove("pressing"); openPin(S.planner?.hash ? "unlock" : "setup"); }, 1500);
});
["pointerup", "pointerleave", "pointercancel"].forEach(ev => brand.addEventListener(ev, () => {
  clearTimeout(pressTimer); clearTimeout(growTimer); brand.classList.remove("pressing");
}));
brand.addEventListener("contextmenu", e => e.preventDefault());

async function derive(pin, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 150000 }, key, 256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, "0")).join("");
}

let pinMode = "unlock";
function openPin(mode) {
  pinMode = mode;
  const two = mode !== "unlock";
  $("#pinTitle").textContent = mode === "setup" ? "🔒 Planer einrichten" : mode === "change" ? "🔒 Neuer Code" : "🔒";
  $("#pinInfo").textContent = mode === "setup"
    ? "Im Planer siehst du, worauf dein Partner Lust hat, liest seine Antworten, stellst eigene Fragen und passt Vorschläge für ihn an. Für ihn sieht die App ganz normal aus. Wähle einen Code mit mindestens 4 Ziffern."
    : mode === "change" ? "Wähle einen neuen Code mit mindestens 4 Ziffern." : "";
  $("#pinInput").value = ""; $("#pinInput2").value = "";
  $("#pinInput").placeholder = two ? "Neuer Code" : "Code";
  $("#pinInput2").hidden = !two;
  $("#pinError").textContent = "";
  $("#pinDlg").showModal();
  $("#pinInput").focus();
}
$("#pinCancel").onclick = () => $("#pinDlg").close();
$("#pinForm").onsubmit = async e => {
  e.preventDefault();
  const pin = $("#pinInput").value.trim();
  try {
    if (pinMode === "unlock") {
      const p = S.planner;
      if (!p?.hash || await derive(pin, p.salt) !== p.hash) { $("#pinError").textContent = "Falscher Code."; $("#pinInput").select(); return; }
      if (!isOwner()) await couple.set("planner", "config", { ...p, owners: [...owners(), S.uid], at: Date.now() });
    } else {
      if (!/^\d{4,12}$/.test(pin)) { $("#pinError").textContent = "Bitte 4 bis 12 Ziffern."; return; }
      if (pin !== $("#pinInput2").value.trim()) { $("#pinError").textContent = "Die beiden Codes sind nicht gleich."; return; }
      const salt = randomCode(16);
      const own = pinMode === "setup" ? [S.uid] : [...new Set([...owners(), S.uid])];
      await couple.set("planner", "config", { salt, hash: await derive(pin, salt), owners: own, at: Date.now() });
      if (pinMode === "change") { $("#pinDlg").close(); toast("Code geändert"); return; }
    }
  } catch (err) { fail("Öffnen")(err); return; }
  $("#pinDlg").close();
  S.secret = true;
  toast("Planer offen. Schließen: oben auf „🔒 Planer“ tippen.");
  renderAll();
};
function lockSecret() { S.secret = false; if ($("#allDlg").open) $("#allDlg").close(); if ($("#ideaDlg").open) $("#ideaDlg").close(); renderAll(); }
$("#secretBadge").onclick = lockSecret;
$("#pinChange").onclick = () => { $("#settingsDlg").close(); openPin("change"); };
// Liegt die App länger im Hintergrund, schließt sich der Planer
document.addEventListener("visibilitychange", () => {
  if (document.hidden) S.hiddenAt = Date.now();
  else if (S.secret && Date.now() - S.hiddenAt > 2 * 60e3) lockSecret();
});

/* ---------- Einstellungen ---------- */
function renderMembers() {
  $("#members").replaceChildren(...S.members.map(m => el("span", "member", (m.id === S.uid ? "👤 " : "💞 ") + str(m.name, 24))));
}
const inviteLink = () => location.origin + location.pathname + "?join=" + S.code;
$("#settingsBtn").onclick = () => {
  $("#myName").value = S.name;
  $("#myCode").textContent = S.code;
  $("#modeNote").textContent = store.mode === "local" ? "Demo-Modus: Alles bleibt nur auf diesem Gerät." : "";
  $("#settingsDlg").showModal();
};
$("#settingsClose").onclick = () => $("#settingsDlg").close();
$("#saveName").onclick = async () => {
  const n = $("#myName").value.trim();
  if (!n) return;
  S.name = n; ls.set("dt.name", n);
  $("#hello").textContent = `Hallo ${n}`;
  await couple.set("members", S.uid, { name: n, seenAt: Date.now() }).catch(fail("Speichern"));
  toast("Name geändert");
};
$("#shareBtn").onclick = async () => {
  const text = `${S.name} lädt dich zu „Wir zwei“ ein, unserer Date-App 💞 Code: ${S.code}`;
  if (navigator.share) {
    try { await navigator.share({ title: "Wir zwei", text, url: inviteLink() }); } catch {}
  } else $("#copyBtn").click();
};
$("#copyBtn").onclick = async () => {
  try { await navigator.clipboard.writeText(inviteLink()); toast("Link kopiert"); }
  catch { toast("Kopieren ging nicht. Code: " + S.code); }
};
$("#leaveBtn").onclick = () => {
  if (!confirm("Auf diesem Gerät abmelden? Mit dem Code kommst du jederzeit wieder rein.")) return;
  unsubs.forEach(u => u());
  ls.del("dt.code");
  location.replace(location.pathname);
};

boot();

if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
