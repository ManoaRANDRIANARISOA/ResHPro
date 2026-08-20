import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

let credential;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY));
  } else {
    // Navigate back from server/ to project root where service-account.json is located
    const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
    credential = cert(serviceAccountPath);
  }
} catch (error) {
  console.error("Error loading service account credentials in backend. Please provide FIREBASE_SERVICE_ACCOUNT_KEY or service-account.json in the root directory.");
}

const adminApp = getApps().length === 0 && credential ? initializeApp({ credential }) : getApp();

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
