"""Baut eine Vorschau-Seite (eine Datei mit eingebettetem Code) für die Claude-Artifact-Vorschau.
Aufruf aus spiel/:  python3 tools/artifact.py ZIELDATEI
Die Bilder bleiben im Ordner img/ und werden beim Veröffentlichen mitgeschickt."""
import re, sys, os
H = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
lies = lambda n: open(os.path.join(H, n), encoding="utf-8").read()
html = lies("index.html")
koerper = html.split("<!--SPIEL-->")[1].split("<!--/SPIEL-->")[0]
js = "\n".join(lies(n) for n in ["img/groessen.js", "daten.js", "insel.js", "puzzle.js", "spiel.js"])
js = re.sub(r'import\s*\{[\s\S]*?\}\s*from\s*"[^"]+";', "", js)
js = re.sub(r"^export ", "", js, flags=re.M)
seite = f"""<title>Sonnenhof</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap">
<style>
{lies("stil.css")}
</style>
{koerper}
<script type="module">
{js}
</script>
"""
open(sys.argv[1], "w", encoding="utf-8").write(seite)
print("geschrieben:", sys.argv[1], len(seite), "Zeichen")
