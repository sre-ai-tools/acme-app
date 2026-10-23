// Sign-in with the Cognito hosted UI (authorization code + PKCE).
//
// Tokens live only in memory (design D4): nothing is written to localStorage, so a reload
// signs in again, which the hosted UI's own session usually makes silent. Only the one-time
// PKCE verifier and state survive the redirect, in sessionStorage, and are removed on return.

import { config } from "../config";
import { codeChallenge, randomString } from "./pkce";

const PENDING_KEY = "incident-log.pkce";

interface Tokens {
  accessToken: string;
  expiresAt: number;
}

let tokens: Tokens | null = null;

export function accessToken(): string | null {
  if (!tokens || Date.now() >= tokens.expiresAt) return null;
  return tokens.accessToken;
}

export async function signIn(): Promise<void> {
  const verifier = randomString();
  const state = randomString(16);
  window.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state }));

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "openid email",
    state,
    code_challenge_method: "S256",
    code_challenge: await codeChallenge(verifier),
  });
  window.location.assign(`${config.cognitoDomain}/oauth2/authorize?${params}`);
}

export function signOut(): void {
  tokens = null;
  const params = new URLSearchParams({ client_id: config.clientId, logout_uri: config.redirectUri });
  window.location.assign(`${config.cognitoDomain}/logout?${params}`);
}

/** On return from the hosted UI, exchange ?code= for tokens. Returns true when signed in. */
export async function completeSignIn(url: URL = new URL(window.location.href)): Promise<boolean> {
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const pending = window.sessionStorage.getItem(PENDING_KEY);
  window.sessionStorage.removeItem(PENDING_KEY);
  if (!code || !pending) return accessToken() !== null;

  const { verifier, state } = JSON.parse(pending) as { verifier: string; state: string };
  if (returnedState !== state) throw new Error("Sign-in failed: state mismatch");

  const resp = await fetch(`${config.cognitoDomain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      code,
      code_verifier: verifier,
    }),
  });
  if (!resp.ok) throw new Error(`Sign-in failed: token exchange returned ${resp.status}`);
  const body = (await resp.json()) as { access_token: string; expires_in: number };
  // Refresh a minute early so a request never goes out with an expiring token.
  tokens = { accessToken: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };

  // Drop ?code&state from the address bar and history.
  window.history.replaceState(null, "", url.pathname);
  return true;
}
