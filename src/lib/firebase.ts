import { initializeApp, getApps } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GithubAuthProvider,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
};

// Avoid re-initializing on hot reloads
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

export type OAuthProviderName = "google" | "github";

/**
 * Opens the provider's sign-in popup and returns a Firebase ID token
 * that can be sent to POST /api/v1/auth/oauth.
 */
export async function signInWithOAuth(provider: OAuthProviderName): Promise<string> {
  const result = await signInWithPopup(
    auth,
    provider === "github" ? githubProvider : googleProvider,
  );
  return result.user.getIdToken();
}
