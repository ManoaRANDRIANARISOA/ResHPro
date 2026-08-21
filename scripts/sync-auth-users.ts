import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

dotenv.config();

const credential = cert("./service-account.json");
try {
  initializeApp({ credential });
} catch (e) {}

const auth = getAuth();
const db = getFirestore();

async function syncTenantUsers(tenantId: string, defaultPassword = `${tenantId}2026`) {
  console.log(`\n🔄 Synchronisation des utilisateurs du tenant '${tenantId}'...`);
  const snap = await db.collection(`tenants/${tenantId}/utilisateurs`).get();

  for (const doc of snap.docs) {
    const data = doc.data();
    const email = (data.login || "").trim().toLowerCase();
    const role = data.role || "direction";
    const nom = data.nom || email;

    if (!email) continue;

    let authUser;
    try {
      authUser = await auth.getUserByEmail(email);
      console.log(`ℹ️ L'utilisateur Auth ${email} existe déjà (UID: ${authUser.uid}). Mise à jour des claims...`);
      await auth.setCustomUserClaims(authUser.uid, { tenantId, role });
    } catch (e: any) {
      if (e.code === "auth/user-not-found") {
        console.log(`➕ Création du compte Auth pour ${email} (mdp par défaut: '${defaultPassword}')...`);
        authUser = await auth.createUser({
          email,
          password: defaultPassword,
          displayName: nom,
        });
        await auth.setCustomUserClaims(authUser.uid, { tenantId, role });
        console.log(`✅ Compte Auth créé pour ${email} avec rôle ${role}`);
      } else {
        console.error(`❌ Erreur pour ${email}:`, e);
      }
    }
  }
}

async function run() {
  await syncTenantUsers("demo", "demo2026");
  await syncTenantUsers("kanana", "kanana2026");
  await syncTenantUsers("okalodge", "okalodge2025");
  console.log("\n🎉 Synchronisation terminée !");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
