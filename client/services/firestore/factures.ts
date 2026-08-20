import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Facture } from "@shared/api";
import { useTenant } from "@/contexts/TenantContext";
import { fetchCollection, createDoc, updateTenantDoc, getTenantDoc, deleteTenantDoc } from "./utils";
import { addDays } from "date-fns";
import { FicheTechnique } from "@shared/fiche-technique";
import { writeBatch, increment } from "firebase/firestore";
import { db } from "@/services/firebase";

export const facturesKeys = {
  all: ["factures"] as const,
};

export function useFactures() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: facturesKeys.all,
    queryFn: async () => {
      if (!tenantId) return [];
      return fetchCollection<Facture>(tenantId, "factures");
    },
    enabled: !!tenantId,
  });
}

export function useCreateFacture() {
  const qc = useQueryClient();
  const { tenantId, config } = useTenant();
  return useMutation({
    mutationFn: async (payload: Omit<Facture, "id" | "date" | "dueDate" | "statut" | "numero"> & { date?: string, dueDate?: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      
      const dStart = payload.date ? new Date(payload.date) : new Date();
      const prefix = config?.invoicePrefix || "RESI";
      const numero = `${prefix}-${dStart.getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
      
      const f: any = {
        numero,
        date: dStart.toISOString(),
        dueDate: payload.dueDate || addDays(dStart, 15).toISOString(),
        statut: "emise",
        ...payload,
      };
      
      const createdFacture = await createDoc<Facture>(tenantId, "factures", f);

      // --- DÉCRÉMENTATION DES STOCKS ---
      if (payload.source === "Restaurant" && payload.lignes && payload.lignes.length > 0) {
        try {
          const fiches = await fetchCollection<FicheTechnique>(tenantId, "fiches-techniques");
          const batch = writeBatch(db);
          let hasDecrement = false;
          
          // Calculer les quantités à décrémenter par produit
          const decrements: Record<string, number> = {};

          for (const ligne of payload.lignes) {
            if (!ligne.menuItemId) continue;
            const fiche = fiches.find(f => f.menuItemId === ligne.menuItemId);
            if (!fiche) continue;

            const substitutions = ligne.substitutions || [];
            const removedIds = new Set(substitutions.map(s => s.removedProduitId));

            for (const ing of fiche.ingredients) {
              if (removedIds.has(ing.produitId)) continue;
              const qty = ing.quantite * ligne.qte;
              decrements[ing.produitId] = (decrements[ing.produitId] || 0) + qty;
            }

            for (const sub of substitutions) {
              const qty = sub.quantite * ligne.qte;
              decrements[sub.addedProduitId] = (decrements[sub.addedProduitId] || 0) + qty;
            }
          }

          // Fetch current stock levels to apply decrements
          if (Object.keys(decrements).length > 0) {
            const stockProduits = await fetchCollection<any>(tenantId, "stock");
            for (const [prodId, qtyToDecrement] of Object.entries(decrements)) {
              const prod = stockProduits.find(p => p.id === prodId);
              if (prod) {
                const docRef = getTenantDoc(tenantId, "stock", prodId);
                batch.update(docRef, { 
                  stockTheorique: increment(-qtyToDecrement),
                  updatedAt: new Date().toISOString()
                });
                hasDecrement = true;
              }
            }
            if (hasDecrement) {
              await batch.commit();
            }
          }
        } catch (err) {
          console.error("Erreur lors de la décrémentation du stock:", err);
        }
      }
      
      return createdFacture;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: facturesKeys.all });
      qc.invalidateQueries({ queryKey: ["stock"] });
    },
  });
}

export function useUpdateFactureStatut() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: Facture["statut"] }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      await updateTenantDoc(tenantId, "factures", id, { statut });
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: facturesKeys.all }),
  });
}

export function useUpdateFacture() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Partial<Facture> & { id: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const { id, ...data } = payload;
      await updateTenantDoc(tenantId, "factures", id, data);
      return { id, ...data };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: facturesKeys.all }),
  });
}

export function useDeleteFacture() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      await deleteTenantDoc(tenantId, "factures", id);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: facturesKeys.all }),
  });
}
