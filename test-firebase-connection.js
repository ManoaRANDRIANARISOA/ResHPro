
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";

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
