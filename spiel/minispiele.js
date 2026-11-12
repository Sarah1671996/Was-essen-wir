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
  function wimmelbild({ winter, karte, gewonnen }) {
    const pool = mischen([...api.symbole()]);
    const ziele = pool.slice(0, 6), rest = pool.slice(6);
    const ablenkung = Array.from({ length: 34 }, (_, k) => rest[k % rest.length]);
    let zeit = 90, gefunden = 0;
    huelle.style.backgroundImage = `url(${api.bildUrl(karte || (winter ? "schneeinsel" : "insel"))})`;
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
      if (a === "nochmal") { zu(); wimmelbild({ winter, karte, gewonnen }); }
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
  /* ---------- Unterschiede finden ---------- */
  // Zwei gleiche Bilder aus Symbolen; im rechten sind 5 Dinge anders. Antippen im rechten Bild.
  function unterschiede({ gewonnen }) {
    const pool = mischen([...api.symbole()]);
    const N = 20, dinge = Array.from({ length: N }, (_, k) => ({ b: pool[k % pool.length], x: 6 + Math.random() * 82, y: 6 + Math.random() * 82, rot: Math.round(Math.random() * 60 - 30), gr: .8 + Math.random() * .5 }));
    const anders = mischen([...Array(N).keys()]).slice(0, 5), arten = ["weg", "anders", "groesse", "drehung", "anders"];
    const rechts = dinge.map((d, i) => {
      const k = anders.indexOf(i); if (k < 0) return { ...d };
      const art = arten[k];
      if (art === "weg") return { ...d, weg: true, diff: true };
      if (art === "anders") return { ...d, b: pool[(pool.indexOf(d.b) + 7) % pool.length], diff: true };
      if (art === "groesse") return { ...d, gr: d.gr * 1.6, diff: true };
      return { ...d, rot: d.rot + 120, diff: true };
    });
    let gefunden = 0, fehler = 0;
    huelle.style.backgroundImage = `url(${api.bildUrl("strand")})`;
    const bild = (liste, seite) => liste.map((d, i) => d.weg ? `<i class="diff-stelle" data-i="${i}" style="left:${d.x}%;top:${d.y}%"></i>` :
      `<img class="diff-ding" data-i="${i}" data-seite="${seite}" src="${api.bildUrl(d.b)}" alt="" style="left:${d.x}%;top:${d.y}%;transform:translate(-50%,-50%) rotate(${d.rot}deg) scale(${d.gr})">`).join("");
    huelle.innerHTML = `<div class="mini-kopf"><button class="zu" data-mini="zu" aria-label="Schließen">✕</button><b>👀 Finde die 5 Unterschiede im unteren Bild</b><span class="mini-zeit">0/5</span></div>
      <div class="diff-wrap"><div class="diff-bild">${bild(dinge, "l")}</div><div class="diff-bild unten">${bild(rechts, "r")}</div></div>`;
    huelle.hidden = false;
    huelle.onclick = e => {
      const a = e.target.closest("[data-mini]")?.dataset.mini;
      if (a === "zu") { zu(); return; }
      if (a === "sieg") { zu(); gewonnen(); return; }
      const feld = e.target.closest(".diff-bild.unten"); if (!feld) return;
      const r = feld.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * 100, py = (e.clientY - r.top) / r.height * 100;
      const treffer = rechts.findIndex(d => d.diff && !d.ok && Math.hypot(d.x - px, (d.y - py) * r.height / r.width) < 9);
      if (treffer < 0) { fehler++; api.ton("nein"); return; }
      rechts[treffer].ok = true; gefunden++; api.ton("treffer", gefunden);
      for (const b of huelle.querySelectorAll(".diff-bild")) {
        const m = document.createElement("i"); m.className = "diff-kreis"; m.style.left = rechts[treffer].x + "%"; m.style.top = rechts[treffer].y + "%"; b.appendChild(m);
      }
      huelle.querySelector(".mini-zeit").textContent = gefunden + "/5";
      if (gefunden === 5) { api.ton("sieg"); setTimeout(() => ende(`<h2>Alle gefunden!</h2><p>Scharfe Augen! Der Weg ist frei.</p>`, `<button class="los" data-mini="sieg">Weiter</button>`), 500); }
    };
  }

  /* ---------- Bildpuzzle (Tauschen) ---------- */
  // Zwei Teile antippen, sie tauschen den Platz. Richtig liegende Teile leuchten grün und bleiben fest.
  function schiebepuzzle({ gewonnen, winter, karte }) {
    const n = 3, bildName = karte || (winter ? "schneeinsel" : "insel");
    let feld = mischen([...Array(n * n).keys()]);
    while (feld.filter((v, k) => v === k).length > 2) feld = mischen(feld);
    let zuege = 0, gewaehlt = -1;
    huelle.style.backgroundImage = `url(${api.bildUrl("strand")})`;
    const zeichnen = () => {
      huelle.querySelector(".schiebe").innerHTML = feld.map((t, i) => `<button class="schiebe-teil ${t === i ? "richtig" : ""} ${i === gewaehlt ? "gewaehlt" : ""}" data-i="${i}"
        style="background-image:url(${api.bildUrl(bildName)});background-position:${(t % n) / (n - 1) * 100}% ${Math.floor(t / n) / (n - 1) * 100}%"></button>`).join("");
      huelle.querySelector(".mini-zeit").textContent = `${feld.filter((v, k) => v === k).length}/9 richtig`;
    };
    huelle.innerHTML = `<div class="mini-kopf"><button class="zu" data-mini="zu" aria-label="Schließen">✕</button><b>🧩 Tippe zwei Teile an, um sie zu tauschen</b><span class="mini-zeit"></span></div>
      <div class="schiebe-wrap"><div class="schiebe"></div><img class="schiebe-vorlage" src="${api.bildUrl(bildName)}" alt="Vorlage"></div>`;
    huelle.hidden = false; zeichnen();
    huelle.onclick = e => {
      const a = e.target.closest("[data-mini]")?.dataset.mini;
      if (a === "zu") { zu(); return; }
      if (a === "sieg") { zu(); gewonnen(); return; }
      const t = e.target.closest(".schiebe-teil"); if (!t) return;
      const i = +t.dataset.i;
      if (feld[i] === i) { api.ton("nein"); return; }
      if (gewaehlt < 0) { gewaehlt = i; zeichnen(); return; }
      if (gewaehlt === i) { gewaehlt = -1; zeichnen(); return; }
      [feld[i], feld[gewaehlt]] = [feld[gewaehlt], feld[i]]; gewaehlt = -1; zuege++;
      api.ton(feld[i] === i || feld.indexOf(i) === i ? "treffer" : "nein", 3); zeichnen();
      if (feld.every((v, k) => v === k)) { api.ton("sieg"); setTimeout(() => ende(`<h2>Geschafft!</h2><p>Das Bild ist fertig, in ${zuege} Zügen.</p>`, `<button class="los" data-mini="sieg">Weiter</button>`), 400); }
    };
  }

  return { wimmelbild, memory, unterschiede, schiebepuzzle };
}
