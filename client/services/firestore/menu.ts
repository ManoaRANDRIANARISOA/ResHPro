import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MenuItem } from "@shared/api";
import { useTenant } from "@/contexts/TenantContext";
import { fetchCollection, createDoc, updateTenantDoc } from "./utils";

export const menuKeys = {
  all: ["menu"] as const,
};

export function useMenuItems() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: menuKeys.all,
    queryFn: async () => {
      if (!tenantId) return [];
      return fetchCollection<MenuItem>(tenantId, "menu");
    },
    enabled: !!tenantId,
  });
}

export function useCreateMenuItem() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Pick<MenuItem, "nom" | "categorieId" | "prix"> & Partial<Pick<MenuItem, "photoUrl" | "enabled">>) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const it = {
        enabled: true,
        ...payload,
      };
      return createDoc<MenuItem>(tenantId, "menu", it);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: menuKeys.all }),
  });
}

export function useUpdateMenuItem() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Partial<MenuItem> & { id: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const { id, ...data } = payload;
      await updateTenantDoc(tenantId, "menu", id, data);
      return { id, ...data };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: menuKeys.all }),
  });
}
