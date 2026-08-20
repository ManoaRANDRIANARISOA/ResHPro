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
        return [];
      }
      
      // Déduplication de sécurité par login / email
      const uniqueMap = new Map<string, Utilisateur>();
      for (const u of list) {
        const key = u.login ? u.login.toLowerCase().trim() : u.id;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, u);
        }
      }
      return Array.from(uniqueMap.values());
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

      // 1. Tenter d'abord la création complète via le backend Express (Auth User + Firestore avec UID)
      try {
        const currentUser = auth.currentUser;
        if (currentUser && password) {
          const token = await currentUser.getIdToken();
          const response = await fetch("/api/users", {
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
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
              // Le serveur a déjà créé le document dans Firestore avec l'UID
              return data.user as Utilisateur;
            }
          }
        }
      } catch (err) {
        console.warn("API Express non disponible, bascule sur création Firestore directe:", err);
      }

      // 2. Fallback direct dans Firestore uniquement si le serveur n'a pas créé l'utilisateur
      const created = await createDoc<Utilisateur>(tenantId, "utilisateurs", userData);
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

export function useGenerateDefaultUsers() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const seeded: Utilisateur[] = [];
      const defaults = DEFAULT_USERS(tenantId);
      for (const u of defaults) {
        try {
          const created = await createDoc<Utilisateur>(tenantId, "utilisateurs", u);
          seeded.push(created);
        } catch (e) {
          console.error("Generate default user error", e);
        }
      }
      return seeded;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKeys.all }),
  });
}
