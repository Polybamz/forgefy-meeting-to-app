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

/** Map a Firebase popup error to an actionable message, or null if the user
 * simply dismissed the popup (no error worth showing). */
export function oauthErrorMessage(err: unknown, providerName: string): string | null {
  const code = (err as { code?: string })?.code ?? "";
  const msg = err instanceof Error ? err.message : "";
  if (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    msg.includes("popup-closed") ||
    msg.includes("cancelled")
  ) {
    return null;
  }
  switch (code) {
    case "auth/account-exists-with-different-credential":
      return "This email is already registered with a different sign-in method. Try Google or email/password instead.";
    case "auth/operation-not-allowed":
      return `${providerName} sign-in is not enabled for this app yet.`;
    case "auth/unauthorized-domain":
      return "Sign-in isn't authorized from this domain yet. Please contact support.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Allow popups for this site and try again.";
    default:
      return `${providerName} sign-in failed${code ? ` (${code})` : ""}. Please try again.`;
  }
}
