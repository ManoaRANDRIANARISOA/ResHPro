export interface TenantConfig {
  id: string;
  nom: string;
  logoUrl: string;
  invoicePrefix: string;
  currency: string;
  currencySymbol: string;
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
  theme: {
    primary: string;
    secondary: string;
    gradient: string;
  };
}
