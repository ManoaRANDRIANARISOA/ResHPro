import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { setDoc, doc, collection, getDocs, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import { TenantConfig, TenantPublicConfig, TenantSubscription } from "@shared/tenant";

export function useAllTenants() {
  return useQuery({
    queryKey: ["superadmin", "tenants"],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "tenants"));
      const tenantIds = new Set<string>(snap.docs.map(d => d.id));
      
      // Assurer que "demo" et les tenants historiques sont vérifiés
      tenantIds.add("demo");
      tenantIds.add("kanana");
      tenantIds.add("okalodge");

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
    rhPlanningPaie?: boolean;
  };
  invoicePrefix: string;
  subscription?: TenantSubscription;
}

export function useProvisionTenant() {
  const qc = useQueryClient();
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
        invoicePrefix,
        subscription,
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
        subscription: subscription || undefined,
        theme: {
          primary: themePrimary,
          secondary: themeSecondary,
          gradient: `linear-gradient(135deg, ${themePrimary} 0%, ${themeSecondary} 100%)`
        }
      };
      
      // 1.5. Créer le document racine
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
        subscription: subscription || undefined,
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

      // 3. Créer le premier utilisateur admin
      await setDoc(doc(db, `tenants/${tenantId}/utilisateurs`, "admin"), {
        nom: `Admin ${nom}`,
        email: `admin@${tenantId}.com`,
        login: `admin@${tenantId}.com`,
        role: "admin",
        createdAt: new Date().toISOString()
      });

      return tenantId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin", "tenants"] });
    },
  });
}

/**
 * Renouveler ou modifier la souscription d'un locataire
 */
export function useUpdateTenantSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tenantId,
      subscription,
    }: {
      tenantId: string;
      subscription: TenantSubscription;
    }) => {
      // Met à jour à la fois config et publicConfig
      await setDoc(
        doc(db, `tenants/${tenantId}/publicConfig/main`),
        { subscription },
        { merge: true }
      );
      await setDoc(
        doc(db, `tenants/${tenantId}/config/main`),
        { subscription },
        { merge: true }
      );
      return { tenantId, subscription };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin", "tenants"] });
    },
  });
}

/**
 * Modifier les modules actifs d'un locataire (ex: activer/désactiver RH)
 */
export function useUpdateTenantModules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tenantId,
      modules,
    }: {
      tenantId: string;
      modules: TenantConfig["modules"];
    }) => {
      await setDoc(
        doc(db, `tenants/${tenantId}/config/main`),
        { modules },
        { merge: true }
      );
      return { tenantId, modules };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin", "tenants"] });
    },
  });
}

/**
 * Suspendre ou Réactiver un locataire en 1 clic
 */
export function useToggleTenantSuspension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tenantId,
      currentStatus,
      currentEndDate,
    }: {
      tenantId: string;
      currentStatus: string;
      currentEndDate?: string;
    }) => {
      const isCurrentlySuspended = currentStatus === "suspended";
      const newStatus = isCurrentlySuspended ? "active" : "suspended";
      
      const subUpdate: Partial<TenantSubscription> = {
        status: newStatus as any,
        suspendedReason: isCurrentlySuspended ? undefined : "Suspension manuelle par le Super-Admin",
      };

      await setDoc(
        doc(db, `tenants/${tenantId}/publicConfig/main`),
        { subscription: subUpdate },
        { merge: true }
      );
      await setDoc(
        doc(db, `tenants/${tenantId}/config/main`),
        { subscription: subUpdate },
        { merge: true }
      );
      return { tenantId, newStatus };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin", "tenants"] });
    },
  });
}
