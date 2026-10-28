// Abteilungen und Texterkennung, gemeinsam für die App (app.js) und das Kommandozeilen-Werkzeug (cli.mjs).
// Kein DOM hier, damit es auch in Node läuft.

// Abteilungen in der Reihenfolge, in der man meist durch den Laden läuft
export const CATS = [
  { id: "obst", name: "Obst & Gemüse", emoji: "🥦", words: "apfel äpfel banane birne tomate tomaten gurke salat kartoffel zwiebel knoblauch möhre möhren karotte paprika zitrone orange mandarine trauben beeren erdbeeren himbeeren heidelbeeren pilze champignons zucchini kohl blumenkohl rotkohl lauch porree spinat brokkoli avocado ingwer petersilie schnittlauch dill basilikum kräuter obst gemüse kiwi melone wassermelone radieschen sellerie mango ananas aubergine kürbis rucola feldsalat eisbergsalat pflaumen pfirsich nektarine kirschen limette spargel rhabarber" },
  { id: "brot", name: "Brot & Backwaren", emoji: "🥖", words: "brot brötchen toast baguette croissant kuchen semmel laugen brezel zwieback knäckebrot schrippen" },
  { id: "kuehl", name: "Kühlregal", emoji: "🧀", words: "milch butter käse joghurt quark sahne schmand frischkäse mozzarella eier wurst schinken salami aufschnitt margarine pudding feta parmesan kefir buttermilch tofu hefe gouda creme crème leberwurst teewurst" },
  { id: "fleisch", name: "Fleisch & Fisch", emoji: "🥩", words: "fleisch hack hackfleisch hähnchen huhn hühnchen pute schnitzel steak bratwurst würstchen fisch lachs garnelen gulasch braten speck rind rinder schwein filet leberkäse kotelett frikadellen" },
  { id: "tk", name: "Tiefkühl", emoji: "🧊", words: "tiefkühl tk eis pommes fischstäbchen tiefkühlpizza kroketten" },
  { id: "vorrat", name: "Vorrat", emoji: "🥫", words: "nudeln spaghetti reis mehl zucker salz pfeffer öl olivenöl essig konserve dose tomatenmark passata linsen bohnen müsli haferflocken cornflakes honig marmelade nutella kaffee tee brühe gewürz senf ketchup mayo mayonnaise soße sauce thunfisch mais erbsen backpulver kakao suppe gurken grieß zwieback" },
  { id: "suess", name: "Süßes & Snacks", emoji: "🍫", words: "schokolade schoko chips kekse keks gummibärchen bonbons süßigkeiten nüsse erdnüsse salzstangen riegel pralinen kuchen" },
  { id: "getraenke", name: "Getränke", emoji: "🥤", words: "wasser mineralwasser saft sprudel cola limo bier wein sekt schorle apfelschorle eistee orangensaft" },
  { id: "haushalt", name: "Drogerie & Haushalt", emoji: "🧴", words: "klopapier toilettenpapier küchenrolle taschentücher spülmittel waschmittel seife shampoo duschgel zahnpasta zahnbürste deo müllbeutel tabs spülmaschinentabs schwamm batterien windeln tabletten pflaster weichspüler alufolie frischhaltefolie backpapier rasierer futter katzenfutter hundefutter kerzen glühbirne" },
  { id: "sonst", name: "Sonstiges", emoji: "🛒", words: "" }
];
export const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
// Längere Wörter zuerst, damit "Tomatenmark" nicht als "Tomate" erkannt wird
const KEYWORDS = CATS.flatMap(c => c.words.split(" ").filter(Boolean).map(w => [w, c.id])).sort((a, b) => b[0].length - a[0].length);

export const norm = s => s.trim().toLowerCase().replace(/\s+/g, " ");
// Dokument-ID für die "known"-Sammlung
export const keyOf = s => norm(s).replace(/[\/.#$\[\]]/g, "-").slice(0, 80) || "x";

// Feste Abteilungen plus die selbst angelegten der Familie ("categories"), "Sonstiges" immer zuletzt
export function allCats(custom = []) {
  return [
    ...CATS.filter(c => c.id !== "sonst"),
    ...[...custom].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      .map(c => ({ id: c.id, name: c.name, emoji: c.emoji || "🏷️", words: c.words || "", custom: true })),
    CAT.sonst
  ];
}
// Stichwörter der eigenen Abteilungen, durch Komma getrennt eingegeben
const customWords = c => (c.words || "").split(",").map(w => norm(w)).filter(Boolean);

// Wort passt, wenn ein Teil des Eintrags damit anfängt oder aufhört ("Vollmilch" → "milch"); kurze nur als ganzes Wort
function matches(words, w) {
  return w.length <= 3 ? words.includes(w) : words.some(x => x.startsWith(w) || x.endsWith(w));
}

// Abteilung raten: erst was wir schon gelernt haben, dann eigene Stichwörter, dann die festen
export function guessCat(text, known = [], custom = []) {
  const valid = new Set(allCats(custom).map(c => c.id));
  const k = known.find(x => x.id === keyOf(text));
  if (k?.cat && valid.has(k.cat)) return k.cat;
  const words = norm(text).split(/[\s,\-]+/);
  for (const c of custom) if (customWords(c).some(w => matches(words, w) || norm(text) === w)) return c.id;
  if (words.includes("tk") || words[0].startsWith("tiefkühl")) return "tk"; // "TK Spinat" ist kein Gemüse-Regal
  for (const [w, cat] of KEYWORDS) if (matches(words, w)) return cat;
  return "sonst";
}

const UNIT = "(?:x|stk\\.?|stück|kg|g|gr|l|ltr\\.?|liter|ml|cl|dl|m|pck\\.?|packung(?:en)?|pkg|dosen?|flaschen?|becher|bund|netz|glas|gläser|tüten?|rollen?|kisten?|kästen?)";
const NUM = "\\d+(?:[.,]\\d+)?";
const QTY = `(?:x\\s*)?${NUM}\\s*${UNIT}?`;
const QTY_FRONT = new RegExp(`^(${QTY})\\s+(.+)$`, "i");
const QTY_BACK = new RegExp(`^(.+?)\\s+\\(?(${QTY})\\)?$`, "i");
const tidy = q => q.trim().replace(/^x\s*(.+)$/i, "$1x"); // "x2" → "2x"

// Menge vorne und/oder hinten: "2 Liter Milch", "Maggi 2x", "Möhren 200g", "2 Gefrierbeutel 1l" → { qty, text }
export function splitQty(input) {
  let text = input.trim().replace(/\s+/g, " ");
  const parts = [];
  let m = text.match(QTY_FRONT);
  if (m) { parts.push(tidy(m[1])); text = m[2].trim(); }
  const back = [];
  for (let n = 0; n < 2 && (m = text.match(QTY_BACK)); n++) { back.unshift(tidy(m[2])); text = m[1].trim(); }
  parts.push(...back);
  return { qty: parts.join(" · "), text };
}
