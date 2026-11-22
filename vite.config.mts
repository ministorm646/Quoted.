import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The site address, so share previews get full links. Taken from APP_URL, or Vercel's own value.
const siteUrl = () =>
  (process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")).replace(/\/$/, "");

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    { name: "site-url", transformIndexHtml: (html: string) => html.replaceAll("__SITE_URL__", siteUrl()) },
  ],
  build: { outDir: "dist", emptyOutDir: true },
});
