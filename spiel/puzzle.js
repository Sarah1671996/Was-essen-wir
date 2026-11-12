// Sonnenhof – Puzzle (Schritt 3): Steine tauschen, drei oder mehr gleiche in einer Reihe sammeln.
// Vier in einer Reihe ergeben eine Rakete (räumt Reihe oder Spalte), fünf oder eine L/T-Form eine Bombe (3 × 3).
import { STEINE, BRETT, WERKZEUGE, HELFER, puzzleLevel, PUZZLE_LOHN, PUZZLE_WEG } from "./daten.js";

export function puzzleStarten(api) {
  const S = () => api.S();
  const p$ = s => document.querySelector(s);
  const huelle = p$("#puzzle"), brettEl = p$("#brett");
  const warte = ms => new Promise(r => setTimeout(r, ms));
  const N = BRETT;

  let L = null, nummer = 1, zuege = 0, ziele = {}, gitter = [], kiste = [], eis = [], belegt = false, groesse = 56, auswahl = null, tippZeit = 0;
  let naechsteId = 0, helferModus = null;

  /* ---------- Darstellung ---------- */
  function feldGroesse() {
    const W = innerWidth, H = innerHeight;
    groesse = Math.floor(Math.min((W - 24) / N, (H - 340) / N, 68));
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

  function zeigeHelfer() {
    const s = S(); s.helfer ??= {};
    p$("#pz-helfer").innerHTML = Object.entries(HELFER).map(([k, H]) => `
      <button class="pz-helfer ${helferModus === k ? "aktiv" : ""}" data-helfer="${k}" ${s.helfer[k] > 0 ? "" : "disabled"} title="${H.name}: ${H.text}">
        ${api.helferIcon(k, "ic gross")}<b>${s.helfer[k] || 0}</b></button>`).join("") +
      `<p class="pz-helfer-text">${helferModus ? `${HELFER[helferModus].text}. Tippe auf das Spielfeld.` : "Helfer: antippen, dann ein Feld wählen"}</p>`;
  }
  p$("#pz-helfer").addEventListener("click", e => {
    const b = e.target.closest("[data-helfer]"); if (!b || b.disabled || belegt) return;
    const k = b.dataset.helfer;
    helferModus = helferModus === k ? null : k; auswahlWeg(); zeigeHelfer();
  });
  async function helferEinsetzen(k, r, c) {
    const s = S();
    if (!(s.helfer[k] > 0)) return;
    let zellen = [];
    if (k === "hammer") zellen = [[r, c]];
    if (k === "besen") for (let x = 0; x < N; x++) zellen.push([r, x]);
    if (k === "regenbogen") {
      const f = farbeBei(r, c);
      if (f < 0) { api.meldung("Tippe auf einen normalen Stein, dessen Farbe verschwinden soll."); return; }
      for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) if (farbeBei(a, b) === f) zellen.push([a, b]);
    }
    belegt = true; helferModus = null;
    s.helfer[k]--; api.speichern();
    api.ton("knall");
    for (const [a, b] of zellen) explosion(a, b, k === "hammer" ? "bombe" : "rh");
    abraeumen(zellen, false);
    zeigeKopf(); zeigeHelfer();
    await warte(260); await fallen(); await kaskade(null);
    belegt = false; tippZeit = Date.now();
    if (fertig()) return gewonnen();
    if (zuege <= 0) {
      if (Object.values(s.helfer).some(n => n > 0)) api.meldung("Noch nicht geschafft. Du kannst einen weiteren Helfer einsetzen.");
      else return verloren();
    }
    if (!zugMoeglich()) { belegt = true; await mischen(); belegt = false; }
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
      api.ton(neueSpezial.length ? "knall" : "treffer", runde);
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
      api.ton("knall");
      abraeumen(z, false);
      zeigeKopf(); await warte(260); await fallen(); await kaskade(null);
    } else if (treffer().length) {
      zuege--; await kaskade([[r1, c1], [r2, c2]]);
    } else {
      tausch(r1, c1, r2, c2); setzen(a, r1, c1); setzen(b, r2, c2);
      a.el.classList.add("nein"); b.el.classList.add("nein"); api.ton("nein");
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
    if (r < 0 || c < 0 || r >= N || c >= N) return;
    if (helferModus) { helferEinsetzen(helferModus, r, c); return; }
    if (!gitter[r][c]) return;
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
  /* ---------- Weltkarte ---------- */
  const karte = p$("#pz-karte"), kInhalt = p$("#pz-karte-inhalt");
  const proKapitel = PUZZLE_WEG.steine.length;
  function karteZeigen() {
    api.schliessen();
    huelle.classList.remove("offen"); p$("#pz-dialog").hidden = true;
    document.body.classList.add("im-puzzle");
    const P = stand(), aktuell = P.level, kap = Math.ceil(aktuell / proKapitel), basis = (kap - 1) * proKapitel;
    const s = S(); s.helfer ??= {};
    const winter = (kap - 1) % PUZZLE_WEG.bilder.length === 1;
    p$("#pz-karte-titel").textContent = `Kapitel ${kap}${winter ? " ❄" : ""}`;
    karte.classList.toggle("winter", winter);
    p$("#pz-karte-helfer").innerHTML = Object.keys(HELFER).map(k => `<span>${api.helferIcon(k, "ic")}<b>${s.helfer[k] || 0}</b></span>`).join("");
    kInhalt.innerHTML = `<img src="${api.bildUrl(PUZZLE_WEG.bilder[(kap - 1) % PUZZLE_WEG.bilder.length])}" alt="" draggable="false">` + PUZZLE_WEG.steine.map(([x, y], i) => {
      const n = basis + i + 1, st = P.sterne?.[n] || 0;
      const zustand = n < aktuell ? "fertig" : n === aktuell ? "jetzt" : "zu";
      return `<button class="pz-stein ${zustand}" data-level="${n}" style="left:${x / PUZZLE_WEG.b * 100}%;top:${y / PUZZLE_WEG.h * 100}%" ${zustand === "zu" ? "disabled" : ""} aria-label="Level ${n}">
        <b>${n}</b>${zustand === "fertig" ? `<i>${"★".repeat(st)}<em>${"★".repeat(3 - st)}</em></i>` : ""}</button>`;
    }).join("");
    karte.hidden = false;
    // zum aktuellen Level scrollen
    requestAnimationFrame(() => {
      const el = kInhalt.querySelector(".pz-stein.jetzt");
      karte.scrollLeft = (karte.scrollWidth - karte.clientWidth) / 2;
      if (el) karte.scrollTop = el.offsetTop - karte.clientHeight * .6;
      else karte.scrollTop = karte.scrollHeight;
    });
  }
  function karteZu() { karte.hidden = true; schliessen(); }
  kInhalt.addEventListener("click", e => { const b = e.target.closest("[data-level]"); if (b && !b.disabled) levelStarten(+b.dataset.level); });
  p$("#pz-karte-zu").onclick = karteZu;

  function levelStarten(n) {
    karte.hidden = true;
    nummer = n;
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
    belegt = false; auswahl = null; tippZeit = Date.now(); helferModus = null; zeigeHelfer();
    zeigeDialog(`<h2>Level ${nummer}</h2>
      <p>Sammle in <b>${zuege} Zügen</b>:</p><div class="pz-ziele gross">${p$("#pz-ziele").innerHTML}</div>
      ${P_sterne(nummer)}
      <p class="hinweis">Tausche zwei Steine nebeneinander. 4 in einer Reihe ergeben eine Rakete, 5 oder eine L-Form eine Bombe. Kisten gehen kaputt, wenn daneben Steine verschwinden. Kommst du nicht weiter, helfen Hammer, Besen und Regenbogen unten.</p>
      <button class="los" data-pz="los">Los geht's</button>`);
  }
  function schliessen() { karte.hidden = true; huelle.classList.remove("offen"); document.body.classList.remove("im-puzzle"); p$("#pz-dialog").hidden = true; api.aktualisieren(); }
  function zeigeDialog(html) { const d = p$("#pz-dialog"); d.innerHTML = `<div class="karteninhalt">${html}</div>`; d.hidden = false; }
  function P_sterne(n) {
    const st = stand().sterne?.[n] || 0;
    return st ? `<p class="pz-sterne-alt">Bisher: ${"★".repeat(st)}${"☆".repeat(3 - st)}</p>` : "";
  }
  // Übrige Züge werden zu Raketen und Bomben, die gezündet werden und Münzen bringen
  async function bonusRunde() {
    const banner = p$("#pz-bonus"); banner.hidden = false;
    let ueberspringen = false; const skip = () => { ueberspringen = true; }; huelle.addEventListener("pointerdown", skip, { once: true });
    const pause = ms => ueberspringen ? Promise.resolve() : warte(ms);
    let geraeumt = 0; const z = zuege;
    for (let k = 0; k < z; k++) {
      const frei = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (gitter[r][c] && !gitter[r][c].spezial) frei.push([r, c]);
      if (!frei.length) break;
      const [r, c] = frei[Math.floor(Math.random() * frei.length)], st = gitter[r][c];
      st.el?.remove(); st.el = null; st.spezial = k % 4 === 3 ? "bombe" : Math.random() < .5 ? "rh" : "rv"; st.farbe = -1;
      setzen(st, r, c, true); st.el.classList.add("entsteht");
      zuege--; zeigeKopf(); api.ton("treffer", k % 8); await pause(120);
    }
    await pause(350);
    const zaehlen = () => gitter.flat().filter(Boolean).length;
    for (let runde = 0; runde < 60; runde++) {
      let pos = null;
      for (let r = 0; r < N && !pos; r++) for (let c = 0; c < N && !pos; c++) if (gitter[r][c]?.spezial) pos = [r, c];
      if (!pos) break;
      const vorher = zaehlen(); abraeumen([pos], false); geraeumt += vorher - zaehlen();
      api.ton("knall"); await pause(200); await fallen();
    }
    huelle.removeEventListener("pointerdown", skip);
    banner.hidden = true;
    return { zuege: z, muenzen: z * 5 + geraeumt };
  }
  async function gewonnen() {
    belegt = true;
    const startZuege = zuege;
    const bonus = zuege > 0 ? await bonusRunde() : { zuege: 0, muenzen: 0 };
    zuege = startZuege;
    belegt = false;
    const P = stand(), s = S(), erstmals = nummer >= P.level;
    const lohn = erstmals ? PUZZLE_LOHN(nummer) : { muenzen: 10 + nummer, werkzeuge: 0, punkte: 0 };
    const anteil = zuege / L.zuege, sterne = anteil >= .35 ? 3 : anteil >= .15 ? 2 : 1;
    P.sterne ??= {}; P.sterne[nummer] = Math.max(P.sterne[nummer] || 0, sterne);
    s.helfer ??= {};
    const helferGewinn = erstmals && Math.random() < (sterne === 3 ? .5 : .25) ? Object.keys(HELFER)[Math.floor(Math.random() * 3)] : null;
    if (helferGewinn) s.helfer[helferGewinn] = (s.helfer[helferGewinn] || 0) + 1;
    api.ton("sieg");
    s.muenzen += lohn.muenzen + bonus.muenzen;
    s.werkzeug ??= { axt: 3, schaufel: 2, spitzhacke: 2 };
    const bekommen = {};
    for (let k = 0; k < lohn.werkzeuge; k++) { const w = Object.keys(WERKZEUGE)[Math.floor(Math.random() * 3)]; s.werkzeug[w]++; bekommen[w] = (bekommen[w] || 0) + 1; }
    if (erstmals) { api.eventGeben?.(4); api.inselEreignis("puzzle"); if (s.insel) s.insel.punkte += lohn.punkte; P.level = nummer + 1; }
    P.gewonnen++;
    api.speichern();
    zeigeDialog(`<h2>Gewonnen!</h2><div class="pz-sterne">${[1, 2, 3].map(k => `<span class="${k <= sterne ? "an" : ""}">★</span>`).join("")}</div>
      <p>Level ${nummer} geschafft mit ${zuege} Zügen übrig.</p>
      ${bonus.zuege ? `<p class="pz-bonus-text">Bonus für ${bonus.zuege} übrige Züge: <b>+${bonus.muenzen}</b> ${api.muenze("ic klein")}</p>` : ""}
      <div class="pz-lohn"><span>${api.muenze("ic gross")}<b>${lohn.muenzen + bonus.muenzen}</b></span>
      ${Object.entries(bekommen).map(([w, n]) => `<span><img class="ic gross" src="${api.bildUrl(WERKZEUGE[w].bild)}" alt="${WERKZEUGE[w].name}"><b>${n}</b></span>`).join("")}
      ${s.insel && lohn.punkte ? `<span class="ew">⭐<b>${lohn.punkte}</b></span>` : ""}
      ${helferGewinn ? `<span>${api.helferIcon(helferGewinn, "ic gross")}<b>1</b></span>` : ""}</div>
      ${erstmals ? "" : `<p class="hinweis">Wiederholt: kleiner Lohn, aber deine besten Sterne bleiben.</p>`}
      <div class="knoepfe"><button class="los" data-pz="weiter">Nächstes Level</button><button class="los zweit" data-pz="karte">Zur Karte</button></div>`);
  }
  function verloren() {
    const rest = Object.entries(ziele).filter(([, n]) => n > 0).length;
    const helfer = Object.values(S().helfer || {}).some(n => n > 0);
    zeigeDialog(`<h2>Keine Züge mehr</h2><p>Fast geschafft! Es ${rest === 1 ? "fehlt noch ein Ziel" : `fehlen noch ${rest} Ziele`}.
      ${helfer ? "Mit einem Helfer kannst du es vielleicht noch schaffen." : "Versuch es einfach noch mal, das kostet nichts."}</p>
      <div class="knoepfe">${helfer ? `<button class="los" data-pz="helfen">Helfer einsetzen</button>` : ""}
      <button class="los ${helfer ? "zweit" : ""}" data-pz="nochmal">Noch mal</button><button class="los zweit" data-pz="karte">Zur Karte</button></div>`);
  }
  p$("#pz-dialog").addEventListener("click", e => {
    const b = e.target.closest("[data-pz]"); if (!b) return;
    const a = b.dataset.pz;
    if (a === "los") p$("#pz-dialog").hidden = true;
    if (a === "helfen") { p$("#pz-dialog").hidden = true; zeigeHelfer(); api.meldung("Wähle unten einen Helfer und tippe aufs Feld."); }
    if (a === "weiter") levelStarten(stand().level);
    if (a === "nochmal") levelStarten(nummer);
    if (a === "karte") karteZeigen();
    if (a === "zu") schliessen();
  });
  p$("#pz-zu").onclick = () => {
    if (belegt) return;
    zeigeDialog(`<h2>Level verlassen?</h2><p>Dein Fortschritt in diesem Level geht verloren. Du kannst es jederzeit neu starten.</p>
      <div class="knoepfe"><button class="los rot" data-pz="karte">Verlassen</button><button class="los zweit" data-pz="los">Weiterspielen</button></div>`);
  };
  addEventListener("resize", () => { if (huelle.classList.contains("offen")) { feldGroesse(); zeichneFelder(); } });

  return { oeffnen: karteZeigen, get level() { return stand().level; } };
}
