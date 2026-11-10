// Speichern: immer auf diesem Gerät, auf Wunsch zusätzlich über einen Listen-Code in Firebase,
// damit Handy und PC (oder ihr beide) dieselbe Liste sehen. Ein Dokument pro Liste: reisen/film-{code}.
// Die Liste liegt in derselben Sammlung wie die Kanada-Reisen (gleiche Form: j + st), damit keine neue
// Firestore-Regel veröffentlicht werden muss. Das Präfix „film-“ hält sie von den Reisen getrennt.
// Gleiches Firebase-Projekt wie die anderen Apps (../essen-match-app/firebase-config.js).
const FB = "https://www.gstatic.com/firebasejs/12.19.0/";
const LS_STATE = "fs.state", LS_CODE = "fs.code";
const CODE_ABC = "abcdefghjkmnpqrstuvwxyz23456789";
export const canSync = /^https?:$/.test(location.protocol) && !new URLSearchParams(location.search).has("demo");

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
export const lsGet = ls.get, lsSet = ls.set;

export function emptyState() { return { v: 1, items: {}, st: 0 }; }
export function loadLocal() {
  try { const s = JSON.parse(ls.get(LS_STATE)); if (s && s.items) return s; } catch {}
  return emptyState();
}
export const cleanCode = c => String(c || "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const showCode = c => c.replace(/(.{4})(?=.)/g, "$1-");
export const savedCode = () => ls.get(LS_CODE) || "";
export const newCode = (n = 12) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => CODE_ABC[b % CODE_ABC.length]).join("");

// Zwei Stände zusammenführen: pro Titel gewinnt die neuere Änderung (t). Gelöschte Titel bleiben als „del“ stehen,
// damit sie vom anderen Gerät nicht zurückkommen.
export function merge(a, b) {
  const out = { v: 1, items: { ...a.items }, st: Math.max(a.st || 0, b.st || 0) };
  for (const [id, it] of Object.entries(b.items || {})) {
    const mine = out.items[id];
    if (!mine || (it.t || 0) > (mine.t || 0)) out.items[id] = it;
  }
  // Gelöschtes nach 90 Tagen ganz vergessen
  const old = Date.now() - 90 * 864e5;
  for (const [id, it] of Object.entries(out.items)) if (it.del && (it.t || 0) < old) delete out.items[id];
  return out;
}

let fb = null, ref = null, unsub = null, timer = null, writing = false, dirty = false, current = null;
let onRemote = () => {}, onStatus = () => {};
export function onSync(remoteFn, statusFn) { onRemote = remoteFn; onStatus = statusFn; }
export const syncCode = () => ref ? ref.code : "";

export function save(state) {
  state.st = Date.now();
  current = state;
  ls.set(LS_STATE, JSON.stringify(state));
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
  const app = appMod.initializeApp(cfg.firebaseConfig, "filme");
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

// Mit einem Listen-Code verbinden. isNew legt ihn mit der Liste dieses Geräts an.
export async function connect(code, state, isNew) {
  const { fs, db } = await fbInit();
  const doc = fs.doc(db, "reisen", "film-" + code);
  const pack = s => ({ j: JSON.stringify(s), st: s.st || Date.now() });
  let first = null;
  if (isNew) await fs.setDoc(doc, pack(state));
  else {
    const snap = await fs.getDoc(doc);
    if (!snap.exists()) throw new Error("notfound");
    first = JSON.parse(snap.data().j);
  }
  ls.set(LS_CODE, code);
  if (unsub) unsub();
  current = state;
  ref = { code, set: s => fs.setDoc(doc, pack(s)) };
  if (first) onRemote(first);
  unsub = fs.onSnapshot(doc, s => {
    if (!s.exists() || s.metadata.hasPendingWrites) return;
    const d = s.data();
    if ((d.st || 0) > (current?.st || 0)) onRemote(JSON.parse(d.j));
  }, () => onStatus("fehler"));
  onStatus("sync");
  dirty = true;
  flush();
}
// Zusammengeführten Stand übernehmen, ohne ihn als neue Änderung zurückzuschicken (er ist schon so in der Cloud)
export function adopt(state) {
  current = state;
  ls.set(LS_STATE, JSON.stringify(state));
}
export function disconnect() {
  if (unsub) unsub();
  unsub = null; ref = null;
  ls.del(LS_CODE);
  onStatus("lokal");
}

/* ---------- KI-Empfehlungen (Firebase AI Logic, Gemini) ---------- */
// Dasselbe Modell wie in den anderen Apps. Ältere Modelle schaltet Google regelmäßig ab; dann hier aktualisieren.
const AI_MODEL = "gemini-3.5-flash-lite";
const AI_TIMEOUT_MS = 60000;
export const canAi = canSync;

// taste: { love: [..], like: [..], dislike: [..], seen: [..], want: [..], skip: [..] } – jeweils „Titel (Jahr)“
// wish: freier Wunsch („was Lustiges, höchstens 90 Minuten“), type: "f" | "s" | ""
export async function aiRecommend(taste, wish, type, count = 12) {
  const { app } = await fbInit();
  const ai = await import(FB + "firebase-ai.js");
  const backend = ai.getAI(app, { backend: new ai.GoogleAIBackend() });
  const list = (name, arr, n = 80) => arr.length ? `${name}: ${arr.slice(0, n).join("; ")}\n` : "";
  const prompt = `Du bist eine Film- und Serien-Expertin und empfiehlst einer Person aus Deutschland, was sie als Nächstes schauen soll.
Ihr Geschmack:
${list("Geliebt", taste.love)}${list("Gut gefunden", taste.like)}${list("Hat ihr NICHT gefallen", taste.dislike)}${list("Schon gesehen (ohne Bewertung)", taste.seen, 120)}${list("Steht schon auf der Merkliste", taste.want, 120)}${list("Interessiert sie nicht", taste.skip, 60)}
${wish ? `Ihr Wunsch für jetzt: """${wish.slice(0, 400)}"""\n` : ""}${type === "f" ? "Nur Filme.\n" : type === "s" ? "Nur Serien.\n" : "Filme und Serien gemischt.\n"}
Empfiehl ${count} Titel, die sie noch NICHT kennt (nichts aus den Listen oben). Achte darauf, was ihr gefallen und was ihr nicht gefallen hat.
Mische bekannte Titel mit ein paar Geheimtipps, auch neuere (bis heute). Nur Titel, die es wirklich gibt.
Antworte NUR mit einem JSON-Objekt, ohne Text davor oder danach:
{"recs":[{"title":"deutscher Titel (wie in Deutschland bekannt)","orig":"Originaltitel","type":"f oder s","year":Jahr als Zahl,
"genres":["aus: Action, Abenteuer, Animation, Doku, Drama, Familie, Fantasy, Historie, Horror, Komödie, Krimi, Krieg, Musik, Mystery, Reality, Romantik, Sci-Fi, Sport, Thriller, Western"],
"tags":["3-5 kurze deutsche Merkmale in Kleinbuchstaben, z. B. düster, lustig, zeitreise, wahre-geschichte, miniserie"],
"why":"ein Satz auf Deutsch, warum es zu ihr passt, gern mit Bezug auf einen Titel, der ihr gefallen hat"}]}`;
  const m = ai.getGenerativeModel(backend, { model: AI_MODEL, generationConfig: { temperature: 0.8 } });
  const res = await Promise.race([
    m.generateContent(prompt),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Zeitüberschreitung")), AI_TIMEOUT_MS))
  ]);
  const text = res.response.text();
  const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  return (json.recs || []).filter(r => r && r.title);
}
