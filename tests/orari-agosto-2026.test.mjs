/**
 * Gate del documento operativo acquisito il 10 agosto 2026: il calendario
 * operativo di tutti gli orari della Carriera del 16 agosto 2026.
 *
 * Il documento non e' un atto e non e' un manifesto: non porta numero di
 * protocollo, non e' sottoscritto e non e' il documento operativo delle
 * prove regolamentate (COM-2026-08-PROVEREG-001), con cui resta collegato
 * per materia ma distinto. Non esiste un PDF ripubblicabile perche' la fonte
 * e' nativamente HTML: questi test difendono l'integrita' dell'istantanea
 * acquisita, la distinzione fra le fasi del calendario e la dichiarazione
 * esplicita dei limiti interpretativi.
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

const ID = "COM-2026-08-ORARI-001";
const ROTTA = "/palio-16-agosto-2026/orari/";

function html(route) {
  const file = path.join(DIST, route.replace(/^\/|\/$/g, ""), "index.html");
  assert.ok(existsSync(file), `rotta assente dal build: ${route}`);
  return readFileSync(file, "utf-8");
}

const blocco = index.orari;

test("l'indice registra il blocco del calendario orari del 10 agosto 2026", () => {
  assert.ok(blocco, "index.orari assente");
  assert.equal(blocco.documento.id, ID);
  assert.equal(blocco.documento.data, "09/08/2026");
  assert.equal(blocco.documento.ripubblicabile, false);
  assert.equal(blocco.documento.pdf, null);
  assert.match(blocco.documento.sha256, /^[0-9a-f]{64}$/, "digest malformato");
  assert.ok(blocco.documento.scheda.length > 200, "scheda documentaria troppo breve");
});

test("il calendario ha sette giornate, ciascuna con almeno una fase", () => {
  assert.equal(blocco.giorni.length, 7);
  for (const giorno of blocco.giorni) {
    assert.ok(giorno.titolo.trim().length > 0, "titolo di giornata vuoto");
    assert.ok(giorno.fasi.length > 0, `nessuna fase per "${giorno.titolo}"`);
    for (const f of giorno.fasi) {
      assert.ok(f.orario.trim().length > 0, `orario vuoto in "${giorno.titolo}"`);
      assert.ok(f.fase.trim().length > 0, `fase vuota in "${giorno.titolo}"`);
    }
  }
});

test("le fasi chiave del calendario sono trascritte con l'orario dichiarato dalla fonte", () => {
  const tutte = blocco.giorni.flatMap((g) => g.fasi);
  const trova = (testo) => tutte.find((f) => f.fase.includes(testo));

  assert.equal(trova("Corteo Storico")?.orario, "16:50");
  assert.equal(trova("uscita dei cavalli dal Cortile del Podest\u00e0 per il Palio")?.orario, "19:00");
  assert.equal(trova("Messa del Fantino")?.orario, "07:45");
  assert.equal(trova("inizio delle prove regolamentate")?.orario, "06:00");
  assert.equal(trova("Premio Mangia")?.orario, "11:30");
});

test("l'istantanea HTML acquisita esiste, e' reale e coincide con il digest registrato", () => {
  const file = blocco.documento.html;
  assert.ok(file && file.startsWith("/atti/2026/orari/"), "percorso HTML inatteso");
  const sorgente = path.join(PUBLIC, file.replace(/^\//, ""));
  assert.ok(existsSync(sorgente), `istantanea assente da public/: ${file}`);
  const bytes = readFileSync(sorgente);
  assert.ok(statSync(sorgente).size > 100000, `istantanea sospettosamente piccola: ${file}`);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    blocco.documento.sha256,
    "digest divergente rispetto al file acquisito",
  );
  assert.ok(
    existsSync(path.join(DIST, file.replace(/^\//, ""))),
    `istantanea non copiata nel build: ${file}`,
  );
});

test("il documento non e' registrato fra gli atti, i manifesti, o confuso con le prove regolamentate", () => {
  assert.ok(!index.atti.some((a) => a.id === ID), `${ID} compare fra gli atti`);
  assert.ok(!index.manifesti.some((m) => m.id === ID), `${ID} compare fra i manifesti`);
  assert.notEqual(ID, index.proveRegolamentate.documento.id);
  assert.equal(index.atti.length, 13, "il numero degli atti registrati e' cambiato");
  assert.equal(index.manifesti.length, 5, "il numero dei manifesti registrati e' cambiato");
});

test("la pagina pubblica espone identificativo, digest e le sette giornate", () => {
  const pagina = html(ROTTA);
  assert.ok(pagina.includes(ID), "la pagina non espone il proprio identificativo");
  assert.ok(pagina.includes(blocco.documento.sha256), "la pagina non espone il digest completo");
  for (const giorno of blocco.giorni) {
    assert.ok(pagina.includes(giorno.titolo), `la pagina non pubblica il giorno "${giorno.titolo}"`);
  }
  assert.ok(pagina.includes("16:50"), "la pagina non pubblica l'orario del Corteo Storico");
  assert.ok(pagina.includes("19:00"), "la pagina non pubblica l'orario di uscita per il Palio");
});

test("la pagina pubblica dichiara i limiti interpretativi senza dedurre nulla", () => {
  const pagina = html(ROTTA);
  assert.ok(
    pagina.includes("non è un'ordinanza") || pagina.includes("non e' un'ordinanza"),
    "la pagina non dichiara che il documento non è un'ordinanza",
  );
  assert.ok(
    /Prova.{0,80}Provaccia|Provaccia.{0,80}Prova/s.test(pagina),
    "la pagina non distingue Prova, Prova Generale e Provaccia",
  );
  assert.ok(
    pagina.includes(blocco.documento.html ?? ""),
    "la pagina non collega l'istantanea HTML acquisita",
  );
  // Nessun numero d'atto ricostruito per un documento che non lo porta.
  assert.ok(
    !/\bordinanza\s+n\.\s*\d+/i.test(pagina),
    "la pagina attribuisce al documento un numero d'ordinanza",
  );
});

test("l'ingresso della Carriera collega la nuova sezione", () => {
  const hub = html("/palio-16-agosto-2026/");
  assert.ok(hub.includes(ROTTA), "la pagina della Carriera non collega il calendario orari");
  assert.ok(
    hub.includes("orari") || hub.includes("Orari"),
    "la pagina della Carriera non menziona il calendario orari",
  );
});

test("KB 09 registra il documento con provenienza, limiti e le sette giornate", () => {
  assert.ok(
    kb09.includes("## 12. Registro del documento operativo acquisito il 10 agosto 2026 (calendario orari)"),
    "KB 09 non contiene il registro del calendario orari",
  );
  assert.ok(kb09.includes(ID), `KB 09 non contiene la scheda di ${ID}`);
  assert.ok(
    kb09.includes("https://www.comune.siena.it/novita/palio-16-agosto-tutti-gli-orari-1"),
    "KB 09 non dichiara la fonte di provenienza",
  );
  assert.ok(kb09.includes(blocco.documento.sha256), "KB 09 non registra il digest del documento");
  for (let n = 1; n <= 7; n += 1) {
    assert.ok(kb09.includes(`### 12.${n} `), `KB 09 non contiene la sottosezione 12.${n}`);
  }
  assert.ok(kb09.includes("### 12.8 Limiti interpretativi"), "KB 09 non contiene i limiti interpretativi");
});
