import 'dotenv/config';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// On ne vide QUE les données de type transactions et clients,
// On garde: utilisateurs, userAuth, chambres, tables, menu, parametres
const collectionsToClear = [
  "clients",
  "reservations",
  "commandes",
  "stockProduits",
  "factures",
  "evenements",
  "chambresMaintenance"
];

async function clearDB() {
  console.log("Démarrage de la purge des tables dynamiques sur Firebase...");
  
  for (const collection of collectionsToClear) {
    try {
      await set(ref(db, collection), []);
      console.log(`[OK] Table vidée : ${collection}`);
    } catch (e) {
      console.error(`[ERREUR] Impossible de vider la table ${collection}:`, e);
    }
  }
  
  console.log("✅ Purge terminée avec succès !");
  process.exit(0);
}

clearDB();
