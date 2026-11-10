// Wo läuft das? Angebote in Deutschland (Abo, kostenlos, leihen, kaufen).
// 1. JustWatch (dieselben Daten, die justwatch.de zeigt) – ohne Schlüssel, aber ohne Gewähr, dass der Zugriff von
//    anderen Seiten aus immer erlaubt bleibt.
// 2. Klappt das nicht: die KI fragen (über Firebase, mit Google-Suche wenn freigeschaltet, sonst aus ihrem Wissen –
//    das wird dann als „ungefähr“ angezeigt).
// Ergebnisse werden 3 Tage auf dem Gerät gemerkt.
const LS = "fs.stream1";
const cache = (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } })();
const TTL = 3 * 864e5;
function persist() {
  const keep = Object.entries(cache).sort((a, b) => b[1].at - a[1].at).slice(0, 300);
  try { localStorage.setItem(LS, JSON.stringify(Object.fromEntries(keep))); } catch {}
}

// Streamingdienste in Deutschland, zum Auswählen unter „Meine Abos“. match = woran man den Dienst im Namen erkennt.
export const SERVICES = [
  { id: "netflix", name: "Netflix", match: /netflix/ },
  { id: "prime", name: "Prime Video", match: /amazon prime|prime video/ },
  { id: "disney", name: "Disney+", match: /disney/ },
  { id: "wow", name: "WOW / Sky", match: /\bwow\b|sky/ },
  { id: "apple", name: "Apple TV+", match: /apple tv(\+| plus)/ },
  { id: "paramount", name: "Paramount+", match: /paramount/ },
  { id: "rtl", name: "RTL+", match: /rtl/ },
  { id: "joyn", name: "Joyn", match: /joyn/ },
  { id: "magenta", name: "MagentaTV", match: /magenta/ },
  { id: "ard", name: "ARD Mediathek", match: /\bard\b/ },
  { id: "zdf", name: "ZDF Mediathek", match: /zdf/ },
  { id: "arte", name: "Arte", match: /arte/ },
  { id: "crunchyroll", name: "Crunchyroll", match: /crunchyroll/ },
  { id: "mubi", name: "MUBI", match: /mubi/ },
  { id: "youtube", name: "YouTube", match: /youtube/ },
  { id: "pluto", name: "Pluto TV", match: /pluto/ }
];
export const serviceOf = name => SERVICES.find(s => s.match.test(String(name).toLowerCase())) || null;

export const KIND = {
  abo: { label: "Im Abo", order: 0 }, gratis: { label: "Kostenlos", order: 1 },
  leihen: { label: "Leihen", order: 2 }, kaufen: { label: "Kaufen", order: 3 }, kino: { label: "Im Kino", order: 4 }
};
const JW_KIND = { FLATRATE: "abo", FLATRATE_AND_BUY: "abo", FREE: "gratis", ADS: "gratis", RENT: "leihen", BUY: "kaufen", CINEMA: "kino" };

const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, " ").trim();

const JW_QUERY = `query Suche($filter: TitleFilter!, $country: Country!, $language: Language!, $first: Int!) {
  popularTitles(country: $country, filter: $filter, first: $first, sortBy: POPULAR, sortRandomSeed: 0) {
    edges { node { objectType content(country: $country, language: $language) { title originalReleaseYear }
      offers(country: $country, platform: WEB) { monetizationType standardWebURL package { clearName } } } }
  }
}`;
async function justWatch(item) {
  const res = await fetch("https://apis.justwatch.com/graphql", {
    method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout?.(10000),
    body: JSON.stringify({ query: JW_QUERY, variables: {
      first: 6, country: "DE", language: "de",
      filter: { searchQuery: item.title, objectTypes: [item.type === "s" ? "SHOW" : "MOVIE"] }
    } })
  });
  if (!res.ok) throw new Error("JustWatch " + res.status);
  const data = await res.json();
  const nodes = (data.data?.popularTitles?.edges || []).map(e => e.node);
  if (!nodes.length && data.errors) throw new Error("JustWatch: " + data.errors[0]?.message);
  const names = [norm(item.title), norm(item.orig)].filter(Boolean);
  const scored = nodes.map(n => {
    const t = norm(n.content?.title), y = n.content?.originalReleaseYear;
    let sc = names.includes(t) ? 4 : names.some(a => t.includes(a) || a.includes(t)) ? 1 : -5;
    if (item.year && y) sc -= Math.min(Math.abs(item.year - y), 5);
    return { n, sc };
  }).sort((a, b) => b.sc - a.sc);
  const hit = scored[0]?.sc > -2 ? scored[0].n : null;
  if (!hit) return { offers: [], source: "justwatch", nohit: true };
  const seen = new Set(), offers = [];
  for (const o of hit.offers || []) {
    const kind = JW_KIND[o.monetizationType];
    const name = o.package?.clearName;
    if (!kind || !name) continue;
    const k = kind + "|" + name;
    if (seen.has(k)) continue;
    seen.add(k);
    offers.push({ name, kind, url: o.standardWebURL || "" });
  }
  return { offers, source: "justwatch" };
}

// Liefert { offers: [{ name, kind, url }], source: "justwatch" | "ki" | "ki-wissen", at }
// force = nicht aus dem Zwischenspeicher. useAi(item) = Funktion für die KI-Abfrage (aus store.js).
export async function whereToStream(item, { force = false, useAi = null } = {}) {
  const c = cache[item.id];
  if (!force && c && Date.now() - c.at < TTL) return c;
  let r = null;
  try { r = await justWatch(item); }
  catch (e) { console.warn("JustWatch nicht erreichbar:", e.message); }
  // JustWatch nicht erreichbar oder Titel dort nicht gefunden: die KI fragen
  if ((!r || r.nohit) && useAi) {
    try { r = await useAi(item); }
    catch (e) { console.warn("KI nicht erreichbar:", e.message); }
  }
  if (!r) throw new Error("keine Quelle erreichbar");
  r.at = Date.now();
  cache[item.id] = r;
  persist();
  return r;
}
export const cachedStream = id => { const c = cache[id]; return c && Date.now() - c.at < TTL * 3 ? c : null; };
