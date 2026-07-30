import { createContext, useContext, useState, PropsWithChildren, useEffect } from "react";
import { db } from "@/services/local-db";
import { useAppDispatch, setRole } from "@/store";

interface User {
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ROLE_MAP: Record<string, import("@/hooks/useRBAC").Role> = {
  admin: "admin",
  reception: "resp_hebergement",
  "responsable hebergement": "resp_hebergement",
  chef_salle: "resp_resto",
  "responsable restaurant": "resp_resto",
  serveur: "staff_resto",
  cuisine: "staff_resto",
  bar: "staff_resto",
  comptoir: "staff_resto",
  economat: "economat",
  comptable: "comptable",
  direction: "admin",
  staff_restaurant: "staff_resto",
  saff_restaurant: "staff_resto",
};

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem("okalodge_session_user");
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.warn("Failed to restore session", e);
      return null;
    }
  });
  
  const dispatch = useAppDispatch();

  // Sync role on mount and when user changes
  useEffect(() => {
    if (user) {
      const r = ROLE_MAP[user.role] || "admin";
      dispatch(setRole(r as any));
    }
  }, [user, dispatch]);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Simulation de latence
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Recherche du compte par login (email)
    const found = db.utilisateurs.find((u) => u.login.toLowerCase() === email.toLowerCase());
    if (!found) return false;
    const auth = db.userAuth;
    const ok = auth[found.login] && auth[found.login] === password;
    if (!ok) return false;

    // Mettre à jour le contexte et le store (RBAC)
    const newUser = { email: found.login, name: found.nom, role: found.role };
    setUser(newUser);
    localStorage.setItem("okalodge_session_user", JSON.stringify(newUser));
    
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("okalodge_session_user");
    // Optionnel: réinitialiser le rôle (on conserve le rôle actuel pour éviter le flicker du menu)
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé dans un AuthProvider");
  }
  return context;
}
