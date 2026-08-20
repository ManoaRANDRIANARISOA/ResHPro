import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Utilisateur } from "@shared/api";
import { useTenant } from "@/contexts/TenantContext";
import { fetchCollection, updateTenantDoc, deleteTenantDoc } from "./utils";
import { auth } from "@/services/firebase-auth";

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
      
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Vous devez être connecté");

      const token = await currentUser.getIdToken();
      
      const response = await fetch("http://localhost:8080/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          ...payload,
          tenantId
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erreur lors de la création de l'utilisateur");
      }

      return data.user;
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
