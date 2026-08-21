import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

dotenv.config();

let credential;
try {
  credential = cert("./service-account.json");
} catch (error) {
  console.error("service-account.json introuvable");
  process.exit(1);
}

try {
  initializeApp({ credential });
} catch (e) {}

const db = getFirestore();

async function updateSubscriptions() {
  console.log("⏳ Mise à jour des abonnements pour Kanana et Oka Forest Lodge...");

  // 1. KANANA CAMP : 1 mois et 1 semaine restants (Échéance au 28 Septembre 2026)
  const kananaSub = {
    status: "active",
    startDate: "2026-08-21",
    endDate: "2026-09-28", // 1 mois (21/09) + 7 jours (28/09)
    plan: "premium",
    durationMonths: 1,
    contactCommercial: {
      telephone: "+261 34 00 000 00",
      email: "commercial@reshpro.mg",
      nom: "Service Commercial ResiPro",
    },
    notes: "Abonnement 1 mois et 1 semaine",
  };

  await db.doc("tenants/kanana/publicConfig/main").set({ subscription: kananaSub }, { merge: true });
  await db.doc("tenants/kanana/config/main").set({ subscription: kananaSub }, { merge: true });
  console.log("✅ Kanana mis à jour : 1 mois et 1 semaine restants (Échéance: 28/09/2026)");

  // 2. OKA FOREST LODGE : Payé le 20 Août 2026 pour 1 mois (Échéance au 20 Septembre 2026)
  const okaSub = {
    status: "active",
    startDate: "2026-08-20",
    endDate: "2026-09-20", // 1 mois à compter du 20 Août
    plan: "premium",
    durationMonths: 1,
    contactCommercial: {
      telephone: "+261 34 00 000 00",
      email: "commercial@reshpro.mg",
      nom: "Service Commercial ResiPro",
    },
    notes: "Abonnement 1 mois payé le 20/08/2026",
  };

  await db.doc("tenants/okalodge/publicConfig/main").set({ subscription: okaSub }, { merge: true });
  await db.doc("tenants/okalodge/config/main").set({ subscription: okaSub }, { merge: true });
  console.log("✅ Oka Forest Lodge mis à jour : 1 mois payé le 20/08 (Échéance: 20/09/2026)");

  // 3. DEMO : 1 an pour confort de test
  const demoSub = {
    status: "active",
    startDate: "2026-08-21",
    endDate: "2027-08-21",
    plan: "premium",
    durationMonths: 12,
    contactCommercial: {
      telephone: "+261 34 00 000 00",
      email: "commercial@reshpro.mg",
      nom: "Service Commercial ResiPro",
    },
    notes: "Espace de Démonstration",
  };

  await db.doc("tenants/demo/publicConfig/main").set({ subscription: demoSub }, { merge: true });
  await db.doc("tenants/demo/config/main").set({ subscription: demoSub }, { merge: true });
  console.log("✅ Espace Demo configuré (Échéance: 21/08/2027)");

  console.log("\n🎉 Tous les abonnements ont été enregistrés avec succès dans Firestore !");
}

updateSubscriptions().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
