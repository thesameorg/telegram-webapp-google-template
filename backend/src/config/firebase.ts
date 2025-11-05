import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// Skip Firebase initialization in dev mode with bypass auth
const isDevelopment = process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true';

let db: Firestore;

if (!isDevelopment) {
  // Initialize Firebase Admin for production
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
} else {
  console.log('⚠️  DEV MODE: Skipping Firebase initialization - using mock database');
  // Create a dummy Firestore object for type compatibility (will never be used)
  db = {} as Firestore;
}

export { db };
