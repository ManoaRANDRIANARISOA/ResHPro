// Re-exports all Firestore-based hooks for backward compatibility with components
export * from "./firestore/chambres";
export * from "./firestore/reservations";
export * from "./firestore/menu";
export * from "./firestore/commandes";
export * from "./firestore/factures";
export * from "./firestore/stock";
export * from "./firestore/evenements";
export * from "./firestore/clients";
export * from "./firestore/utilisateurs";
export * from "./firestore/tables";
export * from "./firestore/fiches-techniques";

// Ensure cloud sync is no longer needed with Firestore (it handles offline syncing automatically)
export async function ensureCloudSync(forceSeed = false) {
  console.log("ensureCloudSync called - ignored, Firestore handles sync natively");
  return Promise.resolve();
}
