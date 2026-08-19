import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

dotenv.config();
initializeApp({ credential: cert("./service-account.json") });
const db = getFirestore();

async function run() {
  await db.doc("tenants/okalodge").set({ createdAt: new Date().toISOString() });
  await db.doc("tenants/kanana").set({ createdAt: new Date().toISOString() });
  console.log("Fixed roots");
  process.exit(0);
}

run();
