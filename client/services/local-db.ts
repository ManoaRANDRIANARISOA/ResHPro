import {
  Chambre,
  Client,
  Commande,
  Facture,
  MenuItem,
  MouvementStock,
  Reservation,
  StockProduit,
  TableResto,
  Evenement,
  Utilisateur,
} from "@shared/api";
import * as mock from "./mock";

const KEYS = {
  CLIENTS: "nas_clients",
  UTILISATEURS: "nas_utilisateurs",
  USER_AUTH: "nas_user_auth",
  CHAMBRES: "nas_chambres",
  TABLES: "nas_tables",
  MENU: "nas_menu",
  RESERVATIONS: "nas_reservations",
  COMMANDES: "nas_commandes",
  STOCK: "nas_stock",
  FACTURES: "nas_factures",
  EVENTS: "nas_events",
  MAINTENANCE: "nas_chambres_maintenance",
};

class LocalDB {
  private memory: Record<string, any> = {};

  constructor() {
    this.init();
  }

  private init() {
    // 1. Try to load from LocalStorage (Offline Cache)
    const loadFromCache = (key: string, mockData: any) => {
      const cached = localStorage.getItem(key);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          console.warn("Failed to parse cached data for", key, e);
        }
      }
      return mockData; // Fallback to mock.ts if no cache
    };

    // Initialize memory from Cache or Mock
    this.memory[KEYS.CLIENTS] = loadFromCache(KEYS.CLIENTS, [...mock.clients]);
    this.memory[KEYS.UTILISATEURS] = loadFromCache(KEYS.UTILISATEURS, [...mock.utilisateurs]);
    this.memory[KEYS.USER_AUTH] = loadFromCache(KEYS.USER_AUTH, { ...mock.userAuth });
    this.memory[KEYS.CHAMBRES] = loadFromCache(KEYS.CHAMBRES, [...mock.chambres]);
    this.memory[KEYS.TABLES] = loadFromCache(KEYS.TABLES, [...mock.tables]);
    this.memory[KEYS.MENU] = loadFromCache(KEYS.MENU, [...mock.menu]);
    this.memory[KEYS.RESERVATIONS] = loadFromCache(KEYS.RESERVATIONS, [...mock.reservations]);
    this.memory[KEYS.COMMANDES] = loadFromCache(KEYS.COMMANDES, [...mock.commandes]);
    this.memory[KEYS.STOCK] = loadFromCache(KEYS.STOCK, [...mock.stockProduits]);
    this.memory[KEYS.FACTURES] = loadFromCache(KEYS.FACTURES, [...mock.factures]);
    this.memory[KEYS.EVENTS] = loadFromCache(KEYS.EVENTS, [...mock.evenements]);
    this.memory[KEYS.MAINTENANCE] = loadFromCache(KEYS.MAINTENANCE, [...mock.chambresMaintenance]);
    
    // Initial sync of tables
    this.syncTablesWithReservations();
  }

  // Generic Helpers
  get<T>(key: string): T {
    const data = this.memory[key];
    if (data !== undefined) return data as T;
    
    // Default fallback
    if (key === KEYS.USER_AUTH) return {} as unknown as T;
    return [] as unknown as T;
  }

  save(key: string, data: any) {
    this.memory[key] = data;
    // Persist to LocalStorage as "Offline Cache"
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save to offline cache", e);
    }
  }

  // Specialized Getters/Setters
  get clients(): Client[] { return this.get(KEYS.CLIENTS); }
  set clients(v: Client[]) { this.save(KEYS.CLIENTS, v); }

  get utilisateurs(): Utilisateur[] { return this.get(KEYS.UTILISATEURS); }
  set utilisateurs(v: Utilisateur[]) { this.save(KEYS.UTILISATEURS, v); }
  
  get userAuth(): Record<string, string> { return this.get(KEYS.USER_AUTH) || {}; }

  get chambres(): Chambre[] { return this.get(KEYS.CHAMBRES); }
  set chambres(v: Chambre[]) { this.save(KEYS.CHAMBRES, v); }

  get tables(): TableResto[] { 
    // Always sync before returning to ensure status is correct based on reservations
    this.syncTablesWithReservations();
    return this.get(KEYS.TABLES); 
  }
  set tables(v: TableResto[]) { this.save(KEYS.TABLES, v); }

  get menu(): MenuItem[] { return this.get(KEYS.MENU); }
  set menu(v: MenuItem[]) { this.save(KEYS.MENU, v); }

  get reservations(): Reservation[] { return this.get(KEYS.RESERVATIONS); }
  set reservations(v: Reservation[]) { 
    this.save(KEYS.RESERVATIONS, v); 
    this.syncTablesWithReservations();
  }

  get commandes(): Commande[] { return this.get(KEYS.COMMANDES); }
  set commandes(v: Commande[]) { this.save(KEYS.COMMANDES, v); }

  get stockProduits(): StockProduit[] { return this.get(KEYS.STOCK); }
  set stockProduits(v: StockProduit[]) { this.save(KEYS.STOCK, v); }

  get factures(): Facture[] { return this.get(KEYS.FACTURES); }
  set factures(v: Facture[]) { this.save(KEYS.FACTURES, v); }

  get evenements(): Evenement[] { return this.get(KEYS.EVENTS); }
  set evenements(v: Evenement[]) { this.save(KEYS.EVENTS, v); }

  get chambresMaintenance(): any[] { return this.get(KEYS.MAINTENANCE); }
  set chambresMaintenance(v: any[]) { this.save(KEYS.MAINTENANCE, v); }

  // Logic
  private syncTablesWithReservations() {
    const reservations = this.get<Reservation[]>(KEYS.RESERVATIONS);
    const tables = this.get<TableResto[]>(KEYS.TABLES);
    
    let changed = false;
    
    for (const r of reservations) {
      if (r.type === "restaurant" && r.tableId) {
        const t = tables.find((t) => t.id === r.tableId);
        if (t) {
          const oldStatus = t.statut;
          const oldResId = t.assignedReservationId;
          
          t.assignedReservationId = r.id;
          
          if (r.statut === "arrivee") {
            t.statut = "occupee";
          } else if (r.statut === "confirmee" || r.statut === "en_attente") {
            t.statut = "reservee";
          } else if (r.statut === "terminee" || r.statut === "annulee" || r.statut === "no_show") {
            t.statut = "libre";
          } else {
            t.statut = "reservee";
          }
          
          if (oldStatus !== t.statut || oldResId !== t.assignedReservationId) {
            changed = true;
          }
        }
      }
    }
    
    if (changed) {
      this.save(KEYS.TABLES, tables);
    }
  }

  // End of Service Logic
  endOfService(): {
    ventesTotal: number;
    commandes: Commande[];
    mouvement: MouvementStock;
  } {
    const commandes = this.commandes;
    const menu = this.menu;
    
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

  reset() {
    // localStorage.clear(); // No longer needed
    this.init();
    // window.location.reload(); // Might not be needed if state is just reset
  }
}

export const db = new LocalDB();
