// Die Date-Ideen, mit denen jedes Paar startet. Eigene Ideen und Änderungen liegen in Firebase.
// Felder: id, Emoji, Titel, Beschreibung, wo (zuhause|drinnen|draussen|ausflug),
// Kosten (0 umsonst, 1 günstig, 2 mittel, 3 teuer), Dauer (kurz|abend|tag), Stimmungen.

export const WHERE = [
  ["zuhause", "🏠", "Zuhause"], ["drinnen", "🏛️", "Drinnen"], ["draussen", "🌳", "Draußen"], ["ausflug", "🚗", "Ausflug"]
];
export const COST = [[0, "🆓", "Umsonst"], [1, "€", "Günstig"], [2, "€€", "Mittel"], [3, "€€€", "Darf was kosten"]];
export const TIME = [["kurz", "⏱️", "1–2 Stunden"], ["abend", "🌙", "Ein Abend"], ["tag", "☀️", "Ganzer Tag"]];
export const MOODS = [
  ["romantisch", "💕", "Romantisch"], ["naehe", "💬", "Reden & Nähe"], ["gemuetlich", "🛋️", "Gemütlich"],
  ["lecker", "😋", "Lecker"], ["lustig", "😄", "Lustig"], ["aktiv", "⚡", "Aktiv"],
  ["abenteuer", "🧭", "Abenteuer"], ["kreativ", "🎨", "Kreativ"]
];

const RAW = [
  ["kerzen", "🕯️", "Kerzenschein-Dinner zuhause", "Tisch schön decken, Handys weg, zusammen euer Lieblingsessen kochen und richtig Zeit lassen.", "zuhause", 1, "abend", "romantisch lecker"],
  ["kochduell", "👩‍🍳", "Kochduell", "Jeder kocht einen Gang für den anderen, mit einer geheimen Zutat, die der andere erraten muss.", "zuhause", 1, "abend", "lecker lustig"],
  ["deckenburg", "🏰", "Deckenburg & Filmabend", "Aus Decken und Kissen eine Höhle bauen, Lichterkette rein, und einen Film aus der Zeit, als ihr euch kennengelernt habt.", "zuhause", 0, "abend", "gemuetlich romantisch"],
  ["fotos", "📸", "Alte Fotos anschauen", "Die Handy-Galerie bis ganz an den Anfang zurückscrollen und euch erzählen, was ihr damals gedacht und gefühlt habt.", "zuhause", 0, "kurz", "naehe romantisch"],
  ["fragenabend", "💬", "Abend der Fragen", "Abwechselnd Fragen stellen, die ihr euch noch nie gestellt habt. Wer antwortet, wird nicht unterbrochen.", "zuhause", 0, "abend", "naehe"],
  ["massage", "💆", "Massage-Abend", "Duftöl, ruhige Musik, jeder bekommt 20 Minuten. Ohne Erwartungen, einfach nur genießen.", "zuhause", 1, "abend", "romantisch naehe"],
  ["spiele", "🎲", "Spieleabend zu zweit", "Brettspiel, Karten oder ein Koop-Spiel, mit Snacks und einem kleinen Einsatz: Wer verliert, macht morgen Frühstück.", "zuhause", 0, "abend", "lustig gemuetlich"],
  ["tanzen", "💃", "Tanzen im Wohnzimmer", "Licht dimmen, eure Lieder von früher an, und einfach tanzen, auch wenn's albern aussieht.", "zuhause", 0, "kurz", "romantisch lustig"],
  ["fruehstueck", "🥐", "Frühstück im Bett", "Brötchen holen, Kaffee, eine Serie, und den Vormittag gar nicht erst richtig aufstehen.", "zuhause", 1, "kurz", "gemuetlich romantisch"],
  ["wellness", "🛁", "Wellness-Abend", "Badewanne oder Fußbad, Gesichtsmasken, Tee und kuschelige Bademäntel.", "zuhause", 1, "abend", "gemuetlich romantisch"],
  ["portraet", "🎨", "Porträt-Abend", "Ihr malt euch gegenseitig in 15 Minuten. Je schiefer, desto besser. Die Bilder aufheben!", "zuhause", 0, "kurz", "kreativ lustig"],
  ["tapas", "🫒", "Tapas-Picknick im Wohnzimmer", "Viele kleine Sachen vorbereiten, ein Glas Wein oder Saft, und auf einer Decke auf dem Boden essen.", "zuhause", 2, "abend", "lecker gemuetlich"],
  ["traumreise", "🗺️", "Traumreise planen", "Eine Reise planen, als gäbe es kein Budget. Danach eine kleine Version davon, die ihr wirklich macht.", "zuhause", 0, "abend", "naehe abenteuer"],
  ["briefe", "✉️", "Briefe aneinander", "Jeder schreibt dem anderen einen Brief: was ich an dir mag, woran ich gern denke, was ich mir für uns wünsche.", "zuhause", 0, "kurz", "naehe romantisch"],
  ["neuesgericht", "🥟", "Etwas Neues kochen", "Ein Gericht, das keiner von euch je gemacht hat: Sushi, Dumplings, frische Pasta oder Curry.", "zuhause", 1, "abend", "lecker kreativ"],
  ["puzzle", "🧩", "Puzzle & Hörbuch", "Ein großes Puzzle, ein Hörbuch oder Podcast dazu, Tee. Klingt ruhig, verbindet aber.", "zuhause", 1, "abend", "gemuetlich"],
  ["laenderabend", "🌍", "Länderabend", "Ein Land auslosen, dann Essen, Musik und ein Film von dort.", "zuhause", 1, "abend", "lecker kreativ lustig"],
  ["wunschliste", "📝", "Unsere Wunschliste", "Zusammen 20 Dinge aufschreiben, die ihr noch erleben wollt. Die Liste kommt an den Kühlschrank.", "zuhause", 0, "kurz", "naehe"],
  ["karaoke", "🎤", "Karaoke zuhause", "Karaoke-Videos, Haarbürste als Mikro, und jeder sucht dem anderen ein Lied aus.", "zuhause", 0, "abend", "lustig"],
  ["cocktails", "🍹", "Cocktailbar zuhause", "Zwei Rezepte raussuchen, Zutaten kaufen, jeder mixt für den anderen.", "zuhause", 2, "abend", "lecker lustig"],
  ["handyfrei", "📵", "Handyfreier Abend", "Ab 18 Uhr liegen beide Handys in einer Schublade. Was ihr dann macht, ergibt sich.", "zuhause", 0, "abend", "naehe"],
  ["balkon", "🌙", "Balkon-Abend", "Decke, Tee, Lichterkette auf Balkon oder Terrasse, und reden, bis es dunkel ist.", "zuhause", 0, "abend", "romantisch naehe gemuetlich"],
  ["backen", "🧁", "Zusammen backen", "Kuchen, Plätzchen oder Pizzateig, mit Musik und Mehl überall.", "zuhause", 1, "kurz", "lecker gemuetlich"],
  ["kuscheln", "🛋️", "Sofa-Abend ohne Fernseher", "Kuscheln, Musik, reden oder einfach still nebeneinander liegen. Nur ihr zwei, nichts nebenher.", "zuhause", 0, "abend", "naehe romantisch gemuetlich"],

  ["erstesdate", "💞", "Euer erstes Date nachstellen", "Gleicher Ort, gleiches Essen, wenn möglich die gleichen Klamotten. Und erzählen, wie aufgeregt ihr damals wart.", "drinnen", 2, "abend", "romantisch naehe"],
  ["kino", "🍿", "Kino mit Nachgespräch", "Einer sucht den Film aus, der andere die Bar danach. Dort reden, wie er euch gefallen hat.", "drinnen", 2, "abend", "gemuetlich"],
  ["restaurant", "🍽️", "Neues Restaurant", "Eine Küche, die ihr noch nie probiert habt: äthiopisch, koreanisch, libanesisch …", "drinnen", 3, "abend", "lecker abenteuer"],
  ["bowling", "🎳", "Bowling oder Billard", "Mit kleiner Wette: Wer verliert, erfüllt dem anderen einen Wunsch.", "drinnen", 2, "abend", "aktiv lustig"],
  ["bouldern", "🧗", "Bouldern", "Schnupperstunde in einer Boulderhalle. Ihr sichert euch nicht, aber ihr feuert euch an.", "drinnen", 2, "kurz", "aktiv abenteuer"],
  ["museum", "🏛️", "Museum & Café", "Jeder sucht sich ein Lieblingsstück aus und erklärt dem anderen, warum. Danach Kuchen.", "drinnen", 1, "tag", "kreativ naehe"],
  ["toepfern", "🏺", "Töpferkurs", "Zusammen mit den Händen etwas machen, das bleibt. Gern auch zwei Tassen füreinander.", "drinnen", 3, "abend", "kreativ"],
  ["escape", "🔐", "Escape Room", "Zusammen ein Rätsel lösen und merken, wie gut ihr als Team seid.", "drinnen", 3, "kurz", "abenteuer lustig"],
  ["therme", "♨️", "Therme oder Sauna", "Einen ganzen Tag nur Wärme, Ruhe und Zeit zu zweit.", "drinnen", 3, "tag", "gemuetlich romantisch"],
  ["kochkurs", "🥘", "Kochkurs", "Unter Anleitung zusammen kochen und hinterher gemeinsam essen.", "drinnen", 3, "abend", "lecker kreativ"],
  ["tanzkurs", "🕺", "Tanzkurs", "Salsa, Discofox oder Tango. Für den Anfang reicht eine Schnupperstunde.", "drinnen", 2, "abend", "aktiv romantisch"],
  ["comedy", "😂", "Comedy oder Poetry-Slam", "Zusammen lachen verbindet. Oft gibt es auch kleine Abende in Kneipen.", "drinnen", 2, "abend", "lustig"],
  ["livemusik", "🎶", "Konzert oder Jazzbar", "Live-Musik, gern auch eine kleine Band in der Kneipe um die Ecke.", "drinnen", 2, "abend", "romantisch"],
  ["cafes", "☕", "Café-Hopping", "Drei Cafés an einem Nachmittag, in jedem teilt ihr euch eine Kleinigkeit.", "drinnen", 1, "kurz", "lecker gemuetlich"],
  ["trampolin", "🤸", "Trampolinhalle oder Lasertag", "Einmal wieder Kind sein und sich gegenseitig auslachen.", "drinnen", 2, "kurz", "aktiv lustig"],
  ["buchladen", "📚", "Buchladen-Date", "Jeder sucht dem anderen ein Buch aus, ohne zu verraten, welches. Danach Kaffee und auspacken.", "drinnen", 1, "kurz", "naehe kreativ"],
  ["theater", "🎭", "Theater oder Kleinkunst", "Ein bisschen schick machen und richtig ausgehen.", "drinnen", 3, "abend", "romantisch"],
  ["tasting", "🍷", "Tasting", "Weinprobe, Gin, Schokolade oder Käse: probieren und gemeinsam Lieblinge finden.", "drinnen", 3, "abend", "lecker"],
  ["quiz", "🧠", "Kneipenquiz", "Ihr zwei gegen den Rest der Kneipe.", "drinnen", 1, "abend", "lustig"],
  ["rooftop", "🌃", "Stadt von oben", "Rooftop-Bar oder Aussichtsturm, und die Lichter der Stadt anschauen.", "drinnen", 2, "abend", "romantisch"],

  ["sonnenaufgang", "🌅", "Sonnenaufgang anschauen", "Wecker früh stellen, Thermoskanne, Decke, ein Aussichtspunkt in der Nähe.", "draussen", 0, "kurz", "romantisch abenteuer"],
  ["picknick", "🧺", "Picknick im Park", "Korb packen, Decke, ein Buch oder Karten, und einfach liegen bleiben.", "draussen", 1, "kurz", "gemuetlich romantisch"],
  ["sterne", "🌌", "Sterne gucken", "Raus aus der Stadt, Decke auf die Wiese, eine Sternbilder-App und warme Getränke.", "draussen", 0, "abend", "romantisch naehe"],
  ["spaziergang", "🚶", "Spaziergang mit Fragen", "Eine Runde ohne Ziel, Hand in Hand, und unterwegs drei Fragen aus der App.", "draussen", 0, "kurz", "naehe"],
  ["fahrrad", "🚲", "Fahrradtour mit Einkehr", "Eine Strecke, die ihr noch nicht kennt, mit Biergarten oder Eisdiele am Ziel.", "draussen", 1, "tag", "aktiv"],
  ["wandern", "🥾", "Wanderung mit Brotzeit", "Ein Gipfel oder Aussichtspunkt, und oben gibt's Brotzeit.", "draussen", 0, "tag", "aktiv abenteuer"],
  ["badesee", "🏊", "Badesee oder Fluss", "Schwimmen, Sonne, Eis. Im Herbst einfach die Füße reinhalten.", "draussen", 0, "tag", "aktiv gemuetlich"],
  ["minigolf", "⛳", "Minigolf", "Mit Punktzettel, Siegerehrung und viel Schummeln.", "draussen", 1, "kurz", "lustig"],
  ["flohmarkt", "🛍️", "Flohmarkt-Challenge", "Jeder hat 5 € und sucht das schönste oder schrägste Geschenk für den anderen.", "draussen", 1, "kurz", "lustig kreativ"],
  ["lagerfeuer", "🔥", "Lagerfeuer oder Grillabend", "Stockbrot, Marshmallows und Geschichten von früher.", "draussen", 1, "abend", "gemuetlich romantisch"],
  ["fotowalk", "📷", "Foto-Spaziergang", "Jeder fotografiert unterwegs Dinge, die ihn an den anderen erinnern. Am Ende zeigt ihr euch die Bilder.", "draussen", 0, "kurz", "kreativ naehe"],
  ["boot", "🚣", "Tretboot oder Kanu", "Zusammen in einem Boot sitzen, ganz wörtlich.", "draussen", 2, "kurz", "aktiv romantisch"],
  ["eis", "🍦", "Abendspaziergang mit Eis", "Klein, aber fein, einfach nach dem Abendessen noch mal raus.", "draussen", 1, "kurz", "gemuetlich"],
  ["markt", "🎄", "Markt-Abend", "Weihnachtsmarkt, Streetfood-Markt oder Stadtfest, je nach Jahreszeit.", "draussen", 2, "abend", "lecker gemuetlich"],
  ["schlittschuh", "⛸️", "Schlittschuhlaufen", "Hand in Hand, und wer hinfällt, zahlt den Kakao.", "draussen", 2, "kurz", "aktiv lustig"],
  ["geocaching", "🧭", "Geocaching", "Schatzsuche mit dem Handy, irgendwo in eurer Nähe.", "draussen", 0, "kurz", "abenteuer"],
  ["regen", "☔", "Spaziergang im Regen", "Ein Schirm für beide, danach heißer Kakao zuhause.", "draussen", 0, "kurz", "romantisch"],
  ["kirmes", "🎡", "Kirmes oder Freizeitpark", "Riesenrad, Zuckerwatte, Achterbahn und kreischen.", "draussen", 3, "tag", "abenteuer lustig"],

  ["tagesausflug", "🚗", "Spontaner Tagesausflug", "Ein Ort in einer Stunde Umkreis, wo ihr beide noch nie wart.", "ausflug", 2, "tag", "abenteuer"],
  ["ueberraschung", "🎁", "Überraschungs-Date", "Einer plant alles und verrät nur, was man anziehen soll. Beim nächsten Mal ist der andere dran.", "ausflug", 2, "tag", "romantisch abenteuer"],
  ["wochenende", "🏡", "Ein Wochenende weg", "Eine Hütte, ein kleines Hotel oder eine Ferienwohnung. Nur ihr zwei, kein Alltag.", "ausflug", 3, "tag", "romantisch gemuetlich naehe"],
  ["zug", "🚆", "Mit dem Zug ins Blaue", "Den nächsten Regionalzug nehmen und irgendwo aussteigen, wo es schön aussieht.", "ausflug", 1, "tag", "abenteuer"],
  ["zoo", "🦒", "Zoo oder Wildpark", "Eure Lieblingstiere suchen und euch gegenseitig einen Tier-Spitznamen geben.", "ausflug", 2, "tag", "lustig"],
  ["erlebnis", "🎈", "Ein ganz besonderes Erlebnis", "Heißluftballon, Segeltörn oder Fallschirmsprung. Etwas, das ihr nie vergesst.", "ausflug", 3, "tag", "abenteuer romantisch"],
  ["burg", "🏰", "Burg oder Schloss", "Führung, Schlosspark, und danach Kaffee und Kuchen.", "ausflug", 1, "tag", "gemuetlich"],
  ["pfluecken", "🍓", "Selbst pflücken", "Erdbeeren, Kürbisse, Blumen oder Äpfel, je nach Jahreszeit. Danach zusammen etwas daraus machen.", "ausflug", 1, "kurz", "lecker"],
  ["eureorte", "📍", "Eure Orte", "Die Orte besuchen, die für euch wichtig sind: wo ihr euch kennengelernt habt, das erste Date, der erste Kuss.", "ausflug", 0, "tag", "romantisch naehe"]
];

export const STARTER_IDEAS = RAW.map(([id, emoji, title, text, where, cost, time, moods]) => ({
  id: "s-" + id, emoji, title, text, where, cost, time, moods: moods.split(" "), starter: true
}));
