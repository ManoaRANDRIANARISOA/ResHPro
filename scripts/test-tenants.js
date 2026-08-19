import "dotenv/config";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkTenants() {
  const tenants = ["demo", "kanana", "okalodge"];
  for (const t of tenants) {
    try {
      const d = await getDoc(doc(db, `tenants/${t}/publicConfig/main`));
      if (d.exists()) {
        console.log(`Tenant '${t}' exists! Data:`, d.data());
      } else {
        console.log(`Tenant '${t}' does not have publicConfig/main.`);
      }
    } catch (e) {
      console.log(`Error checking tenant '${t}':`, e.message);
    }
  }
  process.exit(0);
}

checkTenants();
