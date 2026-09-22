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

export type StayStatus =
  | "en_attente"
  | "confirmee"
  | "arrivee"
  | "terminee"
  | "annulee"
  | "no_show";

export interface Stay {
  id: string; // Ex: "stay_1", "stay_2"
  chambreId: string;
  dateDebut: string; // ISO
  dateFin: string; // ISO
  nuits?: number;
  statut?: StayStatus;
  nbPersonnes?: number;
  tarifBase?: number;
  packId?: string;
  packNom?: string;
  packPrix?: number;
  packTypeCalcul?: "par_personne_nuit" | "par_chambre_nuit" | "forfait_fixe" | string;
  invoiceId?: string; // ID de la proforma ou facture liée
  notes?: string;
}

export interface ReservationChambreDetail {
  chambreId: string;
  dateDebut: string; // ISO
  dateFin: string; // ISO
  nuits?: number;
  tarifBase?: number;
}

export interface Reservation {
  id: string;
  type: "hebergement" | "restaurant" | "evenement";
  clientId?: string;
  chambreId?: string;
  chambreIds?: string[];
  chambresDetails?: ReservationChambreDetail[];
  stays?: Stay[]; // Liste des séjours rattachés au dossier
  tableId?: string;
  tableIds?: string[];
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

export type { HebergementPack, HebergementTaxe } from "./tenant";

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
  id?: string;
  stayId?: string; // ID du séjour rattaché (traçabilité multi-séjours)
  stayPeriodText?: string; // Ex: "Séjour du 10/10/2026 au 12/10/2026 — Ch. 101"
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
  typeDocument?: "facture" | "proforma" | "devis";
  date: string; // ISO
  dueDate?: string; // ISO - échéance
  datePaiement?: string; // ISO - date de règlement
  reservationId?: string; // Réservation principale (historique)
  reservationIds?: string[]; // IDs des réservations liées
  stayIds?: string[]; // IDs des séjours regroupés sur cette facture
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

// Session d'un événement multi-jours ou dates séparées
export interface EvenementSession {
  id: string;
  date: string; // yyyy-MM-dd
  heures: string; // HH:mm–HH:mm
  nb?: number; // Couverts attendus pour cette séance
  notes?: string;
}

// Événement (avec support multi-jours et tarif manuel)
export interface Evenement {
  id: string;
  nom: string;
  date: string; // yyyy-MM-dd (date principale ou première séance)
  heures: string; // HH:mm–HH:mm
  nb: number; // couverts attendus totaux (informatif)
  contact: string;
  sessions?: EvenementSession[]; // Séances multiples ou dates séparées
  montantTotal?: number; // Montant global convenu avec le client (saisi manuellement par l'établissement)
  factureId?: string; // Facture ou proforma liée
  notes?: string;
  statut?: "planifie" | "confirme" | "annule";
  type?: string;
}

/**
 * Retourne la liste des séjours d'une réservation avec repli transparent pour les réservations historiques
 */
export function getReservationStays(r: Reservation): Stay[] {
  if (r.stays && r.stays.length > 0) return r.stays;
  if (r.chambresDetails && r.chambresDetails.length > 0) {
    return r.chambresDetails.map((cd, idx) => ({
      id: `${r.id}_cd_${idx}`,
      chambreId: cd.chambreId,
      dateDebut: cd.dateDebut,
      dateFin: cd.dateFin,
      nuits: cd.nuits,
      tarifBase: cd.tarifBase,
      statut: r.statut,
      nbPersonnes: r.nbPersonnes || 1,
      packId: r.packId,
      packNom: r.packNom,
      packPrix: r.packPrix,
      packTypeCalcul: r.packTypeCalcul,
    }));
  }
  const defaultChambreId = (r.chambreIds && r.chambreIds[0]) || r.chambreId || "";
  const sStart = new Date(r.dateDebut);
  const sEnd = r.dateFin ? new Date(r.dateFin) : new Date(sStart.getTime() + 86400000);
  const diffTime = sEnd.getTime() - sStart.getTime();
  const calculatedNights = Math.max(1, Math.round(diffTime / 86400000));

  return [
    {
      id: `${r.id}_s0`,
      chambreId: defaultChambreId,
      dateDebut: r.dateDebut,
      dateFin: r.dateFin || sEnd.toISOString(),
      nuits: calculatedNights,
      statut: r.statut,
      nbPersonnes: r.nbPersonnes || 1,
      packId: r.packId,
      packNom: r.packNom,
      packPrix: r.packPrix,
      packTypeCalcul: r.packTypeCalcul,
    },
  ];
}

/**
 * Détermine si un document de facturation est une proforma ou un devis (non comptabilisé en caisse officielle)
 */
export function isProformaDocument(f?: Pick<Facture, "typeDocument"> | null): boolean {
  return f?.typeDocument === "proforma" || f?.typeDocument === "devis";
}

// Demo API response used by the starter endpoints
export interface DemoResponse {
  message: string;
}

// ==========================================
// MODULE RESSOURCES HUMAINES & GESTION PAIE
// ==========================================

export type DepartementPersonnel =
  | "hebergement"
  | "restaurant"
  | "cuisine"
  | "bar"
  | "reception"
  | "economat"
  | "direction"
  | "technique"
  | "autre";

export type TypeContrat = "CDI" | "CDD" | "Extra" | "Saisonnier" | "Stage";

export type TypeShift =
  | "travail"
  | "coupure"
  | "repos"
  | "conge_paye"
  | "conge_maladie"
  | "absence_justifiee"
  | "absence_injustifiee"
  | "recuperation"
  | "formation";

export type ModePaiementSalaire = "especes" | "mobile_money" | "virement" | "cheque";

export interface Employe {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  departement: DepartementPersonnel;
  poste: string;
  typeContrat: TypeContrat;
  dateEmbauche: string; // YYYY-MM-DD
  dateFinContrat?: string; // YYYY-MM-DD
  statut: "actif" | "conge" | "inactif";
  telephone: string;
  email?: string;
  cin?: string;
  adresse?: string;
  salaireBase: number; // Ariary mensuel
  tauxHoraire?: number; // Ariary par heure
  modePaiement: ModePaiementSalaire;
  coordonneesPaiement?: {
    fournisseurMobile?: "MVola" | "Orange Money" | "Airtel Money" | string;
    numeroMobile?: string;
    banque?: string;
    rib?: string;
  };
  // Cotisations et options flexibles
  assujettiCnaps: boolean;
  tauxCnapsSalarial?: number; // ex: 1%
  cnapsNumber?: string;
  assujettiOstie: boolean;
  tauxOstieSalarial?: number; // ex: 1%
  ostieNumber?: string;
  assujettiIrsa: boolean;
  nbEnfantsCharge?: number;
  userId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlanningShift {
  id: string;
  employeId: string;
  employeNom: string;
  departement: DepartementPersonnel;
  date: string; // YYYY-MM-DD
  heureDebut: string; // HH:mm
  heureFin: string; // HH:mm
  pauseMinutes?: number;
  type: TypeShift;
  posteAffecte?: string; // Ex: "Service Terrasse Midi", "Chambres Étage 1", "Plonge & Cuisine Chaud"
  tache?: string; // Instructions ou tâches spécifiques
  notes?: string;
  statut: "planifie" | "confirme" | "effectue" | "absent" | "retard";
  createdAt?: string;
  updatedAt?: string;
}

export interface PointagePresence {
  id: string;
  employeId: string;
  employeNom: string;
  date: string; // YYYY-MM-DD
  heureArriveeReelle?: string; // HH:mm
  heureDepartReelle?: string; // HH:mm
  heuresNormales: number;
  heuresSup: number;
  retardMinutes?: number;
  statut: "present" | "retard" | "absent_justifie" | "absent_injustifie" | "en_conge" | "repos";
  validePar?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AvanceSalaire {
  id: string;
  employeId: string;
  employeNom: string;
  moisConcerne: string; // YYYY-MM
  dateDemande: string; // YYYY-MM-DD
  dateVersement?: string; // YYYY-MM-DD
  montant: number; // Ariary
  motif: string;
  statut: "en_attente" | "approuve" | "deduit" | "refuse";
  modeVersement: ModePaiementSalaire;
  referencePaiement?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PrimeItem {
  id: string;
  nom: string;
  montant: number;
  type: "fixe" | "variable";
}

export interface CotisationItem {
  nom: string;
  base: number;
  taux: number;
  montant: number;
}

export interface BulletinPaie {
  id: string;
  numero: string; // ex: "PAY-2026-08-001"
  employeId: string;
  employeNom: string;
  employeMatricule: string;
  poste: string;
  departement: DepartementPersonnel;
  periode: string; // YYYY-MM
  dateEmission: string; // ISO
  datePaiement?: string; // ISO
  heuresNormales: number;
  heuresSup25: number;
  heuresSup50: number;
  heuresSup100: number;
  salaireBase: number;
  montantHeuresSup: number;
  primes: PrimeItem[];
  totalPrimes: number;
  avantagesEnNature: number;
  salaireBrut: number;
  cotisationsSalariales: CotisationItem[];
  totalCotisationsSalariales: number;
  irsa: number;
  avancesDeduites: number;
  retenuesAbsences: number;
  autresRetenues: number;
  totalRetenues: number;
  salaireNet: number;
  modePaiement: ModePaiementSalaire;
  detailsPaiement?: string;
  statut: "brouillon" | "valide" | "paye";
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

