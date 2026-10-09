import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const BACKEND = process.env.VITE_BACKEND_URL ?? "http://localhost:5000";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    host: true, // listen on all interfaces (IPv4 + IPv6) so http://127.0.0.1:3000 works, not just [::1]
    port: 3000,
    strictPort: true, // fail loudly instead of silently incrementing the port
    proxy: {
      // Trailing slash + anchored regex: a bare "/api" prefix would also capture
      // SPA routes like /api-keys and /api-tester and proxy them to the backend.
      "^/api/": { target: BACKEND, changeOrigin: true },
      "/v1": { target: BACKEND, changeOrigin: true },
      "/health": { target: BACKEND, changeOrigin: true },
    },
  },
});
