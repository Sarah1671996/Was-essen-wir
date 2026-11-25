// Sauerteig-Planer: Oberfläche. Gerechnet wird in recipes.js (Mengen), plan.js (Zeitplan) und starters.js (Starter, Abgleich).
import { createStore, randomCode } from "./store.js";
import { MIN, HOUR, DAY, MAX_STARTERS, FLOURS, flourOf, newStarter, exampleStarter, roomHours, starterInfo, ratio, starterReminders,
  peakHours24, peakMin, canMeasure, withPeak, tripDates, tripAdvice, canonical, parse, normalize, merge, buildSave } from "./starters.js";
import { BREADS, amounts, gram } from "./recipes.js";
import { buildPlan, tick, untick, later, allReminders, breadOf, dur } from "./plan.js";
import { initEditor } from "./editor.js";
import { initDiary } from "./diary.js";

// ---------- Hilfen ----------
const $ = id => document.getElementById(id);
const WD = ["So","Mo","Di","Mi","Do","Fr","Sa"];
const WDL = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
const p2 = n => String(n).padStart(2,"0");
const de = x => String(x).replace(".",",");
const hm = d => p2(d.getHours())+":"+p2(d.getMinutes());
const dayKey = d => d.getFullYear()+"-"+d.getMonth()+"-"+d.getDate();
const dayLabel = d => WDL[d.getDay()]+", "+d.getDate()+"."+(d.getMonth()+1)+".";
const short = d => WD[d.getDay()]+" "+hm(d);
const longDate = d => WD[d.getDay()]+" "+d.getDate()+"."+(d.getMonth()+1)+"., "+hm(d)+" Uhr";
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toLocalInput = d => d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate())+"T"+p2(d.getHours())+":"+p2(d.getMinutes());
function relTime(ms){
  const a = Math.abs(ms), s = a < HOUR ? Math.max(1,Math.round(a/MIN))+" min" : a < 2*DAY ? Math.round(a/HOUR)+" h" : Math.round(a/DAY)+" Tagen";
  return (ms < 0 ? "seit " : "in ")+s;
}
const read = k => { try{ return JSON.parse(localStorage.getItem(k)||"null"); }catch(e){ return null; } };
const put = (k,v) => { try{ localStorage.setItem(k, v); }catch(e){} };
let toastT;
function toast(msg){ const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(()=> t.hidden = true, 5000); }
function copyText(t, okMsg){
  const fallback = () => { const ta=document.createElement("textarea"); ta.value=t; document.body.appendChild(ta); ta.select(); try{document.execCommand("copy"); toast(okMsg);}catch(e){toast("Kopieren nicht möglich.");} ta.remove(); };
  try{ navigator.clipboard.writeText(t).then(()=>toast(okMsg), fallback); }catch(e){ fallback(); }
}

// ---------- Stand ----------
// data = { state, starters, recipes, diary }; state.target ist hier ein Datum, gespeichert wird Text.
// u im Backplan: -1 = noch nie etwas eingestellt (verliert beim Abgleich immer)
function defaultTarget(){
  const d = new Date(); d.setHours(10,0,0,0);
  let n = (6 - d.getDay() + 7) % 7; if (n < 2) n += 7;
  d.setDate(d.getDate()+n); return d;
}
let state = { bread:"klassisch", target:defaultTarget(), count:1, weight:1000, temp:22, cold:true, coldH:12, bakeRemind:false, starterId:null, run:null, trip:null, u:-1 };
let data = normalize({ starters:{ s1: exampleStarter(Date.now()) } });
let sel = "s1"; // welcher Starter angezeigt wird (nur auf diesem Gerät)
let store = null, syncCode = null, notifOk = false, leaving = false, unwatch = null, sentToken = null;

const plainState = () => ({ ...state, target:state.target.toISOString() });
const localData = () => ({ ...data, state:plainState() });
function saveLocal(){
  if (leaving) return;
  put("sauerteig", JSON.stringify(plainState()));
  const { state:_, starters, ...rest } = data;
  put("sauerteig-starters", JSON.stringify(starters)); put("sauerteig-mehr", JSON.stringify(rest));
}
function persist(){ saveLocal(); syncSoon(); }
function takeState(s){
  const target = new Date(s.target);
  state = { ...state, ...s, target:isNaN(target) ? defaultTarget() : target };
}
function load(){
  const s = read("sauerteig"), all = read("sauerteig-starters"), old = read("sauerteig-starter"), rest = read("sauerteig-mehr");
  if (s) takeState({ u:0, ...s });
  if (all) data = normalize({ ...rest, starters:all });
  else if (old) data = parse(JSON.stringify({ state:plainState(), starter:old })); // bis Version 1 gab es nur einen
  try{ sel = localStorage.getItem("sauerteig-sel") || sel; }catch(e){}
}

const stamp = old => Math.max(Date.now(), (old?.u||0)+1);
// Nach jeder Änderung am Backplan durch die Nutzerin
function changed(){ state.u = stamp(state); persist(); render(); }
// Legt einen Eintrag in einer Sammlung an oder ersetzt ihn; del markiert ihn als gelöscht
function setItem(col, id, item){ data = { ...data, [col]:{ ...data[col], [id]:{ ...item, id, u:stamp(data[col][id]) } } }; persist(); redraw(); }
const delItem = (col, id) => setItem(col, id, { del:true });

const live = () => Object.values(data.starters).filter(x => !x.del).sort((a,b) => (a.created||0)-(b.created||0) || (a.id<b.id?-1:1));
const cur = () => live().find(x => x.id===sel) || live()[0] || null;
const bakeStarter = () => live().find(x => x.id===state.starterId) || live()[0] || newStarter("none","weizen",Date.now());
const bread = () => breadOf(state.bread, data.recipes);
const plan = (s = state) => buildPlan(s, bakeStarter(), breadOf(s.bread, data.recipes));
const infoOf = x => starterInfo(x, state.temp, Date.now());
const away = () => { const d = tripDates(state.trip), n = Date.now(); return !!d && n >= d.from && n < d.back; };
const LEVEL = { ok:["ok","Alles gut"], soon:["warn","Bald füttern"], warn:["warn","Füttern fällig"], bad:["bad","Überfällig"] };
const RANK = ["ok","soon","warn","bad"];

// Ändert einen Starter (nur durch eine Handlung der Nutzerin aufrufen: setzt den Zeitstempel für den Abgleich)
function touch(id, change, logType, when = Date.now()){
  const x = data.starters[id]; if (!x || x.del) return;
  const next = { ...x, ...change };
  delete next.example;
  if (logType) next.log = [...[].concat(logType).map(type => ({ type, t:new Date(when).toISOString() })), ...(x.log||[])].sort((a,b)=> a.t<b.t?1:a.t>b.t?-1:0).slice(0, 40);
  setItem("starters", id, next);
}
const feed = (id, when = Date.now()) => touch(id, { lastFed:new Date(when).toISOString() }, "feed", when);

// ================= STARTER =================
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
    t.push(`Bei Raumtemperatur (${de(state.temp)} °C) alle ${roomHours(x, state.temp)} h füttern. Wärmer heißt hungriger.`);
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
  const trip = away();
  $("stList").innerHTML = list.map(y => {
    const i = infoOf(y), [c] = LEVEL[i.level];
    return `<button class="stcard" type="button" data-id="${esc(y.id)}" aria-pressed="${!!x && y.id===x.id}">
      <b>${esc(y.name || flourOf(y).name)}</b>
      <span>${esc(flourOf(y).name)} · ${i.fridge ? "Kühlschrank" : "Raumtemperatur"}</span>
      <span class="chip ${trip ? "cold" : c}">${trip ? "Urlaub" : i.left>=0 ? "Füttern "+relTime(i.left) : "Füttern fällig"}</span></button>`;
  }).join("");
  $("stAdd").hidden = list.length >= MAX_STARTERS;
  const worst = list.reduce((w,y) => Math.max(w, RANK.indexOf(infoOf(y).level)), 0);
  const hungry = list.filter(y => infoOf(y).left < 0).length;
  const [cls, txt] = trip ? ["cold","Urlaub"] : LEVEL[RANK[worst]];
  $("vChip").className = "chip "+cls;
  $("vChip").textContent = !trip && hungry > 1 ? hungry+" füttern" : txt;
  $("vChip").hidden = !list.length;
}

function renderPeak(x, info){
  const now = Date.now(), n = (x.peaks||[]).length, h = peakHours24(x);
  $("peakBox").hidden = info.fridge || !!x.example;
  const at = new Date(new Date(x.lastFed).getTime() + peakMin(x, state.temp)*MIN);
  $("peakInfo").textContent = (h ? `Dein Starter braucht bei ${de(state.temp)} °C etwa ${dur(peakMin(x, state.temp))} bis zum Höhepunkt (aus ${n === 1 ? "1 Messung" : Math.min(n,5)+" Messungen"}). Der Backplan rechnet damit.`
    : `Noch nicht gemessen. Der Backplan rechnet mit ${dur(peakMin(x, state.temp))}, einem üblichen Wert bei ${de(state.temp)} °C.`)
    + (at > now && now - new Date(x.lastFed) < DAY ? ` Nächster Höhepunkt: etwa ${hm(at)} Uhr.` : "");
  $("peakGo").hidden = !canMeasure(x, now);
  $("peakHint").hidden = canMeasure(x, now);
  $("peakHint").textContent = x.peaks?.[0]?.fedAt === x.lastFed ? `Für diese Fütterung gemessen: ${dur(x.peaks[0].h*60)}.`
    : now - new Date(x.lastFed) > DAY ? "Nach dem nächsten Füttern kannst du messen." : "Messen geht ab 1,5 h nach dem Füttern.";
  $("peakUndo").hidden = x.peaks?.[0]?.fedAt !== x.lastFed;
}

function renderStarter(){
  const list = live(), x = cur();
  renderStarterList(list, x);
  renderTrip(list);
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
  renderPeak(x, info);

  const r = ratio(x);
  $("ratioBox").innerHTML = `<p class="lbl" style="margin:0 0 6px">So fütterst du ${info.fridge?"vor dem Kühlschrank (1:3:3)":"bei Raumtemperatur (1:2:2)"}</p>
    <div class="ratio" style="margin-bottom:14px">
      <div><b>${r[0]} g</b><span>Starter</span></div><div><b>${r[1]} g</b><span>${esc(f.mehl)}</span></div><div><b>${r[2]} g</b><span>Wasser, lauwarm</span></div>
    </div>`;
  $("tipsHead").textContent = info.fridge ? "Im Kühlschrank beachten" : "Das musst du beachten";
  $("tips").innerHTML = tipsFor(x, info).map(y=>`<li>${esc(y)}</li>`).join("");

  const L = { feed:"Gefüttert", fridge:"In den Kühlschrank", wake:"Aus dem Kühlschrank geholt", peak:"Höhepunkt erreicht" };
  $("log").innerHTML = (x.log||[]).length
    ? x.log.slice(0,12).map(e=>`<li><span>${L[e.type]||esc(e.type)}</span><span>${esc(longDate(new Date(e.t)))}</span></li>`).join("")
    : `<li><span style="color:var(--muted)">Noch keine Einträge. Tipp auf „Gerade gefüttert“, wenn du ihn das nächste Mal fütterst.</span><span></span></li>`;

  if (document.activeElement !== $("lastFed")) $("lastFed").value = toLocalInput(info.last);
  if (document.activeElement !== $("stNameIn")) $("stNameIn").value = x.name || "";
  $("stFlour").value = FLOURS[x.flour] ? x.flour : "anderes";
  $("starterRemind").checked = x.remind !== false;
  const rem = starterReminders(x, state.temp, Date.now(), state.trip).filter(y => y.at > Date.now());
  $("calNote").textContent = x.example ? "" : x.remind===false ? "Erinnerung für diesen Starter ist aus."
    : rem.length ? `Nächste Erinnerung: ${longDate(new Date(rem[0].at))}${rem[1] ? `, falls du dann nicht fütterst, nochmal ${longDate(new Date(rem[1].at))}` : ""}.` : "";
}
function select(id){ sel = id; closeBoxes(); put("sauerteig-sel", id); renderStarter(); }
function closeBoxes(){ for (const b of ["fridgeBox","wakeBox","delBox","addBox"]) $(b).hidden = true; }

// ---------- Urlaub ----------
function renderTrip(list){
  const d = tripDates(state.trip), real = list.filter(x => !x.example);
  if (document.activeElement !== $("tripFrom")) $("tripFrom").value = state.trip?.from || "";
  if (document.activeElement !== $("tripTo")) $("tripTo").value = state.trip?.to || "";
  $("tripDel").hidden = !state.trip;
  $("tripCold").hidden = !d || Date.now() > d.back || !real.some(x => x.mode !== "kuehlschrank");
  const KIND = { fridge:"normal füttern und kühlen", stiff:"fest füttern und kühlen", dry:"fest füttern und eine Sicherung trocknen" };
  $("tripOut").innerHTML = !d ? "" : `<p style="margin:0">Du bist ${d.days} ${d.days===1?"Tag":"Tage"} weg. ${d.back < Date.now() ? "Willkommen zurück!" : "Unterwegs kommen keine Fütter-Erinnerungen. Am Abend der Rückkehr meldet sich die App, wenn ein Starter Futter braucht."}</p>`
    + (real.length ? real.map(x => { const a = tripAdvice(x, state.trip);
        return `<div><b>${esc(x.name || flourOf(x).name)}</b> <span class="note">${KIND[a.kind]}</span><ul class="tips">${[...a.before, ...a.after].map(y=>`<li>${esc(y)}</li>`).join("")}</ul></div>`; }).join("")
      : `<p class="note" style="margin:0">Leg zuerst einen Starter an, dann steht hier, wie du ihn versorgst.</p>`);
}

// ================= ABGLEICH & PUSH =================
// Alles liegt zuerst in diesem Browser (localStorage). Mit Firebase kommt eine Kopie unter
// sauerteig/<code> dazu: für weitere Geräte und damit der Server die Erinnerungen schicken kann.
// Übernimmt einen abgeglichenen Stand; true, wenn sich etwas geändert hat
function adopt(next){
  if (canonical(next) === canonical(localData())) return false;
  data = next;
  if (next.state) takeState(next.state);
  saveLocal();
  return true;
}
let syncT, syncing = false, again = false, remoteSync = 0;
function syncSoon(){ clearTimeout(syncT); syncT = setTimeout(syncNow, 1200); }
async function syncNow(){
  if (!store || !syncCode || leaving) return;
  if (syncing){ again = true; return; }
  syncing = true;
  try{
    let out;
    await store.commit(syncCode, remote => {
      const r = buildSave(remote, localData(), d => allReminders(d, Date.now()), Date.now());
      out = r.data;
      if (r.doc && r.doc.j.length > 480000) throw new Error("zu voll");
      return r.doc;
    });
    // Während des Speicherns kann hier weitergetippt worden sein: noch einmal zusammenführen
    if (out && adopt(merge(localData(), out))) redraw();
    setSync("");
  }catch(e){
    console.error(e);
    setSync(e.message === "zu voll" ? "Der Speicher ist voll. Lösch alte Tagebuch-Einträge, damit wieder online gespeichert wird."
      : "Noch nicht online gespeichert. Die App versucht es wieder, sobald du Internet hast.");
  }
  syncing = false;
  if (again){ again = false; syncSoon(); }
}
function setSync(msg){ $("stSync").textContent = msg; }

let rolled = false;
function onRemote(doc, confirmed){
  if (leaving) return;
  const theirs = doc?.j ? parse(doc.j) : null;
  if (theirs){
    if (adopt(merge(localData(), theirs))) redraw();
    // Höchstens einmal pro Minute von sich aus antworten, falls irgendwo noch eine ältere App-Version offen ist
    if (canonical(localData()) !== doc.j && Date.now() - remoteSync > MIN){ remoteSync = Date.now(); syncSoon(); }
  }
  if (confirmed && !rolled){ rolled = true; rollTarget(); syncSoon(); }
}
// Liegt der Backtag länger zurück, den nächsten Samstag vorschlagen. Erst nach dem Abgleich,
// damit ein lange nicht geöffnetes Gerät keinen neueren Plan überschreibt.
function rollTarget(){
  if (Math.max(state.target.getTime() + 6*HOUR, state.run ? plan().last.getTime() + 12*HOUR : 0) > Date.now()) return;
  state = { ...state, target:defaultTarget(), bakeRemind:false, run:null, u:state.u > 0 ? stamp(state) : state.u };
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
        put("sauerteig-token", syncCode+":"+token);
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
function renderCode(){ $("syncCode").textContent = syncCode || "–"; $("syncBox").hidden = !store; }

// ================= BACKEN =================
let asking = null; // Schritt, bei dem gerade gefragt wird, wann er erledigt wurde
let moving = null; // Schritt, bei dem „Später“ offen ist

function renderBreads(){
  const own = Object.values(data.recipes).filter(r => !r.del).sort((a,b) => a.name.localeCompare(b.name,"de"));
  const btn = (k, name, hint) => `<button class="bread" type="button" data-k="${esc(k)}" aria-pressed="${k===activeBread()}" ${state.run?"disabled":""}><b>${esc(name)}</b><span>${esc(hint)}</span></button>`;
  $("breads").innerHTML = Object.entries(BREADS).map(([k,b]) => btn(k, b.name, b.hint)).join("") + own.map(r => btn(r.id, r.name, r.gf ? "Eigenes Rezept, glutenfrei geführt" : "Eigenes Rezept")).join("");
  $("reEdit").hidden = !data.recipes[activeBread()] || !!state.run;
}
const activeBread = () => BREADS[state.bread] || (data.recipes[state.bread] && !data.recipes[state.bread].del) ? state.bread : "klassisch";

function glutenAlert(b, starter){
  const gf = starter.flour === "glutenfrei", other = live().find(x => x.flour === "glutenfrei");
  if (b.gf && !gf) return `<div class="alert bad">${starter.flour==="anderes" ? `Prüfe, ob das Mehl von „${esc(starter.name)}“ glutenfrei ist.` : `„${esc(starter.name)}“ enthält Gluten. Damit wird das Brot <b>nicht glutenfrei</b>, auch wenn alle anderen Zutaten es sind.`}
    ${other ? `<button type="button" data-gf="${esc(other.id)}">„${esc(other.name)}“ nehmen</button>` : `Leg unter „Meine Starter“ einen glutenfreien Starter an.`}</div>`;
  if (b.gf) return `<div class="alert ok">Glutenfreier Teig mit glutenfreiem Starter. Achte auf die Kennzeichnung bei allen Zutaten und auf saubere Schüsseln, Körbchen und Formen.${b.own ? " Bei eigenen Rezepten prüft die App deine Zutaten nicht." : " Buchweizen ist trotz des Namens kein Weizen."}</div>`;
  if (gf) return `<div class="alert warn">Dieses Brot wird nicht glutenfrei: Der Teig selbst besteht aus Mehl mit Gluten. Glutenfrei wird es nur mit glutenfreiem Mehl <b>und</b> glutenfreiem Starter, zum Beispiel beim „Glutenfreien Brot“.</div>`;
  return "";
}

function render(){
  const b = bread(), p = plan(), starter = bakeStarter(), am = amounts(b, state.count*state.weight), now = new Date(), run = state.run;
  $("tempOut").textContent = de(state.temp)+" °C";
  $("coldOut").textContent = de(state.coldH)+" h";
  $("coldWrap").hidden = !state.cold;
  renderBreads();
  for (const id of ["target","cold","coldH","bakeStarter","optimize","count","weight"]) $(id).disabled = !!run;
  $("runBox").hidden = !run;
  if (run){
    $("runText").textContent = `Backtag läuft: ${p.doneCount} von ${p.total} Schritten erledigt.` + (p.next ? ` Als Nächstes: ${p.next.title} (${short(p.next.time)}).` : " Alles geschafft!");
    $("runBar").style.width = Math.round(p.doneCount/p.total*100)+"%";
  }

  $("summary").innerHTML = `
    <div><span class="lbl">Los geht's</span><span class="v">${short(p.start)}</span></div>
    <div><span class="lbl">Im Ofen</span><span class="v">${short(p.bake)}</span></div>
    <div><span class="lbl">Gesamt</span><span class="v">${dur((p.bake-p.start)/MIN)}</span></div>
    <div><span class="lbl">Teig</span><span class="v">${am.total} g</span></div>
    <div><span class="lbl">Hydration</span><span class="v">${Math.round(am.hydr)} %</span></div>`;

  let al = "";
  const si = infoOf(starter), nights = p.ev.filter(e => e.night && e.time > now), shift = Math.round((p.bake-state.target)/MIN);
  $("bakeStarterWrap").hidden = live().length < 2;
  $("bakeStarter").innerHTML = live().map(x => `<option value="${esc(x.id)}">${esc(x.name || flourOf(x).name)} (${esc(flourOf(x).name)})</option>`).join("");
  $("bakeStarter").value = starter.id;
  al += glutenAlert(b, starter);
  if (run && shift) al += `<div class="alert warn">Das Backen verschiebt sich um ${dur(Math.abs(shift))} nach ${shift>0?"hinten":"vorn"}: jetzt ${longDate(p.bake)}.</div>`;
  if (!starter.example && !run && !away() && (si.level==="warn"||si.level==="bad")) al += `<div class="alert ${si.level}">${esc(starter.name||"Dein Starter")} muss gefüttert werden. <button type="button" data-go="starter">Zum Starter</button></div>`;
  if (!run && starter.mode==="kuehlschrank") al += `<div class="alert warn">${esc(starter.name||"Dein Starter")} steht im Kühlschrank. Der Plan beginnt deshalb 12 h früher mit einer zusätzlichen Fütterung.</div>`;
  if (!run && p.start < now) al += `<div class="alert warn">Der Plan hätte schon ${dayLabel(p.start)} um ${hm(p.start)} beginnen müssen. Wähle einen späteren Backtermin oder verkürze die Kühlschrank-Gare. Hast du schon angefangen, hake die erledigten Schritte ab.</div>`;
  if (nights.length) al += `<div class="alert night">${nights.length} Schritt${nights.length>1?"e fallen":" fällt"} in die Nacht (23–6 Uhr): ${nights.map(e=>esc(e.title)+" "+hm(e.time)).join(", ")}.${run ? "" : " Tipp: „Nachtschichten vermeiden“ verschiebt die Kühlschrank-Gare passend."}</div>`;
  else if (!run && p.start >= now) al += `<div class="alert ok">Kein Schritt zwischen 23 und 6 Uhr. Gut schlafen!</div>`;
  $("alerts").innerHTML = al;

  let html = "", last = "";
  p.ev.forEach(e => {
    const k = dayKey(e.time), moved = Math.round((e.time-e.plan)/MIN), isNext = run && p.next?.key === e.key;
    if (k!==last){ html += `<div class="day">${dayLabel(e.time)}</div>`; last=k; }
    const chips = (e.done ? '<span class="chip ok">Erledigt</span>' : "") + (isNext ? '<span class="chip next">Als Nächstes</span>' : "") + (e.night ? '<span class="chip n">Nachts</span>' : "")
      + (!e.done && Math.abs(moved)>=1 && run ? `<span class="chip warn">${moved>0?"+":"−"}${dur(Math.abs(moved))}</span>` : "")
      + (state.bakeRemind && notifOk && !e.done && !e.silent && e.time > now ? '<span class="chip bell">Erinnerung</span>' : "");
    let act = "";
    if (e.silent) act = "";
    else if (e.done) act = `<button class="lnk" type="button" data-un="${e.key}">Rückgängig</button>`;
    else if (asking === e.key) act = `<div class="askbox">${e.time > now ? `Das ist erst für ${short(e.time)} geplant. Schon erledigt?` : "Wann hast du das gemacht?"}${(n => n ? ` ${n===1 ? "Ein früherer Schritt gilt" : n+" frühere Schritte gelten"} dann auch als erledigt.` : "")(tick(state, starter, b, e.key, now.getTime()).auto.length)}<div class="btns">${e.time > now ? "" : `<button class="btn" type="button" data-at="plan" data-k="${e.key}">Wie geplant, ${hm(e.time)}</button>`}<button class="btn ghost" type="button" data-at="now" data-k="${e.key}">Gerade eben, ${hm(now)}</button><button class="btn plain" type="button" data-at="no">Abbrechen</button></div></div>`;
    else if (moving === e.key) act = `<div class="askbox">Um wie viel später?<div class="btns">${[15,30,60,120].map(m=>`<button class="btn ghost" type="button" data-mv="${m}" data-k="${e.key}">${dur(m)}</button>`).join("")}<button class="btn plain" type="button" data-at="no">Abbrechen</button></div></div>`;
    else act = `<button class="lnk" type="button" data-done="${e.key}">Erledigt</button>${e.key==="cut" ? "" : `<button class="lnk" type="button" data-later="${e.key}">Später</button>`}`;
    html += `<div class="ev ${e.kind} ${e.night?"isnight":""} ${e.done?"isdone":""} ${isNext?"isnext":""}">
      <div class="t">${hm(e.time)}</div><div class="rail"><span class="dot"></span></div>
      <div class="body"><div class="title">${esc(e.title)} ${chips}</div><div class="det">${esc(e.det)}</div><div class="acts">${act}</div></div></div>`;
  });
  $("plan").innerHTML = html;

  const F = am.F, line = (n,pc) => `<tr><td>${esc(n)}</td><td class="p">${de(Math.round(pc*10)/10)} %</td><td class="g">${gram(F*pc/100)} g</td></tr>`;
  let rows = `<tr class="grp"><td colspan="3">Hauptteig</td></tr>`;
  [...b.flours, ...b.liquids].forEach(([n,pc]) => rows += line(n,pc));
  rows += line("Aktives Anstellgut (gleich viel Mehl und Wasser)", b.starter) + line("Salz", b.salt);
  b.extras.forEach(grp => { rows += `<tr class="grp"><td colspan="3">${esc(grp.g)}</td></tr>`; grp.items.forEach(([n,pc]) => rows += line(n,pc)); });
  rows += `<tr class="grp"><td colspan="3">Anstellgut füttern (vor dem Backtag)</td></tr>
    <tr><td>Anstellgut</td><td class="p">1</td><td class="g">${am.feed} g</td></tr>
    <tr><td>${esc(flourOf(starter).mehl)}</td><td class="p">2</td><td class="g">${2*am.feed} g</td></tr>
    <tr><td>Wasser</td><td class="p">2</td><td class="g">${2*am.feed} g</td></tr>`;
  $("recipe").innerHTML = `<div style="overflow-x:auto"><table>
    <thead><tr><th>Zutat</th><th style="text-align:right">Bäcker-%</th><th style="text-align:right">Menge</th></tr></thead>
    <tbody>${rows}</tbody></table></div>
    ${b.notes ? `<p class="note" style="white-space:pre-line">${esc(b.notes)}</p>` : ""}
    <p class="note">Bäcker-% beziehen sich auf die Mehlmenge (${gram(F)} g = 100 %). Für ${state.count} × ${state.weight} g Teig. Backen: ${b.bake.filter(x=>x[1]>0).map(x=>`${x[1]} min / ${x[0]} °C ${x[2]?"mit":"ohne"} Deckel`).join(" → ")}${state.count>1?", pro Brot, nacheinander oder in zwei Töpfen":""}.</p>`;
}

function optimize(){
  let best=null;
  for (const cold of [true,false]) for (const h of cold ? Array.from({length:25},(_,i)=>6+i*0.5) : [state.coldH]){
    const p = plan({ ...state, cold, coldH:h }), n = p.ev.filter(e=>e.night).length;
    const score = n*10 + (p.start < new Date() ? 100 : 0) + Math.abs(h-12)*(cold?0.3:0) + (cold?0:1);
    if (!best || score < best.score) best = {score, cold, h, n};
  }
  state.cold = best.cold; state.coldH = best.h;
  $("cold").checked = best.cold; $("coldH").value = best.h;
  changed();
  toast(best.n ? `Besser geht's mit diesem Termin nicht: noch ${best.n} Schritt(e) nachts. Probier eine andere Backzeit.` :
    best.cold ? `Kühlschrank-Gare auf ${de(best.h)} h gesetzt, keine Nachtschritte mehr.` : "Ohne Kühlschrank passt es am besten.");
}
function planText(){
  let t = `Sauerteig-Plan: ${bread().name} (${state.count} × ${state.weight} g)\n`, last="";
  plan().ev.forEach(e => { const k=dayKey(e.time); if(k!==last){ t+=`\n${dayLabel(e.time)}\n`; last=k; } t += `${hm(e.time)}  ${e.title}${e.done?" ✓":""}\n`; });
  return t;
}

// ---------- Backtag: abhaken und verschieben ----------
function markDone(key, at){
  const starter = bakeStarter(), r = tick(state, starter, bread(), key, at);
  asking = moving = null;
  state.run = r.run;
  // Füttern im Plan gilt auch beim Starter, wenn es nicht schon neuer eingetragen ist
  const feeds = [...r.auto, r.step].filter(x => x.feeds).map(x => ({ ...x, at:r.run.done[x.key] }));
  changed();
  const x = data.starters[starter.id];
  let fed = false;
  if (x && !x.example) for (const f of feeds) if (f.at > new Date(data.starters[starter.id].lastFed)){
    fed = true;
    touch(starter.id, { lastFed:new Date(f.at).toISOString(), ...(f.feeds==="wake" ? { mode:"aktiv", fridgeSince:null } : {}) }, f.feeds==="wake" ? ["feed","wake"] : "feed", f.at);
  }
  toast(r.step.title+": erledigt."+(r.auto.length ? ` ${r.auto.length} frühere${r.auto.length===1?"r Schritt":" Schritte"} auch abgehakt.` : "")+(fed ? " Beim Starter ist die Fütterung eingetragen." : ""));
}
function endRun(toDiary){
  const b = bread(), starter = bakeStarter(), p = plan();
  const info = `${starter.name || flourOf(starter).name}, ${state.count} × ${state.weight} g, ${de(state.temp)} °C${state.cold ? ", über Nacht im Kühlschrank" : ""}`;
  const date = (p.bake < new Date() ? p.bake : new Date()).toISOString();
  state.run = null; state.bakeRemind = false; asking = moving = null;
  if (state.target < new Date()) state.target = defaultTarget();
  fillInputs(); changed();
  if (toDiary){ showView("diary"); diary.open(null, { bread:b.name, info, date }); }
  else toast("Backtag beendet, die Haken sind weg.");
}

// ---------- Ansicht wechseln ----------
const VIEWS = { bake:["vBake","bakeView","#backen"], starter:["vStarter","starterView","#starter"], diary:["vDiary","diaryView","#tagebuch"] };
function showView(v){
  for (const [k,[tab,view]] of Object.entries(VIEWS)){ $(tab).setAttribute("aria-selected", String(k===v)); $(view).hidden = k!==v; }
  try{ if (location.hash !== VIEWS[v][2]) history.replaceState(null,"",VIEWS[v][2]); }catch(e){}
  if (v==="diary") diary.render();
}

// ---------- Events: Backen ----------
load();
$("stFlour").innerHTML = $("addFlour").innerHTML = Object.entries(FLOURS).map(([k,f]) => `<option value="${k}">${f.name}</option>`).join("");
const editor = initEditor({ $, esc, toast, recipes:() => data.recipes, put:(id,r) => setItem("recipes", id, r),
  remove:id => { if (state.bread === id){ state.bread = "klassisch"; state.u = stamp(state); } delItem("recipes", id); }, choose:id => { state.bread = id; changed(); } });
const photoStore = () => store && syncCode ? { save:(id,url) => store.savePhoto(syncCode,id,url), load:id => store.loadPhoto(syncCode,id), remove:id => store.removePhoto(syncCode,id) } : null;
const diary = initDiary({ $, esc, toast, toLocalInput, diary:() => data.diary, put:(id,x) => setItem("diary", id, x), remove:id => delItem("diary", id), photos:photoStore });

$("breads").addEventListener("click", e => {
  const b = e.target.closest(".bread"); if (!b || state.run) return;
  state.bread = b.dataset.k;
  // Zum glutenfreien Brot gleich den glutenfreien Starter nehmen, wenn noch keiner ausgewählt wurde
  const gf = live().find(x => x.flour==="glutenfrei");
  if (bread().gf && gf && !state.starterId) state.starterId = gf.id;
  changed();
});
$("reNew").addEventListener("click", () => editor.open(null));
$("reEdit").addEventListener("click", () => editor.open(activeBread()));
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
$("vDiary").addEventListener("click",()=>showView("diary"));
$("alerts").addEventListener("click", e => {
  if (e.target.dataset.go==="starter"){ select(bakeStarter().id); showView("starter"); }
  if (e.target.dataset.gf && !state.run){ state.starterId = e.target.dataset.gf; changed(); }
});
$("plan").addEventListener("click", e => {
  const d = e.target.dataset, now = Date.now();
  if (d.done){
    const s = plan().ev.find(x => x.key===d.done);
    moving = null;
    if (Math.abs(now - s.time) > 10*MIN){ asking = d.done; render(); } // weit weg vom Plan: nachfragen, sonst rückt alles falsch
    else markDone(d.done, now);
  }
  if (d.later){ asking = null; moving = d.later; render(); }
  if (d.at==="no"){ asking = moving = null; render(); }
  if (d.at==="plan") markDone(d.k, plan().ev.find(x => x.key===d.k).time.getTime());
  if (d.at==="now") markDone(d.k, now);
  if (d.mv){ state.run = later(state, bakeStarter(), bread(), d.k, +d.mv, now); moving = null; changed(); toast(`Um ${dur(+d.mv)} verschoben. Die folgenden Schritte rücken mit.`); }
  if (d.un){ state.run = untick(state.run, d.un); changed(); toast("Haken entfernt."+(["wake","feed","rest"].includes(d.un) ? " Die Fütterung beim Starter bleibt eingetragen." : "")); }
});
$("runEnd").addEventListener("click", () => endRun(true));
$("runStop").addEventListener("click", () => { $("runSure").hidden = false; });
$("runNo").addEventListener("click", () => { $("runSure").hidden = true; });
$("runYes").addEventListener("click", () => { $("runSure").hidden = true; endRun(false); });

// ---------- Events: Starter ----------
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
  data = { ...data, starters:Object.fromEntries(Object.entries(data.starters).filter(([,y]) => !y.example)) };
  sel = id; put("sauerteig-sel", id); closeBoxes();
  setItem("starters", id, x); toast(x.name+" angelegt.");
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
$("peakGo").addEventListener("click", () => {
  const x = cur(), now = Date.now(); if (!canMeasure(x, now)) return;
  touch(x.id, { peaks:withPeak(x, state.temp, now) }, "peak", now); toast("Höhepunkt eingetragen. Der Backplan rechnet jetzt mit deinen Zeiten.");
});
$("peakUndo").addEventListener("click", () => {
  const x = cur(), i = (x.log||[]).findIndex(e => e.type==="peak");
  touch(x.id, { peaks:x.peaks.slice(1), log:(x.log||[]).filter((_,k) => k!==i) }); toast("Messung entfernt.");
});
$("stDel").addEventListener("click", () => {
  const x = cur(); closeBoxes();
  $("delText").textContent = `„${x.name||"Starter"}“ mit seinem Verlauf auf allen Geräten löschen? Das lässt sich nicht rückgängig machen.`;
  $("delBox").hidden = false;
});
$("delCancel").addEventListener("click", closeBoxes);
$("delGo").addEventListener("click", () => { const x = cur(); closeBoxes(); delItem("starters", x.id); toast((x.name||"Starter")+" gelöscht."); });
$("lastFed").addEventListener("change", e => { const d = new Date(e.target.value), x = cur(); if (x && !isNaN(d) && d <= new Date()) touch(x.id, { lastFed:d.toISOString() }); });
let nameT;
$("stNameIn").addEventListener("input", e => { const id = cur()?.id, v = e.target.value; clearTimeout(nameT); nameT = setTimeout(() => touch(id, { name:v.trim().slice(0,40) }), 700); });
$("stFlour").addEventListener("change", e => { const x = cur(); touch(x.id, { flour:e.target.value, ...(x.mode!=="kuehlschrank" ? { fridgeDays:FLOURS[e.target.value].days } : {}) }); });

// ---------- Events: Urlaub ----------
$("tripGo").addEventListener("click", () => {
  const trip = { from:$("tripFrom").value, to:$("tripTo").value };
  if (!tripDates(trip)){ toast("Trag Abreise und Rückkehr ein. Die Rückkehr muss nach der Abreise liegen."); return; }
  if (tripDates(trip).back < Date.now()){ toast("Dieser Zeitraum ist schon vorbei."); return; }
  state.trip = trip; changed(); renderStarter(); toast("Urlaub gespeichert.");
});
$("tripDel").addEventListener("click", () => { state.trip = null; changed(); renderStarter(); toast("Urlaub gelöscht. Die normalen Erinnerungen gelten wieder."); });
$("tripCold").addEventListener("click", () => {
  const now = new Date().toISOString();
  live().filter(x => !x.example && x.mode!=="kuehlschrank").forEach(x => touch(x.id, { mode:"kuehlschrank", fridgeSince:now, lastFed:now }, ["fridge","feed"]));
  toast("Alle Starter sind als gefüttert und im Kühlschrank eingetragen. Gute Reise!");
});

// ---------- Events: Erinnerungen & Geräte ----------
$("starterRemind").addEventListener("change", e => { const x = cur(); if (x) touch(x.id, { remind:e.target.checked }); });
$("bakeRemind").addEventListener("change", async e => {
  state.bakeRemind = e.target.checked;
  if (state.bakeRemind && !notifOk) await refreshPermission(true);
  if (state.bakeRemind && !notifOk){ toast("Ohne Erlaubnis für Benachrichtigungen kann die App nicht erinnern."); }
  else if (state.bakeRemind) toast(`${plan().ev.filter(x => x.time > new Date() && !x.silent && !x.done).length} Erinnerungen für diesen Backplan gestellt.`);
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
  if (code === syncCode){ toast("Das ist schon der Code dieses Geräts."); return; }
  try{
    const doc = await store.load(code), r = doc?.j ? parse(doc.j) : null;
    if (!r){ toast("Unter diesem Code ist nichts gespeichert."); return; }
    clearTimeout(syncT); leaving = true; unwatch?.();
    // Vom alten Code abmelden, sonst kämen dessen Erinnerungen weiter auf dieses Gerät
    const token = (localStorage.getItem("sauerteig-token")||"").split(":").slice(1).join(":");
    if (token) await store.removeToken(syncCode, token).catch(e => console.error(e));
    const { state:s, starters, ...rest } = r;
    for (const k of ["sauerteig","sauerteig-token","sauerteig-starter","sauerteig-sel"]) localStorage.removeItem(k);
    put("sauerteig-code", code); put("sauerteig-starters", JSON.stringify(starters)); put("sauerteig-mehr", JSON.stringify(rest));
    if (s) put("sauerteig", JSON.stringify(s));
    location.hash = "#starter"; location.reload();
  }catch(e){ leaving = false; toast("Konnte den Code gerade nicht prüfen. Bist du online?"); }
});
document.addEventListener("visibilitychange", () => { if (!document.hidden){ render(); renderStarter(); syncSoon(); if (store) refreshPermission(false); } });
window.addEventListener("online", syncSoon);

// Links aus Benachrichtigungen: #starter-<id> zeigt den Starter, #fed-<id> trägt die Fütterung ein.
// #fed ohne Kennung kommt von der Test-Benachrichtigung und trägt nichts ein.
function handleHash(){
  const [, what, id] = location.hash.match(/^#(starter|fed|backen|tagebuch)(?:-([a-z0-9]+))?$/) || [];
  if (what === "fed"){
    showView("starter");
    if (!id){ toast("Der Test hat geklappt. Es wurde keine Fütterung eingetragen."); return; }
    // Erst den neuesten Stand abwarten, damit nichts von einem anderen Gerät überschrieben wird
    ready.then(() => {
      if (!data.starters[id] || data.starters[id].del){ toast("Diesen Starter gibt es nicht mehr."); return; }
      select(id); feed(id); toast((data.starters[id].name||"Starter")+": Fütterung eingetragen.");
    });
    return;
  }
  if (id) select(id);
  showView(what === "starter" ? "starter" : what === "tagebuch" ? "diary" : "bake");
}
function fillInputs(){
  if (document.activeElement !== $("target")) $("target").value = toLocalInput(state.target);
  $("count").value = state.count; $("weight").value = state.weight;
  $("temp").value = state.temp; $("cold").checked = state.cold; $("coldH").value = state.coldH;
  $("bakeRemind").checked = state.bakeRemind;
}
function redraw(){ fillInputs(); render(); renderStarter(); diary.render(); }

let isReady; const ready = new Promise(r => isReady = r);
redraw(); handleHash(); renderCode();
window.__stShown = true;
window.addEventListener("hashchange", handleHash);
setInterval(() => { renderStarter(); if (!asking && !moving) render(); }, 60000);

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
    if (!syncCode){ syncCode = randomCode(); put("sauerteig-code", syncCode); }
    setTimeout(isReady, 4000);
    unwatch = store.watch(syncCode, (doc, confirmed) => { onRemote(doc, confirmed); if (confirmed) isReady(); },
      e => { console.error(e); setSync("Konnte den Stand nicht online abgleichen. Öffne die App noch einmal."); isReady(); });
    store.onPush(p => { const d = p.data || {}; toast(d.title ? d.title + ": " + (d.body||"") : "Erinnerung"); });
    diary.render();
  } else { rollTarget(); isReady(); }
  renderCode();
  await refreshPermission(false);
})();
