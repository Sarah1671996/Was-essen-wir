// Datenzugriff für die Sauerteig-App: Firebase (gleiches Projekt wie die anderen Apps).
// Ein Dokument pro Sauerteig-Code: sauerteig/<code> { j, st, due, next, tokens, test }
//   j      alle Starter + Backplan als JSON-Text (Aufbau und Abgleich: starters.js)
//   due    anstehende Erinnerungen [{ at, title, body, tag, view, fed }]; der Server verschickt sie
//   next   frühester Zeitpunkt in due (danach sucht der Server alle 5 Minuten)
//   tokens Push-Tokens der Geräte
// Fotos des Tagebuchs einzeln: sauerteig/<code>/photos/<id> { photo, at }
// Ohne Firebase (oder offline beim Start) liefert createStore() null und die App läuft nur auf diesem Gerät.
import { firebaseConfig, vapidKey } from "../essen-match-app/firebase-config.js";

const FB = "https://www.gstatic.com/firebasejs/12.19.0/";

export function randomCode(len = 10) {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, b => abc[b % abc.length]).join("");
}

export async function createStore() {
  if (!firebaseConfig?.apiKey) return null;
  const [{ initializeApp }, authMod, fs] = await Promise.all([
    import(FB + "firebase-app.js"),
    import(FB + "firebase-auth.js"),
    import(FB + "firebase-firestore.js")
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  await new Promise((resolve, reject) => {
    const stop = authMod.onAuthStateChanged(auth, user => { if (user) { stop(); resolve(); } });
    authMod.signInAnonymously(auth).catch(reject);
  });
  let db;
  try { db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() }); }
  catch { db = fs.getFirestore(app); }
  const ref = code => fs.doc(db, "sauerteig", code);

  let messaging;
  async function getMessaging() {
    if (messaging !== undefined) return messaging;
    const msg = await import(FB + "firebase-messaging.js");
    messaging = (await msg.isSupported()) ? { msg, m: msg.getMessaging(app) } : null;
    return messaging;
  }

  return {
    async load(code) {
      const snap = await fs.getDoc(ref(code));
      return snap.exists() ? snap.data() : null;
    },
    // Meldet jede Änderung, auch von anderen Geräten. cb(Dokument oder null, vomServerBestätigt)
    watch: (code, cb, onError) => fs.onSnapshot(ref(code), { includeMetadataChanges: true },
      snap => cb(snap.exists() ? snap.data() : null, !snap.metadata.fromCache), onError),
    // Liest den aktuellen Stand und schreibt, was build(stand) liefert (null = nichts), ohne dass etwas dazwischenkommt
    commit: (code, build) => fs.runTransaction(db, async tx => {
      const snap = await tx.get(ref(code));
      const doc = build(snap.exists() ? snap.data() : null);
      if (doc) tx.set(ref(code), doc, { merge: true });
    }),
    savePhoto: (code, id, photo) => fs.setDoc(fs.doc(ref(code), "photos", id), { photo, at: Date.now() }),
    loadPhoto: async (code, id) => (await fs.getDoc(fs.doc(ref(code), "photos", id))).data()?.photo || null,
    removePhoto: (code, id) => fs.deleteDoc(fs.doc(ref(code), "photos", id)),
    removeToken: (code, token) => fs.updateDoc(ref(code), { tokens: fs.arrayRemove(token) }),
    addToken: (code, token) => fs.setDoc(ref(code), { tokens: fs.arrayUnion(token) }, { merge: true }),
    // Bittet den Server um eine sofortige Test-Benachrichtigung
    test: code => fs.setDoc(ref(code), { test: Date.now() }, { merge: true }),
    async pushSupported() {
      return !!vapidKey && "Notification" in window && "serviceWorker" in navigator && !!(await getMessaging());
    },
    async pushToken(serviceWorkerRegistration) {
      const x = await getMessaging();
      if (!x) return null;
      return x.msg.getToken(x.m, { vapidKey, serviceWorkerRegistration });
    },
    async onPush(cb) {
      const x = await getMessaging();
      if (x) x.msg.onMessage(x.m, cb);
    }
  };
}
