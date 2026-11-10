// Was gucken wir? – Filme und Serien merken, bewerten und passende Empfehlungen bekommen.
import { CATALOG, CATALOG_BY_ID, GENRES, makeId, tagLabel } from "./catalog.js";
import * as store from "./store.js";
import { buildProfile, scoreItem, similarTo, topFeatures } from "./recs.js";
import { searchSeries, searchMovies, details, cachedImg, whereToWatch, trailerLink } from "./online.js";

const VERSION = "1";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, " ").trim();

let state = store.loadLocal();
// Titel aus Suche und KI, die (noch) nicht in der Liste stehen
const known = new Map();
// „Kenne ich nicht“ beim Schnell-Bewerten: nur auf diesem Gerät, beeinflusst keine Empfehlungen
const qSkip = new Set((() => { try { return JSON.parse(store.lsGet("fs.qskip")) || []; } catch { return []; } })());

const STATUS = {
  want: { label: "Will ich sehen", icon: "🔖" },
  watching: { label: "Schaue ich gerade", icon: "▶️" },
  seen: { label: "Gesehen", icon: "✓" },
  dropped: { label: "Abgebrochen", icon: "⏹" }
};
const RATING = { 2: { label: "Liebe ich", icon: "❤️" }, 1: { label: "Gut", icon: "👍" }, "-1": { label: "Nicht meins", icon: "👎" } };
const typeName = t => t === "s" ? "Serie" : "Film";

/* ---------- Daten ---------- */
const entries = () => Object.values(state.items).filter(e => !e.del);
const entryOf = id => { const e = state.items[id]; return e && !e.del ? e : null; };
function getItem(id) {
  const e = entryOf(id), c = CATALOG_BY_ID.get(id), k = known.get(id);
  if (!e && !c && !k) return null;
  return { ...(k || {}), ...(c || {}), ...(e || {}) };
}
const BASE_KEYS = ["id", "type", "title", "year", "genres", "tags", "orig", "img", "src", "ext"];
function setEntry(item, patch, silent) {
  const old = entryOf(item.id) || {};
  const base = {};
  for (const k of BASE_KEYS) if (item[k] !== undefined && item[k] !== "") base[k] = item[k];
  const e = { ...base, ...old, ...patch, t: Date.now() };
  for (const k of Object.keys(e)) if (e[k] === undefined || e[k] === null || e[k] === "" || e[k] === 0 || e[k] === false) if (!BASE_KEYS.includes(k)) delete e[k];
  if (!e.status && !e.rating && !e.skip && !e.note) state.items[item.id] = { id: item.id, del: true, t: Date.now() };
  else { delete e.del; state.items[item.id] = e; }
  store.save(state);
  if (!silent) refresh();
}
function removeEntry(id) {
  state.items[id] = { id, del: true, t: Date.now() };
  store.save(state);
  refresh();
}
// Alle bekannten Titel: Katalog + eigene Liste + gerade Gefundenes
function pool() {
  const m = new Map(CATALOG.map(c => [c.id, c]));
  for (const [id, k] of known) if (!m.has(id)) m.set(id, k);
  for (const e of entries()) m.set(e.id, { ...(m.get(e.id) || {}), ...e });
  return [...m.values()].filter(x => x.title && x.genres);
}
const isHandled = e => e && (e.status || e.rating || e.skip);

// Wie bekannt ein Titel vermutlich ist (für Reihenfolge ohne Geschmacksprofil und beim Schnell-Bewerten)
const rnd = new Map();
function prio(x) {
  if (!rnd.has(x.id)) rnd.set(x.id, Math.random());
  return (x.tags?.includes("kult") ? 2.5 : 0) + (x.year >= 2015 ? 1.5 : x.year >= 2005 ? 0.8 : 0) + rnd.get(x.id) * 2.2;
}

/* ---------- Poster ---------- */
function posterHtml(item, size = "") {
  const img = item.img || cachedImg(item.id);
  return `<div class="poster ${size}" data-pid="${esc(item.id)}">${img ? `<img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="t">${esc(item.title)}</span>`}</div>`;
}
const io = "IntersectionObserver" in window ? new IntersectionObserver(list => {
  for (const en of list) if (en.isIntersecting) { io.unobserve(en.target); loadPoster(en.target); }
}, { rootMargin: "300px" }) : null;
function loadPoster(el) {
  const item = getItem(el.dataset.pid);
  if (!item || el.querySelector("img")) return;
  details(item).then(v => {
    if (v?.img && !el.querySelector("img")) {
      const im = new Image();
      im.alt = ""; im.referrerPolicy = "no-referrer"; im.src = v.img;
      im.onload = () => { el.querySelector(".t")?.remove(); el.appendChild(im); };
    }
  }).catch(() => {});
}
function watchPosters(root) {
  root.querySelectorAll(".poster[data-pid]").forEach(el => {
    if (el.querySelector("img")) return;
    io ? io.observe(el) : loadPoster(el);
  });
}

/* ---------- Eintrag in Listen ---------- */
function lineOf(item) {
  const bits = [typeName(item.type), item.year, (item.genres || []).slice(0, 3).join(", ")].filter(Boolean);
  return bits.join(" · ");
}
function itemHtml(item, opts = {}) {
  const e = entryOf(item.id);
  const st = e?.status, r = e?.rating;
  let badges = "";
  if (r) badges += `<span class="badge r${r}">${RATING[r].icon} ${RATING[r].label}</span> `;
  if (st && opts.showStatus !== false) badges += `<span class="tag">${STATUS[st].icon} ${STATUS[st].label}${st === "watching" && e.season ? ` · Staffel ${e.season}` : ""}</span>`;
  if (e?.skip) badges += `<span class="tag">Interessiert mich nicht</span>`;
  let acts = "";
  if (opts.acts === "rec") {
    acts = `<div class="acts">
      <button class="mini" data-act="want">🔖 Merken</button>
      <button class="mini" data-act="seen">✓ Kenne ich</button>
      <button class="mini" data-act="skip" aria-label="Interessiert mich nicht">✕ Nicht für mich</button></div>`;
  } else if (opts.acts === "list") {
    if (st === "want") acts = `<div class="acts"><button class="mini" data-act="watching">▶️ Angefangen</button><button class="mini" data-act="seen">✓ Gesehen</button></div>`;
    else if (st === "watching") acts = `<div class="acts">${item.type === "s" ? `<button class="mini" data-act="season">Staffel +1</button>` : ""}<button class="mini" data-act="seen">✓ Fertig</button></div>`;
    else if ((st === "seen" || st === "dropped") && !r) acts = `<div class="acts"><button class="mini" data-act="r2">❤️</button><button class="mini" data-act="r1">👍</button><button class="mini" data-act="r-1">👎</button></div>`;
  }
  return `<div class="item" data-id="${esc(item.id)}" role="button" tabindex="0">
    ${posterHtml(item)}
    <div class="meta">
      <h3>${esc(item.title)}</h3>
      <div class="line">${esc(lineOf(item))}${item.ext?.net ? " · " + esc(item.ext.net) : ""}</div>
      ${badges ? `<div class="why">${badges}</div>` : ""}
      ${opts.why ? `<div class="why">${esc(opts.why)}</div>` : ""}
      ${opts.against ? `<div class="why bad">${esc(opts.against)}</div>` : ""}
      ${acts}
    </div>
  </div>`;
}
function renderItems(el, items, opts = {}) {
  el.innerHTML = items.map(x => itemHtml(x, typeof opts === "function" ? opts(x) : opts)).join("");
  watchPosters(el);
}
// Klicks in Listen: Karte öffnet Details, kleine Knöpfe ändern direkt
function onListClick(ev) {
  const card = ev.target.closest(".item");
  if (!card) return;
  const item = getItem(card.dataset.id);
  if (!item) return;
  const act = ev.target.closest("[data-act]")?.dataset.act;
  if (!act) return openDetail(item.id);
  ev.stopPropagation();
  const e = entryOf(item.id) || {};
  if (act === "want") { setEntry(item, { status: "want", skip: false }); toast(`„${item.title}“ gemerkt`, () => setEntry(item, e.status ? e : { status: undefined })); }
  else if (act === "seen") { setEntry(item, { status: "seen", skip: false }, true); openDetail(item.id, true); refresh(); }
  else if (act === "watching") setEntry(item, { status: "watching", season: item.type === "s" ? (e.season || 1) : undefined });
  else if (act === "season") setEntry(item, { season: (Number(e.season) || 1) + 1 });
  else if (act === "skip") { setEntry(item, { skip: true }); toast("Wird nicht mehr vorgeschlagen", () => setEntry(item, { skip: false })); }
  else if (act.startsWith("r")) setEntry(item, { rating: Number(act.slice(1)) });
}
document.addEventListener("keydown", ev => {
  if (ev.key === "Enter" && ev.target.classList?.contains("item")) ev.target.click();
});

/* ---------- Ansichten ---------- */
let view = "recs";
const TITLES = { recs: "Für dich", search: "Suchen", list: "Meine Liste", more: "Mehr" };
function show(v) {
  view = v;
  for (const s of document.querySelectorAll(".view")) s.hidden = s.id !== "view-" + v;
  document.querySelectorAll("#tabs button").forEach(b => b.dataset.view === v ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  $("#viewTitle").textContent = TITLES[v];
  try { store.lsSet("fs.view", v); } catch {}
  refresh();
  window.scrollTo(0, 0);
}
$("#tabs").addEventListener("click", ev => { const b = ev.target.closest("button[data-view]"); if (b) show(b.dataset.view); });
function seg(el, onChange) {
  el.addEventListener("click", ev => {
    const b = ev.target.closest("button[data-v]");
    if (!b) return;
    el.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    onChange(b.dataset.v);
  });
}
function refresh() {
  if (view === "recs") renderRecs();
  else if (view === "search") renderSearch();
  else if (view === "list") renderList();
  else renderMore();
}

/* ---------- Für dich ---------- */
let recType = "", recGenre = "", recShown = 20;
seg($("#recType"), v => { recType = v; recShown = 20; renderRecs(); });
function genreChips(el, current, onPick) {
  el.innerHTML = [`<button class="chip" data-g="" aria-pressed="${!current}">Alle Genres</button>`, ...GENRES.map(g => `<button class="chip" data-g="${g}" aria-pressed="${current === g}">${g}</button>`)].join("");
  el.onclick = ev => { const b = ev.target.closest("[data-g]"); if (b) onPick(b.dataset.g); };
}
const featLabel = k => k.startsWith("g:") ? k.slice(2) : tagLabel(k.slice(2));

function renderRecs() {
  genreChips($("#recGenres"), recGenre, g => { recGenre = g; recShown = 20; renderRecs(); });
  const es = entries();
  const profile = buildProfile(es);
  $("#rateIntro").hidden = profile.strength >= 5;
  const tf = topFeatures(profile);
  $("#taste").innerHTML = profile.strength >= 3 && tf.likes.length
    ? `Du magst: <strong>${tf.likes.map(featLabel).map(esc).join(" · ")}</strong>${tf.dislikes.length ? `<br>Eher nicht: ${tf.dislikes.map(featLabel).map(esc).join(" · ")}` : ""}`
    : "";
  const cands = pool().filter(x => !isHandled(entryOf(x.id)) && (!recType || x.type === recType) && (!recGenre || x.genres.includes(recGenre)));
  let scored;
  if (profile.strength >= 2) {
    scored = cands.map(x => ({ x, ...scoreItem(x, profile) }));
    // Ein bisschen Bekanntheit mit einrechnen, damit oben nicht nur Geheimtipps stehen
    scored.forEach(s => { s.total = s.score + prio(s.x) * 0.06; });
    scored.sort((a, b) => b.total - a.total);
    $("#recHead").textContent = "Passt zu dir";
  } else {
    scored = cands.map(x => ({ x, because: [], against: [], total: prio(x) })).sort((a, b) => b.total - a.total);
    $("#recHead").textContent = "Beliebt und bekannt";
  }
  const top = scored.slice(0, recShown);
  const el = $("#recList");
  if (!top.length) el.innerHTML = `<p class="empty"><span class="big">🎬</span>Hier gibt es gerade nichts mehr. Probier ein anderes Genre, die Suche oder die KI.</p>`;
  else renderItems(el, top.map(s => s.x), x => {
    const s = top.find(t => t.x === x);
    return {
      acts: "rec",
      why: s.because.length ? `Weil dir ${s.because.map(t => `„${t}“`).join(" und ")} gefallen ${s.because.length > 1 ? "haben" : "hat"}` : "",
      against: s.against.length ? `Ähnlich wie „${s.against[0]}“, das dir nicht gefallen hat` : ""
    };
  });
  $("#recMore").hidden = scored.length <= recShown;
  renderAi();
}
$("#recMore").onclick = () => { recShown += 20; renderRecs(); };
$("#recList").addEventListener("click", onListClick);

/* ---------- KI ---------- */
let aiRecs = [], aiBusy = false;
function tasteForAi() {
  const t = { love: [], like: [], dislike: [], seen: [], want: [], skip: [] };
  const name = e => `${e.title}${e.year ? ` (${e.year})` : ""}`;
  for (const e of entries().sort((a, b) => (b.t || 0) - (a.t || 0))) {
    if (e.rating === 2) t.love.push(name(e));
    else if (e.rating === 1) t.like.push(name(e));
    else if (e.rating === -1 || e.status === "dropped") t.dislike.push(name(e));
    else if (e.status === "seen" || e.status === "watching") t.seen.push(name(e));
    else if (e.status === "want") t.want.push(name(e));
    else if (e.skip) t.skip.push(name(e));
  }
  return t;
}
async function askAi() {
  if (aiBusy) return;
  const note = $("#aiNote");
  if (!store.canAi) { note.hidden = false; note.textContent = "Die KI geht nur in der installierten App (nicht im Demo-Modus)."; return; }
  aiBusy = true;
  $("#aiGo").disabled = true;
  note.hidden = false;
  note.innerHTML = `<span class="spinner"></span> Die KI überlegt …`;
  try {
    const recs = await store.aiRecommend(tasteForAi(), $("#aiWish").value.trim(), recType);
    const mine = new Set(entries().filter(isHandled).flatMap(e => [norm(e.title), norm(e.orig)]).filter(Boolean));
    aiRecs = [];
    for (const r of recs) {
      const type = r.type === "s" ? "s" : "f";
      const year = Number(r.year) || null;
      const id = makeId(type, r.title, year);
      if (mine.has(norm(r.title)) || (r.orig && mine.has(norm(r.orig))) || isHandled(entryOf(id))) continue;
      // Im Katalog? Dann dessen Angaben nehmen (auch wenn die KI das Jahr leicht anders schreibt)
      const cat = CATALOG_BY_ID.get(id) || CATALOG.find(c => c.type === type && (norm(c.title) === norm(r.title) || (r.orig && norm(c.orig || c.title) === norm(r.orig))));
      const item = cat ? { ...cat } : {
        id, type, title: r.title, year, orig: r.orig && r.orig !== r.title ? r.orig : "",
        genres: (r.genres || []).filter(g => GENRES.includes(g)), tags: (r.tags || []).map(t => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 6), src: "ki"
      };
      if (!item.genres.length) item.genres = ["Drama"];
      if (!cat) known.set(id, item);
      aiRecs.push({ item, why: r.why || "" });
    }
    note.textContent = aiRecs.length ? "Vorschläge der KI – zum Merken antippen. Die KI kann sich auch mal irren." : "Die KI hatte gerade keine neuen Vorschläge. Nochmal versuchen?";
  } catch (e) {
    console.error(e);
    note.textContent = "Die KI hat gerade nicht geantwortet (" + (e.message || "Fehler") + "). Später nochmal versuchen.";
  }
  aiBusy = false;
  $("#aiGo").disabled = false;
  renderAi();
}
function renderAi() {
  const el = $("#aiResults");
  const list = aiRecs.filter(r => !isHandled(entryOf(r.item.id)));
  if (!list.length) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="list">${list.map(r => itemHtml(getItem(r.item.id) || r.item, { acts: "rec", why: r.why })).join("")}</div>
    <button class="btn ghost wide" id="aiClear">KI-Vorschläge ausblenden</button>`;
  watchPosters(el);
  $("#aiClear").onclick = () => { aiRecs = []; $("#aiNote").hidden = true; renderAi(); };
}
$("#aiGo").onclick = askAi;
$("#aiWish").addEventListener("keydown", ev => { if (ev.key === "Enter") askAi(); });
$("#aiResults").addEventListener("click", onListClick);

/* ---------- Suchen ---------- */
let searchType = "", browseGenre = "", searchTimer = null, searchSeq = 0, online = [];
seg($("#searchType"), v => { searchType = v; renderSearch(); runOnline(); });
$("#q").addEventListener("input", () => { renderSearch(); clearTimeout(searchTimer); searchTimer = setTimeout(runOnline, 450); });
$("#q").addEventListener("keydown", ev => { if (ev.key === "Enter") { clearTimeout(searchTimer); runOnline(); ev.target.blur(); } });
function localMatches(q) {
  const n = norm(q);
  if (!n) return [];
  const words = n.split(" ");
  return pool()
    .filter(x => (!searchType || x.type === searchType))
    .map(x => {
      const t = norm(x.title), o = norm(x.orig);
      const sc = t === n || o === n ? 3 : t.startsWith(n) || o.startsWith(n) ? 2 : words.every(w => t.includes(w) || o.includes(w)) ? 1 : 0;
      return { x, sc };
    })
    .filter(r => r.sc)
    .sort((a, b) => b.sc - a.sc || (b.x.year || 0) - (a.x.year || 0))
    .slice(0, 30).map(r => r.x);
}
function renderSearch() {
  const q = $("#q").value.trim();
  $("#browse").hidden = !!q;
  $("#searchNote").hidden = !!q;
  const local = localMatches(q);
  renderItems($("#searchList"), local);
  const ids = new Set(local.map(x => x.id));
  const on = online.filter(x => !ids.has(x.id) && (!searchType || x.type === searchType));
  $("#onlineHead").hidden = !q || !on.length;
  renderItems($("#onlineList"), q ? on : []);
  if (!q) {
    genreChips($("#browseGenres"), browseGenre, g => { browseGenre = g; renderSearch(); });
    const list = CATALOG.filter(x => (!searchType || x.type === searchType) && (!browseGenre || x.genres.includes(browseGenre)))
      .sort((a, b) => prio(b) - prio(a)).slice(0, browseGenre ? 80 : 30);
    renderItems($("#browseList"), list);
  }
}
async function runOnline() {
  const q = $("#q").value.trim();
  const seq = ++searchSeq;
  if (q.length < 2) { online = []; renderSearch(); return; }
  $("#onlineHead").hidden = false;
  $("#onlineHead").innerHTML = `Im Internet suchen … <span class="spinner"></span>`;
  const jobs = [];
  if (searchType !== "f") jobs.push(searchSeries(q).catch(e => { console.warn(e); return null; }));
  if (searchType !== "s") jobs.push(searchMovies(q).catch(e => { console.warn(e); return null; }));
  const res = await Promise.all(jobs);
  if (seq !== searchSeq) return;
  online = res.flat().filter(Boolean);
  for (const x of online) if (!CATALOG_BY_ID.has(x.id) && !known.has(x.id)) known.set(x.id, x);
  $("#onlineHead").textContent = res.every(r => r === null) ? "Keine Verbindung zur Online-Suche" : "Im Internet gefunden";
  renderSearch();
  if (res.every(r => r === null)) $("#onlineHead").hidden = false;
}
for (const id of ["#searchList", "#onlineList", "#browseList"]) $(id).addEventListener("click", onListClick);

/* ---------- Meine Liste ---------- */
let listTab = "want", listType = "";
seg($("#listTabs"), v => { listTab = v; renderList(); });
seg($("#listType"), v => { listType = v; renderList(); });
$("#listSort").onchange = renderList;
function renderList() {
  const counts = { want: 0, watching: 0, seen: 0, dropped: 0 };
  for (const e of entries()) if (counts[e.status] !== undefined && (!listType || e.type === listType)) counts[e.status]++;
  $("#listTabs").querySelectorAll("button").forEach(b => {
    const base = { want: "Will ich sehen", watching: "Gerade", seen: "Gesehen", dropped: "Abgebrochen" }[b.dataset.v];
    b.textContent = counts[b.dataset.v] ? `${base} (${counts[b.dataset.v]})` : base;
  });
  const sort = $("#listSort").value;
  const list = entries().filter(e => e.status === listTab && (!listType || e.type === listType)).map(e => getItem(e.id));
  const by = {
    new: (a, b) => (b.t || 0) - (a.t || 0),
    title: (a, b) => a.title.localeCompare(b.title, "de"),
    year: (a, b) => (b.year || 0) - (a.year || 0),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0) || (b.t || 0) - (a.t || 0)
  }[sort];
  list.sort(by);
  const el = $("#myList");
  if (!list.length) {
    const hint = { want: "Noch nichts gemerkt. Unter „Für dich“ oder „Suchen“ auf 🔖 Merken tippen.", watching: "Gerade schaust du nichts. Bei einem gemerkten Titel auf ▶️ Angefangen tippen.",
      seen: "Noch nichts als gesehen markiert. Mit „Schnell bewerten“ geht das ganz fix.", dropped: "Nichts abgebrochen – sehr gut!" }[listTab];
    el.innerHTML = `<p class="empty"><span class="big">🍿</span>${hint}</p>${listTab === "seen" ? `<button class="btn wide" data-action="quick">Schnell bewerten</button>` : ""}`;
  } else renderItems(el, list, { acts: "list", showStatus: listTab === "watching" });
  $("#pickRandom").hidden = !(listTab === "want" && list.length > 1);
}
$("#myList").addEventListener("click", onListClick);
$("#pickRandom").onclick = () => {
  const list = entries().filter(e => e.status === "want" && (!listType || e.type === listType));
  if (list.length) openDetail(list[Math.floor(Math.random() * list.length)].id);
};

/* ---------- Detailansicht ---------- */
const detail = $("#detail");
let detailId = null;
function openDetail(id, focusRating) {
  detailId = id;
  renderDetail(focusRating);
  if (!detail.open) detail.showModal();
  detail.querySelector(".sheet-inner").scrollTop = 0;
}
function renderDetail(focusRating) {
  const item = getItem(detailId);
  if (!item) { detail.close(); return; }
  const e = entryOf(item.id) || {};
  const tags = (item.tags || []).map(t => `<span class="tag">${esc(tagLabel(t))}</span>`).join("");
  const sim = similarTo(item, pool(), 14);
  const body = $("#detailBody");
  body.innerHTML = `
    <button class="close" data-close aria-label="Schließen">✕</button>
    <div class="d-head">
      ${posterHtml(item)}
      <div>
        <h2 id="dTitle">${esc(item.title)}</h2>
        ${item.orig ? `<div class="line">${esc(item.orig)}</div>` : ""}
        <div class="line">${esc([typeName(item.type), item.year].filter(Boolean).join(" · "))}<span id="dExtra">${item.ext?.net ? " · " + esc(item.ext.net) : ""}${item.ext?.minutes ? ` · ${item.ext.minutes} Min.` : ""}</span></div>
        <div class="line">${esc((item.genres || []).join(", "))}</div>
        <div>${tags}</div>
      </div>
    </div>
    <div class="d-text" id="dText"><span class="spinner"></span></div>
    <div class="d-sec">
      <h3>Meine Liste</h3>
      <div class="statusbtns">
        ${Object.entries(STATUS).map(([k, s]) => `<button data-status="${k}" aria-pressed="${e.status === k}">${s.icon} ${s.label}</button>`).join("")}
      </div>
      ${item.type === "s" && e.status === "watching" ? `<label class="season">Bei Staffel <input type="number" min="1" max="99" id="dSeason" value="${esc(e.season || 1)}" inputmode="numeric"></label>` : ""}
    </div>
    <div class="d-sec" id="dRateSec">
      <h3>Wie fandest du es?</h3>
      <div class="ratebtns">
        ${[2, 1, -1].map(r => `<button data-r="${r}" aria-pressed="${e.rating === r}"><span>${RATING[r].icon}</span>${RATING[r].label}</button>`).join("")}
      </div>
    </div>
    <div class="d-sec">
      <h3>Notiz</h3>
      <textarea id="dNote" maxlength="500" placeholder="z. B. von Anna empfohlen, läuft auf Netflix …">${esc(e.note || "")}</textarea>
    </div>
    <div class="d-sec links">
      <a class="btn ghost" href="${esc(whereToWatch(item))}" target="_blank" rel="noopener">📺 Wo läuft das?</a>
      <a class="btn ghost" href="${esc(trailerLink(item))}" target="_blank" rel="noopener">▶ Trailer</a>
      <a class="btn ghost" id="dWiki" hidden target="_blank" rel="noopener">Wikipedia</a>
    </div>
    ${sim.length ? `<div class="d-sec"><h3>Ähnlich</h3><div class="hscroll">${sim.map(x => {
      const se = entryOf(x.id);
      const mark = se?.rating ? RATING[se.rating].icon + " " : se?.status ? STATUS[se.status].icon + " " : "";
      return `<button data-sim="${esc(x.id)}">${posterHtml(x)}<div class="cap">${mark}${esc(x.title)}</div></button>`;
    }).join("")}</div></div>` : ""}
    <div class="d-sec">
      <button class="mini" data-skip>${e.skip ? "↺ Wieder vorschlagen" : "✕ Interessiert mich nicht"}</button>
      ${isHandled(e) || e.note ? `<button class="danger" data-remove>Aus meiner Liste entfernen</button>` : ""}
    </div>`;
  watchPosters(body);
  if (focusRating) setTimeout(() => $("#dRateSec")?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  const id = item.id;
  details(item, true).then(v => {
    if (detailId !== id || !detail.open) return;
    const t = $("#dText");
    t.innerHTML = v?.text ? `${esc(v.text)}${v.textLang === "en" ? ` <span class="src">(englisch)</span>` : ""}` : `<span class="muted small">Keine Beschreibung gefunden.</span>`;
    if (v?.url) { const w = $("#dWiki"); w.href = v.url; w.hidden = false; }
    if (v?.net && !item.ext?.net) $("#dExtra").textContent += " · " + v.net;
    if (v?.minutes && !item.ext?.minutes) $("#dExtra").textContent += ` · ${v.minutes} Min.`;
    const p = body.querySelector(".d-head .poster");
    if (v?.img && p && !p.querySelector("img")) { p.innerHTML = `<img src="${esc(v.img)}" alt="" referrerpolicy="no-referrer">`; }
  }).catch(() => { const t = $("#dText"); if (t) t.innerHTML = `<span class="muted small">Beschreibung gerade nicht erreichbar.</span>`; });
}
detail.addEventListener("click", ev => {
  if (ev.target === detail || ev.target.closest("[data-close]")) return detail.close();
  const item = getItem(detailId);
  if (!item) return;
  const e = entryOf(item.id) || {};
  const s = ev.target.closest("[data-status]")?.dataset.status;
  const r = ev.target.closest("[data-r]")?.dataset.r;
  const sim = ev.target.closest("[data-sim]")?.dataset.sim;
  if (s) {
    const patch = { status: e.status === s ? undefined : s };
    if (s === "watching" && item.type === "s" && !e.season) patch.season = 1;
    if (patch.status) patch.skip = false;
    setEntry(item, patch); renderDetail(s === "seen" && !e.rating);
  } else if (r) {
    const rating = Number(r);
    setEntry(item, { rating: e.rating === rating ? undefined : rating, status: e.status || "seen", skip: false }); renderDetail();
  } else if (sim) openDetail(sim);
  else if (ev.target.closest("[data-skip]")) { setEntry(item, { skip: !e.skip }); renderDetail(); }
  else if (ev.target.closest("[data-remove]")) {
    const old = { ...e };
    removeEntry(item.id); detail.close();
    toast(`„${item.title}“ entfernt`, () => { state.items[item.id] = { ...old, t: Date.now() }; store.save(state); refresh(); });
  }
});
detail.addEventListener("change", ev => {
  const item = getItem(detailId);
  if (!item) return;
  if (ev.target.id === "dSeason") setEntry(item, { season: Math.max(1, Number(ev.target.value) || 1) });
  if (ev.target.id === "dNote") setEntry(item, { note: ev.target.value.trim() });
});
detail.addEventListener("close", () => { detailId = null; refresh(); });

/* ---------- Schnell bewerten ---------- */
const quick = $("#quick");
let qType = "", qHistory = [], qCount = 0, qItem = null;
function quickNext() {
  const cands = CATALOG.filter(x => !isHandled(entryOf(x.id)) && !qSkip.has(x.id) && (!qType || x.type === qType));
  cands.sort((a, b) => prio(b) - prio(a));
  qItem = cands[0] || null;
  renderQuick();
}
function renderQuick() {
  const b = $("#quickBody");
  if (!qItem) {
    b.innerHTML = `<button class="close" data-close aria-label="Schließen">✕</button><div class="q-wrap"><p class="empty"><span class="big">🎉</span>Du hast alle eingebauten Titel durch! Weitere findest du über die Suche.</p><button class="btn big" data-close>Fertig</button></div>`;
    return;
  }
  const x = qItem;
  b.innerHTML = `<button class="close" data-close aria-label="Schließen">✕</button>
    <div class="q-wrap">
      <div class="q-filter"><div class="seg" id="qType">
        ${[["", "Alles"], ["f", "Filme"], ["s", "Serien"]].map(([v, l]) => `<button data-v="${v}" aria-pressed="${qType === v}">${l}</button>`).join("")}
      </div></div>
      <div class="q-progress">${qCount ? `${qCount} bewertet · ` : ""}Kennst du das?</div>
      <div class="q-poster">${posterHtml(x)}</div>
      <h2 class="q-title">${esc(x.title)}</h2>
      <div class="q-line">${esc(lineOf(x))}</div>
      <div class="q-btns">
        <button data-q="r2"><span>❤️</span>Geliebt</button>
        <button data-q="r1"><span>👍</span>Gut</button>
        <button data-q="r-1"><span>👎</span>Nicht meins</button>
      </div>
      <div class="q-btns2">
        <button data-q="want">🔖 Will ich sehen</button>
        <button data-q="unknown">Kenne ich nicht →</button>
      </div>
      <div class="row q-foot">
        <button class="mini" data-q="back" ${qHistory.length ? "" : "disabled"}>↶ Zurück</button>
        <button class="mini" data-q="nope">Interessiert mich nicht</button>
      </div>
    </div>`;
  watchPosters(b);
  // Das nächste Poster schon mal laden
  const next = CATALOG.filter(c => c !== x && !isHandled(entryOf(c.id)) && !qSkip.has(c.id) && (!qType || c.type === qType)).sort((a, b) => prio(b) - prio(a))[0];
  if (next) details(next).catch(() => {});
}
function openQuick() {
  if (detail.open) detail.close();
  qHistory = []; qCount = 0;
  quickNext();
  quick.showModal();
}
quick.addEventListener("click", ev => {
  if (ev.target === quick || ev.target.closest("[data-close]")) return quick.close();
  const t = ev.target.closest("#qType button[data-v]");
  if (t) { qType = t.dataset.v; quickNext(); return; }
  const a = ev.target.closest("[data-q]")?.dataset.q;
  if (!a || !qItem) {
    if (a === "back") undoQuick();
    return;
  }
  if (a === "back") return undoQuick();
  const x = qItem, before = entryOf(x.id) ? { ...entryOf(x.id) } : null;
  qHistory.push({ x, before, skipped: a === "unknown" });
  if (a === "unknown") { qSkip.add(x.id); store.lsSet("fs.qskip", JSON.stringify([...qSkip].slice(-2000))); }
  else {
    if (a.startsWith("r")) setEntry(x, { status: "seen", rating: Number(a.slice(1)) }, true);
    else if (a === "want") setEntry(x, { status: "want" }, true);
    else if (a === "nope") setEntry(x, { skip: true }, true);
    qCount++;
  }
  quickNext();
});
function undoQuick() {
  const h = qHistory.pop();
  if (!h) return;
  if (h.skipped) { qSkip.delete(h.x.id); store.lsSet("fs.qskip", JSON.stringify([...qSkip])); }
  else {
    qCount = Math.max(0, qCount - 1);
    if (h.before) state.items[h.x.id] = { ...h.before, t: Date.now() };
    else state.items[h.x.id] = { id: h.x.id, del: true, t: Date.now() };
    store.save(state);
  }
  qItem = h.x;
  renderQuick();
}
quick.addEventListener("close", refresh);
document.addEventListener("click", ev => { if (ev.target.closest("[data-action=quick]")) openQuick(); });

/* ---------- Mehr ---------- */
function renderMore() {
  const es = entries();
  const c = (f) => es.filter(f).length;
  $("#stats").innerHTML = `<h2>Deine Zahlen</h2><div class="stat-grid">
    <div><b>${c(e => e.type === "f" && e.status === "seen")}</b><span>Filme gesehen</span></div>
    <div><b>${c(e => e.type === "s" && e.status === "seen")}</b><span>Serien gesehen</span></div>
    <div><b>${c(e => e.status === "want")}</b><span>auf der Merkliste</span></div>
    <div><b>${c(e => e.rating === 2)}</b><span>❤️ geliebt</span></div>
    <div><b>${c(e => e.rating === 1)}</b><span>👍 gut</span></div>
    <div><b>${c(e => e.rating === -1)}</b><span>👎 nicht meins</span></div></div>`;
  renderSync();
  $("#version").textContent = `Version ${VERSION}`;
}
let syncStatus = "lokal";
function renderSync() {
  const box = $("#syncBox");
  const code = store.syncCode();
  if (!store.canSync) { box.innerHTML = `<p class="muted">Im Demo-Modus bleibt alles nur auf diesem Gerät.</p>`; return; }
  if (code) {
    box.innerHTML = `<p class="muted">Verbunden. Mit diesem Code siehst du dieselbe Liste auf dem Handy und am PC.</p>
      <div class="codebox">${esc(store.showCode(code))}</div>
      <div class="row"><button class="btn ghost" id="copyCode">Code kopieren</button><button class="btn ghost" id="unlink">Trennen</button></div>
      ${syncStatus === "fehler" ? `<p class="small err">Abgleich gerade gestört – die Liste bleibt auf dem Gerät gespeichert.</p>` : ""}`;
    $("#copyCode").onclick = () => navigator.clipboard?.writeText(store.showCode(code)).then(() => toast("Code kopiert"));
    $("#unlink").onclick = () => { if (confirm("Abgleich trennen? Die Liste bleibt auf diesem Gerät.")) { store.disconnect(); renderSync(); } };
  } else {
    box.innerHTML = `<p class="muted">Bisher ist die Liste nur auf diesem Gerät. Mit einem Code kannst du sie auf dem PC oder einem zweiten Handy öffnen.</p>
      <button class="btn" id="newCode">Code anlegen</button>
      <div class="ai-row gap-top"><input id="joinCode" placeholder="Code von einem anderen Gerät" autocapitalize="off" autocomplete="off" spellcheck="false"><button class="btn ghost" id="join">Verbinden</button></div>
      <p class="small err" id="syncErr"></p>`;
    $("#newCode").onclick = () => link(store.newCode(), true);
    $("#join").onclick = () => link(store.cleanCode($("#joinCode").value), false);
  }
}
async function link(code, isNew) {
  const err = $("#syncErr");
  if (code.length < 10) { err.textContent = "Der Code ist zu kurz."; return; }
  err.innerHTML = `<span class="spinner"></span>`;
  try { await store.connect(code, state, isNew); renderSync(); toast(isNew ? "Code angelegt" : "Verbunden – Listen zusammengeführt"); }
  catch (e) { console.error(e); err.textContent = e.message === "notfound" ? "Diesen Code gibt es nicht." : "Verbinden hat nicht geklappt. Internet da?"; }
}
store.onSync(remote => {
  const merged = store.merge(state, remote);
  const same = JSON.stringify(Object.keys(merged.items).sort().map(k => [k, merged.items[k].t])) === JSON.stringify(Object.keys(remote.items || {}).sort().map(k => [k, remote.items[k].t]));
  if (same) { merged.st = remote.st; state = merged; store.adopt(state); }
  else { state = merged; store.save(state); }
  refresh();
  if (detail.open && detailId) renderDetail();
}, s => { syncStatus = s; const b = $("#syncBadge"); b.hidden = s === "lokal"; b.textContent = s === "fehler" ? "⚠ offline" : "☁ verbunden"; if (view === "more") renderSync(); });

$("#exportBtn").onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `filme-serien-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$("#importFile").onchange = async ev => {
  const f = ev.target.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!data.items) throw new Error();
    state = store.merge(state, data);
    store.save(state);
    refresh();
    toast(`Geladen: ${Object.values(data.items).filter(e => !e.del).length} Titel`);
  } catch { toast("Die Datei passt nicht."); }
  ev.target.value = "";
};

/* ---------- Hinweis unten ---------- */
let toastTimer = null;
function toast(msg, undo) {
  const t = $("#toast");
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? `<button>Rückgängig</button>` : ""}`;
  t.hidden = false;
  if (undo) t.querySelector("button").onclick = () => { undo(); t.hidden = true; };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
}

/* ---------- Start ---------- */
const startView = store.lsGet("fs.view");
show(["recs", "search", "list", "more"].includes(startView) ? startView : "recs");
if (store.canSync && store.savedCode()) store.connect(store.savedCode(), state, false).catch(e => { console.warn(e); syncStatus = "fehler"; });
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(() => {});
