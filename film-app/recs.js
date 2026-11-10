// Empfehlungen ohne KI: Aus dem, was gefallen oder nicht gefallen hat, entsteht ein Geschmacksprofil
// (welche Genres und Merkmale mag sie, welche nicht). Jeder noch unbekannte Titel bekommt damit Punkte.

// Wie stark eine Bewertung ins Profil eingeht
export const RATING_WEIGHT = { 2: 2, 1: 1, 0: 0, "-1": -1.6 };
const W_GENRE = 1, W_TAG = 1.6;
// Merkmale, die wenig über den Geschmack sagen, zählen weniger
const WEAK = { kult: 0.4, romanvorlage: 0.4, "wahre-geschichte": 0.7, deutsch: 0.8, britisch: 0.6, lang: 0.4, fortsetzung: 0.4 };

function features(item) {
  const f = new Map();
  for (const g of item.genres || []) f.set("g:" + g, W_GENRE);
  for (const t of item.tags || []) f.set("t:" + t, W_TAG * (WEAK[t] ?? 1));
  return f;
}
const normOf = f => Math.sqrt([...f.values()].reduce((s, v) => s + v * v, 0)) || 1;

// Gewicht eines Eintrags aus der eigenen Liste
function weightOf(entry) {
  if (entry.rating) return RATING_WEIGHT[entry.rating] ?? 0;
  if (entry.skip) return -0.6;              // „interessiert mich nicht“
  if (entry.status === "want") return 0.6;   // will ich sehen = klingt interessant
  if (entry.status === "watching") return 0.8;
  if (entry.status === "dropped") return -1;
  if (entry.status === "seen") return 0.4;
  return 0;
}

export function buildProfile(entries) {
  const prof = new Map(), types = { f: 0, s: 0 };
  const signals = [];
  for (const e of entries) {
    const w = weightOf(e);
    if (!w) continue;
    const f = features(e), n = normOf(f);
    for (const [k, v] of f) prof.set(k, (prof.get(k) || 0) + w * v / n);
    if (w > 0) types[e.type] += w;
    signals.push({ e, w, f, n });
  }
  return { prof, types, signals, strength: signals.filter(s => Math.abs(s.w) >= 1).length };
}

function sim(fa, na, fb, nb) {
  let dot = 0;
  for (const [k, v] of fa) { const x = fb.get(k); if (x) dot += v * x; }
  return dot / (na * nb);
}

// Punkte für einen Kandidaten + die Titel, die am meisten dafür sprechen (für „Weil dir … gefallen hat“)
export function scoreItem(item, profile) {
  const f = features(item), n = normOf(f);
  let s = 0;
  for (const [k, v] of f) s += (profile.prof.get(k) || 0) * v;
  s /= n;
  const because = [], against = [];
  for (const sg of profile.signals) {
    const x = sim(f, n, sg.f, sg.n);
    if (sg.w >= 1 && x > 0.3) because.push({ title: sg.e.title, x: x * sg.w });
    if (sg.w <= -1 && x > 0.45) against.push({ title: sg.e.title, x });
  }
  because.sort((a, b) => b.x - a.x);
  against.sort((a, b) => b.x - a.x);
  return { score: s, because: because.slice(0, 2).map(b => b.title), against: against.slice(0, 1).map(b => b.title) };
}

// Ähnliche Titel zu einem Titel (unabhängig vom Geschmack)
export function similarTo(item, pool, n = 12) {
  const f = features(item), nf = normOf(f);
  return pool
    .filter(x => x.id !== item.id)
    .map(x => {
      const g = features(x);
      let s = sim(f, nf, g, normOf(g));
      if (x.type === item.type) s += 0.05;
      return { x, s };
    })
    .filter(r => r.s > 0.2)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map(r => r.x);
}

// Merkmale, die sie am meisten mag / gar nicht mag (für die Anzeige „Dein Geschmack“)
export function topFeatures(profile, n = 6) {
  const all = [...profile.prof.entries()].filter(([k, v]) => Math.abs(v) > 0.15 && !(WEAK[k.slice(2)] < 0.7));
  const likes = all.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
  const dislikes = all.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, Math.ceil(n / 2)).map(([k]) => k);
  return { likes, dislikes };
}
