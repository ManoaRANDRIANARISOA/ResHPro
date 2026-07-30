
import "dotenv/config";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";

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

console.log("Initializing Firebase...");
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

console.log("Attempting to write to 'test_connection'...");

set(ref(db, "test_connection"), {
  timestamp: Date.now(),
  status: "ok",
  message: "Hello from Trae verification script"
})
.then(() => {
  console.log("✅ SUCCESS: Write operation successful!");
  console.log("Your Firebase connection is working.");
  process.exit(0);
})
.catch((error) => {
  console.error("❌ ERROR: Write operation failed.");
  console.error("Code:", error.code);
  console.error("Message:", error.message);
  
  if (error.code === 'PERMISSION_DENIED') {
    console.log("\n--- DIAGNOSIS ---");
    console.log("The error is PERMISSION_DENIED.");
    console.log("This means your Firebase Security Rules are blocking the write.");
    console.log("You need to change the rules in the 'Règles' tab of the Firebase Console.");
  }
  process.exit(1);
});
