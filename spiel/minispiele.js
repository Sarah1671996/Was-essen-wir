// Sonnenhof – kleine Spiele für die Sonderstationen auf den Inseln: Wimmelbild und Memory.
export function minispieleStarten(api) {
  const huelle = document.createElement("div"); huelle.id = "minispiel"; huelle.hidden = true; document.body.appendChild(huelle);
  const mischen = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let timer = 0;
  function zu() { clearInterval(timer); huelle.hidden = true; huelle.innerHTML = ""; }
  function ende(html, knoepfe) {
    const d = document.createElement("div"); d.className = "fenster mini-ende";
    d.innerHTML = `<div class="karteninhalt">${html}<div class="knoepfe" style="justify-content:center">${knoepfe}</div></div>`;
    huelle.appendChild(d); return d;
  }

  /* ---------- Wimmelbild ---------- */
  function wimmelbild({ winter, gewonnen }) {
    const pool = mischen([...api.symbole()]);
    const ziele = pool.slice(0, 6), rest = pool.slice(6);
    const ablenkung = Array.from({ length: 34 }, (_, k) => rest[k % rest.length]);
    let zeit = 90, gefunden = 0;
    huelle.style.backgroundImage = `url(${api.bildUrl(winter ? "schneeinsel" : "insel")})`;
    huelle.innerHTML = `<div class="mini-kopf"><button class="zu" data-mini="zu" aria-label="Schließen">✕</button><b>🔍 Wimmelbild: Finde diese 6 Dinge</b><span class="mini-zeit">${zeit} s</span></div>
      <div class="wimmel-feld"></div>
      <div class="wimmel-liste">${ziele.map((z, i) => `<span data-z="${i}"><img src="${api.bildUrl(z)}" alt=""></span>`).join("")}</div>`;
    huelle.hidden = false;
    const feld = huelle.querySelector(".wimmel-feld");
    // Plätze in einem lockeren Raster, damit sich nicht alles stapelt
    const alle = mischen([...ziele.map((b, i) => ({ b, ziel: i })), ...ablenkung.map(b => ({ b, ziel: -1 }))]);
    const spalten = 8, zeilen = Math.ceil(alle.length / spalten);
    alle.forEach((o, k) => {
      const el = document.createElement("img"); el.className = "wimmel-ding"; el.src = api.bildUrl(o.b); el.alt = ""; el.draggable = false;
      const c = k % spalten, r = Math.floor(k / spalten);
      el.style.left = `calc(${(c + .15 + Math.random() * .7) / spalten * 100}% - 26px)`;
      el.style.top = `calc(${(r + .15 + Math.random() * .7) / zeilen * 100}% - 26px)`;
      const gr = .75 + Math.random() * .55;
      el.style.transform = `rotate(${Math.round(Math.random() * 80 - 40)}deg) scale(${gr})`;
      if (o.ziel < 0 && Math.random() < .3) el.style.opacity = ".85";
      el.dataset.z = o.ziel;
      feld.appendChild(el);
    });
    feld.addEventListener("click", e => {
      const el = e.target.closest(".wimmel-ding"); if (!el || zeit <= 0) return;
      const z = +el.dataset.z;
      if (z < 0) { el.classList.remove("falsch"); void el.offsetWidth; el.classList.add("falsch"); api.ton("nein"); return; }
      el.classList.add("gefunden"); huelle.querySelector(`.wimmel-liste [data-z="${z}"]`).classList.add("ok"); api.ton("treffer", gefunden);
      gefunden++;
      if (gefunden === ziele.length) {
        clearInterval(timer); api.ton("sieg");
        ende(`<h2>Alles gefunden!</h2><p>Der Weg ist frei.</p>`, `<button class="los" data-mini="sieg">Weiter</button>`);
      }
    });
    timer = setInterval(() => {
      zeit--; huelle.querySelector(".mini-zeit").textContent = zeit + " s";
      if (zeit <= 0) { clearInterval(timer); ende(`<h2>Die Zeit ist um</h2><p>Du hast ${gefunden} von ${ziele.length} gefunden. Versuch es noch einmal, das kostet nichts.</p>`,
        `<button class="los" data-mini="nochmal">Noch mal</button><button class="los zweit" style="width:auto;margin:0" data-mini="zu">Später</button>`); }
    }, 1000);
    huelle.onclick = e => {
      const a = e.target.closest("[data-mini]")?.dataset.mini; if (!a) return;
      if (a === "zu") zu();
      if (a === "nochmal") { zu(); wimmelbild({ winter, gewonnen }); }
      if (a === "sieg") { zu(); gewonnen(); }
    };
  }

  /* ---------- Memory ---------- */
  function memory({ gewonnen }) {
    const bilder = mischen([...api.symbole()]).slice(0, 6);
    const karten = mischen([...bilder, ...bilder]);
    let offen = [], paare = 0, versuche = 0, sperre = false;
    huelle.style.backgroundImage = `url(${api.bildUrl("strand")})`;
    huelle.innerHTML = `<div class="mini-kopf"><button class="zu" data-mini="zu" aria-label="Schließen">✕</button><b>🃏 Memory: Finde alle Paare</b><span class="mini-zeit">0 Züge</span></div>
      <div class="memory-feld">${karten.map((b, i) => `<button class="karte-mem" data-i="${i}"><span>?</span><img src="${api.bildUrl(b)}" alt=""></button>`).join("")}</div>`;
    huelle.hidden = false;
    huelle.onclick = e => {
      const a = e.target.closest("[data-mini]")?.dataset.mini;
      if (a === "zu") { zu(); return; }
      if (a === "sieg") { zu(); gewonnen(); return; }
      const k = e.target.closest(".karte-mem"); if (!k || sperre || k.classList.contains("offen") || k.classList.contains("paar")) return;
      k.classList.add("offen"); offen.push(k);
      if (offen.length < 2) return;
      versuche++; huelle.querySelector(".mini-zeit").textContent = versuche + " Züge";
      const [x, y] = offen;
      if (karten[x.dataset.i] === karten[y.dataset.i]) {
        x.classList.replace("offen", "paar"); y.classList.replace("offen", "paar"); offen = []; paare++; api.ton("treffer", paare);
        if (paare === bilder.length) { api.ton("sieg"); setTimeout(() => ende(`<h2>Geschafft!</h2><p>Alle Paare in ${versuche} Zügen gefunden.</p>`, `<button class="los" data-mini="sieg">Weiter</button>`), 400); }
      } else {
        sperre = true;
        setTimeout(() => { x.classList.remove("offen"); y.classList.remove("offen"); offen = []; sperre = false; }, 800);
      }
    };
  }
  return { wimmelbild, memory };
}
