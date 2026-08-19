import { useMutation, useQuery } from "@tanstack/react-query";
import { setDoc, doc, collection, getDocs } from "firebase/firestore";
import { db } from "@/services/firebase";
import { TenantConfig, TenantPublicConfig } from "@shared/tenant";

export function useAllTenants() {
  // En production, cette requête serait protégée par des règles Firestore strictes 
  // (ex: seul l'utilisateur global admin = true peut lister les tenants).
  // Pour le MVP, on liste simplement la collection `tenants`.
  return useQuery({
    queryKey: ["superadmin", "tenants"],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "tenants"));
      // Pour avoir les détails, il faudrait lire les publicConfig de chaque tenant.
      // On le fait dans une boucle (acceptable si on a peu de tenants).
      const tenantsData = [];
      for (const tDoc of snap.docs) {
        const publicSnap = await getDocs(collection(db, `tenants/${tDoc.id}/publicConfig`));
        const publicConf = publicSnap.docs.find(d => d.id === "main")?.data() as TenantPublicConfig;
        
        const confSnap = await getDocs(collection(db, `tenants/${tDoc.id}/config`));
        const conf = confSnap.docs.find(d => d.id === "main")?.data() as TenantConfig;

        tenantsData.push({
          id: tDoc.id,
          publicConfig: publicConf,
          config: conf,
        });
      }
      return tenantsData;
    },
  });
}

interface ProvisionPayload {
  tenantId: string;
  nom: string;
  themePrimary: string;
  themeSecondary: string;
  logoUrl: string;
  modules: {
    hebergement: boolean;
    restaurant: boolean;
    stock: boolean;
    fichesTechniques: boolean;
    analyseEcarts: boolean;
  };
  invoicePrefix: string;
}

export function useProvisionTenant() {
  return useMutation({
    mutationFn: async (payload: ProvisionPayload) => {
      const { tenantId, nom, themePrimary, themeSecondary, logoUrl, modules, invoicePrefix } = payload;
      
      // 1. Créer le publicConfig
      const publicConfig: TenantPublicConfig = {
        nom,
        logoUrl,
        theme: {
          primary: themePrimary,
          secondary: themeSecondary,
          gradient: `linear-gradient(135deg, ${themePrimary} 0%, ${themeSecondary} 100%)`
        }
      };
      
      // 1.5. Créer le document racine (obligatoire pour que getDocs("tenants") le trouve)
      await setDoc(doc(db, "tenants", tenantId), { createdAt: new Date().toISOString() });

      await setDoc(doc(db, `tenants/${tenantId}/publicConfig/main`), publicConfig);

      // 2. Créer la config
      // On génère des catégories par défaut
      const config: Partial<TenantConfig> = {
        modules: {
          ...modules,
          fichesTechniques: true,
          analyseEcarts: true,
          iaPredicitions: false,
          multiSite: false
        },
        invoicePrefix,
        breakfastPrice: 15000,
        eventRatePerPerson: 15000,
        hebergementTypes: ["standard", "suite", "familiale", "dortoir", "bungalow"],
        menuCategories: [
          { id: "entrees", label: "Entrées", icon: "RamenDiningIcon" },
          { id: "plats", label: "Plats", icon: "RestaurantIcon" },
          { id: "desserts", label: "Desserts", icon: "CakeIcon" },
          { id: "boissons", label: "Boissons", icon: "LocalCafeIcon" },
          { id: "tapas", label: "Tapas / Snacks", icon: "RestaurantIcon" }
        ]
      };
      await setDoc(doc(db, `tenants/${tenantId}/config/main`), config);

      // 3. Créer le premier utilisateur (Admin de l'établissement)
      // Note: Idealement on utilise Cloud Functions (Admin SDK) pour créer le vrai User Firebase Auth.
      // Pour le MVP client, on enregistre le profil dans Firestore. L'utilisateur devra s'inscrire manuellement
      // via l'interface avec ce même email pour que les règles match.
      await setDoc(doc(db, `tenants/${tenantId}/utilisateurs`, "admin"), {
        nom: `Admin ${nom}`,
        email: `admin@${tenantId}.com`, // Dummy email
        role: "admin",
        createdAt: new Date().toISOString()
      });

      return tenantId;
    }
  });
}
