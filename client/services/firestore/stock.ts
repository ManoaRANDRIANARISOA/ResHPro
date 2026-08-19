import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StockProduit } from "@shared/api";
import { useTenant } from "@/contexts/TenantContext";
import { fetchCollection, createDoc, updateTenantDoc, deleteTenantDoc } from "./utils";

export const stockKeys = {
  all: ["stock"] as const,
};

export function useStockProduits() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: stockKeys.all,
    queryFn: async () => {
      if (!tenantId) return [];
      return fetchCollection<StockProduit>(tenantId, "stock");
    },
    enabled: !!tenantId,
  });
}

// Alias for backward compatibility
export const useStock = useStockProduits;

export function useCreateStockProduit() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Omit<StockProduit, "id">) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      return createDoc<StockProduit>(tenantId, "stock", payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: stockKeys.all }),
  });
}

export function useUpdateStockProduit() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Partial<StockProduit> & { id: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const { id, ...data } = payload;
      await updateTenantDoc(tenantId, "stock", id, data);
      return { id, ...data };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: stockKeys.all }),
  });
}

export function useDeleteStockProduit() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      await deleteTenantDoc(tenantId, "stock", id);
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: stockKeys.all }),
  });
}

export function useAddJustification() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({ id, justification, currentPertes }: { id: string; justification: { quantite: number; motif: string; date: string }; currentPertes: any[] }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const updatedPertes = [...(currentPertes || []), justification];
      await updateTenantDoc(tenantId, "stock", id, { pertesJustifiees: updatedPertes });
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: stockKeys.all }),
  });
}
