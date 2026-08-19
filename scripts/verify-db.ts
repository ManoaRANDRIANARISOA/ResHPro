import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

dotenv.config();
initializeApp({ credential: cert("./service-account.json") });
const db = getFirestore();

async function check() {
  console.log("Checking Firestore Tenants...");
  const snap = await db.collection("tenants").get();
  console.log(`Found ${snap.size} root documents in 'tenants'.`);
  
  for (const doc of snap.docs) {
    console.log(`- Tenant ID: ${doc.id}`);
    const publicSnap = await db.collection(`tenants/${doc.id}/publicConfig`).get();
    console.log(`  Public Configs: ${publicSnap.size}`);
    publicSnap.forEach(p => console.log(`    -> ${p.id}:`, p.data()));
  }
  process.exit(0);
}

check();
