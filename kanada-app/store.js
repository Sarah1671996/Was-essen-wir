// Speichern: immer auf diesem Gerät, auf Wunsch zusätzlich über einen Reisecode in Firebase,
// damit Handy, PC und Mitreisende dieselbe Reise sehen. Ein Dokument pro Reise: reisen/{code}.
// Gleiches Firebase-Projekt wie die anderen Apps (../essen-match-app/firebase-config.js).
const FB = "https://www.gstatic.com/firebasejs/12.19.0/";
const LS_TRIP = "ka.trip", LS_CODE = "ka.code";
const CODE_ABC = "abcdefghjkmnpqrstuvwxyz23456789";
export const canSync = /^https?:$/.test(location.protocol) && !new URLSearchParams(location.search).has("demo");

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
export function loadLocal() { try { return JSON.parse(ls.get(LS_TRIP)); } catch { return null; } }
export const cleanCode = c => String(c || "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const showCode = c => c.replace(/(.{4})(?=.)/g, "$1-");
export const savedCode = () => ls.get(LS_CODE) || "";
export const newId = (n = 8) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => CODE_ABC[b % CODE_ABC.length]).join("");

let fb = null, ref = null, unsub = null, timer = null, writing = false, dirty = false, current = null;
let onRemote = () => {}, onStatus = () => {};
export function onSync(remoteFn, statusFn) { onRemote = remoteFn; onStatus = statusFn; }
export const syncCode = () => ref ? ref.code : "";

export function save(trip) {
  trip.st = Date.now();
  current = trip;
  ls.set(LS_TRIP, JSON.stringify(trip));
  if (ref) { dirty = true; clearTimeout(timer); timer = setTimeout(flush, 1200); }
}
async function flush() {
  if (!ref || writing || !dirty) return;
  writing = true; dirty = false;
  try { await ref.set(current); onStatus("sync"); }
  catch (e) { console.error(e); onStatus("fehler"); }
  writing = false;
  if (dirty) flush();
}

async function fbInit() {
  if (fb) return fb;
  const [appMod, authMod, fs, cfg] = await Promise.all([
    import(FB + "firebase-app.js"), import(FB + "firebase-auth.js"), import(FB + "firebase-firestore.js"),
    import(new URL("../essen-match-app/firebase-config.js", location.href).href)
  ]);
  // Eigener App-Name, damit sich der Offline-Speicher nicht mit den anderen Apps mischt
  const app = appMod.initializeApp(cfg.firebaseConfig, "kanada");
  const auth = authMod.getAuth(app);
  await new Promise((resolve, reject) => {
    const stop = authMod.onAuthStateChanged(auth, u => { if (u) { stop(); resolve(); } });
    authMod.signInAnonymously(auth).catch(reject);
  });
  let db;
  try { db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() }); } catch { db = fs.getFirestore(app); }
  fb = { fs, db, app };
  return fb;
}

/* ---------- KI: Mietwagen-Buchung auslesen (Firebase AI Logic, Gemini) ---------- */
// Dasselbe Modell wie in der Essens- und Einkaufs-App. Ältere Modelle schaltet Google regelmäßig ab; dann hier aktualisieren.
const AI_MODEL = "gemini-3.5-flash-lite";
const AI_TIMEOUT_MS = 60000;
export const canAi = canSync;

// input: { url, provider, via, text, files: [{ mimeType, data (base64) }], pickup, dropoff, dates }
// Liefert die Felder fürs Mietwagen-Formular, ins.* = true/false/null (null = steht nicht drin)
export async function readCarBooking(input) {
  const { app } = await fbInit();
  const ai = await import(FB + "firebase-ai.js");
  const backend = ai.getAI(app, { backend: new ai.GoogleAIBackend() });
  const prompt = `Du hilfst bei einer Kanada-Rundreise. Lies die Mietwagen-Buchung bzw. das Angebot aus und antworte NUR mit einem JSON-Objekt, ohne Text davor oder danach.
Felder: provider (Vermieter, z. B. Avis), via (gebucht über, z. B. billiger-mietwagen.de; leer wenn direkt), cls (Fahrzeugklasse/Modell),
pickPlace, pickDate (YYYY-MM-DD), pickTime (HH:MM), dropPlace, dropDate, dropTime, total (Gesamtpreis als Zahl), cur ("EUR" oder "CAD"),
deductible (Selbstbeteiligung als Zahl, 0 wenn keine), cancelUntil (YYYY-MM-DD bis wann kostenlos stornierbar, leer wenn unbekannt),
sliSum (Deckungssumme der Haftpflicht als Text, z. B. "1,5 Mio. EUR"), deposit (Kaution als Text),
ins: { cdw: Vollkasko/CDW/LDW enthalten, sb0: keine Selbstbeteiligung oder wird erstattet, sli: Zusatzhaftpflicht mit mind. 1 Mio. EUR Deckung,
tp: Diebstahlschutz, glass: Glas, Reifen und Unterboden mitversichert, km: unbegrenzte Kilometer, driver: Zusatzfahrer inklusive, oneway: Einweggebühr enthalten }
– jeweils true, false oder null wenn es nirgends steht,
notes (Liste kurzer deutscher Hinweise zu wichtigen Bedingungen: z. B. Schotterstraßen verboten, Fahrten in die USA, Tankregelung, Kaution, Mindestalter, Kreditkarte nötig),
source ("dokument" wenn aus Link/Text/Datei gelesen, "recherche" wenn aus allgemeinen Tarifbedingungen des Anbieters, "wissen" wenn nur geschätzt).
Erfinde keine Preise oder Daten. Was du nicht sicher weißt, lass leer bzw. null.
${input.provider ? `Vermieter: ${input.provider}\n` : ""}${input.via ? `Gebucht über: ${input.via}\n` : ""}${input.url ? `Link zur Buchung/zum Angebot: ${input.url}\n` : ""}${input.trip ? `Reisedaten (nur zur Einordnung, nicht als Buchungsdaten übernehmen): ${input.trip}\n` : ""}
${input.text ? `Text der Buchung/Bedingungen:\n"""${input.text.slice(0, 30000)}"""\n` : ""}
${!input.text && !input.files?.length ? "Wenn der Link nicht lesbar ist: Suche die aktuellen Tarifbedingungen bzw. Versicherungsleistungen dieses Anbieters/Vermittlers für Mietwagen in Kanada und fülle ins.* und notes daraus (source = recherche)." : ""}`;
  const ask = tools => aiJson(backend, ai, prompt, input.files, tools);
  // Mit Link: Seite lesen lassen. Nur Anbieter: im Netz suchen (Google-Suche ist im kostenlosen Firebase-Tarif oft nicht
  // freigeschaltet). Geht beides nicht, antwortet die KI aus ihrem Wissen – das wird dann auch so angezeigt.
  const hasDoc = !!(input.text || input.files?.length);
  const tries = [];
  if (input.url) tries.push([{ urlContext: {} }]);
  if (!hasDoc) tries.push([{ googleSearch: {} }]);
  for (const tools of tries) {
    try { return await ask(tools); }
    catch (e) { console.warn("KI-Werkzeug nicht verfügbar:", Object.keys(tools[0])[0], e.message); }
  }
  const r = await ask(null);
  if (!hasDoc) { r.source = "wissen"; r.linkUnread = !!input.url; }
  return r;
}

// Eine Anfrage an Gemini, Antwort als JSON-Objekt
async function aiJson(backend, ai, prompt, files = [], tools = null) {
  const m = ai.getGenerativeModel(backend, { model: AI_MODEL, generationConfig: { temperature: 0 }, ...(tools ? { tools } : {}) });
  const res = await Promise.race([
    m.generateContent([prompt, ...(files || []).map(f => ({ inlineData: f }))]),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Zeitüberschreitung")), AI_TIMEOUT_MS))
  ]);
  const text = res.response.text();
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}

const DOC_PROMPTS = {
  lodging: `Lies die Unterkunfts-Buchung (z. B. Airbnb, Booking.com, Hotel) aus. Felder: name (Name der Unterkunft), platform
("Airbnb", "Booking.com", "Vrbo", "Expedia", "Hotel direkt", "Camping" oder "Sonstiges"), address (vollständige Adresse, so genau wie möglich),
city (Ort), checkIn (YYYY-MM-DD), checkOut (YYYY-MM-DD), checkInTime (HH:MM), total (Gesamtpreis inkl. Gebühren als Zahl), cur ("EUR" oder "CAD"),
cancelUntil (YYYY-MM-DD bis wann kostenlos stornierbar, leer wenn nicht), url (Link zur Anzeige, falls im Text), guests (Zahl),
notes (Liste kurzer deutscher Hinweise: Check-in-Ablauf, Schlüssel, Parken, Küche, Hausregeln).`,
  flight: `Lies die Flugbuchung aus. Felder: airline (z. B. Lufthansa), code (Buchungscode), total (Gesamtpreis als Zahl), cur ("EUR"),
out: { from (IATA-Code), to (IATA), date (YYYY-MM-DD), dep (Abflugzeit HH:MM Ortszeit), arr (Ankunftszeit HH:MM Ortszeit), flight (Flugnummer(n)) },
back: { from, to, date, dep, arr, flight } (leer bei nur Hinflug), rail (true wenn eine Zugfahrt/Express Rail/Rail&Fly enthalten ist), station (Abfahrtsbahnhof),
notes (Liste kurzer deutscher Hinweise: Gepäck, Sitzplätze, Umstieg, Check-in).`,
  price: `Das ist ein Screenshot einer Flugsuche auf einer Airline-Webseite. Lies den günstigsten angezeigten Gesamtpreis für die Reise
(alle Reisenden zusammen, Hin- und Rückflug falls gezeigt) aus. Felder: price (Zahl), cur ("EUR", "CAD" o. ä.), airline, perPerson (true wenn der Preis nur pro Person gilt),
persons (Anzahl Reisende, falls erkennbar), date (YYYY-MM-DD Hinflug, falls erkennbar), note (kurzer deutscher Hinweis, z. B. Tarifname oder Gepäck).`
};
// kind: "lodging" | "flight" | "price"; input: { text, files, url }
export async function readDocument(kind, input) {
  const { app } = await fbInit();
  const ai = await import(FB + "firebase-ai.js");
  const backend = ai.getAI(app, { backend: new ai.GoogleAIBackend() });
  const prompt = `Du hilfst bei einer Kanada-Reise. ${DOC_PROMPTS[kind]}
Antworte NUR mit einem JSON-Objekt, ohne Text davor oder danach. Erfinde nichts: Was nicht drinsteht, lass leer.
${input.trip ? `Zur Einordnung (nicht übernehmen): ${input.trip}\n` : ""}${input.url ? `Link: ${input.url}\n` : ""}${input.text ? `Text:\n"""${input.text.slice(0, 30000)}"""` : ""}`;
  if (input.url && !input.text && !input.files?.length) {
    try { return await aiJson(backend, ai, prompt, [], [{ urlContext: {} }]); }
    catch (e) { console.warn("Link nicht lesbar", e.message); throw new Error("Den Link konnte die KI nicht öffnen – kopier lieber den Text der Bestätigung oder nimm einen Screenshot"); }
  }
  return aiJson(backend, ai, prompt, input.files);
}

// Mit einem Reisecode verbinden. isNew legt ihn mit der Reise dieses Geräts an.
export async function connect(code, trip, isNew) {
  const { fs, db } = await fbInit();
  const doc = fs.doc(db, "reisen", code);
  const pack = t => ({ j: JSON.stringify(t), st: t.st || Date.now() });
  let first = null;
  if (isNew) await fs.setDoc(doc, pack(trip));
  else {
    const snap = await fs.getDoc(doc);
    if (!snap.exists()) throw new Error("notfound");
    first = JSON.parse(snap.data().j);
  }
  ls.set(LS_CODE, code);
  if (unsub) unsub();
  current = trip;
  ref = { code, set: t => fs.setDoc(doc, pack(t)) };
  // Die App führt den Stand vom anderen Gerät mit dem eigenen zusammen (onRemote) und speichert das Ergebnis
  if (first) onRemote(first);
  unsub = fs.onSnapshot(doc, s => {
    if (!s.exists() || s.metadata.hasPendingWrites) return;
    const d = s.data();
    if ((d.st || 0) > (current?.st || 0)) onRemote(JSON.parse(d.j));
  }, () => onStatus("fehler"));
  onStatus("sync");
  flush();
}
// Zusammengeführten Stand übernehmen, ohne ihn als neue Änderung zurückzuschicken (er ist schon so in der Cloud)
export function adopt(trip) {
  current = trip;
  ls.set(LS_TRIP, JSON.stringify(trip));
}
export function disconnect() {
  if (unsub) unsub();
  unsub = null; ref = null;
  ls.del(LS_CODE);
  onStatus("lokal");
}
