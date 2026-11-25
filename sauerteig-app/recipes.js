// Rezepte und Mengen. Reine Funktionen, getestet in app.test.mjs.
// Eingebaute Brote stehen in Bäckerprozenten (Mehl = 100 %). gf = glutenfrei: eigener Ablauf ohne Dehnen & Falten.
export const BREADS = {
  klassisch: {
    name:"Klassisch", hint:"Helles Landbrot, knusprig",
    flours:[["Weizenmehl Type 550",80],["Weizenvollkornmehl",20]],
    liquids:[["Wasser (ca. 30 °C)",72]], starter:20, salt:2,
    extras:[], bulk:1, bake:[[250,20,true],[230,25,false]],
    notes:"Gut für den Einstieg. Wenn der Teig klebt, nasse Hände beim Falten."
  },
  kraeuterbutter: {
    name:"Kräuterbutter", hint:"Mit Butterspirale gefüllt",
    flours:[["Weizenmehl Type 550",100]],
    liquids:[["Wasser (ca. 30 °C)",66]], starter:20, salt:1.8,
    extras:[{g:"Kräuterbutter",items:[["Butter, weich",12],["Frische Kräuter (Petersilie, Schnittlauch), gehackt",4],["Knoblauch, gepresst",1.2],["Salz (für die Butter)",0.3]]}],
    bulk:1.05, bake:[[240,20,true],[220,25,false]], shape:25,
    prep:[
      {ref:"shape",min:-75,title:"Kräuterbutter anrühren",det:"Butter mit Kräutern, Knoblauch und Salz verrühren. Bei Raumtemperatur weich werden lassen."},
      {ref:"end",min:5,title:"Mit Kräuterbutter bestreichen",det:"Etwa ein Drittel der Kräuterbutter für die heiße Kruste aufheben und direkt nach dem Backen aufstreichen."}
    ],
    shapeDet:"Teig rechteckig ausziehen, 2/3 der Kräuterbutter aufstreichen, von der langen Seite aufrollen und mit Spannung formen.",
    notes:"Weniger Wasser als üblich, weil die Butter den Teig weicher macht. Etwas niedriger backen, damit die Butter nicht verbrennt."
  },
  schoko: {
    name:"Kinderschokolade", hint:"Süß, mit Schokostücken",
    flours:[["Weizenmehl Type 550",100]],
    liquids:[["Wasser (ca. 30 °C)",48],["Milch",16]], starter:22, salt:1.6,
    extras:[
      {g:"Süße Zutaten",items:[["Zucker",6],["Butter, weich",5]]},
      {g:"Einarbeiten beim 1. Falten",items:[["Kinderschokolade, grob gehackt & kalt",25]]}
    ],
    bulk:1.2, bake:[[230,20,true],[210,22,false]], cut:60, autoDet:"Die Milch kommt mit dem Wasser dazu.",
    prep:[{ref:"bulk",min:-60,title:"Schokolade hacken und kalt stellen",det:"Riegel grob hacken (ca. 1 cm) und in den Kühlschrank legen, damit sie beim Einarbeiten nicht schmilzt."}],
    mixDet:"Zucker und Butter gemeinsam mit Salz und Anstellgut einkneten.",
    foldIn:"Gekühlte Schokostücke auf dem Teig verteilen und beim Falten einarbeiten.",
    notes:"Zucker, Milch und Butter bremsen die Hefen, deshalb dauert die Stockgare länger. Niedrige Ofentemperatur, sonst wird die Schokolade bitter."
  },
  koerner: {
    name:"Körnerbrot", hint:"Mit Brühstück aus Saaten",
    flours:[["Weizenmehl Type 550",60],["Roggenvollkornmehl",20],["Weizenvollkornmehl",20]],
    liquids:[["Wasser (ca. 30 °C)",70]], starter:20, salt:2.2,
    extras:[{g:"Brühstück",items:[["Sonnenblumenkerne",10],["Leinsamen",8],["Sesam",6],["Kürbiskerne",6],["Kochendes Wasser",36]]}],
    bulk:1.05, bake:[[250,20,true],[230,30,false]],
    prep:[{ref:"mix",min:-240,title:"Brühstück ansetzen",det:"Saaten (gern kurz angeröstet) mit kochendem Wasser übergießen, abdecken und quellen lassen."}],
    foldIn:"Abgekühltes Brühstück beim ersten Falten einarbeiten.",
    notes:"Das Brühstück bindet viel Wasser. Ohne es wird die Krume trocken und die Saaten ziehen Wasser aus dem Teig."
  },
  oliven: {
    name:"Oliven & Rosmarin", hint:"Mediterran, offene Krume",
    flours:[["Weizenmehl Type 550",90],["Hartweizengrieß (Semola)",10]],
    liquids:[["Wasser (ca. 30 °C)",70],["Olivenöl",4]], starter:20, salt:1.8,
    extras:[{g:"Einarbeiten beim 1. Falten",items:[["Oliven, entsteint & abgetupft",18],["Frischer Rosmarin, gehackt",1]]}],
    bulk:1, bake:[[250,20,true],[230,25,false]],
    foldIn:"Oliven und Rosmarin beim ersten Falten einarbeiten.",
    notes:"Oliven gut abtupfen, sonst wird der Teig zu nass. Weniger Salz, weil die Oliven schon salzig sind."
  },
  dinkel: {
    name:"Dinkel-Vollkorn", hint:"Nussig, saftig",
    flours:[["Dinkelmehl Type 630",50],["Dinkelvollkornmehl",50]],
    liquids:[["Wasser (ca. 30 °C)",74]], starter:20, salt:2,
    extras:[{g:"Optional",items:[["Honig",2]]}],
    bulk:0.9, folds:3, bake:[[250,20,true],[230,25,false]],
    notes:"Dinkel ist empfindlich: lieber kürzer gehen lassen und sanft falten. Weniger Faltrunden als bei Weizen."
  },
  glutenfrei: {
    name:"Glutenfreies Brot", hint:"Reis & Buchweizen, saftig",
    flours:[["Vollkornreismehl",40],["Buchweizenmehl",30],["Kartoffel- oder Tapiokastärke",30]],
    liquids:[["Wasser (ca. 30 °C)",100]], starter:25, salt:2.2,
    extras:[{g:"Bindung",items:[["Flohsamenschalen, gemahlen",6],["Olivenöl",3],["Honig oder Zuckerrübensirup",2]]}],
    gf:true, bulk:1, bake:[[230,40,true],[210,30,false]], cut:180,
    shapeDet:"Mit nassen Händen zu einem Laib formen und in ein mit Reismehl bestäubtes Gärkörbchen oder eine gefettete Kastenform legen.",
    notes:"Flohsamenschalen ersetzen das Klebergerüst, deshalb nicht weglassen. Alle Mehle und Stärken mit Glutenfrei-Kennzeichnung kaufen und ein eigenes Gärkörbchen verwenden. Das Brot erst ganz ausgekühlt anschneiden, sonst ist die Krume klebrig."
  }
};

// Eigene Rezepte speichern Gramm, so wie sie eingegeben wurden:
// { id, name, gf, speed, flours:[[Name, g]], liquids:[[Name, g]], starter, salt, extras:[[Name, g, wann]], bake, notes, u }
export const WHEN = { mix:"Beim Kneten dazugeben", fold:"Einarbeiten beim 1. Falten", shape:"Beim Formen einrollen", soak:"Vorher einweichen (Brühstück)" };
export function fromRecipe(r){
  const F = r.flours.reduce((a,x)=>a+x[1],0) || 1, pc = x => x/F*100;
  const when = w => (r.gf && w==="fold") ? "mix" : w;
  const of = w => r.extras.filter(x => when(x[2])===w);
  const names = w => of(w).map(x=>x[0]).join(", ");
  return {
    name:r.name, hint:"Eigenes Rezept", own:true, gf:!!r.gf, bulk:r.speed||1, bake:r.bake, notes:r.notes||"", cut:r.gf?180:90,
    flours:r.flours.map(([n,x])=>[n,pc(x)]), liquids:r.liquids.map(([n,x])=>[n,pc(x)]), starter:pc(r.starter), salt:pc(r.salt),
    extras:Object.keys(WHEN).filter(w=>of(w).length).map(w=>({ g:WHEN[w], items:of(w).map(([n,x])=>[n,pc(x)]) })),
    mixDet:of("mix").length ? names("mix")+" mit einarbeiten." : "",
    foldIn:of("fold").length ? names("fold")+" auf dem Teig verteilen und beim Falten einarbeiten." : "",
    shapeDet:of("shape").length ? "Teig flach ausziehen, "+names("shape")+" darauf verteilen, aufrollen und straff formen." : "",
    prep:of("soak").length ? [{ref:"mix",min:-240,title:"Brühstück ansetzen",det:names("soak")+" mit kochendem Wasser übergießen (Menge im Rezept), abdecken und abkühlen lassen. Kommt beim Kneten in den Teig."}] : []
  };
}
// Vorlage für den Editor: ein eingebautes Brot in Gramm, gerundet für 500 g Mehl
export function toGrams(b, F = 500){
  const g = pc => Math.round(pc*F/100*10)/10;
  return { name:b.name+" (meins)", gf:!!b.gf, speed:b.bulk, flours:b.flours.map(([n,p])=>[n,g(p)]), liquids:b.liquids.map(([n,p])=>[n,g(p)]),
    starter:g(b.starter), salt:g(b.salt), bake:b.bake, notes:b.notes||"",
    extras:b.extras.flatMap(x => x.items.map(([n,p]) => [n, g(p), /Brühstück|einweichen/.test(x.g) ? "soak" : /Falten/.test(x.g) ? "fold" : /Kräuterbutter|Formen/.test(x.g) ? "shape" : "mix"])) };
}
// Was an einem eingegebenen Rezept nicht stimmt (leer = alles gut)
export function checkRecipe(r){
  const F = r.flours.reduce((a,x)=>a+x[1],0), W = r.liquids.reduce((a,x)=>a+x[1],0);
  if (!r.name) return "Gib dem Rezept einen Namen.";
  if (!(F >= 50)) return "Trag mindestens ein Mehl mit zusammen 50 g oder mehr ein.";
  if (!(W > 0)) return "Trag Wasser oder eine andere Flüssigkeit ein.";
  if (!(r.starter > 0)) return "Ohne Anstellgut geht ein Sauerteigbrot nicht auf. Trag eine Menge ein (üblich: ein Fünftel der Mehlmenge).";
  if (W/F > 1.6) return "Das ist sehr viel Flüssigkeit für so wenig Mehl. Bitte prüfe die Mengen.";
  if (r.salt/F > 0.06) return "Das ist sehr viel Salz (üblich sind 2 % der Mehlmenge). Bitte prüfe die Menge.";
  if (r.starter/F > 1) return "Das ist mehr Anstellgut als Mehl. Bitte prüfe die Mengen.";
  if (r.bake.some(x => !(x[0]>=100 && x[0]<=300) || !(x[1]>=0 && x[1]<=180))) return "Prüfe Backzeit und Temperatur.";
  return "";
}

// Wie viel Wasser in einer Flüssigkeit steckt
const water = n => /milch/i.test(n) ? 0.87 : /öl|butter|honig|sirup/i.test(n) ? 0 : 1;
export function amounts(b, total){
  const pct = 100 + b.liquids.reduce((a,x)=>a+x[1],0) + b.starter + b.salt + b.extras.reduce((a,grp)=>a+grp.items.reduce((c,x)=>c+x[1],0),0);
  const F = total/(pct/100), half = F*b.starter/200;
  const wet = b.liquids.reduce((a,x)=>a+x[1]*water(x[0]),0)*F/100;
  const need = F*b.starter/100;
  // Füttern 1:2:2, dazu 20 g Reserve fürs Glas
  return { F, total, hydr:(wet+half)/(F+half)*100, need, feed:Math.ceil((need+20)/25)*5 };
}
export const gram = x => x>=50 ? Math.round(x/5)*5 : x>=10 ? Math.round(x) : Math.round(x*10)/10;
