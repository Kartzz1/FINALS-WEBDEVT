import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development the browser talks only to this server, which forwards /api to
// the backend. Cookies therefore stay same-origin, and the port must match
// CLIENT_URL in the backend .env (http://localhost:5173).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:4000" },
  },
});
