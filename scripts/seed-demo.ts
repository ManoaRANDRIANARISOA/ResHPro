import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

dotenv.config();

let credential;
try {
  credential = cert("./service-account.json");
} catch (error) {
  console.error("Veuillez placer le fichier service-account.json à la racine du projet.");
  process.exit(1);
}

// Check if already initialized to avoid errors
try {
  initializeApp({ credential });
} catch(e) {}

const db = getFirestore();
const tenantId = "demo";

async function seed() {
  console.log(`⏳ Seeding test data for ${tenantId}...`);

  const tId = `tenants/${tenantId}`;

  // 1. Create public config
  await db.doc(`${tId}/publicConfig/main`).set({
    nom: "Restaurant Demo",
    logoUrl: "",
    theme: { primary: "#1976d2", secondary: "#dc004e" }
  });

  // 2. Create private config
  await db.doc(`${tId}/config/main`).set({
    modules: { hebergement: true, restaurant: true, stock: true, fichesTechniques: true, analyseEcarts: true },
    invoicePrefix: "DEMO",
    menuCategories: [
      { id: "entrees", label: "Entrées", type: "nourriture" },
      { id: "plats", label: "Plats", type: "nourriture" }
    ]
  });

  // 3. Clear existing demo stock/menu to avoid duplicates if run multiple times
  const collections = ["stock", "menu", "fiches-techniques", "commandes", "factures"];
  for (const col of collections) {
    const snapshot = await db.collection(`${tId}/${col}`).get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  // 4. Seed Stock
  console.log("Seeding stock...");
  const stockRef1 = db.collection(`${tId}/stock`).doc();
  const stockRef2 = db.collection(`${tId}/stock`).doc();
  const stockRef3 = db.collection(`${tId}/stock`).doc();
  
  await stockRef1.set({
    nom: "Viande de Boeuf",
    famille: "Nourriture",
    sousCategorie: "Viande",
    unite: "kg",
    quantite: 50,
    stockTheorique: 50,
    seuilMin: 5,
    prixUnitaire: 20000
  });

  await stockRef2.set({
    nom: "Poulet",
    famille: "Nourriture",
    sousCategorie: "Volaille",
    unite: "kg",
    quantite: 30,
    stockTheorique: 30,
    seuilMin: 5,
    prixUnitaire: 15000
  });

  await stockRef3.set({
    nom: "Riz",
    famille: "Nourriture",
    sousCategorie: "Sec",
    unite: "kg",
    quantite: 100,
    stockTheorique: 100,
    seuilMin: 10,
    prixUnitaire: 3000
  });

  // 5. Seed Fiche Technique
  console.log("Seeding menu & fiches techniques...");
  const ficheRef = db.collection(`${tId}/fiches-techniques`).doc();
  await ficheRef.set({
    menuItemId: "temp", // will update
    portions: 1,
    ingredients: [
      { produitId: stockRef1.id, quantite: 0.200, unite: "kg" }, // 200g de boeuf
      { produitId: stockRef3.id, quantite: 0.150, unite: "kg" }  // 150g de riz
    ],
    updatedAt: new Date().toISOString()
  });

  // 6. Seed Menu Item
  const menuRef = db.collection(`${tId}/menu`).doc();
  await menuRef.set({
    nom: "Steak Frites de Boeuf & Riz",
    categorieId: "plats",
    prix: 25000,
    enabled: true,
    ficheTechniqueId: ficheRef.id
  });

  // Update fiche to point to correct menu item
  await ficheRef.update({ menuItemId: menuRef.id });

  console.log("✅ Seeding completed for 'demo' tenant!");
  process.exit(0);
}

seed().catch(console.error);
