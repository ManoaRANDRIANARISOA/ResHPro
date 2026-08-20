import { useMutation, useQuery } from "@tanstack/react-query";
import { setDoc, doc, collection, getDocs } from "firebase/firestore";
import { db } from "@/services/firebase";
import { TenantConfig, TenantPublicConfig } from "@shared/tenant";

export function useAllTenants() {
  return useQuery({
    queryKey: ["superadmin", "tenants"],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "tenants"));
      const tenantIds = new Set<string>(snap.docs.map(d => d.id));
      
      // Assurer que "demo" est également vérifié s'il n'avait pas de document racine
      tenantIds.add("demo");

      const tenantsData = [];
      for (const tId of tenantIds) {
        try {
          const publicSnap = await getDocs(collection(db, `tenants/${tId}/publicConfig`));
          const publicConf = publicSnap.docs.find(d => d.id === "main")?.data() as TenantPublicConfig | undefined;
          
          // Si le locataire n'a ni config ni document racine, on passe
          if (!publicConf && !snap.docs.some(d => d.id === tId)) {
            continue;
          }

          const confSnap = await getDocs(collection(db, `tenants/${tId}/config`));
          const conf = confSnap.docs.find(d => d.id === "main")?.data() as TenantConfig | undefined;

          tenantsData.push({
            id: tId,
            publicConfig: publicConf,
            config: conf,
          });
        } catch (err) {
          console.warn(`Erreur lors de la récupération du tenant ${tId}:`, err);
        }
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
  nif?: string;
  stat?: string;
  rcs?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
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
      const {
        tenantId,
        nom,
        themePrimary,
        themeSecondary,
        logoUrl,
        nif,
        stat,
        rcs,
        adresse,
        telephone,
        email,
        modules,
        invoicePrefix
      } = payload;
      
      // 1. Créer le publicConfig
      const publicConfig: TenantPublicConfig = {
        nom,
        logoUrl,
        nif: nif?.trim() ? nif.trim() : "À fournir par le client",
        stat: stat?.trim() ? stat.trim() : "À fournir par le client",
        rcs: rcs?.trim() || undefined,
        adresse: adresse?.trim() || undefined,
        telephone: telephone?.trim() || undefined,
        email: email?.trim() || undefined,
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
      const config: Partial<TenantConfig> = {
        nom,
        logoUrl,
        nif: nif?.trim() ? nif.trim() : "À fournir par le client",
        stat: stat?.trim() ? stat.trim() : "À fournir par le client",
        rcs: rcs?.trim() || undefined,
        adresse: adresse?.trim() || undefined,
        telephone: telephone?.trim() || undefined,
        email: email?.trim() || undefined,
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
        login: `admin@${tenantId}.com`,
        role: "admin",
        createdAt: new Date().toISOString()
      });

      return tenantId;
    }
  });
}
