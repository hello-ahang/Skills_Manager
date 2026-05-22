import path from "path"
import os from "os"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { getDevOpenUrl } from "./server/utils/devOpenUrl"

const SECURITY_PATH = path.join(os.homedir(), ".skills-manager", "security.json")

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    // Inject backend's auth token into the auto-open URL so the frontend
    // captures it to localStorage on the 5173 origin (different origin than
    // the backend's 3001, so localStorage is not shared). Backend writes
    // security.json before app.listen(), and dev:client waits for port 3001
    // via wait-on, so the file is guaranteed to exist by the time we read it.
    open: getDevOpenUrl(SECURITY_PATH),
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
})
