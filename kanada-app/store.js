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
  fb = { fs, db };
  return fb;
}

// Mit einem Reisecode verbinden. isNew legt ihn mit der Reise dieses Geräts an.
export async function connect(code, trip, isNew) {
  const { fs, db } = await fbInit();
  const doc = fs.doc(db, "reisen", code);
  const pack = t => ({ j: JSON.stringify(t), st: t.st || Date.now() });
  if (isNew) await fs.setDoc(doc, pack(trip));
  else {
    const snap = await fs.getDoc(doc);
    if (!snap.exists()) throw new Error("notfound");
    const d = snap.data();
    // Neuerer Stand gewinnt
    if ((d.st || 0) >= (trip?.st || 0)) { const t = JSON.parse(d.j); current = t; ls.set(LS_TRIP, d.j); onRemote(t); }
    else { current = trip; dirty = true; }
  }
  ls.set(LS_CODE, code);
  if (unsub) unsub();
  ref = { code, set: t => fs.setDoc(doc, pack(t)) };
  unsub = fs.onSnapshot(doc, s => {
    if (!s.exists() || s.metadata.hasPendingWrites) return;
    const d = s.data();
    if ((d.st || 0) > (current?.st || 0)) { const t = JSON.parse(d.j); current = t; ls.set(LS_TRIP, d.j); onRemote(t); }
  }, () => onStatus("fehler"));
  onStatus("sync");
  flush();
}
export function disconnect() {
  if (unsub) unsub();
  unsub = null; ref = null;
  ls.del(LS_CODE);
  onStatus("lokal");
}
