// Back-Tagebuch: Einträge liegen im gemeinsamen Stand (diary), Fotos einzeln unter sauerteig/<code>/photos/<id>.
import { randomCode } from "./store.js";

const MAX_ENTRIES = 300, PHOTO_MAX = 850000; // Zeichen; die Firestore-Regel erlaubt 900000
const SAFE_PHOTO = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;

// Verkleinert ein Foto auf höchstens 1280 Pixel und so weit, dass es in ein Firestore-Dokument passt
async function shrink(file){
  const img = await createImageBitmap(file);
  for (const [side, q] of [[1280,.8],[1024,.7],[800,.6],[600,.5]]){
    const k = Math.min(1, side/Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width*k)); c.height = Math.max(1, Math.round(img.height*k));
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0,0,c.width,c.height); x.drawImage(img,0,0,c.width,c.height);
    const url = c.toDataURL("image/jpeg", q);
    if (url.length <= PHOTO_MAX) return url;
  }
  throw new Error("zu groß");
}

// ctx: { $, esc, toast, toLocalInput, diary(), put(id, eintrag), remove(id), photos() → { save, load, remove } oder null }
export function initDiary(ctx){
  const { $, esc, toast } = ctx;
  let id = null, rating = 0, photo = null, hadPhoto = false; // photo: neues Bild, "" = entfernt, null = unverändert
  const cache = new Map();
  const list = () => Object.values(ctx.diary()).filter(x => !x.del).sort((a,b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
  const stars = n => n ? `<span class="stars" aria-label="${n} von 5 Sternen">${"★".repeat(n)}${"☆".repeat(5-n)}</span>` : "";

  async function photoOf(key){
    if (cache.has(key)) return cache.get(key);
    const url = await ctx.photos()?.load(key);
    if (url && SAFE_PHOTO.test(url)){ cache.set(key, url); return url; }
    return null;
  }
  // Fotos erst laden, wenn der Eintrag ins Bild kommt
  const watch = new IntersectionObserver(es => es.forEach(async e => {
    if (!e.isIntersecting) return;
    watch.unobserve(e.target);
    try{ const url = await photoOf(e.target.dataset.photo); if (url){ e.target.src = url; e.target.hidden = false; } else throw 0; }
    catch{ e.target.nextElementSibling.hidden = false; }
  }), { rootMargin:"300px" });

  let shown = "";
  function render(){
    const l = list(), sig = JSON.stringify(l) + !!ctx.photos();
    if (sig === shown) return;
    shown = sig;
    $("diEmpty").hidden = l.length > 0;
    $("diList").innerHTML = l.map(x => `<article class="panel dientry">
      ${x.photo ? `<div class="diphoto"><img data-photo="${esc(x.photo)}" alt="Foto: ${esc(x.bread)}" hidden><p class="note" hidden>Foto ist gerade nicht erreichbar.</p></div>` : ""}
      <div class="dihead"><h3>${esc(x.bread)}</h3>${stars(Math.min(5, Math.max(0, x.rating|0)))}</div>
      <p class="note">${esc(new Date(x.date).toLocaleDateString("de-DE", { weekday:"short", day:"numeric", month:"long", year:"numeric" }))}${x.info ? " · "+esc(x.info) : ""}</p>
      ${x.notes ? `<p class="dinotes">${esc(x.notes)}</p>` : ""}
      <button class="btn plain" type="button" data-edit="${esc(x.id)}">Bearbeiten</button></article>`).join("");
    $("diList").querySelectorAll("img[data-photo]").forEach(i => { i.hidden = false; watch.observe(i); });
  }
  function setRating(n){ rating = n; $("diStars").querySelectorAll("button").forEach(b => { const on = +b.dataset.n <= n; b.textContent = on ? "★" : "☆"; b.setAttribute("aria-pressed", String(+b.dataset.n === n)); }); }
  function preview(url){ $("diPrev").hidden = !url; if (url) $("diPrev").src = url; else $("diPrev").removeAttribute("src"); $("diNoPhoto").hidden = !url; }

  async function open(key, preset = {}){
    if (!key && list().length >= MAX_ENTRIES){ toast("Das Tagebuch ist voll. Lösch alte Einträge, um neue anzulegen."); return; }
    const x = key ? ctx.diary()[key] : { date:new Date().toISOString(), bread:"", rating:0, notes:"", info:"", ...preset };
    id = key; photo = null; hadPhoto = !!x.photo;
    $("diTitle").textContent = key ? "Eintrag bearbeiten" : "Neuer Eintrag";
    $("diBread").value = x.bread; $("diDate").value = ctx.toLocalInput(new Date(x.date)).slice(0,10); $("diInfo").value = x.info || ""; $("diNotes").value = x.notes || "";
    $("diFile").value = ""; setRating(x.rating|0); preview(null);
    $("diDel").hidden = !key; $("diDelBox").hidden = true; $("diForm").hidden = false;
    $("diForm").scrollIntoView({ block:"start" });
    if (x.photo){ const url = await photoOf(x.photo).catch(()=>null); if (id === key && photo === null) preview(url); }
  }
  function close(){ $("diForm").hidden = true; id = null; photo = null; }

  $("diNew").addEventListener("click", () => open(null));
  $("diStars").addEventListener("click", e => { const n = +e.target.closest("[data-n]")?.dataset.n; if (n) setRating(n === rating ? 0 : n); });
  $("diFile").addEventListener("change", async e => {
    const f = e.target.files[0]; if (!f) return;
    if (!ctx.photos()){ toast("Fotos gehen nur mit Internetverbindung."); e.target.value = ""; return; }
    try{ photo = await shrink(f); preview(photo); }catch(err){ console.error(err); toast("Dieses Bild konnte nicht gelesen werden. Nimm ein anderes Foto."); e.target.value = ""; }
  });
  $("diNoPhoto").addEventListener("click", () => { photo = ""; $("diFile").value = ""; preview(null); });
  $("diCancel").addEventListener("click", close);
  $("diSave").addEventListener("click", () => {
    const bread = $("diBread").value.trim().slice(0,60), day = $("diDate").value;
    if (!bread){ toast("Welches Brot war es?"); return; }
    if (!day){ toast("Wann hast du gebacken?"); return; }
    const key = id || "d" + randomCode(9), old = id ? ctx.diary()[id] : null, pics = ctx.photos();
    let ref = old?.photo || null;
    if (photo && pics){
      // Neues Foto unter neuer Kennung, das alte wird danach gelöscht
      const next = key + "-" + randomCode(4); cache.set(next, photo);
      pics.save(next, photo).catch(err => { console.error(err); toast("Das Foto konnte nicht online gespeichert werden."); });
      if (ref) pics.remove(ref).catch(err => console.error(err));
      ref = next;
    } else if (photo === "" && ref){ pics?.remove(ref).catch(err => console.error(err)); ref = null; }
    ctx.put(key, { date:new Date(day+"T12:00").toISOString(), bread, rating, info:$("diInfo").value.trim().slice(0,160), notes:$("diNotes").value.trim().slice(0,1000), photo:ref });
    close(); toast("Eintrag gespeichert.");
  });
  $("diDel").addEventListener("click", () => { $("diDelBox").hidden = false; });
  $("diDelNo").addEventListener("click", () => { $("diDelBox").hidden = true; });
  $("diDelYes").addEventListener("click", () => {
    const key = id, ref = ctx.diary()[key]?.photo; close();
    if (ref) ctx.photos()?.remove(ref).catch(err => console.error(err));
    ctx.remove(key); toast("Eintrag gelöscht.");
  });
  $("diList").addEventListener("click", e => { const k = e.target.closest("[data-edit]")?.dataset.edit; if (k) open(k); });
  return { render, open, close };
}
