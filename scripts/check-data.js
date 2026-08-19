
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get } from "firebase/database";
import * as fs from "fs";

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

async function main() {
  console.log("Initializing Firebase...");
  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);

  console.log("Fetching root data from RTDB...");
  const snapshot = await get(ref(db, "/"));
  
  if (!snapshot.exists()) {
    console.log("No data found at root of RTDB.");
    process.exit(0);
  }

  const liveData = snapshot.val();
  
  try {
    const localExportRaw = fs.readFileSync("./oka-lodge-export.json", "utf-8");
    const localData = JSON.parse(localExportRaw);

    console.log("--- STATS (Live vs Local Export) ---");
    const collections = new Set([...Object.keys(liveData || {}), ...Object.keys(localData || {})]);
    
    let hasDifferences = false;
    for (const coll of collections) {
      const liveCount = liveData[coll] ? (Array.isArray(liveData[coll]) ? liveData[coll].length : Object.keys(liveData[coll]).length) : 0;
      const localCount = localData[coll] ? (Array.isArray(localData[coll]) ? localData[coll].length : Object.keys(localData[coll]).length) : 0;
      
      console.log(`Collection '${coll}': Live: ${liveCount}, Local: ${localCount}`);
      
      if (liveCount !== localCount) {
        hasDifferences = true;
      }
    }

    if (hasDifferences) {
      console.log("\n⚠️ DIFFERENCES FOUND! Exporting live data to live-export.json");
      fs.writeFileSync("live-export.json", JSON.stringify(liveData, null, 2));
    } else {
      console.log("\n✅ Data appears identical in size. The local oka-lodge-export.json is sufficient.");
    }
  } catch (err) {
    console.error("Error reading local export:", err);
  }
  
  process.exit(0);
}

main().catch(console.error);
