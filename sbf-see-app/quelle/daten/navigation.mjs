// Liest die 15 Navigationsaufgaben (Ausgangslage, 9 Teilaufgaben mit Lösung) und merkt sich,
// auf welcher Seite der großen Lösungsweg-PDF jede Teilaufgabe beginnt.
import * as mupdf from "mupdf";
import fs from "fs";
const [, , aufgabenPdf, loesungPdf, outPath] = process.argv;
const lines = (doc, i) => { const L = []; doc.loadPage(i).toStructuredText().walk({ beginLine(b) { L.push({ s: "", x: b[0], y: b[1] }); }, onChar(c) { L[L.length - 1].s += c; } }); return L.map(l => ({ ...l, s: l.s.replace(/\s+/g, " ").trim() })).filter(l => l.s); };

const doc = mupdf.Document.openDocument(fs.readFileSync(aufgabenPdf), "application/pdf");
const tasks = [];
for (let i = 0; i < doc.countPages(); i++) {
  const L = lines(doc, i);
  const nr = +L[0].s.match(/Navigationsaufgabe (\d+) von 15/)[1];
  const iLage = L.findIndex(l => l.s === "Ausgangslage"), iHead = L.findIndex(l => l.s.startsWith("Teilaufgabe"));
  const ansX = L.find(l => l.s === "Korrekte Antwort").x - 5;
  const lage = [];
  for (const l of L.slice(iLage + 1, iHead)) {
    // Absatz, wenn der Abstand zur vorigen Zeile größer als eine Zeile ist
    if (lage.length && l.y - lage.at(-1).y < 20) { lage.at(-1).s += " " + l.s; lage.at(-1).y = l.y; } else lage.push({ s: l.s, y: l.y });
  }
  const teile = []; let cur = null;
  for (const l of L.slice(iHead + 2)) {
    if (/^Sie müssen 7 von 9/.test(l.s) || /^Navigationsaufgabe \d+ von 15$/.test(l.s)) break;
    if (l.x < 80 && /^\d$/.test(l.s)) { cur = { nr: +l.s, frage: [], antwort: [] }; teile.push(cur); continue; }
    if (!cur) continue;
    (l.x >= ansX ? cur.antwort : cur.frage).push(l.s);
  }
  for (const t of teile) {
    t.frage = t.frage.join(" ").replace(/ ([,.?])/g, "$1");
    // Antwortzeilen: neue Zeile bei Stichwörtern, Koordinaten und Peilungen, sonst zusammenfügen
    const out = [];
    for (const s of t.antwort) {
      const fresh = !out.length || /^(Farbe|Kennung|Toppzeichen|Bedeutung|Leuchttonne|Tonne|Feuer|\d{2,3}° ?\d|[A-ZÄÖÜ][a-zäöü]+-?[A-Za-z]*-Kardinal|Zeigt|BV|rw|Mg|oder)/.test(s) && !/[=:]$/.test(out.at(-1) || "");
      if (fresh) out.push(s); else out[out.length - 1] += " " + s;
    }
    t.antwort = out.map(s => s.replace(/\s+/g, " ").trim());
  }
  tasks.push({ nr, lage: lage.map(x => x.s), teile });
}

// Seiten der Lösungswege
const big = mupdf.Document.openDocument(fs.readFileSync(loesungPdf), "application/pdf");
const pages = {};
for (let i = 0; i < big.countPages(); i++) {
  const first = lines(big, i)[0];
  const m = first && first.s.match(/^Navigationsaufgabe (\d+): Teilaufgabe (\d+)$/);
  if (m && !pages[m[1] + "-" + m[2]]) pages[m[1] + "-" + m[2]] = i + 1;
}
for (const t of tasks) for (const te of t.teile) te.seite = pages[t.nr + "-" + te.nr] || null;
tasks.sort((a, b) => a.nr - b.nr);
console.log(tasks.length, "Aufgaben;", tasks.map(t => t.teile.length).join(","), "Teile; ohne Seite:", tasks.flatMap(t => t.teile.filter(x => !x.seite).map(x => t.nr + "-" + x.nr)).join(" ") || "keine");
fs.writeFileSync(outPath, JSON.stringify(tasks, null, 1));
