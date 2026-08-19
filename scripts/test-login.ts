import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import * as dotenv from "dotenv";

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

console.log("Connecting with API Key:", firebaseConfig.apiKey);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function testLogin() {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, "admin@okalodge.mg", "okalodge2025");
    console.log("✅ Success! Logged in as:", userCredential.user.email);
  } catch (error: any) {
    console.error("❌ Login failed:", error.code, error.message);
  }
  process.exit(0);
}

testLogin();
