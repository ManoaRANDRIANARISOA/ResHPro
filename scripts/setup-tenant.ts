import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
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

initializeApp({ credential });
const auth = getAuth();
const db = getFirestore();

const tenantsToProvision = [
  {
    id: "okalodge",
    nom: "Oka Forest Lodge",
    logoUrl: "/assets/logo-oka.jpg",
    theme: { primary: "#6E8EF5", secondary: "#94D3AC" },
    invoicePrefix: "OKA",
    modules: { hebergement: true, restaurant: true, stock: true, fichesTechniques: false, analyseEcarts: false },
    adminEmail: "admin@okalodge.mg",
    adminPass: "okalodge2025"
  },
  {
    id: "kanana",
    nom: "Kanana Camp",
    logoUrl: "",
    theme: { primary: "#8e44ad", secondary: "#f39c12" },
    invoicePrefix: "KAN",
    modules: { hebergement: true, restaurant: true, stock: true, fichesTechniques: true, analyseEcarts: true },
    adminEmail: "admin@kanana.mg",
    adminPass: "kanana2026"
  }
];

async function run() {
  console.log("🚀 Démarrage du provisionnement des locataires (Admin SDK)...");

  // Création du compte Super Admin
  try {
    const saRecord = await auth.createUser({ email: "manoa@resipro.admin", password: "superadmin2026", displayName: "Super Admin" });
    await auth.setCustomUserClaims(saRecord.uid, { superAdmin: true });
    console.log("✅ Super Admin créé : manoa@resipro.admin");
  } catch (e: any) {
    if (e.code === "auth/email-already-exists") console.log("ℹ️ Super Admin existe déjà.");
  }

  for (const t of tenantsToProvision) {
    console.log(`\n⏳ Provisionnement de ${t.id}...`);

    // 1. Créer la configuration publique
    await db.doc(`tenants/${t.id}/publicConfig/main`).set({
      nom: t.nom,
      logoUrl: t.logoUrl,
      theme: t.theme
    });

    // 2. Créer la configuration privée
    await db.doc(`tenants/${t.id}/config/main`).set({
      modules: t.modules,
      invoicePrefix: t.invoicePrefix,
      breakfastPrice: 15000,
      eventRatePerPerson: 15000,
      hebergementTypes: ["standard", "suite", "familiale"],
      menuCategories: [
        { id: "entrees", label: "Entrées", type: "nourriture" },
        { id: "plats", label: "Plats", type: "nourriture" },
        { id: "desserts", label: "Desserts", type: "nourriture" },
        { id: "boissons", label: "Boissons", type: "boisson" }
      ]
    });
    console.log(`✅ Base de données Firestore configurée pour ${t.id}.`);

    // 3. Créer le compte administrateur et son profil Firestore
    let uid = "";
    try {
      const user = await auth.createUser({ email: t.adminEmail, password: t.adminPass, displayName: `Admin ${t.nom}` });
      await auth.setCustomUserClaims(user.uid, { tenantId: t.id, role: "admin" });
      uid = user.uid;
      console.log(`✅ Compte Administrateur créé : ${t.adminEmail}`);
    } catch (e: any) {
      if (e.code === "auth/email-already-exists") {
        console.log(`ℹ️ Le compte ${t.adminEmail} existe déjà. On récupère son UID.`);
        const user = await auth.getUserByEmail(t.adminEmail);
        uid = user.uid;
      } else {
        console.error(`❌ Erreur création compte ${t.adminEmail}:`, e);
      }
    }

    if (uid) {
      // 4. Ajouter l'utilisateur dans la base de données UI (Firestore)
      await db.collection(`tenants/${t.id}/utilisateurs`).doc(uid).set({
        nom: `Admin ${t.nom}`,
        login: t.adminEmail,
        role: "admin",
        statut: "Actif"
      });
      console.log(`✅ Profil Firestore créé pour ${t.adminEmail}`);
    }
  }

  console.log("\n🎉 Provisionnement terminé avec succès !");
  process.exit(0);
}

run().catch(console.error);
