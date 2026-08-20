import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  IdTokenResult
} from "firebase/auth";
import { app } from "./firebase";
import { useEffect, useState } from "react";
import { Role } from "@/hooks/useRBAC";

export const auth = getAuth(app);

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  tenantId: string | null;
  role: Role | null;
  superAdmin: boolean;
}

/**
 * Extracts custom claims from a Firebase user
 */
export async function getAuthUser(user: FirebaseUser | null): Promise<AuthUser | null> {
  if (!user) return null;
  
  try {
    const tokenResult: IdTokenResult = await user.getIdTokenResult();
    const claims = tokenResult.claims;
    
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split('@')[0] || "Utilisateur",
      photoURL: user.photoURL || null,
      tenantId: (claims.tenantId as string) || null,
      role: (claims.role as Role) || null,
      superAdmin: !!claims.superAdmin
    };
  } catch (error) {
    console.error("Failed to get custom claims", error);
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split('@')[0] || "Utilisateur",
      photoURL: user.photoURL || null,
      tenantId: null,
      role: null,
      superAdmin: false
    };
  }
}

/**
 * Hook to manage Firebase Auth state
 */
export function useFirebaseAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const authUser = await getAuthUser(firebaseUser);
      setUser(authUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading, auth };
}

export { signInWithEmailAndPassword, signOut };
