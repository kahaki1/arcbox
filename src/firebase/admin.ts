import "dotenv/config";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export function firebaseConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}

export function firebaseWebConfig() {
  return {
    apiKey: process.env.FIREBASE_WEB_API_KEY ?? "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.FIREBASE_PROJECT_ID ?? "",
    appId: process.env.FIREBASE_APP_ID ?? "",
  };
}

export function firebaseWebReady(): boolean {
  const web = firebaseWebConfig();
  return Boolean(web.apiKey && web.authDomain && web.projectId && web.appId);
}

function app(): App {
  if (!firebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
    );
  }
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    }),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

export function adminAuth(): Auth {
  return getAuth(app());
}

export function adminDb(): Firestore {
  return getFirestore(app());
}

export async function getOrCreateFirebaseUser(email: string): Promise<{ uid: string; email: string }> {
  const auth = adminAuth();
  try {
    const user = await auth.getUserByEmail(email);
    return { uid: user.uid, email: user.email ?? email };
  } catch {
    const created = await auth.createUser({
      email,
      emailVerified: true,
    });
    return { uid: created.uid, email };
  }
}

export async function verifyGoogleIdToken(idToken: string): Promise<{ uid: string; email: string }> {
  const decoded = await adminAuth().verifyIdToken(idToken);
  const email = decoded.email?.toLowerCase();
  if (!email) {
    throw new Error("Google account has no email.");
  }
  return { uid: decoded.uid, email };
}
