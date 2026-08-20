import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { fetchCollection, createDoc, updateTenantDoc } from "./utils";
import { Client } from "@shared/api";

export const clientsKeys = {
  all: ["clients"] as const,
};

export function useClients() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: clientsKeys.all,
    queryFn: async () => {
      if (!tenantId) return [];
      return fetchCollection<Client>(tenantId, "clients");
    },
    enabled: !!tenantId,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Partial<Client> & { nom: string; telephone?: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      return createDoc<Client>(tenantId, "clients", payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: clientsKeys.all }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Client> & { id: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      await updateTenantDoc(tenantId, "clients", id, data);
      return { id, ...data };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: clientsKeys.all }),
  });
}
