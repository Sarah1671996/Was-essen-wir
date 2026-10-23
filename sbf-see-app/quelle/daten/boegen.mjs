// Ordnet die 15 Prüfungsbögen den Katalognummern zu (Abgleich über Fragetext + Antwortmenge)
import * as mupdf from "mupdf";
import fs from "fs";
const [, , pdfPath, katalogPath, outPath] = process.argv;
const Q = JSON.parse(fs.readFileSync(katalogPath, "utf8"));
const norm = s => s.replace(/\s+/g, " ").replace(/[‚‘’']/g, "'").trim().toLowerCase();
const key = (q, a) => norm(q) + "|" + a.map(norm).sort().join("|");
const byKey = new Map(Q.map(x => [key(x.q, x.a), x.n]));

const doc = mupdf.Document.openDocument(fs.readFileSync(pdfPath), "application/pdf");
const boegen = {}; let bogen = 0, cur = null, field = null, skip = false;
const flush = () => {
  if (!cur) return;
  const n = byKey.get(key(cur.q, cur.a));
  (boegen[bogen] ||= []).push(n ?? { unmatched: cur.q, nr: cur.nr, a: cur.a });
  cur = null;
};
for (let i = 0; i < doc.countPages(); i++) {
  const lines = [];
  doc.loadPage(i).toStructuredText().walk({ beginLine(b) { lines.push({ s: "", x: b[0] }); }, onChar(c) { lines[lines.length - 1].s += c; } });
  for (const l of lines) {
    const s = l.s.replace(/\s+/g, " ").trim(); let m;
    if (!s) continue;
    if ((m = s.match(/^Prüfungsbogen (\d+) von 15$/))) { if (+m[1] !== bogen) { flush(); bogen = +m[1]; skip = false; } continue; }
    if (/^Auswertung/.test(s)) { flush(); skip = true; continue; }
    if (skip) continue;
    if (/^(SBF-See komplett|Lehrgang SBF-See|Seite \d+ von|Um die Prüfung|Die Prüfungszeit|Basisfragen$|Spezifische)/.test(s)) { continue; }
    if ((m = s.match(/^(\d+)\. (.*)$/)) && (!cur || +m[1] === cur.nr + 1 || +m[1] === 1)) { flush(); cur = { nr: +m[1], q: m[2], a: [] }; field = "q"; continue; }
    if ((m = s.match(/^([A-D])\) (.*)$/)) && cur) { cur.a.push(m[2]); field = "a"; continue; }
    if (cur && field === "q") cur.q += " " + s;
    else if (cur && field === "a" && cur.a.length) cur.a[cur.a.length - 1] += " " + s;
  }
}
flush();
const bad = Object.entries(boegen).flatMap(([b, l]) => l.filter(x => typeof x !== "number").map(x => ({ b, ...x })));
console.log("Bögen:", Object.keys(boegen).length, "Längen:", Object.values(boegen).map(l => l.length).join(","), "nicht zugeordnet:", bad.length);
if (bad.length) console.log(JSON.stringify(bad.slice(0, 3), null, 1));
fs.writeFileSync(outPath, JSON.stringify(boegen));
