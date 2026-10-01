import { useMemo } from "react";
import { useAppSelector } from "@/store";
import { useTenant } from "@/contexts/TenantContext";
import { Role } from "@shared/api";

export type { Role };

export const normalizeRole = (r?: string | null): Role => {
  if (!r) return "serveur";
  const clean = r.toLowerCase().trim();
  const map: Record<string, Role> = {
    admin: "admin",
    direction: "direction",
    dircom: "dircom",
    "dir. commerciale": "dircom",
    "dir. commerciale / ventes": "dircom",
    "direction commerciale": "dircom",
    "directeur commercial": "dircom",
    "commercial": "dircom",
    "commerciale": "dircom",
    resp_hebergement: "resp_hebergement",
    "responsable hebergement": "resp_hebergement",
    "responsable hébergement": "resp_hebergement",
    reception: "reception",
    "réception": "reception",
    "réception / accueil": "reception",
    resp_resto: "resp_resto",
    "responsable restaurant": "resp_resto",
    chef_salle: "chef_salle",
    "chef de salle": "chef_salle",
    "chef de salle / maître d'hôtel": "chef_salle",
    serveur: "serveur",
    "staff restaurant / serveur": "serveur",
    staff_resto: "serveur",
    staff_restaurant: "serveur",
    cuisine: "cuisine",
    "chef cuisinier": "cuisine",
    "chef cuisinier / cuisine": "cuisine",
    bar: "bar",
    "barman": "bar",
    "barman / bar": "bar",
    comptoir: "comptoir",
    "comptoir / caisse": "comptoir",
    economat: "economat",
    "économat": "economat",
    "économat / gestionnaire stock": "economat",
    comptable: "comptable",
    "comptable / trésorerie": "comptable",
  };
  return map[clean] || (clean as Role);
};

export const useRBAC = () => {
  const rawRole = useAppSelector((s) => s.session.role);
  const role = normalizeRole(rawRole);
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
      { label: "Stock", children: stock },
      { label: "Financier", children: financier },
    ];
    if (isRHActive) {
      adminSections.push({ label: "Ressources Humaines", children: rh });
    }
    adminSections.push({ label: "Administration", children: admin });

    const directionSections = [
      { label: "Hébergement", children: hebergement },
      { label: "Restaurant", children: resto },
      { label: "Stock", children: stock },
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

    const dircomSections = [
      {
        label: "Hébergement",
        children: [
          { label: "Planning des chambres", path: "/hebergement/gestion" },
          { label: "Fichier Clients", path: "/hebergement/clients" },
        ],
      },
      {
        label: "Financier",
        children: [{ label: "Mes Factures & Devis", path: "/financier" }],
      },
    ];

    const map: Record<Role, { label: string; children: { label: string; path: string }[] }[]> = {
      admin: adminSections,
      direction: directionSections,
      dircom: dircomSections,
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

  const isDircom = role === "dircom";
  const isAdmin = role === "admin";
  const isDirection = role === "direction";

  return { role, menu, isDircom, isAdmin, isDirection };
};

