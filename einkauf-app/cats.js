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

// Abteilung raten: erst was wir schon gelernt haben, dann Stichwörter
export function guessCat(text, known = []) {
  const k = known.find(x => x.id === keyOf(text));
  if (k?.cat) return k.cat;
  const words = norm(text).split(/[\s,\-]+/);
  if (words.includes("tk") || words[0].startsWith("tiefkühl")) return "tk"; // "TK Spinat" ist kein Gemüse-Regal
  for (const [w, cat] of KEYWORDS) {
    if (w.length <= 3) { if (words.includes(w)) return cat; }
    else if (words.some(x => x.startsWith(w) || x.endsWith(w))) return cat;
  }
  return "sonst";
}

// "2 Liter Milch" → { qty: "2 Liter", text: "Milch" }
export function splitQty(input) {
  const m = input.trim().match(/^(\d+(?:[.,]\d+)?\s*(?:x|stk\.?|stück|kg|g|gr|l|liter|ml|pck\.?|packung(?:en)?|pkg|dosen?|flaschen?|becher|bund|netz|glas|gläser|tüten?|rollen?|kisten?|kästen?)?)\s+(.+)$/i);
  return m ? { qty: m[1].trim(), text: m[2].trim() } : { qty: "", text: input.trim() };
}
