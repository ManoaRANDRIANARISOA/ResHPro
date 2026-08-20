// Types partagés pour ResiPro (Multi-tenant)

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
  agenceVoyage?: string;
  origine?: string;
}

export interface Chambre {
  id: string;
  numero: string;
  categorie: string;
  capacite: number;
  tarif_base: number;
  statut: "libre" | "occupee" | "maintenance";
  ordre?: number;
}

export interface ChambreMaintenance {
  id: string;
  chambreId: string;
  start: string; // ISO date
  end: string; // ISO date
}

export interface TableResto {
  id: string;
  numero: string;
  capacite: number;
  emplacement?: string;
  statut: "libre" | "reservee" | "occupee";
  assignedReservationId?: string;
}

export interface ChambreMaintenance {
  id: string;
  chambreId: string;
  dateDebut: string; // ISO
  dateFin: string; // ISO
  notes?: string;
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
  packId?: string;
  packNom?: string;
  packPrix?: number;
  packTypeCalcul?: "par_personne_nuit" | "par_chambre_nuit" | "forfait_fixe" | string;
  accompte?: number;
  methodePaiementAccompte?: string;
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

export type { HebergementPack } from "./tenant";

export interface MenuItem {
  id: string;
  categorieId: string;
  nom: string;
  prix: number;
  photoUrl?: string;
  enabled: boolean;
  variants?: { nom: string; priceDelta: number }[];
  ficheTechniqueId?: string;
  coutMatiere?: number;
  margePourcent?: number;
}

export interface Substitution {
  removedProduitId: string;
  addedProduitId: string;
  removedNom: string;
  addedNom: string;
  quantite: number; // Quantité de remplacement à déduire
  unite: string;
}

export interface Commande {
  id: string;
  reservationId: string;
  menuItemId: string;
  quantite: number;
  statut: "saisie" | "envoyee" | "servie" | "annulee";
  motifAnnulation?: string;
  noteSpeciale?: string; // Ajouté pour les changements/concessions
  substitutions?: Substitution[]; // Pour la déduction dynamique de stock
  createdAt: string; // ISO
}

export type FamilleStock = string;
export type SousCategorieStock = string;
export type UniteStock = string;

export interface StockProduit {
  id: string;
  nom: string;
  famille: FamilleStock;
  sousCategorie: SousCategorieStock;
  unite: UniteStock;
  stock: number; // Stock réel (inventaire)
  stockTheorique?: number; // Stock calculé (achats - ventes)
  seuilMin: number;
  photoUrl?: string;
  dailySummary?: any;
  prixUnitaire?: number; // Prix moyen d'achat
  dernierInventaire?: string; // ISO date du dernier inventaire
  pertesJustifiees?: { quantite: number; motif: string; date: string }[];
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
  menuItemId?: string; // Ajouté pour décrémenter le stock
  noteSpeciale?: string; // Pour l'impression
  substitutions?: Substitution[]; // Pour la déduction dynamique de stock lors de la facturation/service
}

export interface Facture {
  id: string;
  numero: string;
  date: string; // ISO
  dueDate?: string; // ISO - échéance
  datePaiement?: string; // ISO - date de règlement
  reservationId?: string;
  clientId?: string;
  clientNom: string;
  clientTelephone?: string;
  clientEmail?: string;
  clientAdresse?: string;
  agenceVoyage?: string; // Nom de l'agence de voyage partenaire si applicable
  source: "Hebergement" | "Restaurant" | "Evenement";
  lignes: FactureLigne[];
  sousTotal?: number; // Total brut avant remise
  remisePourcentage?: number; // Taux de rabais/remise (0 à 10%)
  remiseMontant?: number; // Montant du rabais en Ariary
  totalTTC: number; // Total Net à payer
  accompte?: number; // Acompte payé
  methodePaiementAccompte?: string; // Mode de paiement de l'acompte
  modePaiement?: "especes" | "mobile_money" | "carte" | "virement" | "cheque" | string;
  statut: "emise" | "payee" | "annulee";
  notes?: string;
}

export interface Utilisateur {
  id: string;
  nom: string;
  login: string;
  email?: string;
  role: string;
  statut?: string;
}

export interface Parametres {
  checkInHour: string; // HH:mm
  checkOutHour: string; // HH:mm
  restoSlotDefaultHours: number;
  enableTariffGrids: boolean;
  invoiceNumberFormat: string;
  currency: string;
  invoicePrefix?: string;
  currencySymbol?: string;
  breakfastPrice?: number;
  eventRatePerPerson?: number;
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
  type?: string;
}

// Demo API response used by the starter endpoints
export interface DemoResponse {
  message: string;
}
