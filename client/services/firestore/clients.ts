import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { fetchCollection, createDoc } from "./utils";

export const clientsKeys = {
  all: ["clients"] as const,
};

export function useClients() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: clientsKeys.all,
    queryFn: async () => {
      if (!tenantId) return [];
      return fetchCollection<any>(tenantId, "clients");
    },
    enabled: !!tenantId,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: { nom: string; telephone: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      return createDoc<any>(tenantId, "clients", payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: clientsKeys.all }),
  });
}
