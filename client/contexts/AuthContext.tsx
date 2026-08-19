import { createContext, useContext, PropsWithChildren, useEffect } from "react";
import { useFirebaseAuth, signInWithEmailAndPassword, signOut } from "@/services/firebase-auth";
import { useAppDispatch, setRole } from "@/store";
import { Role } from "@/hooks/useRBAC";

interface AuthUser {
  uid: string;
  email: string | null;
  tenantId: string | null;
  role: Role | null;
  superAdmin: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const { user, loading, auth } = useFirebaseAuth();
  const dispatch = useAppDispatch();

  // Sync role to Redux when user changes
  useEffect(() => {
    if (user && user.role) {
      dispatch(setRole(user.role));
    } else if (user && user.superAdmin) {
      // Pour le superAdmin, on lui donne un role admin par défaut
      dispatch(setRole("admin"));
    }
  }, [user, dispatch]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (error) {
      console.error("Login failed", error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading: loading,
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
