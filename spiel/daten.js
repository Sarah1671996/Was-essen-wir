// Spielregeln: Waren, Felder, Tiere, Fabriken, Gebäude, Deko, Level und erste Schritte.
// Zeiten in Sekunden. Alles hier kann man frei anpassen, ohne den restlichen Code anzufassen.

export const WAREN = {
  weizen:  { name: "Weizen",  icon: "i-weizen",  wert: 3 },
  mais:    { name: "Mais",    icon: "i-mais",    wert: 5 },
  karotte: { name: "Karotte", icon: "i-karotte", wert: 7 },
  futter:  { name: "Futter",  icon: "i-futter",  wert: 4 },
  milch:   { name: "Milch",   icon: "i-milch",   wert: 9 },
  ei:      { name: "Ei",      icon: "i-ei",      wert: 7 },
  wolle:   { name: "Wolle",   icon: "i-wolle",   wert: 14 },
  brot:    { name: "Brot",    icon: "i-brot",    wert: 15 },
  butter:  { name: "Butter",  icon: "i-butter",  wert: 22 },
  kaese:   { name: "Käse",    icon: "i-kaese",   wert: 30 },
};

export const PFLANZEN = {
  weizen:  { zeit: 20, ertrag: 2, xp: 1, level: 1, bild: "feld-reif-weizen" },
  mais:    { zeit: 45, ertrag: 2, xp: 2, level: 2, bild: "feld-reif-mais" },
  karotte: { zeit: 75, ertrag: 2, xp: 3, level: 3, bild: "feld-reif-karotte" },
};

export const TIERE = {
  kuh:  { name: "Kuh",   bild: "kuh",  breite: 112, zeit: 45, ware: "milch", xp: 2, preis: 80,  max: 5, stall: "kuhstall" },
  huhn: { name: "Huhn",  bild: "huhn", breite: 62,  zeit: 30, ware: "ei",    xp: 1, preis: 40,  max: 6, stall: "huehnerstall" },
  schaf:{ name: "Schaf", bild: "schaf",breite: 100, zeit: 80, ware: "wolle", xp: 3, preis: 120, max: 4, stall: "schafweide" },
};
for (const [k, m] of [["kuh", "Kühe"], ["huhn", "Hühner"], ["schaf", "Schafe"]]) TIERE[k].mehrzahl = m;

export const FABRIKEN = {
  muehle: { name: "Futtermühle", bild: "muehle", rezepte: [
    { ware: "futter", menge: 2, zutaten: { weizen: 2 }, zeit: 15, level: 1 },
    { ware: "futter", menge: 4, zutaten: { mais: 1, weizen: 1 }, zeit: 25, level: 2 },
  ]},
  baeckerei: { name: "Bäckerei", bild: "baeckerei", rezepte: [
    { ware: "brot", menge: 1, zutaten: { weizen: 3 }, zeit: 35, level: 2 },
    { ware: "brot", menge: 3, zutaten: { weizen: 4, ei: 2 }, zeit: 60, level: 4 },
  ]},
  molkerei: { name: "Molkerei", bild: "molkerei", rezepte: [
    { ware: "butter", menge: 1, zutaten: { milch: 2 }, zeit: 45, level: 3 },
    { ware: "kaese", menge: 1, zutaten: { milch: 3 }, zeit: 70, level: 4 },
  ]},
};
export const WARTESCHLANGE = 3;

// Feste Gebäude mit Bauplatz. x/y = Mitte unten in Weltkoordinaten, breite = Darstellungsbreite.
export const GEBAEUDE = {
  scheune:      { name: "Scheune", bild: "scheune", x: 1270, y: 330, breite: 240, r: 105 },
  tafel:        { name: "Auftragstafel", bild: "tafel", x: 965, y: 790, breite: 130, r: 55 },
  muehle:       { name: "Futtermühle", bild: "muehle", x: 1010, y: 480, breite: 190, r: 80 },
  baeckerei:    { name: "Bäckerei", bild: "baeckerei", x: 1190, y: 600, breite: 205, r: 85, level: 2, preis: 150, einwohner: 10 },
  molkerei:     { name: "Molkerei", bild: "molkerei", x: 1385, y: 720, breite: 205, r: 85, level: 3, preis: 300, einwohner: 25 },
  kuhstall:     { name: "Kuhstall", bild: "kuhstall", x: 270, y: 900, breite: 190, r: 80 },
  huehnerstall: { name: "Hühnerstall", bild: "huehnerstall", x: 700, y: 1070, breite: 200, r: 85, level: 2, preis: 120, einwohner: 5 },
  schafweide:   { name: "Schafweide", bild: null, x: 1130, y: 1070, breite: 220, r: 110, level: 4, preis: 250, einwohner: 40 },
  steg:         { name: "Steg zur Insel", bild: "steg", x: 1610, y: 1300, breite: 250, r: 0 },
};

// Weideflächen, auf denen die Tiere herumlaufen (Mitte und Halbachsen)
export const WEIDEN = {
  kuh:  { x: 450, y: 960, rx: 150, ry: 75 },
  huhn: { x: 860, y: 1110, rx: 110, ry: 50 },
  schaf:{ x: 1130, y: 1035, rx: 130, ry: 62 },
};

// Felder: Rasterplätze in Kaufreihenfolge
export const FELD_BREITE = 190;
export const FELDPLAETZE = [];
{
  const ordnung = [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[0,3],[1,3],[2,0],[2,1],[2,2],[2,3]];
  for (const [r, c] of ordnung) FELDPLAETZE.push({ x: 560 + (c - r) * 100, y: 430 + (c + r) * 54 });
}
export const START_FELDER = 6;
export const feldPreis = n => Math.min(600, 40 + (n - START_FELDER) * 30);
export const FELDER_MAX = 40;
export const FELD_R = 80;   // Platzbedarf eines Feldes

// Frei platzierbare Dinge (Bauen-Menü)
export const BAUTEN = {
  haus1:     { name: "Kleines Haus", bild: "haus1", breite: 165, r: 70, preis: 60,  level: 1, einwohner: 5,  xp: 8,  art: "haus" },
  haus2:     { name: "Großes Haus",  bild: "haus2", breite: 175, r: 72, preis: 160, level: 3, einwohner: 12, xp: 18, art: "haus" },
  busch:     { name: "Busch",        bild: "busch", breite: 70,  r: 30, preis: 10,  level: 1, xp: 1, art: "deko" },
  laubbaum:  { name: "Laubbaum",     bild: "laubbaum", breite: 120, r: 38, preis: 20, level: 1, xp: 2, art: "deko" },
  tanne:     { name: "Tanne",        bild: "tanne", breite: 90,  r: 30, preis: 20,  level: 1, xp: 2, art: "deko" },
  apfelbaum: { name: "Apfelbaum",    bild: "apfelbaum", breite: 120, r: 38, preis: 35, level: 2, xp: 3, art: "deko" },
  zaun:      { name: "Zaun",         bild: "zaun", breite: 90,   r: 28, preis: 5,   level: 1, xp: 1, art: "deko" },
  beet:      { name: "Blumenbeet",   bild: "beet", breite: 130,  r: 50, preis: 40,  level: 2, xp: 4, art: "deko" },
  teich:     { name: "Teich",        bild: "teich", breite: 190, r: 80, preis: 120, level: 3, xp: 10, art: "deko" },
  // nur über den Belohnungspfad der Insel freigeschaltet (insel: true)
  zelt:        { name: "Entdeckerzelt", bild: "zelt", breite: 160, r: 62, preis: 0, level: 1, xp: 5, art: "deko", insel: true },
  schatz:      { name: "Schatztruhe", bild: "truhe-offen", breite: 80, r: 34, preis: 0, level: 1, xp: 5, art: "deko", insel: true },
  felsen:      { name: "Moosfelsen", bild: "felsen", breite: 100, r: 42, preis: 0, level: 1, xp: 5, art: "deko", insel: true },
  entdeckerin: { name: "Entdeckerin", bild: "gastgeberin", breite: 90, r: 34, preis: 0, level: 1, xp: 10, art: "deko", insel: true },
};

export const WELT = { b: 2700, h: 2000 };
// See am Steg (Ellipse); dort kann nichts gebaut werden
export const SEE = { x: 1610, y: 1275, rx: 370, ry: 190 };

export const xpFuer = level => 20 + (level - 1) * 30;

export const SCHEUNE = { start: 60, plus: 30, preis: lvl => 80 * lvl };

export const FREISCHALTUNG = {
  2: ["Mais", "Bäckerei", "Hühnerstall", "Apfelbaum und Blumenbeet"],
  3: ["Karotten", "Molkerei", "Großes Haus", "Teich"],
  4: ["Schafweide", "Käse", "Brot mit Ei"],
};

// Welche Waren in Aufträgen vorkommen, je nach Level
export const AUFTRAGS_WAREN = {
  1: ["weizen", "milch", "futter"],
  2: ["mais", "ei", "brot"],
  3: ["karotte", "butter"],
  4: ["kaese", "wolle"],
};

export const SCHRITTE = [
  { text: "Tippe auf ein goldenes Weizenfeld und ernte es.", ereignis: "ernte", belohnung: 20 },
  { text: "Tippe auf die Futtermühle und stelle Futter her.", ereignis: "herstellen:futter", belohnung: 20 },
  { text: "Hol das Futter an der Mühle ab und füttere eine Kuh.", ereignis: "fuettern", belohnung: 20 },
  { text: "Sammle die Milch ein, wenn die Kuh fertig ist.", ereignis: "sammeln", belohnung: 20 },
  { text: "Tippe auf die Auftragstafel und liefere einen Auftrag.", ereignis: "liefern", belohnung: 50 },
  { text: "Baue über „Bauen“ ein kleines Haus.", ereignis: "bauen:haus", belohnung: 30 },
];

/* ================= Insel (Schritt 2) ================= */
export const WERKZEUGE = {
  axt:        { name: "Axt",        bild: "axt" },
  schaufel:   { name: "Schaufel",   bild: "schaufel" },
  spitzhacke: { name: "Spitzhacke", bild: "spitzhacke" },
};
export const INSEL_LEVEL = 2;          // ab diesem Level fährt das Boot
export const INSEL_KARTE = { b: 1800, h: 982 };
export const WERKZEUG_KISTE = { minuten: 8, max: 5 };   // freie Werkzeuge am Zelt

// Hindernisse: welches Werkzeug, Bild und Breite
export const HINDERNISSE = {
  dschungel: { werkzeug: "axt",        bild: "dschungel", breite: 130, text: "Dichter Busch" },
  stumpf:    { werkzeug: "schaufel",   bild: "stumpf",    breite: 105, text: "Baumstumpf" },
  felsen:    { werkzeug: "spitzhacke", bild: "felsen",    breite: 108, text: "Felsen" },
};

// Plätze auf der Inselkarte. art: start | dschungel | stumpf | felsen | bruecke
// nach: Plätze, von denen aus dieser erreichbar ist. truhe: hier liegt nach dem Freiräumen eine Truhe.
export const INSEL_PLAETZE = {
  lager: { art: "start", x: 1300, y: 715 },
  p1:  { art: "stumpf",    x: 1185, y: 712, nach: ["lager"] },
  p2:  { art: "dschungel", x: 1060, y: 712, nach: ["p1"] },
  b1:  { art: "bruecke",   x: 968,  y: 690, nach: ["p2"], kosten: { weizen: 4, futter: 2 }, name: "Holzbrücke" },
  p4:  { art: "dschungel", x: 880,  y: 615, nach: ["b1"], truhe: true },
  p5:  { art: "felsen",    x: 860,  y: 548, nach: ["p4"] },
  p6:  { art: "dschungel", x: 1005, y: 532, nach: ["p5"], truhe: true },
  b2:  { art: "bruecke",   x: 1152, y: 545, nach: ["p6"], kosten: { brot: 2, milch: 2 }, name: "Steinbrücke" },
  p8:  { art: "stumpf",    x: 1262, y: 560, nach: ["b2", "p9"] },
  p9:  { art: "felsen",    x: 1420, y: 625, nach: ["lager"] },
  p10: { art: "dschungel", x: 1360, y: 470, nach: ["p8", "p9"], truhe: true },
  p11: { art: "stumpf",    x: 1370, y: 345, nach: ["p10"] },
  p12: { art: "dschungel", x: 1255, y: 265, nach: ["p11"], truhe: true, ziel: "wasserfall" },
  p13: { art: "dschungel", x: 760,  y: 540, nach: ["p5"] },
  p14: { art: "stumpf",    x: 830,  y: 485, nach: ["p13"], truhe: true, ziel: "dorf" },
  p15: { art: "felsen",    x: 645,  y: 575, nach: ["p13"] },
  p16: { art: "dschungel", x: 525,  y: 560, nach: ["p15"] },
  p17: { art: "stumpf",    x: 462,  y: 450, nach: ["p16"] },
  p18: { art: "dschungel", x: 540,  y: 375, nach: ["p17"], truhe: true },
  p19: { art: "felsen",    x: 640,  y: 335, nach: ["p18"] },
  p20: { art: "dschungel", x: 730,  y: 255, nach: ["p19"] },
  p21: { art: "stumpf",    x: 830,  y: 225, nach: ["p20"], truhe: true },
  p24: { art: "dschungel", x: 900,  y: 775, nach: ["p2"] },
  p23: { art: "felsen",    x: 700,  y: 760, nach: ["p24"], truhe: true },
  p22: { art: "stumpf",    x: 530,  y: 715, nach: ["p23", "p16"] },
  p25: { art: "felsen",    x: 380,  y: 640, nach: ["p22"], truhe: true },
};
// Wie viele Werkzeuge ein Hindernis kostet (weiter innen mehr)
export const TIEFE_TEUER = ["p10", "p11", "p12", "p17", "p18", "p19", "p20", "p21", "p25", "p14"];

export const PUNKTE = { hindernis: 2, truhe: 5, bruecke: 10 };

// Quests: typ = was gezählt wird, n = wie oft
export const QUESTS = [
  { text: "Räume 3 dichte Büsche mit der Axt frei", textWinter: "Hacke 3 Eisbüsche mit der Axt frei", typ: "axt", n: 3, punkte: 8 },
  { text: "Grabe 2 Baumstümpfe mit der Schaufel aus", textWinter: "Schaufle 2 Schneehaufen weg", typ: "schaufel", n: 2, punkte: 6 },
  { text: "Repariere die Holzbrücke", typ: "bruecke:b1", n: 1, punkte: 12 },
  { text: "Gewinne ein Puzzle-Level", typ: "puzzle", n: 1, punkte: 8 },
  { text: "Zerschlage 2 Felsen mit der Spitzhacke", textWinter: "Zerschlage 2 Eisfelsen mit der Spitzhacke", typ: "spitzhacke", n: 2, punkte: 6 },
  { text: "Öffne 2 Schatztruhen", typ: "truhe", n: 2, punkte: 10 },
  { text: "Liefere 3 Aufträge auf dem Hof", typ: "auftrag", n: 3, punkte: 8 },
  { text: "Entdecke das alte Dorf", textWinter: "Finde die verschneite Blockhütte", typ: "ziel:dorf", n: 1, punkte: 15 },
  { text: "Repariere die Steinbrücke", typ: "bruecke:b2", n: 1, punkte: 15 },
  { text: "Räume 10 Hindernisse frei", typ: "hindernis", n: 10, punkte: 12 },
  { text: "Erreiche den Wasserfall", textWinter: "Erreiche den gefrorenen Wasserfall", typ: "ziel:wasserfall", n: 1, punkte: 18 },
  { text: "Öffne 4 Schatztruhen", typ: "truhe", n: 4, punkte: 14 },
  { text: "Gewinne 2 Puzzle-Level", typ: "puzzle", n: 2, punkte: 10 },
  { text: "Räume die ganze Insel frei", typ: "alles", n: 1, punkte: 30 },
];
export const AKTIVE_QUESTS = 3;

// Belohnungspfad: ab so vielen Punkten gibt es die Belohnung
export const PFAD = [
  { punkte: 10,  muenzen: 50 },
  { punkte: 25,  werkzeug: { axt: 2, schaufel: 2, spitzhacke: 2 } },
  { punkte: 45,  helfer: { hammer: 2 }, muenzen: 80 },
  { punkte: 70,  muenzen: 150, werkzeug: { spitzhacke: 2 } },
  { punkte: 100, helfer: { besen: 2, hammer: 1 } },
  { punkte: 140, muenzen: 300, werkzeug: { axt: 3, schaufel: 3 } },
  { punkte: 200, helfer: { regenbogen: 2, besen: 1 }, muenzen: 500 },
];

/* ================= Puzzle (Schritt 3) ================= */
export const STEINE = [
  { bild: "stein-rot", name: "Herzen" }, { bild: "stein-blau", name: "Tropfen" }, { bild: "stein-gruen", name: "Blätter" },
  { bild: "stein-gelb", name: "Sterne" }, { bild: "stein-lila", name: "Blüten" }, { bild: "stein-orange", name: "Würfel" },
];
export const BRETT = 8; // 8 × 8 Felder

// Karten: K = Kiste (blockiert, geht durch Treffer daneben kaputt), E = Eis unter dem Stein
const LEER = Array(8).fill("........");
const karte = zeilen => LEER.map((z, i) => zeilen[i] ?? z);
const KARTEN = {
  leer: LEER,
  kistenMitte: karte({ 3: "..KKKK..", 4: "..KKKK.." }),
  eisUnten: karte({ 6: "EEEEEEEE", 7: "EEEEEEEE" }),
  kistenSechs: karte({ 2: ".K....K.", 3: "...KK...", 5: ".K....K." }),
  eisKreuz: karte({ 0: "...E....", 1: "...E....", 2: "...E....", 3: "EEEEEEEE", 4: "...E....", 5: "...E....", 6: "...E....", 7: "...E...." }),
  kistenBand: karte({ 4: "KKKKKKKK", 5: "..KKKK.." }),
  gemischt: karte({ 2: "KK....KK", 3: "KK....KK", 6: "EEEEEEEE", 7: "EEEEEEEE" }),
  festung: karte({ 1: "..EEEE..", 3: ".KKKKKK.", 4: ".KKKKKK.", 6: "..EEEE..", 7: "..EEEE.." }),
  rahmen: karte({ 1: "E......E", 2: "E.KKKK.E", 5: "E.KKKK.E", 6: "E......E", 7: "EEEEEEEE" }),
};
const LEVELS = [
  { farben: 5, zuege: 20, karte: "leer", steine: { 0: 12, 1: 12 } },
  { farben: 5, zuege: 18, karte: "leer", steine: { 2: 20 } },
  { farben: 5, zuege: 22, karte: "kistenMitte", steine: {} },
  { farben: 5, zuege: 22, karte: "eisUnten", steine: {} },
  { farben: 6, zuege: 24, karte: "kistenSechs", steine: { 3: 15 } },
  { farben: 6, zuege: 25, karte: "eisKreuz", steine: { 4: 12 } },
  { farben: 5, zuege: 22, karte: "kistenBand", steine: {} },
  { farben: 6, zuege: 26, karte: "gemischt", steine: {} },
  { farben: 6, zuege: 24, karte: "leer", steine: { 0: 20, 5: 20 } },
  { farben: 6, zuege: 28, karte: "festung", steine: {} },
  { farben: 6, zuege: 26, karte: "rahmen", steine: { 1: 15 } },
];
// Ab Level 12 wiederholen sich die Karten mit mehr Steinen
export function puzzleLevel(n) {
  if (n <= LEVELS.length) { const L = LEVELS[n - 1]; return { ...L, karte: KARTEN[L.karte] }; }
  const namen = Object.keys(KARTEN), k = namen[(n * 7) % namen.length];
  const steine = {}; steine[n % 6] = 12 + Math.min(18, n); if (n % 2) steine[(n + 2) % 6] = 10 + Math.min(14, n);
  return { farben: 6, zuege: 24 + (n % 4), karte: KARTEN[k], steine };
}
export const PUZZLE_LOHN = n => ({ muenzen: 30 + n * 5, werkzeuge: 2 + (n % 3 === 0 ? 1 : 0), punkte: 5 });

/* ================= Paket A: Helfer, Tagesbelohnung, Eilaufträge, Ausbau, Dickicht ================= */
// Puzzle-Helfer. bild = Gemini-Bild (kommt noch), zeichen = Ersatz, solange das Bild fehlt
export const HELFER = {
  hammer:     { name: "Hammer",     bild: "i-hammer",     zeichen: "🔨", text: "Zerschlägt ein Feld deiner Wahl" },
  besen:      { name: "Besen",      bild: "i-besen",      zeichen: "🧹", text: "Fegt eine ganze Reihe leer" },
  regenbogen: { name: "Regenbogen", bild: "i-regenbogen", zeichen: "🌈", text: "Entfernt alle Steine einer Farbe" },
};
export const START_HELFER = { hammer: 1, besen: 1, regenbogen: 1 };

// Tagesbelohnung: Tag 1 bis 7, danach von vorn. Wer einen Tag auslässt, fängt wieder bei Tag 1 an.
export const TAGESLOHN = [
  { muenzen: 50 },
  { werkzeug: 2 },
  { helfer: { hammer: 1 }, muenzen: 30 },
  { muenzen: 100 },
  { werkzeug: 3 },
  { helfer: { besen: 1 }, muenzen: 50 },
  { muenzen: 200, werkzeug: 3, helfer: { regenbogen: 1 }, truhe: true },
];

// Eilaufträge: großer Auftrag mit Zeitlimit, ab Level 2
export const EIL = { level: 2, dauerMin: 120, pauseMin: 45, faktor: 2.2 };

// Ausbau: Fabriken bis Stufe 3 (mehr Plätze, schneller), Ställe bis Stufe 3 (mehr Tiere)
export const AUSBAU = {
  maxStufe: 3,
  fabrikPreis: (stufe) => 150 * stufe,
  fabrikWerkzeug: (stufe) => stufe,          // so viele Spitzhacken und Äxte zusätzlich
  plaetze: (stufe) => 2 + stufe,             // Stufe 1: 3, Stufe 2: 4, Stufe 3: 5
  tempo: (stufe) => 1 - (stufe - 1) * 0.15,  // Stufe 2: 15 % schneller, Stufe 3: 30 %
  stallPreis: (stufe) => 120 * stufe,
  stallPlus: 2,
};

// Dickicht am Hofrand: freiräumen gibt Platz zum Bauen
export const DICKICHT = [
  { id: "nordwest", x: 430, y: 180, rx: 150, ry: 70,  level: 2, muenzen: 80,  werkzeug: { axt: 2 } },
  { id: "west",     x: 100, y: 800, rx: 90,  ry: 75,  level: 3, muenzen: 150, werkzeug: { axt: 2, schaufel: 1 } },
  { id: "nordost",  x: 1640, y: 210, rx: 140, ry: 90, level: 4, muenzen: 250, werkzeug: { axt: 3, spitzhacke: 1 } },
  { id: "suedwest", x: 340, y: 1270, rx: 170, ry: 80, level: 5, muenzen: 350, werkzeug: { axt: 3, schaufel: 2 } },
  { id: "ost",      x: 1700, y: 820, rx: 110, ry: 90,  level: 6, muenzen: 500, werkzeug: { axt: 4, spitzhacke: 2 } },
  { id: "fernost",  x: 2480, y: 300, rx: 170, ry: 90,  level: 8, muenzen: 700, werkzeug: { axt: 4, schaufel: 3 } },
  { id: "fernsued", x: 600, y: 1880, rx: 180, ry: 80,  level: 9, muenzen: 900, werkzeug: { axt: 5, spitzhacke: 3 } },
];

/* ================= Paket B: neue Waren, Fabriken, Apfelbäume, Bewohner, Puzzle-Karte ================= */
Object.assign(WAREN, {
  apfel:    { name: "Apfel",       icon: "i-apfel",    wert: 6 },
  honig:    { name: "Honig",       icon: "i-honig",    wert: 12 },
  saft:     { name: "Karottensaft", icon: "i-saft",    wert: 20 },
  suppe:    { name: "Maissuppe",   icon: "i-suppe",    wert: 26 },
  muetze:   { name: "Mütze",       icon: "i-muetze",   wert: 30 },
  pullover: { name: "Pullover",    icon: "i-pullover", wert: 52 },
  kekse:    { name: "Kekse",       icon: "i-kekse",    wert: 34 },
  kuchen:   { name: "Kuchen",      icon: "i-kuchen",   wert: 60 },
});
Object.assign(FABRIKEN, {
  imkerei: { name: "Imkerei", bild: "imkerei", rezepte: [
    { ware: "honig", menge: 1, zutaten: { apfel: 1 }, zeit: 60, level: 5 },
    { ware: "honig", menge: 3, zutaten: { apfel: 2, weizen: 2 }, zeit: 120, level: 6 },
  ]},
  saftbar: { name: "Saftbar", bild: "saftbar", rezepte: [
    { ware: "saft", menge: 1, zutaten: { karotte: 3 }, zeit: 50, level: 5 },
    { ware: "suppe", menge: 1, zutaten: { mais: 2, milch: 1 }, zeit: 75, level: 5 },
  ]},
  schneiderei: { name: "Schneiderei", bild: "schneiderei", rezepte: [
    { ware: "muetze", menge: 1, zutaten: { wolle: 2 }, zeit: 80, level: 6 },
    { ware: "pullover", menge: 1, zutaten: { wolle: 3, honig: 1 }, zeit: 130, level: 7 },
  ]},
  konditorei: { name: "Konditorei", bild: "konditorei", rezepte: [
    { ware: "kekse", menge: 2, zutaten: { weizen: 3, butter: 1 }, zeit: 70, level: 7 },
    { ware: "kuchen", menge: 1, zutaten: { weizen: 2, ei: 2, apfel: 2, honig: 1 }, zeit: 110, level: 8 },
  ]},
});
Object.assign(GEBAEUDE, {
  imkerei:     { name: "Imkerei", bild: "imkerei", x: 760, y: 300, breite: 190, r: 80, level: 5, preis: 400, einwohner: 45 },
  saftbar:     { name: "Saftbar", bild: "saftbar", x: 1520, y: 1000, breite: 185, r: 78, level: 5, preis: 450, einwohner: 50 },
  schneiderei: { name: "Schneiderei", bild: "schneiderei", x: 1530, y: 560, breite: 185, r: 78, level: 6, preis: 600, einwohner: 60 },
  konditorei:  { name: "Konditorei", bild: "konditorei", x: 640, y: 840, breite: 185, r: 78, level: 7, preis: 800, einwohner: 75 },
});
FREISCHALTUNG[5] = ["Imkerei mit Honig", "Saftbar mit Karottensaft und Maissuppe", "Äpfel von den Apfelbäumen"];
FREISCHALTUNG[6] = ["Schneiderei mit Mützen"];
FREISCHALTUNG[7] = ["Pullover", "Konditorei mit Keksen"];
FREISCHALTUNG[8] = ["Kuchen"];
AUFTRAGS_WAREN[5] = ["apfel", "honig", "saft", "suppe"];
AUFTRAGS_WAREN[6] = ["muetze"];
AUFTRAGS_WAREN[7] = ["pullover", "kekse"];
AUFTRAGS_WAREN[8] = ["kuchen"];

// Apfelbäume (aus dem Bauen-Menü) tragen ab Level 5 Äpfel
export const APFEL = { level: 5, zeit: 150, ertrag: 2 };

// Bewohner mit Wünschen. Jeder erfüllte Wunsch bringt ein Herz; bei jedem Herz gibt es die Freundschaftsbelohnung.
export const BEWOHNER = {
  opa:        { name: "Opa Willi", bild: "opa", level: 1, x: 520, y: 640,
                text: "Ich habe diesen Hof aufgebaut, als ich jung war. Schön, dass jetzt wieder Leben hier ist!",
                waren: ["weizen", "mais", "karotte", "apfel"], lohn: { werkzeug: 2 } },
  baeckerin:  { name: "Bäckerin Rosi", bild: "baeckerin", level: 2, x: 1105, y: 680,
                text: "Mein Ofen ist heiß! Bringst du mir Zutaten, backe ich dir etwas Feines.",
                waren: ["weizen", "milch", "ei", "butter", "brot"], lohn: { helfer: "hammer" } },
  maedchen:   { name: "Lotte", bild: "maedchen", level: 3, x: 840, y: 980,
                text: "Ich liebe Tiere! Darf ich nachher die Kühe streicheln?",
                waren: ["ei", "milch", "apfel", "honig", "kekse"], lohn: { muenzen: 120 } },
  handwerker: { name: "Handwerker Karl", bild: "handwerker", level: 4, x: 1400, y: 440,
                text: "Ein Hof ist nie fertig. Irgendwo knarzt immer eine Tür!",
                waren: ["wolle", "brot", "kaese", "muetze", "saft"], lohn: { helfer: "besen", werkzeug: 1 } },
};
export const BEWOHNER_PAUSE_MIN = 12;   // so lange bis zum nächsten Wunsch
export const HERZ_MAX = 10;

// Puzzle-Karte: Mittelpunkte der Steine auf dem Bild „puzzle-weg“ (1116 × 2000), von unten nach oben
export const PUZZLE_WEG = { b: 1116, h: 2000, bilder: ["puzzle-weg", "puzzle-weg-winter"], steine: [
  [497, 1912], [607, 1832], [717, 1757], [733, 1688], [602, 1638], [487, 1630], [482, 1574], [591, 1548], [690, 1515], [720, 1447],
  [636, 1415], [537, 1405], [405, 1378], [318, 1293], [345, 1220], [406, 1177], [474, 1147], [562, 1128], [614, 1078], [560, 1042],
  [487, 1023], [447, 975], [490, 930], [575, 905], [657, 868], [698, 815], [655, 768], [595, 750], [525, 713], [525, 660],
  [565, 622], [507, 588], [455, 557], [461, 512], [510, 492], [557, 467], [617, 440], [668, 372], [617, 320], [533, 278], [577, 228],
] };

/* ================= Paket C: Schneeinsel ================= */
export const WELTEN = {
  sommer: { name: "Abenteuerinsel", karte: "insel", meer: "#2fa7b8", level: 2, schatz: 1, hindernisse: {},
    begruessung: "Hallo, ich bin Mila! Der Dschungel hat alle Wege zugewuchert. Mit Axt, Schaufel und Spitzhacke räumst du sie frei. Dahinter warten Schätze und ein altes Dorf.",
    ziele: { dorf: "Du hast das alte Dorf entdeckt!", wasserfall: "Was für ein Ausblick: der Wasserfall!" },
    fertig: "Fantastisch, du hast jede Ecke freigeräumt! Wenn du magst, wächst der Dschungel nach und wir legen neue Schätze aus." },
  winter: { name: "Schneeinsel", karte: "schneeinsel", meer: "#5fc6cf", level: 8, schatz: 1.8,
    hindernisse: {
      dschungel: { werkzeug: "axt",        bild: "eisbusch",    breite: 118, text: "Eisbusch" },
      stumpf:    { werkzeug: "schaufel",   bild: "schneehaufen", breite: 120, text: "Schneehaufen" },
      felsen:    { werkzeug: "spitzhacke", bild: "eisfelsen",   breite: 100, text: "Eisfelsen" },
    },
    begruessung: "Brrr, ist das kalt! Über Nacht hat der Schnee die ganze Insel zugedeckt. Schaufle die Wege frei, hacke das Eis auf und such die versteckten Truhen. Hier sind die Schätze besonders wertvoll!",
    ziele: { dorf: "Da ist sie: die gemütliche Blockhütte!", wasserfall: "Der Wasserfall ist zu glitzerndem Eis gefroren!" },
    fertig: "Die ganze Schneeinsel ist frei! Wenn du magst, schneit es noch einmal und wir suchen neue Schätze." },
};

/* ================= Paket C: Jahreszeiten-Events (Belohnungen ohne Deko) ================= */
export const EVENTS = {
  fruehling: { monate: [3, 4, 5],   name: "Osterfest",    token: "i-osterei",      mehrzahl: "Ostereier",     text: "Die Hasen haben überall Ostereier versteckt!" },
  sommer:    { monate: [6, 7, 8],   name: "Sommerfest",   token: "i-geschenk",     mehrzahl: "Geschenke",     text: "Zum Sommerfest liegen überall kleine Geschenke herum!" },
  herbst:    { monate: [9, 10, 11], name: "Kürbisfest",   token: "i-kuerbis",      mehrzahl: "Kürbisse",      text: "Erntezeit! Sammle Kürbisse für das große Kürbisfest." },
  winter:    { monate: [12, 1, 2],  name: "Winterzauber", token: "i-schneeflocke", mehrzahl: "Schneeflocken", text: "Es schneit! Fang die glitzernden Schneeflocken ein." },
};
// Stufen: ab so vielen gesammelten Teilen gibt es die Belohnung (Münzen, Werkzeuge, Puzzle-Helfer)
export const EVENT_STUFEN = [
  { n: 10,  muenzen: 100 },
  { n: 25,  werkzeug: 3, helfer: { hammer: 1 } },
  { n: 45,  muenzen: 250 },
  { n: 70,  helfer: { besen: 1, regenbogen: 1 } },
  { n: 100, muenzen: 400, werkzeug: 5 },
  { n: 140, helfer: { hammer: 2, besen: 2, regenbogen: 2 } },
  { n: 200, muenzen: 1000, werkzeug: 8, helfer: { regenbogen: 3 } },
];
// Wie viele Teile es wofür gibt
export const EVENT_QUELLEN = { ernteChance: .25, auftrag: 3, eil: 10, wunsch: 5, tag: 5, puzzle: 4, truhe: 3, fundstueck: 2 };
export const FUNDSTUECK = { minuten: 3, max: 3 };   // so oft liegt ein Teil irgendwo auf dem Hof

/* ================= Paket D: Markt, Erfolge, Lieferwagen-Touren ================= */
export const MARKT = {
  verkauf: .5,             // Anteil vom Warenwert beim normalen Verkauf
  sonderFaktor: 2,         // Händler kauft heute bestimmte Waren zum doppelten Preis
  kaufFaktor: 2.5,         // Händler verkauft eine seltene Ware zu diesem Faktor
  sonderAnzahl: 2,
};

// Erfolge mit Stufen. wert: woher die Zahl kommt (Zähler im Spielstand oder berechnet)
export const ERFOLGE = [
  { id: "ernte",     name: "Fleißige Ernte",    text: n => `Ernte ${n} Mal Felder oder Bäume`, stufen: [25, 150, 600, 2000] },
  { id: "tiere",     name: "Tierfreundin",      text: n => `Sammle ${n} Mal bei Tieren ein`,  stufen: [20, 120, 500, 1500] },
  { id: "fabrik",    name: "Fabrikchefin",      text: n => `Hole ${n} fertige Waren aus Fabriken ab`, stufen: [20, 120, 500, 1500] },
  { id: "liefern",   name: "Zuverlässig",       text: n => `Liefere ${n} Aufträge`,           stufen: [10, 50, 200, 600] },
  { id: "eil",       name: "Blitzschnell",      text: n => `Schaffe ${n} Eilaufträge`,        stufen: [1, 5, 20, 60] },
  { id: "tour",      name: "Auf Achse",         text: n => `Schicke den Lieferwagen ${n} Mal voll beladen los`, stufen: [1, 5, 20, 60] },
  { id: "herzen",    name: "Gute Nachbarin",    text: n => `Sammle insgesamt ${n} Herzen bei den Bewohnern`, stufen: [5, 15, 30, 40] },
  { id: "puzzle",    name: "Steinreich",        text: n => `Gewinne ${n} Puzzle-Level`,       stufen: [5, 25, 80, 200] },
  { id: "sterne",    name: "Sternensammlerin",  text: n => `Hole in ${n} Puzzle-Leveln 3 Sterne`, stufen: [3, 15, 50, 120] },
  { id: "hindernis", name: "Entdeckerin",       text: n => `Räume ${n} Hindernisse auf den Inseln frei`, stufen: [10, 40, 120, 300] },
  { id: "einwohner", name: "Wachsender Hof",    text: n => `Erreiche ${n} Einwohner`,          stufen: [25, 75, 150, 300] },
  { id: "level",     name: "Erfahren",          text: n => `Erreiche Level ${n}`,              stufen: [5, 10, 15, 25] },
];
export const ERFOLG_LOHN = [
  { muenzen: 100, werkzeug: 2 },
  { muenzen: 300, helfer: { hammer: 1 } },
  { muenzen: 800, werkzeug: 5, helfer: { besen: 1 } },
  { muenzen: 2000, helfer: { regenbogen: 2, hammer: 1 } },
];

// Lieferwagen-Touren: 6 Kisten füllen, dann losschicken
export const TOUR = { level: 3, kisten: 6, fahrtMin: 45, x: 1830, y: 880, breite: 170 };

/* ================= Paket D: Schweine und Ziegen ================= */
Object.assign(WAREN, {
  trueffel:    { name: "Trüffel",     icon: "i-trueffel",    wert: 18 },
  ziegenmilch: { name: "Ziegenmilch", icon: "i-ziegenmilch", wert: 11 },
  ziegenkaese: { name: "Ziegenkäse",  icon: "i-ziegenkaese", wert: 40 },
  joghurt:     { name: "Joghurt",     icon: "i-joghurt",     wert: 32 },
});
Object.assign(TIERE, {
  schwein: { name: "Schwein", mehrzahl: "Schweine", bild: "schwein", breite: 92, zeit: 100, ware: "trueffel", xp: 4, preis: 160, max: 4, stall: "schweinestall" },
  ziege:   { name: "Ziege",   mehrzahl: "Ziegen",   bild: "ziege",   breite: 86, zeit: 70,  ware: "ziegenmilch", xp: 3, preis: 140, max: 4, stall: "ziegenstall" },
});
Object.assign(GEBAEUDE, {
  schweinestall: { name: "Schweinestall", bild: "schweinestall", x: 2230, y: 1090, breite: 200, r: 85, level: 6, preis: 500, einwohner: 55 },
  ziegenstall:   { name: "Ziegenstall",   bild: "ziegenstall",   x: 2230, y: 1470, breite: 200, r: 85, level: 7, preis: 650, einwohner: 70 },
});
Object.assign(WEIDEN, {
  schwein: { x: 2440, y: 1150, rx: 120, ry: 60 },
  ziege:   { x: 2450, y: 1520, rx: 120, ry: 58 },
});
FABRIKEN.molkerei.rezepte.push(
  { ware: "ziegenkaese", menge: 1, zutaten: { ziegenmilch: 3 }, zeit: 90, level: 7 },
  { ware: "joghurt", menge: 2, zutaten: { ziegenmilch: 2, apfel: 1 }, zeit: 80, level: 7 },
);
FREISCHALTUNG[6] = [...(FREISCHALTUNG[6] || []), "Schweinestall: Schweine finden Trüffel"];
FREISCHALTUNG[7] = [...(FREISCHALTUNG[7] || []), "Ziegenstall mit Ziegenmilch", "Ziegenkäse und Joghurt in der Molkerei"];
AUFTRAGS_WAREN[6] = [...(AUFTRAGS_WAREN[6] || []), "trueffel"];
AUFTRAGS_WAREN[7] = [...(AUFTRAGS_WAREN[7] || []), "ziegenmilch", "ziegenkaese", "joghurt"];

/* ================= Häuser ausbauen ================= */
// Einwohner pro Stufe als Vielfaches der Grundzahl; Ausbau kostet Münzen (und ab Stufe 3 Werkzeug)
export const HAUS_STUFEN = [
  { faktor: 1 },
  { faktor: 2,   level: 2, preis: 2.5 },
  { faktor: 3.2, level: 4, preis: 5, werkzeug: { axt: 1, spitzhacke: 1 } },
  { faktor: 4.6, level: 6, preis: 9, werkzeug: { axt: 2, spitzhacke: 2 } },
  { faktor: 6.2, level: 8, preis: 14, werkzeug: { axt: 3, spitzhacke: 3, schaufel: 2 } },
];
export const ABRISS_ERSTATTUNG = .5;

/* ================= Obsthof (zweites Grundstück hinter dem Fluss) ================= */
export const OBSTHOF = { level: 10, preis: 2500, grenze: 2700, fluss: [2700, 2800], bruecke: { x: 2750, y: 1000 } };
WELT.b = 3900;

Object.assign(WAREN, {
  erdbeere:    { name: "Erdbeere",         icon: "i-erdbeere",    wert: 9 },
  sonnenblume: { name: "Sonnenblumenkerne", icon: "i-kerne",      wert: 8 },
  traube:      { name: "Trauben",          icon: "i-traube",      wert: 11 },
  kirsche:     { name: "Kirschen",         icon: "i-kirsche",     wert: 10 },
  birne:       { name: "Birne",            icon: "i-birne",       wert: 9 },
  marmelade:   { name: "Marmelade",        icon: "i-marmelade",   wert: 45 },
  traubensaft: { name: "Traubensaft",      icon: "i-traubensaft", wert: 42 },
  oel:         { name: "Sonnenblumenöl",   icon: "i-oel",         wert: 38 },
});
Object.assign(PFLANZEN, {
  erdbeere:    { zeit: 90,  ertrag: 2, xp: 3, level: 10, bild: "feld-reif-erdbeere" },
  sonnenblume: { zeit: 120, ertrag: 3, xp: 3, level: 10, bild: "feld-reif-sonnenblume", name: "Sonnenblumen" },
  traube:      { zeit: 160, ertrag: 2, xp: 4, level: 11, bild: "feld-reif-traube" },
});
// Obstbäume: aus dem Bauen-Menü, tragen ab ihrem Level Früchte
export const FRUCHT = {
  apfelbaum:  { ware: "apfel",   level: APFEL.level, zeit: APFEL.zeit, ertrag: APFEL.ertrag, name: "Äpfel" },
  kirschbaum: { ware: "kirsche", level: 10, zeit: 200, ertrag: 2, name: "Kirschen" },
  birnbaum:   { ware: "birne",   level: 11, zeit: 240, ertrag: 2, name: "Birnen" },
};
Object.assign(BAUTEN, {
  kirschbaum: { name: "Kirschbaum", bild: "kirschbaum", breite: 120, r: 38, preis: 60, level: 10, xp: 4, art: "deko" },
  birnbaum:   { name: "Birnbaum",   bild: "birnbaum",   breite: 120, r: 38, preis: 70, level: 11, xp: 4, art: "deko" },
});
Object.assign(FABRIKEN, {
  marmeladenkueche: { name: "Marmeladenküche", bild: "marmeladenkueche", rezepte: [
    { ware: "marmelade", menge: 1, zutaten: { erdbeere: 4 }, zeit: 90, level: 10 },
    { ware: "marmelade", menge: 2, zutaten: { kirsche: 3, birne: 2 }, zeit: 120, level: 11 },
  ]},
  kelterei: { name: "Kelterei", bild: "kelterei", rezepte: [
    { ware: "traubensaft", menge: 1, zutaten: { traube: 4 }, zeit: 100, level: 11 },
  ]},
  oelmuehle: { name: "Ölmühle", bild: "oelmuehle", rezepte: [
    { ware: "oel", menge: 1, zutaten: { sonnenblume: 5 }, zeit: 90, level: 12 },
  ]},
});
Object.assign(GEBAEUDE, {
  marmeladenkueche: { name: "Marmeladenküche", bild: "marmeladenkueche", x: 3150, y: 720,  breite: 200, r: 85, level: 10, preis: 900,  einwohner: 90,  obsthof: true },
  kelterei:         { name: "Kelterei",        bild: "kelterei",         x: 3550, y: 1080, breite: 200, r: 85, level: 11, preis: 1100, einwohner: 110, obsthof: true },
  oelmuehle:        { name: "Ölmühle",         bild: "oelmuehle",        x: 3150, y: 1460, breite: 200, r: 85, level: 12, preis: 1300, einwohner: 130, obsthof: true },
});
FREISCHALTUNG[10] = ["Obsthof hinter dem Fluss", "Erdbeeren und Sonnenblumen", "Kirschbaum", "Marmeladenküche"];
FREISCHALTUNG[11] = ["Weintrauben", "Birnbaum", "Kelterei"];
FREISCHALTUNG[12] = ["Ölmühle mit Sonnenblumenöl"];
AUFTRAGS_WAREN[10] = ["erdbeere", "sonnenblume", "kirsche", "marmelade"];
AUFTRAGS_WAREN[11] = ["traube", "birne", "traubensaft"];
AUFTRAGS_WAREN[12] = ["oel"];

/* ================= Größere Inseln mit Nebel und Sonderstationen ================= */
export const INSEL_F = 1.7;   // Inselkarten werden um diesen Faktor größer dargestellt
INSEL_KARTE.b = Math.round(INSEL_KARTE.b * INSEL_F); INSEL_KARTE.h = Math.round(INSEL_KARTE.h * INSEL_F);
for (const P of Object.values(INSEL_PLAETZE)) { P.x = Math.round(P.x * INSEL_F); P.y = Math.round(P.y * INSEL_F); }
for (const H of Object.values(HINDERNISSE)) H.breite = Math.round(H.breite * 1.3);
for (const W of Object.values(WELTEN)) for (const H of Object.values(W.hindernisse)) H.breite = Math.round(H.breite * 1.3);
// Sonderstationen: statt Werkzeug ein kleines Spiel
export const SONDER = {
  wimmel:  { name: "Wimmelbild", zeichen: "🔍", text: "Finde die versteckten Dinge" },
  memory:  { name: "Memory",     zeichen: "🃏", text: "Finde alle Paare" },
  raetsel: { name: "Puzzle-Tor", zeichen: "🧩", text: "Gewinne ein Puzzle-Level, dann öffnet sich das Tor" },
};
// Zwischen zwei Plätze kommt jeweils ein weiterer Platz, damit die Wege länger werden
{
  const arten = ["dschungel", "stumpf", "felsen"], sonder = ["wimmel", "raetsel", "memory"];
  let k = 0;
  for (const [id, P] of Object.entries({ ...INSEL_PLAETZE })) {
    if (!P.nach || P.art === "bruecke") continue;
    const von = P.nach[0], A = INSEL_PLAETZE[von];
    if (!A || Math.hypot(A.x - P.x, A.y - P.y) < 150) continue;
    const mid = "m_" + id;
    INSEL_PLAETZE[mid] = { art: k % 3 === 2 ? sonder[Math.floor(k / 3) % 3] : arten[k % 3], x: Math.round((A.x + P.x) / 2), y: Math.round((A.y + P.y) / 2), nach: [von] };
    P.nach = P.nach.map(n => n === von ? mid : n);
    k++;
  }
}

/* ================= Event: Festaufgaben und endlose Bonusstufen ================= */
// Festaufgaben: zählen ab dem Moment, in dem die Aufgabe erscheint. Jede neue Aufgabe wird etwas schwerer.
export const EVENT_AUFGABEN = [
  { typ: "liefern",   n: 5,  lohn: 15, text: n => `Liefere ${n} Aufträge` },
  { typ: "ernte",     n: 30, lohn: 12, text: n => `Ernte ${n} Mal` },
  { typ: "tiere",     n: 15, lohn: 10, text: n => `Sammle ${n} Mal bei Tieren ein` },
  { typ: "fabrik",    n: 15, lohn: 12, text: n => `Hole ${n} Waren aus Fabriken ab` },
  { typ: "puzzle",    n: 3,  lohn: 15, text: n => `Gewinne ${n} Puzzle-Level` },
  { typ: "hindernis", n: 6,  lohn: 12, text: n => `Räume ${n} Hindernisse auf den Inseln frei` },
  { typ: "tour",      n: 1,  lohn: 20, text: n => `Schicke den Lieferwagen ${n === 1 ? "einmal" : n + " Mal"} voll beladen los` },
];
export const EVENT_AUFGABEN_AKTIV = 3;
// Nach der letzten festen Stufe: alle so viele Teile eine Bonusstufe
export const EVENT_BONUS_ABSTAND = 60;
export const eventBonusLohn = b => ({ muenzen: 300 + 150 * b, werkzeug: 3 + b, helfer: { [["hammer", "besen", "regenbogen"][b % 3]]: 1 + Math.floor(b / 3) } });
