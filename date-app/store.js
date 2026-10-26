// Datenzugriff: Firebase (geteilt zwischen beiden Handys) oder Demo-Modus (nur dieses Gerät).
// Gleiches Firebase-Projekt wie die Essens-App, aber eigene Sammlung "couples".
import { firebaseConfig } from "../essen-match-app/firebase-config.js";

const FB = "https://www.gstatic.com/firebasejs/12.19.0/";
const forceDemo = new URLSearchParams(location.search).has("demo");
export const hasFirebase = !forceDemo && !!(firebaseConfig && firebaseConfig.apiKey);

export async function createStore() {
  return hasFirebase ? firebaseStore() : localStore();
}

export function randomCode(len = 10) {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, b => abc[b % abc.length]).join("");
}

async function firebaseStore() {
  const [{ initializeApp }, authMod, fs] = await Promise.all([
    import(FB + "firebase-app.js"),
    import(FB + "firebase-auth.js"),
    import(FB + "firebase-firestore.js")
  ]);
  // Eigener App-Name, damit sich der Offline-Speicher nicht mit den anderen Apps mischt
  const app = initializeApp(firebaseConfig, "dates");
  const auth = authMod.getAuth(app);
  const uid = await new Promise((resolve, reject) => {
    const stop = authMod.onAuthStateChanged(auth, user => {
      if (user) { stop(); resolve(user.uid); }
    });
    authMod.signInAnonymously(auth).catch(reject);
  });

  let db;
  try {
    db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() });
  } catch {
    db = fs.getFirestore(app);
  }

  return {
    uid,
    mode: "firebase",
    async exists(code) { return (await fs.getDoc(fs.doc(db, "couples", code))).exists(); },
    async create(code) {
      await fs.setDoc(fs.doc(db, "couples", code), { createdAt: Date.now(), createdBy: uid });
    },
    open(code) {
      const base = fs.doc(db, "couples", code);
      const col = c => fs.collection(base, c);
      return {
        watch(c, cb, onError) {
          return fs.onSnapshot(col(c), snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onError);
        },
        set: (c, id, data) => fs.setDoc(fs.doc(base, c, id), data),
        add: async (c, data) => (await fs.addDoc(col(c), data)).id,
        update: (c, id, data) => fs.updateDoc(fs.doc(base, c, id), data),
        remove: (c, id) => fs.deleteDoc(fs.doc(base, c, id))
      };
    }
  };
}

function localStore() {
  const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const put = (k, v) => localStorage.setItem(k, v);
  let uid = get("dt.localUid");
  if (!uid) { uid = "local-" + randomCode(8); try { put("dt.localUid", uid); } catch {} }

  const load = code => JSON.parse(get("dt.couple." + code) || "null");
  const save = (code, r) => put("dt.couple." + code, JSON.stringify(r));
  const subs = new Set();

  return {
    uid,
    mode: "local",
    async exists(code) { return !!load(code); },
    async create(code) { save(code, {}); },
    open(code) {
      const list = c => Object.entries(load(code)[c] || {}).map(([id, v]) => ({ id, ...v }));
      const change = fn => {
        const r = load(code);
        fn(r);
        save(code, r);
        setTimeout(() => subs.forEach(s => s.code === code && s.fire()));
      };
      return {
        watch(c, cb) {
          const s = { code, fire: () => cb(list(c)) };
          subs.add(s);
          setTimeout(s.fire);
          return () => subs.delete(s);
        },
        async set(c, id, data) { change(r => { (r[c] ||= {})[id] = data; }); },
        async add(c, data) { const id = randomCode(12); change(r => { (r[c] ||= {})[id] = data; }); return id; },
        async update(c, id, data) { change(r => { Object.assign(r[c][id], data); }); },
        async remove(c, id) { change(r => { delete (r[c] || {})[id]; }); }
      };
    }
  };
}
