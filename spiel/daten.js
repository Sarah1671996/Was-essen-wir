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
  { text: "Zerschlage 2 Felsen mit der Spitzhacke", typ: "spitzhacke", n: 2, punkte: 6 },
  { text: "Öffne 2 Schatztruhen", typ: "truhe", n: 2, punkte: 10 },
  { text: "Liefere 3 Aufträge auf dem Hof", typ: "auftrag", n: 3, punkte: 8 },
  { text: "Entdecke das alte Dorf", typ: "ziel:dorf", n: 1, punkte: 15 },
  { text: "Repariere die Steinbrücke", typ: "bruecke:b2", n: 1, punkte: 15 },
  { text: "Räume 10 Hindernisse frei", typ: "hindernis", n: 10, punkte: 12 },
  { text: "Erreiche den Wasserfall", typ: "ziel:wasserfall", n: 1, punkte: 18 },
  { text: "Öffne 4 Schatztruhen", typ: "truhe", n: 4, punkte: 14 },
  { text: "Räume die ganze Insel frei", typ: "alles", n: 1, punkte: 30 },
];
export const AKTIVE_QUESTS = 3;

// Belohnungspfad: ab so vielen Punkten gibt es die Belohnung
export const PFAD = [
  { punkte: 10,  muenzen: 50 },
  { punkte: 25,  werkzeug: { axt: 2, schaufel: 2, spitzhacke: 2 } },
  { punkte: 45,  deko: "zelt", text: "Deko: Entdeckerzelt" },
  { punkte: 70,  muenzen: 150, werkzeug: { spitzhacke: 2 } },
  { punkte: 100, deko: "schatz", text: "Deko: Schatztruhe" },
  { punkte: 140, muenzen: 300, deko: "felsen", text: "Deko: Moosfelsen" },
  { punkte: 200, deko: "entdeckerin", text: "Deko: Statue der Entdeckerin", muenzen: 500 },
];
