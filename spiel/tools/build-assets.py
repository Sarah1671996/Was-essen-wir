"""Erzeugt aus den Gemini-Originalen (assets/original) die fertigen Spielbilder (img/*.webp).

Aufruf aus dem Ordner spiel/:  python3 tools/build-assets.py
Braucht nur Pillow und numpy.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HIER = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HIER, "..", "assets", "original")
DST = os.path.join(HIER, "..", "img")

# name im Spiel: (Originaldatei, Breite in Pixeln, Art)
# Art: "frei" = weißen Hintergrund entfernen, "ganz" = alle weißen Flächen entfernen (auch eingeschlossene),
#      "bild" = Hintergrundbild, nur verkleinern
BILDER = {
    "feld-reif-weizen": ("00-weizenfeld-reif.jpg", 420, "frei"),
    "baeckerei": ("00-baeckerei.jpg", 440, "frei"),
    "feld-leer": ("01-feld-leer.jpg", 420, "frei"),
    "feld-jung": ("02-feld-jung.jpg", 420, "frei"),
    "feld-reif-karotte": ("03-karotten.jpg", 420, "frei"),
    "feld-reif-mais": ("04-mais.jpg", 420, "frei"),
    "kuh": ("05-kuh.jpg", 240, "frei"),
    "huhn": ("06-huhn.jpg", 150, "frei"),
    "schaf": ("07-schaf.jpg", 220, "frei"),
    "scheune": ("08-scheune.jpg", 500, "frei"),
    "molkerei": ("09-molkerei.jpg", 440, "frei"),
    "muehle": ("10-futtermuehle.jpg", 420, "frei"),
    "huehnerstall": ("11-huehnerstall.jpg", 440, "frei"),
    "kuhstall": ("12-kuhstall.jpg", 420, "frei"),
    "haus1": ("13-wohnhaus-1.jpg", 400, "frei"),
    "haus2": ("14-wohnhaus-2.jpg", 400, "frei"),
    "tafel": ("15-auftragstafel.jpg", 300, "frei"),
    "steg": ("16-steg-boot.jpg", 560, "frei"),
    "laubbaum": ("17-laubbaum.jpg", 300, "frei"),
    "apfelbaum": ("18-apfelbaum.jpg", 300, "frei"),
    "tanne": ("19-tanne.jpg", 220, "frei"),
    "busch": ("20-busch.jpg", 200, "frei"),
    "beet": ("21-blumenbeet.jpg", 320, "frei"),
    "zaun": ("22-zaun.jpg", 200, "frei"),
    "teich": ("23-teich.jpg", 440, "frei"),
    "insel": ("36-inselkarte.jpg", 1800, "bild"),
    "kachel": ("37-bodenkachel.jpg", 300, "frei"),
    "dschungel": ("38-dschungelbusch.jpg", 300, "frei"),
    "felsen": ("39-felsen.jpg", 260, "frei"),
    "stumpf": ("40-baumstumpf.jpg", 260, "frei"),
    "truhe": ("41-truhe-zu.jpg", 200, "frei"),
    "truhe-offen": ("42-truhe-offen.jpg", 220, "frei"),
    "bruecke-kaputt": ("43-bruecke-kaputt.jpg", 460, "ganz"),
    "bruecke": ("44-bruecke-repariert.jpg", 460, "ganz"),
    "zelt": ("45-zelt.jpg", 360, "frei"),
    "schaufel": ("46-schaufel.jpg", 128, "frei"),
    "axt": ("47-axt.jpg", 128, "frei"),
    "spitzhacke": ("48-spitzhacke.jpg", 128, "frei"),
    "gastgeberin": ("49-gastgeberin.jpg", 360, "frei"),
    "strand": ("60-strand.jpg", 1600, "bild"),
    # Paket B
    "baeckerin": ("70-baeckerin.jpg", 150, "frei"),
    "opa": ("71-opa.jpg", 150, "frei"),
    "maedchen": ("72-maedchen.jpg", 130, "frei"),
    "handwerker": ("73-handwerker.jpg", 150, "frei"),
    "saftbar": ("74-saftbar.jpg", 400, "frei"),
    "schneiderei": ("75-schneiderei.jpg", 400, "frei"),
    "konditorei": ("76-konditorei.jpg", 400, "frei"),
    "imkerei": ("77-imkerei.jpg", 420, "frei"),
    "lieferwagen": ("78-lieferwagen.jpg", 260, "frei"),
    "dickicht": ("79-dickicht.jpg", 560, "frei"),
    "eisfelsen": ("99-eisfelsen.jpg", 260, "frei"),
    "puzzle-weg": ("100-puzzle-weg.jpg", 1116, "bild"),
    "puzzle-weg-winter": ("101-puzzle-weg-winter.jpg", 1116, "bild"),
    "eisbusch": ("98-gefrorener-busch.jpg", 260, "pink"),
    "schneehaufen": ("97-schneehaufen.jpg", 260, "pink"),
    "schneeinsel": ("96-schneeinsel.jpg", 1800, "bild"),
    "schwein": ("102-schwein.jpg", 200, "frei"),
    "feld-reif-erdbeere": ("110-erdbeerfeld.jpg", 420, "frei"),
    "feld-reif-sonnenblume": ("111-sonnenblumenfeld.jpg", 420, "frei"),
    "feld-reif-traube": ("112-weinreben.jpg", 420, "frei"),
    "kirschbaum": ("113-kirschbaum.jpg", 300, "frei"),
    "birnbaum": ("114-birnbaum.jpg", 300, "frei"),
    "marmeladenkueche": ("115-marmeladenkueche.jpg", 420, "frei"),
    "kelterei": ("116-kelterei.jpg", 420, "frei"),
    "oelmuehle": ("117-oelmuehle.jpg", 420, "frei"),
    "ziege": ("103-ziege.jpg", 200, "frei"),
    "schweinestall": ("104-schweinestall.jpg", 420, "frei"),
    "ziegenstall": ("105-ziegenstall.jpg", 420, "frei"),
}

# Sammelbilder: Datei, Namen der Teile (Reihenfolge zeilenweise), Breite
SAMMEL = [
    ("24-35-symbole-sammelbild.jpg",
     ["i-weizen", "i-mais", "i-karotte", "i-milch", "i-ei", "i-brot", "i-kaese", "i-butter", "i-futter", "i-wolle", "i-muenze", "i-stern"], 128),
    ("50-55-steine-sammelbild.jpg", ["stein-rot", "stein-blau", "stein-gruen", "stein-gelb", "stein-lila", "stein-orange"], 128),
    ("56-59-puzzle-extras-sammelbild.jpg", ["rakete", "bombe", "kiste", "eis"], 128),
    ("80-87-waren-sammelbild.jpg", ["i-saft", "i-suppe", "i-pullover", "i-muetze", "i-kuchen", "i-kekse", "i-honig", "i-apfel"], 128),
    ("106-109-tierwaren-sammelbild.jpg", ["i-trueffel", "i-ziegenmilch", "i-ziegenkaese", "i-joghurt"], 128),
    ("118-125-obstwaren-sammelbild.jpg", ["i-erdbeere", "i-kerne", "i-traube", "i-kirsche", "i-birne", "i-marmelade", "i-traubensaft", "i-oel"], 128),
    ("88-95-helfer-sammelbild.jpg", ["i-hammer", "i-besen", "i-regenbogen", "i-geschenk", "i-herz", "i-kuerbis", "i-schneeflocke", "i-osterei"], 128),
]


def hintergrund_maske(a, pink=False):
    """True, wo ein Pixel nach Hintergrund aussieht (weiß, oder pink bei Bildern vor Magenta)."""
    if pink:
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        return (r > 170) & (b > 150) & (g < 110) & (r - g > 90) & (b - g > 70)
    mn = a.min(axis=2)
    spread = a.max(axis=2) - mn
    return (mn > 222) & (spread < 28)


def freistellen(im, ganz=False, pink=False):
    im = im.convert("RGB")
    a = np.asarray(im).astype(int)
    bg = hintergrund_maske(a, pink)
    if ganz:
        weg = bg
    else:
        # zusammenhängende weiße Fläche vom Rand aus füllen
        # (Flutfüllung auf einem RGB-Bild; bei Graustufenbildern füllt Pillow 12 nicht zuverlässig)
        m = Image.fromarray(np.where(bg, 255, 0).astype(np.uint8)).convert("RGB")
        w, h = m.size
        rand = [(x, 0) for x in range(0, w, 7)] + [(x, h - 1) for x in range(0, w, 7)] + \
               [(0, y) for y in range(0, h, 7)] + [(w - 1, y) for y in range(0, h, 7)]
        for p in rand:
            if m.getpixel(p) == (255, 255, 255):
                ImageDraw.floodfill(m, p, (128, 0, 0))
        weg = np.asarray(m)[..., 0] == 128
    alpha = Image.fromarray(np.where(weg, 0, 255).astype(np.uint8))
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.4))
    out = im.convert("RGBA")
    out.putalpha(alpha)
    return out.crop(out.getbbox())


def zerlegen(im):
    """Findet die einzelnen Teile eines Sammelbilds (Zeilen, dann Spalten mit Weißraum dazwischen)."""
    a = np.asarray(im.convert("RGB")).astype(int)
    fg = ~hintergrund_maske(a)

    def laeufe(v, minlen=40):
        r, s = [], None
        for i, x in enumerate(v):
            if x and s is None:
                s = i
            if not x and s is not None:
                if i - s >= minlen:
                    r.append((s, i))
                s = None
        if s is not None:
            r.append((s, len(v)))
        return r

    teile = []
    for y0, y1 in laeufe(fg.sum(1) > 3):
        for x0, x1 in laeufe(fg[y0:y1].sum(0) > 3):
            teile.append(im.crop((max(0, x0 - 14), max(0, y0 - 14), min(im.width, x1 + 14), min(im.height, y1 + 14))))
    return teile


def speichern(im, name, breite):
    if im.width > breite:
        im = im.resize((breite, round(im.height * breite / im.width)), Image.LANCZOS)
    im.save(os.path.join(DST, name + ".webp"), "WEBP", quality=84, method=6)
    return im.size


def main():
    os.makedirs(DST, exist_ok=True)
    groessen = {}
    for name, (datei, breite, art) in BILDER.items():
        im = Image.open(os.path.join(SRC, datei))
        if art != "bild":
            im = freistellen(im, ganz=(art == "ganz"), pink=(art == "pink"))
        groessen[name] = speichern(im, name, breite)
    for datei, namen, breite in SAMMEL:
        teile = zerlegen(Image.open(os.path.join(SRC, datei)))
        assert len(teile) == len(namen), f"{datei}: {len(teile)} Teile gefunden, {len(namen)} erwartet"
        for name, teil in zip(namen, teile):
            groessen[name] = speichern(freistellen(teil), name, breite)
    # Seitenverhältnisse für das Spiel (Breite/Höhe), damit Bilder ohne Springen platziert werden
    with open(os.path.join(DST, "groessen.js"), "w") as f:
        f.write("// automatisch erzeugt von tools/build-assets.py\nexport const GROESSE = {\n")
        for name, (w, h) in sorted(groessen.items()):
            f.write(f'  "{name}": [{w}, {h}],\n')
        f.write("};\n")
    print(len(groessen), "Bilder erzeugt")


if __name__ == "__main__":
    main()
