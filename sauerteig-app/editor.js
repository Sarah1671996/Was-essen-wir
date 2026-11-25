// Eigene Rezepte anlegen und bearbeiten. Eingabe in Gramm; gerechnet wird in recipes.js.
import { BREADS, WHEN, toGrams, checkRecipe } from "./recipes.js";
import { randomCode } from "./store.js";

const EMPTY = { name:"", gf:false, speed:1, flours:[["Weizenmehl Type 550",500]], liquids:[["Wasser",350]], starter:100, salt:10, extras:[], bake:[[250,20,true],[230,25,false]], notes:"" };
const MAX_RECIPES = 30, MAX_ROWS = 15;

// ctx: { $, esc, toast, recipes(), put(id, rezept), remove(id), choose(id) }
export function initEditor(ctx){
  const { $, esc, toast } = ctx;
  let id = null;

  const num = v => Math.max(0, Math.min(20000, parseFloat(String(v).replace(",", ".")) || 0));
  function row(kind, [name = "", grams = "", when = "fold"] = []){
    const div = document.createElement("div");
    div.className = "irow"; div.dataset.kind = kind;
    div.innerHTML = `<input type="text" class="iname" maxlength="60" aria-label="Zutat" placeholder="${kind==="flours"?"Mehl":kind==="liquids"?"Flüssigkeit":"Zutat"}">
      <input type="number" class="ig" min="0" max="20000" step="0.1" inputmode="decimal" aria-label="Gramm" placeholder="g">
      ${kind==="extras" ? `<select class="iwhen" aria-label="Wann">${Object.entries(WHEN).map(([k,t])=>`<option value="${k}">${esc(t)}</option>`).join("")}</select>` : ""}
      <button class="btn plain idel" type="button" aria-label="Zutat entfernen">×</button>`;
    div.querySelector(".iname").value = name;
    div.querySelector(".ig").value = grams;
    if (kind==="extras") div.querySelector(".iwhen").value = when;
    return div;
  }
  function fill(r){
    $("reName").value = r.name; $("reGf").checked = !!r.gf; $("reSpeed").value = String([0.9,1,1.2].reduce((a,b)=>Math.abs(b-r.speed)<Math.abs(a-r.speed)?b:a));
    for (const k of ["flours","liquids","extras"]) $("re_"+k).replaceChildren(...r[k].map(x => row(k, x)));
    $("reStarter").value = r.starter; $("reSalt").value = r.salt;
    const [a, b] = [r.bake[0] || [250,20,true], r.bake[1] || [230,0,false]];
    $("reT1").value = a[0]; $("reM1").value = a[1]; $("reT2").value = b[0]; $("reM2").value = b[1];
    $("reNotes").value = r.notes || "";
    sum();
  }
  const rows = k => [...$("re_"+k).children].map(d => [d.querySelector(".iname").value.trim().slice(0,60), num(d.querySelector(".ig").value), ...(k==="extras" ? [d.querySelector(".iwhen").value] : [])]).filter(x => x[0] && x[1] > 0);
  const collect = () => ({
    name:$("reName").value.trim().slice(0,40), gf:$("reGf").checked, speed:+$("reSpeed").value,
    flours:rows("flours"), liquids:rows("liquids"), extras:rows("extras"), starter:num($("reStarter").value), salt:num($("reSalt").value),
    bake:[[num($("reT1").value), num($("reM1").value), true], [num($("reT2").value), num($("reM2").value), false]],
    notes:$("reNotes").value.trim().slice(0,600)
  });
  function sum(){
    const r = collect(), t = a => a.reduce((x,y)=>x+y[1],0), F = t(r.flours);
    $("reSum").textContent = F ? `Mehl ${Math.round(F)} g, Teig gesamt ${Math.round(F+t(r.liquids)+t(r.extras)+r.starter+r.salt)} g, Anstellgut ${Math.round(r.starter/F*100)} % und Salz ${(r.salt/F*100).toFixed(1).replace(".",",")} % vom Mehl.` : "";
  }

  function open(which){
    const own = ctx.recipes();
    if (!which && Object.values(own).filter(r=>!r.del).length >= MAX_RECIPES){ toast(`Mehr als ${MAX_RECIPES} eigene Rezepte gehen nicht. Lösch zuerst eins.`); return; }
    id = which;
    $("reTitle").textContent = which ? "Rezept bearbeiten" : "Neues Rezept";
    $("reFromWrap").hidden = !!which; $("reDel").hidden = !which; $("reDelBox").hidden = true; $("reErr").hidden = true;
    $("reFrom").innerHTML = `<option value="">Leer anfangen</option>` + Object.entries(BREADS).map(([k,b])=>`<option value="${k}">${esc(b.name)}</option>`).join("");
    fill(which ? own[which] : EMPTY);
    $("editor").hidden = false;
    $("editor").scrollIntoView({ block:"start" });
    $("reName").focus({ preventScroll:true });
  }
  function close(){ $("editor").hidden = true; id = null; }

  $("reFrom").addEventListener("change", e => fill(e.target.value ? toGrams(BREADS[e.target.value]) : EMPTY));
  $("editor").addEventListener("input", sum);
  $("editor").addEventListener("click", e => {
    const add = e.target.closest("[data-add]")?.dataset.add;
    if (add && $("re_"+add).children.length < MAX_ROWS){ const r = row(add); $("re_"+add).append(r); r.querySelector("input").focus(); }
    const del = e.target.closest(".idel"); if (del){ del.parentElement.remove(); sum(); }
  });
  $("reCancel").addEventListener("click", close);
  $("reSave").addEventListener("click", () => {
    const r = collect(), err = checkRecipe(r);
    $("reErr").textContent = err; $("reErr").hidden = !err;
    if (err) return;
    const key = id || "r" + randomCode(7);
    ctx.put(key, r); close(); ctx.choose(key); toast(`„${r.name}“ gespeichert.`);
  });
  $("reDel").addEventListener("click", () => { $("reDelBox").hidden = false; });
  $("reDelNo").addEventListener("click", () => { $("reDelBox").hidden = true; });
  $("reDelYes").addEventListener("click", () => { const key = id; close(); ctx.remove(key); toast("Rezept gelöscht."); });
  return { open, close };
}
