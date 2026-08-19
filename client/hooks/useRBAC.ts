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
  const { config } = useTenant();

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
      resto.push({ label: "Analyse des Écarts", path: "/resto/ecarts" });
    }
    resto.push({ label: "Événements", path: "/resto/evenements" });
    
    const stock = [
      { label: "Stock Hébergement", path: "/hebergement/stock" },
      { label: "Stock Restaurant", path: "/resto/stock" },
    ];
    if (config?.modules?.analyseEcarts) {
      stock.push({ label: "Analyse des Écarts", path: "/resto/ecarts" });
    }
    const financier = [{ label: "Financier", path: "/financier" }];
    const rapports = [{ label: "Rapports", path: "/rapports" }];
    const admin = [
      { label: "Gestion / Admin", path: "/admin" },
    ];

    const map: Record<Role, { label: string; children: { label: string; path: string }[] }[]> = {
      admin: [
        { label: "Hébergement", children: hebergement },
        { label: "Restaurant", children: resto },
        { label: "Financier", children: financier },
        { label: "Administration", children: admin },
      ],
      resp_hebergement: [
        { label: "Hébergement", children: hebergement },
        { label: "Financier", children: financier },
      ],
      resp_resto: [
        { label: "Restaurant", children: resto },
        { label: "Financier", children: financier },
      ],
      staff_resto: [{ label: "Restaurant", children: resto }],
      comptable: [{ label: "Financier", children: financier }],
      reception: [{ label: "Hébergement", children: hebergement }],
      chef_salle: [{ label: "Restaurant", children: resto }],
      serveur: [{ label: "Restaurant", children: resto }],
      cuisine: [{ label: "Restaurant", children: resto }],
      bar: [{ label: "Restaurant", children: resto }],
      comptoir: [{ label: "Restaurant", children: resto }],
      economat: [{ label: "Stock", children: stock }],
      direction: [
        { label: "Hébergement", children: hebergement },
        { label: "Restaurant", children: resto },
        { label: "Financier", children: financier },
      ],
    };

    return { base, sections: map[role] ?? [] };
  }, [role, config]);

  return { role, menu };
};
