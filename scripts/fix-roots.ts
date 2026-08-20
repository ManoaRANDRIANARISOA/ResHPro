import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

dotenv.config();
initializeApp({ credential: cert("./service-account.json") });
const db = getFirestore();

async function run() {
  await db.doc("tenants/demo").set({ createdAt: new Date().toISOString() }, { merge: true });
  await db.doc("tenants/okalodge").set({ createdAt: new Date().toISOString() }, { merge: true });
  await db.doc("tenants/kanana").set({ createdAt: new Date().toISOString() }, { merge: true });
  console.log("Fixed roots for demo, okalodge, kanana");
  process.exit(0);
}

run();
