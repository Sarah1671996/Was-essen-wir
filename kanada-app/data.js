// Kanada-Wissen der App: Orte (Standquartiere), Sehenswürdigkeiten, Flughäfen.
// Koordinaten sind auf wenige hundert Meter genau, Dauer = typische Zeit vor Ort in Stunden.
// Felder bei Sehenswürdigkeiten: w = beste Tageszeit ("früh"/"abends"), r = Reservierung/Ticket nötig,
// m = [vonMonat, bisMonat] wann sinnvoll/geöffnet, t = Tipp.
// Kosten stehen unten in COST, andere Namen (für den Listen-Import) in ALIAS.

export const TAGS = {
  sight:   { label: "Sehenswürdigkeiten", icon: "📸" },
  natur:   { label: "Schöne Natur", icon: "🌲" },
  ruhe:    { label: "Ruhe", icon: "🧘" },
  wandern: { label: "Wandern", icon: "🥾" },
  tiere:   { label: "Tiere", icon: "🦌" },
  aussicht:{ label: "Aussicht", icon: "🏔️" },
  wasser:  { label: "Seen & Meer", icon: "🛶" },
  kultur:  { label: "Kultur & Geschichte", icon: "🎭" },
  stadt:   { label: "Stadtleben", icon: "🏙️" },
  familie: { label: "Mit Kindern", icon: "🧒" },
  geheim:  { label: "Geheimtipp", icon: "💎" },
  gratis:  { label: "Kostenlos", icon: "🆓" }
};

export const REGIONS = {
  west: "British Columbia",
  rockies: "Rocky Mountains",
  prairie: "Alberta",
  yukon: "Yukon",
  ontario: "Ontario",
  quebec: "Québec",
  atlantik: "Atlantikküste"
};

// Standquartiere: dort übernachtet man, von dort aus plant die App die Tage
export const BASES = [
  { id: "vancouver", name: "Vancouver", region: "west", lat: 49.2827, lng: -123.1207, ap: "YVR" },
  { id: "victoria", name: "Victoria", region: "west", lat: 48.4284, lng: -123.3656, ap: "YYJ" },
  { id: "tofino", name: "Tofino & Ucluelet", region: "west", lat: 49.1530, lng: -125.9066, ap: "YYJ" },
  { id: "whistler", name: "Whistler", region: "west", lat: 50.1163, lng: -122.9574, ap: "YVR" },
  { id: "okanagan", name: "Kelowna (Okanagan)", region: "west", lat: 49.8880, lng: -119.4960, ap: "YLW" },
  { id: "wellsgray", name: "Clearwater (Wells Gray)", region: "west", lat: 51.6500, lng: -120.0300, ap: "YKA" },
  { id: "revelstoke", name: "Revelstoke", region: "west", lat: 50.9981, lng: -118.1957, ap: "YLW" },
  { id: "jasper", name: "Jasper", region: "rockies", lat: 52.8737, lng: -118.0814, ap: "YEG", park: true },
  { id: "lakelouise", name: "Lake Louise", region: "rockies", lat: 51.4254, lng: -116.1773, ap: "YYC", park: true },
  { id: "golden", name: "Golden (Yoho)", region: "rockies", lat: 51.2980, lng: -116.9630, ap: "YYC", park: true },
  { id: "banff", name: "Banff", region: "rockies", lat: 51.1784, lng: -115.5708, ap: "YYC", park: true },
  { id: "canmore", name: "Canmore & Kananaskis", region: "rockies", lat: 51.0884, lng: -115.3479, ap: "YYC" },
  { id: "radium", name: "Radium Hot Springs (Kootenay)", region: "rockies", lat: 50.6200, lng: -116.0700, ap: "YYC", park: true },
  { id: "waterton", name: "Waterton Lakes", region: "rockies", lat: 49.0500, lng: -113.9100, ap: "YYC", park: true },
  { id: "calgary", name: "Calgary", region: "prairie", lat: 51.0447, lng: -114.0719, ap: "YYC" },
  { id: "whitehorse", name: "Whitehorse", region: "yukon", lat: 60.7212, lng: -135.0568, ap: "YXY" },
  { id: "toronto", name: "Toronto", region: "ontario", lat: 43.6532, lng: -79.3832, ap: "YYZ" },
  { id: "niagara", name: "Niagara Falls", region: "ontario", lat: 43.0896, lng: -79.0849, ap: "YYZ" },
  { id: "tobermory", name: "Tobermory (Bruce Peninsula)", region: "ontario", lat: 45.2550, lng: -81.6640, ap: "YYZ", park: true },
  { id: "algonquin", name: "Algonquin & Muskoka", region: "ontario", lat: 45.3270, lng: -79.2180, ap: "YYZ" },
  { id: "ottawa", name: "Ottawa", region: "ontario", lat: 45.4215, lng: -75.6972, ap: "YOW" },
  { id: "thousand", name: "Thousand Islands (Gananoque)", region: "ontario", lat: 44.3300, lng: -76.1600, ap: "YOW" },
  { id: "montreal", name: "Montréal", region: "quebec", lat: 45.5019, lng: -73.5674, ap: "YUL" },
  { id: "tremblant", name: "Mont-Tremblant", region: "quebec", lat: 46.2100, lng: -74.5850, ap: "YUL" },
  { id: "quebec", name: "Québec City", region: "quebec", lat: 46.8139, lng: -71.2080, ap: "YQB" },
  { id: "tadoussac", name: "Tadoussac (Wale)", region: "quebec", lat: 48.1440, lng: -69.7180, ap: "YQB" },
  { id: "perce", name: "Percé (Gaspésie)", region: "quebec", lat: 48.5240, lng: -64.2130, ap: "YGP" },
  { id: "halifax", name: "Halifax", region: "atlantik", lat: 44.6488, lng: -63.5752, ap: "YHZ" },
  { id: "capebreton", name: "Cape Breton (Cabot Trail)", region: "atlantik", lat: 46.1000, lng: -60.7530, ap: "YHZ", park: true },
  { id: "pei", name: "Prince Edward Island", region: "atlantik", lat: 46.2382, lng: -63.1311, ap: "YYG" },
  { id: "fundy", name: "Bay of Fundy (Alma)", region: "atlantik", lat: 45.6000, lng: -64.9500, ap: "YQM", park: true },
  { id: "stjohns", name: "St. John's (Neufundland)", region: "atlantik", lat: 47.5615, lng: -52.7126, ap: "YYT" },
  { id: "grosmorne", name: "Gros Morne (Neufundland)", region: "atlantik", lat: 49.6600, lng: -57.9100, ap: "YDF", park: true }
];

const s = (id, base, name, lat, lng, dur, tags, x = {}) => ({ id, base, name, lat, lng, dur, tags: tags.split(" "), ...x });

export const SIGHTS = [
  // Vancouver
  s("stanley", "vancouver", "Stanley Park & Seawall", 49.3017, -123.1417, 3, "natur stadt familie sight", { t: "Am schönsten mit dem Leihrad einmal rund um den Seawall (ca. 10 km)." }),
  s("granville", "vancouver", "Granville Island Public Market", 49.2712, -123.1340, 2, "stadt kultur", { t: "Mit dem kleinen Aquabus-Boot hinfahren." }),
  s("capilano", "vancouver", "Capilano Suspension Bridge", 49.3429, -123.1149, 2, "sight familie natur voll", { r: "Eintritt ca. 70 CAD, online günstiger.", t: "Gratis-Alternative mit weniger Andrang: Lynn Canyon." }),
  s("lynn", "vancouver", "Lynn Canyon Hängebrücke", 49.3437, -123.0193, 1.5, "natur ruhe wandern geheim", { t: "Kostenlos, kurze Runde zum Twin Falls." }),
  s("grouse", "vancouver", "Grouse Mountain", 49.3714, -123.0985, 3, "aussicht tiere familie", { t: "Oben leben zwei gerettete Grizzlys im Gehege." }),
  s("gastown", "vancouver", "Gastown & Chinatown", 49.2840, -123.1090, 1.5, "stadt kultur" ),
  s("moa", "vancouver", "Museum of Anthropology", 49.2694, -123.2593, 2, "kultur", { t: "Beeindruckende Totempfähle der First Nations." }),
  s("englishbay", "vancouver", "Sonnenuntergang an der English Bay", 49.2867, -123.1430, 1, "wasser ruhe", { w: "abends" }),
  s("lighthouse", "vancouver", "Lighthouse Park", 49.3333, -123.2630, 1.5, "natur ruhe aussicht geheim"),
  s("quarryrock", "vancouver", "Deep Cove & Quarry Rock", 49.3291, -122.9483, 2.5, "wandern aussicht wasser", { t: "Danach Donuts bei Honey Doughnuts." }),

  // Whistler / Sea-to-Sky
  s("seatosky", "whistler", "Sea-to-Sky Gondola (Squamish)", 49.6766, -123.1557, 3, "aussicht sight", { t: "Liegt auf halbem Weg Vancouver–Whistler: ideal auf der Fahrt." }),
  s("shannon", "whistler", "Shannon Falls", 49.6713, -123.1600, 0.5, "natur" ),
  s("peak2peak", "whistler", "Whistler Village & Peak 2 Peak Gondel", 50.1146, -122.9530, 4, "aussicht sight voll", { m: [6, 9] }),
  s("joffre", "whistler", "Joffre Lakes", 50.3685, -122.4990, 4, "wandern natur wasser voll", { r: "Kostenloser Tagespass von BC Parks nötig, vorab online buchen.", w: "früh" }),
  s("brandywine", "whistler", "Brandywine Falls", 50.0350, -123.1210, 0.75, "natur familie"),
  s("lostlake", "whistler", "Lost Lake", 50.1260, -122.9440, 1.5, "ruhe wasser familie"),
  s("garibaldi", "whistler", "Garibaldi Lake Wanderung", 49.9561, -123.1180, 7, "wandern natur wasser", { r: "Tagespass von BC Parks nötig.", m: [7, 10], t: "18 km hin und zurück, türkisblauer See." }),
  s("nairn", "whistler", "Nairn Falls", 50.2890, -122.8230, 1, "ruhe natur geheim"),

  // Victoria
  s("innerharbour", "victoria", "Inner Harbour & Parlament", 48.4197, -123.3700, 2, "stadt sight", { t: "Abends ist das Parlament beleuchtet." }),
  s("butchart", "victoria", "Butchart Gardens", 48.5635, -123.4685, 3, "sight voll", { t: "Im Sommer samstags Feuerwerk." }),
  s("rbcm", "victoria", "Royal BC Museum", 48.4198, -123.3676, 2.5, "kultur familie"),
  s("whalevic", "victoria", "Walbeobachtung (Orcas)", 48.4226, -123.3711, 3.5, "tiere wasser", { r: "Bootstour vorab buchen.", m: [4, 10] }),
  s("fortrodd", "victoria", "Fisgard Lighthouse & Fort Rodd Hill", 48.4320, -123.4480, 1.5, "kultur"),
  s("eastsooke", "victoria", "East Sooke Park", 48.3480, -123.6930, 3, "wandern ruhe natur geheim"),
  s("dallasrd", "victoria", "Beacon Hill Park & Dallas Road", 48.4110, -123.3630, 1, "ruhe wasser familie"),

  // Tofino / Ucluelet
  s("longbeach", "tofino", "Long Beach (Pacific Rim)", 49.0650, -125.7480, 2, "wasser natur", { r: "Parks-Canada-Tagespass (oder Discovery Pass)." }),
  s("chesterman", "tofino", "Sonnenuntergang am Chesterman Beach", 49.1170, -125.8900, 1, "wasser ruhe", { w: "abends" }),
  s("rainforest", "tofino", "Rainforest Trail", 49.0380, -125.6800, 1, "natur ruhe wandern"),
  s("wildpacific", "tofino", "Wild Pacific Trail (Ucluelet)", 48.9260, -125.5400, 2, "aussicht wasser wandern"),
  s("beartofino", "tofino", "Bären- oder Walbeobachtung per Boot", 49.1530, -125.9066, 3, "tiere wasser", { r: "Tour vorab buchen.", m: [4, 10] }),
  s("hotsprings", "tofino", "Hot Springs Cove (Boot/Wasserflugzeug)", 49.3500, -126.2630, 6, "natur ruhe wasser", { r: "Nur mit Tour erreichbar." }),
  s("cathedral", "tofino", "Cathedral Grove (Riesenbäume)", 49.2800, -124.6600, 1, "natur", { t: "Liegt an der Strecke nach Tofino, gut als Stopp unterwegs." }),

  // Okanagan
  s("naramata", "okanagan", "Weingüter an der Naramata Bench", 49.5900, -119.5800, 3, "kultur ruhe"),
  s("myra", "okanagan", "Myra Canyon Trestles", 49.7800, -119.3170, 2.5, "wandern familie aussicht", { t: "Alte Eisenbahnbrücken, ideal mit dem Leihrad." }),
  s("citypark", "okanagan", "Strand am Okanagan Lake", 49.8860, -119.4990, 1.5, "wasser familie"),
  s("knox", "okanagan", "Knox Mountain", 49.9090, -119.4790, 1.5, "aussicht wandern"),
  s("spotted", "okanagan", "Spotted Lake (Osoyoos)", 49.0780, -119.5660, 0.5, "geheim sight", { m: [6, 9], t: "Nur vom Zaun aus ansehen, heiliger Ort der Syilx." }),

  // Wells Gray
  s("helmcken", "wellsgray", "Helmcken Falls", 51.9550, -120.1770, 1, "natur aussicht sight", { m: [5, 10] }),
  s("dawsonfalls", "wellsgray", "Dawson Falls", 51.9640, -120.1260, 0.75, "natur ruhe"),
  s("spahats", "wellsgray", "Spahats Creek Falls", 51.7410, -120.0060, 0.5, "natur"),
  s("moul", "wellsgray", "Moul Falls (hinter den Wasserfall)", 51.8345, -120.0504, 2, "wandern natur geheim"),
  s("clearwaterlake", "wellsgray", "Kanu auf dem Clearwater Lake", 52.1300, -120.1800, 3, "ruhe wasser tiere", { m: [6, 9] }),

  // Revelstoke & Glacier NP
  s("mtrevelstoke", "revelstoke", "Meadows in the Sky (Mt. Revelstoke)", 51.0400, -118.1600, 3, "aussicht natur", { m: [7, 9], t: "Wildblumen Ende Juli/August." }),
  s("cedars", "revelstoke", "Giant Cedars Boardwalk", 51.0070, -117.8300, 0.75, "natur ruhe familie"),
  s("pipecoaster", "revelstoke", "Revelstoke Mountain Resort (Gondel & Coaster)", 50.9693, -118.1093, 2, "familie aussicht"),
  s("rogerspass", "revelstoke", "Rogers Pass (Glacier NP)", 51.3000, -117.5200, 2, "natur aussicht wandern"),
  s("enchanted", "revelstoke", "Enchanted Forest", 51.0000, -118.4500, 1.5, "familie", { m: [5, 9] }),

  // Jasper & Icefields Parkway
  s("maligne", "jasper", "Maligne Canyon", 52.9200, -117.9950, 1.5, "natur wandern familie"),
  s("spirit", "jasper", "Maligne Lake & Spirit Island", 52.7250, -117.6400, 3.5, "wasser sight voll", { r: "Bootstour vorab buchen.", m: [6, 10] }),
  s("medicine", "jasper", "Medicine Lake", 52.8400, -117.7800, 0.5, "tiere natur", { t: "Auf der Maligne Road oft Elche, Bären und Bergschafe – langsam fahren." }),
  s("skytram", "jasper", "Jasper SkyTram", 52.8486, -118.0827, 2, "aussicht", { m: [4, 10] }),
  s("athabasca", "jasper", "Athabasca Falls", 52.6640, -117.8840, 0.75, "natur sight"),
  s("sunwapta", "jasper", "Sunwapta Falls", 52.5320, -117.6450, 0.5, "natur"),
  s("icefield", "jasper", "Columbia Icefield & Athabasca-Gletscher", 52.2170, -117.2240, 3, "sight natur voll", { t: "Liegt mitten auf dem Icefields Parkway – am besten auf der Fahrt Jasper ↔ Lake Louise." }),
  s("pyramid", "jasper", "Pyramid Lake", 52.9230, -118.0950, 1, "ruhe wasser", { w: "abends" }),
  s("edithcavell", "jasper", "Mount Edith Cavell", 52.6900, -118.0560, 2, "wandern natur", { m: [6, 10] }),
  s("fivelakes", "jasper", "Valley of the Five Lakes", 52.8100, -118.0300, 2, "wandern ruhe wasser"),
  s("darksky", "jasper", "Sterne gucken im Dark Sky Preserve", 52.8800, -118.0700, 1.5, "natur ruhe geheim", { w: "abends", m: [8, 4] }),

  // Lake Louise & Icefields Parkway Süd
  s("lakelouise", "lakelouise", "Lake Louise", 51.4166, -116.2150, 2, "wasser sight voll", { w: "früh", r: "Parkplatz kostenpflichtig und früh voll – Parks-Canada-Shuttle reservieren." }),
  s("moraine", "lakelouise", "Moraine Lake", 51.3217, -116.1860, 2, "wasser sight voll", { w: "früh", m: [6, 10], r: "Keine Privatautos: Parks-Canada-Shuttle oder Bus (Roam/Tour) vorab buchen." }),
  s("agnes", "lakelouise", "Lake Agnes Teahouse", 51.4164, -116.2442, 3.5, "wandern aussicht", { m: [6, 10], t: "Nur Barzahlung im Teehaus." }),
  s("sixglaciers", "lakelouise", "Plain of Six Glaciers", 51.4000, -116.2650, 5, "wandern natur", { m: [6, 10] }),
  s("peyto", "lakelouise", "Peyto Lake", 51.7180, -116.5100, 1, "aussicht sight voll" ),
  s("bowlake", "lakelouise", "Bow Lake", 51.6750, -116.4500, 0.75, "wasser natur ruhe", { w: "früh" }),
  s("llgondola", "lakelouise", "Lake Louise Gondola (Grizzlys)", 51.4430, -116.1620, 2, "tiere aussicht familie", { m: [5, 9] }),
  s("herbert", "lakelouise", "Herbert Lake", 51.4700, -116.2400, 0.5, "ruhe geheim wasser", { w: "früh" }),

  // Yoho / Golden
  s("emerald", "golden", "Emerald Lake", 51.4430, -116.5330, 2, "wasser sight", { t: "Kanu leihen am Bootshaus." }),
  s("naturalbridge", "golden", "Natural Bridge", 51.3915, -116.5000, 0.5, "natur"),
  s("takakkaw", "golden", "Takakkaw Falls", 51.5000, -116.4720, 1, "natur sight", { m: [6, 10] }),
  s("spiral", "golden", "Spiral Tunnels Aussicht", 51.4380, -116.3930, 0.3, "kultur familie"),
  s("ohara", "golden", "Lake O'Hara", 51.3555, -116.3350, 7, "wandern ruhe natur", { m: [6, 10], r: "Nur mit Parks-Canada-Bus, Plätze per Lotterie im Frühjahr." }),
  s("wapta", "golden", "Wapta Falls", 51.1873, -116.5758, 1.5, "ruhe natur geheim"),
  s("kickinghorse", "golden", "Kicking Horse Gondel & Grizzly-Refugium", 51.2970, -117.0480, 3, "tiere aussicht", { m: [6, 9] }),
  s("skybridge", "golden", "Golden Skybridge", 51.3150, -116.9574, 2, "familie aussicht"),

  // Banff
  s("banfftown", "banff", "Banff Avenue & Ort", 51.1760, -115.5700, 1.5, "stadt"),
  s("banffgondola", "banff", "Banff Gondola", 51.1488, -115.5597, 2, "aussicht voll"),
  s("johnston", "banff", "Johnston Canyon", 51.2450, -115.8390, 2.5, "wandern natur voll", { w: "früh" }),
  s("minnewanka", "banff", "Lake Minnewanka (Bootstour)", 51.2513, -115.4993, 2, "wasser", { m: [5, 10] }),
  s("twojack", "banff", "Two Jack Lake", 51.2350, -115.4950, 0.5, "ruhe wasser", { w: "früh" }),
  s("vermilion", "banff", "Vermilion Lakes", 51.1860, -115.6190, 0.5, "ruhe tiere wasser", { w: "abends" }),
  s("upperhot", "banff", "Banff Upper Hot Springs", 51.1500, -115.5610, 1.5, "ruhe"),
  s("bowvalley", "banff", "Bow Valley Parkway (Tiere)", 51.2700, -115.9000, 2, "tiere natur", { w: "früh" }),
  s("caveandbasin", "banff", "Cave and Basin", 51.1690, -115.5920, 1, "kultur"),
  s("hoodoos", "banff", "Tunnel Mountain & Hoodoos", 51.1890, -115.5520, 1.5, "wandern aussicht"),
  s("bowfalls", "banff", "Surprise Corner & Bow Falls", 51.1660, -115.5590, 0.5, "aussicht"),

  // Canmore & Kananaskis
  s("grassi", "canmore", "Grassi Lakes", 51.0730, -115.3970, 2, "wandern ruhe wasser"),
  s("haling", "canmore", "Ha Ling Peak", 51.0710, -115.4000, 4, "wandern aussicht"),
  s("lougheed", "canmore", "Peter Lougheed Provincial Park", 50.6720, -115.1500, 4, "natur ruhe tiere geheim", { r: "Kananaskis Conservation Pass nötig (online)." }),
  s("nordicspa", "canmore", "Kananaskis Nordic Spa", 50.9175, -115.1458, 3, "ruhe"),
  s("quarrylake", "canmore", "Quarry Lake", 51.0710, -115.3680, 1, "wasser familie"),

  // Kootenay
  s("marble", "radium", "Marble Canyon", 51.1880, -116.1220, 0.75, "natur"),
  s("paintpots", "radium", "Paint Pots", 51.1700, -116.1350, 1, "natur ruhe"),
  s("radiumhot", "radium", "Radium Hot Springs", 50.6390, -116.0390, 1.5, "ruhe"),
  s("sinclair", "radium", "Sinclair Canyon", 50.6450, -116.0300, 0.3, "natur"),
  s("kootenayview", "radium", "Kootenay Valley Viewpoint", 50.6746, -115.8878, 0.3, "aussicht"),

  // Waterton
  s("princeofwales", "waterton", "Prince of Wales Hotel", 49.0480, -113.9100, 0.75, "aussicht sight"),
  s("redrock", "waterton", "Red Rock Canyon", 49.1170, -114.0350, 1, "natur"),
  s("cameronlake", "waterton", "Cameron Lake", 49.0170, -114.0430, 1.5, "wasser ruhe"),
  s("bearshump", "waterton", "Bear's Hump", 49.0480, -113.9120, 2, "wandern aussicht"),
  s("crypt", "waterton", "Crypt Lake (Boot + Wanderung)", 49.0000, -113.8500, 8, "wandern natur", { r: "Wassertaxi vorab buchen.", m: [7, 9] }),

  // Calgary
  s("calgarytower", "calgary", "Calgary Tower & Downtown", 51.0443, -114.0631, 1.5, "stadt aussicht"),
  s("heritage", "calgary", "Heritage Park", 50.9890, -114.1060, 3, "kultur familie", { m: [5, 10] }),
  s("tyrrell", "calgary", "Royal Tyrrell Museum (Drumheller)", 51.4790, -112.7900, 4, "kultur familie", { t: "Dinosaurier! Gut 1,5 h Fahrt, durch die Badlands." }),
  s("dinopark", "calgary", "Dinosaur Provincial Park", 50.7570, -111.4870, 4, "natur geheim wandern"),
  s("stampede", "calgary", "Calgary Stampede", 51.0377, -114.0519, 4, "kultur", { m: [7, 7], t: "Nur 10 Tage im Juli – Unterkünfte dann sehr teuer." }),
  s("princes", "calgary", "Prince's Island Park", 51.0550, -114.0700, 1, "ruhe stadt"),

  // Yukon
  s("miles", "whitehorse", "Miles Canyon", 60.6630, -135.0360, 1, "natur"),
  s("takhini", "whitehorse", "Eclipse Nordic Hot Springs", 60.8770, -135.3600, 2, "ruhe"),
  s("aurora", "whitehorse", "Nordlichter beobachten", 60.7500, -135.1000, 3, "natur ruhe", { w: "abends", m: [8, 4], t: "Nur bei Dunkelheit, also nicht im Juni/Juli." }),
  s("ywp", "whitehorse", "Yukon Wildlife Preserve", 60.8690, -135.3540, 2, "tiere familie"),
  s("emeraldyukon", "whitehorse", "Emerald Lake & Carcross Desert", 60.2140, -134.8450, 2, "wasser geheim"),
  s("klondike", "whitehorse", "SS Klondike", 60.7130, -135.0480, 1, "kultur"),

  // Toronto
  s("cntower", "toronto", "CN Tower", 43.6426, -79.3871, 2, "aussicht sight voll"),
  s("distillery", "toronto", "Distillery District", 43.6503, -79.3596, 1.5, "kultur stadt"),
  s("stlawrence", "toronto", "St. Lawrence Market", 43.6487, -79.3715, 1, "stadt"),
  s("islands", "toronto", "Toronto Islands (Fähre)", 43.6230, -79.3740, 3, "ruhe wasser familie", { t: "Der Blick auf die Skyline von Ward's Island ist der schönste." }),
  s("rom", "toronto", "Royal Ontario Museum", 43.6677, -79.3948, 2.5, "kultur familie"),
  s("kensington", "toronto", "Kensington Market", 43.6545, -79.4005, 1.5, "stadt"),
  s("bluffs", "toronto", "Scarborough Bluffs", 43.7060, -79.2320, 1.5, "natur aussicht ruhe geheim"),
  s("casaloma", "toronto", "Casa Loma", 43.6780, -79.4094, 2, "kultur"),

  // Niagara
  s("falls", "niagara", "Niagarafälle & Table Rock", 43.0790, -79.0780, 2, "sight voll"),
  s("cruise", "niagara", "Bootsfahrt zu den Fällen", 43.0890, -79.0720, 1.5, "wasser sight voll", { m: [5, 10] }),
  s("behind", "niagara", "Journey Behind the Falls", 43.0795, -79.0790, 1, "sight familie"),
  s("notl", "niagara", "Niagara-on-the-Lake", 43.2550, -79.0710, 3, "kultur ruhe"),
  s("wineniagara", "niagara", "Weingüter (Eiswein)", 43.1900, -79.2000, 3, "kultur"),
  s("glen", "niagara", "Niagara Glen", 43.1270, -79.0560, 2, "wandern ruhe natur geheim"),
  s("fallsnight", "niagara", "Fälle bei Nacht (beleuchtet)", 43.0870, -79.0730, 1, "sight", { w: "abends" }),

  // Bruce Peninsula
  s("grotto", "tobermory", "The Grotto", 45.2470, -81.5240, 3, "wasser wandern voll", { r: "Parkplatz-Reservierung bei Parks Canada nötig.", m: [5, 10] }),
  s("flowerpot", "tobermory", "Flowerpot Island (Boot)", 45.3010, -81.6200, 4, "wasser natur", { r: "Bootstour vorab buchen.", m: [5, 10] }),
  s("singingsands", "tobermory", "Singing Sands", 45.1914, -81.5776, 1, "ruhe familie wasser"),
  s("bigtub", "tobermory", "Big Tub Lighthouse & Schiffswracks", 45.2585, -81.6700, 0.75, "wasser kultur"),
  s("lionshead", "tobermory", "Lion's Head Lookout", 44.9900, -81.2400, 2.5, "wandern aussicht geheim"),

  // Algonquin & Muskoka
  s("lookout", "algonquin", "Algonquin Lookout Trail", 45.5740, -78.4020, 1.5, "aussicht wandern", { t: "Ende September ist das Laub knallrot." }),
  s("canoelake", "algonquin", "Kanu auf dem Canoe Lake", 45.5500, -78.7270, 3, "wasser ruhe", { m: [5, 10] }),
  s("moose", "algonquin", "Elche am Highway 60", 45.5600, -78.6000, 2, "tiere", { w: "früh", m: [5, 7] }),
  s("tracktower", "algonquin", "Track & Tower Trail", 45.5498, -78.5743, 3, "wandern aussicht ruhe"),
  s("algonquinvc", "algonquin", "Algonquin Visitor Centre", 45.5836, -78.3596, 1, "kultur familie"),
  s("arrowhead", "algonquin", "Arrowhead Provincial Park", 45.3920, -79.2140, 2, "ruhe natur geheim"),
  s("muskokaboat", "algonquin", "Dampferfahrt auf dem Muskoka-See", 44.9200, -79.3730, 2.5, "wasser kultur", { m: [6, 10] }),
  s("dorset", "algonquin", "Dorset Lookout Tower", 45.2522, -78.8932, 1, "aussicht"),

  // Ottawa
  s("parliament", "ottawa", "Parliament Hill", 45.4236, -75.7009, 1.5, "sight kultur"),
  s("byward", "ottawa", "ByWard Market", 45.4290, -75.6910, 1.5, "stadt"),
  s("rideau", "ottawa", "Rideau-Kanal", 45.4200, -75.6970, 1.5, "wasser ruhe"),
  s("history", "ottawa", "Canadian Museum of History", 45.4300, -75.7090, 2.5, "kultur familie"),
  s("gallery", "ottawa", "National Gallery", 45.4295, -75.6989, 2, "kultur"),
  s("gatineau", "ottawa", "Gatineau Park (Pink Lake)", 45.4700, -75.8100, 2.5, "natur ruhe wandern"),

  // Thousand Islands
  s("1000boat", "thousand", "Bootstour durch die 1000 Islands", 44.3280, -76.1610, 2.5, "wasser sight", { m: [5, 10] }),
  s("forthenry", "thousand", "Fort Henry (Kingston)", 44.2310, -76.4600, 2, "kultur familie"),
  s("1000bike", "thousand", "Thousand Islands Parkway (Radweg)", 44.3600, -76.0500, 2, "ruhe wasser"),

  // Montréal
  s("vieuxmtl", "montreal", "Vieux-Montréal & Notre-Dame", 45.5045, -73.5562, 2.5, "kultur sight"),
  s("montroyal", "montreal", "Mont Royal Aussicht", 45.5048, -73.5872, 2, "aussicht ruhe"),
  s("jeantalon", "montreal", "Marché Jean-Talon", 45.5363, -73.6145, 1.5, "stadt"),
  s("plateau", "montreal", "Plateau & Mile End (Bagels!)", 45.5230, -73.6000, 2, "stadt kultur"),
  s("biodome", "montreal", "Biodôme & Botanischer Garten", 45.5600, -73.5530, 3, "familie natur tiere"),
  s("lachine", "montreal", "Radtour am Lachine-Kanal", 45.4800, -73.5800, 2, "ruhe wasser"),

  // Mont-Tremblant
  s("tremblantvillage", "tremblant", "Village & Gondel", 46.2090, -74.5840, 2.5, "aussicht familie"),
  s("pntremblant", "tremblant", "Parc national du Mont-Tremblant", 46.3260, -74.6500, 3, "natur ruhe wandern wasser"),
  s("scandinave", "tremblant", "Scandinave Spa", 46.1687, -74.6061, 3, "ruhe"),

  // Québec City
  s("vieuxqc", "quebec", "Vieux-Québec & Château Frontenac", 46.8122, -71.2050, 3, "kultur sight"),
  s("champlain", "quebec", "Quartier Petit-Champlain", 46.8110, -71.2030, 1, "kultur"),
  s("citadelle", "quebec", "Zitadelle & Plaines d'Abraham", 46.8070, -71.2100, 1.5, "kultur"),
  s("montmorency", "quebec", "Montmorency-Fälle", 46.8900, -71.1470, 1.5, "natur sight"),
  s("orleans", "quebec", "Île d'Orléans", 46.9100, -70.9800, 3, "ruhe kultur", { t: "Hofläden, Cidre und Erdbeeren." }),
  s("sainteanne", "quebec", "Canyon Sainte-Anne", 47.0750, -70.8600, 2, "natur"),
  s("jacquescartier", "quebec", "Parc national de la Jacques-Cartier", 47.3200, -71.3500, 4, "natur ruhe wandern geheim"),

  // Tadoussac
  s("whalestad", "tadoussac", "Walbeobachtung (Zodiac/Boot)", 48.1390, -69.7150, 3, "tiere wasser", { r: "Tour vorab buchen.", m: [6, 10] }),
  s("bondesir", "tadoussac", "Cap de Bon-Désir (Wale vom Ufer)", 48.2706, -69.4670, 1.5, "tiere ruhe geheim"),
  s("belugas", "tadoussac", "Belugas in der Baie-Sainte-Marguerite", 48.2600, -70.0350, 2, "tiere ruhe"),
  s("dunes", "tadoussac", "Dünen von Tadoussac", 48.1600, -69.6800, 1, "aussicht"),

  // Gaspésie
  s("rocherperce", "perce", "Rocher Percé", 48.5230, -64.2010, 1, "sight"),
  s("bonaventure", "perce", "Île Bonaventure (Basstölpel)", 48.4950, -64.1630, 4, "tiere natur", { r: "Boot vorab buchen.", m: [6, 10] }),
  s("forillon", "perce", "Parc national Forillon", 48.8700, -64.3500, 4, "natur wandern tiere"),

  // Halifax & Südküste
  s("waterfront", "halifax", "Hafenpromenade Halifax", 44.6440, -63.5680, 1.5, "stadt"),
  s("citadel", "halifax", "Citadel Hill", 44.6476, -63.5803, 1.5, "kultur"),
  s("peggys", "halifax", "Peggy's Cove", 44.4920, -63.9180, 1.5, "sight voll", { w: "früh" }),
  s("lunenburg", "halifax", "Lunenburg (UNESCO)", 44.3770, -64.3090, 3, "kultur"),
  s("mahone", "halifax", "Mahone Bay", 44.4480, -64.3830, 1, "ruhe"),
  s("pier21", "halifax", "Pier 21 Einwanderer-Museum", 44.6375, -63.5680, 2, "kultur"),

  // Cape Breton
  s("cabottrail", "capebreton", "Cabot Trail (ganze Runde)", 46.6402, -61.0053, 8, "natur aussicht sight", { t: "Am besten gegen den Uhrzeigersinn fahren, dann ist das Meer auf deiner Seite." }),
  s("skyline", "capebreton", "Skyline Trail", 46.7300, -60.8800, 2.5, "wandern aussicht tiere", { w: "abends" }),
  s("pleasantbay", "capebreton", "Walbeobachtung Pleasant Bay", 46.8300, -60.7900, 2.5, "tiere wasser", { m: [6, 10] }),
  s("bell", "capebreton", "Alexander Graham Bell Museum", 46.1000, -60.7470, 1.5, "kultur"),
  s("meatcove", "capebreton", "Meat Cove", 47.0200, -60.5600, 3, "geheim ruhe aussicht"),
  s("ingonish", "capebreton", "Ingonish Beach", 46.6400, -60.4000, 1.5, "wasser"),

  // Prince Edward Island
  s("greengables", "pei", "Cavendish & Green Gables", 46.4890, -63.3830, 2, "kultur familie"),
  s("peibeach", "pei", "Strände im PEI-Nationalpark", 46.4950, -63.3700, 2, "wasser ruhe"),
  s("charlottetown", "pei", "Hafen von Charlottetown", 46.2330, -63.1260, 1.5, "stadt"),
  s("lobster", "pei", "Hummer-Essen (Lobster Supper)", 46.4100, -63.3500, 1.5, "kultur", { w: "abends" }),
  s("greenwich", "pei", "Greenwich Dünen", 46.4480, -62.6930, 2, "natur ruhe geheim"),
  s("eastpoint", "pei", "East Point Lighthouse", 46.4530, -61.9720, 1, "geheim"),

  // Bay of Fundy
  s("hopewell", "fundy", "Hopewell Rocks", 45.8210, -64.5740, 2, "natur sight voll", { t: "Bei Ebbe auf dem Meeresboden laufen – Gezeitentabelle vorher ansehen!" }),
  s("dickson", "fundy", "Dickson Falls (Fundy NP)", 45.5900, -64.9900, 1, "natur wandern"),
  s("capeenrage", "fundy", "Cape Enrage", 45.5950, -64.7800, 1.5, "aussicht"),
  s("fundytrail", "fundy", "Fundy Trail Parkway", 45.4021, -65.4503, 3, "aussicht wasser ruhe"),

  // Neufundland
  s("signal", "stjohns", "Signal Hill", 47.5700, -52.6820, 1.5, "aussicht kultur"),
  s("capespear", "stjohns", "Cape Spear", 47.5236, -52.6195, 1.5, "aussicht", { w: "früh", t: "Östlichster Punkt Nordamerikas – Sonnenaufgang!" }),
  s("jellybean", "stjohns", "Jellybean Row & George Street", 47.5640, -52.7100, 1.5, "stadt"),
  s("puffins", "stjohns", "Papageientaucher in der Witless Bay", 47.2800, -52.8200, 3, "tiere wasser", { r: "Bootstour vorab buchen.", m: [5, 8] }),
  s("quidivid", "stjohns", "Quidi Vidi", 47.5800, -52.6800, 1, "ruhe"),
  s("westernbrook", "grosmorne", "Western Brook Pond (Bootstour)", 49.7900, -57.8800, 4, "wasser natur", { r: "Bootstour vorab buchen.", m: [6, 10] }),
  s("tablelands", "grosmorne", "Tablelands", 49.4462, -57.9940, 1.5, "natur geheim"),
  s("gmmountain", "grosmorne", "Gros Morne Mountain", 49.5900, -57.7900, 8, "wandern aussicht", { m: [7, 10] }),
  s("lobstercove", "grosmorne", "Lobster Cove Head Leuchtturm", 49.6000, -57.9500, 0.75, "aussicht", { w: "abends" }),
  s("greengardens", "grosmorne", "Green Gardens Trail", 49.4750, -58.0900, 3, "wandern ruhe"),

  // Ergänzungen Rockies (Lake Louise, Icefields Parkway, Banff, Jasper)
  s("bigbeehive", "lakelouise", "Big Beehive (The Beehive)", 51.4146, -116.2434, 5, "wandern aussicht", { m: [6, 10], t: "Über den Lake Agnes Teahouse hinauf, ca. 10 km hin und zurück, 520 Höhenmeter – Blick direkt auf Lake Louise." }),
  s("littlebeehive", "lakelouise", "Little Beehive", 51.4211, -116.2375, 4, "wandern aussicht", { m: [6, 10], t: "Abzweig kurz nach dem Lake Agnes Teahouse, etwas leichter als der Big Beehive." }),
  s("fairview", "lakelouise", "Fairview Lookout", 51.4135, -116.2120, 1, "aussicht wandern ruhe", { t: "Kurzer Weg vom Bootshaus, Blick von oben auf Lake Louise." }),
  s("larch", "lakelouise", "Larch Valley & Sentinel Pass", 51.3150, -116.2050, 5, "wandern aussicht natur", { m: [7, 10], t: "Mitte/Ende September leuchten die Lärchen golden." }),
  s("consolation", "lakelouise", "Consolation Lakes", 51.3153, -116.1528, 2.5, "wandern ruhe wasser", { m: [6, 10] }),
  s("mistaya", "lakelouise", "Mistaya Canyon", 51.9428, -116.7206, 0.5, "natur", { t: "Kurzer Stopp am Icefields Parkway." }),
  s("waterfowl", "lakelouise", "Waterfowl Lakes", 51.8400, -116.6200, 0.5, "wasser ruhe"),
  s("parker", "jasper", "Parker Ridge", 52.1813, -117.0923, 2, "wandern aussicht", { m: [7, 9], t: "Kurze Wanderung mit Blick auf den Saskatchewan-Gletscher." }),
  s("wilcox", "jasper", "Wilcox Pass", 52.2542, -117.2312, 3, "wandern aussicht tiere", { m: [7, 9], t: "Oft Bergschafe, Blick auf den Athabasca-Gletscher." }),
  s("skywalk", "jasper", "Columbia Icefield Skywalk", 52.2587, -117.2770, 1, "aussicht sight", { m: [5, 10], r: "Ticket vorab buchen." }),
  s("sunshine", "banff", "Sunshine Meadows", 51.1146, -115.7632, 5, "wandern natur aussicht", { m: [7, 9], r: "Gondel/Bus nach oben vorab buchen.", t: "Wildblumen im Juli und August." }),
  s("annette", "jasper", "Lake Annette", 52.8920, -118.0560, 1, "ruhe wasser familie")
];

// Kosten: 0 = kostenlos, "park" = Nationalpark/Historic Site (Parks-Canada-Pass), "kpass" = Kananaskis Conservation Pass,
// "sepaq" = Nationalpark in Québec (Tageseintritt), "prov" = Provinzpark-Tagespass pro Auto,
// Zahl = ungefährer Eintritt pro Erwachsenem in CAD, -1 = kostet etwas (Preis ändert sich oft).
// Alle Preise ungefähr (Stand 2025/26) – vor Ort oder online prüfen.
export const COST_LABEL = {
  park: "Nationalpark-Pass (ca. 11 CAD p. P./Tag oder Discovery Pass)",
  kpass: "Kananaskis Conservation Pass (ca. 15 CAD/Tag pro Auto)",
  sepaq: "Parc-national-Eintritt (ca. 10 CAD p. P.)",
  prov: "Provinzpark-Tagespass (pro Auto)"
};
const COST = {
  stanley: 0, granville: 0, capilano: 70, lynn: 0, grouse: 75, gastown: 0, moa: 25, englishbay: 0, lighthouse: 0, quarryrock: 0,
  seatosky: 70, shannon: 0, peak2peak: 100, joffre: 0, brandywine: 0, lostlake: 0, garibaldi: 0, nairn: 0,
  innerharbour: 0, butchart: 40, rbcm: 30, whalevic: 150, fortrodd: "park", eastsooke: 0, dallasrd: 0,
  longbeach: "park", chesterman: 0, rainforest: "park", wildpacific: 0, beartofino: 130, hotsprings: 150, cathedral: 0,
  naramata: -1, myra: 0, citypark: 0, knox: 0, spotted: 0,
  helmcken: 0, dawsonfalls: 0, spahats: 0, moul: 0, clearwaterlake: 60,
  mtrevelstoke: "park", cedars: "park", pipecoaster: 50, rogerspass: "park", enchanted: 25,
  maligne: "park", spirit: 90, medicine: "park", skytram: 65, athabasca: "park", sunwapta: "park", icefield: "park",
  pyramid: "park", edithcavell: "park", fivelakes: "park", darksky: "park",
  lakelouise: "park", moraine: "park", agnes: "park", sixglaciers: "park", peyto: "park", bowlake: "park", llgondola: 60, herbert: "park",
  emerald: "park", naturalbridge: "park", takakkaw: "park", spiral: "park", ohara: "park", wapta: "park", kickinghorse: 50, skybridge: 50,
  banfftown: 0, banffgondola: 70, johnston: "park", minnewanka: 70, twojack: "park", vermilion: "park", upperhot: 17,
  bowvalley: "park", caveandbasin: "park", hoodoos: "park", bowfalls: "park",
  grassi: "kpass", haling: "kpass", lougheed: "kpass", nordicspa: 100, quarrylake: 0,
  marble: "park", paintpots: "park", radiumhot: 17, sinclair: "park", kootenayview: "park",
  princeofwales: "park", redrock: "park", cameronlake: "park", bearshump: "park", crypt: 35,
  calgarytower: 20, heritage: 35, tyrrell: 21, dinopark: 0, stampede: 25, princes: 0,
  miles: 0, takhini: 30, aurora: 0, ywp: 20, emeraldyukon: 0, klondike: -1,
  cntower: 45, distillery: 0, stlawrence: 0, islands: 9, rom: 26, kensington: 0, bluffs: 0, casaloma: 45,
  falls: 0, cruise: 35, behind: 25, notl: 0, wineniagara: -1, glen: 0, fallsnight: 0,
  grotto: "park", flowerpot: 50, singingsands: "park", bigtub: 0, lionshead: 0,
  lookout: "prov", canoelake: 50, moose: "prov", tracktower: "prov", algonquinvc: "prov", arrowhead: "prov", muskokaboat: 50, dorset: -1,
  parliament: 0, byward: 0, rideau: 0, history: 23, gallery: 25, gatineau: 0,
  "1000boat": 45, forthenry: 25, "1000bike": 0,
  vieuxmtl: 0, montroyal: 0, jeantalon: 0, plateau: 0, biodome: 25, lachine: 0,
  tremblantvillage: 30, pntremblant: "sepaq", scandinave: 90,
  vieuxqc: 0, champlain: 0, citadelle: 20, montmorency: 0, orleans: 0, sainteanne: 18, jacquescartier: "sepaq",
  whalestad: 90, bondesir: "park", belugas: "sepaq", dunes: 0,
  rocherperce: 0, bonaventure: 40, forillon: "park",
  waterfront: 0, citadel: "park", peggys: 0, lunenburg: 0, mahone: 0, pier21: 15,
  cabottrail: "park", skyline: "park", pleasantbay: 70, bell: "park", meatcove: 0, ingonish: "park",
  greengables: "park", peibeach: "park", charlottetown: 0, lobster: 50, greenwich: "park", eastpoint: 0,
  hopewell: 15, dickson: "park", capeenrage: -1, fundytrail: 10,
  signal: 0, capespear: "park", jellybean: 0, puffins: 70, quidivid: 0,
  westernbrook: 75, tablelands: "park", gmmountain: "park", lobstercove: "park", greengardens: "park",
  bigbeehive: "park", littlebeehive: "park", fairview: "park", larch: "park", consolation: "park", mistaya: "park", waterfowl: "park",
  parker: "park", wilcox: "park", skywalk: 40, sunshine: 60, annette: "park"
};
// Zusatzhinweise zu Kosten
const COST_NOTE = {
  icefield: "Zum Gletscherrand zu Fuß im Parkpass enthalten; Fahrt mit dem Ice Explorer ca. 100 CAD.",
  moraine: "Dazu Shuttle (Parks Canada ca. 8 CAD) oder Bus/Tour.",
  lakelouise: "Parken ca. 37 CAD/Tag oder Parks-Canada-Shuttle.",
  ohara: "Dazu Bus ca. 20 CAD + Reservierungsgebühr.",
  spirit: "Wer nur zum See will, braucht nur den Parkpass.",
  montmorency: "Anschauen kostenlos, Parkplatz und Seilbahn extra.",
  vieuxmtl: "Altstadt kostenlos, Basilika Notre-Dame ca. 16 CAD.",
  joffre: "Der Tagespass von BC Parks ist kostenlos.",
  garibaldi: "Der Tagespass von BC Parks ist kostenlos.",
  naramata: "Weinproben meist ca. 10–25 CAD.",
  wineniagara: "Weinproben meist ca. 15–30 CAD.",
  aurora: "Selbst schauen kostenlos; geführte Touren ca. 150 CAD.",
  dinopark: "Geführte Touren kosten extra.",
  westernbrook: "Bootstour, dazu der Parkpass.",
  parliament: "Führungen kostenlos, vorab reservieren."
};
// Andere Namen, unter denen man einen Ort kennt
const ALIAS = {
  bigbeehive: ["The Beehive", "Beehive", "Big Beehive Trail"],
  banffgondola: ["Sulphur Mountain", "Banff Gondel"],
  agnes: ["Lake Agnes", "Teahouse", "Teehaus"],
  spirit: ["Spirit Island", "Maligne Lake", "Maligne Lake Cruise"],
  capilano: ["Capilano Hängebrücke", "Capilano Bridge"],
  falls: ["Horseshoe Falls", "Niagarafälle", "Niagara Falls"],
  moraine: ["Rockpile", "Moraine Lake Rockpile"],
  icefield: ["Athabasca Glacier", "Athabasca Gletscher", "Columbia Icefield", "Ice Explorer"],
  peak2peak: ["Peak 2 Peak", "Whistler Gondola"],
  seatosky: ["Sea to Sky Gondola", "Squamish Gondola"],
  johnston: ["Ink Pots"],
  cntower: ["CN-Turm"],
  stanley: ["Stanley Park", "Seawall"],
  vieuxqc: ["Chateau Frontenac", "Altstadt Québec", "Old Quebec"],
  vieuxmtl: ["Old Montreal", "Notre-Dame Basilika", "Basilique Notre-Dame"],
  cabottrail: ["Cabot Trail"],
  hopewell: ["Flowerpot Rocks"],
  emerald: ["Emerald Lake Yoho"],
  helmcken: ["Wells Gray"],
  minnewanka: ["Lake Minnewanka"]
};
for (const x of SIGHTS) {
  x.c = COST[x.id];
  if (COST_NOTE[x.id]) x.cn = COST_NOTE[x.id];
  if (ALIAS[x.id]) x.a = ALIAS[x.id];
  if (x.c === 0) x.tags.push("gratis");
}

// Kurze Beschriftung für die Kosten einer Sehenswürdigkeit (oder "" wenn unbekannt)
export function costLabel(c) {
  if (c === 0) return "🆓 kostenlos";
  if (c === -1) return "💲 kostet Eintritt";
  if (typeof c === "number") return `💲 ca. ${c} CAD p. P.`;
  if (c === "park") return "🎫 Nationalpark-Pass";
  if (c === "kpass") return "🎫 Kananaskis-Pass";
  if (c === "sepaq") return "🎫 ca. 10 CAD Parkeintritt";
  if (c === "prov") return "🎫 Provinzpark-Tagespass";
  return "";
}

export const AIRPORTS = {
  YVR: { name: "Vancouver", lat: 49.1951, lng: -123.1779 },
  YYJ: { name: "Victoria", lat: 48.6469, lng: -123.4258 },
  YLW: { name: "Kelowna", lat: 49.9561, lng: -119.3778 },
  YKA: { name: "Kamloops", lat: 50.7022, lng: -120.4444 },
  YYC: { name: "Calgary", lat: 51.1215, lng: -114.0076 },
  YEG: { name: "Edmonton", lat: 53.3097, lng: -113.5800 },
  YXY: { name: "Whitehorse", lat: 60.7096, lng: -135.0670 },
  YYZ: { name: "Toronto", lat: 43.6777, lng: -79.6248 },
  YOW: { name: "Ottawa", lat: 45.3225, lng: -75.6692 },
  YUL: { name: "Montréal", lat: 45.4706, lng: -73.7408 },
  YQB: { name: "Québec City", lat: 46.7911, lng: -71.3933 },
  YGP: { name: "Gaspé", lat: 48.7753, lng: -64.4786 },
  YHZ: { name: "Halifax", lat: 44.8808, lng: -63.5086 },
  YQM: { name: "Moncton", lat: 46.1122, lng: -64.6786 },
  YYG: { name: "Charlottetown", lat: 46.2900, lng: -63.1211 },
  YYT: { name: "St. John's", lat: 47.6186, lng: -52.7519 },
  YDF: { name: "Deer Lake", lat: 49.2108, lng: -57.3914 }
};

// Abflughäfen zu Hause (Auswahl, eigene Codes gehen auch)
export const HOME_AIRPORTS = {
  FRA: "Frankfurt", MUC: "München", DUS: "Düsseldorf", HAM: "Hamburg", BER: "Berlin",
  CGN: "Köln/Bonn", STR: "Stuttgart", HAJ: "Hannover", NUE: "Nürnberg", LEJ: "Leipzig",
  ZRH: "Zürich", VIE: "Wien", AMS: "Amsterdam"
};
// Lage der Abflughäfen (für die Anreise mit Zug oder Auto)
export const HOME_AP_POS = {
  FRA: [50.0379, 8.5622], MUC: [48.3538, 11.7861], DUS: [51.2895, 6.7668], HAM: [53.6304, 9.9882], BER: [52.3667, 13.5033],
  CGN: [50.8659, 7.1427], STR: [48.6899, 9.2220], HAJ: [52.4611, 9.6851], NUE: [49.4987, 11.0669], LEJ: [51.4324, 12.2416],
  ZRH: [47.4582, 8.5555], VIE: [48.1103, 16.5697], AMS: [52.3105, 4.7683]
};

// Fluggesellschaften nach Kanada. from = Abflughäfen mit (meist saisonalem) Direktflug, to = Ziele in Kanada.
// via = Umsteigeflughafen, wenn es keinen Direktflug gibt. Flugpläne ändern sich – immer auf der Airline-Seite prüfen.
// railMode: "incl" = Zug ab Bahnhof als Teil des Tickets (Lufthansa Express Rail), "partner" = über Partner-Airline möglich,
// "addon" = Rail&Fly zubuchbar, sonst Zugticket separat.
export const AIRLINES = [
  { id: "lh", railMode: "incl", name: "Lufthansa", url: "https://www.lufthansa.com/de/de/homepage", from: ["FRA", "MUC"], to: ["YVR", "YYC", "YYZ", "YUL"],
    gabel: "„Gabelflug / Mehrere Strecken“ in der Suche wählen", rail: "Lufthansa Express Rail: In der Suche als Abflugort den Bahnhof eingeben (z. B. „Essen Hbf“). Wird er angeboten, ist die Zugfahrt Teil des Flugtickets – Anschluss bei Verspätung abgesichert." },
  { id: "ac", railMode: "partner", name: "Air Canada", url: "https://www.aircanada.com/de/de/aco/home.html", from: ["FRA", "MUC", "ZRH"], to: ["YVR", "YYC", "YYZ", "YUL", "YOW", "YHZ"],
    gabel: "„Mehrere Städte“ wählen", rail: "Air Canada selbst verkauft keinen Zug. Die Air-Canada-Flüge ab Frankfurt gibt es aber oft auch als Lufthansa-Codeshare – dann über lufthansa.com mit Express Rail ab deinem Bahnhof buchen." },
  { id: "de", railMode: "addon", name: "Condor", url: "https://www.condor.com/de", from: ["FRA"], to: ["YVR", "YYC", "YYZ", "YHZ", "YEG", "YXY"],
    gabel: "Gabelflug direkt in der Suche möglich", rail: "Rail&Fly: bei der Buchung dazuwählen – Zug von jedem DB-Bahnhof zum Flughafen, meist gegen Aufpreis, in manchen Tarifen inklusive." },
  { id: "4y", railMode: "incl", name: "Discover Airlines", url: "https://www.discover-airlines.com/de/de/", from: ["FRA", "MUC"], to: ["YVR", "YYC", "YEG"],
    gabel: "„Gabelflug“ in der Suche wählen", rail: "Als Lufthansa-Group-Airline über die Lufthansa-Suche mit Express Rail ab deinem Bahnhof buchbar, sonst Rail&Fly je nach Tarif." },
  { id: "wk", name: "Edelweiss", url: "https://www.flyedelweiss.com/DE", from: ["ZRH"], to: ["YVR", "YYC"],
    gabel: "„Gabelflug“ in der Suche wählen", rail: "Zug zum Flughafen Zürich separat bei der SBB/DB" },
  { id: "lx", name: "SWISS", url: "https://www.swiss.com/de/de/homepage", from: ["ZRH"], to: ["YUL"], via: "ZRH",
    gabel: "„Gabelflug / mehrere Strecken“", rail: "Zug zum Flughafen Zürich separat" },
  { id: "fi", name: "Icelandair", url: "https://www.icelandair.com/de-de/", from: [], via: "KEF", to: ["YVR", "YYZ", "YUL", "YHZ", "YEG"],
    gabel: "„Mehrere Strecken“ wählen", rail: "Zug zum Flughafen separat", hubs: ["FRA", "MUC", "HAM", "DUS", "BER", "ZRH", "VIE", "AMS"] },
  { id: "kl", name: "KLM", url: "https://www.klm.de/", from: ["AMS"], via: "AMS", to: ["YVR", "YYC", "YYZ", "YUL", "YEG"],
    gabel: "„Gabelflug“ (Multi-City) wählen", rail: "Zug zum Flughafen separat", hubs: ["FRA", "MUC", "DUS", "HAM", "BER", "STR", "HAJ", "NUE", "CGN", "LEJ"] },
  { id: "af", name: "Air France", url: "https://wwws.airfrance.de/", from: [], via: "CDG", to: ["YVR", "YYZ", "YUL", "YQB"],
    gabel: "„Gabelflug“ wählen", rail: "Zug zum Flughafen separat", hubs: ["FRA", "MUC", "DUS", "HAM", "BER", "STR", "HAJ", "NUE", "CGN"] },
  { id: "ba", name: "British Airways", url: "https://www.britishairways.com/de-de/home", from: [], via: "LHR", to: ["YVR", "YYC", "YYZ", "YUL", "YHZ"],
    gabel: "„Mehrere Strecken“ wählen", rail: "Zug zum Flughafen separat", hubs: ["FRA", "MUC", "DUS", "HAM", "BER", "STR", "HAJ", "CGN"] }
];

// Mietwagen: Vermittler (oft mit Rundum-Versicherung ohne Selbstbeteiligung) und Vermieter direkt
export const CAR_SITES = [
  { name: "billiger-mietwagen.de", url: "https://www.billiger-mietwagen.de/", kind: "Vermittler" },
  { name: "CHECK24 Mietwagen", url: "https://www.check24.de/mietwagen/", kind: "Vermittler" },
  { name: "Sunny Cars", url: "https://www.sunnycars.de/", kind: "Vermittler, alles inklusive" },
  { name: "ADAC Autovermietung", url: "https://www.adac.de/produkte/mietwagen/", kind: "Vermittler" },
  { name: "Avis", url: "https://www.avis.de/", kind: "Vermieter" },
  { name: "Hertz", url: "https://www.hertz.de/", kind: "Vermieter" },
  { name: "Enterprise", url: "https://www.enterprise.de/", kind: "Vermieter" },
  { name: "Budget", url: "https://www.budget.de/", kind: "Vermieter" },
  { name: "National", url: "https://www.nationalcar.de/", kind: "Vermieter" },
  { name: "Alamo", url: "https://www.alamo.de/", kind: "Vermieter" }
];
// Was ein Mietwagen in Kanada an Schutz haben sollte. w = Gewicht für die Bewertung.
export const CAR_INS = [
  { id: "cdw", label: "Vollkasko (CDW/LDW)", w: 30, why: "Ohne Vollkasko zahlst du jeden Schaden am Mietwagen selbst." },
  { id: "sb0", label: "Keine Selbstbeteiligung (oder Erstattung)", w: 15, why: "Sonst zahlst du je Schaden oft 500–2.500 CAD selbst." },
  { id: "sli", label: "Zusatzhaftpflicht mind. 1 Mio. € (SLI/EP)", w: 25, why: "Die Grund-Haftpflicht in Kanada ist teils nur 200.000 CAD – bei Personenschäden viel zu wenig." },
  { id: "tp", label: "Diebstahlschutz (TP)", w: 8, why: "Deckt Diebstahl des Autos." },
  { id: "glass", label: "Glas, Reifen & Unterboden mitversichert", w: 8, why: "Steinschlag auf Schotter und Highways (z. B. Icefields Parkway) ist häufig und sonst nicht versichert." },
  { id: "km", label: "Unbegrenzte Kilometer", w: 8, why: "Kanada-Rundreisen haben schnell 2.000–4.000 km." },
  { id: "driver", label: "Zusatzfahrer inklusive", w: 3, why: "Damit ihr euch abwechseln dürft." },
  { id: "oneway", label: "Einweggebühr enthalten", w: 3, why: "Bei Abgabe an einem anderen Ort." }
];

// Vorbereitung: was vor einer Kanada-Reise zu erledigen ist
export const CHECKLIST = [
  { id: "eta", text: "eTA (Einreisegenehmigung) beantragen", note: "Nur auf canada.ca, kostet 7 CAD. Vorsicht vor teuren Vermittlerseiten.", when: 30 },
  { id: "pass", text: "Reisepass bis nach der Rückkehr gültig?", when: 60 },
  { id: "versicherung", text: "Auslandskrankenversicherung abschließen", note: "Arztbesuche in Kanada sind teuer.", when: 30 },
  { id: "mietwagen", text: "Mietwagen oder Camper buchen", note: "Einwegmiete (z. B. Vancouver → Calgary) kostet oft extra. Früh buchen spart viel.", when: 120 },
  { id: "fuehrerschein", text: "Führerschein mitnehmen", note: "Bedingungen des Vermieters prüfen; ein internationaler Führerschein schadet nicht.", when: 14 },
  { id: "kreditkarte", text: "Kreditkarte mit genug Rahmen", note: "Mietwagen und Hotels blockieren eine Kaution.", when: 14 },
  { id: "parkspass", text: "Parks Canada Discovery Pass", note: "Lohnt sich ab etwa 7 Tagen in Nationalparks. Online oder am Parkeingang.", when: 14 },
  { id: "shuttle", text: "Shuttles & Touren reservieren (z. B. Moraine Lake, Lake O'Hara, Bootstouren)", note: "Die App zeigt im Tagesplan, wo eine Reservierung nötig ist.", when: 90 },
  { id: "camping", text: "Campingplätze reservieren", note: "Parks-Canada-Plätze werden im Winter/Frühjahr freigeschaltet und sind schnell weg.", when: 150 },
  { id: "adapter", text: "Reisestecker Typ A/B einpacken", when: 3 },
  { id: "offline", text: "Offline-Karten laden (Google Maps/Maps.me)", note: "In den Bergen gibt es oft kein Netz.", when: 3 },
  { id: "esim", text: "eSIM oder kanadische SIM besorgen", when: 7 },
  { id: "geld", text: "Etwas Bargeld in CAD", note: "Für Teehäuser, Trinkgeld, kleine Märkte.", when: 7 }
];

export const PACKLIST = [
  { cat: "Kleidung", items: ["Regenjacke", "Fleece oder Daunenjacke (Berge sind auch im Sommer kalt)", "Wanderschuhe", "Mütze & Handschuhe", "Badesachen (Hot Springs!)", "Sonnenhut"] },
  { cat: "Draußen", items: ["Mückenschutz", "Sonnencreme", "Tagesrucksack", "Trinkflasche", "Fernglas für Tiere", "Stirnlampe"] },
  { cat: "Technik", items: ["Reisestecker Typ A/B", "Powerbank", "Handy-Halterung fürs Auto", "Kamera & Ersatzakku"] },
  { cat: "Papiere", items: ["Reisepass", "eTA-Bestätigung", "Führerschein", "Kreditkarte", "Versicherungsnachweis", "Buchungsbestätigungen (offline)"] },
  { cat: "Vor Ort kaufen", items: ["Bärenspray (darf nicht ins Flugzeug)", "Snacks & Wasser für lange Fahrten"] }
];

export const TIPS = [
  { icon: "💵", title: "Preise & Trinkgeld", text: "Steuern (GST/PST/HST) kommen erst an der Kasse dazu. Im Restaurant sind 15–20 % Trinkgeld üblich." },
  { icon: "🚗", title: "Autofahren", text: "Rechts abbiegen bei Rot ist nach Halt erlaubt (nicht auf der Insel Montréal). Gelbe Schulbusse mit Blinklicht nie überholen – auch nicht aus der Gegenrichtung." },
  { icon: "⛽", title: "Tanken", text: "Auf dem Icefields Parkway gibt es auf 230 km nur eine teure Tankstelle (Saskatchewan Crossing). Vorher volltanken." },
  { icon: "🐻", title: "Bären", text: "Auf Wanderungen laut sein, Bärenspray griffbereit tragen, nie Essen im Zelt. Tiere nie füttern und Abstand halten (Bären mind. 100 m)." },
  { icon: "🕐", title: "Zeitzonen", text: "Kanada hat sechs Zeitzonen. Zwischen BC und Alberta springt die Uhr eine Stunde – wichtig für Shuttle-Zeiten." },
  { icon: "📶", title: "Netz", text: "In den Nationalparks gibt es oft kein Handynetz. Offline-Karten und Buchungsbestätigungen vorher speichern." },
  { icon: "🌅", title: "Früh los", text: "Beliebte Orte wie Moraine Lake, Lake Louise oder Johnston Canyon sind ab 9 Uhr voll. Wer um 7 Uhr da ist, hat sie fast für sich." },
  { icon: "🍁", title: "Beste Reisezeit", text: "Juli/August: alles offen, aber voll und teuer. Juni und September: ruhiger und günstiger. Ende September: Herbstlaub im Osten, goldene Lärchen in den Rockies." }
];
