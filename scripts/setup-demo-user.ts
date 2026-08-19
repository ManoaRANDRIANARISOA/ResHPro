import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
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

const auth = getAuth();

async function run() {
  const adminEmail = "admin@demo.mg";
  const adminPass = "demo2026";
  const tenantId = "demo";

  try {
    const user = await auth.createUser({
      email: adminEmail,
      password: adminPass,
      displayName: "Admin Demo"
    });
    await auth.setCustomUserClaims(user.uid, { tenantId: tenantId, role: "admin" });
    console.log(`✅ Compte Administrateur créé pour demo : ${adminEmail} (Mot de passe: ${adminPass})`);
  } catch (e: any) {
    if (e.code === "auth/email-already-exists") {
      console.log(`ℹ️ Le compte ${adminEmail} existe déjà.`);
      // Try to update claims just in case
      try {
        const existingUser = await auth.getUserByEmail(adminEmail);
        await auth.setCustomUserClaims(existingUser.uid, { tenantId: tenantId, role: "admin" });
        console.log(`✅ Revérification des permissions pour ${adminEmail} effectuée.`);
      } catch (err) {}
    } else {
      console.error(`❌ Erreur création compte ${adminEmail}:`, e);
    }
  }
  process.exit(0);
}

run().catch(console.error);
