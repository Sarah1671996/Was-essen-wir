// Zugangswerte des Firebase-Projekts "Was-essen-wir".
// Diese Werte sind nicht geheim und dürfen öffentlich auf GitHub stehen. Geschützt wird über firestore.rules.
export const firebaseConfig = {
  apiKey: "AIzaSyAd5CVZ_WlqD_cKdfii2X1xrd-o5_FO7fY",
  authDomain: "was-essen-wir-5a00f.firebaseapp.com",
  projectId: "was-essen-wir-5a00f",
  storageBucket: "was-essen-wir-5a00f.firebasestorage.app",
  messagingSenderId: "789967858241",
  appId: "1:789967858241:web:dd6a7dba8de56518a874c0"
};

// Öffentlicher Schlüssel für Push-Benachrichtigungen
// (Firebase-Konsole → Projekteinstellungen → Cloud Messaging → Web-Push-Zertifikate)
export const vapidKey = "BGvbQDfAJ7YzmSXAVfsbU9NrmGhZGJ__YFZWPd6UccKNeYd-4s1APk7gIjwLdf-PLDMAX2KhMugfPKfpi1DOy3s";

// App Check (reCAPTCHA Enterprise): Nachweis, dass Anfragen aus unseren Apps kommen.
// In der Firebase-Konsole ist App Check für die KI (Firebase AI Logic) erzwungen; ohne diesen Nachweis lehnt Google KI-Anfragen ab.
// Der Schlüssel ist öffentlich (Google Cloud → Sicherheit → reCAPTCHA, Domains sarah1671996.github.io und localhost).
export const appCheckSiteKey = "6LeNyiMuAAAAAK_yqsS9UZKkrxikRgBSa1B7K1H_";
// Direkt nach initializeApp aufrufen, bevor KI oder Firestore genutzt werden. fbBase = Basis-URL der Firebase-Module.
export async function startAppCheck(app, fbBase) {
  const ac = await import(fbBase + "firebase-app-check.js");
  return ac.initializeAppCheck(app, { provider: new ac.ReCaptchaEnterpriseProvider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
}
