import { useMemo } from "react";
import { useAppSelector } from "@/store";
import { useTenant } from "@/contexts/TenantContext";

export type Role =
  | "admin"
  | "resp_hebergement"
  | "resp_resto"
  | "staff_resto"
  | "comptable"
  | "reception"
  | "chef_salle"
  | "serveur"
  | "cuisine"
  | "bar"
  | "comptoir"
  | "economat"
  | "direction";

export const useRBAC = () => {
  const role = useAppSelector((s) => s.session.role);
  const { config, tenantId } = useTenant();

  const isRHActive = Boolean(
    config?.modules?.rhPlanningPaie ?? (tenantId === "kanana" || tenantId === "demo")
  );

  const menu = useMemo(() => {
    const base = [{ label: "Dashboard", path: "/dashboard" }];
    const hebergement = [
      { label: "Gestion des chambres", path: "/hebergement/gestion" },
      { label: "Clients", path: "/hebergement/clients" },
      { label: "Stock", path: "/hebergement/stock" },
      { label: "Tarifs", path: "/hebergement/tarifs" },
    ];
    
    const resto = [
      { label: "Plan de salle", path: "/resto/plan" },
      { label: "Menu", path: "/resto/menu" },
    ];
    if (config?.modules?.fichesTechniques) {
      resto.push({ label: "Fiches Techniques", path: "/resto/fiches-techniques" });
    }
    resto.push({ label: "Stock", path: "/resto/stock" });
    if (config?.modules?.analyseEcarts) {
      resto.push({ label: "Qualité et Rentabilité", path: "/resto/ecarts" });
    }
    resto.push({ label: "Événements", path: "/resto/evenements" });
    
    const stock = [
      { label: "Stock Hébergement", path: "/hebergement/stock" },
      { label: "Stock Restaurant", path: "/resto/stock" },
    ];
    if (config?.modules?.analyseEcarts) {
      stock.push({ label: "Qualité et Rentabilité", path: "/resto/ecarts" });
    }
    const financier = [{ label: "Financier", path: "/financier" }];
    const rh = [
      { label: "Planning & Tâches", path: "/rh?tab=planning" },
      { label: "Gestion de la Paie", path: "/rh?tab=paie" },
      { label: "Présences & Pointages", path: "/rh?tab=pointages" },
      { label: "Avances sur Salaire", path: "/rh?tab=avances" },
      { label: "Personnel & Contrats", path: "/rh?tab=employes" },
    ];
    const rapports = [{ label: "Rapports", path: "/rapports" }];
    const admin = [
      { label: "Gestion / Admin", path: "/admin" },
    ];

    const adminSections = [
      { label: "Hébergement", children: hebergement },
      { label: "Restaurant", children: resto },
      { label: "Financier", children: financier },
    ];
    if (isRHActive) {
      adminSections.push({ label: "Ressources Humaines", children: rh });
    }
    adminSections.push({ label: "Administration", children: admin });

    const directionSections = [
      { label: "Hébergement", children: hebergement },
      { label: "Restaurant", children: resto },
      { label: "Financier", children: financier },
    ];
    if (isRHActive) {
      directionSections.push({ label: "Ressources Humaines", children: rh });
    }

    const comptableSections = [{ label: "Financier", children: financier }];
    if (isRHActive) {
      comptableSections.push({ label: "Ressources Humaines", children: rh });
    }

    const respHebergementSections = [
      { label: "Hébergement", children: hebergement },
      { label: "Financier", children: financier },
    ];
    if (isRHActive) {
      respHebergementSections.push({ label: "Ressources Humaines", children: rh });
    }

    const respRestoSections = [
      { label: "Restaurant", children: resto },
      { label: "Financier", children: financier },
    ];
    if (isRHActive) {
      respRestoSections.push({ label: "Ressources Humaines", children: rh });
    }

    const map: Record<Role, { label: string; children: { label: string; path: string }[] }[]> = {
      admin: adminSections,
      direction: directionSections,
      resp_hebergement: respHebergementSections,
      resp_resto: respRestoSections,
      staff_resto: [{ label: "Restaurant", children: resto }],
      comptable: comptableSections,
      reception: [{ label: "Hébergement", children: hebergement }],
      chef_salle: [{ label: "Restaurant", children: resto }],
      serveur: [{ label: "Restaurant", children: resto }],
      cuisine: [{ label: "Restaurant", children: resto }],
      bar: [{ label: "Restaurant", children: resto }],
      comptoir: [{ label: "Restaurant", children: resto }],
      economat: [{ label: "Stock", children: stock }],
    };

    return { base, sections: map[role] ?? [] };
  }, [role, config, isRHActive]);

  return { role, menu };
};
