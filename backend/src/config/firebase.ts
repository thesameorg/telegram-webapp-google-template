import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let db: Firestore;

try {
  // Initialize Firebase Admin
  const serviceAccount: ServiceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  const app = initializeApp({
    credential: cert(serviceAccount),
  });

  // Export Firestore instance
  db = getFirestore(app);

  // Configure Firestore settings
  db.settings({
    ignoreUndefinedProperties: true,
  });
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error);
  throw error;
}

export { db };
