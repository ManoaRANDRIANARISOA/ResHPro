import {
  addDays,
  addHours,
  format,
  startOfMonth,
  startOfToday,
} from "date-fns";
import {
  Chambre,
  ChambreMaintenance,
  Client,
  Commande,
  Evenement,
  Facture,
  MenuItem,
  MouvementStock,
  Reservation,
  StockProduit,
  TableResto,
  Utilisateur,
  Parametres,
} from "@shared/api";

// ==================================================================================
// INITIAL SEED DATA (READ ONLY)
// ==================================================================================
// This file serves as the "Factory Default" state.
// It is used ONLY when:
// 1. The application starts for the very first time (empty localStorage).
// 2. AND there is no connection to Firebase (or Firebase is empty).
//
// Once the app is running, data is read/written to LocalStorage (Offline) and Firebase (Online).
// This file should NOT be modified by the application at runtime.
// ==================================================================================

export const clients: Client[] = [];

// Comptes utilisateurs (mock) — utilisés pour l’auth et l’admin
export const utilisateurs: Utilisateur[] = [
  { id: "u-admin", nom: "Administrateur", login: "admin@okalodge.local", role: "admin" },
  { id: "u-reception", nom: "Réception", login: "reception@okalodge.local", role: "responsable hebergement" },
  { id: "u-chef", nom: "Chef de salle", login: "chef.salle@okalodge.local", role: "responsable restaurant" },
  { id: "u-serveur", nom: "Serveur", login: "serveur@okalodge.local", role: "saff_restaurant" },
  { id: "u-cuisine", nom: "Cuisine", login: "cuisine@okalodge.local", role: "staff_restaurant" },
  { id: "u-bar", nom: "Bar", login: "bar@okalodge.local", role: "staff_restaurant" },
  { id: "u-comptoir", nom: "Comptoir", login: "comptoir@okalodge.local", role: "staff_restaurant" },
  { id: "u-economat", nom: "Économat", login: "economat@okalodge.local", role: "economat" },
  { id: "u-comptable", nom: "Comptable", login: "comptable@okalodge.local", role: "comptable" },
  { id: "u-direction", nom: "Direction", login: "direction@okalodge.local", role: "admin" },
];

// Secrets mock (plaintext, uniquement pour démo) — login -> password
export const userAuth: Record<string, string> = {
  "admin@okalodge.local": "okalodge2025",
  "reception@okalodge.local": "okalodge2025",
  "chef.salle@okalodge.local": "okalodge2025",
  "serveur@okalodge.local": "okalodge2025",
  "cuisine@okalodge.local": "okalodge2025",
  "bar@okalodge.local": "okalodge2025",
  "comptoir@okalodge.local": "okalodge2025",
  "economat@okalodge.local": "okalodge2025",
  "comptable@okalodge.local": "okalodge2025",
  "direction@okalodge.local": "okalodge2025",
};

export const chambres: Chambre[] = [];

export const tables: TableResto[] = Array.from({ length: 12 }).map((_, i) => {
  const numero = i + 1;
  // Ajusté pour correspondre au cahier des charges: 43 couverts au total
  const caps = [2, 4, 4, 6, 2, 6, 3, 4, 2, 4, 2, 4];
  const zones = ["Intérieur", "Terrasse"] as const;
  return {
    id: `t${numero}`,
    numero: `T${numero}`,
    capacite: caps[i] ?? 4,
    emplacement: zones[i % 2],
    // Initialiser toutes les tables comme libres, elles seront mises à jour avec les réservations
    statut: "libre",
  };
});

export const menu: MenuItem[] = [];

export const reservations: Reservation[] = [];

// Sync tables with assigned reservations
for (const r of reservations) {
  if (r.type === "restaurant" && r.tableId) {
    const t = tables.find((t) => t.id === r.tableId);
    if (t) {
      t.assignedReservationId = r.id;
      // Mapper les statuts vers les statuts de table appropriés
      if (r.statut === "arrivee") {
        t.statut = "occupee";
      } else if (r.statut === "confirmee" || r.statut === "en_attente") {
        t.statut = "reservee";
      } else if (r.statut === "terminee" || r.statut === "annulee" || r.statut === "no_show") {
        t.statut = "libre";
      } else {
        t.statut = "reservee";
      }
    }
  }
}

export const commandes: Commande[] = [];

export const stockProduits: StockProduit[] = [];

export const factures: Facture[] = [];

// Périodes de maintenance des chambres (hors service)
export const chambresMaintenance: ChambreMaintenance[] = [];

export const parametres: Parametres = {
  checkInHour: "14:00",
  checkOutHour: "11:00",
  restoSlotDefaultHours: 1.5,
  enableTariffGrids: false,
  invoiceNumberFormat: "OKA-YYYY-####",
  currency: "MGA",
};

export const evenements: Evenement[] = [];

export function endOfService(): {
  ventesTotal: number;
  commandes: Commande[];
  mouvement: MouvementStock;
} {
  const ventesTotal = commandes.reduce(
    (acc, c) =>
      acc + c.quantite * (menu.find((m) => m.id === c.menuItemId)?.prix ?? 0),
    0,
  );
  const mouvement: MouvementStock = {
    id: `ms-${Date.now()}`,
    produitId: "_aggregat",
    type: "Consommation",
    quantite: ventesTotal,
    note: "Fin de service - agrégat",
    createdAt: new Date().toISOString(),
  };
  return { ventesTotal, commandes, mouvement };
}
