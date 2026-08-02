/**
 * Consolidamento del Regolamento per il Palio sulla pagina canonica.
 *
 * Fino al 2 agosto 2026 l'articolato dei 106 articoli era pubblicato due volte:
 * su /regolamento-per-il-palio/ e come Parte 06 della disciplina vigente, su
 * /disciplina-vigente/regolamento-palio/. Le due rese finivano entrambe
 * nell'HTML indicizzabile, nella sitemap e nell'indice Pagefind, e una stessa
 * frase del Regolamento restituiva due risultati di ricerca.
 *
 * Questi test fissano il perimetro del consolidamento:
 *  - la vecchia rotta non e' piu' una pagina HTML e non compare in sitemap
 *    ne' in Pagefind;
 *  - risponde con un solo 301 permanente verso la pagina canonica, dichiarato
 *    in netlify.toml, senza meta refresh, redirect JavaScript, 302, pagina 200
 *    con solo canonical ne' seconda pagina noindex con l'articolato;
 *  - nessun collegamento interno punta piu' alla vecchia rotta, quindi non si
 *    formano catene di redirect;
 *  - la pagina canonica resta integra: 106 articoli, 106 destinazioni univoche,
 *    canonical e og:url autoreferenziali.
 *
 * La Parte III della KB 03 e i 106 chunk di scope `regolamento-palio` restano
 * nel corpus: qui si verifica solo la resa pubblica.
 *
 * Presuppongono `npm run build`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join, relative, sep } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const DIST = join(ROOT, "dist");

const VECCHIA_ROTTA = "/disciplina-vigente/regolamento-palio/";
const ROTTA_CANONICA = "/regolamento-per-il-palio/";

const leggi = (p) => readFileSync(join(ROOT, p), "utf8");

function fileHtml(dir = DIST, acc = []) {
  for (const voce of readdirSync(dir)) {
    if (voce === "pagefind" || voce === "_astro") continue;
    const percorso = join(dir, voce);
    if (statSync(percorso).isDirectory()) fileHtml(percorso, acc);
    else if (voce.endsWith(".html")) acc.push(percorso);
  }
  return acc;
}

const rottaDi = (f) => {
  const rel = relative(DIST, f).split(sep).join("/");
  return rel === "index.html" ? "/" : `/${rel.replace(/index\.html$/, "")}`;
};

const PAGINE = fileHtml();
const ROTTE = new Set(PAGINE.map(rottaDi));

/** Blocchi [[redirects]] di netlify.toml, nell'ordine di dichiarazione. */
function redirectDichiarati() {
  const toml = leggi("netlify.toml");
  return toml
    .split(/\[\[redirects\]\]/)
    .slice(1)
    .map((blocco) => {
      const testa = blocco.split(/\n\[/)[0];
      const campo = (nome) => {
        const m = new RegExp(`^\\s*${nome}\\s*=\\s*"?([^"\\n]+)"?`, "m").exec(testa);
        return m ? m[1].trim() : null;
      };
      return { from: campo("from"), to: campo("to"), status: campo("status") };
    });
}

// ---------------------------------------------------------------------------
// Redirect permanente
// ---------------------------------------------------------------------------

test("la vecchia rotta e' dichiarata come 301 permanente verso la pagina canonica", () => {
  const regole = redirectDichiarati().filter(
    (r) => r.from === VECCHIA_ROTTA || r.from === VECCHIA_ROTTA.replace(/\/$/, ""),
  );
  assert.ok(regole.length > 0, "netlify.toml non dichiara alcun redirect per la vecchia rotta");
  for (const r of regole) {
    assert.equal(r.status, "301", `il redirect da ${r.from} non e' un 301 ma ${r.status}`);
    assert.equal(
      r.to,
      ROTTA_CANONICA,
      `il redirect da ${r.from} non punta alla pagina canonica ma a ${r.to}`,
    );
  }
});

test("il redirect copre sia la forma con slash finale sia quella senza", () => {
  const origini = new Set(redirectDichiarati().map((r) => r.from));
  assert.ok(origini.has(VECCHIA_ROTTA), "manca la regola con slash finale");
  assert.ok(
    origini.has(VECCHIA_ROTTA.replace(/\/$/, "")),
    "manca la regola senza slash finale",
  );
});

test("la destinazione del redirect e' esatta, con slash finale", () => {
  for (const r of redirectDichiarati()) {
    if (r.from !== VECCHIA_ROTTA && r.from !== VECCHIA_ROTTA.replace(/\/$/, "")) continue;
    assert.match(r.to, /\/$/, `destinazione senza slash finale: ${r.to}`);
    assert.equal(r.to, ROTTA_CANONICA);
  }
});

test("nessun redirect temporaneo e nessun redirect verso il vuoto", () => {
  const errori = [];
  for (const r of redirectDichiarati()) {
    if (r.status !== "301") errori.push(`${r.from}: status ${r.status}`);
    if (r.to && r.to.startsWith("/") && !r.to.includes(":") && !ROTTE.has(r.to)) {
      errori.push(`${r.from}: destinazione ${r.to} non esiste in dist/`);
    }
  }
  assert.deepEqual(errori, [], errori.join("\n"));
});

test("nessuna catena e nessun loop di redirect", () => {
  const mappa = new Map(redirectDichiarati().map((r) => [r.from, r.to]));
  for (const [from, to] of mappa) {
    assert.notEqual(from, to, `redirect su se stesso: ${from}`);
    assert.ok(
      !mappa.has(to) && !mappa.has(to.replace(/\/$/, "")),
      `catena di redirect: ${from} -> ${to} -> ${mappa.get(to) ?? mappa.get(to.replace(/\/$/, ""))}`,
    );
  }
});

test("il redirect non e' realizzato con una pagina-ponte, meta refresh o JavaScript", () => {
  const file = join(DIST, "disciplina-vigente", "regolamento-palio", "index.html");
  assert.ok(
    !existsSync(file),
    "la vecchia rotta genera ancora una pagina HTML: il 301 va servito dalla configurazione, non da una pagina-ponte con canonical, meta refresh o redirect JavaScript",
  );
  // Nessuna pagina del sito deve rimandare alla rotta canonica con un
  // meccanismo client-side mascherato da redirect.
  const sospetti = [];
  for (const f of PAGINE) {
    const html = readFileSync(f, "utf8");
    if (/<meta[^>]+http-equiv=["']refresh["']/i.test(html)) sospetti.push(`${rottaDi(f)}: meta refresh`);
    if (new RegExp(`(location\\.(href|replace)|location\\s*=)[^;]{0,40}${ROTTA_CANONICA}`).test(html)) {
      sospetti.push(`${rottaDi(f)}: redirect JavaScript`);
    }
  }
  assert.deepEqual(sospetti, [], sospetti.join("\n"));
});

// ---------------------------------------------------------------------------
// Assenza dall'output indicizzabile
// ---------------------------------------------------------------------------

test("la vecchia rotta non genera piu' una pagina HTML", () => {
  assert.ok(!ROTTE.has(VECCHIA_ROTTA), "la vecchia rotta e' ancora fra le pagine generate");
});

test("la vecchia rotta non compare nella sitemap", () => {
  const sitemap = leggi("dist/sitemap.xml");
  assert.ok(
    !sitemap.includes(VECCHIA_ROTTA),
    "la vecchia rotta e' ancora dichiarata nella sitemap",
  );
  const loc = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].replace(/^https?:\/\/[^/]+/, ""),
  );
  assert.ok(loc.includes(ROTTA_CANONICA), "la pagina canonica manca dalla sitemap");
});

test("nessun collegamento interno punta piu' alla vecchia rotta", () => {
  const colpevoli = PAGINE.filter((f) => readFileSync(f, "utf8").includes(VECCHIA_ROTTA)).map(
    rottaDi,
  );
  assert.deepEqual(colpevoli, [], `pagine che linkano ancora la vecchia rotta:\n${colpevoli.join("\n")}`);
});

test("l'indice della disciplina vigente linka la pagina canonica, non il redirect", () => {
  const html = readFileSync(join(DIST, "disciplina-vigente", "index.html"), "utf8");
  assert.ok(
    html.includes(`href="${ROTTA_CANONICA}"`),
    "l'indice della disciplina vigente non punta alla pagina canonica",
  );
  assert.ok(
    html.includes("Regolamento per il Palio"),
    "la voce del Regolamento e' scomparsa dall'indice della disciplina vigente",
  );
});

test("il pager delle parti adiacenti punta alla pagina canonica", () => {
  for (const scope of ["previsite-tratta-2026", "coordinamento-regolamento"]) {
    const f = join(DIST, "disciplina-vigente", scope, "index.html");
    const html = readFileSync(f, "utf8");
    assert.ok(!html.includes(VECCHIA_ROTTA), `${scope}: il pager punta ancora alla vecchia rotta`);
    assert.ok(
      html.includes(`href="${ROTTA_CANONICA}"`),
      `${scope}: il pager non punta alla pagina canonica`,
    );
  }
});

// ---------------------------------------------------------------------------
// Pagefind
// ---------------------------------------------------------------------------

/**
 * Frammenti Pagefind decodificati: url + testo indicizzato.
 *
 * I file .pf_fragment sono JSON compresso con gzip, preceduto da un prefisso
 * testuale di Pagefind (`pagefind_dcd`). Si decomprime e si scarta il prefisso.
 */
function frammentiPagefind() {
  const dir = join(DIST, "pagefind", "fragment");
  assert.ok(existsSync(dir), "indice Pagefind assente: eseguire npm run build");
  const out = [];
  for (const nome of readdirSync(dir)) {
    const testo = gunzipSync(readFileSync(join(dir, nome))).toString("utf8");
    const inizio = testo.indexOf("{");
    assert.ok(inizio >= 0, `frammento Pagefind illeggibile: ${nome}`);
    out.push(JSON.parse(testo.slice(inizio)));
  }
  return out;
}

test("la vecchia rotta non e' presente nell'indice Pagefind", () => {
  const urls = frammentiPagefind().map((f) => f.url);
  assert.ok(!urls.includes(VECCHIA_ROTTA), "la vecchia rotta e' ancora indicizzata da Pagefind");
  assert.ok(urls.includes(ROTTA_CANONICA), "la pagina canonica non e' indicizzata da Pagefind");
});

test("una frase univoca dell'articolato produce un solo risultato Pagefind", () => {
  const frammenti = frammentiPagefind();
  const frasi = [
    // La query che prima restituiva sia la pagina canonica sia la vecchia rotta.
    "indirizzo sanzionatorio di riferimento",
    // Frasi tratte dall'articolato, presenti solo nella resa canonica.
    "Le Contrade sono tenute",
    "I loro stemmi e colori risultano dall\u2019allegato",
  ];
  for (const frase of frasi) {
    const trovati = frammenti.filter((f) => f.content.includes(frase)).map((f) => f.url);
    assert.equal(
      trovati.length,
      1,
      `la frase «${frase}» compare in ${trovati.length} pagine indicizzate: ${trovati.join(", ")}`,
    );
    assert.equal(trovati[0], ROTTA_CANONICA, `la frase «${frase}» e' indicizzata su ${trovati[0]}`);
  }
});

test("nessun articolo del Regolamento risulta indicizzato due volte", () => {
  const frammenti = frammentiPagefind();
  const doppi = [];
  for (const n of [1, 16, 37, 74, 99, 105]) {
    const pagine = frammenti
      .filter((f) => new RegExp(`Art\\.\\s*${n}\\b`).test(f.content))
      .map((f) => f.url)
      .filter((u) => u === ROTTA_CANONICA || u === VECCHIA_ROTTA);
    if (pagine.length > 1) doppi.push(`Art. ${n}: ${pagine.join(", ")}`);
  }
  assert.deepEqual(doppi, [], doppi.join("\n"));
});

// ---------------------------------------------------------------------------
// Integrita' della pagina canonica
// ---------------------------------------------------------------------------

test("la pagina canonica esiste ed e' indicizzabile", () => {
  assert.ok(ROTTE.has(ROTTA_CANONICA), "la pagina canonica non e' stata generata");
  const html = readFileSync(join(DIST, "regolamento-per-il-palio", "index.html"), "utf8");
  assert.doesNotMatch(html, /<meta[^>]+name=["']robots["'][^>]*noindex/i);
});

test("la pagina canonica conserva 106 articoli e 106 destinazioni univoche", () => {
  const html = readFileSync(join(DIST, "regolamento-per-il-palio", "index.html"), "utf8");
  const id = new Set([...html.matchAll(/id="(articolo-[a-z0-9-]+)"/g)].map((m) => m[1]));
  assert.equal(id.size, 106, `destinazioni univoche: ${id.size}`);
  assert.ok(id.has("articolo-99-bis"), "manca l'ancora dell'art. 99-bis");
  const titoli = [...html.matchAll(/<h3 class="art__titolo"/g)].length;
  assert.equal(titoli, 106, `titoli di articolo: ${titoli}`);
});

test("la pagina canonica ha canonical e og:url autoreferenziali", () => {
  const html = readFileSync(join(DIST, "regolamento-per-il-palio", "index.html"), "utf8");
  const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html);
  const ogurl = /<meta property="og:url" content="([^"]+)"/.exec(html);
  assert.ok(canonical && ogurl, "canonical o og:url assenti");
  assert.equal(new URL(canonical[1]).pathname, ROTTA_CANONICA);
  assert.equal(canonical[1], ogurl[1]);
});

// ---------------------------------------------------------------------------
// Il corpus interno non e' stato toccato
// ---------------------------------------------------------------------------

test("i 106 chunk di scope regolamento-palio restano nel corpus interno", () => {
  const indice = JSON.parse(leggi("data/chunks.generated.json"));
  const chunk = indice.chunks.filter((c) => c.documentScope === "regolamento-palio");
  assert.equal(chunk.length, 106, `chunk di scope regolamento-palio: ${chunk.length}`);
});

test("la Parte III della KB 03 e' ancora presente come fonte consolidata", () => {
  const kb03 = leggi("content/kb/03_KB_Disciplina_Vigente_Consolidata_2026.md");
  assert.match(kb03, /Parte III — Regolamento per il Palio/);
});
