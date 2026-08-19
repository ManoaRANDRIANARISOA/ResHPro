import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Ensure you have FIREBASE_SERVICE_ACCOUNT_KEY set in your .env or a service-account.json file
let credential;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY));
  } else {
    credential = cert("./service-account.json");
  }
} catch (error) {
  console.error("Error loading service account credentials. Please provide FIREBASE_SERVICE_ACCOUNT_KEY or service-account.json");
  process.exit(1);
}

initializeApp({
  credential
});

const auth = getAuth();

const usersToCreate = [
  // Super Admin
  {
    email: "manoa@resipro.admin",
    password: "superadmin2026",
    displayName: "Super Admin",
    claims: { superAdmin: true }
  },
  
  // Oka Lodge Users
  { email: "admin@okalodge.mg", password: "okalodge2025", displayName: "Oka Admin", claims: { tenantId: "oka-lodge", role: "admin" } },
  { email: "reception@okalodge.mg", password: "okalodge2025", displayName: "Oka Reception", claims: { tenantId: "oka-lodge", role: "reception" } },
  { email: "chef.salle@okalodge.mg", password: "okalodge2025", displayName: "Oka Chef Salle", claims: { tenantId: "oka-lodge", role: "chef_salle" } },
  { email: "serveur@okalodge.mg", password: "okalodge2025", displayName: "Oka Serveur", claims: { tenantId: "oka-lodge", role: "serveur" } },
  { email: "cuisine@okalodge.mg", password: "okalodge2025", displayName: "Oka Cuisine", claims: { tenantId: "oka-lodge", role: "cuisine" } },
  { email: "bar@okalodge.mg", password: "okalodge2025", displayName: "Oka Bar", claims: { tenantId: "oka-lodge", role: "bar" } },
  { email: "comptoir@okalodge.mg", password: "okalodge2025", displayName: "Oka Comptoir", claims: { tenantId: "oka-lodge", role: "comptoir" } },
  { email: "economat@okalodge.mg", password: "okalodge2025", displayName: "Oka Economat", claims: { tenantId: "oka-lodge", role: "economat" } },
  { email: "comptable@okalodge.mg", password: "okalodge2025", displayName: "Oka Comptable", claims: { tenantId: "oka-lodge", role: "comptable" } },
  { email: "direction@okalodge.mg", password: "okalodge2025", displayName: "Oka Direction", claims: { tenantId: "oka-lodge", role: "direction" } },
  
  // Kanana Users
  { email: "admin@kanana.mg", password: "kanana2026", displayName: "Kanana Admin", claims: { tenantId: "kanana", role: "admin" } },
  { email: "reception@kanana.mg", password: "kanana2026", displayName: "Kanana Reception", claims: { tenantId: "kanana", role: "reception" } }
];

async function setupAuth() {
  console.log("Starting Firebase Auth provisioning...");
  
  for (const user of usersToCreate) {
    try {
      let userRecord;
      
      // Try to get user first
      try {
        userRecord = await auth.getUserByEmail(user.email);
        console.log(`User ${user.email} already exists. Updating...`);
        // Update password if needed
        await auth.updateUser(userRecord.uid, { password: user.password });
      } catch (err: any) {
        if (err.code === "auth/user-not-found") {
          console.log(`Creating user ${user.email}...`);
          userRecord = await auth.createUser({
            email: user.email,
            password: user.password,
            displayName: user.displayName,
          });
        } else {
          throw err;
        }
      }
      
      // Set custom claims
      await auth.setCustomUserClaims(userRecord.uid, user.claims);
      console.log(`✅ Set claims for ${user.email}:`, user.claims);
      
    } catch (error) {
      console.error(`❌ Error provisioning ${user.email}:`, error);
    }
  }
  
  console.log("Provisioning complete!");
  process.exit(0);
}

setupAuth().catch(console.error);
