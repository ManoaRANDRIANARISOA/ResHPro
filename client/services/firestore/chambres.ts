import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Chambre, ChambreMaintenance } from "@shared/api";
import { useTenant } from "@/contexts/TenantContext";
import { fetchCollection, createDoc, setDocWithId, deleteTenantDoc, updateTenantDoc } from "./utils";

export const chambresKeys = {
  all: ["chambres"] as const,
  maintenance: ["roomMaintenance"] as const,
};

export function useChambres() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: chambresKeys.all,
    queryFn: async () => {
      if (!tenantId) return [];
      return fetchCollection<Chambre>(tenantId, "chambres");
    },
    enabled: !!tenantId,
  });
}

export function useCreateChambre() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Omit<Chambre, "id" | "tenantId">) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      return createDoc<Chambre>(tenantId, "chambres", payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chambresKeys.all }),
  });
}

export function useUpdateChambre() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Partial<Chambre> & { id: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const { id, ...data } = payload;
      await updateTenantDoc(tenantId, "chambres", id, data);
      return { id, ...data };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chambresKeys.all }),
  });
}

export function useDeleteChambre() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      await deleteTenantDoc(tenantId, "chambres", id);
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chambresKeys.all }),
  });
}

export function useRoomMaintenance() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: chambresKeys.maintenance,
    queryFn: async () => {
      if (!tenantId) return [];
      return fetchCollection<ChambreMaintenance>(tenantId, "chambresMaintenance");
    },
    enabled: !!tenantId,
  });
}

export function useAddRoomMaintenance() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Pick<ChambreMaintenance, "chambreId" | "dateDebut" | "dateFin" | "notes">) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      // Mettre à jour le statut de la chambre
      await updateTenantDoc(tenantId, "chambres", payload.chambreId, { statut: "maintenance" });
      
      // Ajouter l'entrée de maintenance
      return createDoc<ChambreMaintenance>(tenantId, "chambresMaintenance", {
        ...payload,
        resolved: false
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chambresKeys.maintenance });
      qc.invalidateQueries({ queryKey: chambresKeys.all });
    },
  });
}

export function useRemoveRoomMaintenance() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      
      // Récupérer l'entrée pour avoir le chambreId
      const allMaint = await fetchCollection<ChambreMaintenance>(tenantId, "chambresMaintenance");
      const m = allMaint.find(x => x.id === id);
      
      if (m) {
        // Mettre à jour la chambre
        await updateTenantDoc(tenantId, "chambres", m.chambreId, { statut: "libre" });
        // Supprimer l'entrée de maintenance
        await deleteTenantDoc(tenantId, "chambresMaintenance", id);
      }
      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chambresKeys.maintenance });
      qc.invalidateQueries({ queryKey: chambresKeys.all });
    },
  });
}
