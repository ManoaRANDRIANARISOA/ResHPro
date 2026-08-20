export interface HebergementPack {
  id: string;
  nom: string;
  description?: string;
  typeCalcul: "par_personne_nuit" | "par_chambre_nuit" | "forfait_fixe";
  prix: number; // Prix en Ariary (Ar)
  isDefault?: boolean;
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
  theme: {
    primary: string;
    secondary: string;
    gradient: string;
  };
}
