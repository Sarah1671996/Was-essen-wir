// Sonnenhof – Leben auf dem Hof: Vögel, Schmetterlinge, Glühwürmchen, Tag und Nacht nach der echten Uhrzeit
// und kleine Töne (selbst erzeugt, keine Tondateien). Töne lassen sich in den Einstellungen abschalten.
export function lebenStarten({ welt, WELT }) {
  const TON_KEY = "sonnenhof-ton";
  let tonAn = (() => { try { return localStorage.getItem(TON_KEY) !== "0"; } catch { return true; } })();
  const ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Tageszeit ---------- */
  const schicht = document.createElement("div"); schicht.id = "tageszeit"; document.body.appendChild(schicht);
  function stunde() { const d = new Date(); return d.getHours() + d.getMinutes() / 60; }
  function tageszeit() {
    const h = stunde();
    // [Farbe, Deckkraft]
    let f = ["#000", 0];
    if (h >= 22 || h < 5) f = ["#1d2a6b", .42];
    else if (h < 6) f = ["#3a3f8f", .3];
    else if (h < 8) f = ["#ff9a5a", .16];
    else if (h < 18) f = ["#000", 0];
    else if (h < 20) f = ["#ff7a59", .16];
    else f = ["#33407f", .3];
    schicht.style.background = f[0]; schicht.style.opacity = f[1];
    document.body.classList.toggle("nacht", h >= 20.5 || h < 6);
  }
  tageszeit(); setInterval(tageszeit, 60000);
  const istNacht = () => document.body.classList.contains("nacht");

  /* ---------- Vögel ---------- */
  const vogelSvg = `<svg viewBox="0 0 40 20" aria-hidden="true"><path d="M2 10 Q10 2 20 10 Q30 2 38 10" fill="none" stroke="#4a3a2a" stroke-width="3" stroke-linecap="round"/></svg>`;
  function schwarm() {
    if (!ruhig && !istNacht() && !document.hidden) {
      const n = 2 + Math.floor(Math.random() * 3), y = 90 + Math.random() * innerHeight * .35, links = Math.random() < .5;
      const s = document.createElement("div"); s.className = "schwarm" + (links ? "" : " rueckwaerts");
      s.style.top = y + "px"; s.style.animationDuration = (14 + Math.random() * 8) + "s";
      for (let k = 0; k < n; k++) {
        const v = document.createElement("i"); v.innerHTML = vogelSvg;
        v.style.left = k * 26 + "px"; v.style.top = (k % 2) * 14 + Math.random() * 6 + "px"; v.style.animationDelay = (-Math.random()) + "s";
        s.appendChild(v);
      }
      document.body.appendChild(s); setTimeout(() => s.remove(), 24000);
    }
    setTimeout(schwarm, 18000 + Math.random() * 25000);
  }
  setTimeout(schwarm, 4000);

  /* ---------- Schmetterlinge und Glühwürmchen ---------- */
  const farben = ["#ffb347", "#ff8fb1", "#9fd0ff", "#c9a2ff", "#fff27a"];
  const falter = [];
  for (let k = 0; k < 6; k++) {
    const el = document.createElement("div"); el.className = "falter";
    const c = farben[k % farben.length];
    el.innerHTML = `<i style="background:${c}"></i><i style="background:${c}"></i>`;
    welt.appendChild(el);
    falter.push({ el, x: 200 + Math.random() * (WELT.b - 400), y: 200 + Math.random() * (WELT.h - 400) });
  }
  const gluehen = [];
  for (let k = 0; k < 14; k++) {
    const el = document.createElement("div"); el.className = "gluehwurm";
    el.style.animationDelay = (-Math.random() * 4) + "s";
    welt.appendChild(el); gluehen.push({ el, x: Math.random() * WELT.b, y: 150 + Math.random() * (WELT.h - 250) });
  }
  function flattern() {
    const nacht = istNacht();
    for (const f of falter) {
      f.el.hidden = nacht || ruhig;
      f.x = Math.min(WELT.b - 60, Math.max(60, f.x + (Math.random() - .5) * 260));
      f.y = Math.min(WELT.h - 80, Math.max(120, f.y + (Math.random() - .5) * 180));
      f.el.style.transform = `translate(${f.x}px,${f.y}px)`; f.el.style.zIndex = Math.round(f.y) + 60;
    }
    for (const g of gluehen) {
      g.el.hidden = !nacht || ruhig;
      g.x = Math.min(WELT.b - 30, Math.max(30, g.x + (Math.random() - .5) * 120));
      g.y = Math.min(WELT.h - 40, Math.max(120, g.y + (Math.random() - .5) * 90));
      g.el.style.transform = `translate(${g.x}px,${g.y}px)`;
    }
  }
  flattern(); setInterval(flattern, 3200);

  /* ---------- Töne ---------- */
  let ctx = null;
  const bereit = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } } if (ctx?.state === "suspended") ctx.resume(); };
  addEventListener("pointerdown", bereit, { passive: true });
  function klang(freq, start, laenge, art = "sine", lautst = .12, bis = null) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + start;
    o.type = art; o.frequency.setValueAtTime(freq, t);
    if (bis) o.frequency.exponentialRampToValueAtTime(bis, t + laenge);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lautst, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + laenge);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + laenge + .05);
  }
  let letzter = 0;
  function ton(art, n = 0) {
    if (!tonAn || !ctx) return;
    const t = performance.now(); if (t - letzter < 60) return; letzter = t;
    if (art === "ernte") { klang(520, 0, .12, "triangle", .14, 880); }
    else if (art === "muenze") { klang(988, 0, .09, "square", .05); klang(1319, .08, .2, "square", .05); }
    else if (art === "level") { [523, 659, 784, 1047].forEach((f, k) => klang(f, k * .09, .25, "triangle", .12)); }
    else if (art === "treffer") { klang(440 * Math.pow(1.12, Math.min(n, 8)), 0, .16, "sine", .13, 660 * Math.pow(1.12, Math.min(n, 8))); }
    else if (art === "knall") { klang(160, 0, .3, "sawtooth", .08, 50); }
    else if (art === "nein") { klang(220, 0, .14, "square", .05, 160); }
    else if (art === "sieg") { [523, 659, 784, 659, 784, 1047].forEach((f, k) => klang(f, k * .11, .3, "triangle", .12)); }
  }
  return {
    ton,
    tonAn: () => tonAn,
    tonUmschalten() { tonAn = !tonAn; try { localStorage.setItem(TON_KEY, tonAn ? "1" : "0"); } catch {} if (tonAn) { bereit(); ton("muenze"); } },
  };
}
