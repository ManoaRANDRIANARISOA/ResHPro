import { createContext, useContext, useState, useEffect, PropsWithChildren } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import { TenantConfig, TenantPublicConfig } from "@shared/tenant";

interface TenantContextType {
  tenantId: string | null;
  publicConfig: TenantPublicConfig | null;
  config: TenantConfig | null;
  logo: string;
  isLoading: boolean;
  error: Error | null;
  refreshConfig: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | null>(null);

export function TenantProvider({ children }: PropsWithChildren) {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [publicConfig, setPublicConfig] = useState<TenantPublicConfig | null>(null);
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  async function loadTenant() {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      // 1. Charge la config publique (accessible sans authentification)
      const publicDoc = await getDoc(doc(db, `tenants/${tenantId}/publicConfig/main`));
      if (publicDoc.exists()) {
        setPublicConfig(publicDoc.data() as TenantPublicConfig);
      } else {
        setPublicConfig({
          nom: "Établissement inconnu",
          logoUrl: "",
          theme: { primary: "#000", secondary: "#333", gradient: "" }
        });
        setError(new Error("Établissement introuvable"));
      }

      // 2. On essaie de charger la config complète
      try {
        const configDoc = await getDoc(doc(db, `tenants/${tenantId}/config/main`));
        if (configDoc.exists()) {
          setConfig(configDoc.data() as TenantConfig);
        }
      } catch (e: any) {
        if (e.code !== 'permission-denied') {
          console.error("Erreur chargement config:", e);
        }
      }

    } catch (err: any) {
      console.error("Erreur chargement publicConfig:", err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTenant();
  }, [tenantId]);

  const logo = tenantId === 'okalodge' 
    ? '/assets/logo-oka.jpeg?v=' + new Date().getTime() 
    : (publicConfig?.logoUrl || '/assets/default-logo.jpg');

  useEffect(() => {
    const title = publicConfig?.nom 
      ? `${publicConfig.nom} — ResiPro` 
      : "ResiPro — Logiciel Hôtellerie & Restauration";
    document.title = title;
    
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = logo;
  }, [publicConfig, logo]);

  return (
    <TenantContext.Provider value={{ tenantId: tenantId || null, publicConfig, config, logo, isLoading, error, refreshConfig: loadTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant doit être utilisé à l'intérieur d'un TenantProvider");
  }
  return context;
}
