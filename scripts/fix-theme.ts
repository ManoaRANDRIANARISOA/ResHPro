import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

dotenv.config();
initializeApp({ credential: cert("./service-account.json") });
const db = getFirestore();

async function fixTheme() {
  await db.doc("tenants/okalodge/publicConfig/main").update({
    theme: { primary: "#6E8EF5", secondary: "#94D3AC" }
  });
  console.log("Theme fixed");
  process.exit(0);
}
fixTheme();
