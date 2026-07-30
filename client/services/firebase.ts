import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, child } from "firebase/database";
// import { getAnalytics } from "firebase/analytics"; // Optional, focused on DB for now

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);

// Initialize Realtime Database and get a reference to the service
const db = getDatabase(app);

export { db };

/**
 * Syncs a collection to Firebase.
 * @param collection The collection name (e.g., "stock", "reservations")
 * @param data The data to save
 */
export async function syncToFirebase(collection: string, data: any) {
  if (!db) return;
  try {
    await set(ref(db, collection), data);
    console.log(`Synced ${collection} to Firebase`);
  } catch (e) {
    console.error(`Failed to sync ${collection} to Firebase`, e);
  }
}

/**
 * Reads a collection from Firebase.
 * @param collection The collection name
 * @returns The data or null
 */
export async function readFromFirebase(collection: string) {
  if (!db) return null;
  try {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, collection));
    if (snapshot.exists()) {
      return snapshot.val();
    } else {
      console.log(`No data available for ${collection}`);
      return null;
    }
  } catch (e) {
    console.error(`Failed to read ${collection} from Firebase`, e);
    return null;
  }
}
