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
    const base = [{ label: "Tableau de bord", path: "/dashboard" }];
    const hebergement = [
      { label: "Planning des chambres", path: "/hebergement/gestion" },
      { label: "Fichier Clients", path: "/hebergement/clients" },
      { label: "Tarifs & Catégories", path: "/hebergement/tarifs" },
      { label: "Stock Linge & Produits", path: "/hebergement/stock" },
    ];
    
    const resto = [
      { label: "Plan de salle (En direct)", path: "/resto/plan" },
      { label: "Carte & Menu", path: "/resto/menu" },
    ];
    if (config?.modules?.fichesTechniques) {
      resto.push({ label: "Fiches Techniques & Coûts", path: "/resto/fiches-techniques" });
    }
    resto.push({ label: "Stock Bar & Cuisine", path: "/resto/stock" });
    if (config?.modules?.analyseEcarts) {
      resto.push({ label: "Qualité & Rentabilité", path: "/resto/ecarts" });
    }
    resto.push({ label: "Événements & Banquets", path: "/resto/evenements" });
    
    const stock = [
      { label: "Stock Hébergement", path: "/hebergement/stock" },
      { label: "Stock Restaurant", path: "/resto/stock" },
    ];
    if (config?.modules?.analyseEcarts) {
      stock.push({ label: "Qualité et Rentabilité", path: "/resto/ecarts" });
    }
    const financier = [{ label: "Facturation & Caisse", path: "/financier" }];
    const rh = [
      { label: "Personnel & Contrats", path: "/rh?tab=employes" },
      { label: "Planning & Tâches", path: "/rh?tab=planning" },
      { label: "Présences & Pointages", path: "/rh?tab=pointages" },
      { label: "Avances sur Salaire", path: "/rh?tab=avances" },
      { label: "Gestion de la Paie", path: "/rh?tab=paie" },
    ];
    const admin = [
      { label: "Paramètres & Utilisateurs", path: "/admin" },
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
