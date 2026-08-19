import { useQuery } from "@tanstack/react-query";
import { TableResto } from "@shared/api";
import { useTenant } from "@/contexts/TenantContext";
import { fetchCollection } from "./utils";

export const tablesKeys = {
  all: ["tables"] as const,
};

export function useTables() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: tablesKeys.all,
    queryFn: async () => {
      if (!tenantId) return [];
      return fetchCollection<TableResto>(tenantId, "tables");
    },
    enabled: !!tenantId,
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
