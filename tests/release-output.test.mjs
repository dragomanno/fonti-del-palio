/**
 * Fonti del Palio — controlli di output di rilascio, v0.1.0.
 *
 * PERIMETRO STRETTO E DICHIARATO. Questi non sono gate diagnostici e non
 * estendono il framework diagnostico congelato alla v3.1.3: verificano
 * quattro sole proprieta' dell'ARTEFATTO DI BUILD, tutte introdotte dalla
 * preparazione del rilascio:
 *
 *   1. ogni pagina HTML pubblica indicizzabile espone esattamente un
 *      canonical, assoluto e auto-referenziale;
 *   2. og:url coincide con quel canonical;
 *   3. l'insieme delle URL della sitemap coincide con l'insieme delle rotte
 *      pubbliche indicizzabili generate;
 *   4. la sitemap non contiene duplicati ne' URL che non risolvono a una
 *      pagina generata.
 *
 * Nessun conteggio atteso e' scritto qui: i controlli sono relazioni fra
 * insiemi, non numeri da mantenere allineati a mano.
 */

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { collectIndexableRoutes, fileToRoute } from "../scripts/build-sitemap.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");

/** Il piu' recente mtime fra i sorgenti che influenzano l'HTML generato. */
function newestSourceMtime() {
  let newest = 0;
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else newest = Math.max(newest, statSync(full).mtimeMs);
    }
  };
  walk(path.join(ROOT, "src"));
  walk(path.join(ROOT, "scripts"));
  walk(path.join(ROOT, "config"));
  for (const f of ["astro.config.mjs", "package.json", "data/chunks.generated.json"]) {
    const full = path.join(ROOT, f);
    if (existsSync(full)) newest = Math.max(newest, statSync(full).mtimeMs);
  }
  return newest;
}

/**
 * `npm test` viene eseguito PRIMA di `npm run build` nella sequenza di
 * verifica pulita documentata, quindi dist/ puo' non esistere. Invece di
 * saltare in silenzio il controllo — che lo renderebbe inutile proprio
 * nell'unica esecuzione che conta — la build viene prodotta qui quando
 * manca o e' piu' vecchia dei sorgenti.
 */
function ensureFreshBuild() {
  const indexHtml = path.join(DIST, "index.html");
  if (existsSync(indexHtml) && statSync(indexHtml).mtimeMs >= newestSourceMtime()) return;
  const res = spawnSync("npm", ["run", "build"], { cwd: ROOT, encoding: "utf-8" });
  if (res.status !== 0) {
    throw new Error(`Build fallita durante i controlli di rilascio:\n${res.stdout}\n${res.stderr}`);
  }
}

let routes = [];
let siteOrigin = "";
let sitemapUrls = [];

before(() => {
  ensureFreshBuild();
  routes = collectIndexableRoutes(DIST).routes;
  const sitemapPath = path.join(DIST, "sitemap.xml");
  assert.ok(existsSync(sitemapPath), "dist/sitemap.xml non generato dalla build");
  const xml = readFileSync(sitemapPath, "utf-8");
  sitemapUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(sitemapUrls.length > 0, "sitemap.xml senza alcuna <loc>");
  siteOrigin = new URL(sitemapUrls[0]).origin;
});

function routeToFile(route) {
  return route === "/"
    ? path.join(DIST, "index.html")
    : path.join(DIST, route.replace(/^\/|\/$/g, ""), "index.html");
}

test("ogni pagina indicizzabile ha esattamente un canonical assoluto e auto-referenziale", () => {
  const problems = [];
  for (const route of routes) {
    const html = readFileSync(routeToFile(route), "utf-8");
    const found = [...html.matchAll(/<link[^>]+rel=["']canonical["'][^>]*>/gi)];
    if (found.length !== 1) {
      problems.push(`${route}: ${found.length} tag canonical (atteso 1)`);
      continue;
    }
    const href = found[0][0].match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) {
      problems.push(`${route}: canonical senza href`);
      continue;
    }
    if (!/^https?:\/\//i.test(href)) {
      problems.push(`${route}: canonical non assoluto (${href})`);
      continue;
    }
    const expected = `${siteOrigin}${route}`;
    if (href !== expected) {
      problems.push(`${route}: canonical "${href}" invece di "${expected}"`);
    }
  }
  assert.deepEqual(problems, [], `Canonical non auto-referenziali:\n${problems.join("\n")}`);
});

test("una pagina figlia non canonicalizza mai sulla sezione madre", () => {
  // Regressione esplicita del difetto corretto in v0.1.0: il canonical era
  // derivato da activePath, condiviso fra sezione e figlie.
  const children = routes.filter((r) => r.split("/").filter(Boolean).length >= 2);
  assert.ok(children.length > 0, "nessuna pagina figlia trovata: controllo privo di significato");
  const collisions = [];
  for (const route of children) {
    const html = readFileSync(routeToFile(route), "utf-8");
    const href = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1];
    const parent = `${siteOrigin}/${route.split("/").filter(Boolean)[0]}/`;
    if (href === parent) collisions.push(`${route} -> ${href}`);
  }
  assert.deepEqual(collisions, [], `Pagine figlie canonicalizzate sulla madre:\n${collisions.join("\n")}`);
});

test("og:url coincide con il canonical su ogni pagina indicizzabile", () => {
  const problems = [];
  for (const route of routes) {
    const html = readFileSync(routeToFile(route), "utf-8");
    const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1];
    const ogMatches = [...html.matchAll(/<meta[^>]+property=["']og:url["'][^>]*>/gi)];
    if (ogMatches.length !== 1) {
      problems.push(`${route}: ${ogMatches.length} tag og:url (atteso 1)`);
      continue;
    }
    const ogUrl = ogMatches[0][0].match(/content=["']([^"']+)["']/i)?.[1];
    if (ogUrl !== canonical) problems.push(`${route}: og:url "${ogUrl}" != canonical "${canonical}"`);
  }
  assert.deepEqual(problems, [], `og:url disallineati:\n${problems.join("\n")}`);
});

test("tutte le URL canoniche rispettano la politica di trailing slash", () => {
  const problems = routes
    .filter((route) => !route.endsWith("/"))
    .map((route) => `${route}: rotta senza trailing slash`);
  assert.deepEqual(problems, []);
});

test("l'insieme delle URL della sitemap coincide con le rotte pubbliche indicizzabili", () => {
  const expected = routes.map((route) => `${siteOrigin}${route}`).sort();
  const actual = [...sitemapUrls].sort();
  const missing = expected.filter((u) => !actual.includes(u));
  const extra = actual.filter((u) => !expected.includes(u));
  assert.deepEqual(
    { missing, extra },
    { missing: [], extra: [] },
    `Sitemap disallineata.\nMancanti: ${missing.join(", ")}\nIn eccesso: ${extra.join(", ")}`
  );
});

test("la sitemap non contiene duplicati", () => {
  const seen = new Map();
  for (const url of sitemapUrls) seen.set(url, (seen.get(url) ?? 0) + 1);
  const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([u, n]) => `${u} x${n}`);
  assert.deepEqual(dupes, []);
});

test("ogni URL della sitemap risolve a una pagina HTML effettivamente generata", () => {
  const unresolved = [];
  for (const url of sitemapUrls) {
    const parsed = new URL(url);
    if (parsed.origin !== siteOrigin) {
      unresolved.push(`${url}: origine estranea`);
      continue;
    }
    if (!/^https:\/\//i.test(url)) unresolved.push(`${url}: non assoluta in https`);
    const file = routeToFile(parsed.pathname);
    if (!existsSync(file)) unresolved.push(`${url}: nessun file generato (${path.relative(DIST, file)})`);
  }
  assert.deepEqual(unresolved, [], `URL non risolte:\n${unresolved.join("\n")}`);
});

test("la sitemap esclude artefatti non-HTML, asset Pagefind e pagine di errore", () => {
  const forbidden = sitemapUrls.filter((url) =>
    /\/(pagefind|_astro|\.netlify)\/|\/404\/|\/500\/|\.(js|css|json|xml|pf_\w+)$/i.test(url)
  );
  assert.deepEqual(forbidden, []);
});

test("robots.txt pubblicato e collegato alla sitemap", () => {
  const robotsPath = path.join(DIST, "robots.txt");
  assert.ok(existsSync(robotsPath), "robots.txt assente da dist/");
  const robots = readFileSync(robotsPath, "utf-8");
  const declared = robots.match(/^\s*Sitemap:\s*(\S+)\s*$/im)?.[1];
  assert.ok(declared, "robots.txt non dichiara alcuna Sitemap");
  assert.equal(declared, `${siteOrigin}/sitemap.xml`);
});

test("le rotte del corpus documentario sono presenti nella sitemap", () => {
  // Controllo di completezza per famiglia: la sitemap deve coprire le pagine
  // di dettaglio, non solo gli indici di sezione.
  const families = {
    "sezioni della disciplina": /^\/disciplina-vigente\/[^/]+\/$/,
    "annualita' storiche": /^\/evoluzione-storica\/\d{4}\/$/,
    atti: /^\/atti\/[^/]+\/$/,
    "record di fonte": /^\/fonti\/[^/]+\/$/,
  };
  const paths = sitemapUrls.map((u) => new URL(u).pathname);
  for (const [label, re] of Object.entries(families)) {
    const count = paths.filter((p) => re.test(p)).length;
    assert.ok(count > 0, `nessuna URL di sitemap per la famiglia "${label}"`);
  }
});

test("fileToRoute normalizza le rotte con trailing slash", () => {
  const base = "/tmp/dist";
  assert.equal(fileToRoute(path.join(base, "index.html"), base), "/");
  assert.equal(fileToRoute(path.join(base, "fonti", "index.html"), base), "/fonti/");
  assert.equal(
    fileToRoute(path.join(base, "fonti", "pe-2019-01", "index.html"), base),
    "/fonti/pe-2019-01/"
  );
});
