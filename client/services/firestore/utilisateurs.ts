import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Utilisateur } from "@shared/api";
import { useTenant } from "@/contexts/TenantContext";
import { fetchCollection, createDoc, updateTenantDoc, deleteTenantDoc } from "./utils";
import { auth } from "@/services/firebase-auth";

export const usersKeys = {
  all: ["users"] as const,
};

const DEFAULT_USERS = (tenantId: string): Omit<Utilisateur, "id">[] => [
  { nom: "Administrateur Système", login: `admin@${tenantId}.com`, role: "admin" },
  { nom: "Direction Générale", login: `direction@${tenantId}.com`, role: "direction" },
  { nom: "Responsable Hébergement", login: `hebergement@${tenantId}.com`, role: "resp_hebergement" },
  { nom: "Réception / Accueil", login: `reception@${tenantId}.com`, role: "reception" },
  { nom: "Chef Cuisinier", login: `cuisine@${tenantId}.com`, role: "cuisine" },
  { nom: "Comptable / Trésorerie", login: `compta@${tenantId}.com`, role: "comptable" },
];

export function useUsers() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: usersKeys.all,
    queryFn: async () => {
      if (!tenantId) return [];
      const list = await fetchCollection<Utilisateur>(tenantId, "utilisateurs");
      if (!list || list.length === 0) {
        const seeded: Utilisateur[] = [];
        const defaults = DEFAULT_USERS(tenantId);
        for (const u of defaults) {
          try {
            const created = await createDoc<Utilisateur>(tenantId, "utilisateurs", u);
            seeded.push(created);
          } catch (e) {
            console.error("Auto seed user error", e);
          }
        }
        return seeded.length > 0 ? seeded : defaults.map((d, i) => ({ id: `usr_${i}`, ...d } as Utilisateur));
      }
      return list;
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
      
      const { password, ...userData } = payload;

      // Création directe dans Firestore
      const created = await createDoc<Utilisateur>(tenantId, "utilisateurs", userData);

      // Appel optionnel du backend si disponible
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const token = await currentUser.getIdToken();
          await fetch("/api/users", {
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
        }
      } catch (err) {
        console.warn("API Express non disponible, utilisateur créé dans Firestore:", err);
      }

      return created;
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
