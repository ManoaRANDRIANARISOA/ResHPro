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
  console.log("Restoring okalodge logo...");
  await db.doc(`tenants/okalodge/publicConfig/main`).update({ logoUrl: "/assets/logo-oka.jpg" });
  console.log("Done.");
  process.exit(0);
}

run().catch(console.error);
