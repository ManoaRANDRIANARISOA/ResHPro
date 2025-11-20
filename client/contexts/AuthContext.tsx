import { createContext, useContext, useState, PropsWithChildren } from "react";
import { utilisateurs, userAuth } from "@/services/mock";
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

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const dispatch = useAppDispatch();

  const login = async (email: string, password: string): Promise<boolean> => {
    // Simulation de latence
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Recherche du compte par login (email)
    const found = utilisateurs.find((u) => u.login.toLowerCase() === email.toLowerCase());
    if (!found) return false;
    const ok = userAuth[found.login] && userAuth[found.login] === password;
    if (!ok) return false;

    // Mettre à jour le contexte et le store (RBAC)
    setUser({ email: found.login, name: found.nom, role: found.role });
    const map: Record<string, import("@/hooks/useRBAC").Role> = {
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
    const r = map[found.role] || "admin";
    dispatch(setRole(r as any));
    return true;
  };

  const logout = () => {
    setUser(null);
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
