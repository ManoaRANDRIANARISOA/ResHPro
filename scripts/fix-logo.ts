import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

dotenv.config();

let credential;
try {
  credential = cert("./service-account.json");
} catch (error) {
  console.error("Veuillez placer le fichier service-account.json à la racine du projet.");
  process.exit(1);
}

try {
  initializeApp({ credential });
} catch(e) {}

const db = getFirestore();

async function run() {
  console.log("Fixing logos...");
  
  const tenantsSnapshot = await db.collection("tenants").get();
  
  for (const doc of tenantsSnapshot.docs) {
    const publicConfigRef = db.doc(`tenants/${doc.id}/publicConfig/main`);
    const publicConfig = await publicConfigRef.get();
    
    if (publicConfig.exists) {
      const data = publicConfig.data();
      if (data?.logoUrl === "/assets/logo-oka.jpg") {
        console.log(`Updating ${doc.id}...`);
        await publicConfigRef.update({ logoUrl: "" });
      }
    }
  }
  
  console.log("Done.");
  process.exit(0);
}

run().catch(console.error);
