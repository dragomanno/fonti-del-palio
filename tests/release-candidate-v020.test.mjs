/**
 * v0.2.0 — Controlli della release candidate.
 *
 * Verificano che l'ampliamento sia additivo (nessuna rotta della v0.1.1
 * perduta), che i file originali ripubblicati siano quelli attesi bit per bit,
 * che il file escluso resti escluso e che la versione dichiarata sia coerente
 * in tutti i punti in cui compare.
 *
 * Presuppongono `npm run build`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, sep } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const DIST = join(ROOT, "dist");
const VERSIONE = "0.2.0";

const leggi = (p) => readFileSync(join(ROOT, p), "utf8");
const json = (p) => JSON.parse(leggi(p));

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
const rottaDi = (f) => {
  const rel = relative(DIST, f).split(sep).join("/");
  return rel === "index.html" ? "/" : `/${rel.replace(/index\.html$/, "")}`;
};
const ROTTE = new Set(PAGINE.map(rottaDi));
const SITEMAP = [...leggi("dist/sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
  m[1].replace(/^https?:\/\/[^/]+/, ""),
);

// ---------------------------------------------------------------------------
// Perimetro delle rotte
// ---------------------------------------------------------------------------

/**
 * Redirect permanenti dichiarati in netlify.toml, letti dal file reale.
 *
 * Il parsing e' volutamente minimale: il file e' scritto a mano nel repository
 * e la sua forma e' verificata dal test dedicato in
 * tests/deduplica-regolamento.test.mjs. Qui serve solo a distinguere una rotta
 * consolidata da una rotta scomparsa.
 */
function redirectPermanenti() {
  const toml = leggi("netlify.toml");
  const mappa = new Map();
  for (const blocco of toml.split(/\[\[redirects\]\]/).slice(1)) {
    const testa = blocco.split(/\n\[/)[0];
    const from = /^\s*from\s*=\s*"([^"]+)"/m.exec(testa);
    const to = /^\s*to\s*=\s*"([^"]+)"/m.exec(testa);
    const status = /^\s*status\s*=\s*(\d+)/m.exec(testa);
    if (from && to && status && status[1] === "301") mappa.set(from[1], to[1]);
  }
  return mappa;
}

test("nessuna rotta della v0.1.1 e' stata perduta senza un 301 verso una pagina esistente", () => {
  // La garanzia originale era "nessuna rotta scompare". Dal 2 agosto 2026 il
  // perimetro ammette una seconda possibilita', piu' debole solo in apparenza:
  // una rotta storica puo' cessare di essere una pagina HTML soltanto se e'
  // servita da un redirect 301 permanente verso una rotta che esiste davvero.
  // Una rotta che sparisce senza redirect resta un errore bloccante, e un
  // redirect verso il vuoto pure.
  const baseline = json("tests/fixtures/rotte-v0.1.1.json");
  assert.equal(baseline.length, 116, "la baseline v0.1.1 deve contare 116 rotte");
  const redirect = redirectPermanenti();
  const perse = [];
  const consolidate = [];
  for (const r of baseline) {
    if (ROTTE.has(r)) continue;
    const destinazione = redirect.get(r);
    if (!destinazione) {
      perse.push(r);
    } else if (!ROTTE.has(destinazione)) {
      perse.push(`${r} -> ${destinazione} (destinazione inesistente)`);
    } else {
      consolidate.push(`${r} -> ${destinazione}`);
    }
  }
  assert.deepEqual(perse, [], `rotte preesistenti scomparse:\n${perse.join("\n")}`);
  assert.deepEqual(
    consolidate,
    ["/disciplina-vigente/regolamento-palio/ -> /regolamento-per-il-palio/"],
    "l'elenco delle rotte consolidate via 301 deve restare esattamente quello approvato",
  );
});

test("tutte le rotte nuove della v0.2.0 sono presenti", () => {
  const nuove = json("tests/fixtures/rotte-nuove-v0.2.0.json");
  assert.equal(nuove.length, 40, "la v0.2.0 introduce 40 rotte");
  const mancanti = nuove.filter((r) => !ROTTE.has(r));
  assert.deepEqual(mancanti, [], `rotte nuove assenti:\n${mancanti.join("\n")}`);
});

test("sitemap e output coincidono e non contengono duplicati", () => {
  assert.equal(new Set(SITEMAP).size, SITEMAP.length, "sitemap con URL duplicati");
  assert.equal(SITEMAP.length, ROTTE.size, `sitemap ${SITEMAP.length} vs rotte ${ROTTE.size}`);
  for (const r of SITEMAP) assert.ok(ROTTE.has(r), `sitemap dichiara una rotta inesistente: ${r}`);
});

// ---------------------------------------------------------------------------
// Canonical e og:url
// ---------------------------------------------------------------------------

test("canonical e og:url coincidono con la rotta su ogni pagina", () => {
  const errori = [];
  for (const file of PAGINE) {
    const html = readFileSync(file, "utf8");
    const rotta = rottaDi(file);
    const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html);
    const ogurl = /<meta property="og:url" content="([^"]+)"/.exec(html);
    if (!canonical) errori.push(`${rotta}: canonical assente`);
    if (!ogurl) errori.push(`${rotta}: og:url assente`);
    if (canonical && new URL(canonical[1]).pathname !== rotta) {
      errori.push(`${rotta}: canonical ${canonical[1]}`);
    }
    if (ogurl && new URL(ogurl[1]).pathname !== rotta) {
      errori.push(`${rotta}: og:url ${ogurl[1]}`);
    }
    if (canonical && ogurl && canonical[1] !== ogurl[1]) {
      errori.push(`${rotta}: canonical e og:url divergenti`);
    }
  }
  assert.deepEqual(errori, [], errori.join("\n"));
});

// ---------------------------------------------------------------------------
// File originali ripubblicati
// ---------------------------------------------------------------------------

const PDF_ATTESI = {
  "30876_DeterminadiImpegno_Copia_1775_2026.pdf":
    "5f353c7f9758e4679b776264e835016511e0be50fac71feb092a2616564f29a1",
  "30902_OrdinanzadelSindaco_Copia_51_2026.pdf":
    "55402ecd36deb27af00aaa5d4113e27e712c3a3ba8f85bbfa539cc623670d394",
  "30901_OrdinanzadelSindaco_Copia_52_2026.pdf":
    "671465bdfb94c1a53e316b99fb9ea55448b544a093b2a80d814ade076aa4e8bd",
  "30900_OrdinanzadelSindaco_Copia_53_2026.pdf":
    "bf4d66dab33eb097d133ac188af8fb98fcb80064d34b21ebbd5f84946562cc45",
  "30899_OrdinanzadelSindaco_Copia_54_2026.pdf":
    "6d11ca4ae721abb6ed85b4abf3e05d264c1ea728b660ffc3ec7ef1a87460d3ce",
  "30898_OrdinanzadelSindaco_Copia_55_2026.pdf":
    "310c0d60670ee61d7f51c1c67a53b7a283698993ec010e36e3f62d5cddcd3ab3",
  "30907_OrdinanzadelSindaco_Copia_56_2026.pdf":
    "e15214f59df697a7e19c9cafbe35d47b8d71fae0632567d9e2cbd762cdc4390d",
  "30906_OrdinanzadelSindaco_Copia_57_2026.pdf":
    "0f85d3f73d9c84faa015ae937b5a84ced4c2397bc0b4343066127bcee83df695",
  "30905_OrdinanzadelSindaco_Copia_58_2026.pdf":
    "9e8fab2b9852c443750fa0d4049b54b645249485fcf0d16d0be0ac7993e9740b",
  "30904_OrdinanzadelSindaco_Copia_59_2026.pdf":
    "a8f3264ccf346f627c26ea39fc89f8efb3b18e65e6e08bec651913d20f4b3949",
  "30903_OrdinanzadelSindaco_Copia_60_2026.pdf":
    "56389d2be579d9467b73cbb9697bfe755303c23f22f6a8f5308b51c8f1af0ed4",
  "30908_DeterminaGenerica_Copia_1791_2026.pdf":
    "9695d1157cd336c53839489d2653a95109b1d812fa4145aeb5ede15188572c43",
};

/** SHA-256 del visto contabile: deve restare assente dall'output. */
const DIGEST_VISTO = "ac4b1948f8bd9ccfcdfa774bca2d139be38a3f4c203e7feb85728267b0f4deae";

test("i dodici PDF ripubblicati corrispondono bit per bit alle fonti registrate", () => {
  const dir = join(DIST, "atti", "2026");
  const presenti = readdirSync(dir).filter((f) => f.endsWith(".pdf")).sort();
  assert.deepEqual(presenti, Object.keys(PDF_ATTESI).sort(), "insieme dei PDF pubblicati diverso dall'atteso");
  let byte = 0;
  for (const [nome, atteso] of Object.entries(PDF_ATTESI)) {
    const buf = readFileSync(join(dir, nome));
    byte += buf.length;
    assert.equal(createHash("sha256").update(buf).digest("hex"), atteso, `digest diverso: ${nome}`);
    assert.equal(buf.subarray(0, 5).toString("latin1"), "%PDF-", `${nome} non e' un PDF`);
  }
  assert.equal(byte, 1716251, "dimensione complessiva dei PDF diversa dall'attesa");
});

test("il PDF del visto contabile non compare in nessuna forma nell'output", () => {
  const trovati = [];
  const cerca = (dir) => {
    for (const voce of readdirSync(dir)) {
      const p = join(dir, voce);
      if (statSync(p).isDirectory()) cerca(p);
      else if (voce.endsWith(".pdf")) {
        if (createHash("sha256").update(readFileSync(p)).digest("hex") === DIGEST_VISTO) trovati.push(p);
      }
    }
  };
  cerca(DIST);
  assert.deepEqual(trovati, [], `il visto contabile e' stato ripubblicato: ${trovati.join(", ")}`);
});

test("la scheda del visto contabile e' pubblica e dichiara la mancata ripubblicazione", () => {
  const html = readFileSync(join(DIST, "ordinanze-e-atti", "visto-contabile-1775-2026", "index.html"), "utf8");
  assert.ok(html.includes("ATT-2026-VIS-1775"), "la scheda non dichiara il proprio identificativo");
  assert.ok(!/href="[^"]*\.pdf"/.test(html), "la scheda rimanda a un file PDF");
});

// ---------------------------------------------------------------------------
// Versione
// ---------------------------------------------------------------------------

test("la versione e' dichiarata in modo coerente", () => {
  const pkg = json("package.json");
  const lock = json("package-lock.json");
  assert.equal(pkg.version, VERSIONE);
  assert.equal(lock.version, VERSIONE);
  assert.equal(lock.packages[""].version, VERSIONE);
  assert.equal(lock.lockfileVersion, 3, "lockfileVersion non deve cambiare");
  assert.equal(lock.packages[""].name, pkg.name);
  assert.ok(existsSync(join(ROOT, `CHANGELOG_v${VERSIONE}.md`)), "changelog della versione assente");
});

test("il lockfile continua a descrivere lo stesso albero di dipendenze", () => {
  const pkg = json("package.json");
  const lock = json("package-lock.json");
  assert.deepEqual(lock.packages[""].dependencies, pkg.dependencies);
  assert.deepEqual(lock.packages[""].devDependencies, pkg.devDependencies);
  for (const [nome, voce] of Object.entries(lock.packages)) {
    if (nome === "") continue;
    assert.ok(voce.resolved || voce.link, `voce di lockfile senza risoluzione: ${nome}`);
  }
});

// ---------------------------------------------------------------------------
// Changelog
// ---------------------------------------------------------------------------

test("la rotta del changelog e' pubblicata, indicizzabile e raggiungibile dal menu", () => {
  assert.ok(ROTTE.has("/changelog/"), "rotta /changelog/ assente");
  const html = readFileSync(join(DIST, "changelog", "index.html"), "utf8");
  assert.ok(html.includes("data-pagefind-body"), "il changelog non e' indicizzabile");
  assert.ok(html.includes("Changelog — v0.2.0"), "il changelog non rende il file della versione");
  const home = readFileSync(join(DIST, "index.html"), "utf8");
  assert.ok(home.includes('href="/changelog/"'), "il menu non rimanda al changelog");
});

test("il changelog e' definitivo e non conserva formule di transizione", () => {
  const testo = leggi("CHANGELOG_v0.2.0.md");
  // Il changelog e' un documento pubblico: non deve esporre il branch di
  // lavorazione ne' dichiararsi provvisorio.
  assert.ok(!/recovery\/v0\.2\.0/.test(testo), "il changelog cita il branch di lavorazione");
  assert.ok(!/release candidate/i.test(testo), "il changelog si dichiara release candidate");
  assert.ok(
    !/(nessun tag|nessuna release)/i.test(testo),
    "il changelog dichiara l'assenza di tag o release",
  );
  assert.ok(!/^\*\*Tag:\*\*/m.test(testo), "il changelog dichiara un tag");
  assert.ok(!/^\*\*Branch:\*\*/m.test(testo), "il changelog dichiara un branch");
  assert.ok(!/^## Checkpoint/m.test(testo), "il changelog espone i checkpoint interni");
  // Il rollback resta documentato, ma come procedura Git-backed.
  assert.ok(/git revert/.test(testo), "il changelog non documenta il rollback");
});

// ---------------------------------------------------------------------------
// Ricerca: segnali di ranking
// ---------------------------------------------------------------------------

test("la pagina del Regolamento espone i segnali di rilevanza a Pagefind", () => {
  const html = readFileSync(join(DIST, "regolamento-per-il-palio", "index.html"), "utf8");
  const pesi = [...html.matchAll(/data-pagefind-weight="10"/g)].length;
  assert.ok(
    pesi >= 4,
    `la pagina del Regolamento espone ${pesi} segnali di peso invece di almeno 4`,
  );
  assert.ok(html.includes("data-pagefind-body"), "la pagina del Regolamento non e' indicizzata");
});

test("la ricerca applica i parametri di ranking calibrati", () => {
  // Lo script della pagina viene minimizzato in fase di costruzione: i valori
  // sono verificati nella forma effettivamente pubblicata (0.3 -> .3).
  const html = readFileSync(join(DIST, "ricerca", "index.html"), "utf8");
  const parametri = [
    [/pageLength:\s*0?\.3(?![\d])/, "pageLength"],
    [/termFrequency:\s*1(?![.\d])/, "termFrequency"],
    [/termSaturation:\s*2(?![.\d])/, "termSaturation"],
    [/termSimilarity:\s*9(?![.\d])/, "termSimilarity"],
  ];
  for (const [schema, nome] of parametri) {
    assert.ok(schema.test(html), `parametro di ranking ${nome} assente o alterato`);
  }
});

// ---------------------------------------------------------------------------
// Formule documentarie
// ---------------------------------------------------------------------------

test("la distinzione fra approvazione 2019 e presentazione 2021 e' esposta al pubblico", () => {
  const html = readFileSync(join(DIST, "regolamento-per-il-palio", "index.html"), "utf8");
  assert.ok(/approvat[ao] nel 2019/i.test(html), "manca l'anno di approvazione");
  assert.ok(/present(ata|azione)[^.]{0,40}2021/i.test(html), "manca la presentazione del 2021");
  assert.ok(html.includes("n. 99 del 17.6.2019"), "manca la prima deliberazione di approvazione");
  assert.ok(html.includes("n. 224 del 28.11.2019"), "manca la seconda deliberazione di approvazione");
  // «Regolamento del 2021» e' una locuzione errata: puo' comparire solo
  // all'interno della frase che ne spiega l'errore, mai come denominazione.
  const usi = [...html.matchAll(/.{0,24}Regolamento del 2021/g)].map((m) => m[0]);
  const impropri = usi.filter((u) => !/Chiamare «Regolamento del 2021$/.test(u));
  assert.deepEqual(impropri, [], `«Regolamento del 2021» usato come denominazione:\n${impropri.join("\n")}`);
});

test("l'edizione previgente resta distinta e datata 1949", () => {
  const html = readFileSync(join(DIST, "regolamento-per-il-palio", "edizione-previgente", "index.html"), "utf8");
  assert.ok(/1949/.test(html), "manca l'anno di approvazione dell'edizione previgente");
  assert.ok(/previgente/i.test(html), "la pagina non si qualifica come edizione previgente");
  assert.ok(!/vigente dal 1949/i.test(html), "l'edizione previgente e' presentata come vigente");
});

test("il Bando dichiara trascrizione verificata e provenienza archivistica aperta", () => {
  const html = readFileSync(join(DIST, "documenti-fondamentali", "bando-di-violante", "index.html"), "utf8");
  assert.ok(/Trascrizione verificata rispetto alla copia acquisita/.test(html));
  assert.ok(/provenienza archivistica della copia resta da verificare/.test(html));
  assert.ok(/13 settembre 1729/.test(html), "manca la data del decreto riportata dalla fonte");
});

test("RIF-STRADE-CONTRADE e' registrato con digest integrale e motivo della mancata ripubblicazione", () => {
  const html = readFileSync(join(DIST, "documenti-fondamentali", "index.html"), "utf8");
  assert.ok(html.includes("RIF-STRADE-CONTRADE"), "il repertorio non e' registrato");
  assert.ok(
    html.includes("fab21455a27e58f9a564322668f6e83f7f87a3786c9e104f041bc53bf74a469d"),
    "il digest integrale del repertorio non e' pubblicato",
  );
  assert.ok(/non è ripubblicato/.test(html), "manca la dichiarazione di mancata ripubblicazione");
  assert.ok(/regime dei diritti/.test(html), "manca il motivo della mancata ripubblicazione");
});

test("tutte le fonti del registro espongono il digest integrale, non solo abbreviato", () => {
  const html = readFileSync(join(DIST, "documenti-fondamentali", "index.html"), "utf8");
  const index = json("data/carriera.generated.json");
  for (const r of index.registroFonti) {
    assert.ok(html.includes(r.sha256), `digest integrale assente per ${r.id}`);
  }
});
