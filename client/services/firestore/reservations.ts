import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Reservation } from "@shared/api";
import { useTenant } from "@/contexts/TenantContext";
import { fetchCollection, createDoc, updateTenantDoc, deleteTenantDoc } from "./utils";
import { where } from "firebase/firestore";
import { useCreateFacture } from "./factures";
import { eachDayOfInterval, addDays } from "date-fns";
import { fetchDoc } from "./utils";
import { Chambre } from "@shared/api";
import { TenantConfig } from "@shared/tenant";

export const reservationsKeys = {
  all: ["reservations"] as const,
};

export function useRestoReservations() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: [...reservationsKeys.all, "restaurant"],
    queryFn: async () => {
      if (!tenantId) return [];
      return fetchCollection<Reservation>(tenantId, "reservations", where("type", "==", "restaurant"));
    },
    enabled: !!tenantId,
  });
}

export function useHebergementReservations() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: [...reservationsKeys.all, "hebergement"],
    queryFn: async () => {
      if (!tenantId) return [];
      return fetchCollection<Reservation>(tenantId, "reservations", where("type", "==", "hebergement"));
    },
    enabled: !!tenantId,
  });
}

export function useTodayRestoReservations() {
  const { tenantId } = useTenant();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return useQuery({
    queryKey: [...reservationsKeys.all, "today"],
    queryFn: async () => {
      if (!tenantId) return [];
      const all = await fetchCollection<Reservation>(tenantId, "reservations", where("type", "==", "restaurant"));
      return all.filter((r) => new Date(r.dateDebut).setHours(0, 0, 0, 0) === today.getTime());
    },
    enabled: !!tenantId,
  });
}

export function useCreateRestoReservation() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Pick<Reservation, "clientId" | "dateDebut" | "heure" | "nbPersonnes" | "tableId">) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const r: any = {
        type: "restaurant",
        statut: "confirmee",
        gracePeriodMinutes: 15,
        ...payload,
      };
      return createDoc<Reservation>(tenantId, "reservations", r);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reservationsKeys.all });
      qc.invalidateQueries({ queryKey: ["tables"] });
    },
  });
}

export function useUpdateRestoReservation() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Partial<Reservation> & { id: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const { id, ...data } = payload;
      await updateTenantDoc(tenantId, "reservations", id, data);
      return { id, ...data };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: reservationsKeys.all }),
  });
}

export function useDeleteRestoReservation() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      await deleteTenantDoc(tenantId, "reservations", id);
      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reservationsKeys.all });
      qc.invalidateQueries({ queryKey: ["tables"] });
    },
  });
}

async function generateHebergementInvoice(tenantId: string, reservation: Reservation) {
  try {
    const ch = await fetchDoc<Chambre>(tenantId, "chambres", reservation.chambreId);
    const cli = await fetchDoc<any>(tenantId, "clients", reservation.clientId);
    const configDoc = await fetchDoc<TenantConfig>(tenantId, "config", "main");
    
    const dStart = new Date(reservation.dateDebut);
    const dEnd = new Date(reservation.dateFin || reservation.dateDebut);
    const nights = eachDayOfInterval({ start: dStart, end: dEnd }).length - 1 || 1; // -1 because last day is checkout day, fallback to 1
    
    const hasBreakfast = (reservation.notes?.toLowerCase().includes("pdj inclus") || reservation.notes?.toLowerCase().includes("petit déj"));
    const breakfastPrice = configDoc?.breakfastPrice ?? 15000;
    const breakfastTotal = hasBreakfast ? (breakfastPrice * nights * (reservation.nbPersonnes || 1)) : 0;
    
    const tarif = ch?.tarif_base ?? 0;
    const total = tarif * nights + breakfastTotal;
    
    const lignes = [{ description: `Nuitée ${ch?.numero ?? reservation.chambreId} (${dStart.toLocaleDateString()} – ${dEnd.toLocaleDateString()})`, qte: nights, pu: tarif }];
    if (hasBreakfast) {
      lignes.push({ description: "Petit Déjeuner Inclus", qte: nights * (reservation.nbPersonnes || 1), pu: breakfastPrice });
    }

    const prefix = configDoc?.invoicePrefix || "RESI";
    const numero = `${prefix}-${dStart.getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;

    const created = {
      numero,
      date: new Date().toISOString(),
      dueDate: addDays(dStart, 15).toISOString(),
      reservationId: reservation.id,
      clientNom: cli?.nom ?? reservation.clientId,
      source: "Hebergement" as const,
      lignes,
      totalTTC: total,
      statut: "emise" as const,
    };
    
    await createDoc(tenantId, "factures", created);
  } catch (error) {
    console.error("Erreur lors de la génération de la facture:", error);
  }
}

export function useCreateHebergementReservation() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  // TODO: Implement invoice generation
  return useMutation({
    mutationFn: async (payload: Omit<Reservation, "id" | "type" | "gracePeriodMinutes"> & { type?: "hebergement" }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const r: any = {
        type: "hebergement",
        gracePeriodMinutes: 0,
        ...payload,
      };
      const created = await createDoc<Reservation>(tenantId, "reservations", r);
      
      if (["confirmee", "arrivee"].includes(created.statut as any)) {
        await generateHebergementInvoice(tenantId, created);
      }
      
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reservationsKeys.all });
      qc.invalidateQueries({ queryKey: ["factures"] });
    },
  });
}

export function useUpdateHebergementReservation() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Partial<Reservation> & { id: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const { id, ...data } = payload;
      
      // On récupère l'ancienne réservation pour voir si le statut change
      const prev = await fetchDoc<Reservation>(tenantId, "reservations", id);
      
      await updateTenantDoc(tenantId, "reservations", id, data);
      
      // Auto-generate invoice logic
      if (
        prev &&
        prev.type === "hebergement" &&
        !["confirmee", "arrivee"].includes(prev.statut as any) &&
        ["confirmee", "arrivee"].includes(data.statut as any)
      ) {
        await generateHebergementInvoice(tenantId, { ...prev, ...data } as Reservation);
      }
      
      return { id, ...data };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reservationsKeys.all });
      qc.invalidateQueries({ queryKey: ["factures"] });
    },
  });
}

export function useAssignTable() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({ tableId, reservationId }: { tableId: string, reservationId: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      return updateTenantDoc(tenantId, "reservations", reservationId, { tableId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: reservationsKeys.all }),
  });
}
