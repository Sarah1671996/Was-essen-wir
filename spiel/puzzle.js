// Sonnenhof – Puzzle (Schritt 3): Steine tauschen, drei oder mehr gleiche in einer Reihe sammeln.
// Vier in einer Reihe ergeben eine Rakete (räumt Reihe oder Spalte), fünf oder eine L/T-Form eine Bombe (3 × 3).
import { STEINE, BRETT, WERKZEUGE, puzzleLevel, PUZZLE_LOHN } from "./daten.js";

export function puzzleStarten(api) {
  const S = () => api.S();
  const p$ = s => document.querySelector(s);
  const huelle = p$("#puzzle"), brettEl = p$("#brett");
  const warte = ms => new Promise(r => setTimeout(r, ms));
  const N = BRETT;

  let L = null, nummer = 1, zuege = 0, ziele = {}, gitter = [], kiste = [], eis = [], belegt = false, groesse = 56, auswahl = null, tippZeit = 0;
  let naechsteId = 0;

  /* ---------- Darstellung ---------- */
  function feldGroesse() {
    const W = innerWidth, H = innerHeight;
    groesse = Math.floor(Math.min((W - 24) / N, (H - 250) / N, 68));
    brettEl.style.width = brettEl.style.height = groesse * N + "px";
    brettEl.style.setProperty("--g", groesse + "px");
  }
  const pos = (r, c) => `translate(${c * groesse}px,${r * groesse}px)`;
  function steinEl(st) {
    const el = document.createElement("div");
    el.className = "stein" + (st.spezial ? " spezial " + st.spezial : "");
    const bild = st.spezial === "bombe" ? "bombe" : st.spezial ? "rakete" : STEINE[st.farbe].bild;
    el.innerHTML = `<img src="${api.bildUrl(bild)}" alt="" draggable="false">${st.spezial === "rh" ? '<i class="pfeil">↔</i>' : st.spezial === "rv" ? '<i class="pfeil">↕</i>' : ""}`;
    brettEl.appendChild(el); st.el = el; return el;
  }
  function setzen(st, r, c, sofort = false) {
    if (!st.el) steinEl(st);
    if (sofort) { st.el.style.transition = "none"; st.el.style.transform = pos(r, c); void st.el.offsetWidth; st.el.style.transition = ""; }
    else st.el.style.transform = pos(r, c);
  }
  function zeichneFelder() {
    brettEl.innerHTML = "";
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const f = document.createElement("div"); f.className = "zelle"; f.style.transform = pos(r, c); brettEl.appendChild(f);
      if (kiste[r][c]) { const k = document.createElement("div"); k.className = "kiste"; k.dataset.rc = r + "," + c; k.style.transform = pos(r, c); k.innerHTML = `<img src="${api.bildUrl("kiste")}" alt="">`; brettEl.appendChild(k); }
      if (eis[r][c]) { const e = document.createElement("div"); e.className = "eis"; e.dataset.rc = r + "," + c; e.style.transform = pos(r, c); e.innerHTML = `<img src="${api.bildUrl("eis")}" alt="">`; brettEl.appendChild(e); }
    }
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (gitter[r][c]) { gitter[r][c].el = null; setzen(gitter[r][c], r, c, true); }
  }
  function zeigeKopf() {
    p$("#pz-level").textContent = nummer;
    p$("#pz-zuege").textContent = zuege;
    p$("#pz-ziele").innerHTML = Object.entries(ziele).map(([k, n]) => {
      const bild = k === "kiste" ? "kiste" : k === "eis" ? "eis" : STEINE[k].bild;
      return `<span class="${n <= 0 ? "erledigt" : ""}"><img src="${api.bildUrl(bild)}" alt=""><b>${n <= 0 ? "✓" : n}</b></span>`;
    }).join("");
  }

  /* ---------- Spielfeld ---------- */
  const zufallFarbe = () => Math.floor(Math.random() * L.farben);
  const neu = farbe => ({ id: naechsteId++, farbe, spezial: null, el: null });
  function fuellen() {
    gitter = Array.from({ length: N }, () => Array(N).fill(null));
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (kiste[r][c]) continue;
      let f;
      do { f = zufallFarbe(); } while (
        (c >= 2 && gitter[r][c - 1]?.farbe === f && gitter[r][c - 2]?.farbe === f) ||
        (r >= 2 && gitter[r - 1][c]?.farbe === f && gitter[r - 2][c]?.farbe === f));
      gitter[r][c] = neu(f);
    }
    if (!zugMoeglich()) fuellen();
  }
  const farbeBei = (r, c) => { const s = gitter[r]?.[c]; return s && !s.spezial ? s.farbe : -1; };
  function treffer() {
    // Läufe finden und zu Gruppen zusammenfassen
    const laeufe = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N;) {
      const f = farbeBei(r, c); let e = c + 1;
      while (f >= 0 && e < N && farbeBei(r, e) === f) e++;
      if (f >= 0 && e - c >= 3) laeufe.push({ h: true, zellen: Array.from({ length: e - c }, (_, k) => [r, c + k]) });
      c = e;
    }
    for (let c = 0; c < N; c++) for (let r = 0; r < N;) {
      const f = farbeBei(r, c); let e = r + 1;
      while (f >= 0 && e < N && farbeBei(e, c) === f) e++;
      if (f >= 0 && e - r >= 3) laeufe.push({ h: false, zellen: Array.from({ length: e - r }, (_, k) => [r + k, c]) });
      r = e;
    }
    const gruppen = [];
    for (const l of laeufe) {
      const keys = new Set(l.zellen.map(([r, c]) => r * N + c));
      const g = gruppen.find(g => [...keys].some(k => g.keys.has(k)));
      if (g) { keys.forEach(k => g.keys.add(k)); g.laeufe.push(l); } else gruppen.push({ keys, laeufe: [l] });
    }
    return gruppen;
  }
  function zugMoeglich() {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (!gitter[r][c]) continue;
      if (gitter[r][c].spezial) return true;
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const r2 = r + dr, c2 = c + dc;
        if (r2 >= N || c2 >= N || !gitter[r2][c2]) continue;
        tausch(r, c, r2, c2); const ok = treffer().length > 0; tausch(r, c, r2, c2);
        if (ok) return [[r, c], [r2, c2]];
      }
    }
    return false;
  }
  function tausch(r1, c1, r2, c2) { const t = gitter[r1][c1]; gitter[r1][c1] = gitter[r2][c2]; gitter[r2][c2] = t; }

  /* ---------- Abräumen ---------- */
  function zaehle(k) { if (ziele[k] !== undefined && ziele[k] > 0) ziele[k]--; }
  function kisteTreffen(r, c) {
    if (r < 0 || c < 0 || r >= N || c >= N || !kiste[r][c]) return;
    kiste[r][c] = false; zaehle("kiste");
    const el = brettEl.querySelector(`.kiste[data-rc="${r},${c}"]`); if (el) { el.classList.add("platzt"); setTimeout(() => el.remove(), 300); }
  }
  function eisTreffen(r, c) {
    if (!eis[r][c]) return;
    eis[r][c] = false; zaehle("eis");
    const el = brettEl.querySelector(`.eis[data-rc="${r},${c}"]`); if (el) { el.classList.add("platzt"); setTimeout(() => el.remove(), 300); }
  }
  function wirkung(st, r, c) {
    const z = [];
    if (st.spezial === "rh") for (let k = 0; k < N; k++) z.push([r, k]);
    if (st.spezial === "rv") for (let k = 0; k < N; k++) z.push([k, c]);
    if (st.spezial === "bombe") for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) z.push([r + a, c + b]);
    return z.filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N);
  }
  // Räumt Zellen ab; Spezialsteine darin lösen ihre Wirkung aus. nachbarn = Kisten daneben treffen (nur bei normalen Reihen)
  function abraeumen(zellen, nachbarn, ausnahme = new Set()) {
    const liste = [...zellen], gesehen = new Set();
    while (liste.length) {
      const [r, c] = liste.shift(), k = r * N + c;
      if (gesehen.has(k)) continue; gesehen.add(k);
      if (kiste[r][c]) { kisteTreffen(r, c); continue; }
      if (ausnahme.has(k)) continue;
      const st = gitter[r][c]; if (!st) continue;
      if (st.spezial) { liste.push(...wirkung(st, r, c)); explosion(r, c, st.spezial); }
      else zaehle(String(st.farbe));
      eisTreffen(r, c);
      if (nachbarn) for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) kisteTreffen(a, b);
      st.el?.classList.add("platzt"); const el = st.el; setTimeout(() => el?.remove(), 260);
      gitter[r][c] = null;
    }
  }
  function explosion(r, c, art) {
    const e = document.createElement("div"); e.className = "knall " + art;
    e.style.transform = pos(r, c); brettEl.appendChild(e); setTimeout(() => e.remove(), 500);
  }
  async function fallen() {
    for (let c = 0; c < N; c++) {
      const plaetze = []; for (let r = N - 1; r >= 0; r--) if (!kiste[r][c]) plaetze.push(r);
      const steine = plaetze.map(r => gitter[r][c]).filter(Boolean);
      plaetze.forEach(r => (gitter[r][c] = null));
      let neue = 0;
      plaetze.forEach((r, i) => {
        let st = steine[i];
        if (!st) { st = neu(zufallFarbe()); neue++; setzen(st, -neue, c, true); }
        gitter[r][c] = st;
      });
    }
    await warte(30);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (gitter[r][c]) setzen(gitter[r][c], r, c);
    await warte(260);
  }
  async function kaskade(getauscht) {
    let runde = 0;
    while (true) {
      const gruppen = treffer();
      if (!gruppen.length) break;
      const zellen = [], neueSpezial = [];
      for (const g of gruppen) {
        const max = Math.max(...g.laeufe.map(l => l.zellen.length));
        const kreuz = g.laeufe.some(l => l.h) && g.laeufe.some(l => !l.h);
        let art = null;
        if (max >= 5 || kreuz) art = "bombe";
        else if (max === 4) art = g.laeufe[0].h ? "rh" : "rv";
        const ks = [...g.keys];
        let ziel = ks[Math.floor(ks.length / 2)];
        if (runde === 0 && getauscht) { const t = getauscht.map(([r, c]) => r * N + c).find(k => g.keys.has(k)); if (t !== undefined) ziel = t; }
        if (art) neueSpezial.push({ k: ziel, art });
        ks.forEach(k => zellen.push([Math.floor(k / N), k % N]));
      }
      const aus = new Set(neueSpezial.map(s => s.k));
      // Zellen, aus denen ein Spezialstein wird, zählen trotzdem als gesammelter Stein
      for (const s of neueSpezial) { const st = gitter[Math.floor(s.k / N)][s.k % N]; if (st) zaehle(String(st.farbe)); eisTreffen(Math.floor(s.k / N), s.k % N); }
      abraeumen(zellen, true, aus);
      for (const s of neueSpezial) {
        const r = Math.floor(s.k / N), c = s.k % N, st = gitter[r][c];
        if (!st) continue;
        st.el?.remove(); st.el = null; st.spezial = s.art; st.farbe = -1; setzen(st, r, c, true);
        st.el.classList.add("entsteht");
      }
      zeigeKopf();
      await warte(240);
      await fallen();
      runde++;
    }
    zeigeKopf();
  }

  /* ---------- Züge ---------- */
  async function versuch(r1, c1, r2, c2) {
    if (belegt || zuege <= 0) return;
    const a = gitter[r1][c1], b = gitter[r2][c2];
    if (!a || !b) return;
    belegt = true; auswahlWeg(); tippZeit = Date.now();
    tausch(r1, c1, r2, c2); setzen(a, r2, c2); setzen(b, r1, c1);
    await warte(190);
    if (a.spezial || b.spezial) {
      zuege--;
      const z = [];
      if (a.spezial) z.push([r2, c2]);
      if (b.spezial) z.push([r1, c1]);
      abraeumen(z, false);
      zeigeKopf(); await warte(260); await fallen(); await kaskade(null);
    } else if (treffer().length) {
      zuege--; await kaskade([[r1, c1], [r2, c2]]);
    } else {
      tausch(r1, c1, r2, c2); setzen(a, r1, c1); setzen(b, r2, c2);
      a.el.classList.add("nein"); b.el.classList.add("nein");
      await warte(260); a.el?.classList.remove("nein"); b.el?.classList.remove("nein");
    }
    zeigeKopf();
    if (fertig()) { belegt = false; return gewonnen(); }
    if (zuege <= 0) { belegt = false; return verloren(); }
    if (!zugMoeglich()) await mischen();
    belegt = false;
  }
  async function mischen() {
    api.meldung("Keine Züge mehr möglich, die Steine werden neu gemischt.");
    let versuche = 0;
    do {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const st = gitter[r][c]; if (st && !st.spezial) { st.farbe = zufallFarbe(); } }
      versuche++;
    } while ((treffer().length || !zugMoeglich()) && versuche < 50);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const st = gitter[r][c]; if (st && !st.spezial) { st.el.remove(); st.el = null; setzen(st, r, c, true); } }
    await warte(300);
  }
  const fertig = () => Object.values(ziele).every(n => n <= 0);

  /* ---------- Eingabe ---------- */
  function zelleAus(e) {
    const r = brettEl.getBoundingClientRect();
    return [Math.floor((e.clientY - r.top) / groesse), Math.floor((e.clientX - r.left) / groesse)];
  }
  let druck = null;
  brettEl.addEventListener("pointerdown", e => {
    if (belegt) return;
    const [r, c] = zelleAus(e);
    if (r < 0 || c < 0 || r >= N || c >= N || !gitter[r][c]) return;
    druck = { r, c, x: e.clientX, y: e.clientY, fertig: false };
    brettEl.setPointerCapture(e.pointerId);
  });
  brettEl.addEventListener("pointermove", e => {
    if (!druck || druck.fertig) return;
    const dx = e.clientX - druck.x, dy = e.clientY - druck.y;
    if (Math.hypot(dx, dy) < groesse * .35) return;
    druck.fertig = true;
    const [dr, dc] = Math.abs(dx) > Math.abs(dy) ? [0, Math.sign(dx)] : [Math.sign(dy), 0];
    const r2 = druck.r + dr, c2 = druck.c + dc;
    if (r2 >= 0 && c2 >= 0 && r2 < N && c2 < N) versuch(druck.r, druck.c, r2, c2);
  });
  brettEl.addEventListener("pointerup", () => {
    if (!druck) return;
    const d = druck; druck = null;
    if (d.fertig || belegt) return;
    // Tippen: erst auswählen, dann Nachbarn antippen
    if (auswahl && Math.abs(auswahl.r - d.r) + Math.abs(auswahl.c - d.c) === 1) { const a = auswahl; auswahlWeg(); versuch(a.r, a.c, d.r, d.c); return; }
    if (auswahl && auswahl.r === d.r && auswahl.c === d.c) { auswahlWeg(); return; }
    auswahlWeg(); auswahl = { r: d.r, c: d.c }; gitter[d.r][d.c]?.el?.classList.add("gewaehlt");
  });
  function auswahlWeg() { if (auswahl) gitter[auswahl.r]?.[auswahl.c]?.el?.classList.remove("gewaehlt"); auswahl = null; }
  // Tipp nach ein paar Sekunden ohne Zug
  setInterval(() => {
    if (!huelle.classList.contains("offen") || belegt || Date.now() - tippZeit < 6000) return;
    const z = zugMoeglich(); if (!Array.isArray(z)) return;
    tippZeit = Date.now();
    for (const [r, c] of z) { const el = gitter[r][c]?.el; if (el) { el.classList.remove("tipp"); void el.offsetWidth; el.classList.add("tipp"); } }
  }, 1000);

  /* ---------- Start und Ende ---------- */
  function stand() { const s = S(); s.puzzle ??= { level: 1, gewonnen: 0 }; return s.puzzle; }
  function oeffnen() {
    api.schliessen();
    nummer = stand().level;
    L = puzzleLevel(nummer);
    zuege = L.zuege;
    kiste = L.karte.map(z => [...z].map(ch => ch === "K"));
    eis = L.karte.map(z => [...z].map(ch => ch === "E"));
    ziele = {};
    for (const [f, n] of Object.entries(L.steine)) ziele[f] = n;
    const nk = kiste.flat().filter(Boolean).length, ne = eis.flat().filter(Boolean).length;
    if (nk) ziele.kiste = nk; if (ne) ziele.eis = ne;
    huelle.classList.add("offen"); document.body.classList.add("im-puzzle");
    feldGroesse(); fuellen(); zeichneFelder(); zeigeKopf();
    belegt = false; auswahl = null; tippZeit = Date.now();
    zeigeDialog(`<h2>Level ${nummer}</h2>
      <p>Sammle in <b>${zuege} Zügen</b>:</p><div class="pz-ziele gross">${p$("#pz-ziele").innerHTML}</div>
      <p class="hinweis">Tausche zwei Steine nebeneinander. 4 in einer Reihe ergeben eine Rakete, 5 oder eine L-Form eine Bombe. Kisten gehen kaputt, wenn daneben Steine verschwinden.</p>
      <button class="los" data-pz="los">Los geht's</button>`);
  }
  function schliessen() { huelle.classList.remove("offen"); document.body.classList.remove("im-puzzle"); p$("#pz-dialog").hidden = true; api.aktualisieren(); }
  function zeigeDialog(html) { const d = p$("#pz-dialog"); d.innerHTML = `<div class="karteninhalt">${html}</div>`; d.hidden = false; }
  function gewonnen() {
    const P = stand(), lohn = PUZZLE_LOHN(nummer), s = S();
    s.muenzen += lohn.muenzen;
    s.werkzeug ??= { axt: 3, schaufel: 2, spitzhacke: 2 };
    const bekommen = {};
    for (let k = 0; k < lohn.werkzeuge; k++) { const w = Object.keys(WERKZEUGE)[Math.floor(Math.random() * 3)]; s.werkzeug[w]++; bekommen[w] = (bekommen[w] || 0) + 1; }
    api.inselEreignis("puzzle");
    if (s.insel) s.insel.punkte += lohn.punkte;
    P.level++; P.gewonnen++;
    api.speichern();
    zeigeDialog(`<h2>Gewonnen!</h2><p>Level ${nummer} geschafft mit ${zuege} Zügen übrig.</p>
      <div class="pz-lohn"><span>${api.muenze("ic gross")}<b>${lohn.muenzen}</b></span>
      ${Object.entries(bekommen).map(([w, n]) => `<span><img class="ic gross" src="${api.bildUrl(WERKZEUGE[w].bild)}" alt="${WERKZEUGE[w].name}"><b>${n}</b></span>`).join("")}
      ${s.insel ? `<span class="ew">⭐<b>${lohn.punkte}</b></span>` : ""}</div>
      <div class="knoepfe"><button class="los" data-pz="weiter">Nächstes Level</button><button class="los zweit" data-pz="zu">Zurück</button></div>`);
  }
  function verloren() {
    const rest = Object.entries(ziele).filter(([, n]) => n > 0).length;
    zeigeDialog(`<h2>Keine Züge mehr</h2><p>Fast geschafft! Es ${rest === 1 ? "fehlt noch ein Ziel" : `fehlen noch ${rest} Ziele`}. Versuch es einfach noch mal, das kostet nichts.</p>
      <div class="knoepfe"><button class="los" data-pz="nochmal">Noch mal</button><button class="los zweit" data-pz="zu">Zurück</button></div>`);
  }
  p$("#pz-dialog").addEventListener("click", e => {
    const b = e.target.closest("[data-pz]"); if (!b) return;
    const a = b.dataset.pz;
    if (a === "los") p$("#pz-dialog").hidden = true;
    if (a === "weiter" || a === "nochmal") oeffnen();
    if (a === "zu") schliessen();
  });
  p$("#pz-zu").onclick = () => {
    if (belegt) return;
    zeigeDialog(`<h2>Level verlassen?</h2><p>Dein Fortschritt in diesem Level geht verloren. Du kannst es jederzeit neu starten.</p>
      <div class="knoepfe"><button class="los rot" data-pz="zu">Verlassen</button><button class="los zweit" data-pz="los">Weiterspielen</button></div>`);
  };
  addEventListener("resize", () => { if (huelle.classList.contains("offen")) { feldGroesse(); zeichneFelder(); } });

  return { oeffnen, get level() { return stand().level; } };
}
