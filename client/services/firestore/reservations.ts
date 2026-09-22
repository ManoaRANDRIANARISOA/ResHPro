import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Reservation, Stay, getReservationStays, FactureLigne } from "@shared/api";
import { useTenant } from "@/contexts/TenantContext";
import { fetchCollection, createDoc, updateTenantDoc, deleteTenantDoc } from "./utils";
import { where, runTransaction, doc } from "firebase/firestore";
import { db } from "@/services/firebase";
import { useCreateFacture } from "./factures";
import { eachDayOfInterval, addDays } from "date-fns";
import { fetchDoc } from "./utils";
import { Chambre } from "@shared/api";
import { TenantConfig, DEFAULT_HEBERGEMENT_TAXES, HebergementTaxe } from "@shared/tenant";

export const reservationsKeys = {
  all: ["reservations"] as const,
};

/**
 * Vérifie si une réservation concerne la chambre spécifiée
 */
export function reservationHasRoom(r: Reservation, roomId: string): boolean {
  if (r.type !== "hebergement") return false;
  const stays = getReservationStays(r);
  return stays.some((s) => s.chambreId === roomId);
}

/**
 * Calcule l'intervalle réel [resDebut, resFin) pour une chambre donnée au sein d'une réservation.
 * Prend en charge les séjours multiples et les dates spécifiques par séjour.
 */
export function getReservationRoomInterval(
  r: Reservation,
  roomId?: string,
  dateRef?: Date
): { resDebut: Date; resFin: Date; stay?: Stay } {
  const stays = getReservationStays(r);
  let matchingStay: Stay | undefined;

  if (roomId && dateRef) {
    matchingStay = stays.find((s) => {
      if (s.chambreId !== roomId) return false;
      const start = new Date(s.dateDebut);
      const end = s.dateFin ? new Date(s.dateFin) : addDays(start, 1);
      return dateRef >= start && dateRef <= end;
    });
  }

  if (!matchingStay && roomId) {
    matchingStay = stays.find((s) => s.chambreId === roomId);
  }

  if (!matchingStay) {
    matchingStay = stays[0];
  }

  if (matchingStay) {
    const resDebut = new Date(matchingStay.dateDebut);
    const parsedFin = matchingStay.dateFin ? new Date(matchingStay.dateFin) : null;
    const resFin = parsedFin && parsedFin > resDebut ? parsedFin : addDays(resDebut, 1);
    return { resDebut, resFin, stay: matchingStay };
  }

  const resDebut = new Date(r.dateDebut);
  const parsedFin = r.dateFin ? new Date(r.dateFin) : null;
  const resFin = parsedFin && parsedFin > resDebut ? parsedFin : addDays(resDebut, 1);
  return { resDebut, resFin };
}

/**
 * Détermine si une chambre est réservée pendant l'intervalle [dStart, dEnd).
 * Pour une réservation multi-séjours, chaque séjour est évalué individuellement.
 * Les jours intermédiaires entre séjours non contigus restent libres.
 */
export function isRoomReservedDuring(
  r: Reservation,
  roomId: string,
  dStart: Date,
  dEnd: Date
): boolean {
  if (r.statut === "annulee" || (r as any).statut === "no_show") return false;
  const stays = getReservationStays(r);
  return stays.some((s) => {
    if (s.statut === "annulee" || s.statut === "no_show") return false;
    if (s.chambreId !== roomId) return false;
    const sStart = new Date(s.dateDebut);
    const sEnd = s.dateFin ? new Date(s.dateFin) : addDays(sStart, 1);
    const actualEnd = sEnd > sStart ? sEnd : addDays(sStart, 1);
    return sStart < dEnd && actualEnd > dStart;
  });
}

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

export async function generateHebergementInvoice(
  tenantId: string,
  reservation: Reservation,
  options?: {
    stayIds?: string[];
    typeDocument?: "proforma" | "facture" | "devis";
  }
) {
  try {
    const allStays = getReservationStays(reservation);
    const targetedStays =
      options?.stayIds && options.stayIds.length > 0
        ? allStays.filter((s) => options.stayIds!.includes(s.id))
        : allStays;

    const cli = await fetchDoc<any>(tenantId, "clients", reservation.clientId);
    const configDoc = await fetchDoc<TenantConfig>(tenantId, "config", "main");

    const roomLines: FactureLigne[] = [];
    const formulaLines: FactureLigne[] = [];
    const taxLines: FactureLigne[] = [];

    let roomsTotal = 0;
    let formulaTotal = 0;
    let taxesTotal = 0;

    const taxesList: HebergementTaxe[] =
      configDoc?.hebergementTaxes && configDoc.hebergementTaxes.length > 0
        ? configDoc.hebergementTaxes
        : DEFAULT_HEBERGEMENT_TAXES;

    for (const stay of targetedStays) {
      let room: Chambre | null = null;
      try {
        room = await fetchDoc<Chambre>(tenantId, "chambres", stay.chambreId);
      } catch {}

      const sStart = new Date(stay.dateDebut);
      const sEnd = new Date(stay.dateFin || stay.dateDebut);
      const nights = Math.max(1, eachDayOfInterval({ start: sStart, end: sEnd }).length - 1);
      const tarif = stay.tarifBase ?? room?.tarif_base ?? 0;
      const roomNumber = room?.numero ?? stay.chambreId;
      const stayPeriodLabel = `Séjour du ${sStart.toLocaleDateString("fr-FR")} au ${sEnd.toLocaleDateString("fr-FR")} — Ch. ${roomNumber}`;

      // Ligne Nuitée
      const roomMontant = tarif * nights;
      roomsTotal += roomMontant;
      roomLines.push({
        stayId: stay.id,
        stayPeriodText: stayPeriodLabel,
        description: `Nuitée Chambre ${roomNumber} (${sStart.toLocaleDateString("fr-FR")} – ${sEnd.toLocaleDateString("fr-FR")})`,
        qte: nights,
        pu: tarif,
      });

      // Ligne Pack / Formule
      const packNom = stay.packNom || reservation.packNom;
      const packPrix = stay.packPrix ?? reservation.packPrix;
      const packTypeCalcul = stay.packTypeCalcul || reservation.packTypeCalcul;
      const nbPersons = stay.nbPersonnes || reservation.nbPersonnes || 1;

      if (packNom && packPrix && packPrix > 0) {
        if (packTypeCalcul === "par_personne_nuit") {
          const qty = nights * nbPersons;
          formulaTotal += packPrix * qty;
          formulaLines.push({
            stayId: stay.id,
            stayPeriodText: stayPeriodLabel,
            description: `Formule ${packNom} (${nbPersons} pers. × ${nights} nuit${nights > 1 ? "s" : ""})`,
            qte: qty,
            pu: packPrix,
          });
        } else if (packTypeCalcul === "par_chambre_nuit") {
          formulaTotal += packPrix * nights;
          formulaLines.push({
            stayId: stay.id,
            stayPeriodText: stayPeriodLabel,
            description: `Formule ${packNom} (${nights} nuit${nights > 1 ? "s" : ""})`,
            qte: nights,
            pu: packPrix,
          });
        } else {
          // Forfait fixe
          formulaTotal += packPrix;
          formulaLines.push({
            stayId: stay.id,
            stayPeriodText: stayPeriodLabel,
            description: `Formule ${packNom} (Forfait séjour)`,
            qte: 1,
            pu: packPrix,
          });
        }
      }

      // Taxes de séjour
      taxesList
        .filter((t) => t.actif)
        .forEach((taxe) => {
          let qte = 1;
          let desc = taxe.nom;
          if (taxe.typeCalcul === "fixe") {
            qte = 1;
          } else if (taxe.typeCalcul === "par_nuitee") {
            qte = nights;
            desc = `${taxe.nom} (${nights} nuit${nights > 1 ? "s" : ""})`;
          } else if (taxe.typeCalcul === "par_chambre_nuitee") {
            qte = nights;
            desc = `${taxe.nom} (${nights} nuit${nights > 1 ? "s" : ""})`;
          } else if (taxe.typeCalcul === "par_personne_nuitee") {
            qte = nights * nbPersons;
            desc = `${taxe.nom} (${nbPersons} pers. × ${nights} nuit${nights > 1 ? "s" : ""})`;
          }
          const montant = taxe.montant * qte;
          taxesTotal += montant;
          taxLines.push({
            stayId: stay.id,
            stayPeriodText: stayPeriodLabel,
            description: desc,
            qte,
            pu: taxe.montant,
          });
        });
    }

    const total = roomsTotal + formulaTotal + taxesTotal;
    const lignes = [...roomLines, ...formulaLines, ...taxLines];

    const prefix = configDoc?.invoicePrefix || "RESI";
    const dFirst = targetedStays.length > 0 ? new Date(targetedStays[0].dateDebut) : new Date();
    const year = dFirst.getFullYear();
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
    const docType = options?.typeDocument || (reservation as any).typeDocument || "proforma";

    const created: any = {
      numero,
      typeDocument: docType,
      date: new Date().toISOString(),
      dueDate: new Date(reservation.dateDebut).toISOString(),
      reservationId: reservation.id,
      stayIds: targetedStays.map((s) => s.id),
      clientId: reservation.clientId || "",
      clientNom: cli?.nom ?? (reservation.clientId || "Client"),
      source: "Hebergement" as const,
      lignes,
      sousTotal: total,
      remisePourcentage: 0,
      remiseMontant: 0,
      totalTTC: total,
      accompte: (reservation as any).accompte || 0,
      methodePaiementAccompte: (reservation as any).methodePaiementAccompte || "especes",
      modePaiement: "especes",
      statut: "emise" as const,
    };
    if (cli?.telephone) created.clientTelephone = cli.telephone;
    if (cli?.email) created.clientEmail = cli.email;
    if (cli?.adresse) created.clientAdresse = cli.adresse;
    if (cli?.agenceVoyage) created.agenceVoyage = cli.agenceVoyage;

    const createdDoc = await createDoc<any>(tenantId, "factures", created);

    // Mettre à jour les séjours dans la réservation avec invoiceId
    try {
      const updatedStays = allStays.map((s) => {
        if (targetedStays.some((ts) => ts.id === s.id)) {
          return { ...s, invoiceId: createdDoc.id };
        }
        return s;
      });
      await updateTenantDoc(tenantId, "reservations", reservation.id, { stays: updatedStays });
    } catch (err) {
      console.warn("Could not update stays in reservation with invoiceId", err);
    }

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
    mutationFn: async (
      args:
        | Reservation
        | {
            reservation: Reservation;
            stayIds?: string[];
            typeDocument?: "proforma" | "facture" | "devis";
          }
    ) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const reservation = "type" in args && "id" in args ? (args as Reservation) : args.reservation;
      const stayIds = "stayIds" in args ? args.stayIds : undefined;
      const typeDocument = "typeDocument" in args ? args.typeDocument : undefined;
      return generateHebergementInvoice(tenantId, reservation, { stayIds, typeDocument });
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
  return useMutation({
    mutationFn: async (payload: Omit<Reservation, "id" | "type" | "gracePeriodMinutes"> & { type?: "hebergement" }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const chambreIds = payload.chambreIds && payload.chambreIds.length > 0
        ? payload.chambreIds
        : (payload.chambreId ? [payload.chambreId] : []);
      const primaryChambreId = chambreIds[0] || payload.chambreId || "";
      
      const r: any = {
        type: "hebergement",
        gracePeriodMinutes: 0,
        ...payload,
        chambreIds,
        chambreId: primaryChambreId,
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
      
      if (data.chambreIds && data.chambreIds.length > 0 && !data.chambreId) {
        data.chambreId = data.chambreIds[0];
      }
      
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

export function useDeleteHebergementReservation() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");

      // Chercher si une facture est liée à cette réservation
      const facturesLies = await fetchCollection<any>(tenantId, "factures", where("reservationId", "==", id));
      
      // Supprimer la/les facture(s)
      for (const facture of facturesLies) {
        await deleteTenantDoc(tenantId, "factures", facture.id);
      }

      // Supprimer la réservation
      await deleteTenantDoc(tenantId, "reservations", id);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reservationsKeys.all });
      qc.invalidateQueries({ queryKey: ["factures"] });
    },
  });
}
