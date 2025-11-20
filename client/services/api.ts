import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  commandes,
  endOfService,
  factures,
  menu,
  reservations,
  stockProduits,
  tables,
  evenements,
  clients,
  utilisateurs,
  userAuth,
  chambres,
} from "./mock";
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
    queryFn: async () => stockProduits,
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
      (await import("./mock")).stockProduits.push(created);
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
      const list = (await import("./mock"))
        .stockProduits as any as import("@shared/api").StockProduit[];
      const i = list.findIndex((p) => p.id === payload.id);
      if (i >= 0) list[i] = { ...list[i], ...payload };
      return list[i];
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.stock }),
  });
}

export function useDeleteStockProduit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const list = (await import("./mock"))
        .stockProduits as any as import("@shared/api").StockProduit[];
      const i = list.findIndex((p) => p.id === id);
      if (i >= 0) list.splice(i, 1);
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.stock }),
  });
}

export function useEvenements() {
  return useQuery({
    queryKey: keys.events,
    queryFn: async (): Promise<Evenement[]> => evenements,
  });
}

export function useCreateEvenement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<Evenement, "id">) => {
      const ev: Evenement = { id: `ev-${Date.now()}`, ...payload };
      (await import("./mock")).evenements.push(ev as any);
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
      const list = (await import("./mock")).evenements as any as Evenement[];
      const i = list.findIndex((e) => e.id === payload.id);
      if (i >= 0) list[i] = { ...list[i], ...payload };
      return list[i];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.events });
      qc.invalidateQueries({ queryKey: keys.factures });
    },
  });
}

export function useTables() {
  return useQuery({ queryKey: keys.tables, queryFn: async () => tables });
}

export function useRestoReservations() {
  return useQuery({
    queryKey: keys.reservations,
    queryFn: async () => reservations.filter((r) => r.type === "restaurant"),
  });
}

export function useHebergementReservations() {
  return useQuery({
    queryKey: [...keys.reservations, "hebergement"],
    queryFn: async () => reservations.filter((r) => r.type === "hebergement"),
  });
}

export function useUpdateHebergementReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Reservation> & { id: string }) => {
      const mod = await import("./mock");
      const list = mod.reservations as any as Reservation[];
      const i = list.findIndex((e) => e.id === payload.id);
      if (i >= 0) {
        const prev = { ...list[i] };
        list[i] = { ...list[i], ...payload };
        if (
          prev.type === "hebergement" &&
          !["confirmee", "arrivee"].includes(prev.statut as any) &&
          ["confirmee", "arrivee"].includes(list[i].statut as any)
        ) {
          const ch = chambres.find((c) => c.id === list[i].chambreId);
          const cli = clients.find((c) => c.id === list[i].clientId);
          const dStart = new Date(list[i].dateDebut);
          const dEnd = new Date(list[i].dateFin || list[i].dateDebut);
          const nights = eachDayOfInterval({ start: dStart, end: dEnd }).length;
          const total = (ch?.tarif_base ?? 0) * nights;
          const created: import("@shared/api").Facture = {
            id: `f-${Date.now()}`,
            numero: `NAS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
            date: new Date().toISOString(),
            dueDate: addDays(dStart, 15).toISOString(),
            reservationId: list[i].id,
            clientNom: cli?.nom ?? list[i].clientId,
            source: "Hebergement",
            lignes: [{ description: `Nuitée ${ch?.numero ?? list[i].chambreId} (${dStart.toLocaleDateString()} – ${dEnd.toLocaleDateString()})`, qte: nights, pu: ch?.tarif_base ?? 0 }],
            totalTTC: total,
            statut: "emise",
          };
          mod.factures.push(created as any);
        }
      }
      return list[i];
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
      const mod = await import("./mock");
      mod.reservations.push(r);
      if (["confirmee", "arrivee"].includes(r.statut as any)) {
        const ch = chambres.find((c) => c.id === r.chambreId);
        const cli = clients.find((c) => c.id === r.clientId);
        const dStart = new Date(r.dateDebut);
        const dEnd = new Date(r.dateFin || r.dateDebut);
        const nights = eachDayOfInterval({ start: dStart, end: dEnd }).length;
        const total = (ch?.tarif_base ?? 0) * nights;
        const created: import("@shared/api").Facture = {
          id: `f-${Date.now()}`,
          numero: `NAS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
          date: new Date().toISOString(),
          dueDate: addDays(dStart, 15).toISOString(),
          reservationId: r.id,
          clientNom: cli?.nom ?? r.clientId,
          source: "Hebergement",
          lignes: [{ description: `Nuitée ${ch?.numero ?? r.chambreId} (${dStart.toLocaleDateString()} – ${dEnd.toLocaleDateString()})`, qte: nights, pu: ch?.tarif_base ?? 0 }],
          totalTTC: total,
          statut: "emise",
        };
        mod.factures.push(created as any);
      }
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
      reservations.filter(
        (r) =>
          r.type === "restaurant" &&
          new Date(r.dateDebut).setHours(0, 0, 0, 0) === today.getTime(),
  ),
  });
}

export function useClients() {
  return useQuery({
    queryKey: keys.clients,
    queryFn: async () => clients,
  });
}

// ==========================
// Utilisateurs (mock CRUD)
// ==========================
export function useUsers() {
  return useQuery({
    queryKey: keys.users,
    queryFn: async (): Promise<Utilisateur[]> => utilisateurs,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<Utilisateur, "id"> & { password?: string },
    ) => {
      const user: Utilisateur = { id: `u-${Date.now()}`, ...payload };
      (await import("./mock")).utilisateurs.push(user as any);
      if (payload.password && payload.login) {
        (await import("./mock")).userAuth[payload.login] = payload.password;
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
      const list = (await import("./mock")).utilisateurs as any as Utilisateur[];
      const i = list.findIndex((u) => u.id === payload.id);
      if (i >= 0) {
        const prevLogin = list[i].login;
        list[i] = { ...list[i], ...payload };
        if (payload.password) {
          const loginKey = payload.login ?? prevLogin;
          (await import("./mock")).userAuth[loginKey] = payload.password;
        }
      }
      return list[i];
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
      const list = (await import("./mock")).utilisateurs as any as Utilisateur[];
      const i = list.findIndex((u) => u.id === id);
      if (i >= 0) {
        const loginKey = list[i].login;
        list.splice(i, 1);
        delete (await import("./mock")).userAuth[loginKey];
      }
      return true;
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
      (await import("./mock")).clients.push(c);
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
      reservations.push(r);
      if (r.tableId) {
        const t = tables.find((t) => t.id === r.tableId);
        if (t) {
          t.assignedReservationId = r.id;
          t.statut = "reservee";
        }
      }
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
      const i = reservations.findIndex((r) => r.id === payload.id);
      if (i >= 0) {
        const oldTableId = reservations[i].tableId;
        reservations[i] = { ...reservations[i], ...payload };
        
        // Mettre à jour le cache React Query
        qc.setQueryData([...keys.reservations, "today"], (old: any) => {
          if (!old) return [reservations[i]];
          return old.map((r: Reservation) => r.id === payload.id ? reservations[i] : r);
        });
        
        // Mettre à jour les tables si nécessaire
        if (oldTableId !== payload.tableId) {
          // Libérer l'ancienne table
          if (oldTableId) {
            const oldTable = tables.find((t) => t.id === oldTableId);
            if (oldTable) {
              oldTable.assignedReservationId = undefined;
              oldTable.statut = "libre";
            }
          }
          // Assigner la nouvelle table
          if (payload.tableId) {
            const newTable = tables.find((t) => t.id === payload.tableId);
            if (newTable) {
              newTable.assignedReservationId = payload.id;
              newTable.statut = reservations[i].statut === "arrivee" ? "occupee" : "reservee";
            }
          }
        }
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
      const i = reservations.findIndex((r) => r.id === id);
      if (i >= 0) {
        const reservation = reservations[i];
        // Libérer la table associée
        if (reservation.tableId) {
          const table = tables.find((t) => t.id === reservation.tableId);
          if (table) {
            table.assignedReservationId = undefined;
            table.statut = "libre";
          }
        }
        reservations.splice(i, 1);
        
        // Mettre à jour le cache React Query
        qc.setQueryData([...keys.reservations, "today"], (old: any) => {
          if (!old) return [];
          return old.filter((r: Reservation) => r.id !== id);
        });
      }
      return true;
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
      commandes.filter((c) => c.reservationId === reservationId),
    enabled: !!reservationId,
  });
}

export function useMenuItems() {
  return useQuery({
    queryKey: keys.menu,
    queryFn: async (): Promise<MenuItem[]> => menu,
  });
}

export function useUpdateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<MenuItem> & { id: string }) => {
      const idx = menu.findIndex((m) => m.id === payload.id);
      if (idx >= 0) menu[idx] = { ...menu[idx], ...payload } as MenuItem;
      return menu[idx];
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
      (await import("./mock")).menu.push(it as any);
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
      commandes.push(created);
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
      commandes
        .filter(
          (c) => c.reservationId === reservationId && c.statut === "saisie",
        )
        .forEach((c) => (c.statut = "envoyee"));
    },
    onSuccess: (_r, v) =>
      qc.invalidateQueries({ queryKey: [...keys.commandes, v.reservationId] }),
  });
}

export function useMarkServed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reservationId }: { reservationId: string }) => {
      commandes
        .filter(
          (c) => c.reservationId === reservationId && c.statut === "envoyee",
        )
        .forEach((c) => (c.statut = "servie"));
      const res = reservations.find((r) => r.id === reservationId);
      const lines = commandes
        .filter((c) => c.reservationId === reservationId && c.statut === "servie")
        .map((c) => {
          const it = menu.find((m) => m.id === c.menuItemId);
          return { description: it?.nom || c.menuItemId, qte: c.quantite, pu: it?.prix || 0 };
        });
      const total = lines.reduce((s, l) => s + l.qte * l.pu, 0);
      if (res && lines.length && total > 0) {
        const cli = clients.find((c) => c.id === res.clientId);
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
        (await import("./mock")).factures.push(created as any);
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
      const c = commandes.find((c) => c.id === id);
      if (c) {
        c.statut = "annulee";
        c.motifAnnulation = motif;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.commandes }),
  });
}

export function useCancelPendingCommandesForReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reservationId, motif }: { reservationId: string; motif?: string }) => {
      commandes
        .filter((c) => c.reservationId === reservationId && (c.statut === "saisie" || c.statut === "envoyee"))
        .forEach((c) => {
          c.statut = "annulee";
          c.motifAnnulation = motif ?? "Annulé (non arrivé)";
        });
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: [...keys.commandes, v.reservationId] }),
  });
}

export function useEndOfService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => endOfService(),
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
  
  const conflictingReservations = reservations.filter(r => {
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
      
      const t = tables.find((t) => t.id === payload.tableId);
      if (t)
        ((t.assignedReservationId = payload.reservationId),
          (t.statut = "reservee"));
      if (r) r.tableId = payload.tableId;
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
      const mod = await import("./mock");
      const events = mod.evenements as any as Evenement[];
      const reservationsAll = mod.reservations as any as Reservation[];
      const chambresAll = mod.chambres as any as Chambre[];
      const clientsAll = mod.clients as any as any[];
      const baseRaw = mod.factures as any as import("@shared/api").Facture[];
      const base = Array.from(new Map(baseRaw.map((f) => [f.id, f])).values());
      const RATE_AR = 15000;
      const augmented = [...base];
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
          (mod.factures as any as import("@shared/api").Facture[]).push(created as any);
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
          const total = (ch?.tarif_base ?? 0) * nights;
          const created: import("@shared/api").Facture = {
            id: `f-res-${r.id}`,
            numero: `NAS-${new Date().getFullYear()}-HEB${String(r.id).replace(/[^0-9a-zA-Z]/g, "").toUpperCase()}`,
            date: new Date().toISOString(),
            dueDate: addDays(dStart, 15).toISOString(),
            reservationId: r.id,
            clientNom: cli?.nom ?? r.clientId,
            source: "Hebergement",
            lignes: [{ description: `Nuitée ${ch?.numero ?? r.chambreId} (${dStart.toLocaleDateString()} – ${dEnd.toLocaleDateString()})`, qte: nights, pu: ch?.tarif_base ?? 0 }],
            totalTTC: total,
            statut: "emise",
          };
          augmented.push(created as any);
          (mod.factures as any as import("@shared/api").Facture[]).push(created as any);
        }
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
      (await import("./mock")).factures.push(created);
      return created;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.factures }),
  });
}

export function useUpdateFactureStatut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: import("@shared/api").Facture["statut"] }) => {
      const list = (await import("./mock")).factures as any as import("@shared/api").Facture[];
      const i = list.findIndex((f) => f.id === id);
      if (i >= 0) list[i] = { ...list[i], statut };
      return list[i];
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.factures }),
  });
}

export function useUpdateFacture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<import("@shared/api").Facture> & { id: string }) => {
      const list = (await import("./mock")).factures as any as import("@shared/api").Facture[];
      const i = list.findIndex((f) => f.id === payload.id);
      if (i >= 0) list[i] = { ...list[i], ...payload } as any;
      return list[i];
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
    queryFn: async (): Promise<Chambre[]> => chambres,
  });
}

// Gestion des périodes de maintenance (hors service) des chambres
export function useRoomMaintenance() {
  return useQuery({ queryKey: [...keys.chambres, "maintenance"], queryFn: async () => (await import("./mock")).chambresMaintenance });
}

export function useAddRoomMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { chambreId: string; start: string; end: string }) => {
      (await import("./mock")).chambresMaintenance.push(payload);
      return payload;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...keys.chambres, "maintenance"] }),
  });
}

export function useRemoveRoomMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { chambreId: string; start?: string; end?: string }) => {
      const list = (await import("./mock")).chambresMaintenance;
      const idxs = list
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => m.chambreId === payload.chambreId && (!payload.start || !payload.end || (new Date(m.start) <= new Date(payload.end!) && new Date(m.end) >= new Date(payload.start!))))
        .map(({ i }) => i)
        .reverse();
      for (const i of idxs) list.splice(i, 1);
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
      (await import("./mock")).chambres.push(created as any);
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
      const list = (await import("./mock")).chambres as any as Chambre[];
      const i = list.findIndex((c) => c.id === payload.id);
      if (i >= 0) list[i] = { ...list[i], ...payload };
      return list[i];
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.chambres }),
  });
}

export function useDeleteChambre() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const list = (await import("./mock")).chambres as any as Chambre[];
      const i = list.findIndex((c) => c.id === id);
      if (i >= 0) list.splice(i, 1);
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.chambres }),
  });
}
