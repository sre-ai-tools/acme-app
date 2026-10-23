/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Hashed files land in /assets/, which CloudFront caches long (infra/frontend.tf).
  build: { assetsDir: "assets", sourcemap: false },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    env: {
      VITE_API_URL: "https://api.test",
      VITE_COGNITO_DOMAIN: "https://auth.test",
      VITE_COGNITO_CLIENT_ID: "test-client",
      VITE_REDIRECT_URI: "http://localhost:5173/",
    },
  },
});
