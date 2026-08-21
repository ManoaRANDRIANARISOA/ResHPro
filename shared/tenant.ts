export interface HebergementPack {
  id: string;
  nom: string;
  description?: string;
  typeCalcul: "par_personne_nuit" | "par_chambre_nuit" | "forfait_fixe";
  prix: number; // Prix en Ariary (Ar)
  isDefault?: boolean;
}

export interface TenantSubscription {
  status: "active" | "trial" | "expiring_soon" | "expired" | "suspended";
  startDate: string; // Format YYYY-MM-DD
  endDate: string; // Format YYYY-MM-DD
  plan: "standard" | "premium" | "custom";
  durationMonths?: number;
  contactCommercial?: {
    nom?: string;
    telephone?: string;
    email?: string;
  };
  suspendedReason?: string;
  notes?: string;
}

export interface TenantConfig {
  id: string;
  nom: string;
  logoUrl: string;
  invoicePrefix: string;
  currency: string;
  currencySymbol: string;
  nif?: string; // NIF de l'établissement (ex: "À fournir par le client")
  stat?: string; // STAT de l'établissement (ex: "À fournir par le client")
  rcs?: string; // RCS de l'établissement si existant
  adresse?: string; // Adresse physique de l'établissement
  telephone?: string; // Téléphone officiel de l'établissement
  email?: string; // E-mail officiel de facturation
  rib?: string; // Relevé d'identité bancaire pour virement
  mvola?: string; // Numéro MVola (Mobile Money)
  cachetSignatureUrl?: string; // URL de l'image de signature / cachet
  checkInHour: string;
  checkOutHour: string;
  restoSlotDefaultMinutes: number;
  breakfastPrice: number;
  eventRatePerPerson: number;
  subscription?: TenantSubscription;
  theme: {
    primary: string;
    secondary: string;
    gradient: string;
  };
  hebergementTypes: string[];
  hebergementPacks?: HebergementPack[];
  menuCategories: { id: string; label: string; icon?: string }[];
  tableZones: string[];
  stockFamilles: string[];
  stockSousCategories: string[];
  evenementTypes: string[];
  modules: {
    hebergement: boolean;
    restaurant: boolean;
    stock: boolean;
    fichesTechniques: boolean;
    analyseEcarts: boolean;
    iaPredicitions: boolean;
    multiSite: boolean;
    rhPlanningPaie?: boolean;
  };
}

export interface TenantPublicConfig {
  nom: string;
  logoUrl: string;
  nif?: string;
  stat?: string;
  rcs?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  rib?: string;
  mvola?: string;
  cachetSignatureUrl?: string;
  subscription?: TenantSubscription;
  theme: {
    primary: string;
    secondary: string;
    gradient: string;
  };
}

/**
 * Calcul dynamique et sécurisé du statut d'abonnement et du nombre de jours restants
 */
export function getSubscriptionDetails(sub?: TenantSubscription) {
  if (!sub || !sub.endDate) {
    return {
      status: "active" as const,
      daysRemaining: 999,
      isExpired: false,
      isExpiringSoon: false,
      endDateFormatted: "",
      contactCommercial: {
        telephone: "+261 34 00 000 00",
        email: "contact@reshpro.mg",
        nom: "Service Commercial ResiPro",
      },
      suspendedReason: undefined,
    };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(sub.endDate);
  end.setHours(23, 59, 59, 999);

  const diffTime = end.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const isSuspended = sub.status === "suspended";
  const isExpired = isSuspended || daysRemaining < 0;
  const isExpiringSoon = !isExpired && daysRemaining <= 10;

  let calculatedStatus: "active" | "trial" | "expiring_soon" | "expired" | "suspended" = "active";
  if (isSuspended) {
    calculatedStatus = "suspended";
  } else if (isExpired) {
    calculatedStatus = "expired";
  } else if (isExpiringSoon) {
    calculatedStatus = "expiring_soon";
  } else if (sub.status === "trial") {
    calculatedStatus = "trial";
  }

  return {
    status: calculatedStatus,
    daysRemaining: Math.max(0, daysRemaining),
    isExpired,
    isExpiringSoon,
    endDateFormatted: sub.endDate,
    contactCommercial: sub.contactCommercial || {
      telephone: "+261 34 00 000 00",
      email: "contact@reshpro.mg",
      nom: "Service Commercial ResiPro",
    },
    suspendedReason: sub.suspendedReason,
  };
}
