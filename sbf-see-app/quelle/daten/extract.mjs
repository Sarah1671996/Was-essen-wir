import * as mupdf from "mupdf";
import fs from "fs";
import crypto from "crypto";
const [, , pdfPath, outDir] = process.argv;
const doc = mupdf.Document.openDocument(fs.readFileSync(pdfPath), "application/pdf");
fs.mkdirSync(outDir + "/img", { recursive: true });

const questions = [];
let section = "";
let cur = null, field = null;
const pendingImgs = []; // {page, y, png}
const hashes = new Map();
const headings = new Set();

for (let i = 0; i < doc.countPages(); i++) {
  const page = doc.loadPage(i);
  const st = page.toStructuredText("preserve-images");
  const lines = [];
  st.walk({
    onImageBlock(bbox, transform, image) {
      if (bbox[2] - bbox[0] < 20) return; // checkbox
      const png = image.toPixmap().asPNG();
      const h = crypto.createHash("md5").update(png).digest("hex").slice(0, 10);
      if (!hashes.has(h)) { hashes.set(h, png); fs.writeFileSync(`${outDir}/img/${h}.png`, png); }
      lines.push({ img: h, y: bbox[1], x: bbox[0] });
    },
    beginLine(bbox) { lines.push({ s: "", y: bbox[1], x: bbox[0] }); },
    onChar(c) { lines[lines.length - 1].s += c; },
  });
  // images may come before/after text; sort by y then images last
  const imgs = lines.filter(l => l.img);
  const texts = lines.filter(l => !l.img && !/^(SBF-See komplett|Lehrgang SBF-See|Seite \d+ von)/.test(l.s.trim()));
  const pageQs = [];
  for (const l of texts) {
    const s = l.s.replace(/\s+/g, " ").trim();
    if (!s) continue;
    let m;
    if ((m = s.match(/^(\d+)\. (.*)$/)) && l.x < 40 && (!cur || +m[1] === cur.n + 1)) {
      cur = { n: +m[1], section, q: m[2], a: [], img: [], y: l.y, page: i + 1 };
      questions.push(cur); pageQs.push(cur); field = "q";
    } else if ((m = s.match(/^([A-D])\) (.*)$/)) && cur) {
      cur.a.push(m[2]); field = "a";
    } else if (cur && l.x < 60 && field && !/^(Basisfragen|Spezifische .*Fragen)$/.test(s)) {
      if (field === "q") cur.q += " " + s; else cur.a[cur.a.length - 1] += " " + s;
    } else {
      headings.add(s); section = s; cur = null; field = null;
    }
  }
  for (const im of imgs) {
    let best = null;
    for (const q of pageQs) if (q.y <= im.y + 4 && (!best || q.y > best.y)) best = q;
    if (!best) best = questions.filter(q => q.page < i + 1).at(-1);
    best.img.push(im.img);
  }
}
for (const q of questions) { delete q.y; delete q.page; }
console.log("questions", questions.length, "headings", [...headings]);
const bad = questions.filter(q => q.a.length !== 4);
console.log("bad", bad.map(q => q.n));
console.log("with images", questions.filter(q => q.img.length).length, "unique imgs", hashes.size);
const sections = {};
for (const q of questions) sections[q.section] = (sections[q.section] || 0) + 1;
console.log(sections);
fs.writeFileSync(outDir + "/questions.json", JSON.stringify(questions, null, 1));
