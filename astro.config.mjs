import { defineConfig } from "astro/config";

// Fonti del Palio — sito statico Astro + TypeScript.
// output: "static" per garantire che il sito documentale funzioni
// integralmente anche con AI_ENABLED=false (requisito non negoziabile
// del brief). L'unica parte server-side è la Netlify Function /ask,
// deployata separatamente in netlify/functions/, fuori dal build Astro.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || "https://fontidelpalio.it",
  output: "static",
  build: {
    format: "directory",
  },
});
