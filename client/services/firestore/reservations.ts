import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Reservation, Stay, getReservationStays, FactureLigne, isProformaDocument, isOfficialInvoice } from "@shared/api";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
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
      const stayPeriodLabel = `Séjour du ${sStart.toLocaleDateString("fr-FR")} au ${sEnd.toLocaleDateString("fr-FR")} — ${roomNumber}`;

      // Ligne Nuitée
      const roomMontant = tarif * nights;
      roomsTotal += roomMontant;
      roomLines.push({
        stayId: stay.id,
        stayPeriodText: stayPeriodLabel,
        description: `Nuitée ${roomNumber} (${sStart.toLocaleDateString("fr-FR")} – ${sEnd.toLocaleDateString("fr-FR")})`,
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

    const docType = options?.typeDocument || (reservation as any).typeDocument || "proforma";
    const targetedStayIds = targetedStays.map((s) => s.id);

    // 1. Détection stricte des documents existants pour cette réservation afin d'éviter tout doublon
    const allFactures = await fetchCollection<any>(tenantId, "factures");
    const isPartialStayBilling = Boolean(
      options?.stayIds &&
      options.stayIds.length > 0 &&
      options.stayIds.length < allStays.length
    );

    const linkedFactures = allFactures.filter((f) => {
      if (isPartialStayBilling) {
        // En facturation partielle par chambre/séjour, on ne lie que les factures ciblant précisément ces séjours
        const fStayIds: string[] = f.stayIds || [];
        return targetedStayIds.some((id) => fStayIds.includes(id));
      }
      return (
        f.reservationId === reservation.id ||
        f.reservationIds?.includes(reservation.id) ||
        (f.stayIds && Array.isArray(f.stayIds) && targetedStayIds.some((id) => f.stayIds.includes(id))) ||
        allStays.some((s) => s.invoiceId === f.id && targetedStayIds.includes(s.id))
      );
    });

    const existingFacture = linkedFactures.find((f) => !isProformaDocument(f) && f.statut !== "annulee");
    const existingProformas = linkedFactures.filter((f) => isProformaDocument(f) && f.statut !== "annulee");

    // CAS A : Une facture définitive active existe déjà pour cette réservation
    if (existingFacture) {
      // Annuler toute proforma obsolète restante pour éliminer les doublons d'affichage
      for (const p of existingProformas) {
        try {
          await updateTenantDoc(tenantId, "factures", p.id, {
            statut: "annulee",
            notes: `Proforma remplacée par la Facture Définitive ${existingFacture.numero}`,
          });
        } catch (e) {}
      }

      // Synchroniser la facture existante avec les derniers séjours/montants
      const updates: any = {
        lignes,
        sousTotal: total,
        totalTTC: total,
        stayIds: targetedStayIds,
        updatedAt: new Date().toISOString(),
      };
      if (reservation.clientId) updates.clientId = reservation.clientId;
      // Si la facture est déjà soldée / payée, on ne modifie pas ses montants comptables
      if (existingFacture.statut !== "payee") {
        await updateTenantDoc(tenantId, "factures", existingFacture.id, updates);
      }

      try {
        const updatedStays = allStays.map((s) => {
          if (targetedStays.some((ts) => ts.id === s.id)) {
            return { ...s, invoiceId: existingFacture.id };
          }
          return s;
        });
        await updateTenantDoc(tenantId, "reservations", reservation.id, { stays: updatedStays });
      } catch (err) {}

      return { ...existingFacture, ...updates };
    }

    // CAS B : L'utilisateur veut une FACTURE DÉFINITIVE et une proforma existe -> CONVERSION EN PLACE (Évite le doublon)
    if (docType === "facture" && existingProformas.length > 0) {
      const proformaToConvert = existingProformas[0];

      // Annuler d'éventuelles autres proformas orphelines
      for (let i = 1; i < existingProformas.length; i++) {
        try {
          await updateTenantDoc(tenantId, "factures", existingProformas[i].id, {
            statut: "annulee",
            notes: `Proforma doublon annulée au profit de ${proformaToConvert.numero}`,
          });
        } catch (e) {}
      }

      const updates: any = {
        typeDocument: "facture",
        numeroProformaInitiale: proformaToConvert.numeroProformaInitiale || proformaToConvert.numero,
        dateProformaInitiale: proformaToConvert.dateProformaInitiale || proformaToConvert.date,
        lignes,
        sousTotal: total,
        totalTTC: total,
        stayIds: targetedStayIds,
        reservationId: reservation.id,
        accompte: (reservation as any).accompte ?? proformaToConvert.accompte ?? 0,
        methodePaiementAccompte: (reservation as any).methodePaiementAccompte || proformaToConvert.methodePaiementAccompte || "especes",
        updatedAt: new Date().toISOString(),
      };
      if (reservation.clientId) updates.clientId = reservation.clientId;
      if (cli?.nom) updates.clientNom = cli.nom;
      if (cli?.telephone) updates.clientTelephone = cli.telephone;
      if (cli?.email) updates.clientEmail = cli.email;
      if (cli?.adresse) updates.clientAdresse = cli.adresse;
      if (cli?.agenceVoyage) updates.agenceVoyage = cli.agenceVoyage;

      await updateTenantDoc(tenantId, "factures", proformaToConvert.id, updates);

      try {
        const updatedStays = allStays.map((s) => {
          if (targetedStays.some((ts) => ts.id === s.id)) {
            return { ...s, invoiceId: proformaToConvert.id };
          }
          return s;
        });
        await updateTenantDoc(tenantId, "reservations", reservation.id, { stays: updatedStays });
      } catch (err) {}

      return { ...proformaToConvert, ...updates };
    }

    // CAS C : L'utilisateur demande une PROFORMA et une proforma existe déjà -> MISE À JOUR EN PLACE (Pas de nouvelle proforma)
    if (docType === "proforma" && existingProformas.length > 0) {
      const activeProforma = existingProformas[0];

      // Annuler d'éventuels doublons de proforma
      for (let i = 1; i < existingProformas.length; i++) {
        try {
          await updateTenantDoc(tenantId, "factures", existingProformas[i].id, {
            statut: "annulee",
            notes: `Proforma doublon annulée`,
          });
        } catch (e) {}
      }

      const updates: any = {
        lignes,
        sousTotal: total,
        totalTTC: total,
        stayIds: targetedStayIds,
        reservationId: reservation.id,
        accompte: (reservation as any).accompte ?? activeProforma.accompte ?? 0,
        methodePaiementAccompte: (reservation as any).methodePaiementAccompte || activeProforma.methodePaiementAccompte || "especes",
        updatedAt: new Date().toISOString(),
      };
      if (reservation.clientId) updates.clientId = reservation.clientId;
      if (cli?.nom) updates.clientNom = cli.nom;

      await updateTenantDoc(tenantId, "factures", activeProforma.id, updates);

      try {
        const updatedStays = allStays.map((s) => {
          if (targetedStays.some((ts) => ts.id === s.id)) {
            return { ...s, invoiceId: activeProforma.id };
          }
          return s;
        });
        await updateTenantDoc(tenantId, "reservations", reservation.id, { stays: updatedStays });
      } catch (err) {}

      return { ...activeProforma, ...updates };
    }

    // CAS D : Aucun document existant -> Création officielle avec suite séquentielle
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

    const created: any = {
      numero,
      typeDocument: docType,
      date: new Date().toISOString(),
      dueDate: new Date(reservation.dateDebut).toISOString(),
      reservationId: reservation.id,
      stayIds: targetedStayIds,
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
    if (reservation.createdBy) created.createdBy = reservation.createdBy;

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
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: Omit<Reservation, "id" | "type" | "gracePeriodMinutes"> & { type?: "hebergement" }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const chambreIds = payload.chambreIds && payload.chambreIds.length > 0
        ? payload.chambreIds
        : (payload.chambreId ? [payload.chambreId] : []);
      const primaryChambreId = chambreIds[0] || payload.chambreId || "";
      
      const createdBy = (payload as any).createdBy || user?.email || undefined;
      const r: any = {
        type: "hebergement",
        gracePeriodMinutes: 0,
        ...payload,
        chambreIds,
        chambreId: primaryChambreId,
        ...(createdBy ? { createdBy } : {}),
      };
      const created = await createDoc<Reservation>(tenantId, "reservations", r);
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
      
      // On récupère l'ancienne réservation pour voir si le statut ou les montants changent
      const prev = await fetchDoc<Reservation>(tenantId, "reservations", id);
      
      await updateTenantDoc(tenantId, "reservations", id, data);
      const mergedReservation = { ...prev, ...data, id } as Reservation;

      // Synchroniser avec les factures existantes rattachées à cette réservation
      const allFactures = await fetchCollection<any>(tenantId, "factures");
      const facturesLies = allFactures.filter((f) =>
        f.reservationId === id ||
        f.reservationIds?.includes(id) ||
        (f.stayIds && Array.isArray(f.stayIds) && (prev?.stays || []).some((s: any) => f.stayIds.includes(s.id))) ||
        (prev?.stays || []).some((s: any) => s.invoiceId === f.id)
      );

      if (facturesLies && facturesLies.length > 0) {
        const hasOfficial = facturesLies.some((f) => !isProformaDocument(f) && f.statut !== "annulee");
        for (const f of facturesLies) {
          if (hasOfficial && isProformaDocument(f) && f.statut !== "annulee") {
            // Proforma obsolète : l'annuler pour éviter le doublon d'affichage
            try {
              await updateTenantDoc(tenantId, "factures", f.id, {
                statut: "annulee",
                notes: "Proforma remplacée par la Facture Définitive active",
              });
            } catch (e) {}
            continue;
          }
          // Si la facture est déjà soldée, on ne modifie pas son acompte ni son client rétroactivement
          if (f.statut === "payee") {
            continue;
          }
          const invUpdates: any = {};
          if (data.accompte !== undefined) {
            invUpdates.accompte = Number(data.accompte || 0);
          }
          if (data.methodePaiementAccompte) {
            invUpdates.methodePaiementAccompte = data.methodePaiementAccompte;
          }
          if (data.clientId && data.clientId !== f.clientId) {
            const cli = await fetchDoc<any>(tenantId, "clients", data.clientId);
            if (cli) {
              invUpdates.clientId = cli.id;
              invUpdates.clientNom = cli.nom || "Client";
              if (cli.telephone) invUpdates.clientTelephone = cli.telephone;
              if (cli.email) invUpdates.clientEmail = cli.email;
              if (cli.adresse) invUpdates.clientAdresse = cli.adresse;
              if (cli.agenceVoyage) invUpdates.agenceVoyage = cli.agenceVoyage;
            }
          }
          if (Object.keys(invUpdates).length > 0) {
            await updateTenantDoc(tenantId, "factures", f.id, invUpdates);
          }
        }
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

      // Chercher si des factures sont liées à cette réservation
      const facturesLies = await fetchCollection<any>(tenantId, "factures", where("reservationId", "==", id));
      
      // Sécurité absolue des données en production :
      // Interdiction formelle de supprimer une réservation liée à une facture officielle ou réglée
      const officialOrPaid = facturesLies.find(
        (f) => isOfficialInvoice(f) || f.statut === "payee" || (Number(f.accompte || 0) > 0 && f.statut !== "annulee")
      );
      if (officialOrPaid) {
        throw new Error(
          `Suppression impossible : la facture officielle ${officialOrPaid.numero} est rattachée à cette réservation. Pour respecter les normes comptables et fiscales, une facture officielle ne peut pas être supprimée. Veuillez annuler la réservation au lieu de la supprimer.`
        );
      }

      // Supprimer uniquement les brouillons / proformas associés non encaissés
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
