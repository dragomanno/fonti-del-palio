/**
 * Gate del documento operativo acquisito il 12 agosto 2026: l'elenco finale
 * dei 35 cavalli ammessi alla Tratta del 13 agosto, esito delle prove
 * regolamentate dell'11 e 12 agosto.
 *
 * Il documento non e' un atto e non e' un manifesto: non porta numero di
 * protocollo, non e' sottoscritto e la sua provenienza e' un'acquisizione
 * HITL fidata dichiarata dal curatore, non una scoperta di fonte web. Questi
 * test difendono la distinzione da: i 108 ammessi alle Previsite, i 77
 * ammessi alle prove regolamentate e gli 8 ammessi direttamente alla Tratta
 * (lotto del 10 agosto 2026) — nessuna delle quattro istantanee sovrascrive
 * le altre — oltre all'integrita' del PDF ripubblicato e alla dichiarazione
 * esplicita dei limiti.
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

const ID = "COM-2026-08-TRATTA-001";
const ROTTA = "/palio-16-agosto-2026/tratta/";

function html(route) {
  const file = path.join(DIST, route.replace(/^\/|\/$/g, ""), "index.html");
  assert.ok(existsSync(file), `rotta assente dal build: ${route}`);
  return readFileSync(file, "utf-8");
}

const blocco = index.tratta;

test("l'indice registra il blocco del 12 agosto 2026", () => {
  assert.ok(blocco, "index.tratta assente");
  assert.equal(blocco.documento.id, ID);
  assert.equal(blocco.documento.data, "12/08/2026");
  assert.equal(blocco.documento.pagine, 1);
  assert.match(blocco.documento.sha256, /^[0-9a-f]{64}$/, "digest malformato");
  assert.equal(blocco.documento.ripubblicabile, true);
  assert.ok(blocco.documento.scheda.length > 200, "scheda documentaria troppo breve");
});

test("l'elenco ha la consistenza dichiarata e resta distinto dalle liste precedenti", () => {
  assert.equal(blocco.cavalli.length, 35);
  // Gli snapshot precedenti non sono stati sovrascritti o fusi con questo.
  assert.equal(index.previsite.cavalli.length, 108);
  assert.equal(index.proveRegolamentate.proveRegolamentate.length, 77);
  assert.equal(index.proveRegolamentate.trattaDiretta.length, 8);
  assert.notEqual(blocco.cavalli, index.proveRegolamentate.trattaDiretta);
});

test("ogni riga dell'elenco e' completa e numerata senza salti", () => {
  assert.deepEqual(
    blocco.cavalli.map((c) => c.numero),
    blocco.cavalli.map((_, i) => i + 1),
    "numerazione non continua da 1 nell'elenco della Tratta",
  );
  for (const c of blocco.cavalli) {
    assert.ok(c.nome.trim().length > 0, "nome vuoto nell'elenco della Tratta");
    assert.ok(c.proprietario.trim().length > 0, "proprietario vuoto nell'elenco della Tratta");
  }
});

test("gli estremi della fonte sono trascritti senza normalizzazioni indebite", () => {
  const nomi = blocco.cavalli.map((c) => c.nome);
  assert.equal(nomi[0], "ANDA E BOLA");
  assert.equal(nomi[nomi.length - 1], "ZENTILES");
  // L'apostrofo tipografico della fonte resta U+2019 e non diventa ASCII.
  assert.ok(
    nomi.includes("VISO D\u2019ANGELO"),
    "VISO D\u2019ANGELO non e' trascritto come nella fonte",
  );
  const proprietari = blocco.cavalli.map((c) => c.proprietario);
  assert.ok(proprietari.includes("Dario Colag\u00e8"), "Dario Colag\u00e8 non e' trascritto come nella fonte");
  assert.ok(
    proprietari.includes("Nicol\u00f2 Farnetani"),
    "Nicol\u00f2 Farnetani non e' trascritto come nella fonte",
  );
});

test("il PDF acquisito esiste, e' reale e coincide con il digest registrato", () => {
  const pdf = blocco.documento.pdf;
  assert.ok(pdf && pdf.startsWith("/atti/2026/tratta/"), "percorso PDF inatteso");
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

test("la pagina pubblica espone identificativo, digest, PDF e consistenza", () => {
  const pagina = html(ROTTA);
  assert.ok(pagina.includes(ID), "la pagina non espone il proprio identificativo");
  assert.ok(pagina.includes(blocco.documento.sha256), "la pagina non espone il digest completo");
  assert.ok(pagina.includes(blocco.documento.pdf), "la pagina non collega il PDF acquisito");
  assert.ok(pagina.includes("35"), "la pagina non dichiara i 35 ammessi alla Tratta");
  assert.ok(pagina.includes("ANDA E BOLA"), "la prima riga della lista non e' pubblicata");
  assert.ok(pagina.includes("ZENTILES"), "l'ultima riga della lista non e' pubblicata");
});

test("la pagina pubblica dichiara i limiti documentari senza dedurre nulla", () => {
  const pagina = html(ROTTA);
  assert.ok(
    pagina.includes("non porta numero di protocollo"),
    "la pagina non dichiara l'assenza del numero di protocollo",
  );
  assert.ok(
    pagina.includes("https://palio.comune.siena.it/node/5935"),
    "la pagina non collega la designazione istituzionale del canale di diffusione",
  );
  assert.ok(
    /non\s+riporta un numero di post Telegram/.test(pagina),
    "la pagina non dichiara l'assenza di un numero di post Telegram o di un URL del Comune",
  );
  assert.ok(
    /distinto e successivo|distinta e successiva/.test(pagina),
    "la pagina non distingue l'elenco finale dagli 8 ammessi direttamente alla Tratta",
  );
  assert.ok(
    !/\bordinanza\s+n\.\s*\d+/i.test(pagina),
    "la pagina attribuisce al documento un numero d'ordinanza",
  );
  // La pagina puo' dichiarare esplicitamente che non assegna cavalli alle Contrade,
  // ma non deve mai affermare un'assegnazione effettiva.
  assert.ok(
    /non\s+assegna alcun cavallo a una Contrada/.test(pagina) ||
      /assegnazione di alcun cavallo a una Contrada/.test(pagina),
    "la pagina non dichiara esplicitamente l'assenza di assegnazioni a Contrada",
  );
  assert.ok(
    !/\bassegnato alla Contrada\b/i.test(pagina),
    "la pagina introduce un'assegnazione effettiva a Contrada non prevista dal documento",
  );
});

test("l'ingresso della Carriera collega la nuova sezione con l'ordinale corretto", () => {
  const hub = html("/palio-16-agosto-2026/");
  assert.ok(hub.includes(ROTTA), "la pagina della Carriera non collega l'elenco della Tratta");
  assert.ok(
    hub.includes("Cavalli ammessi alla Tratta"),
    "la pagina della Carriera non menziona il nuovo titolo",
  );
  // La voce delle prove regolamentate resta al proprio posto e non e' stata rimossa.
  assert.ok(
    hub.includes("/palio-16-agosto-2026/prove-regolamentate/"),
    "la pagina della Carriera non collega piu' le prove regolamentate",
  );
});

test("KB 09 e KB 12 registrano il documento con provenienza e limiti", () => {
  assert.ok(
    kb09.includes(
      "## 11bis. Registro del documento operativo acquisito il 12 agosto 2026 (elenco finale ammessi alla Tratta)",
    ),
    "KB 09 non contiene il registro dell'11bis",
  );
  assert.ok(kb09.includes(ID), `KB 09 non contiene la scheda di ${ID}`);
  assert.ok(kb09.includes(blocco.documento.sha256), "KB 09 non registra il digest del documento");
  assert.ok(
    kb09.includes("acquisizione HITL fidata"),
    "KB 09 non dichiara la natura dell'acquisizione",
  );
  assert.ok(kb12.includes(ID), `KB 12 non registra ${ID}`);
  assert.ok(
    kb12.includes("## 4.6 Documento operativo del 12 agosto 2026"),
    "KB 12 non contiene la sezione 4.6",
  );
});
