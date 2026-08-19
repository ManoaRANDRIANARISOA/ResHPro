import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FicheTechnique } from "@shared/fiche-technique";
import { useTenant } from "@/contexts/TenantContext";
import { fetchCollection, fetchDoc, createDoc, updateTenantDoc, deleteTenantDoc } from "./utils";
import { where } from "firebase/firestore";

export const fichesTechniquesKeys = {
  all: ["fiches-techniques"] as const,
  byMenuItem: (menuItemId: string) => [...fichesTechniquesKeys.all, menuItemId] as const,
};

export function useFichesTechniques() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: fichesTechniquesKeys.all,
    queryFn: async () => {
      if (!tenantId) return [];
      return fetchCollection<FicheTechnique>(tenantId, "fiches-techniques");
    },
    enabled: !!tenantId,
  });
}

export function useFicheTechnique(menuItemId: string | null) {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: fichesTechniquesKeys.byMenuItem(menuItemId || ""),
    queryFn: async () => {
      if (!tenantId || !menuItemId) return null;
      const fiches = await fetchCollection<FicheTechnique>(
        tenantId,
        "fiches-techniques",
        where("menuItemId", "==", menuItemId)
      );
      return fiches.length > 0 ? fiches[0] : null;
    },
    enabled: !!tenantId && !!menuItemId,
  });
}

export function useCreateFicheTechnique() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Omit<FicheTechnique, "id" | "createdAt" | "updatedAt">) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const f: any = { ...payload };
      return createDoc<FicheTechnique>(tenantId, "fiches-techniques", f);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: fichesTechniquesKeys.all });
      qc.invalidateQueries({ queryKey: fichesTechniquesKeys.byMenuItem(data.menuItemId) });
    },
  });
}

export function useUpdateFicheTechnique() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Partial<FicheTechnique> & { id: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const { id, ...data } = payload;
      await updateTenantDoc(tenantId, "fiches-techniques", id, data);
      return { id, ...data };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fichesTechniquesKeys.all });
    },
  });
}

export function useDeleteFicheTechnique() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      await deleteTenantDoc(tenantId, "fiches-techniques", id);
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: fichesTechniquesKeys.all }),
  });
}
