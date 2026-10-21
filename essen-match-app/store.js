// Datenzugriff: Firebase (geteilt zwischen allen Handys) oder Demo-Modus (nur dieses Gerät).
// Beide liefern dieselbe Schnittstelle, damit app.js nichts davon wissen muss.
import { firebaseConfig } from "./firebase-config.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
export const hasFirebase = !!(firebaseConfig && firebaseConfig.apiKey);

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
  const app = initializeApp(firebaseConfig);
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
    async roomExists(code) {
      return (await fs.getDoc(fs.doc(db, "rooms", code))).exists();
    },
    async createRoom(code) {
      await fs.setDoc(fs.doc(db, "rooms", code), { createdAt: Date.now(), createdBy: uid });
    },
    room(code) {
      const base = fs.doc(db, "rooms", code);
      const col = c => fs.collection(base, c);
      return {
        watch(c, cb, order, onError) {
          const q = order ? fs.query(col(c), fs.orderBy(order.field, order.dir || "asc")) : col(c);
          return fs.onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onError);
        },
        setMember: data => fs.setDoc(fs.doc(base, "members", uid), data),
        add: async (c, data) => (await fs.addDoc(col(c), data)).id,
        update: (c, id, data) => fs.updateDoc(fs.doc(base, c, id), data),
        remove: (c, id) => fs.deleteDoc(fs.doc(base, c, id)),
        async addMany(c, list) {
          const batch = fs.writeBatch(db);
          list.forEach(d => batch.set(fs.doc(col(c)), d));
          await batch.commit();
        },
        async replace(c, removeIds, list) {
          const batch = fs.writeBatch(db);
          removeIds.forEach(id => batch.delete(fs.doc(base, c, id)));
          list.forEach(d => batch.set(fs.doc(col(c)), d));
          await batch.commit();
        }
      };
    }
  };
}

function localStore() {
  const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const put = (k, v) => localStorage.setItem(k, v);
  let uid = get("em.localUid");
  if (!uid) { uid = "local-" + randomCode(8); try { put("em.localUid", uid); } catch {} }

  const load = code => JSON.parse(get("em.room." + code) || "null");
  const save = (code, r) => put("em.room." + code, JSON.stringify(r));
  const subs = new Set();

  return {
    uid,
    mode: "local",
    async roomExists(code) { return !!load(code); },
    async createRoom(code) { save(code, { dishes: {}, members: {}, wishes: {} }); },
    room(code) {
      const list = (c, order) => {
        const items = Object.entries(load(code)[c]).map(([id, v]) => ({ id, ...v }));
        if (order) {
          const dir = order.dir === "desc" ? -1 : 1;
          items.sort((a, b) => ((a[order.field] ?? 0) > (b[order.field] ?? 0) ? 1 : -1) * dir);
        }
        return items;
      };
      const change = fn => {
        const r = load(code);
        fn(r);
        save(code, r); // wirft bei vollem Speicher, das zeigt app.js als Fehler an
        setTimeout(() => subs.forEach(s => s.code === code && s.fire()));
      };
      return {
        watch(c, cb, order) {
          const s = { code, fire: () => cb(list(c, order)) };
          subs.add(s);
          setTimeout(s.fire);
          return () => subs.delete(s);
        },
        async setMember(data) { change(r => { r.members[uid] = data; }); },
        async add(c, data) { const id = randomCode(12); change(r => { r[c][id] = data; }); return id; },
        async update(c, id, data) { change(r => { Object.assign(r[c][id], data); }); },
        async remove(c, id) { change(r => { delete r[c][id]; }); },
        async addMany(c, items) { change(r => items.forEach(d => { r[c][randomCode(12)] = d; })); },
        async replace(c, removeIds, items) {
          change(r => {
            removeIds.forEach(id => { delete r[c][id]; });
            items.forEach(d => { r[c][randomCode(12)] = d; });
          });
        }
      };
    }
  };
}
