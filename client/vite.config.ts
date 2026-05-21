import fs from "fs";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const bundleReportPlugin = () => ({
  name: "nritax-bundle-report",
  generateBundle(_options: unknown, bundle: Record<string, any>) {
    const approximateGzipSize = (source: string) =>
      source ? Math.round(Buffer.byteLength(source, "utf8") * 0.3) : 0;

    const assets = Object.values(bundle).map((item: any) => {
      const source =
        typeof item.code === "string"
          ? item.code
          : typeof item.source === "string"
            ? item.source
            : item.source instanceof Uint8Array
              ? Buffer.from(item.source).toString("utf8")
              : "";

      return {
        fileName: item.fileName,
        type: item.type,
        size: Number(item.type === "chunk" ? item.code?.length || 0 : source.length || 0),
        gzipSize: approximateGzipSize(source),
        isEntry: Boolean(item.isEntry),
        imports: Array.isArray(item.imports) ? item.imports : [],
      };
    });

    this.emitFile({
      type: "asset",
      fileName: "bundle-stats.json",
      source: JSON.stringify({ generatedAt: new Date().toISOString(), assets }, null, 2),
    });
  },
  closeBundle() {
    const reportPath = path.resolve(__dirname, "dist", "bundle-stats.json");
    if (fs.existsSync(reportPath)) {
      console.log(`[bundle-report] emitted ${reportPath}`);
    }
  },
});

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    bundleReportPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  assetsInclude: ["**/*.svg", "**/*.csv"],
  server: {
    host: '0.0.0.0',
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("/react/") || id.includes("/react-dom/")) {
            return "react-vendor";
          }

          if (id.includes("/react-router-dom/")) {
            return "router";
          }

          if (
            id.includes("/@mui/material/") ||
            id.includes("/@mui/icons-material/") ||
            id.includes("/@emotion/react/") ||
            id.includes("/@emotion/styled/")
          ) {
            return "mui-vendor";
          }

          if (id.includes("/react-markdown/")) {
            return "markdown";
          }

          if (id.includes("/motion/") || id.includes("/framer-motion/")) {
            return "motion";
          }

          if (id.includes("/recharts/")) {
            return "charts";
          }

          if (id.includes("/jspdf/") || id.includes("/jspdf-autotable/")) {
            return "pdf-export";
          }

          if (id.includes("/@radix-ui/")) {
            return "radix-vendor";
          }
        },
      },
    },
  },
});
