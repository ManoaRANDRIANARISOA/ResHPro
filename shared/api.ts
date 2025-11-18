// Types partagés pour NAS CONNECT

export interface Client {
  id: string;
  nom: string;
  telephone: string;
  email?: string;
  adresse?: string;
  pays?: string;
  type?: string;
  tags?: string;
  reference?: string;
  preferences_alimentaires?: string;
}

export interface Chambre {
  id: string;
  numero: string;
  categorie: "standard" | "suite" | "familiale";
  capacite: number;
  tarif_base: number;
  statut: "libre" | "occupee" | "maintenance";
}

export interface TableResto {
  id: string;
  numero: string;
  capacite: number;
  emplacement?: string;
  statut: "libre" | "reservee" | "occupee";
  assignedReservationId?: string;
}

export interface Reservation {
  id: string;
  type: "hebergement" | "restaurant" | "evenement";
  clientId?: string;
  chambreId?: string;
  tableId?: string;
  dateDebut: string; // ISO
  dateFin?: string; // ISO
  heure?: string; // HH:mm (heures pleines)
  heureDebut?: string; // HH:mm (avec minutes précises pour le planning dynamique)
  heureArrivee?: string; // HH:mm (heure réelle d'arrivée du client)
  heureDepart?: string; // HH:mm (heure réelle de départ du client)
  duree?: number; // durée en minutes (par défaut 60)
  nbPersonnes?: number;
  statut:
    | "en_attente"
    | "confirmee"
    | "arrivee"
    | "terminee"
    | "annulee"
    | "no_show";
  gracePeriodMinutes: number;
  notes?: string;
}

export interface MenuItem {
  id: string;
  categorieId: string;
  nom: string;
  prix: number;
  photoUrl?: string;
  enabled: boolean;
  variants?: { nom: string; priceDelta: number }[];
}

export interface Commande {
  id: string;
  reservationId: string;
  menuItemId: string;
  quantite: number;
  statut: "saisie" | "envoyee" | "servie" | "annulee";
  motifAnnulation?: string;
  createdAt: string; // ISO
}

export type FamilleStock = "Hebergement" | "Restaurant";
export type SousCategorieStock =
  | "linge_lit"
  | "linge_salle"
  | "cuisine"
  | "petit_dejeuner"
  | "entretien";
export type UniteStock = "u" | "kg" | "L" | "paquet";

export interface StockProduit {
  id: string;
  nom: string;
  famille: FamilleStock;
  sousCategorie: SousCategorieStock;
  unite: UniteStock;
  stock: number;
  seuilMin: number;
  photoUrl?: string;
  dailySummary?: any;
}

export interface MouvementStock {
  id: string;
  produitId: string;
  type: "Achat" | "Consommation" | "Ajustement";
  quantite: number;
  note?: string;
  createdAt: string; // ISO
  userId?: string;
}

export interface FactureLigne {
  description: string;
  qte: number;
  pu: number;
}
export interface Facture {
  id: string;
  numero: string;
  date: string; // ISO
  clientNom: string;
  source: "Hebergement" | "Restaurant" | "Evenement";
  lignes: FactureLigne[];
  totalTTC: number;
  statut: "emise" | "payee" | "annulee";
}

export interface Utilisateur {
  id: string;
  nom: string;
  login: string;
  role: string;
}

export interface Parametres {
  checkInHour: string; // HH:mm
  checkOutHour: string; // HH:mm
  restoSlotDefaultHours: number;
  enableTariffGrids: boolean;
  invoiceNumberFormat: "NAS-YYYY-####";
  currency: "MGA";
}

// Événement (fiche minimale)
export interface Evenement {
  id: string;
  nom: string;
  date: string; // yyyy-MM-dd
  heures: string; // HH:mm–HH:mm
  nb: number; // couverts attendus
  contact: string;
  notes?: string;
  statut?: "planifie" | "confirme" | "annule";
  type?:
    | "musique"
    | "degustation"
    | "anniversaire"
    | "conference"
    | "mariage"
    | "autre";
}

// Demo API response used by the starter endpoints
export interface DemoResponse {
  message: string;
}
