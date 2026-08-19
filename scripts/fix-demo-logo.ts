import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

dotenv.config();

let credential;
try {
  credential = cert("./service-account.json");
} catch (error) {
  process.exit(1);
}

try {
  initializeApp({ credential });
} catch(e) {}

const db = getFirestore();

async function run() {
  const publicConfigRef = db.doc(`tenants/demo/publicConfig/main`);
  const publicConfig = await publicConfigRef.get();
  
  if (publicConfig.exists) {
    console.log("Demo logoUrl is:", publicConfig.data()?.logoUrl);
    if (publicConfig.data()?.logoUrl === "/assets/logo-oka.jpg") {
      await publicConfigRef.update({ logoUrl: "" });
      console.log("Cleared demo logoUrl.");
    }
  } else {
    console.log("Demo publicConfig does not exist.");
  }
  process.exit(0);
}

run().catch(console.error);
