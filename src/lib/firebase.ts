import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword as fbSignInWithEmail,
  signOut as fbSignOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, enableMultiTabIndexedDbPersistence, type Firestore } from 'firebase/firestore';

let app: FirebaseApp | null = null;
let firestore: Firestore | null = null;

export function initFirebase() {
  if (app) return app;

  const options: FirebaseOptions = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };

  // Basic validation to avoid silent runtime failures when env vars are
  // missing or misconfigured in the Vite environment. This helps developers
  // quickly surface configuration issues instead of getting empty query
  // results with no obvious error.
  if (!options.projectId || !options.apiKey) {
    const msg = `Missing Firebase configuration: projectId=${String(options.projectId)}, apiKey=${String(options.apiKey)}`;
    // eslint-disable-next-line no-console
    console.error('[firebase] initFirebase - invalid config:', msg);
    throw new Error(msg);
  }

  app = initializeApp(options);

  try {
    firestore = getFirestore(app);
    void enableMultiTabIndexedDbPersistence(firestore).catch(async () => {
      try {
        await enableIndexedDbPersistence(firestore as Firestore);
      } catch {
        // Persistence is best-effort. The app still works without it.
      }
    });
  } catch {
    firestore = null;
  }

  return app;
}

export function getFirebaseApp() {
  return initFirebase();
}

export function getFirebaseDb() {
  if (!firestore) {
    if (!app) initFirebase();
    firestore = getFirestore(getFirebaseApp());
  }

  return firestore;
}

function ensureAuth() {
  if (!app) initFirebase();
  return getAuth();
}

export function getFirebaseAuth(): Auth {
  return ensureAuth();
}

export async function signInWithEmail(email: string, password: string) {
  const auth = ensureAuth();
  const credential = await fbSignInWithEmail(auth, email, password);
  return credential.user;
}

export async function signOutFirebase() {
  const auth = ensureAuth();
  return fbSignOut(auth);
}

export function onAuthChanged(cb: (user: User | null) => void) {
  const auth = ensureAuth();
  return onAuthStateChanged(auth, cb);
}

export function onFirebaseAuthStateChanged(auth: Auth, cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export async function getIdTokenForCurrentUser(forceRefresh = false) {
  const auth = ensureAuth();
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}
