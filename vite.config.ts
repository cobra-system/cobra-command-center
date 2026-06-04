import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Splits node_modules into stable, cache-friendly vendor chunks.
 * Heavy libraries (charts, pdf, xlsx, fabric, …) are isolated so they are
 * only fetched on the lazy routes that use them, never in the initial bundle.
 * The React runtime is kept in a single chunk so context/identity is shared.
 */
function manualChunks(id: string): string | undefined {
  const normalized = id.replace(/\\/g, "/");
  if (!normalized.includes("/node_modules/")) return undefined;

  const after = normalized.split("/node_modules/").pop() ?? "";
  const pkg = after.startsWith("@")
    ? after.split("/").slice(0, 2).join("/")
    : after.split("/")[0];

  // React runtime — must stay together and load eagerly.
  if (["react", "react-dom", "react-router", "react-router-dom", "scheduler"].includes(pkg)) {
    return "react-vendor";
  }
  // Charting stack (recharts + its d3 dependencies) — heavy, only on report/dashboard routes.
  if (pkg === "recharts" || pkg === "victory-vendor" || pkg === "internmap" || pkg.startsWith("d3-")) {
    return "charts";
  }
  // Document tooling — each only loaded when the documents feature is opened.
  if (pkg === "pdfjs-dist") return "pdfjs";
  if (pkg === "pdf-lib") return "pdf-lib";
  if (pkg === "fabric") return "fabric";
  if (pkg === "xlsx") return "xlsx";
  if (pkg === "mammoth") return "mammoth";
  if (pkg === "html2pdf.js") return "html2pdf";
  if (pkg === "html5-qrcode") return "qr-scanner";
  // Data layer — needed at startup, kept separate for long-term caching.
  if (pkg.startsWith("@supabase/")) return "supabase";
  if (pkg === "@tanstack/react-query") return "react-query";
  if (pkg === "date-fns") return "date-fns";
  return undefined;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: parseInt(process.env.PORT ?? "8080"),
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    // Heavy isolated chunks (pdfjs/fabric) legitimately exceed the default 500kB warning.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
}));
