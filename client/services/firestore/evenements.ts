import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Evenement } from "@shared/api";
import { useTenant } from "@/contexts/TenantContext";
import { fetchCollection, createDoc, updateTenantDoc } from "./utils";

export const eventsKeys = {
  all: ["events"] as const,
};

export function useEvenements() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: eventsKeys.all,
    queryFn: async () => {
      if (!tenantId) return [];
      return fetchCollection<Evenement>(tenantId, "evenements");
    },
    enabled: !!tenantId,
  });
}

export function useCreateEvenement() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Omit<Evenement, "id">) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      return createDoc<Evenement>(tenantId, "evenements", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventsKeys.all });
      // Invalidation des factures si besoin dans un contexte global
      qc.invalidateQueries({ queryKey: ["factures"] });
    },
  });
}

export function useUpdateEvenement() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Partial<Evenement> & { id: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const { id, ...data } = payload;
      await updateTenantDoc(tenantId, "evenements", id, data);
      return { id, ...data };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventsKeys.all });
      qc.invalidateQueries({ queryKey: ["factures"] });
    },
  });
}
