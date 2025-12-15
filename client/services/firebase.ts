import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, child } from "firebase/database";
// import { getAnalytics } from "firebase/analytics"; // Optional, focused on DB for now

const firebaseConfig = {
  apiKey: "AIzaSyA5UtMMxdoSaJVXrrjq7VwCw6TCtoeNA0M",
  authDomain: "nas-app-536af.firebaseapp.com",
  projectId: "nas-app-536af",
  storageBucket: "nas-app-536af.firebasestorage.app",
  messagingSenderId: "949292764678",
  appId: "1:949292764678:web:2492e96501fbe16fe8bd87",
  measurementId: "G-155V5Q5DEW",
  databaseURL: "https://nas-app-536af-default-rtdb.europe-west1.firebasedatabase.app"
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
