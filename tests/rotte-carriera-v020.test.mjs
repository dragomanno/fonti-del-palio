/**
 * Gate delle rotte introdotte dalla v0.2.0.
 *
 * Verifica che l'output pubblicato contenga esattamente le rotte previste, che
 * i vincoli documentari sopravvivano al build e che le pagine con dati
 * potenzialmente sensibili non espongano il documento originale.
 *
 * I test leggono `dist/`: presuppongono un build eseguito.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const index = JSON.parse(readFileSync(path.join(ROOT, "data", "carriera.generated.json"), "utf-8"));

function html(route) {
  const file = path.join(DIST, route.replace(/^\/|\/$/g, ""), "index.html");
  assert.ok(existsSync(file), `rotta assente dal build: ${route}`);
  return readFileSync(file, "utf-8");
}

function allHtmlFiles(dir = DIST, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "pagefind" || entry === "_astro") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) allHtmlFiles(full, out);
    else if (entry.endsWith(".html")) out.push(full);
  }
  return out;
}

const ROTTE_ATTESE = [
  "/palio-16-agosto-2026/",
  "/palio-16-agosto-2026/previsite/",
  "/palio-16-agosto-2026/prove-regolamentate/",
  "/palio-16-agosto-2026/tratta/",
  "/palio-16-agosto-2026/accesso-e-sicurezza/",
  "/palio-16-agosto-2026/guida-pratica/",
  "/ordinanze-e-atti/",
  "/documenti-fondamentali/",
  "/regolamento-per-il-palio/",
  "/regolamento-per-il-palio/edizione-previgente/",
  "/documenti-fondamentali/bando-di-violante/",
  ...index.atti.map((a) => `/ordinanze-e-atti/${a.slug}/`),
  ...index.manifesti.map((m) => `/ordinanze-e-atti/${m.slug}/`),
  ...index.bando.contrade.map((c) => `/documenti-fondamentali/bando-di-violante/${c.slug}/`),
];

test("tutte le rotte della carriera sono state costruite", () => {
  assert.equal(ROTTE_ATTESE.length, 46, "il conteggio delle rotte attese è cambiato");
  for (const rotta of ROTTE_ATTESE) html(rotta);
});

test("tutte le rotte della carriera compaiono nella sitemap", () => {
  const sitemap = readFileSync(path.join(DIST, "sitemap.xml"), "utf-8");
  for (const rotta of ROTTE_ATTESE) {
    assert.ok(sitemap.includes(`${rotta}</loc>`), `rotta assente dalla sitemap: ${rotta}`);
  }
});

test("ogni rotta della carriera è indicizzabile e ricercabile", () => {
  for (const rotta of ROTTE_ATTESE) {
    const doc = html(rotta);
    assert.ok(!/name="robots"[^>]*noindex/.test(doc), `rotta marcata noindex: ${rotta}`);
    assert.ok(doc.includes("data-pagefind-body"), `rotta esclusa da Pagefind: ${rotta}`);
  }
});

test("ogni atto ripubblicabile serve il proprio PDF", () => {
  for (const atto of index.atti.filter((a) => a.ripubblicabile)) {
    const doc = html(`/ordinanze-e-atti/${atto.slug}/`);
    assert.ok(atto.pdf, `PDF non dichiarato per ${atto.id}`);
    assert.ok(doc.includes(atto.pdf), `link al PDF assente in ${atto.id}`);
    assert.ok(
      existsSync(path.join(DIST, atto.pdf.replace(/^\//, ""))),
      `PDF non presente in dist per ${atto.id}`
    );
  }
});

test("l'atto non ripubblicabile non espone né PDF né file scaricabile", () => {
  const riservati = index.atti.filter((a) => !a.ripubblicabile);
  assert.equal(riservati.length, 1, "il numero di atti non ripubblicabili è cambiato");
  const [atto] = riservati;
  const doc = html(`/ordinanze-e-atti/${atto.slug}/`);
  assert.equal(atto.pdf, null, "un atto non ripubblicabile non deve dichiarare un PDF");
  assert.ok(!/href="[^"]*\.pdf"/i.test(doc), "la pagina espone un link a un PDF");
  assert.ok(doc.includes("dati personali"), "manca la motivazione della mancata ripubblicazione");
  assert.ok(doc.includes(atto.sha256), "manca il digest del file acquisito");
});

test("nessun PDF non registrato è servito in dist", () => {
  const dir = path.join(DIST, "atti", "2026");
  const serviti = readdirSync(dir).filter((f) => f.endsWith(".pdf"));
  const attesi = index.atti
    .filter((a) => a.ripubblicabile)
    .map((a) => path.basename(a.pdf))
    .sort();
  assert.deepEqual(serviti.sort(), attesi);
});

test("il repertorio delle strade non è ripubblicato", () => {
  // La sola menzione ammessa è la riga del registro delle fonti, che ne
  // dichiara l'esistenza e la mancata ripubblicazione.
  const pagine = allHtmlFiles().filter((f) =>
    readFileSync(f, "utf-8").includes("Le strade delle Contrade")
  );
  assert.deepEqual(
    pagine.map((f) => path.relative(DIST, f)),
    [path.join("documenti-fondamentali", "index.html")]
  );
  const doc = html("/documenti-fondamentali/");
  assert.ok(doc.includes("non è ripubblicato"), "manca la dichiarazione di mancata ripubblicazione");
  assert.ok(!/href="[^"]*\.docx"/i.test(doc), "la pagina espone un link a un .docx");
});

test("l'elenco delle previsite riporta tutti i cavalli in numerazione continua", () => {
  const doc = html("/palio-16-agosto-2026/previsite/");
  assert.equal(index.previsite.cavalli.length, 108);
  for (const cavallo of index.previsite.cavalli) {
    assert.ok(doc.includes(cavallo.nome), `cavallo assente dalla pagina: ${cavallo.nome}`);
  }
  const numeri = index.previsite.cavalli.map((c) => c.numero);
  assert.deepEqual(numeri, Array.from({ length: numeri.length }, (_, i) => i + 1));
});

test("ogni Contrada ha la propria pagina con i confini del Bando", () => {
  assert.equal(index.bando.contrade.length, 17);
  for (const contrada of index.bando.contrade) {
    const doc = html(`/documenti-fondamentali/bando-di-violante/${contrada.slug}/`);
    assert.ok(contrada.confini.length > 40, `confini troppo brevi per ${contrada.nome}`);
    assert.ok(doc.includes("1729"), `manca la data del Bando in ${contrada.nome}`);
    assert.ok(
      doc.includes("toponomastica"),
      `manca l'avvertenza sulla toponomastica in ${contrada.nome}`
    );
  }
});

test("la collazione pubblica tutte le unità articolo confrontate", () => {
  const doc = html("/regolamento-per-il-palio/edizione-previgente/");
  const righe = doc.match(/<th scope="row" data-label="Art\."/g) ?? [];
  assert.equal(righe.length, index.collazione.prospetto.length);
  assert.equal(index.collazione.prospetto.length, 106);
  assert.ok(doc.includes("99bis"), "manca l'art. 99bis dal prospetto");
  assert.ok(
    doc.includes("non è più vigente"),
    "manca l'avvertenza sulla non vigenza dell'edizione previgente"
  );
});

test("l'edizione vigente è datata all'approvazione, non alla presentazione", () => {
  const doc = html("/regolamento-per-il-palio/");
  assert.ok(doc.includes("2019"), "manca l'anno di approvazione");
  assert.ok(doc.includes("28 maggio 2021"), "manca la data di presentazione");
  assert.ok(
    !/Regolamento\s+del\s+2021/.test(doc.replace(/«|»/g, "")) ||
      doc.includes("Chiamare «Regolamento del 2021»"),
    "l'edizione vigente non deve essere identificata come «Regolamento del 2021»"
  );
});

test("ogni pagina della carriera dichiara provenienza e limiti", () => {
  for (const rotta of ROTTE_ATTESE) {
    const doc = html(rotta);
    assert.ok(
      /class="nota nota--/.test(doc),
      `manca la nota documentaria nella rotta ${rotta}`
    );
  }
});

test("la gerarchia delle intestazioni non salta livelli", () => {
  for (const rotta of ROTTE_ATTESE) {
    const doc = html(rotta);
    const livelli = [...doc.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    assert.equal(livelli.filter((l) => l === 1).length, 1, `h1 non unico nella rotta ${rotta}`);
    let precedente = livelli[0];
    for (const livello of livelli.slice(1)) {
      assert.ok(
        livello <= precedente + 1,
        `salto di livello h${precedente}→h${livello} nella rotta ${rotta}`
      );
      precedente = livello;
    }
  }
});

test("le pagine della carriera non contengono caratteri di sostituzione", () => {
  for (const rotta of ROTTE_ATTESE) {
    const doc = html(rotta);
    assert.ok(!doc.includes("\uFFFD"), `carattere di sostituzione nella rotta ${rotta}`);
    assert.ok(!doc.includes("Â "), `mojibake nella rotta ${rotta}`);
  }
});

test("le sotto-intestazioni dei blocchi documentari sono abbassate di livello", () => {
  // Materie e sezioni di guida arrivano da file in cui erano intestazioni di
  // primo o secondo livello. Reinserite sotto l'h2 della pagina devono
  // comparire come h3 o piu' profonde, mai come h2 in concorrenza col titolo
  // della materia.
  for (const rotta of [
    "/palio-16-agosto-2026/accesso-e-sicurezza/",
    "/palio-16-agosto-2026/guida-pratica/",
  ]) {
    const doc = html(rotta);
    const corpo = doc.slice(doc.indexOf("<main"), doc.indexOf("</main>"));
    const h2 = [...corpo.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) =>
      m[1].replace(/<[^>]+>/g, "").trim()
    );
    // Gli h2 ammessi sono i titoli delle sezioni pagina, i titoli delle
    // materie/sezioni e i titoli delle note: nessuno proveniente dal corpo
    // Markdown, che e' numerato.
    for (const titolo of h2) {
      assert.ok(
        !/^\d+\.\d+\s/.test(titolo),
        `sotto-intestazione numerata rimasta a livello h2 in ${rotta}: ${titolo}`
      );
    }
  }
  // Le materie consolidate hanno sotto-intestazioni numerate nel file di
  // origine: dopo l'abbassamento devono esistere come terzo livello. Le sezioni
  // della guida sono piatte per costruzione e non offrono questo riscontro.
  const materie = html("/palio-16-agosto-2026/accesso-e-sicurezza/");
  assert.ok(/<h3[\s>]/.test(materie), "nessuna sotto-intestazione di terzo livello fra le materie");
});
