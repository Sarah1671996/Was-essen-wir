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
export const feldPreis = n => 40 + (n - START_FELDER) * 30;

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

export const WELT = { b: 1800, h: 1400 };

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
  { text: "Räume 3 dichte Büsche mit der Axt frei", typ: "axt", n: 3, punkte: 8 },
  { text: "Grabe 2 Baumstümpfe mit der Schaufel aus", typ: "schaufel", n: 2, punkte: 6 },
  { text: "Repariere die Holzbrücke", typ: "bruecke:b1", n: 1, punkte: 12 },
  { text: "Gewinne ein Puzzle-Level", typ: "puzzle", n: 1, punkte: 8 },
  { text: "Zerschlage 2 Felsen mit der Spitzhacke", typ: "spitzhacke", n: 2, punkte: 6 },
  { text: "Öffne 2 Schatztruhen", typ: "truhe", n: 2, punkte: 10 },
  { text: "Liefere 3 Aufträge auf dem Hof", typ: "auftrag", n: 3, punkte: 8 },
  { text: "Entdecke das alte Dorf", typ: "ziel:dorf", n: 1, punkte: 15 },
  { text: "Repariere die Steinbrücke", typ: "bruecke:b2", n: 1, punkte: 15 },
  { text: "Räume 10 Hindernisse frei", typ: "hindernis", n: 10, punkte: 12 },
  { text: "Erreiche den Wasserfall", typ: "ziel:wasserfall", n: 1, punkte: 18 },
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
  { id: "west",     x: 100, y: 800, rx: 85,  ry: 120, level: 3, muenzen: 150, werkzeug: { axt: 2, schaufel: 1 } },
  { id: "nordost",  x: 1640, y: 210, rx: 140, ry: 90, level: 4, muenzen: 250, werkzeug: { axt: 3, spitzhacke: 1 } },
  { id: "suedwest", x: 340, y: 1270, rx: 170, ry: 80, level: 5, muenzen: 350, werkzeug: { axt: 3, schaufel: 2 } },
  { id: "ost",      x: 1700, y: 830, rx: 90,  ry: 140, level: 6, muenzen: 500, werkzeug: { axt: 4, spitzhacke: 2 } },
];
