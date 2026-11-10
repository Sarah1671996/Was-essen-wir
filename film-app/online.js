// Daten aus dem Internet, alle ohne Schlüssel:
// - Serien: TVmaze (api.tvmaze.com) – Suche, Genres, Poster, Sender/Streamingdienst
// - Filme: iTunes/Apple TV (itunes.apple.com, deutsche Ausgabe) – Suche, Genre, Poster, deutsche Beschreibung
// - Beschreibung auf Deutsch und Ersatz-Poster: Wikipedia
// Gefundenes wird auf dem Gerät gemerkt (60 Tage), damit es schnell geht und offline klappt.
import { GENRES, makeId } from "./catalog.js";

const LS_META = "fs.meta1";
const meta = (() => { try { return JSON.parse(localStorage.getItem(LS_META)) || {}; } catch { return {}; } })();
let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const keep = Object.entries(meta).sort((a, b) => b[1].at - a[1].at).slice(0, 700);
    try { localStorage.setItem(LS_META, JSON.stringify(Object.fromEntries(keep))); } catch {}
  }, 600);
}

const timeout = ms => AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined;
const getJson = url => fetch(url, { signal: timeout(10000) }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

// iTunes schickt keine CORS-Kopfzeilen, kann aber JSONP
let jsonpN = 0;
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const name = "__itunes" + (++jsonpN);
    const s = document.createElement("script");
    const done = () => { delete window[name]; s.remove(); clearTimeout(t); };
    const t = setTimeout(() => { done(); reject(new Error("Zeitüberschreitung")); }, 10000);
    window[name] = data => { done(); resolve(data); };
    s.onerror = () => { done(); reject(new Error("nicht erreichbar")); };
    s.src = url + (url.includes("?") ? "&" : "?") + "callback=" + name;
    document.head.appendChild(s);
  });
}

// Nicht zu viele Anfragen gleichzeitig (TVmaze erlaubt ca. 20 in 10 Sekunden)
const queue = [];
let running = 0;
function limited(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    pump();
  });
}
function pump() {
  while (running < 3 && queue.length) {
    const { fn, resolve, reject } = queue.shift();
    running++;
    fn().then(resolve, reject).finally(() => { running--; setTimeout(pump, 150); });
  }
}

const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const stripHtml = h => String(h || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

/* ---------- Genres übersetzen ---------- */
const TVMAZE_GENRE = {
  Action: "Action", Adventure: "Abenteuer", Anime: "Animation", Children: "Familie", Comedy: "Komödie", Crime: "Krimi",
  Drama: "Drama", Espionage: "Thriller", Family: "Familie", Fantasy: "Fantasy", History: "Historie", Horror: "Horror",
  Legal: "Drama", Medical: "Drama", Music: "Musik", Mystery: "Mystery", Nature: "Doku", Romance: "Romantik",
  "Science-Fiction": "Sci-Fi", Sports: "Sport", Supernatural: "Fantasy", Thriller: "Thriller", War: "Krieg", Western: "Western"
};
const TVMAZE_TAG = { Anime: "anime", Espionage: "spion", Legal: "anwalt", Medical: "krankenhaus", Supernatural: "übernatürlich", Food: "kochen", Travel: "reise", DIY: "heimwerken" };
const TVMAZE_TYPE = { Animation: "Animation", Documentary: "Doku", Reality: "Reality" };
function itunesGenres(name) {
  const g = norm(name), out = [];
  const add = x => { if (GENRES.includes(x) && !out.includes(x)) out.push(x); };
  if (/action/.test(g)) add("Action");
  if (/abenteuer|adventure/.test(g)) add("Abenteuer");
  if (/kom(o|oe)die|comedy/.test(g)) add("Komödie");
  if (/drama/.test(g)) add("Drama");
  if (/horror/.test(g)) add("Horror");
  if (/thriller/.test(g)) add("Thriller");
  if (/science|sci fi/.test(g)) add("Sci-Fi");
  if (/fantasy/.test(g)) add("Fantasy");
  if (/kinder|familie|family|kids/.test(g)) add("Familie");
  if (/anim/.test(g)) add("Animation");
  if (/doku|documentary/.test(g)) add("Doku");
  if (/roman|liebe/.test(g)) add("Romantik");
  if (/krimi|crime/.test(g)) add("Krimi");
  if (/western/.test(g)) add("Western");
  if (/musik|music/.test(g)) add("Musik");
  if (/sport/.test(g)) add("Sport");
  if (/krieg|war/.test(g)) add("Krieg");
  if (/histor/.test(g)) add("Historie");
  return out.length ? out : ["Drama"];
}

/* ---------- Suche ---------- */
function fromTvmaze(show) {
  const year = show.premiered ? Number(show.premiered.slice(0, 4)) : null;
  const genres = [];
  for (const g of [TVMAZE_TYPE[show.type], ...(show.genres || []).map(g => TVMAZE_GENRE[g])]) if (g && !genres.includes(g)) genres.push(g);
  const tags = (show.genres || []).map(g => TVMAZE_TAG[g]).filter(Boolean);
  if (show.language === "German") tags.push("deutsch");
  if (show.language === "Korean") tags.push("koreanisch");
  const net = show.webChannel?.name || show.network?.name || "";
  return {
    id: makeId("s", show.name, year), type: "s", title: show.name, year, genres: genres.length ? genres : ["Drama"], tags,
    orig: "", img: show.image?.medium || "", src: "tvmaze", ext: { tvmaze: show.id, net, ended: show.status === "Ended" },
    text: stripHtml(show.summary).slice(0, 600), textLang: "en"
  };
}
function fromItunes(r) {
  const year = r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : null;
  return {
    id: makeId("f", r.trackName, year), type: "f", title: r.trackName, year, genres: itunesGenres(r.primaryGenreName), tags: [],
    orig: "", img: (r.artworkUrl100 || "").replace("100x100bb", "600x600bb"), src: "itunes",
    ext: { minutes: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 60000) : null },
    text: (r.longDescription || r.shortDescription || "").slice(0, 700), textLang: "de"
  };
}

// Satzzeichen stören die Suche („Ice road:vengeance“ findet sonst nichts)
export const cleanQuery = q => String(q || "").replace(/[:;,.!?_/\\|–—"„“()\[\]-]+/g, " ").replace(/\s+/g, " ").trim();

export async function searchSeries(q) {
  q = cleanQuery(q);
  const res = await getJson("https://api.tvmaze.com/search/shows?q=" + encodeURIComponent(q));
  return res.slice(0, 10).map(r => fromTvmaze(r.show));
}
export async function searchMovies(q) {
  q = cleanQuery(q);
  const res = await jsonp("https://itunes.apple.com/search?" + new URLSearchParams({ term: q, media: "movie", entity: "movie", country: "de", lang: "de_de", limit: "12" }));
  const out = [], ids = new Set();
  for (const r of res.results || []) { const x = fromItunes(r); if (!ids.has(x.id)) { ids.add(x.id); out.push(x); } }
  return out;
}

// Wikipedia kennt auch ganz neue Filme und Serien, die (noch) nicht bei iTunes stehen.
// Erkannt wird ein Film/eine Serie an der Kurzbeschreibung („2025 film by …“, „US-amerikanischer Film von 2025“).
const EN_GENRE = [[/action/, "Action"], [/adventure/, "Abenteuer"], [/animat/, "Animation"], [/documentar/, "Doku"], [/comedy|comedic/, "Komödie"],
  [/crime/, "Krimi"], [/drama/, "Drama"], [/family|children/, "Familie"], [/fantasy/, "Fantasy"], [/historical|period/, "Historie"], [/horror/, "Horror"],
  [/war film|war drama/, "Krieg"], [/musical|music/, "Musik"], [/mystery/, "Mystery"], [/reality/, "Reality"], [/romanc|romantic/, "Romantik"],
  [/science fiction|sci-fi/, "Sci-Fi"], [/sports?/, "Sport"], [/thriller/, "Thriller"], [/western/, "Western"]];
const DE_GENRE = [[/action/, "Action"], [/abenteuer/, "Abenteuer"], [/animation|zeichentrick/, "Animation"], [/dokumentar/, "Doku"], [/komödie/, "Komödie"],
  [/krimi/, "Krimi"], [/drama/, "Drama"], [/familien|kinder/, "Familie"], [/fantasy/, "Fantasy"], [/historien/, "Historie"], [/horror/, "Horror"],
  [/kriegs/, "Krieg"], [/musik/, "Musik"], [/mystery/, "Mystery"], [/reality/, "Reality"], [/liebes|romanti/, "Romantik"],
  [/science-fiction|science fiction/, "Sci-Fi"], [/sport/, "Sport"], [/thriller/, "Thriller"], [/western/, "Western"]];
export async function searchWikipedia(q, type) {
  q = cleanQuery(q);
  const one = async lang => {
    const kinds = type === "s" ? [lang === "de" ? "Fernsehserie" : "TV series"] : type === "f" ? [lang === "de" ? "Film" : "film"] : [lang === "de" ? "Film" : "film", lang === "de" ? "Fernsehserie" : "TV series"];
    const out = [];
    for (const kind of kinds) {
      const r = await wikiApi(lang, {
        action: "query", generator: "search", gsrsearch: `${q} ${kind}`, gsrlimit: "6",
        prop: "description|pageimages|extracts", piprop: "thumbnail", pithumbsize: "500", pilicense: "any",
        exintro: "1", explaintext: "1", exsentences: "3", exlimit: "max"
      });
      for (const pg of Object.values(r.query?.pages || {}).sort((a, b) => a.index - b.index)) {
        const d = (pg.description || "").toLowerCase(), ex = (pg.extract || "").toLowerCase().slice(0, 400);
        const isSeries = /series|serie|sitcom|miniserie|show/.test(d);
        const isFilm = !isSeries && /\bfilm|movie|spielfilm/.test(d);
        if (!isSeries && !isFilm) continue;
        const t = isSeries ? "s" : "f";
        if (type && t !== type) continue;
        const year = Number((d.match(/\b(19|20)\d\d\b/) || ex.match(/\b(19|20)\d\d\b/) || [])[0]) || null;
        const title = pg.title.replace(/\s*\((?:[^)]*\b(?:film|fernsehserie|tv series|miniserie|serie)\b[^)]*|\d{4})\)\s*$/i, "").trim();
        const genres = [];
        for (const [re, g] of lang === "de" ? DE_GENRE : EN_GENRE) if ((re.test(d) || re.test(ex)) && !genres.includes(g)) genres.push(g);
        out.push({
          id: makeId(t, title, year), type: t, title, year, genres: genres.length ? genres.slice(0, 3) : ["Drama"], tags: [], orig: "",
          img: pg.thumbnail?.source || "", src: "wikipedia", text: cleanText(pg.extract), textLang: lang
        });
      }
    }
    return out;
  };
  const [de, en] = await Promise.all([one("de").catch(() => []), one("en").catch(() => [])]);
  const seen = new Set(), res = [];
  for (const x of [...de, ...en]) { const k = norm(x.title) + x.type + (x.year || ""); if (!seen.has(k)) { seen.add(k); res.push(x); } }
  return res;
}

/* ---------- Poster und Beschreibung zu einem Titel ---------- */
// Bester Treffer: Name passt und Jahr liegt nah
function best(list, item, nameOf, yearOf) {
  const names = [norm(item.title), norm(item.orig)].filter(Boolean);
  let top = null, topSc = -Infinity;
  for (const x of list) {
    const n = norm(nameOf(x)), y = yearOf(x);
    let sc = names.includes(n) ? 5 : names.some(a => n.startsWith(a) || a.startsWith(n)) ? 2 : 0;
    if (item.year && y) sc -= Math.min(Math.abs(item.year - y), 6);
    if (sc > topSc) { topSc = sc; top = x; }
  }
  return topSc >= 0 ? top : null;
}

const wikiApi = (lang, params) => getJson(`https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({ format: "json", origin: "*", ...params }));
const cleanText = t => (t || "").split("\n").map(s => s.trim()).filter(s => s.length > 40).join(" ").slice(0, 700);
async function wiki(item, lang) {
  const kind = item.type === "s" ? (lang === "de" ? "Fernsehserie" : "TV series") : (lang === "de" ? "Film" : "film");
  const name = lang === "en" && item.orig ? item.orig : item.title;
  const s = await wikiApi(lang, {
    action: "query", generator: "search", gsrsearch: `${name} ${item.year || ""} ${kind}`, gsrlimit: "5",
    prop: "pageimages|extracts|info", piprop: "thumbnail", pithumbsize: "500", pilicense: "any",
    exintro: "1", explaintext: "1", exsentences: "4", exlimit: "max", inprop: "url"
  });
  const words = norm(name).split(" ").filter(w => w.length > 2);
  const pages = Object.values(s.query?.pages || {}).sort((a, b) => a.index - b.index);
  const pg = pages.find(p => {
    const t = norm(p.title);
    return words.every(w => t.includes(w)) || (words.length > 2 && words.filter(w => t.includes(w)).length >= words.length - 1);
  });
  if (!pg) return null;
  return { img: pg.thumbnail?.source || "", text: cleanText(pg.extract), url: pg.fullurl || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pg.title)}` };
}

async function posterSeries(item) {
  const res = await getJson("https://api.tvmaze.com/search/shows?q=" + encodeURIComponent(item.orig || item.title));
  const hit = best(res.map(r => r.show), item, s => s.name, s => s.premiered ? Number(s.premiered.slice(0, 4)) : null);
  return hit ? { img: hit.image?.medium || "", net: hit.webChannel?.name || hit.network?.name || "" } : null;
}
async function posterMovie(item) {
  const term = item.orig || item.title;
  const res = await jsonp("https://itunes.apple.com/search?" + new URLSearchParams({ term, media: "movie", entity: "movie", country: "de", lang: "de_de", limit: "8" }));
  const hit = best(res.results || [], { ...item, orig: item.orig || "" }, r => r.trackName, r => r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : null);
  return hit ? { img: (hit.artworkUrl100 || "").replace("100x100bb", "600x600bb"), text: hit.longDescription || "", minutes: hit.trackTimeMillis ? Math.round(hit.trackTimeMillis / 60000) : null } : null;
}

const mem = new Map();
// Liefert { img, text, url, net, minutes } (was gefunden wurde). full = auch Beschreibung von Wikipedia holen.
export function details(item, full = false) {
  const key = item.id + (full ? "|full" : "");
  const cached = meta[item.id];
  if (cached && Date.now() - cached.at < 60 * 864e5 && (!full || cached.full)) return Promise.resolve(cached.v);
  if (mem.has(key)) return mem.get(key);
  const job = limited(async () => {
    const v = { ...(cached?.v || {}) };
    if (item.img && !v.img) v.img = item.img;
    try {
      if (!v.img || (item.type === "s" && !v.net)) {
        const p = item.type === "s" ? await posterSeries(item) : await posterMovie(item);
        if (p) for (const [k, x] of Object.entries(p)) if (x && !v[k]) v[k] = x;
      }
    } catch (e) { console.warn("Poster", item.title, e.message); }
    if (full) {
      try {
        const de = await wiki(item, "de");
        if (de) { if (de.text) { v.text = de.text; v.textLang = "de"; } v.url = de.url; if (!v.img && de.img) v.img = de.img; }
      } catch (e) { console.warn("Wikipedia", e.message); }
      if (!v.img || !v.text) {
        try {
          const en = await wiki(item, "en");
          if (en) { if (!v.img && en.img) v.img = en.img; if (!v.text && en.text) { v.text = en.text; v.textLang = "en"; } if (!v.url) v.url = en.url; }
        } catch {}
      }
      if (!v.text && item.text) { v.text = item.text; v.textLang = item.textLang; }
    }
    meta[item.id] = { v, at: Date.now(), full: full || !!cached?.full };
    persist();
    return v;
  });
  mem.set(key, job);
  job.catch(() => mem.delete(key));
  return job;
}
export const cachedImg = id => meta[id]?.v?.img || "";

// Wo läuft das? Es gibt keine freie Schnittstelle dafür – JustWatch zeigt alle Anbieter in Deutschland.
export const whereToWatch = item => "https://www.justwatch.com/de/Suche?q=" + encodeURIComponent(item.title);
export const trailerLink = item => "https://www.youtube.com/results?search_query=" + encodeURIComponent(`${item.title} ${item.year || ""} Trailer deutsch`);
