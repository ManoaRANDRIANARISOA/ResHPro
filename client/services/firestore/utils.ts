import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  QueryConstraint
} from "firebase/firestore";
import { db } from "@/services/firebase";

/**
 * Retourne la référence à une collection pour un tenant donné
 */
export function getTenantCollection(tenantId: string, collectionName: string) {
  return collection(db, `tenants/${tenantId}/${collectionName}`);
}

/**
 * Retourne la référence à un document pour un tenant donné
 */
export function getTenantDoc(tenantId: string, collectionName: string, docId: string) {
  return doc(db, `tenants/${tenantId}/${collectionName}/${docId}`);
}

/**
 * Récupère tous les documents d'une collection
 */
export async function fetchCollection<T>(tenantId: string, collectionName: string, ...queryConstraints: QueryConstraint[]): Promise<T[]> {
  const colRef = getTenantCollection(tenantId, collectionName);
  const q = queryConstraints.length > 0 ? query(colRef, ...queryConstraints) : colRef;
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
}

/**
 * Récupère un document par son ID
 */
export async function fetchDoc<T>(tenantId: string, collectionName: string, docId: string): Promise<T | null> {
  const docRef = getTenantDoc(tenantId, collectionName, docId);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() } as T;
  }
  return null;
}

/**
 * Crée un nouveau document (avec ID auto-généré)
 */
export async function createDoc<T>(tenantId: string, collectionName: string, data: any): Promise<T> {
  const colRef = getTenantCollection(tenantId, collectionName);
  const docRef = await addDoc(colRef, { ...data, tenantId, createdAt: new Date().toISOString() });
  return { id: docRef.id, ...data, tenantId } as T;
}

/**
 * Crée ou écrase un document avec un ID spécifique
 */
export async function setDocWithId<T>(tenantId: string, collectionName: string, docId: string, data: any): Promise<T> {
  const docRef = getTenantDoc(tenantId, collectionName, docId);
  await setDoc(docRef, { ...data, tenantId, updatedAt: new Date().toISOString() });
  return { id: docId, ...data, tenantId } as T;
}

/**
 * Met à jour partiellement un document
 */
export async function updateTenantDoc(tenantId: string, collectionName: string, docId: string, data: any): Promise<void> {
  const docRef = getTenantDoc(tenantId, collectionName, docId);
  await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
}

/**
 * Supprime un document
 */
export async function deleteTenantDoc(tenantId: string, collectionName: string, docId: string): Promise<void> {
  const docRef = getTenantDoc(tenantId, collectionName, docId);
  await deleteDoc(docRef);
}
