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

export const clients: Client[] = [
  {
    id: "c1",
    nom: "Rabe Andry",
    telephone: "032 11 111 11",
    email: "rabe.andry@gmail.com",
    adresse: "Lot II A 34 Antananarivo",
    pays: "Madagascar",
    type: "Particulier",
    tags: "VIP, Régulier",
    reference: "CLI-00842",
  },
  {
    id: "c2",
    nom: "Hanitra Solo",
    telephone: "033 22 222 22",
    email: "hanitra.solo@yahoo.fr",
    adresse: "67 Avenue de l'Indépendance, Tana",
    pays: "Madagascar",
    type: "Particulier",
    tags: "Direct",
    reference: "CLI-00915",
  },
  {
    id: "c3",
    nom: "Rakoto Jean",
    telephone: "034 55 666 77",
    email: "j.rakoto@outlook.com",
    adresse: "Immeuble Tana Water Front, Ankorondrano",
    pays: "Madagascar",
    type: "Société",
    tags: "Entreprise, VIP",
    reference: "CLI-01024",
  },
  {
    id: "c4",
    nom: "Marie Rasoanaivo",
    telephone: "032 88 999 00",
    email: "marie.raso@hotmail.com",
    adresse: "Villa 12B Ivandry",
    pays: "Madagascar",
    type: "Particulier",
    tags: "Régulier",
    reference: "CLI-00567",
  },
  {
    id: "c5",
    nom: "Ravalomanana Hery",
    telephone: "033 44 555 66",
    email: "hery.ravalo@gmail.com",
    adresse: "Lot VB 45 Ambohijatovo",
    pays: "Madagascar",
    type: "Particulier",
    tags: "Direct",
    reference: "CLI-01156",
  },
  {
    id: "c6",
    nom: "Société SARL TIKO",
    telephone: "020 22 333 44",
    email: "contact@tiko.mg",
    adresse: "Zone Industrielle Forello, Tana",
    pays: "Madagascar",
    type: "Société",
    tags: "Entreprise, Contrat annuel",
    reference: "CLI-00234",
  },
];

// Comptes utilisateurs (mock) — utilisés pour l’auth et l’admin
export const utilisateurs: Utilisateur[] = [
  { id: "u-admin", nom: "Administrateur", login: "admin@nas.local", role: "admin" },
  { id: "u-reception", nom: "Réception", login: "reception@nas.local", role: "responsable hebergement" },
  { id: "u-chef", nom: "Chef de salle", login: "chef.salle@nas.local", role: "responsable restaurant" },
  { id: "u-serveur", nom: "Serveur", login: "serveur@nas.local", role: "saff_restaurant" },
  { id: "u-cuisine", nom: "Cuisine", login: "cuisine@nas.local", role: "staff_restaurant" },
  { id: "u-bar", nom: "Bar", login: "bar@nas.local", role: "staff_restaurant" },
  { id: "u-comptoir", nom: "Comptoir", login: "comptoir@nas.local", role: "staff_restaurant" },
  { id: "u-economat", nom: "Économat", login: "economat@nas.local", role: "economat" },
  { id: "u-comptable", nom: "Comptable", login: "comptable@nas.local", role: "comptable" },
  { id: "u-direction", nom: "Direction", login: "direction@nas.local", role: "admin" },
];

// Secrets mock (plaintext, uniquement pour démo) — login -> password
export const userAuth: Record<string, string> = {
  "admin@nas.local": "nas2025",
  "reception@nas.local": "nas2025",
  "chef.salle@nas.local": "nas2025",
  "serveur@nas.local": "nas2025",
  "cuisine@nas.local": "nas2025",
  "bar@nas.local": "nas2025",
  "comptoir@nas.local": "nas2025",
  "economat@nas.local": "nas2025",
  "comptable@nas.local": "nas2025",
  "direction@nas.local": "nas2025",
};

export const chambres: Chambre[] = [
  {
    id: "ch1",
    numero: "CH-1",
    categorie: "standard",
    capacite: 2,
    tarif_base: 80000,
    statut: "libre",
  },
  {
    id: "ch2",
    numero: "CH-2",
    categorie: "suite",
    capacite: 3,
    tarif_base: 150000,
    statut: "libre",
  },
  {
    id: "ch3",
    numero: "CH-3",
    categorie: "familiale",
    capacite: 4,
    tarif_base: 120000,
    statut: "maintenance",
  },
  {
    id: "ch4",
    numero: "CH-4",
    categorie: "standard",
    capacite: 2,
    tarif_base: 80000,
    statut: "occupee",
  },
];

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

export const menu: MenuItem[] = [
  { id: "m1", categorieId: "plats", nom: "Ravitoto", prix: 12000, enabled: true, photoUrl: "https://i.pinimg.com/1200x/0a/29/af/0a29afa27e98cf15cd4f1c0bc486599b.jpg" },
  { id: "m2", categorieId: "plats", nom: "Romazava", prix: 14000, enabled: true, photoUrl: "https://i.pinimg.com/1200x/d4/3f/2e/d43f2ede268ba463a675b6d0c0f99877.jpg" },
  { id: "m3", categorieId: "plats", nom: "Poulet coco", prix: 16000, enabled: false, photoUrl: "https://i.pinimg.com/1200x/27/fb/30/27fb30b61472a6cc47d1e874fa7961d8.jpg" },
  { id: "m4", categorieId: "plats", nom: "Tagliatelle", prix: 18000, enabled: true, photoUrl: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=640&q=80&auto=format" },
  { id: "m5", categorieId: "plats", nom: "Zébu roti", prix: 20000, enabled: true, photoUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=640&q=80&auto=format" },
  { id: "m6", categorieId: "entrees", nom: "Sambos", prix: 8000, enabled: false, photoUrl: "https://i.pinimg.com/1200x/4a/d0/dc/4ad0dc5e6f49cad821feab9b021c9f5d.jpg" },
  { id: "m7", categorieId: "entrees", nom: "Salade", prix: 6000, enabled: true, photoUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=640&q=80&auto=format" },
  { id: "m8", categorieId: "entrees", nom: "Soupe légume", prix: 7000, enabled: true, photoUrl: "https://i.pinimg.com/1200x/c2/b4/14/c2b414edb9e168a28a3fb89c2fd60742.jpg" },
  { id: "m9", categorieId: "boissons", nom: "Smoothie", prix: 3000, enabled: false, photoUrl: "https://i.pinimg.com/1200x/13/31/87/133187688edddd1157da263a05ce05df.jpg" },
  { id: "m10", categorieId: "boissons", nom: "Café", prix: 2500, enabled: true, photoUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=640&q=80&auto=format" },
  { id: "m11", categorieId: "boissons", nom: "Thé glacé", prix: 4000, enabled: true, photoUrl: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=640&q=80&auto=format" },
  { id: "m12", categorieId: "desserts", nom: "Koba", prix: 5000, enabled: true, photoUrl: "https://i.pinimg.com/736x/7c/eb/48/7ceb4886d392a715eda5f8d782dd9084.jpg" },
  { id: "m13", categorieId: "desserts", nom: "Mofo gasy", prix: 3500, enabled: true, photoUrl: "https://i.pinimg.com/1200x/02/05/b9/0205b9f59c5ebb3f494430a95adf1b52.jpg" },
  { id: "m14", categorieId: "desserts", nom: "Mousse au chocolat", prix: 6000, enabled: true, photoUrl: "https://i.pinimg.com/736x/4e/77/75/4e7775d548b5954bafe04b7c5ef8e190.jpg" },
];

export const reservations: Reservation[] = [
  // Réservations restaurant - DONNEES DYNAMIQUES basées sur l'heure actuelle (11:20)
  
  // Réservation PASSÉE (terminée) - 9:15 (durée 60min, terminée à 10:15)
  {
    id: "r_passee",
    type: "restaurant",
    clientId: clients[0].id, // Rabe Andry
    tableId: "t1",
    dateDebut: addHours(startOfToday(), 9).toISOString(),
    heure: "09:15",
    heureDebut: "09:15",
    duree: 60,
    nbPersonnes: 2,
    statut: "confirmee",
    gracePeriodMinutes: 15,
  },
  
  // Réservation EN COURS (occupé) - 10:30 (durée 90min, fin prévue 12:00, client arrivé)
  {
    id: "r_encours",
    type: "restaurant",
    clientId: clients[1].id, // Hanitra Solo
    tableId: "t2",
    dateDebut: addHours(startOfToday(), 10).toISOString(),
    heure: "10:30",
    heureDebut: "10:30",
    duree: 90,
    nbPersonnes: 3,
    statut: "confirmee",
    gracePeriodMinutes: 15,
  },
  
  // Réservation EN RETARD (dépassement) - 9:00 (durée 60min, fin prévue 10:00, client arrivé mais pas parti)
  {
    id: "r_retard",
    type: "restaurant",
    clientId: clients[2].id, // Rakoto Jean
    tableId: "t3",
    dateDebut: addHours(startOfToday(), 9).toISOString(),
    heure: "09:00",
    heureDebut: "09:00",
    duree: 60,
    nbPersonnes: 4,
    statut: "confirmee",
    gracePeriodMinutes: 15,
  },
  
  // Réservation FUTURE (réservé) - 12:15 (durée 75min, début dans 1h)
  {
    id: "r_future1",
    type: "restaurant",
    clientId: clients[3].id, // Marie Rasoanaivo
    tableId: "t4",
    dateDebut: addHours(startOfToday(), 12).toISOString(),
    heure: "12:15",
    heureDebut: "12:15",
    // Pas d'arrivée ni départ
    duree: 75,
    nbPersonnes: 2,
    statut: "confirmee",
    gracePeriodMinutes: 15,
  },
  
  // Réservation FUTURE avec arrivée en avance - 13:00 (durée 60min, client va arriver en avance)
  {
    id: "r_future_avance",
    type: "restaurant",
    clientId: clients[4].id, // Ravalomanana Hery
    tableId: "t5",
    dateDebut: addHours(startOfToday(), 13).toISOString(),
    heure: "13:00",
    heureDebut: "13:00",
    // Pas d'arrivée encore - mais quand il arrivera, ce sera en avance
    duree: 60,
    nbPersonnes: 2,
    statut: "confirmee",
    gracePeriodMinutes: 15,
  },
  
  // Réservation SOIR (réservé) - 19:30 (durée 120min)
  {
    id: "r_soir",
    type: "restaurant",
    clientId: clients[5].id, // SARL TIKO
    tableId: "t6",
    dateDebut: addHours(startOfToday(), 19).toISOString(),
    heure: "19:30",
    heureDebut: "19:30",
    duree: 120,
    nbPersonnes: 6,
    statut: "confirmee",
    gracePeriodMinutes: 15,
  },
  
  // Réservation ANNULÉE
  {
    id: "r_annulee",
    type: "restaurant",
    clientId: clients[0].id, // Rabe Andry
    tableId: "t7",
    dateDebut: addHours(startOfToday(), 14).toISOString(),
    heure: "14:00",
    heureDebut: "14:00",
    duree: 90,
    nbPersonnes: 2,
    statut: "annulee",
    gracePeriodMinutes: 15,
  },
  
  // Réservations hébergement - variété de statuts et dates
  {
    id: "h1",
    type: "hebergement",
    clientId: clients[1].id,
    chambreId: chambres[1].id,
    dateDebut: addDays(startOfToday(), 1).toISOString(),
    dateFin: addDays(startOfToday(), 3).toISOString(),
    statut: "confirmee",
    gracePeriodMinutes: 0,
  },
  {
    id: "h2",
    type: "hebergement",
    clientId: clients[0].id,
    chambreId: chambres[0].id,
    dateDebut: addDays(startOfToday(), -2).toISOString(),
    dateFin: addDays(startOfToday(), 2).toISOString(),
    statut: "arrivee",
    gracePeriodMinutes: 0,
  },
  {
    id: "h3",
    type: "hebergement",
    clientId: clients[1].id,
    chambreId: chambres[3].id,
    dateDebut: addDays(startOfToday(), 5).toISOString(),
    dateFin: addDays(startOfToday(), 8).toISOString(),
    statut: "confirmee",
    gracePeriodMinutes: 0,
  },
  {
    id: "h4",
    type: "hebergement",
    clientId: clients[0].id,
    chambreId: chambres[1].id,
    dateDebut: addDays(startOfToday(), 10).toISOString(),
    dateFin: addDays(startOfToday(), 12).toISOString(),
    statut: "en_attente",
    gracePeriodMinutes: 0,
  },
  {
    id: "h5",
    type: "hebergement",
    clientId: clients[1].id,
    chambreId: chambres[0].id,
    dateDebut: addDays(startOfToday(), 15).toISOString(),
    dateFin: addDays(startOfToday(), 20).toISOString(),
    statut: "confirmee",
    gracePeriodMinutes: 0,
  },
  {
    id: "h6",
    type: "hebergement",
    clientId: clients[0].id,
    chambreId: chambres[3].id,
    dateDebut: addDays(startOfToday(), 18).toISOString(),
    dateFin: addDays(startOfToday(), 21).toISOString(),
    statut: "confirmee",
    gracePeriodMinutes: 0,
  },
  {
    id: "h7",
    type: "hebergement",
    clientId: clients[1].id,
    chambreId: chambres[1].id,
    dateDebut: addDays(startOfToday(), 22).toISOString(),
    dateFin: addDays(startOfToday(), 25).toISOString(),
    statut: "arrivee",
    gracePeriodMinutes: 0,
  },
];

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

export const commandes: Commande[] = [
  {
    id: "o1",
    reservationId: "r1",
    menuItemId: menu[0].id,
    quantite: 2,
    statut: "envoyee",
    createdAt: new Date().toISOString(),
  },
  {
    id: "o2",
    reservationId: "r1",
    menuItemId: menu[1].id,
    quantite: 1,
    statut: "servie",
    createdAt: new Date().toISOString(),
  },
];

export const stockProduits: StockProduit[] = [
  {
    "famille": "Restaurant",
    "id": "r1",
    "nom": "Riz",
    "seuilMin": 50,
    "sousCategorie": "cuisine",
    "stock": 25,
    "unite": "kg"
  },
  {
    "famille": "Restaurant",
    "id": "r2",
    "nom": "Huile",
    "seuilMin": 10,
    "sousCategorie": "cuisine",
    "stock": 0,
    "unite": "L"
  },
  {
    "famille": "Restaurant",
    "id": "r3",
    "nom": "Sel",
    "seuilMin": 5,
    "sousCategorie": "cuisine",
    "stock": 8,
    "unite": "kg"
  },
  {
    "famille": "Restaurant",
    "id": "r4",
    "nom": "Poivre",
    "seuilMin": 3,
    "sousCategorie": "cuisine",
    "stock": 2,
    "unite": "kg"
  },
  {
    "famille": "Restaurant",
    "id": "r5",
    "nom": "Farine",
    "seuilMin": 20,
    "sousCategorie": "cuisine",
    "stock": 0,
    "unite": "kg"
  },
  {
    "famille": "Restaurant",
    "id": "r6",
    "nom": "Sucre",
    "seuilMin": 10,
    "sousCategorie": "cuisine",
    "stock": 15,
    "unite": "kg"
  },
  {
    "famille": "Restaurant",
    "id": "r7",
    "nom": "Tomates",
    "seuilMin": 15,
    "sousCategorie": "cuisine",
    "stock": 5,
    "unite": "kg"
  },
  {
    "famille": "Restaurant",
    "id": "r8",
    "nom": "Oignons",
    "seuilMin": 10,
    "sousCategorie": "cuisine",
    "stock": 12,
    "unite": "kg"
  },
  {
    "famille": "Restaurant",
    "id": "r9",
    "nom": "Ail",
    "seuilMin": 5,
    "sousCategorie": "cuisine",
    "stock": 3,
    "unite": "kg"
  },
  {
    "famille": "Restaurant",
    "id": "r10",
    "nom": "Poulet (viande)",
    "seuilMin": 20,
    "sousCategorie": "cuisine",
    "stock": 8,
    "unite": "kg"
  },
  {
    "famille": "Restaurant",
    "id": "r11",
    "nom": "Zébu (viande)",
    "seuilMin": 15,
    "sousCategorie": "cuisine",
    "stock": 0,
    "unite": "kg"
  },
  {
    "famille": "Restaurant",
    "id": "r12",
    "nom": "Poisson",
    "seuilMin": 10,
    "sousCategorie": "cuisine",
    "stock": 6,
    "unite": "kg"
  },
  {
    "famille": "Restaurant",
    "id": "r13",
    "nom": "Eau minérale",
    "seuilMin": 100,
    "sousCategorie": "entretien",
    "stock": 0,
    "unite": "L"
  },
  {
    "famille": "Restaurant",
    "id": "r14",
    "nom": "Serviettes papier",
    "seuilMin": 20,
    "sousCategorie": "entretien",
    "stock": 8,
    "unite": "paquet"
  },
  {
    "famille": "Restaurant",
    "id": "r15",
    "nom": "Détergent vaisselle",
    "seuilMin": 10,
    "sousCategorie": "entretien",
    "stock": 3,
    "unite": "L"
  },
  {
    "famille": "Hebergement",
    "id": "s1",
    "nom": "Draps",
    "seuilMin": 20,
    "sousCategorie": "linge_lit",
    "stock": 30,
    "unite": "u"
  },
  {
    "famille": "Hebergement",
    "id": "s2",
    "nom": "Taies d'oreiller",
    "seuilMin": 15,
    "sousCategorie": "linge_lit",
    "stock": 5,
    "unite": "u"
  },
  {
    "famille": "Hebergement",
    "id": "s3",
    "nom": "Couvertures",
    "seuilMin": 12,
    "sousCategorie": "linge_lit",
    "stock": 18,
    "unite": "u"
  },
  {
    "famille": "Hebergement",
    "id": "s4",
    "nom": "Housses de couette",
    "seuilMin": 10,
    "sousCategorie": "linge_lit",
    "stock": 0,
    "unite": "u"
  },
  {
    "famille": "Hebergement",
    "id": "s5",
    "nom": "Serviettes de bain",
    "seuilMin": 30,
    "sousCategorie": "linge_salle",
    "stock": 25,
    "unite": "u"
  },
  {
    "famille": "Hebergement",
    "id": "s6",
    "nom": "Serviettes de toilette",
    "seuilMin": 20,
    "sousCategorie": "linge_salle",
    "stock": 8,
    "unite": "u"
  },
  {
    "famille": "Hebergement",
    "id": "s7",
    "nom": "Tapis de bain",
    "seuilMin": 8,
    "sousCategorie": "linge_salle",
    "stock": 0,
    "unite": "u"
  },
  {
    "famille": "Hebergement",
    "id": "s8",
    "nom": "Savon",
    "seuilMin": 15,
    "sousCategorie": "entretien",
    "stock": 10,
    "unite": "u"
  },
  {
    "famille": "Hebergement",
    "id": "s9",
    "nom": "Shampoing",
    "seuilMin": 12,
    "sousCategorie": "entretien",
    "stock": 3,
    "unite": "u"
  },
  {
    "famille": "Hebergement",
    "id": "s10",
    "nom": "Gel douche",
    "seuilMin": 5,
    "sousCategorie": "entretien",
    "stock": 0,
    "unite": "L"
  },
  {
    "famille": "Hebergement",
    "id": "s11",
    "nom": "Détergent",
    "seuilMin": 8,
    "sousCategorie": "entretien",
    "stock": 4,
    "unite": "L"
  },
  {
    "famille": "Hebergement",
    "id": "s12",
    "nom": "Café",
    "seuilMin": 5,
    "sousCategorie": "petit_dejeuner",
    "stock": 2,
    "unite": "kg"
  },
  {
    "famille": "Hebergement",
    "id": "s13",
    "nom": "Thé",
    "seuilMin": 10,
    "sousCategorie": "petit_dejeuner",
    "stock": 8,
    "unite": "paquet"
  },
  {
    "famille": "Hebergement",
    "id": "s14",
    "nom": "Lait",
    "seuilMin": 15,
    "sousCategorie": "petit_dejeuner",
    "stock": 12,
    "unite": "L"
  },
  {
    "famille": "Hebergement",
    "id": "s15",
    "nom": "Pain",
    "seuilMin": 20,
    "sousCategorie": "petit_dejeuner",
    "stock": 0,
    "unite": "u"
  },
  {
    "famille": "Hebergement",
    "id": "s16",
    "nom": "Confiture",
    "seuilMin": 12,
    "sousCategorie": "petit_dejeuner",
    "stock": 6,
    "unite": "u"
  },
  {
    "famille": "Hebergement",
    "id": "s17",
    "nom": "Beurre",
    "seuilMin": 3,
    "sousCategorie": "petit_dejeuner",
    "stock": 1,
    "unite": "kg"
  }
];

export const factures: Facture[] = [
  {
    "clientNom": "Client Jazz",
    "date": "2025-12-15T08:53:51.651Z",
    "dueDate": "2025-12-30T08:53:51.651Z",
    "id": "f-ev-e1",
    "lignes": [
      {
        "description": "Événement Jazz du vendredi",
        "pu": 15000,
        "qte": 40
      }
    ],
    "numero": "NAS-2025-EVE1",
    "source": "Evenement",
    "statut": "emise",
    "totalTTC": 600000
  },
  {
    "clientNom": "Client Dégustation",
    "date": "2025-12-15T08:53:51.651Z",
    "dueDate": "2025-12-30T08:53:51.651Z",
    "id": "f-ev-e2",
    "lignes": [
      {
        "description": "Événement Dégustation vins",
        "pu": 15000,
        "qte": 25
      }
    ],
    "numero": "NAS-2025-EVE2",
    "source": "Evenement",
    "statut": "payee",
    "totalTTC": 375000
  },
  {
    "clientNom": "Famille Ranaivo",
    "date": "2025-12-15T08:53:51.651Z",
    "dueDate": "2025-12-30T08:53:51.651Z",
    "id": "f-ev-e3",
    "lignes": [
      {
        "description": "Événement Anniversaire — Famille Ranaivo",
        "pu": 15000,
        "qte": 30
      }
    ],
    "numero": "NAS-2025-EVE3",
    "source": "Evenement",
    "statut": "emise",
    "totalTTC": 450000
  },
  {
    "clientNom": "Association Locale",
    "date": "2025-12-15T08:53:51.651Z",
    "dueDate": "2025-12-30T08:53:51.651Z",
    "id": "f-ev-e4",
    "lignes": [
      {
        "description": "Événement Conférence locale",
        "pu": 15000,
        "qte": 80
      }
    ],
    "numero": "NAS-2025-EVE4",
    "source": "Evenement",
    "statut": "emise",
    "totalTTC": 1200000
  },
  {
    "clientNom": "Couple Rakoto",
    "date": "2025-12-15T08:53:51.652Z",
    "dueDate": "2025-12-30T08:53:51.652Z",
    "id": "f-ev-e5",
    "lignes": [
      {
        "description": "Événement Mariage — Couple Rakoto",
        "pu": 15000,
        "qte": 120
      }
    ],
    "numero": "NAS-2025-EVE5",
    "source": "Evenement",
    "statut": "payee",
    "totalTTC": 1800000
  },
  {
    "clientNom": "Client Concert",
    "date": "2025-12-15T08:53:51.652Z",
    "dueDate": "2025-12-30T08:53:51.652Z",
    "id": "f-ev-e6",
    "lignes": [
      {
        "description": "Événement Concert acoustique",
        "pu": 15000,
        "qte": 50
      }
    ],
    "numero": "NAS-2025-EVE6",
    "source": "Evenement",
    "statut": "payee",
    "totalTTC": 750000
  },
  {
    "clientNom": "Client Fromages",
    "date": "2025-12-15T08:53:51.652Z",
    "dueDate": "2025-12-30T08:53:51.652Z",
    "id": "f-ev-e7",
    "lignes": [
      {
        "description": "Événement Soirée dégustation fromages",
        "pu": 15000,
        "qte": 30
      }
    ],
    "numero": "NAS-2025-EVE7",
    "source": "Evenement",
    "statut": "emise",
    "totalTTC": 450000
  },
  {
    "clientNom": "Hanitra Solo",
    "date": "2025-12-15T08:53:51.665Z",
    "dueDate": "2025-12-30T21:00:00.000Z",
    "id": "f-res-h1",
    "lignes": [
      {
        "description": "Nuitée CH-2 (12/16/2025 – 12/18/2025)",
        "pu": 150000,
        "qte": 3
      }
    ],
    "numero": "NAS-2025-HEBH1",
    "reservationId": "h1",
    "source": "Hebergement",
    "statut": "emise",
    "totalTTC": 450000
  },
  {
    "clientNom": "Rabe Andry",
    "date": "2025-12-15T08:53:51.666Z",
    "dueDate": "2025-12-27T21:00:00.000Z",
    "id": "f-res-h2",
    "lignes": [
      {
        "description": "Nuitée CH-1 (12/13/2025 – 12/17/2025)",
        "pu": 80000,
        "qte": 5
      }
    ],
    "numero": "NAS-2025-HEBH2",
    "reservationId": "h2",
    "source": "Hebergement",
    "statut": "emise",
    "totalTTC": 400000
  },
  {
    "clientNom": "Hanitra Solo",
    "date": "2025-12-15T08:53:51.666Z",
    "dueDate": "2026-01-03T21:00:00.000Z",
    "id": "f-res-h3",
    "lignes": [
      {
        "description": "Nuitée CH-4 (12/20/2025 – 12/23/2025)",
        "pu": 80000,
        "qte": 4
      }
    ],
    "numero": "NAS-2025-HEBH3",
    "reservationId": "h3",
    "source": "Hebergement",
    "statut": "emise",
    "totalTTC": 320000
  },
  {
    "clientNom": "Rabe Andry",
    "date": "2025-12-15T08:53:51.666Z",
    "dueDate": "2026-01-08T21:00:00.000Z",
    "id": "f-res-h4",
    "lignes": [
      {
        "description": "Nuitée CH-2 (12/25/2025 – 12/27/2025)",
        "pu": 150000,
        "qte": 3
      }
    ],
    "numero": "NAS-2025-HEBH4",
    "reservationId": "h4",
    "source": "Hebergement",
    "statut": "emise",
    "totalTTC": 450000
  },
  {
    "clientNom": "Hanitra Solo",
    "date": "2025-12-15T08:53:51.666Z",
    "dueDate": "2026-01-13T21:00:00.000Z",
    "id": "f-res-h5",
    "lignes": [
      {
        "description": "Nuitée CH-1 (12/30/2025 – 1/4/2026)",
        "pu": 80000,
        "qte": 6
      }
    ],
    "numero": "NAS-2025-HEBH5",
    "reservationId": "h5",
    "source": "Hebergement",
    "statut": "emise",
    "totalTTC": 480000
  },
  {
    "clientNom": "Rabe Andry",
    "date": "2025-12-15T08:53:51.666Z",
    "dueDate": "2026-01-16T21:00:00.000Z",
    "id": "f-res-h6",
    "lignes": [
      {
        "description": "Nuitée CH-4 (1/2/2026 – 1/5/2026)",
        "pu": 80000,
        "qte": 4
      }
    ],
    "numero": "NAS-2025-HEBH6",
    "reservationId": "h6",
    "source": "Hebergement",
    "statut": "emise",
    "totalTTC": 320000
  },
  {
    "clientNom": "Hanitra Solo",
    "date": "2025-12-15T08:53:51.666Z",
    "dueDate": "2026-01-20T21:00:00.000Z",
    "id": "f-res-h7",
    "lignes": [
      {
        "description": "Nuitée CH-2 (1/6/2026 – 1/9/2026)",
        "pu": 150000,
        "qte": 4
      }
    ],
    "numero": "NAS-2025-HEBH7",
    "reservationId": "h7",
    "source": "Hebergement",
    "statut": "emise",
    "totalTTC": 600000
  },
  {
    "id": "f-res-h-1765872806066",
    "numero": "NAS-2025-HEBH1765872806066",
    "date": "2025-12-16T08:13:26.104Z",
    "dueDate": "2026-01-01T21:00:00.000Z",
    "reservationId": "h-1765872806066",
    "clientNom": "Marie Rasoanaivo",
    "source": "Hebergement",
    "lignes": [
      {
        "description": "Nuitée CH-4 (12/18/2025 – 12/19/2025)",
        "qte": 2,
        "pu": 80000
      }
    ],
    "totalTTC": 160000,
    "statut": "emise"
  }
];

// Périodes de maintenance des chambres (hors service)
export const chambresMaintenance: ChambreMaintenance[] = [
  {
    id: "mt1",
    chambreId: "ch3",
    start: addDays(startOfToday(), -2).toISOString(),
    end: addDays(startOfToday(), 3).toISOString(),
  },
];

export const parametres: Parametres = {
  checkInHour: "14:00",
  checkOutHour: "11:00",
  restoSlotDefaultHours: 1.5,
  enableTariffGrids: false,
  invoiceNumberFormat: "NAS-YYYY-####",
  currency: "MGA",
};

export const evenements: Evenement[] = (() => {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  return [
    {
      id: "e1",
      nom: "Jazz du vendredi",
      date: `${y}-${m}-12`,
      heures: "19:00–22:30",
      nb: 40,
      contact: "Client Jazz",
      statut: "planifie",
      type: "musique",
      notes: "Groupes de 4 privilégiés.",
    },
    {
      id: "e2",
      nom: "Dégustation vins",
      date: `${y}-${m}-15`,
      heures: "18:00–21:00",
      nb: 25,
      contact: "Client Dégustation",
      statut: "confirme",
      type: "degustation",
    },
    {
      id: "e3",
      nom: "Anniversaire — Famille Ranaivo",
      date: `${y}-${m}-20`,
      heures: "12:00–15:00",
      nb: 30,
      contact: "Famille Ranaivo",
      statut: "planifie",
      type: "anniversaire",
    },
    {
      id: "e4",
      nom: "Conférence locale",
      date: `${y}-${m}-30`,
      heures: "10:00–12:00",
      nb: 80,
      contact: "Association Locale",
      statut: "planifie",
      type: "conference",
    },
    {
      id: "e5",
      nom: "Mariage — Couple Rakoto",
      date: `${y}-${m}-25`,
      heures: "14:00–23:00",
      nb: 120,
      contact: "Couple Rakoto",
      statut: "confirme",
      type: "mariage",
    },
    {
      id: "e6",
      nom: "Concert acoustique",
      date: `${y}-${m}-08`,
      heures: "20:00–23:00",
      nb: 50,
      contact: "Client Concert",
      statut: "confirme",
      type: "musique",
    },
    {
      id: "e7",
      nom: "Soirée dégustation fromages",
      date: `${y}-${m}-18`,
      heures: "19:00–22:00",
      nb: 30,
      contact: "Client Fromages",
      statut: "planifie",
      type: "degustation",
    },
  ];
})();

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
