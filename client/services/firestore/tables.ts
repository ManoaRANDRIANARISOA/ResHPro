import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TableResto } from "@shared/api";
import { useTenant } from "@/contexts/TenantContext";
import { fetchCollection, setDocWithId, deleteTenantDoc } from "./utils";

export const tablesKeys = {
  all: ["tables"] as const,
};

export const DEFAULT_TABLES: TableResto[] = Array.from({ length: 12 }, (_, i) => ({
  id: `T${i + 1}`,
  numero: `T${i + 1}`,
  capacite: (i % 3 === 0 ? 6 : i % 2 === 0 ? 4 : 2),
  statut: 'libre',
}));

export function useTables() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: tablesKeys.all,
    queryFn: async () => {
      if (!tenantId) return DEFAULT_TABLES;
      const list = await fetchCollection<TableResto>(tenantId, "tables");
      return (list && list.length > 0) ? list : DEFAULT_TABLES;
    },
    enabled: !!tenantId,
  });
}

export function useSaveTables() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (newTables: TableResto[]) => {
      if (!tenantId) throw new Error("Tenant ID required");
      const existing = await fetchCollection<TableResto>(tenantId, "tables");
      for (const ex of existing) {
        if (!newTables.find(t => t.id === ex.id)) {
          await deleteTenantDoc(tenantId, "tables", ex.id);
        }
      }
      for (const t of newTables) {
        await setDocWithId(tenantId, "tables", t.id, t);
      }
      return newTables;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tablesKeys.all });
    },
  });
}

export function getAvailableTimeSlots(date: Date, service: "midi" | "soir"): string[] {
  // Simplification - A déplacer potentiellement dans une cloud function 
  // ou à traiter via les réservations du jour côté client
  if (service === "midi") {
    return ["12:00", "12:30", "13:00", "13:30"];
  }
  return ["19:00", "19:30", "20:00", "20:30", "21:00"];
}

export function checkTableAvailability(
  tableId: string,
  date: Date,
  time: string,
  reservations: any[]
): boolean {
  // Helper basique - la logique complète nécessite d'analyser les réservations
  return true; 
}
