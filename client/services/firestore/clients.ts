import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { fetchCollection, createDoc, updateTenantDoc, deleteTenantDoc } from "./utils";
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

      const cleanNom = payload.nom.trim();
      const cleanTel = (payload.telephone || "").trim();

      // Dédoublonnage proactif: vérifier si un client avec le même nom (insensible à la casse) existe déjà
      const existingClients = await fetchCollection<Client>(tenantId, "clients");
      const duplicate = existingClients.find((c) => {
        const sameNom = (c.nom || "").trim().toLowerCase() === cleanNom.toLowerCase();
        if (!sameNom) return false;
        if (cleanTel && c.telephone) {
          return c.telephone.replace(/\s+/g, "") === cleanTel.replace(/\s+/g, "");
        }
        return true;
      });

      if (duplicate) {
        const updates: Partial<Client> = {};
        if (!duplicate.telephone && cleanTel) updates.telephone = cleanTel;
        if (!duplicate.email && payload.email) updates.email = payload.email.trim();
        if (!duplicate.agenceVoyage && payload.agenceVoyage) updates.agenceVoyage = payload.agenceVoyage.trim();
        if (!duplicate.origine && payload.origine) updates.origine = payload.origine.trim();

        if (Object.keys(updates).length > 0) {
          await updateTenantDoc(tenantId, "clients", duplicate.id, updates);
          return { ...duplicate, ...updates };
        }
        return duplicate;
      }

      return createDoc<Client>(tenantId, "clients", {
        ...payload,
        nom: cleanNom,
        telephone: cleanTel || undefined,
      });
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

export function useDeleteClient() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (clientId: string) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      // Double garde-fou de sécurité : ne jamais supprimer un client ayant un historique
      const reservations = await fetchCollection<any>(tenantId, "reservations");
      const hasRes = reservations.some((r) => r.clientId === clientId);
      if (hasRes) {
        throw new Error("Impossible de supprimer ce client : des réservations lui sont associées.");
      }
      const factures = await fetchCollection<any>(tenantId, "factures");
      const hasFac = factures.some((f) => f.clientId === clientId);
      if (hasFac) {
        throw new Error("Impossible de supprimer ce client : des factures lui sont associées.");
      }
      await deleteTenantDoc(tenantId, "clients", clientId);
      return clientId;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: clientsKeys.all }),
  });
}
