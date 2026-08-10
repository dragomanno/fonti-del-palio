/**
 * Gate del documento operativo acquisito il 10 agosto 2026: i cavalli ammessi
 * alle prove regolamentate dell'11 e 12 agosto e quelli ammessi direttamente
 * alla Tratta del 13 agosto.
 *
 * Il documento non e' un atto e non e' un manifesto: non porta numero di
 * protocollo, non e' sottoscritto e la sua provenienza e' accertata a livello
 * di fonte, non di singolo collegamento al file. Questi test difendono la
 * distinzione fra le fasi (Previsite, prove regolamentate, Tratta, Carriera),
 * l'integrita' del PDF ripubblicato e la dichiarazione esplicita dei limiti.
 *
 * I test leggono `dist/`: presuppongono un build eseguito.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const PUBLIC = path.join(ROOT, "public");
const index = JSON.parse(
  readFileSync(path.join(ROOT, "data", "carriera.generated.json"), "utf-8"),
);
const kb09 = readFileSync(
  path.join(ROOT, "content", "carriere", "09_KB_Corpus_Ordinanze_e_Atti_Palio_Agosto_2026.md"),
  "utf-8",
);
const kb12 = readFileSync(
  path.join(ROOT, "content", "carriere", "12_KB_Manifest_Generale_Fonti_del_Palio_2026.md"),
  "utf-8",
);

const ID = "COM-2026-08-PROVEREG-001";
const ROTTA = "/palio-16-agosto-2026/prove-regolamentate/";

function html(route) {
  const file = path.join(DIST, route.replace(/^\/|\/$/g, ""), "index.html");
  assert.ok(existsSync(file), `rotta assente dal build: ${route}`);
  return readFileSync(file, "utf-8");
}

const blocco = index.proveRegolamentate;

test("l'indice registra il blocco del 10 agosto 2026", () => {
  assert.ok(blocco, "index.proveRegolamentate assente");
  assert.equal(blocco.documento.id, ID);
  assert.equal(blocco.documento.data, "10/08/2026");
  assert.equal(blocco.documento.pagine, 2);
  assert.match(blocco.documento.sha256, /^[0-9a-f]{64}$/, "digest malformato");
  assert.equal(blocco.documento.ripubblicabile, true);
  assert.ok(blocco.documento.scheda.length > 200, "scheda documentaria troppo breve");
});

test("le due liste hanno la consistenza pubblicata e restano distinte", () => {
  assert.equal(blocco.proveRegolamentate.length, 77);
  assert.equal(blocco.trattaDiretta.length, 8);
  // Le fasi sono diverse: le liste non devono essere fuse in un solo array.
  assert.notEqual(blocco.proveRegolamentate, blocco.trattaDiretta);
  assert.equal(blocco.proveRegolamentate.length + blocco.trattaDiretta.length, 85);
  // Lo snapshot dei 108 ammessi alle Previsite non e' stato sovrascritto.
  assert.equal(index.previsite.cavalli.length, 108);
});

test("ogni riga delle liste e' completa e numerata senza salti", () => {
  for (const [etichetta, lista] of [
    ["prove regolamentate", blocco.proveRegolamentate],
    ["Tratta diretta", blocco.trattaDiretta],
  ]) {
    assert.deepEqual(
      lista.map((c) => c.numero),
      lista.map((_, i) => i + 1),
      `numerazione non continua da 1 nella lista ${etichetta}`,
    );
    for (const c of lista) {
      assert.ok(c.nome.trim().length > 0, `nome vuoto nella lista ${etichetta}`);
      assert.ok(c.proprietario.trim().length > 0, `proprietario vuoto nella lista ${etichetta}`);
    }
  }
});

test("gli estremi della fonte sono trascritti senza normalizzazioni indebite", () => {
  const nomi = blocco.proveRegolamentate.map((c) => c.nome);
  assert.equal(nomi[0], "ARES ELCE");
  assert.equal(nomi[nomi.length - 1], "ZIO FRAC");
  assert.equal(blocco.trattaDiretta[0].nome, "ANDA E BOLA");
  assert.equal(blocco.trattaDiretta[blocco.trattaDiretta.length - 1].nome, "VOLPINO");
  // Gli apostrofi tipografici della fonte restano U+2019 e non diventano ASCII.
  assert.ok(
    nomi.includes("GALUSE\u2019 BOY AA") && nomi.includes("GIA\u2019 FUD\u2019ORA AA"),
    "gli apostrofi tipografici della fonte non sono conservati",
  );
  assert.ok(
    blocco.trattaDiretta.some((c) => c.nome === "VISO D\u2019ANGELO"),
    "VISO D\u2019ANGELO non e' trascritto come nella fonte",
  );
});

test("il PDF acquisito esiste, e' reale e coincide con il digest registrato", () => {
  const pdf = blocco.documento.pdf;
  assert.ok(
    pdf && pdf.startsWith("/atti/2026/prove-regolamentate/"),
    "percorso PDF inatteso",
  );
  const sorgente = path.join(PUBLIC, pdf.replace(/^\//, ""));
  assert.ok(existsSync(sorgente), `PDF assente da public/: ${pdf}`);
  const bytes = readFileSync(sorgente);
  assert.ok(statSync(sorgente).size > 20000, `PDF sospettosamente piccolo: ${pdf}`);
  assert.equal(bytes.subarray(0, 4).toString("latin1"), "%PDF", `non e' un PDF: ${pdf}`);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    blocco.documento.sha256,
    "digest divergente rispetto al file acquisito",
  );
  assert.ok(existsSync(path.join(DIST, pdf.replace(/^\//, ""))), `PDF non copiato nel build: ${pdf}`);
});

test("il documento non e' registrato fra gli atti ne fra i manifesti", () => {
  assert.ok(!index.atti.some((a) => a.id === ID), `${ID} compare fra gli atti`);
  assert.ok(!index.manifesti.some((m) => m.id === ID), `${ID} compare fra i manifesti`);
  assert.equal(index.atti.length, 13, "il numero degli atti registrati e' cambiato");
  assert.equal(index.manifesti.length, 5, "il numero dei manifesti registrati e' cambiato");
});

test("la pagina pubblica espone identificativo, digest, PDF e consistenze", () => {
  const pagina = html(ROTTA);
  assert.ok(pagina.includes(ID), "la pagina non espone il proprio identificativo");
  assert.ok(pagina.includes(blocco.documento.sha256), "la pagina non espone il digest completo");
  assert.ok(pagina.includes(blocco.documento.pdf), "la pagina non collega il PDF acquisito");
  assert.ok(pagina.includes("77"), "la pagina non dichiara i 77 ammessi alle prove regolamentate");
  assert.ok(pagina.includes("ARES ELCE"), "la prima riga della lista non e' pubblicata");
  assert.ok(pagina.includes("ZIO FRAC"), "l'ultima riga della lista non e' pubblicata");
  assert.ok(pagina.includes("VOLPINO"), "la lista della Tratta non e' pubblicata");
});

test("la pagina pubblica dichiara i limiti documentari senza dedurre nulla", () => {
  const pagina = html(ROTTA);
  assert.ok(
    pagina.includes("non porta numero di protocollo"),
    "la pagina non dichiara l'assenza del numero di protocollo",
  );
  assert.ok(
    pagina.includes("a livello di fonte"),
    "la pagina non dichiara il limite di provenienza",
  );
  assert.ok(
    /108/.test(pagina),
    "la pagina non mette in relazione le liste con i 108 ammessi alle Previsite",
  );
  assert.ok(
    pagina.includes("10 agosto 2026") || pagina.includes("10/08/2026"),
    "la pagina non dichiara la data di pubblicazione",
  );
  // Nessun numero d'atto ricostruito per un documento che non lo porta.
  assert.ok(
    !/\bordinanza\s+n\.\s*\d+/i.test(pagina),
    "la pagina attribuisce al documento un numero d'ordinanza",
  );
});

test("l'ingresso della Carriera collega la nuova sezione", () => {
  const hub = html("/palio-16-agosto-2026/");
  assert.ok(hub.includes(ROTTA), "la pagina della Carriera non collega le prove regolamentate");
  assert.ok(
    hub.includes("prove regolamentate"),
    "la pagina della Carriera non menziona le prove regolamentate",
  );
});

test("KB 09 e KB 12 registrano il documento con provenienza e limiti", () => {
  assert.ok(
    kb09.includes("## 11. Registro del documento operativo acquisito il 10 agosto 2026"),
    "KB 09 non contiene il registro del 10 agosto 2026",
  );
  assert.ok(kb09.includes(ID), `KB 09 non contiene la scheda di ${ID}`);
  assert.ok(
    kb09.includes(
      "https://www.comune.siena.it/novita/palio-16-agosto-lelenco-dei-cavalli-ammessi-alle-prove-regolamentate-e-alla-tratta-1",
    ),
    "KB 09 non dichiara la fonte di provenienza",
  );
  assert.ok(kb09.includes(blocco.documento.sha256), "KB 09 non registra il digest del documento");
  assert.ok(kb12.includes(ID), `KB 12 non registra ${ID}`);
  assert.ok(
    kb12.includes("`richiamato`"),
    "KB 12 non conserva lo stato degli atti richiamati",
  );
});
