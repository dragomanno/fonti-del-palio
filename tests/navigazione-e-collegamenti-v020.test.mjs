/**
 * v0.2.0 — Navigazione a gruppi, integrita' dei collegamenti interni e
 * perimetro dell'indice di ricerca.
 *
 * Questi controlli lavorano su `dist/` e presuppongono `npm run build`.
 * Non verificano l'aspetto: verificano che la barra sia coerente su tutte le
 * rotte, che nessun collegamento interno punti a una rotta inesistente e che
 * le basi di conoscenza tecniche non abbiano rotta pubblica.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname.replace(/\/$/, "");

function paginaHtml(dir = DIST, acc = []) {
  for (const voce of readdirSync(dir)) {
    if (voce === "pagefind" || voce === "_astro") continue;
    const percorso = join(dir, voce);
    if (statSync(percorso).isDirectory()) paginaHtml(percorso, acc);
    else if (voce.endsWith(".html")) acc.push(percorso);
  }
  return acc;
}

const PAGINE = paginaHtml();

/** Rotta pubblica corrispondente a un file HTML di `dist/`. */
function rottaDi(file) {
  const rel = relative(DIST, file).split(sep).join("/");
  return rel === "index.html" ? "/" : `/${rel.replace(/index\.html$/, "")}`;
}

const ROTTE = new Set(PAGINE.map(rottaDi));

// ---------------------------------------------------------------------------
// Barra di navigazione
// ---------------------------------------------------------------------------

const VOCI_PRIMO_LIVELLO = [
  "Palio 16 agosto 2026",
  "Documenti fondamentali",
  "Protocollo Equino",
  "Ordinanze e atti",
  "Fonti",
  "Progetto",
  "Ricerca",
];

test("la barra di navigazione espone le stesse sette voci su ogni rotta", () => {
  assert.ok(PAGINE.length > 100, `attese oltre 100 pagine, trovate ${PAGINE.length}`);
  for (const file of PAGINE) {
    const html = readFileSync(file, "utf8");
    const nav = html.slice(html.indexOf('aria-label="Navigazione principale"'), html.indexOf("</header>"));
    for (const voce of VOCI_PRIMO_LIVELLO) {
      assert.ok(nav.includes(voce), `${rottaDi(file)}: voce di menu mancante «${voce}»`);
    }
  }
});

test("ogni gruppo di menu parte chiuso e dichiara il pannello che controlla", () => {
  const html = readFileSync(join(DIST, "index.html"), "utf8");
  const toggle = [...html.matchAll(/<button[^>]*class="nav-group__toggle"[^>]*>/g)].map((m) => m[0]);
  assert.equal(toggle.length, 3, "attesi tre gruppi di menu nel markup servito");
  for (const t of toggle) {
    assert.match(t, /aria-expanded="false"/, `gruppo aperto nel markup servito: ${t}`);
    const controlla = /aria-controls="([^"]+)"/.exec(t);
    assert.ok(controlla, `gruppo senza aria-controls: ${t}`);
    assert.ok(
      html.includes(`id="${controlla[1]}"`),
      `aria-controls punta a un id inesistente: ${controlla[1]}`,
    );
  }
});

test("i gruppi non contengono voci senza destinazione", () => {
  const html = readFileSync(join(DIST, "index.html"), "utf8");
  const pannelli = [...html.matchAll(/<ul class="nav-group__panel"[^>]*>([\s\S]*?)<\/ul>/g)];
  assert.equal(pannelli.length, 3);
  for (const [, corpo] of pannelli) {
    const link = [...corpo.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(link.length >= 2, "un gruppo di menu ha meno di due voci");
    for (const href of link) {
      const rotta = href.endsWith("/") ? href : `${href}/`;
      assert.ok(ROTTE.has(rotta), `voce di menu verso rotta inesistente: ${href}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Collegamenti interni
// ---------------------------------------------------------------------------

test("nessun collegamento interno punta a una rotta o a un file inesistente", () => {
  const rotti = [];
  for (const file of PAGINE) {
    const html = readFileSync(file, "utf8");
    for (const [, href] of html.matchAll(/href="(\/[^"#]*)(?:#[^"]*)?"/g)) {
      if (href.startsWith("//")) continue;
      if (href.startsWith("/pagefind/")) continue; // generato dopo il render
      const rotta = href.endsWith("/") ? href : `${href}/`;
      if (ROTTE.has(rotta) || ROTTE.has(href)) continue;
      if (existsSync(join(DIST, href))) continue; // file statico: PDF, robots.txt, sitemap
      rotti.push(`${rottaDi(file)} -> ${href}`);
    }
  }
  assert.deepEqual(rotti, [], `collegamenti interni rotti:\n${rotti.join("\n")}`);
});

test("le ancore interne dichiarate puntano a un identificatore esistente", () => {
  const mancanti = [];
  for (const file of PAGINE) {
    const html = readFileSync(file, "utf8");
    for (const [, percorso, ancora] of html.matchAll(/href="(\/[^"#]*)#([^"]+)"/g)) {
      const rotta = percorso.endsWith("/") ? percorso : `${percorso}/`;
      const bersaglio = join(DIST, rotta, "index.html");
      if (!existsSync(bersaglio)) continue; // gia' coperto dal controllo precedente
      const destinazione = readFileSync(bersaglio, "utf8");
      if (!destinazione.includes(`id="${ancora}"`)) {
        mancanti.push(`${rottaDi(file)} -> ${percorso}#${ancora}`);
      }
    }
  }
  assert.deepEqual(mancanti, [], `ancore interne senza bersaglio:\n${mancanti.join("\n")}`);
});

// ---------------------------------------------------------------------------
// Perimetro dell'indice di ricerca
// ---------------------------------------------------------------------------

test("le basi di conoscenza tecniche non hanno rotta pubblica", () => {
  const vietate = [
    "KB_Technical_Project_Profile",
    "KB_Project_Router",
    "KB_Router_Generale",
    "KB_Release_Gates",
    "KB_Source_Acquisition",
    "KB_Text_Normalization",
  ];
  for (const file of PAGINE) {
    const html = readFileSync(file, "utf8");
    for (const v of vietate) {
      assert.ok(!html.includes(v), `${rottaDi(file)}: riferimento a base di conoscenza tecnica «${v}»`);
    }
  }
});

test("la pagina di ricerca resta esclusa dal corpo indicizzato", () => {
  const html = readFileSync(join(DIST, "ricerca", "index.html"), "utf8");
  assert.ok(!html.includes("data-pagefind-body"), "la pagina di ricerca non deve essere indicizzata");
  assert.ok(html.includes('id="search"'), "manca il punto di innesto della ricerca");
});

test("l'indice di ricerca e' stato generato e copre le rotte nuove", () => {
  const dir = join(DIST, "pagefind");
  assert.ok(existsSync(dir), "indice Pagefind assente: eseguire npm run build");
  assert.ok(existsSync(join(dir, "pagefind.js")), "runtime Pagefind assente");
  for (const rotta of [
    "/palio-16-agosto-2026/previsite/",
    "/ordinanze-e-atti/ordinanza-58-2026/",
    "/regolamento-per-il-palio/edizione-previgente/",
    "/documenti-fondamentali/bando-di-violante/chiocciola/",
  ]) {
    const html = readFileSync(join(DIST, rotta, "index.html"), "utf8");
    assert.ok(html.includes("data-pagefind-body"), `${rotta} non e' indicizzabile`);
  }
});

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

test("la Home distingue la Carriera in corso dal corpus di lunga durata", () => {
  const html = readFileSync(join(DIST, "index.html"), "utf8");
  assert.ok(html.includes("Carriera in corso"), "manca la fascia della Carriera in corso");
  assert.ok(
    html.includes("validità circoscritta al Palio"),
    "manca l'avvertenza sulla validità circoscritta degli atti di Carriera",
  );
  for (const href of [
    "/palio-16-agosto-2026/",
    "/ordinanze-e-atti/",
    "/documenti-fondamentali/",
    "/disciplina-vigente/",
    "/evoluzione-storica/",
    "/fonti/",
    "/ricerca/",
  ]) {
    assert.ok(html.includes(`href="${href}"`), `la Home non rimanda a ${href}`);
  }
});
