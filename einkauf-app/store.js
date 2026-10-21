// Datenzugriff: Firebase (geteilt zwischen allen Handys) oder Demo-Modus (nur dieses Gerät).
// Gleiches Firebase-Projekt wie die Essens-App, aber eigene Sammlung "households".
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
  // Eigener App-Name, damit sich der Offline-Speicher nicht mit der Essens-App mischt
  const app = initializeApp(firebaseConfig, "einkauf");
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
    async exists(code) {
      return (await fs.getDoc(fs.doc(db, "households", code))).exists();
    },
    async create(code) {
      await fs.setDoc(fs.doc(db, "households", code), { createdAt: Date.now(), createdBy: uid });
    },
    open(code) {
      const base = fs.doc(db, "households", code);
      const col = c => fs.collection(base, c);
      return {
        watch(c, cb, onError) {
          return fs.onSnapshot(col(c), snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onError);
        },
        set: (c, id, data) => fs.setDoc(fs.doc(base, c, id), data),
        patch: (c, id, data) => fs.setDoc(fs.doc(base, c, id), data, { merge: true }),
        async getAll(c) { return (await fs.getDocs(col(c))).docs.map(d => ({ id: d.id, ...d.data() })); },
        add: async (c, data) => (await fs.addDoc(col(c), data)).id,
        update: (c, id, data) => fs.updateDoc(fs.doc(base, c, id), data),
        remove: (c, id) => fs.deleteDoc(fs.doc(base, c, id)),
        async batch(ops) {
          const b = fs.writeBatch(db);
          ops.forEach(o => {
            if (o.type === "delete") b.delete(fs.doc(base, o.c, o.id));
            else if (o.type === "update") b.update(fs.doc(base, o.c, o.id), o.data);
            else b.set(o.id ? fs.doc(base, o.c, o.id) : fs.doc(col(o.c)), o.data);
          });
          await b.commit();
        }
      };
    }
  };
}

function localStore() {
  const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const put = (k, v) => localStorage.setItem(k, v);
  let uid = get("ek.localUid");
  if (!uid) { uid = "local-" + randomCode(8); try { put("ek.localUid", uid); } catch {} }

  const load = code => JSON.parse(get("ek.house." + code) || "null");
  const save = (code, r) => put("ek.house." + code, JSON.stringify(r));
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
        save(code, r); // wirft bei vollem Speicher, das zeigt app.js als Fehler an
        setTimeout(() => subs.forEach(s => s.code === code && s.fire()));
      };
      const apply = (r, o) => {
        const c = (r[o.c] ||= {});
        if (o.type === "delete") delete c[o.id];
        else if (o.type === "update") Object.assign(c[o.id], o.data);
        else c[o.id || randomCode(12)] = o.data;
      };
      return {
        watch(c, cb) {
          const s = { code, fire: () => cb(list(c)) };
          subs.add(s);
          setTimeout(s.fire);
          return () => subs.delete(s);
        },
        async set(c, id, data) { change(r => apply(r, { c, id, data })); },
        async patch(c, id, data) { change(r => { const m = (r[c] ||= {}); m[id] = { ...(m[id] || {}), ...data }; }); },
        async getAll(c) { return list(c); },
        async add(c, data) { const id = randomCode(12); change(r => apply(r, { c, id, data })); return id; },
        async update(c, id, data) { change(r => apply(r, { type: "update", c, id, data })); },
        async remove(c, id) { change(r => apply(r, { type: "delete", c, id })); },
        async batch(ops) { change(r => ops.forEach(o => apply(r, o))); }
      };
    }
  };
}
