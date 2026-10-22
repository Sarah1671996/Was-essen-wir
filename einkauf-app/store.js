// Datenzugriff: Firebase (geteilt zwischen allen Handys) oder Demo-Modus (nur dieses Gerät).
// Gleiches Firebase-Projekt wie die Essens-App, aber eigene Sammlung "households".
import { firebaseConfig } from "../essen-match-app/firebase-config.js";

const FB = "https://www.gstatic.com/firebasejs/12.19.0/";
// KI zum Lesen von Kassenbons (Firebase AI Logic, Gemini Developer API), dasselbe Modell wie in der Essens-App.
// Ältere Modelle schaltet Google regelmäßig ab; dann hier den Namen aktualisieren.
const AI_MODEL = "gemini-3.5-flash-lite";
const AI_TIMEOUT_MS = 30000;
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

  let model = null;
  async function getModel() {
    if (model) return model;
    const ai = await import(FB + "firebase-ai.js");
    const S = ai.Schema;
    const schema = S.object({
      properties: {
        total: S.number({ description: "Endbetrag in Euro, den der Kunde bezahlt hat" }),
        date: S.string({ description: "Kaufdatum im Format YYYY-MM-DD, z. B. 2026-10-21; leer wenn nicht lesbar" }),
        store: S.string({ description: "Name des Geschäfts, z. B. Kaufland, leer wenn nicht lesbar" })
      },
      optionalProperties: ["date", "store"]
    });
    model = ai.getGenerativeModel(ai.getAI(app, { backend: new ai.GoogleAIBackend() }), {
      model: AI_MODEL,
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0 }
    });
    return model;
  }

  return {
    uid,
    mode: "firebase",
    // Liest einen Kassenbon (JPEG als data:-URL). Liefert { total, date, store }.
    async readReceipt(dataUrl) {
      const m = await getModel();
      const prompt = "Das ist ein Foto eines deutschen Kassenbons. Lies den Endbetrag ab, den der Kunde bezahlt hat " +
        "(Zeile wie SUMME, GESAMT, ZU ZAHLEN oder BAR/EC, nach Abzug von Rabatten und Pfandbons). " +
        "Gib außerdem das Kaufdatum und den Namen des Geschäfts an. Erfinde nichts: Wenn der Betrag nicht lesbar ist, gib 0 zurück.";
      const image = { inlineData: { mimeType: "image/jpeg", data: dataUrl.split(",")[1] } };
      const result = await Promise.race([
        m.generateContent([prompt, image]),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Zeitüberschreitung")), AI_TIMEOUT_MS))
      ]);
      return JSON.parse(result.response.text());
    },
    // Gibt es die Familienliste, und ist sie noch offen (nicht nach einem Code-Wechsel geschlossen)?
    async exists(code) {
      const snap = await fs.getDoc(fs.doc(db, "households", code));
      return snap.exists() && !snap.data().closedAt;
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
        // Die Familienliste selbst beobachten (wird beim Code-Wechsel geschlossen)
        watchHouse: (cb, onError) => fs.onSnapshot(base, snap => cb(snap.exists() ? snap.data() : null), onError),
        close: () => fs.updateDoc(base, { closedAt: Date.now() }),
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
    readReceipt: null, // KI gibt es nur mit Firebase
    async exists(code) { const r = load(code); return !!r && !r.meta?.closedAt; },
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
        watchHouse(cb) {
          const s = { code, fire: () => cb(load(code)?.meta || {}) };
          subs.add(s);
          setTimeout(s.fire);
          return () => subs.delete(s);
        },
        async close() { change(r => { r.meta = { ...(r.meta || {}), closedAt: Date.now() }; }); },
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
