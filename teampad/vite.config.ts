import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules/ably")) return "ably";
          if (id.includes("node_modules/@ably")) return "ably";
          if (id.includes("node_modules/@tanstack")) return "react-query";
          if (id.includes("node_modules/react")) return "react-vendor";
          if (id.includes("node_modules/@tiptap")) return "editor";
          if (id.includes("node_modules/prosemirror")) return "editor";
          if (id.includes("node_modules/date-fns")) return "date-fns";
          return undefined;
        },
      },
    },
  },
}));
