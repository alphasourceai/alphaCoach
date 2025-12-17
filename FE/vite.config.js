import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN, // scopes: org:read, project:releases, project:write
      release: process.env.RENDER_GIT_COMMIT,
      telemetry: false,
    }),
  ],
  build: { sourcemap: true },
  define: {
    __COMMIT_SHA__: JSON.stringify(process.env.RENDER_GIT_COMMIT || ""),
  },
  server: { host: true, port: 5173 },
});
