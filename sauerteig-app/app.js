// Sauerteig-Planer: Backplan rückwärts vom Ofen, Mengen pro Brotsorte, Starter-Erinnerungen.
import { createStore, randomCode } from "./store.js";

// ---------- Rezepte (Bäckerprozente, bezogen auf Mehl = 100 %) ----------
const BREADS = {
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
    bulk:1.2, bake:[[230,20,true],[210,22,false]],
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
    bulk:0.9, bake:[[250,20,true],[230,25,false]],
    notes:"Dinkel ist empfindlich: lieber kürzer gehen lassen und sanft falten. Weniger Faltrunden als bei Weizen."
  }
};

// ---------- Hilfen ----------
const $ = id => document.getElementById(id);
const MIN = 60000, HOUR = 60*MIN, DAY = 24*HOUR;
const add = (d,m) => new Date(d.getTime()+m*MIN);
const WD = ["So","Mo","Di","Mi","Do","Fr","Sa"];
const WDL = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
const p2 = n => String(n).padStart(2,"0");
const hm = d => p2(d.getHours())+":"+p2(d.getMinutes());
const dayKey = d => d.getFullYear()+"-"+d.getMonth()+"-"+d.getDate();
const dayLabel = d => WDL[d.getDay()]+", "+d.getDate()+"."+(d.getMonth()+1)+".";
const short = d => WD[d.getDay()]+" "+hm(d);
const longDate = d => WD[d.getDay()]+" "+d.getDate()+"."+(d.getMonth()+1)+"., "+hm(d)+" Uhr";
const dur = m => { m=Math.round(m); const h=Math.floor(m/60), r=m%60; return h? (r? h+" h "+r+" min": h+" h") : r+" min"; };
const roundTo = (d,step=5) => new Date(Math.round(d.getTime()/(step*MIN))*step*MIN);
const isNight = d => d.getHours()>=23 || d.getHours()<6;
const g = x => x>=50 ? Math.round(x/5)*5 : x>=10 ? Math.round(x) : Math.round(x*10)/10;
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toLocalInput = d => d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate())+"T"+p2(d.getHours())+":"+p2(d.getMinutes());
function relTime(ms){
  const a = Math.abs(ms), past = ms < 0;
  let s;
  if (a < HOUR) s = Math.max(1,Math.round(a/MIN))+" min";
  else if (a < 2*DAY) s = Math.round(a/HOUR)+" h";
  else s = Math.round(a/DAY)+" Tagen";
  return past ? "seit "+s.replace("Tagen","Tagen") : "in "+s;
}

// ================= STARTER =================
const FLOUR = { weizen:"Weizen", roggen:"Roggen", dinkel:"Dinkel" };
const FRIDGE_DEFAULT = { weizen:7, roggen:10, dinkel:7 };
let starter = {
  name:"Weizen-Sauerteig", flour:"weizen", mode:"aktiv",
  lastFed: new Date(Date.now()-10*HOUR).toISOString(), fridgeSince:null, fridgeDays:7,
  log:[], example:true
};

function roomIntervalH(){ return state.temp >= 25 ? 12 : 24; }
function starterInfo(){
  const last = new Date(starter.lastFed);
  const fridge = starter.mode === "kuehlschrank";
  const intervalMs = fridge ? starter.fridgeDays*DAY : roomIntervalH()*HOUR;
  const next = new Date(last.getTime()+intervalMs);
  const left = next - Date.now();
  const elapsed = Date.now() - last;
  let level = "ok";
  if (left < 0) level = left < -(fridge?3*DAY:12*HOUR) ? "bad" : "warn";
  else if (left < (fridge?DAY:3*HOUR)) level = "soon";
  const fridgeFor = fridge && starter.fridgeSince ? Date.now()-new Date(starter.fridgeSince) : 0;
  return { last, next, left, elapsed, intervalMs, level, fridge, fridgeFor };
}

function tipsFor(info){
  const t = [];
  if (info.fridge){
    t.push("Glas nur locker verschließen (Deckel auflegen oder Gummiring weg). Der Starter bildet weiter Gas.");
    t.push("Füttern im Kühlschrank-Modus: alten Starter bis auf ca. 20 g abnehmen, frisch füttern, 1–2 h bei Raumtemperatur anspringen lassen, dann zurück in den Kühlschrank.");
    t.push("Graue oder dunkle Flüssigkeit oben („Hooch“) ist normal und heißt: Er hat Hunger. Abgießen oder unterrühren, dann füttern.");
    t.push("Vor dem Backen: 1–2 Tage vorher rausholen und 2–3 Mal bei Raumtemperatur füttern, bis er sich in 4–6 h verdoppelt.");
    if (starter.flour === "weizen") t.push("Weizen-Starter wird im Kühlschrank schneller sauer als Roggen. Länger als 7–10 Tage ohne Futter macht ihn träge.");
    if (starter.flour === "roggen") t.push("Roggen-Starter ist robust und hält 10–14 Tage ohne Futter gut durch.");
    if (info.fridgeFor > 21*DAY) t.push("Länger als 3 Wochen Pause geplant? Dann lieber fester führen (doppelt so viel Mehl wie Wasser) oder einen Teil dünn auf Backpapier streichen und trocknen als Reserve.");
  } else {
    t.push(`Bei Raumtemperatur (${String(state.temp).replace(".",",")} °C) alle ${roomIntervalH()} h füttern. Wärmer heißt hungriger.`);
    t.push("Ein gesunder Starter verdoppelt sich 4–8 h nach dem Füttern, riecht angenehm säuerlich und hat viele Blasen.");
    t.push("Mit einem Gummiband am Glas markieren, wie hoch er nach dem Füttern stand. So siehst du, wann er auf dem Höhepunkt ist.");
    t.push("Willst du ein paar Tage nicht backen, stell ihn in den Kühlschrank. Das spart Mehl und Arbeit.");
  }
  t.push("Wegwerfen, wenn du rosa, orange oder pelzigen Schimmel siehst. Ein Geruch nach Nagellack oder Essig ist dagegen nur Hunger.");
  return t;
}

function renderStarter(){
  const info = starterInfo();
  const lv = { ok:["ok","Alles gut"], soon:["warn","Bald füttern"], warn:["warn","Füttern fällig"], bad:["bad","Überfällig"] }[info.level];
  $("vChip").className = "chip "+lv[0]; $("vChip").textContent = lv[1];
  $("stName").textContent = (starter.name || "Mein Starter") + " · " + FLOUR[starter.flour];
  $("stMode").innerHTML = info.fridge
    ? `<span class="chip cold">Im Kühlschrank</span> <span style="font-size:13px;color:var(--muted)">seit ${esc(relTime(new Date(starter.fridgeSince||starter.lastFed)-Date.now()).replace("seit ",""))}</span>`
    : `<span class="chip ok">Aktiv bei Raumtemperatur</span>`;
  $("stDue").textContent = info.left >= 0 ? "Füttern "+relTime(info.left) : "Füttern überfällig";
  $("stDueSub").textContent = info.left >= 0 ? "am "+longDate(info.next) : "fällig war "+longDate(info.next)+" ("+relTime(info.left)+")";
  const pct = Math.min(100, Math.max(2, info.elapsed/info.intervalMs*100));
  $("stBar").className = "bar " + (info.level==="bad"?"bad":info.level==="ok"?"":"warn");
  $("stBar").firstElementChild.style.width = pct+"%";
  $("jarFill").setAttribute("y", String(40 - Math.round((1-pct/100)*16)));
  $("jarFill").setAttribute("height", String(29 + Math.round((1-pct/100)*16)));

  // Aktionen
  $("stActions").innerHTML = info.fridge
    ? `<button class="btn" type="button" data-a="feed">Gerade gefüttert</button>
       <button class="btn ghost" type="button" data-a="wake">Rausholen zum Backen</button>`
    : `<button class="btn" type="button" data-a="feed">Gerade gefüttert</button>
       <button class="btn ghost" type="button" data-a="fridge">In den Kühlschrank stellen</button>`;

  // Fütter-Verhältnis
  const r = info.fridge ? [20,60,60] : [20,40,40];
  $("ratioBox").innerHTML = `<p class="lbl" style="margin:0 0 6px">So fütterst du ${info.fridge?"vor dem Kühlschrank (1:3:3)":"bei Raumtemperatur (1:2:2)"}</p>
    <div class="ratio" style="margin-bottom:14px">
      <div><b>${r[0]} g</b><span>Starter</span></div><div><b>${r[1]} g</b><span>${FLOUR[starter.flour]}mehl</span></div><div><b>${r[2]} g</b><span>Wasser, lauwarm</span></div>
    </div>`;
  $("tipsHead").textContent = info.fridge ? "Im Kühlschrank beachten" : "Das musst du beachten";
  $("tips").innerHTML = tipsFor(info).map(x=>`<li>${esc(x)}</li>`).join("");

  // Verlauf
  const L = { feed:"Gefüttert", fridge:"In den Kühlschrank", wake:"Aus dem Kühlschrank geholt" };
  $("log").innerHTML = starter.log.length
    ? starter.log.slice(0,12).map(e=>`<li><span>${L[e.type]||esc(e.type)}</span><span>${esc(longDate(new Date(e.t)))}</span></li>`).join("")
    : `<li><span style="color:var(--muted)">Noch keine Einträge. Tipp auf „Gerade gefüttert“, wenn du ihn das nächste Mal fütterst.</span><span></span></li>`;

  // Formular
  if (document.activeElement !== $("lastFed")) $("lastFed").value = toLocalInput(info.last);
  if (document.activeElement !== $("stNameIn")) $("stNameIn").value = starter.name || "";
  $("stFlour").value = starter.flour;

  // Erinnerung
  $("starterRemind").checked = state.starterRemind;
  const rem = starterReminders(info);
  $("calNote").textContent = !state.starterRemind ? "Erinnerung ist aus."
    : rem.length ? `Nächste Erinnerung: ${longDate(rem[0].at)}${rem[1] ? `, falls du dann nicht fütterst, nochmal ${longDate(rem[1].at)}` : ""}.`
    : "";
  scheduleSoon();
}

function starterAction(type, when = new Date()){
  starter.example = false;
  starter.log.unshift({ type, t: when.toISOString() });
  starter.log = starter.log.slice(0, 40);
}
function saveStarter(){
  persist("sauerteig-starter", starter);
  $("stSync").textContent = "";
  renderStarter(); render();
}

// ---------- Speicher & Push (Firebase, wie die anderen Apps im Repo) ----------
// Alles liegt zuerst in diesem Browser (localStorage). Mit Firebase kommt eine Kopie unter
// sauerteig/<code> dazu: für ein zweites Gerät und damit der Server die Erinnerungen schicken kann.
let store = null, syncCode = null, notifOk = false;
function persist(key, obj){
  try{ localStorage.setItem(key, JSON.stringify(obj)); localStorage.setItem("sauerteig-st", String(Date.now())); }catch(e){}
  syncSoon();
}

function starterReminders(info){
  const out = [], now = Date.now();
  const nm = starter.name || "Dein Starter";
  const how = info.fridge
    ? `Auf ca. 20 g abnehmen, mit 60 g ${FLOUR[starter.flour]}mehl und 60 g Wasser füttern, 1–2 h anspringen lassen, zurück in den Kühlschrank.`
    : `20 g Starter + 40 g ${FLOUR[starter.flour]}mehl + 40 g Wasser.`;
  const follow = info.fridge ? DAY : 4*HOUR;
  const first = info.next.getTime(), second = first + follow;
  if (first > now + MIN) out.push({ id:1, at:new Date(first), title:`${nm} hat Hunger`, body:how });
  if (second > now + MIN) out.push({ id:2, at:new Date(second), title:`${nm} wartet noch aufs Futter`, body:"Du hast die letzte Fütterung noch nicht eingetragen. "+how });
  return out;
}
function bakeReminders(){
  const now = Date.now() + MIN;
  return buildPlan(state).ev.filter(e => e.time.getTime() > now && e.title !== "Teig in Ruhe gehen lassen").slice(0, 40);
}
function dueList(){
  const list = [];
  if (state.starterRemind) starterReminders(starterInfo()).forEach(r => list.push({
    at:r.at.getTime(), title:r.title, body:r.body, tag:"starter", view:"starter", fed:true }));
  if (state.bakeRemind) bakeReminders().forEach((e,i) => list.push({
    at:e.time.getTime(), title:e.title, body:e.det.slice(0,300), tag:"bake"+i, view:"backen", fed:false }));
  return list.sort((a,b)=>a.at-b.at).slice(0, 50);
}

let syncT, lastSent = "";
function syncSoon(){ clearTimeout(syncT); syncT = setTimeout(syncNow, 1200); }
const scheduleSoon = syncSoon;
async function syncNow(){
  if (!store || !syncCode) return;
  const j = JSON.stringify({ state:{...state, target: state.target.toISOString()}, starter });
  const due = notifOk ? dueList() : [];
  const sig = j + JSON.stringify(due);
  if (sig === lastSent) return;
  try{ await store.save(syncCode, { j, due }); lastSent = sig; setSync(""); }
  catch(e){ console.error(e); setSync("Konnte gerade nicht speichern. Die App versucht es beim nächsten Mal wieder."); }
}
function setSync(msg){ $("stSync").textContent = msg; }

async function refreshPermission(ask){
  const support = store && await store.pushSupported().catch(()=>false);
  if (!support){
    notifOk = false;
    $("notifState").textContent = store
      ? "Dieser Browser kann keine Benachrichtigungen. Installiere die App über Chrome (⋮ → App installieren)."
      : "Ohne Internetverbindung gibt es keine Erinnerungen. Öffne die App noch einmal, wenn du online bist.";
    $("notifAllow").hidden = true; $("notifTest").hidden = true;
    return;
  }
  if (Notification.permission === "default" && ask){ try{ await Notification.requestPermission(); }catch(e){} }
  notifOk = Notification.permission === "granted";
  if (notifOk){
    try{
      const reg = await navigator.serviceWorker.ready;
      const token = await store.pushToken(reg);
      if (token) await store.addToken(syncCode, token); else notifOk = false;
    }catch(e){ console.error(e); notifOk = false; }
  }
  $("notifState").textContent = notifOk
    ? "Benachrichtigungen sind an. Dein Handy meldet sich auch, wenn die App geschlossen ist (bis zu 5 Minuten Verzögerung)."
    : Notification.permission === "denied"
      ? "Benachrichtigungen sind blockiert. Erlaube sie in den Android-Einstellungen bei der App „Sauerteig“."
      : "Benachrichtigungen sind noch aus. Erlaube sie, damit dich die App erinnern kann.";
  $("notifAllow").hidden = notifOk || Notification.permission === "denied";
  $("notifTest").hidden = !notifOk;
  lastSent = ""; syncSoon();
}

// Abgleich mit einem anderen Gerät über den Sauerteig-Code
function applyRemote(data){
  if (!data || !data.j) return false;
  const localSt = +(localStorage.getItem("sauerteig-st") || 0);
  const fresh = !localStorage.getItem("sauerteig-starter");
  if (!fresh && (data.st || 0) <= localSt) return false;
  try{
    const r = JSON.parse(data.j);
    if (r.state){ Object.assign(state, r.state); state.target = new Date(r.state.target); }
    if (r.starter) starter = { ...starter, ...r.starter };
    localStorage.setItem("sauerteig", JSON.stringify({...state, target: state.target.toISOString()}));
    localStorage.setItem("sauerteig-starter", JSON.stringify(starter));
    localStorage.setItem("sauerteig-st", String(data.st || Date.now()));
    return true;
  }catch(e){ return false; }
}
function renderCode(){
  $("syncCode").textContent = syncCode || "–";
  $("syncBox").hidden = !store;
}


// ================= BACKEN =================
let state = { bread:"klassisch", target:null, count:1, weight:1000, temp:22, cold:true, coldH:12, bakeRemind:false, starterRemind:true };

function defaultTarget(){
  const d = new Date(); d.setHours(10,0,0,0);
  let n = (6 - d.getDay() + 7) % 7; if (n < 2) n += 7;
  d.setDate(d.getDate()+n); return d;
}

function buildPlan(s){
  const b = BREADS[s.bread];
  const f = Math.pow(1.09, 24 - s.temp);
  const bulkMin = 270 * f * b.bulk;
  const peakMin = 300 * f;
  const warmProof = 100 * f * b.bulk;
  const proofMin = s.cold ? s.coldH*60 : warmProof;
  const shapeMin = b.shape || 15;
  const bakeMin = b.bake.reduce((a,x)=>a+x[1],0);

  const bake = s.target;
  const proof = roundTo(add(bake, -proofMin));
  const shape = roundTo(add(proof, -shapeMin));
  const preshape = add(shape, -30);
  const bulk = roundTo(add(preshape, -bulkMin));
  const mix = add(bulk, -15);
  const autolyse = add(mix, -45);
  const feed = roundTo(add(mix, -peakMin), 15);
  const end = add(bake, bakeMin);
  const refs = {mix, bulk, shape, bake, end};

  const ev = [];
  const E = (time,title,det,kind="act") => ev.push({time,title,det,kind});
  const st = starterNeed(s);
  const sName = starter.name || "Anstellgut";
  const fromFridge = starter.mode === "kuehlschrank";

  let start = feed;
  if (fromFridge){
    const wake = roundTo(add(feed, -12*60), 15);
    E(wake, `${sName} aus dem Kühlschrank holen`,
      `Auf ca. 20 g abnehmen, mit 40 g Mehl und 40 g Wasser füttern und bei Raumtemperatur stehen lassen. Im Tab „Mein Starter“ auf „Rausholen zum Backen“ tippen.`, "starter");
    start = wake;
  }
  E(feed, fromFridge ? `${sName} ein zweites Mal füttern` : `${sName} füttern`,
    `${st.feed} g Anstellgut + ${st.feed} g Mehl + ${st.feed} g Wasser verrühren (1:1:1). Bei ${s.temp} °C ist es nach etwa ${dur(peakMin)} auf dem Höhepunkt.`, "starter");
  E(autolyse,"Autolyse: Mehl + Wasser mischen",
    `Mehl und Wasser (ohne Salz und Anstellgut) grob verrühren, 45 min abgedeckt ruhen lassen.${s.bread==="schoko"?" Die Milch kommt mit dem Wasser dazu.":""}`);
  E(mix,"Anstellgut und Salz einarbeiten",
    `${st.need} g aktives Anstellgut und das Salz 5–8 min einkneten. ${b.mixDet||""} Den Rest vom Starter (ca. 20 g) behalten und füttern.`.trim());
  E(add(mix, 20), "Rest-Starter versorgen",
    "Rest mit Mehl und Wasser 1:2:2 füttern. Backst du die nächsten Tage nicht, nach 1–2 h in den Kühlschrank stellen und im Tab „Mein Starter“ eintragen.", "starter");

  const folds = s.bread==="dinkel" ? 3 : 4;
  for (let i=1;i<=folds;i++){
    E(add(bulk, 30*i), `${i}. Dehnen & Falten`,
      i===1 && b.foldIn ? b.foldIn : "Teig von allen Seiten hochziehen und übereinanderlegen, 4 Runden.");
  }
  E(add(bulk, 30*folds+5),"Teig in Ruhe gehen lassen",
    `Abgedeckt bei ${s.temp} °C stehen lassen. Gesamte Stockgare ca. ${dur(bulkMin)}. Fertig, wenn der Teig um 50–75 % gewachsen ist, Blasen zeigt und wackelt.`,"wait");
  E(preshape,"Vorformen", "Teig auf die Arbeitsfläche geben, rund vorformen, 30 min entspannen lassen.");
  E(shape,"Formen und ins Gärkörbchen", b.shapeDet || "Straff formen, mit der Naht nach oben in das bemehlte Gärkörbchen legen.");
  E(proof, s.cold ? "Ab in den Kühlschrank" : "Stückgare bei Raumtemperatur",
    s.cold ? `Abgedeckt bei 4–6 °C ca. ${dur(proofMin)} gehen lassen. Wird direkt aus dem Kühlschrank gebacken.`
           : `Abgedeckt ca. ${dur(proofMin)} gehen lassen. Fingertest: Delle springt langsam zurück.`, "wait");
  E(add(bake,-60),"Ofen vorheizen", `Gusseisentopf mit Deckel bei ${b.bake[0][0]} °C Ober-/Unterhitze 60 min aufheizen.`);
  E(bake,"Einschießen und backen",
    b.bake.map(x=>`${x[1]} min bei ${x[0]} °C ${x[2]?"mit Deckel":"ohne Deckel"}`).join(", ")+". Vorher einschneiden.", "bake");
  E(end,"Brot aus dem Ofen", "Klopftest: Es klingt hohl. Kerntemperatur ca. 96 °C.", "bake");
  (b.prep||[]).forEach(p => E(roundTo(add(refs[p.ref], p.min)), p.title, p.det));
  E(add(end, s.bread==="schoko" ? 60 : 90),"Anschneiden", "Vorher auf einem Gitter auskühlen lassen, sonst wird die Krume klebrig.","wait");

  ev.sort((a,b)=>a.time-b.time);
  ev.forEach(e => e.night = e.kind!=="wait" && isNight(e.time));
  return { ev, start, end, peakMin };
}

function recipe(s){
  const b = BREADS[s.bread];
  const total = s.count * s.weight;
  const pct = 100 + b.liquids.reduce((a,x)=>a+x[1],0) + b.starter + b.salt +
              b.extras.reduce((a,grp)=>a+grp.items.reduce((c,x)=>c+x[1],0),0);
  const F = total / (pct/100);
  const half = F*b.starter/200;
  const liquid = b.liquids.reduce((a,x)=>a + x[1]*(x[0]==="Milch"?0.87:1),0)*F/100;
  const hydr = (liquid + half) / (F + half) * 100;
  return { b, F, total, hydr, starterG: F*b.starter/100 };
}
function starterNeed(s){
  const need = recipe(s).starterG;
  return { need: g(need), feed: Math.ceil((need + 20) / 3 / 5) * 5 };
}

function renderBreads(){
  $("breads").innerHTML = Object.entries(BREADS).map(([k,b]) =>
    `<button class="bread" type="button" data-k="${k}" aria-pressed="${k===state.bread}"><b>${b.name}</b><span>${b.hint}</span></button>`).join("");
}

function render(){
  $("tempOut").textContent = String(state.temp).replace(".",",")+" °C";
  $("coldOut").textContent = String(state.coldH).replace(".",",")+" h";
  $("coldWrap").hidden = !state.cold;
  document.querySelectorAll(".bread").forEach(el => el.setAttribute("aria-pressed", el.dataset.k===state.bread));

  const p = buildPlan(state);
  const r = recipe(state);
  const nights = p.ev.filter(e=>e.night);
  const now = new Date();

  $("summary").innerHTML = `
    <div><span class="lbl">Los geht's</span><span class="v">${short(p.start)}</span></div>
    <div><span class="lbl">Im Ofen</span><span class="v">${short(state.target)}</span></div>
    <div><span class="lbl">Gesamt</span><span class="v">${dur((state.target-p.start)/MIN)}</span></div>
    <div><span class="lbl">Teig</span><span class="v">${r.total} g</span></div>
    <div><span class="lbl">Hydration</span><span class="v">${Math.round(r.hydr)} %</span></div>`;

  let al = "";
  const si = starterInfo();
  if (si.level==="warn"||si.level==="bad") al += `<div class="alert ${si.level}">${esc(starter.name||"Dein Starter")} muss gefüttert werden. <button type="button" data-go="starter">Zum Starter</button></div>`;
  if (starter.mode==="kuehlschrank") al += `<div class="alert warn">Dein Starter steht im Kühlschrank. Der Plan beginnt deshalb 12 h früher mit einer zusätzlichen Fütterung.</div>`;
  if (p.start < now) al += `<div class="alert warn">Der Plan hätte schon ${dayLabel(p.start)} um ${hm(p.start)} beginnen müssen. Wähle einen späteren Backtermin oder verkürze die Kühlschrank-Gare.</div>`;
  if (nights.length) al += `<div class="alert night">${nights.length} Schritt${nights.length>1?"e fallen":" fällt"} in die Nacht (23–6 Uhr): ${nights.map(e=>esc(e.title)+" "+hm(e.time)).join(", ")}. Tipp: „Nachtschichten vermeiden“ verschiebt die Kühlschrank-Gare passend.</div>`;
  else if (p.start >= now) al += `<div class="alert ok">Kein Schritt zwischen 23 und 6 Uhr. Gut schlafen!</div>`;
  $("alerts").innerHTML = al;

  let html = "", last = "";
  p.ev.forEach(e => {
    const k = dayKey(e.time);
    if (k!==last){ html += `<div class="day">${dayLabel(e.time)}</div>`; last=k; }
    const bell = state.bakeRemind && notifOk && e.time > now && e.title !== "Teig in Ruhe gehen lassen" ? '<span class="chip bell">Erinnerung</span>' : "";
    html += `<div class="ev ${e.kind} ${e.night?"isnight":""}">
      <div class="t">${hm(e.time)}</div><div class="rail"><span class="dot"></span></div>
      <div class="body"><div class="title">${esc(e.title)}${e.night?'<span class="chip n">Nachts</span>':""}${bell}</div><div class="det">${esc(e.det)}</div></div></div>`;
  });
  $("plan").innerHTML = html;

  const b = r.b, F = r.F, st = starterNeed(state);
  let rows = `<tr class="grp"><td colspan="3">Hauptteig</td></tr>`;
  b.flours.forEach(([n,pc]) => rows += `<tr><td>${n}</td><td class="p">${pc} %</td><td class="g">${g(F*pc/100)} g</td></tr>`);
  b.liquids.forEach(([n,pc]) => rows += `<tr><td>${n}</td><td class="p">${pc} %</td><td class="g">${g(F*pc/100)} g</td></tr>`);
  rows += `<tr><td>Aktives Anstellgut (100 % Hydration)</td><td class="p">${b.starter} %</td><td class="g">${st.need} g</td></tr>`;
  rows += `<tr><td>Salz</td><td class="p">${b.salt} %</td><td class="g">${g(F*b.salt/100)} g</td></tr>`;
  b.extras.forEach(grp => {
    rows += `<tr class="grp"><td colspan="3">${grp.g}</td></tr>`;
    grp.items.forEach(([n,pc]) => rows += `<tr><td>${n}</td><td class="p">${pc} %</td><td class="g">${g(F*pc/100)} g</td></tr>`);
  });
  rows += `<tr class="grp"><td colspan="3">Anstellgut füttern (vor dem Backtag)</td></tr>
    <tr><td>Anstellgut</td><td class="p">1</td><td class="g">${st.feed} g</td></tr>
    <tr><td>${FLOUR[starter.flour]}mehl</td><td class="p">1</td><td class="g">${st.feed} g</td></tr>
    <tr><td>Wasser</td><td class="p">1</td><td class="g">${st.feed} g</td></tr>`;
  $("recipe").innerHTML = `<div style="overflow-x:auto"><table>
    <thead><tr><th>Zutat</th><th style="text-align:right">Bäcker-%</th><th style="text-align:right">Menge</th></tr></thead>
    <tbody>${rows}</tbody></table></div>
    <p class="note">${b.notes}</p>
    <p class="note">Bäcker-% beziehen sich auf die Mehlmenge (${g(F)} g = 100 %). Für ${state.count} × ${state.weight} g Teig. Backen: ${b.bake.map(x=>`${x[1]} min / ${x[0]} °C ${x[2]?"mit":"ohne"} Deckel`).join(" → ")}${state.count>1?", pro Brot, nacheinander oder in zwei Töpfen":""}.</p>`;
  save();
}

function optimize(){
  let best=null;
  for (const cold of [true,false]){
    const hs = cold ? Array.from({length:25},(_,i)=>6+i*0.5) : [state.coldH];
    for (const h of hs){
      const p = buildPlan({...state, cold, coldH:h});
      const n = p.ev.filter(e=>e.night).length;
      const score = n*10 + (p.start < new Date() ? 100 : 0) + Math.abs(h-12)*(cold?0.3:0) + (cold?0:1);
      if (!best || score < best.score) best = {score, cold, h, n};
    }
  }
  state.cold = best.cold; state.coldH = best.h;
  $("cold").checked = best.cold; $("coldH").value = best.h;
  render();
  toast(best.n ? `Besser geht's mit diesem Termin nicht: noch ${best.n} Schritt(e) nachts. Probier eine andere Backzeit.` :
    best.cold ? `Kühlschrank-Gare auf ${String(best.h).replace(".",",")} h gesetzt, keine Nachtschritte mehr.` : "Ohne Kühlschrank passt es am besten.");
}

function planText(){
  const p = buildPlan(state), b = BREADS[state.bread];
  let t = `Sauerteig-Plan: ${b.name} (${state.count} × ${state.weight} g)\n`, last="";
  p.ev.forEach(e => { const k=dayKey(e.time); if(k!==last){ t+=`\n${dayLabel(e.time)}\n`; last=k; } t += `${hm(e.time)}  ${e.title}\n`; });
  return t;
}
let toastT;
function toast(msg){ $("toast").textContent = msg; clearTimeout(toastT); toastT=setTimeout(()=>$("toast").textContent="",5000); }
function copyText(t, okMsg){
  const fallback = () => { const ta=document.createElement("textarea"); ta.value=t; document.body.appendChild(ta); ta.select(); try{document.execCommand("copy"); toast(okMsg);}catch(e){toast("Kopieren nicht möglich.");} ta.remove(); };
  try{ navigator.clipboard.writeText(t).then(()=>toast(okMsg), fallback); }catch(e){ fallback(); }
}

function save(){ persist("sauerteig", {...state, target: state.target.toISOString()}); if (state.bakeRemind) scheduleSoon(); }
function load(){
  try{ const s = JSON.parse(localStorage.getItem("sauerteig")||"null");
    if (s){ Object.assign(state, s); state.target = new Date(s.target); if (!BREADS[state.bread]) state.bread="klassisch"; }
  }catch(e){}
  if (!state.target || isNaN(state.target) || state.target < new Date()) state.target = defaultTarget();
  try{ const st = JSON.parse(localStorage.getItem("sauerteig-starter")||"null"); if (st) starter = {...starter, ...st}; }catch(e){}
}

// ---------- Ansicht wechseln ----------
function showView(v){
  $("vBake").setAttribute("aria-selected", v==="bake"); $("vStarter").setAttribute("aria-selected", v==="starter");
  $("bakeView").hidden = v!=="bake"; $("starterView").hidden = v!=="starter";
  const h = "#"+(v==="starter"?"starter":"backen");
  try{ if (location.hash !== h) history.replaceState(null,"",h); }catch(e){}
}

// ---------- Events ----------
load(); renderBreads();
$("target").value = toLocalInput(state.target);
$("count").value = state.count; $("weight").value = state.weight;
$("temp").value = state.temp; $("cold").checked = state.cold; $("coldH").value = state.coldH;

$("breads").addEventListener("click", e => { const b=e.target.closest(".bread"); if(b){ state.bread=b.dataset.k; render(); } });
$("target").addEventListener("change", e => { const d=new Date(e.target.value); if(!isNaN(d)){ state.target=d; render(); } });
$("count").addEventListener("change", e => { state.count=+e.target.value; render(); });
$("weight").addEventListener("change", e => { state.weight=+e.target.value; render(); });
$("temp").addEventListener("input", e => { state.temp=+e.target.value; render(); renderStarter(); });
$("cold").addEventListener("change", e => { state.cold=e.target.checked; render(); });
$("coldH").addEventListener("input", e => { state.coldH=+e.target.value; render(); });
$("optimize").addEventListener("click", optimize);
$("copy").addEventListener("click", () => copyText(planText(), "Plan kopiert, z. B. in WhatsApp oder Notizen einfügen."));
function tab(which){
  $("tabPlan").setAttribute("aria-selected", which==="plan"); $("tabRec").setAttribute("aria-selected", which==="rec");
  $("plan").hidden = which!=="plan"; $("recipe").hidden = which!=="rec";
}
$("tabPlan").addEventListener("click",()=>tab("plan"));
$("tabRec").addEventListener("click",()=>tab("rec"));
$("vBake").addEventListener("click",()=>showView("bake"));
$("vStarter").addEventListener("click",()=>showView("starter"));
$("alerts").addEventListener("click", e => { if (e.target.dataset.go==="starter") showView("starter"); });

// Starter-Aktionen
$("stActions").addEventListener("click", e => {
  const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
  if (a==="feed"){ starter.lastFed = new Date().toISOString(); starterAction("feed"); saveStarter(); toast("Fütterung eingetragen."); }
  if (a==="fridge"){ $("fridgeDays").value = starter.fridgeDays || FRIDGE_DEFAULT[starter.flour]; $("fridgeDaysOut").textContent = $("fridgeDays").value+" Tage"; $("fridgeBox").hidden=false; $("wakeBox").hidden=true; }
  if (a==="wake"){ $("wakeBox").hidden=false; $("fridgeBox").hidden=true; }
});
$("fridgeDays").addEventListener("input", e => $("fridgeDaysOut").textContent = e.target.value+" Tage");
$("fridgeCancel").addEventListener("click", ()=> $("fridgeBox").hidden=true);
$("wakeCancel").addEventListener("click", ()=> $("wakeBox").hidden=true);
$("fridgeGo").addEventListener("click", () => {
  const now = new Date();
  if ($("fridgeFed").checked){ starter.lastFed = now.toISOString(); starterAction("feed", now); }
  starter.mode = "kuehlschrank"; starter.fridgeSince = now.toISOString(); starter.fridgeDays = +$("fridgeDays").value;
  starterAction("fridge", now);
  $("fridgeBox").hidden = true; saveStarter();
  toast(`Im Kühlschrank. Nächste Fütterung in ${starter.fridgeDays} Tagen. Die App erinnert dich rechtzeitig.`);
});
$("wakeGo").addEventListener("click", () => {
  const now = new Date();
  starter.mode = "aktiv"; starter.fridgeSince = null;
  starterAction("wake", now);
  if ($("wakeFed").checked){ starter.lastFed = now.toISOString(); starterAction("feed", now); }
  $("wakeBox").hidden = true; saveStarter(); toast("Starter ist wieder aktiv. Füttere ihn noch 1–2 Mal, bevor du backst.");
});
$("lastFed").addEventListener("change", e => { const d = new Date(e.target.value); if (!isNaN(d) && d <= new Date()){ starter.lastFed = d.toISOString(); starter.example=false; saveStarter(); } });
let nameT;
$("stNameIn").addEventListener("input", e => { clearTimeout(nameT); nameT = setTimeout(()=>{ starter.name = e.target.value.trim().slice(0,40); starter.example=false; saveStarter(); }, 700); });
$("stFlour").addEventListener("change", e => { starter.flour = e.target.value; starter.example=false; if (starter.mode!=="kuehlschrank") starter.fridgeDays = FRIDGE_DEFAULT[starter.flour]; saveStarter(); });
// Erinnerungen
$("starterRemind").addEventListener("change", e => { state.starterRemind = e.target.checked; save(); renderStarter(); scheduleSoon(); });
$("bakeRemind").addEventListener("change", async e => {
  state.bakeRemind = e.target.checked;
  if (state.bakeRemind && !notifOk) await refreshPermission(true);
  if (state.bakeRemind && !notifOk){ toast("Ohne Erlaubnis für Benachrichtigungen kann die App nicht erinnern."); }
  else if (state.bakeRemind) toast(`${bakeReminders().length} Erinnerungen für diesen Backplan gestellt.`);
  render(); scheduleSoon();
});
$("notifAllow").addEventListener("click", () => refreshPermission(true));
$("notifTest").addEventListener("click", async () => {
  if (!notifOk){ await refreshPermission(true); if (!notifOk){ toast("Benachrichtigungen sind nicht erlaubt."); return; } }
  try{ await store.test(syncCode); toast("Test-Benachrichtigung ist unterwegs. Sie kommt in ein paar Sekunden, auch wenn du die App schließt."); }
  catch(e){ toast("Test konnte nicht gesendet werden. Bist du online?"); }
});
$("syncCopy").addEventListener("click", () => copyText(syncCode, "Code kopiert."));
$("syncJoin").addEventListener("click", async () => {
  const code = $("syncIn").value.trim().toLowerCase().replace(/\s+/g, "");
  if (!/^[a-z0-9]{10,40}$/.test(code)){ toast("Der Code hat 10 Zeichen, nur Buchstaben und Zahlen."); return; }
  try{
    const data = await store.load(code);
    if (!data || !data.j){ toast("Unter diesem Code ist nichts gespeichert."); return; }
    syncCode = code; localStorage.setItem("sauerteig-code", code);
    localStorage.removeItem("sauerteig-starter"); applyRemote(data);
    location.hash = "#starter"; location.reload();
  }catch(e){ toast("Konnte den Code gerade nicht prüfen. Bist du online?"); }
});
document.addEventListener("visibilitychange", () => { if (!document.hidden){ renderStarter(); if (store) refreshPermission(false); } });

// „Gerade gefüttert“ in der Benachrichtigung öffnet die App mit #fed
function handleHash(){
  if (location.hash === "#fed"){
    starter.lastFed = new Date().toISOString(); starterAction("feed"); saveStarter();
    toast("Fütterung eingetragen."); showView("starter"); return;
  }
  showView(location.hash === "#starter" ? "starter" : "bake");
}
function fillInputs(){
  $("target").value = toLocalInput(state.target);
  $("count").value = state.count; $("weight").value = state.weight;
  $("temp").value = state.temp; $("cold").checked = state.cold; $("coldH").value = state.coldH;
  $("bakeRemind").checked = state.bakeRemind;
}
function startUp(){
  fillInputs(); render(); renderStarter();
  if (starter.example) setSync("Beispielwerte. Trag ein, wann du zuletzt gefüttert hast.");
}
window.addEventListener("hashchange", handleHash);
setInterval(()=>{ renderStarter(); }, 60000);
startUp(); handleHash(); renderCode();
window.__stShown = true;

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(e => console.error(e));

(async () => {
  try{ store = await createStore(); }catch(e){ console.error(e); store = null; }
  if (store){
    syncCode = localStorage.getItem("sauerteig-code");
    if (!syncCode){ syncCode = randomCode(); localStorage.setItem("sauerteig-code", syncCode); }
    try{ if (applyRemote(await store.load(syncCode))) startUp(); }catch(e){ console.error(e); }
    store.onPush(p => { const d = p.data || {}; toast(d.title ? d.title + ": " + (d.body||"") : "Erinnerung"); });
  }
  renderCode();
  await refreshPermission(false);
})();
