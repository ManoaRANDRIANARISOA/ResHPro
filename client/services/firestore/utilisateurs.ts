import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Utilisateur } from "@shared/api";
import { useTenant } from "@/contexts/TenantContext";
import { fetchCollection, createDoc, updateTenantDoc, deleteTenantDoc } from "./utils";

export const usersKeys = {
  all: ["users"] as const,
};

export function useUsers() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: usersKeys.all,
    queryFn: async () => {
      if (!tenantId) return [];
      return fetchCollection<Utilisateur>(tenantId, "utilisateurs");
    },
    enabled: !!tenantId,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Omit<Utilisateur, "id"> & { password?: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      // Note: Creation of user auth happens in Firebase Auth via Cloud Function or setup script
      // This only creates the UI profile in Firestore
      const { password, ...data } = payload;
      return createDoc<Utilisateur>(tenantId, "utilisateurs", data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKeys.all }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Partial<Utilisateur> & { id: string; password?: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const { id, password, ...data } = payload;
      await updateTenantDoc(tenantId, "utilisateurs", id, data);
      return { id, ...data };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKeys.all }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      await deleteTenantDoc(tenantId, "utilisateurs", id);
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKeys.all }),
  });
}
