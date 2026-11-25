// Sauerteig-Planer: Backplan rückwärts vom Ofen, Mengen pro Brotsorte, Starter-Erinnerungen.
import { createStore, randomCode } from "./store.js";
import { MIN, HOUR, DAY, MAX_STARTERS, FLOURS, flourOf, newStarter, exampleStarter, roomHours, starterInfo, ratio,
  starterReminders, canonical, parse, merge, buildSave } from "./starters.js";

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
  return past ? "seit "+s : "in "+s;
}

// ================= STARTER =================
// starters: alle Starter nach Kennung (gelöschte bleiben als { del: true } für den Abgleich stehen).
// sel: welcher gerade angezeigt wird (nur auf diesem Gerät). Der Starter fürs Brot steht in state.starterId.
let starters = { s1: exampleStarter(Date.now()) };
let sel = "s1";
const live = () => Object.values(starters).filter(x => !x.del).sort((a,b) => (a.created||0)-(b.created||0) || (a.id<b.id?-1:1));
const cur = () => live().find(x => x.id===sel) || live()[0] || null;
const bakeStarter = () => live().find(x => x.id===state.starterId) || live()[0] || newStarter("none","weizen",Date.now());
const infoOf = x => starterInfo(x, state.temp, Date.now());
const LEVEL = { ok:["ok","Alles gut"], soon:["warn","Bald füttern"], warn:["warn","Füttern fällig"], bad:["bad","Überfällig"] };
const RANK = ["ok","soon","warn","bad"];

// Ändert einen Starter (nur durch eine Handlung der Nutzerin aufrufen: setzt den Zeitstempel für den Abgleich)
function touch(id, change, logType){
  const x = starters[id]; if (!x || x.del) return;
  const next = { ...x, ...change, u: Math.max(Date.now(), (x.u||0)+1) };
  delete next.example;
  if (logType) next.log = [...[].concat(logType).map(type => ({ type, t:new Date().toISOString() })), ...(x.log||[])].slice(0, 40);
  starters = { ...starters, [id]: next };
  persist(); renderStarter(); render();
}
const feed = id => touch(id, { lastFed:new Date().toISOString() }, "feed");

function tipsFor(x, info){
  const t = [], f = flourOf(x), [a] = ratio(x);
  if (info.fridge){
    t.push("Glas nur locker verschließen (Deckel auflegen oder Gummiring weg). Der Starter bildet weiter Gas.");
    t.push(`Füttern im Kühlschrank-Modus: alten Starter bis auf ca. ${a} g abnehmen, frisch füttern, 1–2 h bei Raumtemperatur anspringen lassen, dann zurück in den Kühlschrank.`);
    t.push("Graue oder dunkle Flüssigkeit oben („Hooch“) ist normal und heißt: Er hat Hunger. Abgießen oder unterrühren, dann füttern.");
    t.push(x.flour==="glutenfrei"
      ? "Vor dem Backen: 1–2 Tage vorher rausholen und 2–3 Mal bei Raumtemperatur füttern, bis er wieder viele Blasen hat."
      : "Vor dem Backen: 1–2 Tage vorher rausholen und 2–3 Mal bei Raumtemperatur füttern, bis er sich in 4–6 h verdoppelt.");
    if (info.fridgeFor > 21*DAY) t.push("Länger als 3 Wochen Pause geplant? Dann lieber fester führen (doppelt so viel Mehl wie Wasser) oder einen Teil dünn auf Backpapier streichen und trocknen als Reserve.");
  } else {
    t.push(`Bei Raumtemperatur (${String(state.temp).replace(".",",")} °C) alle ${roomHours(x, state.temp)} h füttern. Wärmer heißt hungriger.`);
    if (x.flour!=="glutenfrei") t.push("Ein gesunder Starter verdoppelt sich 4–8 h nach dem Füttern, riecht angenehm säuerlich und hat viele Blasen.");
    t.push("Mit einem Gummiband am Glas markieren, wie hoch er nach dem Füttern stand. So siehst du, wann er auf dem Höhepunkt ist.");
    t.push("Willst du ein paar Tage nicht backen, stell ihn in den Kühlschrank. Das spart Mehl und Arbeit.");
  }
  if (f.tip) t.push(f.tip);
  if (x.flour==="glutenfrei") t.push("Eigenes Glas, eigenen Löffel und Mehl mit Glutenfrei-Kennzeichnung verwenden. Schon etwas Weizenstarter am Löffel macht ihn für Menschen mit Zöliakie ungeeignet.");
  if (live().length > 1) t.push("Pro Starter einen sauberen Löffel nehmen und die Gläser beschriften, damit sich die Sorten nicht vermischen.");
  t.push("Wegwerfen, wenn du rosa, orange oder pelzigen Schimmel siehst. Ein Geruch nach Nagellack oder Essig ist dagegen nur Hunger.");
  return t;
}

function renderStarterList(list, x){
  $("stList").innerHTML = list.map(y => {
    const i = infoOf(y), [c] = LEVEL[i.level];
    return `<button class="stcard" type="button" data-id="${esc(y.id)}" aria-pressed="${!!x && y.id===x.id}">
      <b>${esc(y.name || flourOf(y).name)}</b>
      <span>${esc(flourOf(y).name)} · ${i.fridge ? "Kühlschrank" : "Raumtemperatur"}</span>
      <span class="chip ${c}">${i.left>=0 ? "Füttern "+relTime(i.left) : "Füttern fällig"}</span></button>`;
  }).join("");
  $("stAdd").hidden = list.length >= MAX_STARTERS;
  const worst = list.reduce((w,y) => Math.max(w, RANK.indexOf(infoOf(y).level)), 0);
  const hungry = list.filter(y => infoOf(y).left < 0).length;
  const [cls, txt] = LEVEL[RANK[worst]];
  $("vChip").className = "chip "+cls;
  $("vChip").textContent = hungry > 1 ? hungry+" füttern" : txt;
  $("vChip").hidden = !list.length;
}

function renderStarter(){
  const list = live(), x = cur();
  renderStarterList(list, x);
  $("stDetail").hidden = $("stHints").hidden = !x;
  $("stEmpty").hidden = !!x;
  if (!x) return;
  const info = infoOf(x), f = flourOf(x);
  $("stName").textContent = (x.name || "Mein Starter") + " · " + f.name;
  $("stMode").innerHTML = info.fridge
    ? `<span class="chip cold">Im Kühlschrank</span> <span style="font-size:13px;color:var(--muted)">${esc(relTime(new Date(x.fridgeSince||x.lastFed)-Date.now()))}</span>`
    : `<span class="chip ok">Aktiv bei Raumtemperatur</span>`;
  $("stDue").textContent = info.left >= 0 ? "Füttern "+relTime(info.left) : "Füttern überfällig";
  $("stDueSub").textContent = info.left >= 0 ? "am "+longDate(info.next) : "fällig war "+longDate(info.next)+" ("+relTime(info.left)+")";
  const pct = Math.min(100, Math.max(2, info.elapsed/info.intervalMs*100));
  $("stBar").className = "bar " + (info.level==="bad"?"bad":info.level==="ok"?"":"warn");
  $("stBar").firstElementChild.style.width = pct+"%";
  $("jarFill").setAttribute("y", String(40 - Math.round((1-pct/100)*16)));
  $("jarFill").setAttribute("height", String(29 + Math.round((1-pct/100)*16)));
  $("stExample").hidden = !x.example;

  $("stActions").innerHTML = `<button class="btn" type="button" data-a="feed">Gerade gefüttert</button>` + (info.fridge
    ? `<button class="btn ghost" type="button" data-a="wake">Rausholen zum Backen</button>`
    : `<button class="btn ghost" type="button" data-a="fridge">In den Kühlschrank stellen</button>`);

  const r = ratio(x);
  $("ratioBox").innerHTML = `<p class="lbl" style="margin:0 0 6px">So fütterst du ${info.fridge?"vor dem Kühlschrank (1:3:3)":"bei Raumtemperatur (1:2:2)"}</p>
    <div class="ratio" style="margin-bottom:14px">
      <div><b>${r[0]} g</b><span>Starter</span></div><div><b>${r[1]} g</b><span>${esc(f.mehl)}</span></div><div><b>${r[2]} g</b><span>Wasser, lauwarm</span></div>
    </div>`;
  $("tipsHead").textContent = info.fridge ? "Im Kühlschrank beachten" : "Das musst du beachten";
  $("tips").innerHTML = tipsFor(x, info).map(y=>`<li>${esc(y)}</li>`).join("");

  const L = { feed:"Gefüttert", fridge:"In den Kühlschrank", wake:"Aus dem Kühlschrank geholt" };
  $("log").innerHTML = (x.log||[]).length
    ? x.log.slice(0,12).map(e=>`<li><span>${L[e.type]||esc(e.type)}</span><span>${esc(longDate(new Date(e.t)))}</span></li>`).join("")
    : `<li><span style="color:var(--muted)">Noch keine Einträge. Tipp auf „Gerade gefüttert“, wenn du ihn das nächste Mal fütterst.</span><span></span></li>`;

  if (document.activeElement !== $("lastFed")) $("lastFed").value = toLocalInput(info.last);
  if (document.activeElement !== $("stNameIn")) $("stNameIn").value = x.name || "";
  $("stFlour").value = FLOURS[x.flour] ? x.flour : "anderes";
  $("starterRemind").checked = x.remind !== false;
  const rem = starterReminders(x, state.temp, Date.now()).filter(y => y.at > Date.now());
  $("calNote").textContent = x.example ? "" : x.remind===false ? "Erinnerung für diesen Starter ist aus."
    : rem.length ? `Nächste Erinnerung: ${longDate(new Date(rem[0].at))}${rem[1] ? `, falls du dann nicht fütterst, nochmal ${longDate(new Date(rem[1].at))}` : ""}.` : "";
}
function select(id){
  sel = id; closeBoxes();
  try{ localStorage.setItem("sauerteig-sel", id); }catch(e){}
  renderStarter();
}
function closeBoxes(){ for (const b of ["fridgeBox","wakeBox","delBox","addBox"]) $(b).hidden = true; }

// ---------- Speicher & Push (Firebase, wie die anderen Apps im Repo) ----------
// Alles liegt zuerst in diesem Browser (localStorage). Mit Firebase kommt eine Kopie unter
// sauerteig/<code> dazu: für weitere Geräte und damit der Server die Erinnerungen schicken kann.
let store = null, syncCode = null, notifOk = false, leaving = false, unwatch = null, sentToken = null;
const plainState = () => ({ ...state, target: state.target.toISOString() });
const localData = () => ({ state: plainState(), starters });
function saveLocal(){
  if (leaving) return;
  try{ localStorage.setItem("sauerteig", JSON.stringify(plainState())); localStorage.setItem("sauerteig-starters", JSON.stringify(starters)); }catch(e){}
}
function persist(){ saveLocal(); syncSoon(); }

// Übernimmt einen abgeglichenen Stand; true, wenn sich etwas geändert hat
function adopt(data){
  if (canonical(data) === canonical(localData())) return false;
  starters = data.starters;
  if (data.state){
    const target = new Date(data.state.target);
    state = { ...state, ...data.state, target: isNaN(target) ? defaultTarget() : target };
    if (!BREADS[state.bread]) state.bread = "klassisch";
  }
  saveLocal();
  return true;
}
// Erinnerungen zu einem beliebigen Stand (auch einem, der gerade erst aus Firestore kam)
function remindersFor(data){
  const now = Date.now(), list = Object.values(data.starters).flatMap(x => starterReminders(x, data.state?.temp ?? 22, now));
  if (data.state?.bakeRemind){
    const s = { ...state, ...data.state, target:new Date(data.state.target) };
    const alive = Object.values(data.starters).filter(x => !x.del);
    buildPlan(s, alive.find(x => x.id===s.starterId) || alive[0]).ev.forEach((e,i) => {
      if (e.title !== QUIET) list.push({ at:e.time.getTime(), title:e.title, body:e.det.slice(0,300), tag:"bake"+i, view:"backen", fed:false });
    });
  }
  return list;
}
const bakeCount = () => buildPlan(state).ev.filter(e => e.time > new Date() && e.title !== QUIET).length;

let syncT, syncing = false, again = false;
function syncSoon(){ clearTimeout(syncT); syncT = setTimeout(syncNow, 1200); }
async function syncNow(){
  if (!store || !syncCode) return;
  if (syncing){ again = true; return; }
  syncing = true;
  try{
    let data;
    await store.commit(syncCode, remote => {
      const r = buildSave(remote, localData(), remindersFor, Date.now());
      data = r.data; return r.doc;
    });
    // Während des Speicherns kann hier weitergetippt worden sein: noch einmal zusammenführen
    if (data && adopt(merge(localData(), data))) redraw();
    setSync("");
  }catch(e){ console.error(e); setSync("Noch nicht online gespeichert. Die App versucht es wieder, sobald du Internet hast."); }
  syncing = false;
  if (again){ again = false; syncSoon(); }
}
function setSync(msg){ $("stSync").textContent = msg; }

function onRemote(doc, confirmed){
  const theirs = doc?.j ? parse(doc.j) : null;
  if (theirs){
    if (adopt(merge(localData(), theirs))) redraw();
    if (canonical(localData()) !== doc.j) syncSoon();
  }
  if (confirmed && !rolled){ rolled = true; rollTarget(); syncSoon(); }
}
let rolled = false;
// Liegt der Backtermin länger zurück, den nächsten Samstag vorschlagen. Erst nach dem Abgleich,
// damit ein lange nicht geöffnetes Gerät keinen neueren Plan überschreibt.
function rollTarget(){
  if (state.target.getTime() > Date.now() - 6*HOUR) return;
  state.target = defaultTarget(); state.bakeRemind = false;
  if (state.u > 0) state.u = Date.now();
  saveLocal(); redraw();
}

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
  let failed = false;
  if (notifOk){
    try{
      const reg = await navigator.serviceWorker.ready;
      const token = await store.pushToken(reg);
      if (!token) throw new Error("kein Token");
      if (sentToken !== token){
        await store.addToken(syncCode, token);
        sentToken = token;
        localStorage.setItem("sauerteig-token", syncCode+":"+token);
      }
    }catch(e){ console.error(e); notifOk = false; failed = true; }
  }
  $("notifState").textContent = notifOk
    ? "Benachrichtigungen sind an. Dein Handy meldet sich auch, wenn die App geschlossen ist (bis zu 5 Minuten Verzögerung)."
    : failed ? "Das Handy konnte sich gerade nicht für Benachrichtigungen anmelden. Öffne die App noch einmal, wenn du online bist."
    : Notification.permission === "denied"
      ? "Benachrichtigungen sind blockiert. Erlaube sie in den Android-Einstellungen bei der App „Sauerteig“."
      : "Benachrichtigungen sind noch aus. Erlaube sie, damit dich die App erinnern kann.";
  $("notifAllow").hidden = notifOk || failed || Notification.permission === "denied";
  $("notifTest").hidden = !notifOk;
  render();
}

function renderCode(){
  $("syncCode").textContent = syncCode || "–";
  $("syncBox").hidden = !store;
}

// ================= BACKEN =================
let state = { bread:"klassisch", target:null, count:1, weight:1000, temp:22, cold:true, coldH:12, bakeRemind:false, starterId:null, u:-1 };
const QUIET = "Teig in Ruhe gehen lassen"; // dafür gibt es keine Erinnerung

function defaultTarget(){
  const d = new Date(); d.setHours(10,0,0,0);
  let n = (6 - d.getDay() + 7) % 7; if (n < 2) n += 7;
  d.setDate(d.getDate()+n); return d;
}

function buildPlan(s, starter = bakeStarter()){
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
  const sName = starter?.name || "Anstellgut";
  const fromFridge = starter?.mode === "kuehlschrank";

  let start = feed;
  if (fromFridge){
    const wake = roundTo(add(feed, -12*60), 15);
    const w = Math.max(20, Math.ceil((st.feed+10)/25)*5); // 1:2:2 muss für die zweite Fütterung reichen
    E(wake, `${sName} aus dem Kühlschrank holen`,
      `Auf ca. ${w} g abnehmen, mit ${2*w} g ${flourOf(starter).mehl} und ${2*w} g Wasser füttern und bei Raumtemperatur stehen lassen. Im Tab „Meine Starter“ auf „Rausholen zum Backen“ tippen.`, "starter");
    start = wake;
  }
  E(feed, fromFridge ? `${sName} ein zweites Mal füttern` : `${sName} füttern`,
    `${st.feed} g Anstellgut + ${st.feed} g Mehl + ${st.feed} g Wasser verrühren (1:1:1). Bei ${s.temp} °C ist es nach etwa ${dur(peakMin)} auf dem Höhepunkt.`, "starter");
  E(autolyse,"Autolyse: Mehl + Wasser mischen",
    `Mehl und Wasser (ohne Salz und Anstellgut) grob verrühren, 45 min abgedeckt ruhen lassen.${s.bread==="schoko"?" Die Milch kommt mit dem Wasser dazu.":""}`);
  E(mix,"Anstellgut und Salz einarbeiten",
    `${st.need} g aktives Anstellgut und das Salz 5–8 min einkneten. ${b.mixDet||""} Den Rest vom Starter (ca. 20 g) behalten und füttern.`.trim());
  E(add(mix, 20), "Rest-Starter versorgen",
    "Rest mit Mehl und Wasser 1:2:2 füttern. Backst du die nächsten Tage nicht, nach 1–2 h in den Kühlschrank stellen und im Tab „Meine Starter“ eintragen.", "starter");

  const folds = s.bread==="dinkel" ? 3 : 4;
  for (let i=1;i<=folds;i++){
    E(add(bulk, 30*i), `${i}. Dehnen & Falten`,
      i===1 && b.foldIn ? b.foldIn : "Teig von allen Seiten hochziehen und übereinanderlegen, 4 Runden.");
  }
  E(add(bulk, 30*folds+5),QUIET,
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
  const starter = bakeStarter(), si = infoOf(starter);
  $("bakeStarterWrap").hidden = live().length < 2;
  $("bakeStarter").innerHTML = live().map(x => `<option value="${esc(x.id)}">${esc(x.name || flourOf(x).name)} (${esc(flourOf(x).name)})</option>`).join("");
  $("bakeStarter").value = starter.id;
  if (!starter.example && (si.level==="warn"||si.level==="bad")) al += `<div class="alert ${si.level}">${esc(starter.name||"Dein Starter")} muss gefüttert werden. <button type="button" data-go="starter">Zum Starter</button></div>`;
  if (starter.flour==="glutenfrei") al += `<div class="alert warn">Alle Brote hier enthalten Weizen oder Dinkel. Auch mit glutenfreiem Starter wird dieses Brot nicht glutenfrei.</div>`;
  if (starter.mode==="kuehlschrank") al += `<div class="alert warn">${esc(starter.name||"Dein Starter")} steht im Kühlschrank. Der Plan beginnt deshalb 12 h früher mit einer zusätzlichen Fütterung.</div>`;
  if (p.start < now) al += `<div class="alert warn">Der Plan hätte schon ${dayLabel(p.start)} um ${hm(p.start)} beginnen müssen. Wähle einen späteren Backtermin oder verkürze die Kühlschrank-Gare.</div>`;
  if (nights.length) al += `<div class="alert night">${nights.length} Schritt${nights.length>1?"e fallen":" fällt"} in die Nacht (23–6 Uhr): ${nights.map(e=>esc(e.title)+" "+hm(e.time)).join(", ")}. Tipp: „Nachtschichten vermeiden“ verschiebt die Kühlschrank-Gare passend.</div>`;
  else if (p.start >= now) al += `<div class="alert ok">Kein Schritt zwischen 23 und 6 Uhr. Gut schlafen!</div>`;
  $("alerts").innerHTML = al;

  let html = "", last = "";
  p.ev.forEach(e => {
    const k = dayKey(e.time);
    if (k!==last){ html += `<div class="day">${dayLabel(e.time)}</div>`; last=k; }
    const bell = state.bakeRemind && notifOk && e.time > now && e.title !== QUIET ? '<span class="chip bell">Erinnerung</span>' : "";
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
    <tr><td>${esc(flourOf(starter).mehl)}</td><td class="p">1</td><td class="g">${st.feed} g</td></tr>
    <tr><td>Wasser</td><td class="p">1</td><td class="g">${st.feed} g</td></tr>`;
  $("recipe").innerHTML = `<div style="overflow-x:auto"><table>
    <thead><tr><th>Zutat</th><th style="text-align:right">Bäcker-%</th><th style="text-align:right">Menge</th></tr></thead>
    <tbody>${rows}</tbody></table></div>
    <p class="note">${b.notes}</p>
    <p class="note">Bäcker-% beziehen sich auf die Mehlmenge (${g(F)} g = 100 %). Für ${state.count} × ${state.weight} g Teig. Backen: ${b.bake.map(x=>`${x[1]} min / ${x[0]} °C ${x[2]?"mit":"ohne"} Deckel`).join(" → ")}${state.count>1?", pro Brot, nacheinander oder in zwei Töpfen":""}.</p>`;
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
  changed();
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
function toast(msg){ const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(()=> t.hidden = true, 5000); }
function copyText(t, okMsg){
  const fallback = () => { const ta=document.createElement("textarea"); ta.value=t; document.body.appendChild(ta); ta.select(); try{document.execCommand("copy"); toast(okMsg);}catch(e){toast("Kopieren nicht möglich.");} ta.remove(); };
  try{ navigator.clipboard.writeText(t).then(()=>toast(okMsg), fallback); }catch(e){ fallback(); }
}

// Nach jeder Änderung am Backplan durch die Nutzerin
function changed(){ state.u = Math.max(Date.now(), state.u+1); persist(); render(); }
function load(){
  try{
    const s = JSON.parse(localStorage.getItem("sauerteig")||"null");
    if (s){ state = { ...state, u:0, ...s, target:new Date(s.target) }; if (!BREADS[state.bread]) state.bread="klassisch"; }
  }catch(e){}
  if (!state.target || isNaN(state.target)) state.target = defaultTarget();
  try{
    const all = JSON.parse(localStorage.getItem("sauerteig-starters")||"null"), old = JSON.parse(localStorage.getItem("sauerteig-starter")||"null");
    if (all) starters = all;
    else if (old) starters = parse(JSON.stringify({ state, starter:old })).starters; // bis Version 1 gab es nur einen
    sel = localStorage.getItem("sauerteig-sel") || sel;
  }catch(e){}
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
$("stFlour").innerHTML = $("addFlour").innerHTML = Object.entries(FLOURS).map(([k,f]) => `<option value="${k}">${f.name}</option>`).join("");

$("breads").addEventListener("click", e => { const b=e.target.closest(".bread"); if(b){ state.bread=b.dataset.k; changed(); } });
$("target").addEventListener("change", e => { const d=new Date(e.target.value); if(!isNaN(d)){ state.target=d; changed(); } });
$("count").addEventListener("change", e => { state.count=+e.target.value; changed(); });
$("weight").addEventListener("change", e => { state.weight=+e.target.value; changed(); });
$("temp").addEventListener("input", e => { state.temp=+e.target.value; changed(); renderStarter(); });
$("cold").addEventListener("change", e => { state.cold=e.target.checked; changed(); });
$("coldH").addEventListener("input", e => { state.coldH=+e.target.value; changed(); });
$("bakeStarter").addEventListener("change", e => { state.starterId=e.target.value; changed(); });
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
$("alerts").addEventListener("click", e => { if (e.target.dataset.go==="starter"){ select(bakeStarter().id); showView("starter"); } });

// Starter-Aktionen
$("stList").addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (b) select(b.dataset.id); });
$("stAdd").addEventListener("click", () => {
  closeBoxes(); $("addBox").hidden = false;
  const used = new Set(live().filter(x => !x.example).map(x => x.flour));
  $("addFlour").value = Object.keys(FLOURS).find(k => !used.has(k)) || "anderes";
  $("addName").value = ""; $("addFed").value = toLocalInput(new Date()); $("addFridge").checked = false;
  addHint(); $("addName").focus();
});
function addHint(){ $("addName").placeholder = FLOURS[$("addFlour").value].name + "-Sauerteig"; }
$("addFlour").addEventListener("change", addHint);
$("addCancel").addEventListener("click", closeBoxes);
$("addGo").addEventListener("click", () => {
  const now = Date.now(), id = randomCode(6), flour = $("addFlour").value, fed = new Date($("addFed").value);
  if (isNaN(fed) || fed > now + MIN){ toast("Wann wurde er zuletzt gefüttert? Der Zeitpunkt darf nicht in der Zukunft liegen."); return; }
  const x = newStarter(id, flour, now, { created:now, lastFed:fed.toISOString() });
  x.name = $("addName").value.trim().slice(0,40) || x.name;
  if ($("addFridge").checked){ x.mode = "kuehlschrank"; x.fridgeSince = fed.toISOString(); }
  // Das Beispiel verschwindet mit dem ersten echten Starter
  starters = { ...Object.fromEntries(Object.entries(starters).filter(([,y]) => !y.example)), [id]: x };
  select(id); persist(); render(); toast(x.name+" angelegt.");
});
$("stActions").addEventListener("click", e => {
  const a = e.target.closest("[data-a]")?.dataset.a, x = cur(); if (!a || !x) return;
  closeBoxes();
  if (a==="feed"){ feed(x.id); toast((x.name||"Starter")+": Fütterung eingetragen."); }
  if (a==="fridge"){ $("fridgeDays").value = x.fridgeDays || flourOf(x).days; $("fridgeDaysOut").textContent = $("fridgeDays").value+" Tage"; $("fridgeFed").checked = true; $("fridgeBox").hidden=false; }
  if (a==="wake"){ $("wakeFed").checked = true; $("wakeBox").hidden=false; }
});
$("fridgeDays").addEventListener("input", e => $("fridgeDaysOut").textContent = e.target.value+" Tage");
$("fridgeCancel").addEventListener("click", closeBoxes);
$("wakeCancel").addEventListener("click", closeBoxes);
$("fridgeGo").addEventListener("click", () => {
  const x = cur(), now = new Date().toISOString(), days = +$("fridgeDays").value, fed = $("fridgeFed").checked;
  touch(x.id, { mode:"kuehlschrank", fridgeSince:now, fridgeDays:days, ...(fed ? { lastFed:now } : {}) }, fed ? ["fridge","feed"] : ["fridge"]);
  closeBoxes(); toast(`${x.name||"Starter"} ist im Kühlschrank. ${fed ? `Nächste Fütterung in ${days} Tagen.` : "Gerechnet wird ab der letzten Fütterung."}`);
});
$("wakeGo").addEventListener("click", () => {
  const x = cur(), fed = $("wakeFed").checked;
  touch(x.id, { mode:"aktiv", fridgeSince:null, ...(fed ? { lastFed:new Date().toISOString() } : {}) }, fed ? ["feed","wake"] : ["wake"]);
  closeBoxes(); toast((x.name||"Starter")+" ist wieder aktiv. Füttere ihn noch 1–2 Mal, bevor du backst.");
});
$("stDel").addEventListener("click", () => {
  const x = cur(); closeBoxes();
  $("delText").textContent = `„${x.name||"Starter"}“ mit seinem Verlauf auf allen Geräten löschen? Das lässt sich nicht rückgängig machen.`;
  $("delBox").hidden = false;
});
$("delCancel").addEventListener("click", closeBoxes);
$("delGo").addEventListener("click", () => {
  const x = cur();
  starters = { ...starters, [x.id]: { id:x.id, del:true, u: Math.max(Date.now(), (x.u||0)+1) } };
  closeBoxes(); persist(); renderStarter(); render(); toast((x.name||"Starter")+" gelöscht.");
});
$("lastFed").addEventListener("change", e => { const d = new Date(e.target.value), x = cur(); if (x && !isNaN(d) && d <= new Date()) touch(x.id, { lastFed:d.toISOString() }); });
let nameT;
$("stNameIn").addEventListener("input", e => { const id = cur()?.id, v = e.target.value; clearTimeout(nameT); nameT = setTimeout(() => touch(id, { name:v.trim().slice(0,40) }), 700); });
$("stFlour").addEventListener("change", e => { const x = cur(); touch(x.id, { flour:e.target.value, ...(x.mode!=="kuehlschrank" ? { fridgeDays:FLOURS[e.target.value].days } : {}) }); });
// Erinnerungen
$("starterRemind").addEventListener("change", e => { const x = cur(); if (x) touch(x.id, { remind:e.target.checked }); });
$("bakeRemind").addEventListener("change", async e => {
  state.bakeRemind = e.target.checked;
  if (state.bakeRemind && !notifOk) await refreshPermission(true);
  if (state.bakeRemind && !notifOk){ toast("Ohne Erlaubnis für Benachrichtigungen kann die App nicht erinnern."); }
  else if (state.bakeRemind) toast(`${bakeCount()} Erinnerungen für diesen Backplan gestellt.`);
  changed();
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
    if (code === syncCode){ toast("Das ist schon der Code dieses Geräts."); return; }
    clearTimeout(syncT); leaving = true; unwatch?.();
    // Vom alten Code abmelden, sonst kämen dessen Erinnerungen weiter auf dieses Gerät
    const token = (localStorage.getItem("sauerteig-token")||"").split(":").slice(1).join(":");
    if (token) await store.removeToken(syncCode, token).catch(e => console.error(e));
    localStorage.removeItem("sauerteig-token"); localStorage.removeItem("sauerteig-starter"); localStorage.removeItem("sauerteig-sel");
    const r = parse(data.j);
    localStorage.setItem("sauerteig-code", code);
    localStorage.setItem("sauerteig-starters", JSON.stringify(r.starters));
    if (r.state) localStorage.setItem("sauerteig", JSON.stringify(r.state));
    syncCode = null; location.hash = "#starter"; location.reload();
  }catch(e){ leaving = false; toast("Konnte den Code gerade nicht prüfen. Bist du online?"); }
});
document.addEventListener("visibilitychange", () => { if (!document.hidden){ renderStarter(); syncSoon(); if (store) refreshPermission(false); } });
window.addEventListener("online", syncSoon);

// Links aus Benachrichtigungen: #starter-<id> zeigt den Starter, #fed-<id> trägt die Fütterung ein.
// #fed ohne Kennung kommt von der Test-Benachrichtigung und trägt nichts ein.
function handleHash(){
  const [, what, id] = location.hash.match(/^#(starter|fed|backen)(?:-([a-z0-9]+))?$/) || [];
  if (what === "fed"){
    showView("starter");
    if (!id){ toast("Der Test hat geklappt. Es wurde keine Fütterung eingetragen."); return; }
    // Erst den neuesten Stand abwarten, damit nichts von einem anderen Gerät überschrieben wird
    ready.then(() => {
      if (!starters[id] || starters[id].del){ toast("Diesen Starter gibt es nicht mehr."); return; }
      select(id); feed(id); toast((starters[id].name||"Starter")+": Fütterung eingetragen.");
    });
    return;
  }
  if (id) select(id);
  showView(what === "starter" ? "starter" : "bake");
}
function fillInputs(){
  if (document.activeElement !== $("target")) $("target").value = toLocalInput(state.target);
  $("count").value = state.count; $("weight").value = state.weight;
  $("temp").value = state.temp; $("cold").checked = state.cold; $("coldH").value = state.coldH;
  $("bakeRemind").checked = state.bakeRemind;
}
function redraw(){ fillInputs(); render(); renderStarter(); }

let isReady; const ready = new Promise(r => isReady = r);
redraw(); handleHash(); renderCode();
window.__stShown = true;
window.addEventListener("hashchange", handleHash);
setInterval(renderStarter, 60000);

// ?demo = alles nur auf diesem Gerät, ohne Firebase
const demo = new URLSearchParams(location.search).has("demo");
if (!demo && "serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js").catch(e => console.error(e));
  navigator.serviceWorker.addEventListener("message", e => {
    if (e.data?.type === "open") location.hash = new URL(e.data.link).hash;
  });
}

(async () => {
  if (!demo) try{ store = await createStore(); }catch(e){ console.error(e); store = null; }
  if (store){
    syncCode = localStorage.getItem("sauerteig-code");
    if (!syncCode){ syncCode = randomCode(); localStorage.setItem("sauerteig-code", syncCode); }
    setTimeout(isReady, 4000);
    unwatch = store.watch(syncCode, (doc, confirmed) => { onRemote(doc, confirmed); if (confirmed) isReady(); },
      e => { console.error(e); setSync("Konnte den Stand nicht online abgleichen. Öffne die App noch einmal."); isReady(); });
    store.onPush(p => { const d = p.data || {}; toast(d.title ? d.title + ": " + (d.body||"") : "Erinnerung"); });
  } else { rollTarget(); isReady(); }
  renderCode();
  await refreshPermission(false);
})();
