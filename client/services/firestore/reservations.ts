import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Reservation } from "@shared/api";
import { useTenant } from "@/contexts/TenantContext";
import { fetchCollection, createDoc, updateTenantDoc, deleteTenantDoc } from "./utils";
import { where, runTransaction, doc } from "firebase/firestore";
import { db } from "@/services/firebase";
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
    const nights = Math.max(1, eachDayOfInterval({ start: dStart, end: dEnd }).length - 1);

    // Calcul du pack / formule de séjour
    let formulaTotal = 0;
    const formulaLines: { description: string; qte: number; pu: number }[] = [];

    if (reservation.packNom && reservation.packPrix && reservation.packPrix > 0) {
      if (reservation.packTypeCalcul === "par_personne_nuit") {
        const qty = nights * (reservation.nbPersonnes || 1);
        formulaTotal = reservation.packPrix * qty;
        formulaLines.push({
          description: `Formule ${reservation.packNom} (${reservation.nbPersonnes || 1} pers. × ${nights} nuit${nights > 1 ? 's' : ''})`,
          qte: qty,
          pu: reservation.packPrix,
        });
      } else if (reservation.packTypeCalcul === "par_chambre_nuit") {
        formulaTotal = reservation.packPrix * nights;
        formulaLines.push({
          description: `Formule ${reservation.packNom} (${nights} nuit${nights > 1 ? 's' : ''})`,
          qte: nights,
          pu: reservation.packPrix,
        });
      } else {
        // forfait_fixe
        formulaTotal = reservation.packPrix;
        formulaLines.push({
          description: `Formule ${reservation.packNom} (Forfait séjour)`,
          qte: 1,
          pu: reservation.packPrix,
        });
      }
    } else {
      // Rétrocompatibilité avec les notes 'pdj inclus'
      const hasBreakfast = (reservation.notes?.toLowerCase().includes("pdj inclus") || reservation.notes?.toLowerCase().includes("petit déj"));
      const breakfastPrice = configDoc?.breakfastPrice ?? 15000;
      if (hasBreakfast) {
        const qty = nights * (reservation.nbPersonnes || 1);
        formulaTotal = breakfastPrice * qty;
        formulaLines.push({
          description: `Petit Déjeuner Inclus (${reservation.nbPersonnes || 1} pers. × ${nights} nuit${nights > 1 ? 's' : ''})`,
          qte: qty,
          pu: breakfastPrice,
        });
      }
    }

    const tarif = ch?.tarif_base ?? 0;
    const total = tarif * nights + formulaTotal;
    
    const lignes = [
      { description: `Nuitée Chambre ${ch?.numero ?? reservation.chambreId} (${dStart.toLocaleDateString('fr-FR')} – ${dEnd.toLocaleDateString('fr-FR')})`, qte: nights, pu: tarif },
      ...formulaLines
    ];

    const prefix = configDoc?.invoicePrefix || "RESI";
    
    // Génération atomique de la suite numérique
    const year = dStart.getFullYear();
    const yearPrefix = `${prefix}-${year}-`;
    const counterRef = doc(db, `tenants/${tenantId}/counters/factures_${year}`);
    
    let nextSequence = 1;
    try {
      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        if (!counterDoc.exists()) {
          transaction.set(counterRef, { current: 1 });
          nextSequence = 1;
        } else {
          nextSequence = counterDoc.data().current + 1;
          transaction.update(counterRef, { current: nextSequence });
        }
      });
    } catch (err) {
      console.error("Erreur lors de la génération du numéro de facture:", err);
      throw new Error("Impossible de générer le numéro de facture séquentiel.");
    }
    
    const numero = `${yearPrefix}${String(nextSequence).padStart(4, "0")}`;

    const created: any = {
      numero,
      date: new Date().toISOString(),
      dueDate: addDays(dStart, 15).toISOString(),
      reservationId: reservation.id,
      clientId: reservation.clientId || "",
      clientNom: cli?.nom ?? (reservation.clientId || "Client"),
      source: "Hebergement" as const,
      lignes,
      sousTotal: total,
      remisePourcentage: 0,
      remiseMontant: 0,
      totalTTC: total,
      modePaiement: "especes",
      statut: "emise" as const,
    };
    if (cli?.telephone) created.clientTelephone = cli.telephone;
    if (cli?.email) created.clientEmail = cli.email;
    if (cli?.adresse) created.clientAdresse = cli.adresse;
    if (cli?.agenceVoyage) created.agenceVoyage = cli.agenceVoyage;
    
    const createdDoc = await createDoc<any>(tenantId, "factures", created);
    return createdDoc;
  } catch (error) {
    console.error("Erreur lors de la génération de la facture:", error);
    throw error;
  }
}

export function useGenerateHebergementInvoice() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (reservation: Reservation) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      return generateHebergementInvoice(tenantId, reservation);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reservationsKeys.all });
      qc.invalidateQueries({ queryKey: ["factures"] });
    },
  });
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
