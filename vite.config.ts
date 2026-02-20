import path from "path"
import { execSync } from "child_process"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

const getGitVersion = () => {
  try {
    return execSync("git describe --tags --always --dirty").toString().trim()
  } catch {
    try {
      return execSync("git rev-parse --short HEAD").toString().trim()
    } catch {
      return "v0.0.0"
    }
  }
}

const getGitCommitMessage = () => {
  try {
    return execSync("git log -1 --pretty=%s").toString().trim()
  } catch {
    return ""
  }
}

const appVersion = getGitVersion()
const appCommitMessage = getGitCommitMessage()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_COMMIT_MESSAGE__: JSON.stringify(appCommitMessage),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
      },
      includeAssets: ["vite.svg"],
      manifest: {
        name: "Arehsoft Business Management",
        short_name: "Arehsoft",
        description: "Streamline your business operations and project management.",
        theme_color: "#000000",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          {
            src: "vite.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "vite.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
