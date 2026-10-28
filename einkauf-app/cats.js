// Abteilungen und Texterkennung, gemeinsam für die App (app.js) und das Kommandozeilen-Werkzeug (cli.mjs).
// Kein DOM hier, damit es auch in Node läuft.

// Abteilungen in der Reihenfolge, in der man meist durch den Laden läuft
export const CATS = [
  { id: "obst", name: "Obst & Gemüse", emoji: "🥦", words: "apfel äpfel banane bananen birne birnen tomate tomaten gurke gurken salat kartoffel kartoffeln zwiebel zwiebeln knoblauch möhre möhren karotte karotten paprika zitrone zitronen orange orangen mandarine mandarinen clementinen trauben weintrauben beeren erdbeeren himbeeren heidelbeeren blaubeeren johannisbeeren stachelbeeren brombeeren pilze champignons pfifferlinge zucchini kohl blumenkohl rotkohl weißkohl wirsing grünkohl rosenkohl kohlrabi lauch porree spinat brokkoli avocado ingwer petersilie schnittlauch dill basilikum minze koriander thymian rosmarin kräuter obst gemüse kiwi melone wassermelone radieschen rettich sellerie staudensellerie mango ananas aubergine kürbis rucola feldsalat eisbergsalat kopfsalat chicorée endivie pflaumen zwetschgen pfirsich nektarine aprikosen kirschen limette limetten spargel rhabarber fenchel bete süßkartoffel pastinake frühlingszwiebeln schalotten maiskolben granatapfel feigen datteln grapefruit papaya maracuja physalis lychee kaki sprossen suppengrün" },
  { id: "brot", name: "Brot & Backwaren", emoji: "🥖", words: "brot brötchen toast toastbrot baguette croissant croissants kuchen semmel semmeln laugen brezel brezeln laugenstange zwieback knäckebrot schrippen weckle ciabatta fladenbrot wraps tortilla muffins donut berliner krapfen hefezopf stuten rosinenbrötchen vollkornbrot mischbrot pumpernickel aufbackbrötchen torte plunder teilchen" },
  { id: "kuehl", name: "Kühlregal", emoji: "🧀", words: "milch butter käse joghurt jogurt quark sahne schlagsahne schmand frischkäse mozzarella eier ei wurst schinken salami aufschnitt margarine pudding feta parmesan kefir buttermilch tofu hefe gouda emmentaler camembert brie bergkäse reibekäse scheibenkäse hüttenkäse ricotta mascarpone halloumi creme crème fraîche fraiche leberwurst teewurst mortadella lyoner fleischwurst bierschinken wiener wienerle mettwurst cabanossi skyr ayran milchreis grießpudding desserts gnocchi tortellini maultaschen schupfnudeln frischeteig pizzateig blätterteig hummus aufstrich lachsschinken kochschinken putenbrustaufschnitt veggie" },
  { id: "fleisch", name: "Fleisch & Fisch", emoji: "🥩", words: "fleisch hack hackfleisch gehacktes mett hähnchen hähnchenbrust huhn hühnchen hühner geflügel pute puten truthahn ente enten gans gänse wild hirsch reh lamm kalb kalbs rind rinder rindfleisch schwein schweine schweinefleisch schnitzel steak steaks bratwurst bratwürste würstchen grillwurst fisch lachs garnelen gulasch braten speck bacon filet leberkäse fleischkäse kotelett frikadellen buletten brust keule keulen schenkel flügel wings nuggets geschnetzeltes rouladen roulade rippchen spareribs ribs kassler kasseler schweinebauch nacken gyros döner leber hering matjes forelle kabeljau seelachs dorsch zander scholle dorade makrele sardinen krabben shrimps scampi muscheln tintenfisch calamari räucherlachs burger patties cevapcici minutensteak hüftsteak entrecote" },
  { id: "tk", name: "Tiefkühl", emoji: "🧊", words: "tiefkühl tk eis speiseeis eiscreme pommes fischstäbchen tiefkühlpizza pizza kroketten rahmspinat kräuterbaguette rösti wedges eiswürfel tiefkühlgemüse buttergemüse beerenmischung lasagne" },
  { id: "vorrat", name: "Vorrat", emoji: "🥫", words: "nudeln spaghetti penne fusilli makkaroni tagliatelle lasagneplatten reis basmati risotto couscous bulgur quinoa mehl zucker puderzucker salz pfeffer öl olivenöl sonnenblumenöl rapsöl essig balsamico konserve konserven dose dosen tomatenmark passata tomatensoße linsen bohnen kichererbsen kidneybohnen müsli haferflocken cornflakes honig marmelade konfitüre nutella erdnussbutter kaffee kaffeepads kapseln espresso tee brühe gewürz gewürze paprikapulver curry zimt oregano senf ketchup mayo mayonnaise soße sauce dressing thunfisch mais erbsen backpulver vanillezucker kakao suppe gewürzgurken essiggurken oliven grieß semmelbrösel paniermehl stärke speisestärke gelatine püree kartoffelpüree knödel brühwürfel fond sojasoße pesto tomatenstücke apfelmus rotkraut sauerkraut fertiggericht trockenhefe kokosmilch maggi knorr barilla miracoli" },
  { id: "suess", name: "Süßes & Snacks", emoji: "🍫", words: "schokolade schoko chips kekse keks gummibärchen fruchtgummi bonbons süßigkeiten nüsse erdnüsse cashews mandeln walnüsse haselnüsse pistazien salzstangen flips cracker popcorn riegel müsliriegel pralinen waffeln lakritz kaugummi studentenfutter trockenobst rosinen haribo milka ritter kinderriegel duplo hanuta pringles" },
  { id: "getraenke", name: "Getränke", emoji: "🥤", words: "wasser mineralwasser saft säfte sprudel cola limo limonade fanta sprite bier radler wein rotwein weißwein rosé sekt prosecco schorle apfelschorle eistee orangensaft apfelsaft multivitamin smoothie energy energydrink sirup milchgetränk kakaogetränk alkoholfrei malzbier whisky wodka schnaps likör tonic coca pepsi capri" },
  { id: "haushalt", name: "Drogerie & Haushalt", emoji: "🧴", words: "klopapier toilettenpapier küchenrolle küchenpapier taschentücher servietten spülmittel waschmittel colorwaschmittel vollwaschmittel seife flüssigseife handseife shampoo spülung duschgel duschbad zahnpasta zahncreme zahnbürste zahnseide mundwasser deo deodorant müllbeutel mülltüten tabs spülmaschinentabs klarspüler spülmaschinensalz schwamm schwämme lappen putzmittel reiniger allzweckreiniger glasreiniger wc-reiniger entkalker essigreiniger scheuermilch batterien windeln feuchttücher tabletten pflaster weichspüler alufolie frischhaltefolie backpapier gefrierbeutel vorratsbeutel brotdosen rasierer rasierklingen rasierschaum creme bodylotion sonnencreme haargel haarspray wattepads wattestäbchen binden tampons slipeinlagen futter katzenfutter hundefutter katzenstreu leckerli kerzen teelichter glühbirne streichhölzer feuerzeug kosmetik schminke nagellack abschminktücher zewa tempo nivea persil ariel lenor somat pril frosch domestos" },
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
// Bei zusammengesetzten Wörtern zählt das Ende: "Apfelsaft" ist Saft, "Entenbrust" ist Brust, "Butterkeks" ist Keks.
// Kurze Stichwörter nur am Ende längerer Wörter ("Sonnenblumenöl"), damit "Reis" nicht als "Eis" gilt.
const endsIn = (words, w) => words.some(x => x.endsWith(w) && (w.length > 3 || x.length >= w.length + 3));
const startsIn = (words, w) => w.length > 3 && words.some(x => x.startsWith(w));
function byKeywords(words) {
  for (const test of [(ws, w) => ws.includes(w), endsIn, startsIn])
    for (const [w, cat] of KEYWORDS) if (test(words, w)) return cat;
  return null;
}

// Abteilung raten: erst was wir schon gelernt haben, dann eigene Stichwörter, dann die festen
export function guessCat(text, known = [], custom = []) {
  const valid = new Set(allCats(custom).map(c => c.id));
  const k = known.find(x => x.id === keyOf(text));
  if (k?.cat && k.cat !== "sonst" && valid.has(k.cat)) return k.cat; // "Sonstiges" war meist nur geraten
  const words = norm(text).split(/[\s,\-()]+/).filter(Boolean);
  if (!words.length) return "sonst";
  for (const c of custom) if (customWords(c).some(w => matches(words, w) || norm(text) === w)) return c.id;
  if (words.includes("tk") || words[0].startsWith("tiefkühl") || words[0].startsWith("tiefgefror")) return "tk"; // "TK Spinat" ist kein Gemüse-Regal
  return byKeywords(words) || "sonst";
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
