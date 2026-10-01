export interface HebergementPack {
  id: string;
  nom: string;
  description?: string;
  typeCalcul: "par_personne_nuit" | "par_chambre_nuit" | "forfait_fixe";
  prix: number; // Prix en Ariary (Ar)
  isDefault?: boolean;
}

export interface HebergementTaxe {
  id: string;
  nom: string;
  description?: string;
  typeCalcul: "fixe" | "par_nuitee" | "par_chambre_nuitee" | "par_personne_nuitee";
  montant: number; // Prix en Ariary (Ar)
  actif: boolean;
}

export const DEFAULT_HEBERGEMENT_TAXES: HebergementTaxe[] = [
  {
    id: "taxe_communale",
    nom: "Taxe Communale",
    description: "Taxe communale forfaitaire par séjour.",
    typeCalcul: "fixe",
    montant: 4000,
    actif: true,
  },
  {
    id: "vignette_touristique",
    nom: "Vignette Touristique",
    description: "Vignette touristique par nuitée de séjour.",
    typeCalcul: "par_nuitee",
    montant: 5000,
    actif: true,
  },
];

export const GRACE_PERIOD_DAYS = 5;

export interface TenantSubscription {
  status: "active" | "trial" | "expiring_soon" | "grace_period" | "expired" | "suspended";
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
  nomCompte?: string; // Nom du titulaire du compte bancaire (ex: SARL HOTEL ...)
  mvola?: string; // Numéro MVola (Mobile Money)
  nomCompteMvola?: string; // Nom du titulaire / compte MVola (ex: RAHANTAMALALA VERONIQUE Elisette ou OKA LODGE)
  ordreReglement?: "mvola_first" | "rib_first"; // Ordre d'affichage des conditions de règlement (défaut: "mvola_first")
  conditionsReglementNotes?: string; // Mention personnalisée additionnelle pour les conditions de règlement
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
  hebergementTaxes?: HebergementTaxe[];
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
  nomCompte?: string;
  mvola?: string;
  nomCompteMvola?: string;
  ordreReglement?: "mvola_first" | "rib_first";
  conditionsReglementNotes?: string;
  cachetSignatureUrl?: string;
  subscription?: TenantSubscription;
  theme: {
    primary: string;
    secondary: string;
    gradient: string;
  };
}

/**
 * Calcul dynamique et sécurisé du statut d'abonnement, période de grâce et jours restants
 */
export function getSubscriptionDetails(sub?: TenantSubscription) {
  const defaultCommercial = {
    telephone: "034 71 517 89",
    email: "commercial@reshpro.mg",
    nom: "Service Commercial ResiPro",
  };

  if (!sub || !sub.endDate) {
    return {
      status: "active" as const,
      daysRemaining: 999,
      isExpired: false,
      isExpiringSoon: false,
      isGracePeriod: false,
      graceDaysRemaining: 0,
      isBlocked: false,
      endDateFormatted: "",
      contactCommercial: defaultCommercial,
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
  const isPastEndDate = daysRemaining < 0;

  // Période de grâce B2B : 5 jours après l'échéance sans couper le service opérationnel
  const isGracePeriod = !isSuspended && isPastEndDate && Math.abs(daysRemaining) <= GRACE_PERIOD_DAYS;
  const graceDaysRemaining = isGracePeriod ? Math.max(0, GRACE_PERIOD_DAYS - Math.abs(daysRemaining) + 1) : 0;

  // Blocage d'accès effectif (ferme) : suspension manuelle ou dépassement total de la période de grâce
  const isBlocked = isSuspended || (isPastEndDate && !isGracePeriod);
  const isExpired = isPastEndDate;
  const isExpiringSoon = !isPastEndDate && daysRemaining <= 10;

  let calculatedStatus: "active" | "trial" | "expiring_soon" | "grace_period" | "expired" | "suspended" = "active";
  if (isSuspended) {
    calculatedStatus = "suspended";
  } else if (isBlocked) {
    calculatedStatus = "expired";
  } else if (isGracePeriod) {
    calculatedStatus = "grace_period";
  } else if (isExpiringSoon) {
    calculatedStatus = "expiring_soon";
  } else if (sub.status === "trial") {
    calculatedStatus = "trial";
  }

  // Si le numéro en base est le numéro temporaire (00 000 00) ou vide, utiliser le vrai numéro officiel
  const commercialTel =
    sub.contactCommercial?.telephone && !sub.contactCommercial.telephone.includes("00 000 00")
      ? sub.contactCommercial.telephone
      : "034 71 517 89";

  return {
    status: calculatedStatus,
    daysRemaining: Math.max(0, daysRemaining),
    isExpired,
    isExpiringSoon,
    isGracePeriod,
    graceDaysRemaining,
    isBlocked,
    endDateFormatted: sub.endDate,
    contactCommercial: {
      telephone: commercialTel,
      email: sub.contactCommercial?.email || "commercial@reshpro.mg",
      nom: sub.contactCommercial?.nom || "Service Commercial ResiPro",
    },
    suspendedReason: sub.suspendedReason,
  };
}
