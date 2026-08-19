import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Commande } from "@shared/api";
import { useTenant } from "@/contexts/TenantContext";
import { fetchCollection, createDoc, updateTenantDoc, fetchDoc } from "./utils";
import { where, increment } from "firebase/firestore";
import { MenuItem, StockProduit } from "@shared/api";
import { FicheTechnique } from "@shared/fiche-technique";

export const commandesKeys = {
  all: ["commandes"] as const,
};

export function useReservationCommandes(reservationId: string) {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: [...commandesKeys.all, reservationId],
    queryFn: async () => {
      if (!tenantId || !reservationId) return [];
      return fetchCollection<Commande>(tenantId, "commandes", where("reservationId", "==", reservationId));
    },
    enabled: !!tenantId && !!reservationId,
  });
}

export function useAddCommande() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Pick<Commande, "reservationId" | "menuItemId" | "quantite">) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const c: any = {
        statut: "saisie",
        ...payload,
      };
      return createDoc<Commande>(tenantId, "commandes", c);
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: [...commandesKeys.all, v.reservationId] }),
  });
}

export function useSendBatch() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({ reservationId }: { reservationId: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const commandes = await fetchCollection<Commande>(tenantId, "commandes", where("reservationId", "==", reservationId), where("statut", "==", "saisie"));
      
      const promises = commandes.map(c => 
        updateTenantDoc(tenantId, "commandes", c.id, { statut: "envoyee" })
      );
      
      await Promise.all(promises);
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: [...commandesKeys.all, v.reservationId] }),
  });
}

export function useCancelCommande() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({ id, motif }: { id: string, motif?: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      // Add motif to data if it's provided, otherwise just update statut
      const updateData: any = { statut: "annulee" };
      if (motif) {
        updateData.motif = motif;
      }
      await updateTenantDoc(tenantId, "commandes", id, updateData);
    },
    // We would need the reservationId to invalidate properly, assuming it's refetched or we invalidate all
    onSuccess: () => qc.invalidateQueries({ queryKey: commandesKeys.all }),
  });
}

export function useCancelPendingCommandesForReservation() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({ reservationId }: { reservationId: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const commandes = await fetchCollection<Commande>(tenantId, "commandes", where("reservationId", "==", reservationId));
      
      const promises = commandes
        .filter(c => c.statut === "saisie" || c.statut === "envoyee")
        .map(c => updateTenantDoc(tenantId, "commandes", c.id, { statut: "annulee" }));
        
      await Promise.all(promises);
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: [...commandesKeys.all, v.reservationId] }),
  });
}

export function useMarkServed() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  
  return useMutation({
    mutationFn: async ({ reservationId }: { reservationId: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      
      // We should ideally use a Cloud Function for this complex transaction
      // For now, we update the client-side logic to use Firestore
      const commandes = await fetchCollection<Commande>(tenantId, "commandes", where("reservationId", "==", reservationId), where("statut", "==", "envoyee"));
      
      // 1. Décrémenter le stock théorique
      for (const c of commandes) {
        if (!c.menuItemId) continue;
        const menuItem = await fetchDoc<MenuItem>(tenantId, "menu", c.menuItemId);
        if (menuItem?.ficheTechniqueId) {
          const fiche = await fetchDoc<FicheTechnique>(tenantId, "fiches-techniques", menuItem.ficheTechniqueId);
          if (fiche && fiche.ingredients) {
            const substitutions = c.substitutions || [];
            const removedIds = new Set(substitutions.map(s => s.removedProduitId));
            
            for (const ing of fiche.ingredients) {
              if (removedIds.has(ing.produitId)) continue;
              const qtyToDeduct = (ing.quantite / (fiche.portions || 1)) * c.quantite;
              await updateTenantDoc(tenantId, "stock", ing.produitId, {
                stockTheorique: increment(-qtyToDeduct)
              });
            }
            
            for (const sub of substitutions) {
              const qtyToDeduct = sub.quantite * c.quantite;
              await updateTenantDoc(tenantId, "stock", sub.addedProduitId, {
                stockTheorique: increment(-qtyToDeduct)
              });
            }
          }
        }
      }

      // 2. Marquer les commandes comme servies
      const promises = commandes.map(c => 
        updateTenantDoc(tenantId, "commandes", c.id, { statut: "servie" })
      );
      
      await Promise.all(promises);
    },
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: [...commandesKeys.all, v.reservationId] });
      qc.invalidateQueries({ queryKey: ["factures"] });
    },
  });
}

export function useEndOfService() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({ reservationId }: { reservationId: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      // Mettre à jour le statut de la réservation à "terminee"
      await updateTenantDoc(tenantId, "reservations", reservationId, { statut: "terminee" });
    },
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["tables"] });
    },
  });
}
