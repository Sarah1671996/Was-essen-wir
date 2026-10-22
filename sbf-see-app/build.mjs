// Baut die Lern-App aus quelle/app.html und den Fragen-Daten:
//   index.html + app.js + daten.js  → installierbare App für GitHub Pages (Handy und PC)
//   quelle/artifact.html            → eine einzige Datei für den Claude-Artifact-Link (nicht im Repo)
// Aufruf: node sbf-see-app/build.mjs
import fs from "fs";
const here = new URL(".", import.meta.url);
const read = p => fs.readFileSync(new URL(p, here));
const write = (p, s) => fs.writeFileSync(new URL(p, here), s);

const questions = JSON.parse(read("quelle/daten/fragen.json"));
const lightImages = JSON.parse(read("quelle/daten/hell.json"));
const images = {};
for (const id of new Set(questions.flatMap(q => q.img)))
  images[id] = "data:image/png;base64," + read(`quelle/daten/bilder/${id}.png`).toString("base64");
const data = "const DATA = " + JSON.stringify({ questions, images, lightImages }) + ";";

const src = read("quelle/app.html").toString();
const DATA_TAG = "<script>\n/*__DATA__*/\n</script>";
if (!src.includes(DATA_TAG)) throw new Error("Platzhalter für die Daten fehlt in app.html");

// 1) Claude-Artifact: alles in einer Datei
write("quelle/artifact.html", src.replace(DATA_TAG, () => `<script>\n${data}\n</script>`));

// 2) Installierbare App: Code und Daten als eigene Dateien, damit die Content-Security-Policy kein Inline-Skript braucht
const m = src.slice(src.indexOf(DATA_TAG) + DATA_TAG.length).match(/<script>\n([\s\S]*)<\/script>\s*$/);
if (!m) throw new Error("Haupt-Skript in app.html nicht gefunden");
const headPart = src.slice(0, src.indexOf("<header"));
const bodyPart = src.slice(src.indexOf("<header"), src.indexOf(DATA_TAG));
const csp = [
  "default-src 'self'",
  "script-src 'self' https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://*.googleapis.com https://www.gstatic.com",
  "worker-src 'self' blob:", "manifest-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'none'"
].join("; ");
const pwaHead = `<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="theme-color" content="#0F2A3F">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="SBF-See">
`;
write("index.html", `<!doctype html>\n<html lang="de">\n<head>\n${headPart.replace("<title>", pwaHead + "<title>")}</head>\n<body>\n${bodyPart}<script src="daten.js"></script>\n<script src="app.js"></script>\n</body>\n</html>\n`);
write("app.js", "// Erzeugt von build.mjs aus quelle/app.html – dort ändern, nicht hier.\n" + m[1]);
write("daten.js", "// Erzeugt von build.mjs: 285 Fragen des SBF-See-Katalogs, Antwort a[0] ist richtig.\n" + data + "\n");
console.log(`fertig: ${questions.length} Fragen, ${Object.keys(images).length} Bilder, daten.js ${(data.length / 1048576).toFixed(1)} MB`);
