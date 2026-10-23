// Build-time settings from VITE_* variables (see .env.example).

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set`);
  return value.replace(/\/$/, "");
}

export const config = {
  // Same origin by default: CloudFront serves the API at /api/* (infra/frontend.tf).
  apiUrl: (import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, ""),
  cognitoDomain: required("VITE_COGNITO_DOMAIN", import.meta.env.VITE_COGNITO_DOMAIN),
  clientId: required("VITE_COGNITO_CLIENT_ID", import.meta.env.VITE_COGNITO_CLIENT_ID),
  // Kept with its trailing slash: it must match the registered callback URL exactly.
  redirectUri: import.meta.env.VITE_REDIRECT_URI ?? `${window.location.origin}/`,
};
