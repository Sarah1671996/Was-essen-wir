// Sonnenhof – Abenteuerinsel (Schritt 2): Hindernisse freiräumen, Truhen öffnen, Brücken reparieren,
// Quests erfüllen und Punkte auf dem Belohnungspfad sammeln.
import {
  WAREN, BAUTEN, WERKZEUGE, HELFER, INSEL_LEVEL, INSEL_KARTE, WERKZEUG_KISTE, HINDERNISSE, INSEL_PLAETZE, TIEFE_TEUER,
  PUNKTE, QUESTS, AKTIVE_QUESTS, PFAD,
} from "./daten.js";

export function inselStarten(api) {
  const S = () => api.S();
  const q$ = s => document.querySelector(s);
  const rahmen = q$("#insel-rahmen"), iwelt = q$("#insel-welt");
  iwelt.style.width = INSEL_KARTE.b + "px"; iwelt.style.height = INSEL_KARTE.h + "px";
  const wz = (w, cls = "ic") => `<img class="${cls}" src="${api.bildUrl(WERKZEUGE[w].bild)}" alt="${WERKZEUGE[w].name}">`;
  const zufallsWerkzeug = () => ["axt", "schaufel", "spitzhacke"][Math.floor(Math.random() * 3)];

  /* ---------- Zustand ---------- */
  function stand() {
    const s = S();
    s.werkzeug ??= { axt: 3, schaufel: 2, spitzhacke: 2 };
    s.insel ??= { frei: ["lager"], truhen: [], punkte: 0, pfad: 0, quests: [], naechste: 0, kisteT: Date.now(), runde: 1, gesehen: false };
    const I = s.insel;
    while (I.quests.length < AKTIVE_QUESTS && I.naechste < QUESTS.length) I.quests.push({ q: I.naechste++, stand: 0 });
    return I;
  }
  const istFrei = id => stand().frei.includes(id);
  const erreichbar = id => !istFrei(id) && (INSEL_PLAETZE[id].nach || []).some(istFrei);
  const kosten = id => TIEFE_TEUER.includes(id) ? 2 : 1;
  const alleFrei = () => Object.keys(INSEL_PLAETZE).every(istFrei);
  function kisteAnzahl() {
    const I = stand(), ms = WERKZEUG_KISTE.minuten * 60000;
    return Math.min(WERKZEUG_KISTE.max, Math.floor((Date.now() - I.kisteT) / ms));
  }

  /* ---------- Quests und Punkte ---------- */
  function punkte(n, d) {
    stand().punkte += n;
    if (d) schwebt(d, `+${n} ⭐`);
    zeigeHud();
  }
  function ereignis(typ) {
    const I = stand();
    let geschafft = false;
    for (const q of I.quests) {
      const Q = QUESTS[q.q];
      if (Q.typ === typ || (Q.typ === "hindernis" && ["axt", "schaufel", "spitzhacke"].includes(typ))) q.stand++;
      if (q.stand >= Q.n && !q.fertig) {
        q.fertig = true; I.punkte += Q.punkte; geschafft = true;
        api.meldung(`Quest geschafft: ${Q.text} (+${Q.punkte} Punkte)`);
      }
    }
    if (geschafft) {
      I.quests = I.quests.filter(q => !q.fertig);
      while (I.quests.length < AKTIVE_QUESTS && I.naechste < QUESTS.length) I.quests.push({ q: I.naechste++, stand: 0 });
      // Quests, die sofort erfüllt sind (z. B. Ziel schon erreicht), gleich prüfen
      if (alleFrei()) setTimeout(() => ereignis("alles"), 50);
    }
    zeigeHud();
  }

  /* ---------- Kamera ---------- */
  const cam = { s: 1, x: 0, y: 0 };
  function grenzen() {
    const W = innerWidth, H = innerHeight;
    cam.s = Math.min(1.8, Math.max(Math.min(W / INSEL_KARTE.b, H / INSEL_KARTE.h) * .96, cam.s));
    const w = INSEL_KARTE.b * cam.s, h = INSEL_KARTE.h * cam.s;
    cam.x = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, cam.x));
    cam.y = h <= H ? (H - h) / 2 : Math.min(0, Math.max(H - h, cam.y));
  }
  const setzen = () => { grenzen(); iwelt.style.transform = `translate(${cam.x}px,${cam.y}px) scale(${cam.s})`; };
  function startKamera() {
    const W = innerWidth, H = innerHeight;
    cam.s = Math.max(W / INSEL_KARTE.b, H / INSEL_KARTE.h, W < 700 ? .85 : .9);
    const mx = W < 700 ? 1130 : 1000; cam.x = W / 2 - mx * cam.s; cam.y = H / 2 - (W < 700 ? 600 : 560) * cam.s; setzen();
  }
  const zuKarte = (cx, cy) => ({ x: (cx - cam.x) / cam.s, y: (cy - cam.y) / cam.s });
  function zoom(f, cx, cy) { const p = zuKarte(cx, cy); cam.s *= f; grenzen(); cam.x = cx - p.x * cam.s; cam.y = cy - p.y * cam.s; setzen(); }
  const zg = new Map(); let bew = false, st = null, pz = null;
  rahmen.addEventListener("pointerdown", e => {
    zg.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (zg.size === 1) { bew = false; st = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; }
    if (zg.size === 2) { const [a, b] = [...zg.values()]; pz = { d: Math.hypot(a.x - b.x, a.y - b.y), s: cam.s }; bew = true; }
  });
  rahmen.addEventListener("pointermove", e => {
    if (!zg.has(e.pointerId)) return;
    zg.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (zg.size === 2 && pz) { const [a, b] = [...zg.values()]; zoom(pz.s * Math.hypot(a.x - b.x, a.y - b.y) / pz.d / cam.s, (a.x + b.x) / 2, (a.y + b.y) / 2); return; }
    if (!st) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (!bew && Math.hypot(dx, dy) > 8) { bew = true; rahmen.classList.add("zieht"); }
    if (bew) { cam.x = st.cx + dx; cam.y = st.cy + dy; setzen(); }
  });
  const ende = e => { zg.delete(e.pointerId); if (zg.size < 2) pz = null; if (!zg.size) { st = null; rahmen.classList.remove("zieht"); } };
  rahmen.addEventListener("pointerup", ende); rahmen.addEventListener("pointercancel", ende);
  rahmen.addEventListener("wheel", e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX, e.clientY); }, { passive: false });
  rahmen.addEventListener("click", e => {
    if (bew) return;
    const el = e.target.closest(".ding");
    if (el && dinge.has(el.dataset.id)) { dinge.get(el.dataset.id).tipp(); return; }
    api.schliessen();
  });
  addEventListener("resize", () => { if (aktiv) setzen(); });

  /* ---------- Dinge auf der Insel ---------- */
  const dinge = new Map();
  function ding(id, bild, x, y, breite, tipp, cls = "") {
    const el = document.createElement("div");
    const h = api.hoehe(bild, breite);
    el.className = "ding " + cls; el.dataset.id = id;
    el.style.cssText = `left:${x - breite / 2}px;top:${y - h}px;width:${breite}px;height:${h}px;z-index:${Math.round(y)}`;
    el.innerHTML = `<img class="spr" src="${api.bildUrl(bild)}" alt="" draggable="false"><div class="ov"></div>`;
    iwelt.appendChild(el);
    const d = { id, el, ov: el.lastChild, x, y, h, tipp, html: "" };
    dinge.set(id, d); return d;
  }
  const ov = (d, html) => { if (d.html !== html) { d.html = html; d.ov.innerHTML = html; } };
  function schwebt(d, text) {
    const f = document.createElement("div"); f.className = "schwebt"; f.textContent = text;
    f.style.left = d.x + "px"; f.style.top = (d.y - d.h * .8) + "px"; iwelt.appendChild(f);
    setTimeout(() => f.remove(), 1300);
  }

  function aufbauen() {
    for (const d of dinge.values()) d.el.remove();
    dinge.clear();
    const I = stand();
    for (const [id, P] of Object.entries(INSEL_PLAETZE)) {
      if (P.art === "start") { ding(id, "zelt", P.x, P.y, 170, () => kistePanel(), "zelt"); continue; }
      if (P.art === "bruecke") {
        ding(id, istFrei(id) ? "bruecke" : "bruecke-kaputt", P.x, P.y, 150, () => brueckeTipp(id), istFrei(id) ? "deko-ding" : "");
        continue;
      }
      if (!istFrei(id)) { const H = HINDERNISSE[P.art]; ding(id, H.bild, P.x, P.y, H.breite, () => hindernisTipp(id)); }
      else if (P.truhe && !I.truhen.includes(id)) ding(id, "truhe", P.x, P.y, 72, () => truheTipp(id), "truhe-ding");
    }
    aktualisieren();
  }
  function aktualisieren() {
    if (!aktiv) return;
    for (const [id, d] of dinge) {
      const P = INSEL_PLAETZE[id];
      if (P.art === "start") {
        const n = kisteAnzahl();
        ov(d, n ? `<div class="blase" style="top:-30px">${wz(zufallsWerkzeugAnzeige, "ic mittel")}<b class="mini">${n}</b></div>` : "");
        continue;
      }
      if (istFrei(id)) { ov(d, ""); continue; }
      const offen = erreichbar(id);
      d.el.classList.toggle("fern", !offen);
      d.el.classList.toggle("erreichbar", offen);
      if (!offen) { ov(d, ""); continue; }
      if (P.art === "bruecke") ov(d, `<div class="preis">🔧 ${P.name}</div>`);
      else {
        const w = HINDERNISSE[P.art].werkzeug, n = kosten(id), genug = (S().werkzeug[w] || 0) >= n;
        ov(d, `<div class="preis ${genug ? "" : "fehlt"}">${wz(w, "ic klein")} ${n}</div>`);
      }
    }
  }
  let zufallsWerkzeugAnzeige = "axt";

  /* ---------- Antippen ---------- */
  function hindernisTipp(id) {
    const P = INSEL_PLAETZE[id], H = HINDERNISSE[P.art], d = dinge.get(id);
    if (!erreichbar(id)) { api.meldung("Räume zuerst den Weg bis hierher frei."); return; }
    const w = H.werkzeug, n = kosten(id), s = S();
    if ((s.werkzeug[w] || 0) < n) {
      api.meldung(`Dir fehlt ${n === 1 ? "eine" : n} ${WERKZEUGE[w].name}. Werkzeuge gibt es für Aufträge auf dem Hof und in der Kiste am Zelt.`);
      return;
    }
    s.werkzeug[w] -= n;
    stand().frei.push(id);
    d.el.classList.add("verschwindet");
    punkte(PUNKTE.hindernis, d);
    ereignis(w);
    if (P.ziel) ereignis("ziel:" + P.ziel);
    if (P.ziel === "dorf") api.meldung("Du hast das alte Dorf entdeckt!");
    if (P.ziel === "wasserfall") api.meldung("Was für ein Ausblick: der Wasserfall!");
    if (alleFrei()) ereignis("alles");
    api.speichern();
    setTimeout(() => { aufbauen(); if (alleFrei()) fertigPanel(); }, 550);
  }
  function truheTipp(id) {
    const d = dinge.get(id), I = stand(), s = S();
    if (I.truhen.includes(id)) return;
    I.truhen.push(id);
    const muenzen = 20 + Math.floor(Math.random() * 40), w1 = zufallsWerkzeug(), w2 = Math.random() < .5 ? zufallsWerkzeug() : null;
    s.muenzen += muenzen; s.werkzeug[w1]++; if (w2) s.werkzeug[w2]++;
    d.el.querySelector(".spr").src = api.bildUrl("truhe-offen");
    d.el.classList.add("offen");
    punkte(PUNKTE.truhe, d);
    api.meldung(`Schatz gefunden: ${muenzen} Münzen, ${WERKZEUGE[w1].name}${w2 ? " und " + WERKZEUGE[w2].name : ""}`);
    ereignis("truhe");
    api.speichern(); api.aktualisieren();
    setTimeout(() => { d.el.classList.add("verschwindet"); setTimeout(aufbauen, 500); }, 1300);
  }
  function brueckeTipp(id) {
    const P = INSEL_PLAETZE[id];
    if (istFrei(id)) { api.meldung(`Die ${P.name} hält wieder.`); return; }
    if (!erreichbar(id)) { api.meldung("Räume zuerst den Weg bis hierher frei."); return; }
    api.oeffnen("i-bruecke:" + id, () => {
      const s = S();
      return `<div class="kopf"><h2>${P.name} reparieren</h2>${api.zu()}</div>
        <div class="bauvorschau"><img src="${api.bildUrl("bruecke")}" alt=""></div>
        <p>Dafür brauchst du Material vom Hof:</p>
        <div class="waren gross-waren">${Object.entries(P.kosten).map(([w, n]) => `<span class="${(s.lager[w] || 0) >= n ? "" : "fehlt"}">${api.icon(w)} ${Math.min(s.lager[w] || 0, n)}/${n} ${WAREN[w].name}</span>`).join("")}</div>
        <button class="los" data-aktion="i-reparieren" data-id="${id}" ${api.hat(P.kosten) ? "" : "disabled"}>Reparieren</button>`;
    });
  }
  function kistePanel() {
    api.oeffnen("i-kiste", () => {
      const n = kisteAnzahl(), I = stand();
      const rest = WERKZEUG_KISTE.minuten * 60000 - ((Date.now() - I.kisteT) % (WERKZEUG_KISTE.minuten * 60000));
      return `<div class="kopf"><h2>Werkzeugkiste am Zelt</h2>${api.zu()}</div>
        <p>Hier legt die Entdeckerin alle ${WERKZEUG_KISTE.minuten} Minuten ein Werkzeug für dich bereit (höchstens ${WERKZEUG_KISTE.max}).</p>
        ${werkzeugZeile()}
        <button class="los" data-aktion="i-kiste" ${n ? "" : "disabled"}>${n ? `${n} Werkzeug${n > 1 ? "e" : ""} nehmen` : `Nächstes in ${api.dauer(rest)}`}</button>
        <p class="hinweis">Mehr Werkzeuge bekommst du für Aufträge auf dem Hof und in Schatztruhen.</p>`;
    });
  }
  const werkzeugZeile = () => `<div class="werkzeugzeile">${Object.keys(WERKZEUGE).map(w => `<span>${wz(w, "ic gross")}<b>${S().werkzeug[w] || 0}</b><small>${WERKZEUGE[w].name}</small></span>`).join("")}</div>`;

  /* ---------- Fenster ---------- */
  function questPanel() {
    api.oeffnen("i-quests", () => {
      const I = stand();
      return `<div class="kopf"><h2>Quests</h2>${api.zu()}</div>
        <div class="gastgeberin"><img src="${api.bildUrl("gastgeberin")}" alt="Die Entdeckerin"><p>„Hilf mir, die Insel zu erkunden! Für jede Quest bekommst du Punkte für den Belohnungspfad.“</p></div>
        <div class="quests">${I.quests.length ? I.quests.map(q => {
          const Q = QUESTS[q.q], pr = Math.min(1, q.stand / Q.n);
          return `<div class="quest"><div><b>${Q.text}</b><small>${Math.min(q.stand, Q.n)}/${Q.n}</small></div>
            <span class="questpunkte">+${Q.punkte} ⭐</span><i class="questbalken"><i style="width:${pr * 100}%"></i></i></div>`;
        }).join("") : `<p class="hinweis">Alle Quests dieser Insel sind geschafft!</p>`}</div>
        ${werkzeugZeile()}`;
    });
  }
  function pfadPanel() {
    api.oeffnen("i-pfad", () => {
      const I = stand();
      return `<div class="kopf"><h2>Belohnungspfad</h2>${api.zu()}</div>
        <p>Du hast <b>${I.punkte} ⭐ Punkte</b>.</p>
        <div class="pfad">${PFAD.map((P, k) => {
          const geholt = k < I.pfad, bereit = k === I.pfad && I.punkte >= P.punkte;
          const teile = [];
          if (P.muenzen) teile.push(`${api.muenze("ic klein")} ${P.muenzen}`);
          if (P.werkzeug) teile.push(Object.entries(P.werkzeug).map(([w, n]) => `${wz(w, "ic klein")}${n}`).join(" "));
          if (P.helfer) teile.push(Object.entries(P.helfer).map(([h, n]) => `${api.helferIcon(h, "ic klein")}${n} ${HELFER[h].name}`).join(" "));
          if (P.deko) teile.push(`<img class="ic mittel" src="${api.bildUrl(BAUTEN[P.deko].bild)}" alt=""> ${P.text}`);
          return `<div class="stufe ${geholt ? "geholt" : bereit ? "bereit" : ""}">
            <span class="stufenpunkte">${P.punkte} ⭐</span><span class="stufenlohn">${teile.join(" · ")}</span>
            ${geholt ? `<span class="haken">✓</span>` : `<button class="los" data-aktion="i-pfad" ${bereit ? "" : "disabled"}>Holen</button>`}</div>`;
        }).join("")}</div>`;
    });
  }
  function fertigPanel() {
    api.oeffnen("i-fertig", () => `<div class="kopf"><h2>Insel erkundet!</h2>${api.zu()}</div>
      <div class="gastgeberin"><img src="${api.bildUrl("gastgeberin")}" alt=""><p>„Fantastisch, du hast jede Ecke freigeräumt! Wenn du magst, wächst der Dschungel nach und wir legen neue Schätze aus.“</p></div>
      <button class="los" data-aktion="i-neu">Neue Expedition starten</button>`);
  }
  document.querySelector("#fenster").addEventListener("click", e => {
    const b = e.target.closest("[data-aktion^='i-']"); if (!b || b.disabled) return;
    const a = b.dataset.aktion, s = S(), I = stand();
    if (a === "i-reparieren") {
      const id = b.dataset.id, P = INSEL_PLAETZE[id];
      if (!api.hat(P.kosten)) return;
      api.nehmen(P.kosten); I.frei.push(id); api.schliessen();
      punkte(PUNKTE.bruecke, dinge.get(id)); ereignis("bruecke:" + id);
      api.meldung(`Die ${P.name} ist repariert!`);
      if (alleFrei()) ereignis("alles");
      aufbauen();
    }
    if (a === "i-kiste") {
      const n = kisteAnzahl(); if (!n) return;
      const bekommen = [];
      for (let k = 0; k < n; k++) { const w = zufallsWerkzeug(); s.werkzeug[w]++; bekommen.push(WERKZEUGE[w].name); }
      I.kisteT = n >= WERKZEUG_KISTE.max ? Date.now() : I.kisteT + n * WERKZEUG_KISTE.minuten * 60000;
      api.meldung("Du bekommst: " + bekommen.join(", "));
    }
    if (a === "i-pfad") {
      const P = PFAD[I.pfad]; if (!P || I.punkte < P.punkte) return;
      if (P.muenzen) s.muenzen += P.muenzen;
      if (P.werkzeug) for (const [w, n] of Object.entries(P.werkzeug)) s.werkzeug[w] += n;
      if (P.helfer) for (const [h, n] of Object.entries(P.helfer)) s.helfer[h] = (s.helfer[h] || 0) + n;
      if (P.deko) { s.dekoFrei ??= {}; s.dekoFrei[P.deko] = (s.dekoFrei[P.deko] || 0) + 1; api.meldung(`${BAUTEN[P.deko].name} wartet im Bauen-Menü auf dich!`); }
      else api.meldung("Belohnung abgeholt!");
      I.pfad++;
    }
    if (a === "i-neu") {
      I.frei = ["lager"]; I.truhen = []; I.runde++;
      I.quests = []; I.naechste = 0; stand();
      api.schliessen(); aufbauen(); api.meldung(`Expedition ${I.runde} beginnt!`);
    }
    api.speichern(); api.aktualisieren(); zeigeHud();
  });

  /* ---------- Hin und zurück ---------- */
  let aktiv = false;
  function zeigeHud() {
    const I = stand(), s = S();
    q$("#anz-punkte b").textContent = I.punkte;
    q$("#anz-werkzeug").innerHTML = Object.keys(WERKZEUGE).map(w => `${wz(w)}<b>${s.werkzeug[w] || 0}</b>`).join("");
    const bereit = PFAD[I.pfad] && I.punkte >= PFAD[I.pfad].punkte;
    q$("#pfad-zahl").hidden = !bereit;
  }
  function betreten() {
    if (S().level < INSEL_LEVEL) { api.meldung(`Das Boot fährt ab Level ${INSEL_LEVEL}. Sammle noch etwas Erfahrung auf dem Hof!`); return; }
    api.schliessen();
    aktiv = true; document.body.classList.add("auf-insel");
    zufallsWerkzeugAnzeige = zufallsWerkzeug();
    startKamera(); aufbauen(); zeigeHud();
    const I = stand();
    if (!I.gesehen) {
      I.gesehen = true; api.speichern();
      api.oeffnen("i-start", () => `<div class="kopf"><h2>Willkommen auf der Abenteuerinsel!</h2>${api.zu()}</div>
        <div class="gastgeberin"><img src="${api.bildUrl("gastgeberin")}" alt=""><p>„Hallo, ich bin Mila! Der Dschungel hat alle Wege zugewuchert. Mit Axt, Schaufel und Spitzhacke räumst du sie frei. Dahinter warten Schätze und ein altes Dorf.“</p></div>
        <p class="hinweis">Leuchtende Hindernisse kannst du jetzt freiräumen. Das Werkzeug dafür steht darüber.</p>
        <button class="los" data-aktion="zu">Los geht's</button>`);
    }
  }
  function verlassen() { aktiv = false; document.body.classList.remove("auf-insel"); api.schliessen(); api.aktualisieren(); }
  q$("#knopf-hof").onclick = verlassen;
  q$("#knopf-quests").onclick = questPanel;
  q$("#knopf-pfad").onclick = pfadPanel;

  return { betreten, verlassen, aktualisieren, ereignis, get aktiv() { return aktiv; } };
}
