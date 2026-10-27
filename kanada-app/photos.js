// Fotos und Kurzbeschreibung von Wikipedia (Bilder von Wikimedia Commons, frei nutzbar mit Quellenangabe).
// Ein Artikel zählt nur, wenn er wirklich in der Nähe liegt – sonst landet man schnell bei einem gleichnamigen Ort.
const LS = "ka.wiki2";
try { localStorage.removeItem("ka.wiki"); } catch {}
const mem = new Map();
const store = (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } })();
let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const keep = Object.entries(store).sort((a, b) => b[1].at - a[1].at).slice(0, 400);
    try { localStorage.setItem(LS, JSON.stringify(Object.fromEntries(keep))); } catch {}
  }, 500);
}
const km = (a, b) => {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
};
const api = (lang, params) => fetch(`https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({ format: "json", origin: "*", ...params }), { signal: AbortSignal.timeout(10000) }).then(r => r.json());
const PROPS = { prop: "pageimages|coordinates|extracts|info", piprop: "thumbnail", pithumbsize: "640", exintro: "1", explaintext: "1", exsentences: "2", exlimit: "max", colimit: "max", inprop: "url" };

// Passende Seite aus den Treffern: in der Nähe, mit Bild, bevorzugt mit ähnlichem Namen
function pick(pages, p, name) {
  const words = name.toLowerCase().replace(/\(.*?\)/g, "").split(/[^a-zäöüéèàç']+/).filter(w => w.length > 3);
  return Object.values(pages || {})
    .map(pg => {
      const c = pg.coordinates?.[0];
      const d = c ? km(p, { lat: c.lat, lng: c.lon }) : Infinity;
      const hits = words.filter(w => pg.title.toLowerCase().includes(w)).length;
      return { pg, d, hits, sc: (pg.thumbnail ? 3 : 0) + hits * 2 - d / 5 };
    })
    .filter(x => x.d <= 25 && x.pg.thumbnail)
    .sort((a, b) => b.sc - a.sc)
    .map(x => Object.assign(x.pg, { loose: !x.hits }))[0] || null;
}
// Einleitungstext ohne Reste aus Infoboxen (kurze Zeilen am Anfang)
const cleanText = t => (t || "").split("\n").map(s => s.trim()).filter(s => s.length > 40).join(" ").slice(0, 280);
async function lookup(p, name, lang) {
  const q = name.replace(/\(.*?\)/g, "").replace(/&/g, " ").trim();
  const s = await api(lang, { action: "query", generator: "search", gsrsearch: q, gsrlimit: "6", ...PROPS });
  let pg = pick(s.query?.pages, p, name);
  if (!pg) {
    // Kein passender Artikel zum Namen: der nächste Artikel mit Bild rund um den Punkt
    const g = await api(lang, { action: "query", generator: "geosearch", ggscoord: `${p.lat}|${p.lng}`, ggsradius: "2000", ggslimit: "6", ...PROPS });
    pg = pick(g.query?.pages, p, name) || Object.values(g.query?.pages || {}).filter(x => x.thumbnail).sort((a, b) => (a.index || 0) - (b.index || 0))[0] || null;
    if (pg) pg.near = true;
  }
  return pg ? { img: pg.thumbnail.source, title: pg.title, url: pg.fullurl || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pg.title)}`, text: cleanText(pg.extract), lang, near: !!pg.near || !!pg.loose } : null;
}

// p: { lat, lng }, name: Name des Ortes. Liefert { img, title, url, text, lang, near } oder null.
export function photoFor(p, name) {
  const key = `${name}|${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
  if (mem.has(key)) return mem.get(key);
  if (store[key] && Date.now() - store[key].at < 90 * 864e5) { const v = Promise.resolve(store[key].v); mem.set(key, v); return v; }
  const job = (async () => {
    // Erst deutscher Artikel; passt der nicht genau zum Namen, den englischen versuchen (dort gibt es mehr Kanada-Artikel)
    let v = null;
    for (const lang of ["de", "en"]) {
      let r = null;
      try { r = await lookup(p, name, lang); } catch {}
      if (r && (!v || (v.near && !r.near))) v = r;
      if (v && !v.near) break;
    }
    store[key] = { at: Date.now(), v }; persist();
    return v;
  })();
  mem.set(key, job);
  return job;
}

// Alle Platzhalter [data-photo] auf der Seite füllen, höchstens 4 Anfragen gleichzeitig
export async function fillPhotos(root = document) {
  const els = [...root.querySelectorAll("[data-photo]:not([data-done])")];
  let i = 0;
  const worker = async () => {
    while (i < els.length) {
      const el = els[i++];
      el.dataset.done = "1";
      const v = await photoFor({ lat: +el.dataset.lat, lng: +el.dataset.lng }, el.dataset.photo).catch(() => null);
      if (!document.body.contains(el)) continue;
      if (!v) { el.classList.add("nophoto"); continue; }
      const img = document.createElement("img");
      img.src = v.img; img.alt = v.title; img.loading = "lazy"; img.referrerPolicy = "no-referrer";
      el.prepend(img);
      const txt = el.parentElement?.querySelector("[data-wikitext]");
      if (txt && v.text && !v.near) txt.textContent = v.text;
      const src = el.querySelector(".src") || document.createElement("a");
      src.className = "src"; src.href = v.url; src.target = "_blank"; src.rel = "noopener";
      src.textContent = `Foto: Wikipedia${v.near ? " (Umgebung)" : ""}`;
      el.append(src);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}
