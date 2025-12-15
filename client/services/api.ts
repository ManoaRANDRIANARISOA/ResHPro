import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "./local-db";
import {
  Commande,
  MenuItem,
  Reservation,
  TableResto,
  Evenement,
  Utilisateur,
  Chambre,
} from "@shared/api";
import { eachDayOfInterval, addDays } from "date-fns";
import { syncToFirebase, readFromFirebase } from "./firebase";

// Helper to ensure we hydrate from cloud in production or when explicitly requested
let cloudSyncPromise: Promise<void> | null = null;
export async function ensureCloudSync(forceSeed = false) {
  // Always allow sync if we are in production OR if we want to ensure consistency
  // Ideally, we want to hydrate if we have internet.
  // if (import.meta.env.DEV) return; // Removed restriction to allow sync in Dev too if needed

  if (!cloudSyncPromise || forceSeed) {
    cloudSyncPromise = (async () => {
      console.log("Starting Cloud Sync Check...", forceSeed ? "(FORCED)" : "");
      try {
        const mappings = [
          { key: "stockProduits", col: "stockProduits" },
          { key: "evenements", col: "evenements" },
          { key: "reservations", col: "reservations" },
          { key: "factures", col: "factures" },
          { key: "utilisateurs", col: "utilisateurs" },
          { key: "clients", col: "clients" },
          { key: "commandes", col: "commandes" },
          { key: "menu", col: "menu" },
          { key: "chambres", col: "chambres" },
          { key: "tables", col: "tables" },
          { key: "chambresMaintenance", col: "chambresMaintenance" },
        ];

        let hasDataInCloud = false;

        // Si forceSeed est vrai, on saute la lecture et on considère que le cloud est vide (pour écraser)
        // OU on lit quand même pour être sûr de la connexion, mais on force l'écriture après.
        // Pour être sûr, on lit d'abord (hydratation), sauf si on veut vraiment écraser.
        // L'utilisateur veut "envoyer ses données".
        
        if (!forceSeed) {
            for (const m of mappings) {
              const data = await readFromFirebase(m.col);
              if (data) {
                hasDataInCloud = true;
                // @ts-ignore
                db[m.key] = data;
              }
            }
            
            // Special case for auth - REMOVED from Cloud Sync to prevent session sharing conflicts
            // const authData = await readFromFirebase("userAuth");
            // if (authData) {
            //    hasDataInCloud = true;
            //    const current = db.userAuth;
            //    Object.assign(current, authData);
            //    db.save("nas_user_auth", current);
            // }
        }

        // SEEDING LOGIC: If cloud is empty OR forced, push local data to cloud
        if (!hasDataInCloud || forceSeed) {
            console.log("Seeding cloud with local data...");
            for (const m of mappings) {
                // @ts-ignore
                const localData = db[m.key];
                if (localData) {
                    await syncToFirebase(m.col, localData);
                }
            }
            // await syncToFirebase("userAuth", db.userAuth); // Disabled for session safety
            console.log("Cloud Seeding Complete.");
        }

        console.log("Cloud Sync Complete");
      } catch (e) {
        console.error("Cloud Sync Failed", e);
      }
    })();
  }
  return cloudSyncPromise;
}

// Re-sync on online event
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log("Online detected. Re-syncing...");
    cloudSyncPromise = null; // Reset promise to allow re-run
    ensureCloudSync();
  });
  
  // Also trigger once on load
  ensureCloudSync();
}

async function syncToMock(collection: string, data: any) {
  try {
    // 1. Always save to LocalDB (already done by setter, but good to be sure logic is here if needed)
    // Actually, syncToMock is called AFTER db.setter.
    
    // 2. Try local dev server (works only if running locally)
    if (import.meta.env.DEV) {
      // Don't await this if we want to be optimistic, but for safety let's catch error
      fetch("/api/update-mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection, data }),
      }).catch(e => console.warn("Dev server sync failed (offline?)", e));
    }
    
    // 3. Always try Cloud Sync (Firebase) if configured
    // This supports the "Offline -> Online" flow: if this fails, we just log it.
    // The "ensureCloudSync" on 'online' event will handle full re-hydration,
    // but ideally we should queue writes. For now, we rely on "Last Write Wins" from active client.
    await syncToFirebase(collection, data);
    
  } catch (e) {
    console.error("Failed to sync to mock/cloud", e);
  }
}

// Helper function pour détecter les chevauchements d'horaires
function timeToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

function hasTimeOverlap(
  start1: number,
  duration1: number,
  start2: number,
  duration2: number
): boolean {
  const end1 = start1 + duration1;
  const end2 = start2 + duration2;
  return (start1 < end2 && end1 > start2);
}

export const keys = {
  tables: ["tables"] as const,
  reservations: ["reservations"] as const,
  commandes: ["commandes"] as const,
  factures: ["factures"] as const,
  stock: ["stock"] as const,
  menu: ["menu"] as const,
  events: ["events"] as const,
  clients: ["clients"] as const,
  users: ["users"] as const,
  chambres: ["chambres"] as const,
};

export function useStockProduits() {
  return useQuery({
    queryKey: keys.stock,
    queryFn: async () => db.stockProduits,
  });
}

export function useCreateStockProduit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<import("@shared/api").StockProduit, "id">,
    ) => {
      const created = {
        id: `s-${Date.now()}`,
        ...payload,
      } as import("@shared/api").StockProduit;
      const list = db.stockProduits;
      list.push(created);
      db.stockProduits = list;
      await syncToMock("stockProduits", list);
      return created;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.stock }),
  });
}

export function useUpdateStockProduit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Partial<import("@shared/api").StockProduit> & { id: string },
    ) => {
      const list = db.stockProduits;
      const i = list.findIndex((p) => p.id === payload.id);
      if (i >= 0) {
        list[i] = { ...list[i], ...payload };
        db.stockProduits = list;
        await syncToMock("stockProduits", list);
        return list[i];
      }
      throw new Error("Produit non trouvé");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.stock }),
  });
}

export function useDeleteStockProduit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const list = db.stockProduits;
      const i = list.findIndex((p) => p.id === id);
      if (i >= 0) {
        list.splice(i, 1);
        db.stockProduits = list;
        await syncToMock("stockProduits", list);
        return true;
      }
      return false;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.stock }),
  });
}

export function useEvenements() {
  return useQuery({
    queryKey: keys.events,
    queryFn: async (): Promise<Evenement[]> => db.evenements,
  });
}

export function useCreateEvenement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<Evenement, "id">) => {
      const ev: Evenement = { id: `ev-${Date.now()}`, ...payload };
      const list = db.evenements;
      list.push(ev);
      db.evenements = list;
      await syncToMock("evenements", list);
      return ev;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.events });
      qc.invalidateQueries({ queryKey: keys.factures });
    },
  });
}

export function useUpdateEvenement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Evenement> & { id: string }) => {
      const list = db.evenements;
      const i = list.findIndex((e) => e.id === payload.id);
      if (i >= 0) {
        list[i] = { ...list[i], ...payload };
        db.evenements = list;
        await syncToMock("evenements", list);
        return list[i];
      }
      throw new Error("Event not found");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.events });
      qc.invalidateQueries({ queryKey: keys.factures });
    },
  });
}

export function useTables() {
  return useQuery({ queryKey: keys.tables, queryFn: async () => db.tables });
}

export function useRestoReservations() {
  return useQuery({
    queryKey: keys.reservations,
    queryFn: async () => db.reservations.filter((r) => r.type === "restaurant"),
  });
}

export function useHebergementReservations() {
  return useQuery({
    queryKey: [...keys.reservations, "hebergement"],
    queryFn: async () => db.reservations.filter((r) => r.type === "hebergement"),
  });
}

export function useUpdateHebergementReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Reservation> & { id: string }) => {
      const list = db.reservations;
      const i = list.findIndex((e) => e.id === payload.id);
      if (i >= 0) {
        const prev = { ...list[i] };
        list[i] = { ...list[i], ...payload };
        
        // Auto-generate invoice logic
        if (
          prev.type === "hebergement" &&
          !["confirmee", "arrivee"].includes(prev.statut as any) &&
          ["confirmee", "arrivee"].includes(list[i].statut as any)
        ) {
          const ch = db.chambres.find((c) => c.id === list[i].chambreId);
          const cli = db.clients.find((c) => c.id === list[i].clientId);
          const dStart = new Date(list[i].dateDebut);
          const dEnd = new Date(list[i].dateFin || list[i].dateDebut);
          const nights = eachDayOfInterval({ start: dStart, end: dEnd }).length;
          
          const hasBreakfast = (list[i].notes?.toLowerCase().includes("pdj inclus") || list[i].notes?.toLowerCase().includes("petit déj"));
          const breakfastPrice = 15000;
          const breakfastTotal = hasBreakfast ? (breakfastPrice * nights * (list[i].nbPersonnes || 1)) : 0;
          
          const total = (ch?.tarif_base ?? 0) * nights + breakfastTotal;
          
          const lignes = [{ description: `Nuitée ${ch?.numero ?? list[i].chambreId} (${dStart.toLocaleDateString()} – ${dEnd.toLocaleDateString()})`, qte: nights, pu: ch?.tarif_base ?? 0 }];
          if (hasBreakfast) {
            lignes.push({ description: "Petit Déjeuner Inclus", qte: nights * (list[i].nbPersonnes || 1), pu: breakfastPrice });
          }

          const created: import("@shared/api").Facture = {
            id: `f-${Date.now()}`,
            numero: `NAS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
            date: new Date().toISOString(),
            dueDate: addDays(dStart, 15).toISOString(),
            reservationId: list[i].id,
            clientNom: cli?.nom ?? list[i].clientId,
            source: "Hebergement",
            lignes,
            totalTTC: total,
            statut: "emise",
          };
          
          const factures = db.factures;
          factures.push(created);
          db.factures = factures;
          await syncToMock("factures", factures);
        }
        
        db.reservations = list; // Save changes
        await syncToMock("reservations", list);
        return list[i];
      }
    },
    onSuccess: () => {
      // Ne pas invalider le cache pour préserver les modifications locales
      // qc.invalidateQueries({ queryKey: keys.reservations });
      qc.invalidateQueries({ queryKey: keys.factures });
      qc.invalidateQueries({ queryKey: [...keys.reservations, "hebergement"] });
    },
  });
}

export function useCreateHebergementReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<Reservation, "id" | "type" | "gracePeriodMinutes"> & {
        type?: "hebergement";
      },
    ) => {
      const r: Reservation = {
        id: `h-${Date.now()}`,
        type: "hebergement",
        gracePeriodMinutes: 0,
        ...payload,
      } as Reservation;
      
      const list = db.reservations;
      list.push(r);
      
      if (["confirmee", "arrivee"].includes(r.statut as any)) {
        const ch = db.chambres.find((c) => c.id === r.chambreId);
        const cli = db.clients.find((c) => c.id === r.clientId);
        const dStart = new Date(r.dateDebut);
        const dEnd = new Date(r.dateFin || r.dateDebut);
        const nights = eachDayOfInterval({ start: dStart, end: dEnd }).length;
        
        const hasBreakfast = (r.notes?.toLowerCase().includes("pdj inclus") || r.notes?.toLowerCase().includes("petit déj"));
        const breakfastPrice = 15000;
        const breakfastTotal = hasBreakfast ? (breakfastPrice * nights * (r.nbPersonnes || 1)) : 0;
        
        const total = (ch?.tarif_base ?? 0) * nights + breakfastTotal;
        
        const lignes = [{ description: `Nuitée ${ch?.numero ?? r.chambreId} (${dStart.toLocaleDateString()} – ${dEnd.toLocaleDateString()})`, qte: nights, pu: ch?.tarif_base ?? 0 }];
        if (hasBreakfast) {
          lignes.push({ description: "Petit Déjeuner Inclus", qte: nights * (r.nbPersonnes || 1), pu: breakfastPrice });
        }

        const created: import("@shared/api").Facture = {
          id: `f-${Date.now()}`,
          numero: `NAS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
          date: new Date().toISOString(),
          dueDate: addDays(dStart, 15).toISOString(),
          reservationId: r.id,
          clientNom: cli?.nom ?? r.clientId,
          source: "Hebergement",
          lignes,
          totalTTC: total,
          statut: "emise",
        };
        
        const factures = db.factures;
        factures.push(created);
        db.factures = factures;
        await syncToMock("factures", factures);
      }
      
      db.reservations = list;
      await syncToMock("reservations", list);
      return r;
    },
    onSuccess: () => {
      // Ne pas invalider le cache pour préserver les modifications locales
      // qc.invalidateQueries({ queryKey: keys.reservations });
      qc.invalidateQueries({ queryKey: keys.factures });
      qc.invalidateQueries({ queryKey: [...keys.reservations, "hebergement"] });
    },
  });
}

export function useTodayRestoReservations() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return useQuery({
    queryKey: [...keys.reservations, "today"],
    queryFn: async () =>
      db.reservations.filter(
        (r) =>
          r.type === "restaurant" &&
          new Date(r.dateDebut).setHours(0, 0, 0, 0) === today.getTime(),
  ),
  });
}

export function useClients() {
  return useQuery({
    queryKey: keys.clients,
    queryFn: async () => db.clients,
  });
}

// ==========================
// Utilisateurs (mock CRUD)
// ==========================
export function useUsers() {
  return useQuery({
    queryKey: keys.users,
    queryFn: async (): Promise<Utilisateur[]> => db.utilisateurs,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<Utilisateur, "id"> & { password?: string },
    ) => {
      const user: Utilisateur = { id: `u-${Date.now()}`, ...payload };
      
      const users = db.utilisateurs;
      users.push(user);
      db.utilisateurs = users; // Calls setter which saves to LS
      await syncToMock("utilisateurs", users);

      if (payload.password && payload.login) {
        const auth = db.userAuth;
        auth[payload.login] = payload.password;
        db.save("nas_user_auth", auth); // Manually save auth map
        await syncToMock("userAuth", auth);
      }
      return user;
    },
    onSuccess: (user) => {
      qc.setQueryData(keys.users, (old: any) => (old ? [...old, user] : [user]));
      qc.invalidateQueries({ queryKey: keys.users });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Partial<Utilisateur> & { id: string; password?: string },
    ) => {
      const list = db.utilisateurs;
      const i = list.findIndex((u) => u.id === payload.id);
      if (i >= 0) {
        const prevLogin = list[i].login;
        list[i] = { ...list[i], ...payload };
        db.utilisateurs = list;
        await syncToMock("utilisateurs", list);
        
        if (payload.password) {
          const loginKey = payload.login ?? prevLogin;
          const auth = db.userAuth;
          auth[loginKey] = payload.password;
          db.save("nas_user_auth", auth);
          await syncToMock("userAuth", auth);
        }
        return list[i];
      }
      throw new Error("User not found");
    },
    onSuccess: (updated) => {
      qc.setQueryData(keys.users, (old: any) => (old ? old.map((u: any) => (u.id === updated.id ? updated : u)) : [updated]));
      qc.invalidateQueries({ queryKey: keys.users });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const list = db.utilisateurs;
      const i = list.findIndex((u) => u.id === id);
      if (i >= 0) {
        const loginKey = list[i].login;
        list.splice(i, 1);
        db.utilisateurs = list;
        await syncToMock("utilisateurs", list);
        
        const auth = db.userAuth;
        delete auth[loginKey];
        db.save("nas_user_auth", auth);
        await syncToMock("userAuth", auth);
        return true;
      }
      return false;
    },
    onSuccess: (_ok, vars) => {
      qc.setQueryData(keys.users, (old: any) => (old ? old.filter((u: any) => u.id !== vars.id) : []));
      qc.invalidateQueries({ queryKey: keys.users });
    },
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      nom,
      telephone,
    }: {
      nom: string;
      telephone: string;
    }) => {
      const id = `c-${Date.now()}`; // in-memory
      const c = { id, nom, telephone } as any;
      const clients = db.clients;
      clients.push(c);
      db.clients = clients;
      await syncToMock("clients", clients);
      return c;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.clients }),
  });
}

export function useCreateRestoReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Pick<
        Reservation,
        "clientId" | "dateDebut" | "heure" | "nbPersonnes" | "tableId"
      >,
    ) => {
      const id = `r-${Date.now()}`;
      const r: Reservation = {
        id,
        type: "restaurant",
        statut: "confirmee",
        gracePeriodMinutes: 15,
        ...payload,
      } as Reservation;
      
      const reservations = db.reservations;
      reservations.push(r);
      db.reservations = reservations; // This will trigger table sync in LocalDB setter
      await syncToMock("reservations", reservations);
      await syncToMock("tables", db.tables);

      // We don't need manual table update here because LocalDB.reservations setter does it.
      // But let's verify if we need to explicitly save tables?
      // LocalDB.syncTablesWithReservations saves tables if changed.
      
      return r;
    },
    onSuccess: (newReservation) => {
      // Stocker la nouvelle réservation dans le cache de React Query
      qc.setQueryData([...keys.reservations, "today"], (old: any) => {
        if (!old) return [newReservation];
        return [...old, newReservation];
      });
      qc.invalidateQueries({ queryKey: keys.tables });
      qc.invalidateQueries({ queryKey: keys.reservations });
    },
  });
}

export function useUpdateRestoReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Reservation> & { id: string }) => {
      const reservations = db.reservations;
      const i = reservations.findIndex((r) => r.id === payload.id);
      if (i >= 0) {
        reservations[i] = { ...reservations[i], ...payload };
        db.reservations = reservations; // Triggers sync
        await syncToMock("reservations", reservations);
        await syncToMock("tables", db.tables);
        return reservations[i];
      }
      return null;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tables });
      qc.invalidateQueries({ queryKey: keys.reservations });
    },
  });
}

export function useDeleteRestoReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const reservations = db.reservations;
      const i = reservations.findIndex((r) => r.id === id);
      if (i >= 0) {
        reservations.splice(i, 1);
        db.reservations = reservations; // Triggers sync (will likely free the table)
        await syncToMock("reservations", reservations);
        await syncToMock("tables", db.tables);
        return true;
      }
      return false;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tables });
      qc.invalidateQueries({ queryKey: keys.reservations });
    },
  });
}

export function useReservationCommandes(reservationId: string) {
  return useQuery({
    queryKey: [...keys.commandes, reservationId],
    queryFn: async () =>
      db.commandes.filter((c) => c.reservationId === reservationId),
    enabled: !!reservationId,
  });
}

export function useMenuItems() {
  return useQuery({
    queryKey: keys.menu,
    queryFn: async (): Promise<MenuItem[]> => db.menu,
  });
}

export function useUpdateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<MenuItem> & { id: string }) => {
      const menu = db.menu;
      const idx = menu.findIndex((m) => m.id === payload.id);
      if (idx >= 0) {
        menu[idx] = { ...menu[idx], ...payload } as MenuItem;
        db.menu = menu;
        await syncToMock("menu", menu);
        return menu[idx];
      }
      throw new Error("Menu item not found");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.menu }),
  });
}

export function useCreateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Pick<MenuItem, "nom" | "categorieId" | "prix"> &
        Partial<Pick<MenuItem, "photoUrl" | "enabled">>,
    ) => {
      const it: MenuItem = {
        id: `m${Date.now()}`,
        enabled: true,
        ...payload,
      } as MenuItem;
      const menu = db.menu;
      menu.push(it);
      db.menu = menu;
      await syncToMock("menu", menu);
      return it;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.menu }),
  });
}

export function useAddCommande() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Pick<Commande, "reservationId" | "menuItemId" | "quantite">,
    ) => {
      const created: Commande = {
        id: `o-${Date.now()}`,
        createdAt: new Date().toISOString(),
        statut: "saisie",
        ...payload,
      };
      const commandes = db.commandes;
      commandes.push(created);
      db.commandes = commandes;
      await syncToMock("commandes", commandes);
      return created;
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: [...keys.commandes, v.reservationId] }),
  });
}

export function useSendBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reservationId }: { reservationId: string }) => {
      const commandes = db.commandes;
      let changed = false;
      commandes.forEach(c => {
        if (c.reservationId === reservationId && c.statut === "saisie") {
          c.statut = "envoyee";
          changed = true;
        }
      });
      if (changed) {
        db.commandes = commandes;
        await syncToMock("commandes", commandes);
      }
    },
    onSuccess: (_r, v) =>
      qc.invalidateQueries({ queryKey: [...keys.commandes, v.reservationId] }),
  });
}

export function useMarkServed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reservationId }: { reservationId: string }) => {
      const commandes = db.commandes;
      let changed = false;
      
      // Update commands
      commandes.forEach(c => {
        if (c.reservationId === reservationId && c.statut === "envoyee") {
          c.statut = "servie";
          changed = true;
        }
      });
      
      if (changed) {
        db.commandes = commandes;
        await syncToMock("commandes", commandes);
        
        // Generate invoice
        const reservations = db.reservations;
        const res = reservations.find((r) => r.id === reservationId);
        
        // We use the UPDATED commandes list here
        const lines = db.commandes
          .filter((c) => c.reservationId === reservationId && c.statut === "servie")
          .map((c) => {
            const it = db.menu.find((m) => m.id === c.menuItemId);
            return { description: it?.nom || c.menuItemId, qte: c.quantite, pu: it?.prix || 0 };
          });
          
        const total = lines.reduce((s, l) => s + l.qte * l.pu, 0);
        
        if (res && lines.length && total > 0) {
          const cli = db.clients.find((c) => c.id === res.clientId);
          const created: import("@shared/api").Facture = {
            id: `f-${Date.now()}`,
            numero: `NAS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
            date: new Date().toISOString(),
            clientNom: cli?.nom || res.clientId,
            source: "Restaurant",
            lignes: lines,
            totalTTC: total,
            statut: "emise",
          };
          
          const factures = db.factures;
          factures.push(created);
          db.factures = factures;
          await syncToMock("factures", factures);
        }
      }
    },
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: [...keys.commandes, v.reservationId] });
      qc.invalidateQueries({ queryKey: keys.factures });
    },
  });
}

export function useCancelCommande() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, motif }: { id: string; motif?: string }) => {
      const commandes = db.commandes;
      const c = commandes.find((c) => c.id === id);
      if (c) {
        c.statut = "annulee";
        c.motifAnnulation = motif;
        db.commandes = commandes;
        await syncToMock("commandes", commandes);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.commandes }),
  });
}

export function useCancelPendingCommandesForReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reservationId, motif }: { reservationId: string; motif?: string }) => {
      const commandes = db.commandes;
      let changed = false;
      commandes.forEach(c => {
        if (c.reservationId === reservationId && (c.statut === "saisie" || c.statut === "envoyee")) {
          c.statut = "annulee";
          c.motifAnnulation = motif ?? "Annulé (non arrivé)";
          changed = true;
        }
      });
      if (changed) {
        db.commandes = commandes;
        await syncToMock("commandes", commandes);
      }
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: [...keys.commandes, v.reservationId] }),
  });
}

export function useEndOfService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => db.endOfService(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.commandes });
      qc.invalidateQueries({ queryKey: keys.stock });
    },
  });
}

// Fonction pour obtenir les créneaux disponibles pour une table à une date/heure donnée
export function getAvailableTimeSlots(
  tableId: string,
  targetTime: string,
  duration: number = 60
): { time: string; available: boolean }[] {
  const slots: { time: string; available: boolean }[] = [];
  const targetMinutes = timeToMinutes(targetTime);
  
  // Générer des créneaux de 15 minutes autour de l'heure cible (±2 heures)
  for (let offset = -120; offset <= 120; offset += 15) {
    const slotTime = targetMinutes + offset;
    if (slotTime >= 0 && slotTime <= 840) { // 8h-22h = 840 minutes
      const timeString = `${Math.floor(slotTime / 60).toString().padStart(2, '0')}:${(slotTime % 60).toString().padStart(2, '0')}`;
      const availability = checkTableAvailability(tableId, timeString, duration);
      
      slots.push({
        time: timeString,
        available: availability.available
      });
    }
  }
  
  return slots;
}

// Fonction pour vérifier si un créneau est disponible pour une table
export function checkTableAvailability(
  tableId: string,
  startTime: string,
  duration: number,
  excludeReservationId?: string
): { available: boolean; conflictingReservations?: Reservation[] } {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + duration;
  
  const conflictingReservations = db.reservations.filter(r => {
    if (r.tableId !== tableId) return false;
    if (excludeReservationId && r.id === excludeReservationId) return false;
    
    const rStartMinutes = timeToMinutes(r.heure || '00:00');
    const rEndMinutes = rStartMinutes + (r.duree || 60);
    
    // Détection de chevauchement
    return (startMinutes < rEndMinutes && endMinutes > rStartMinutes);
  });
  
  return {
    available: conflictingReservations.length === 0,
    conflictingReservations
  };
}

export function useAssignTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { tableId: string; reservationId: string }) => {
      // Détection de collision complète (chevauchement d'horaires)
      const reservations = db.reservations;
      const r = reservations.find((r) => r.id === payload.reservationId);
      if (!r) throw new Error("Réservation non trouvée");
      
      // Vérifier la disponibilité avec la fonction complète
      const availability = checkTableAvailability(
        payload.tableId,
        r.heure || '00:00',
        r.duree || 60,
        r.id
      );
      
      if (!availability.available) {
        throw new Error(`Collision de table pour ce créneau. Conflit avec: ${availability.conflictingReservations?.map(cr => cr.clientId || 'Réservation').join(', ')}`);
      }
      
      // Update Table
      const tables = db.tables;
      const t = tables.find((t) => t.id === payload.tableId);
      if (t) {
        t.assignedReservationId = payload.reservationId;
        t.statut = "reservee";
        db.tables = tables;
        await syncToMock("tables", tables);
      }
      
      // Update Reservation
      if (r) {
        r.tableId = payload.tableId;
        db.reservations = reservations;
        await syncToMock("reservations", reservations);
      }
      
      return t as TableResto;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tables });
      // Ne pas invalider le cache pour préserver les modifications locales
      // qc.invalidateQueries({ queryKey: keys.reservations });
    },
  });
}

export function useFactures() {
  return useQuery({
    queryKey: keys.factures,
    queryFn: async () => {
      const events = db.evenements;
      const reservationsAll = db.reservations;
      const chambresAll = db.chambres;
      const clientsAll = db.clients;
      const baseRaw = db.factures;
      
      const base = Array.from(new Map(baseRaw.map((f) => [f.id, f])).values());
      const RATE_AR = 15000;
      const augmented = [...base];
      
      let newFacturesAdded = false;
      const facturesToSave = [...baseRaw];
      
      for (const ev of events || []) {
        const hasExisting = augmented.some(
          (f) =>
            f.source === "Evenement" &&
            (f.lignes?.some((l) => (l.description || "").includes(ev.nom)) || f.id === `f-ev-${ev.id}`),
        );
        if (!hasExisting) {
          const qty = Number(ev.nb || 1);
          const total = qty * RATE_AR;
          const defaultDue = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
          const created: import("@shared/api").Facture = {
            id: `f-ev-${ev.id}`,
            numero: `NAS-${new Date().getFullYear()}-EV${String(ev.id).replace(/[^0-9a-zA-Z]/g, "").toUpperCase()}`,
            date: new Date().toISOString(),
            dueDate: defaultDue,
            clientNom: ev.contact || "Client",
            source: "Evenement",
            lignes: [{ description: `Événement ${ev.nom}`, qte: qty, pu: RATE_AR }],
            totalTTC: total,
            statut: ev.statut === "confirme" ? "payee" : "emise",
          };
          augmented.push(created as any);
          facturesToSave.push(created as any);
          newFacturesAdded = true;
        }
      }

      // Générer les factures manquantes pour les réservations hébergement (statut Envoyée par défaut)
      const heb = (reservationsAll || []).filter((r) => r.type === "hebergement");
      for (const r of heb) {
        const has = augmented.some((f) => f.source === "Hebergement" && (f.reservationId === r.id || f.lignes?.some((l) => (l.description || "").includes(String(r.chambreId)))));
        if (!has) {
          const ch = chambresAll.find((c) => c.id === r.chambreId);
          const cli = clientsAll.find((c) => c.id === r.clientId);
          const dStart = new Date(r.dateDebut);
          const dEnd = new Date(r.dateFin || r.dateDebut);
          const nights = eachDayOfInterval({ start: dStart, end: dEnd }).length;
          
          const hasBreakfast = (r.notes?.toLowerCase().includes("pdj inclus") || r.notes?.toLowerCase().includes("petit déj"));
          const breakfastPrice = 15000;
          const breakfastTotal = hasBreakfast ? (breakfastPrice * nights * (r.nbPersonnes || 1)) : 0;
          
          const total = (ch?.tarif_base ?? 0) * nights + breakfastTotal;
          
          const lignes = [{ description: `Nuitée ${ch?.numero ?? r.chambreId} (${dStart.toLocaleDateString()} – ${dEnd.toLocaleDateString()})`, qte: nights, pu: ch?.tarif_base ?? 0 }];
          if (hasBreakfast) {
            lignes.push({ description: "Petit Déjeuner Inclus", qte: nights * (r.nbPersonnes || 1), pu: breakfastPrice });
          }

          const created: import("@shared/api").Facture = {
            id: `f-res-${r.id}`,
            numero: `NAS-${new Date().getFullYear()}-HEB${String(r.id).replace(/[^0-9a-zA-Z]/g, "").toUpperCase()}`,
            date: new Date().toISOString(),
            dueDate: addDays(dStart, 15).toISOString(),
            reservationId: r.id,
            clientNom: cli?.nom ?? r.clientId,
            source: "Hebergement",
            lignes,
            totalTTC: total,
            statut: "emise",
          };
          augmented.push(created as any);
          facturesToSave.push(created as any);
          newFacturesAdded = true;
        }
      }
      
      if (newFacturesAdded) {
        db.factures = facturesToSave;
        await syncToMock("factures", facturesToSave);
      }
      
      return augmented;
    },
  });
}

export function useCreateFacture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<
        import("@shared/api").Facture,
        "id" | "numero" | "totalTTC"
      > & { totalTTC?: number },
    ) => {
      const total =
        payload.totalTTC ??
        payload.lignes.reduce((s, l) => s + l.qte * l.pu, 0);
      const defaultDue = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
      const created: import("@shared/api").Facture = {
        id: `f-${Date.now()}`,
        numero: `NAS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
        totalTTC: total,
        dueDate: payload.dueDate ?? defaultDue,
        ...payload,
      };
      const factures = db.factures;
      factures.push(created);
      db.factures = factures;
      await syncToMock("factures", factures);
      return created;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.factures }),
  });
}

export function useUpdateFactureStatut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: import("@shared/api").Facture["statut"] }) => {
      const list = db.factures;
      const i = list.findIndex((f) => f.id === id);
      if (i >= 0) {
        list[i] = { ...list[i], statut };
        db.factures = list;
        await syncToMock("factures", list);
        return list[i];
      }
      throw new Error("Facture non trouvée");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.factures }),
  });
}

export function useUpdateFacture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<import("@shared/api").Facture> & { id: string }) => {
      const list = db.factures;
      const i = list.findIndex((f) => f.id === payload.id);
      if (i >= 0) {
        list[i] = { ...list[i], ...payload } as any;
        db.factures = list;
        await syncToMock("factures", list);
        return list[i];
      }
      throw new Error("Facture non trouvée");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.factures }),
  });
}

// ==========================
// Chambres (mock CRUD)
// ==========================
export function useChambres() {
  return useQuery({
    queryKey: keys.chambres,
    queryFn: async (): Promise<Chambre[]> => db.chambres,
  });
}

// Gestion des périodes de maintenance (hors service) des chambres
export function useRoomMaintenance() {
  return useQuery({ queryKey: [...keys.chambres, "maintenance"], queryFn: async () => db.get("nas_chambres_maintenance") });
}

export function useAddRoomMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { chambreId: string; start: string; end: string }) => {
      const list = db.get<any[]>("nas_chambres_maintenance");
      list.push(payload);
      db.save("nas_chambres_maintenance", list);
      await syncToMock("chambresMaintenance", list);
      return payload;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...keys.chambres, "maintenance"] }),
  });
}

export function useRemoveRoomMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { chambreId: string; start?: string; end?: string }) => {
      const list = db.get<any[]>("nas_chambres_maintenance");
      const idxs = list
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => m.chambreId === payload.chambreId && (!payload.start || !payload.end || (new Date(m.start) <= new Date(payload.end!) && new Date(m.end) >= new Date(payload.start!))))
        .map(({ i }) => i)
        .reverse();
      for (const i of idxs) list.splice(i, 1);
      db.save("nas_chambres_maintenance", list);
      await syncToMock("chambresMaintenance", list);
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...keys.chambres, "maintenance"] }),
  });
}

export function useCreateChambre() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<Chambre, "id">,
    ) => {
      const created: Chambre = { id: `ch-${Date.now()}`, ...payload } as Chambre;
      const list = db.chambres;
      list.push(created);
      db.chambres = list;
      await syncToMock("chambres", list);
      return created;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.chambres }),
  });
}

export function useUpdateChambre() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Partial<Chambre> & { id: string },
    ) => {
      const list = db.chambres;
      const i = list.findIndex((c) => c.id === payload.id);
      if (i >= 0) {
        list[i] = { ...list[i], ...payload };
        db.chambres = list;
        await syncToMock("chambres", list);
        return list[i];
      }
      throw new Error("Chambre non trouvée");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.chambres }),
  });
}

export function useDeleteChambre() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const list = db.chambres;
      const i = list.findIndex((c) => c.id === id);
      if (i >= 0) {
        list.splice(i, 1);
        db.chambres = list;
        await syncToMock("chambres", list);
        return true;
      }
      return false;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.chambres }),
  });
}
