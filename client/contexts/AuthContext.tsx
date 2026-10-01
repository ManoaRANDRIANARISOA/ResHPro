import { createContext, useContext, PropsWithChildren, useEffect, useState, useMemo } from "react";
import { useFirebaseAuth, signInWithEmailAndPassword, signOut, AuthUser, auth } from "@/services/firebase-auth";
import { useAppDispatch, setRole } from "@/store";
import { Role, normalizeRole } from "@/hooks/useRBAC";
import { db } from "@/services/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const { user: rawUser, loading: authLoading } = useFirebaseAuth();
  const [syncedUser, setSyncedUser] = useState<AuthUser | null>(null);
  const dispatch = useAppDispatch();

  // Initialiser syncedUser dès que rawUser change
  useEffect(() => {
    if (rawUser) {
      setSyncedUser((prev) => {
        if (!prev || prev.uid !== rawUser.uid) {
          return rawUser;
        }
        return {
          ...rawUser,
          role: prev.role || rawUser.role,
          displayName: prev.displayName || rawUser.displayName,
        };
      });
    } else {
      setSyncedUser(null);
    }
  }, [rawUser]);

  // Synchronisation dynamique en temps réel avec le document Firestore (tenants/{tenantId}/utilisateurs)
  useEffect(() => {
    const userToSync = syncedUser || rawUser;
    if (!userToSync || !userToSync.email) return;

    // Déterminer le tenantId
    let tenant = userToSync.tenantId;
    if (!tenant && typeof window !== "undefined") {
      const parts = window.location.pathname.split("/").filter(Boolean);
      if (parts.length > 0 && parts[0] !== "superadmin" && parts[0] !== "login") {
        tenant = parts[0];
      }
    }

    if (!tenant) return;

    const email = userToSync.email.toLowerCase().trim();
    const collRef = collection(db, `tenants/${tenant}/utilisateurs`);
    const q = query(collRef, where("login", "==", email));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data();
          if (docData.role) {
            const dynamicRole = normalizeRole(docData.role);
            setSyncedUser((prev) => {
              const base = prev || userToSync;
              return {
                ...base,
                role: dynamicRole,
                displayName: docData.nom || base.displayName,
                statut: docData.statut || "Actif",
              };
            });
            dispatch(setRole(dynamicRole));
          }
        }
      },
      (err) => {
        console.warn("Écoute profil Firestore utilisateurs:", err.message);
      }
    );

    return () => unsubscribe();
  }, [rawUser?.email, rawUser?.tenantId, dispatch]);

  const activeUser = syncedUser || rawUser;

  // Synchronisation du rôle vers Redux
  useEffect(() => {
    if (activeUser && activeUser.role) {
      dispatch(setRole(activeUser.role));
    } else if (activeUser && activeUser.superAdmin) {
      dispatch(setRole("admin"));
    }
  }, [activeUser?.role, activeUser?.superAdmin, dispatch]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Force refresh du token pour récupérer instantanément les derniers custom claims serveur
      if (cred.user) {
        await cred.user.getIdTokenResult(true);
      }
      return true;
    } catch (error) {
      console.error("Login failed", error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setSyncedUser(null);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: activeUser,
        isAuthenticated: !!activeUser,
        isLoading: authLoading,
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
