import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const REGISTRY_API_BASE_URL = process.env.REGISTRY_API_BASE_URL;
const REAL_REGISTRY_E2E = process.env.REAL_REGISTRY_E2E === "true";

if (!REAL_REGISTRY_E2E) {
  throw new Error(
    "REAL_REGISTRY_E2E=true is required; this config never runs against an uncontrolled server.",
  );
}

if (!REGISTRY_API_BASE_URL) {
  throw new Error(
    "REGISTRY_API_BASE_URL must explicitly identify the real Registry Server.",
  );
}

if (REGISTRY_API_BASE_URL.includes(":9090")) {
  throw new Error(
    "REGISTRY_API_BASE_URL must address a real Registry Server, not the MSW default (:9090).",
  );
}

/**
 * Real-Registry E2E configuration. The Registry Server is deliberately
 * external to the Cloud UI process so it remains the upstream v1.5.1 service.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "real-registry.spec.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 45_000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm start:e2e:real-registry",
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      API_BASE_URL: REGISTRY_API_BASE_URL,
      REGISTRY_API_BASE_URL,
      REAL_REGISTRY_E2E: "true",
      OIDC_ISSUER_URL: "http://localhost:4000",
      OIDC_CLIENT_ID: "better-auth-dev",
      OIDC_CLIENT_SECRET: "dev-secret-change-in-production",
      BETTER_AUTH_URL: BASE_URL,
      BETTER_AUTH_SECRET: "e2e-test-secret-at-least-32-chars-long",
      BETTER_AUTH_RATE_LIMIT: "100",
      USE_E2E_MODEL: "true",
      E2E_MODEL_NAME: process.env.E2E_MODEL_NAME ?? "qwen3:1.7b",
      OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    },
  },
});
