#!/usr/bin/env node
/**
 * Fonti del Palio — generatore della sitemap, v0.1.0.
 *
 * La sitemap NON e' un file statico mantenuto a mano (lo era fino alla
 * v0.1.0: elencava 8 rotte su 116 pagine generate, omettendo l'intero
 * corpus documentario). E' derivata dall'output reale della build, cosi'
 * che l'insieme delle URL della sitemap sia per costruzione uguale
 * all'insieme delle rotte pubbliche indicizzabili effettivamente prodotte.
 *
 * Regole:
 *  - si includono SOLO i file .html generati in dist/;
 *  - si esclude qualunque pagina che dichiari `noindex` in meta robots;
 *  - si escludono 404, endpoint di funzione, asset Pagefind e qualunque
 *    artefatto non-HTML;
 *  - le URL sono assolute e rispettano la stessa politica di trailing slash
 *    del canonical (build.format = "directory": ogni rotta finisce con "/");
 *  - nessun conteggio atteso e' scritto nel codice: il numero di URL e' una
 *    conseguenza delle pagine generate, non un valore da mantenere allineato
 *    a mano.
 *
 * Deterministico: nessun timestamp, ordinamento lessicografico stabile.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const DIST = process.env.SITEMAP_DIST
  ? path.resolve(process.env.SITEMAP_DIST)
  : path.resolve(process.cwd(), "dist");

/** Directory di dist/ che non contengono pagine pubbliche del sito. */
const EXCLUDED_DIRS = new Set(["pagefind", "_astro", "_worker.js", ".netlify"]);

/** Rotte escluse dalla sitemap anche se generate come HTML. */
const EXCLUDED_ROUTES = new Set(["/404/", "/500/"]);

/**
 * Prefissi di rotta esclusi dalla sitemap e dai controlli di pagina anche se
 * generati come .html. Sotto "/atti/" possono comparire istantanee HTML di
 * documenti acquisiti da fonti esterne (es. una pagina del Comune di Siena
 * salvata perche' priva di un allegato PDF): sono asset statici copiati da
 * public/, non pagine Astro del sito, e non condividono navbar, canonical
 * o meta robots con le pagine generate. Vengono esclusi per prefisso invece
 * di richiedere un meta noindex, perche' modificare l'istantanea acquisita
 * altererebbe l'integrita' del documento originale.
 */
const EXCLUDED_PREFIXES = ["/atti/2026/orari/"];

function isExcludedPrefix(route) {
  return EXCLUDED_PREFIXES.some((prefix) => route.startsWith(prefix));
}

function collectHtmlFiles(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      collectHtmlFiles(path.join(dir, entry.name), base, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

/** Converte un percorso di file in dist/ nella rotta pubblica corrispondente. */
export function fileToRoute(absFile, base) {
  const rel = path.relative(base, absFile).split(path.sep).join("/");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"index.html".length)}`;
  // File HTML fuori dal formato directory (es. build.format "file"):
  // la rotta resta comunque normalizzata con trailing slash.
  return `/${rel.replace(/\.html$/i, "")}/`;
}

const NOINDEX_RE = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i;

export function isIndexableHtml(html) {
  return !NOINDEX_RE.test(html);
}

export function collectIndexableRoutes(distDir = DIST) {
  if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
    throw new Error(`Directory di build non trovata: ${distDir}. Eseguire prima 'astro build'.`);
  }
  const routes = new Set();
  const skipped = { noindex: [], excluded: [] };
  for (const file of collectHtmlFiles(distDir)) {
    const route = fileToRoute(file, distDir);
    if (EXCLUDED_ROUTES.has(route) || isExcludedPrefix(route)) {
      skipped.excluded.push(route);
      continue;
    }
    const html = readFileSync(file, "utf-8");
    if (!isIndexableHtml(html)) {
      skipped.noindex.push(route);
      continue;
    }
    if (routes.has(route)) {
      throw new Error(`Rotta duplicata in dist/: ${route}`);
    }
    routes.add(route);
  }
  return { routes: [...routes].sort(), skipped };
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderSitemap(routes, siteUrl) {
  const origin = siteUrl.replace(/\/+$/, "");
  const body = routes.map((route) => `  <url><loc>${escapeXml(origin + route)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function loadSiteUrl() {
  // Il dominio canonico NON viene ridefinito qui: si riusa la stessa
  // configurazione del canonical (variabile d'ambiente, poi i default
  // pubblici committati).
  if (process.env.PUBLIC_SITE_URL) return process.env.PUBLIC_SITE_URL;
  const defaultsPath = path.resolve(process.cwd(), "config", "public-defaults.json");
  if (existsSync(defaultsPath)) {
    const defaults = JSON.parse(readFileSync(defaultsPath, "utf-8"));
    if (defaults.PUBLIC_SITE_URL) return String(defaults.PUBLIC_SITE_URL);
  }
  throw new Error("PUBLIC_SITE_URL non configurato: impossibile generare URL assolute.");
}

function main() {
  const siteUrl = loadSiteUrl();
  const { routes, skipped } = collectIndexableRoutes(DIST);
  const xml = renderSitemap(routes, siteUrl);
  const target = path.join(DIST, "sitemap.xml");
  writeFileSync(target, xml, "utf-8");
  console.log(
    `sitemap.xml scritto: ${routes.length} rotte pubbliche indicizzabili` +
      (skipped.noindex.length ? ` (escluse ${skipped.noindex.length} noindex)` : "") +
      (skipped.excluded.length ? ` (escluse ${skipped.excluded.length} pagine di errore)` : "")
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
