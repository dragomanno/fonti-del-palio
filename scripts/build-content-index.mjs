#!/usr/bin/env node
/**
 * CHUNKER DI PRODUZIONE — Fonti del Palio, milestone M1.
 *
 * Sostituisce il placeholder della fase M0. Le regole di chunking sono quelle
 * approvate e verificate dalla diagnostica congelata v3.1.3 (baseline interna):
 * questo script NON reimplementa i parser, ma riusa gli stessi identici parser
 * canonici esportati da scripts/chunk-diagnostic.mjs. Un secondo parser
 * indipendente sarebbe una seconda verita' possibile: qui ne esiste una sola.
 *
 * Cosa aggiunge rispetto alla diagnostica:
 *  - ricostruisce il testo reale di ogni chunk dai file canonici;
 *  - assegna a ogni chunk una rotta pubblica stabile e un'ancora;
 *  - normalizza i quattro stati documentali in una forma consumabile dalle pagine;
 *  - emette la citazione canonica (file, righe, hash) di ogni chunk.
 *
 * DETERMINISMO (vincolo di release): nessun timestamp, nessun valore casuale,
 * nessuna dipendenza dall'ordine di iterazione di una Map non ordinata. Due
 * esecuzioni consecutive producono un file byte-identico.
 *
 * NON fa parte di questo script, per decisione esplicita: embeddings, retrieval,
 * ranking semantico, chiamate di rete, qualunque layer AI.
 */

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";

import { analyzeAll, reconstructCandidateText } from "./chunk-diagnostic.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/** Nomi reali dei file canonici, per la citazione mostrata all'utente. */
const CANONICAL_FILE_NAMES = {
  kb01: "01_KB_Corpus_Storico_Protocollo_Equino_2012_2026.md",
  kb02: "02_KB_Memoria_Incrementale_Protocollo_Equino_2012_2026.md",
  kb03: "03_KB_Disciplina_Vigente_Consolidata_2026.md",
  kb04: "04_KB_Manifest_Fonti_e_Registro_Atti_2012_2026.md",
};

/** Etichette leggibili dei quattro corpora canonici. */
const CANONICAL_FILE_LABELS = {
  kb01: "KB 01 — Corpus storico",
  kb02: "KB 02 — Memoria incrementale",
  kb03: "KB 03 — Disciplina vigente consolidata",
  kb04: "KB 04 — Manifest fonti e registro atti",
};

/**
 * Scope KB03 esclusi dalle pagine pubbliche di disciplina: sono intestazioni
 * strutturali e avvertenze di inquadramento, gia' rese altrove nel sito.
 * Restano nell'indice con route null, non vengono cancellati.
 */
const NON_PUBLIC_SCOPES = new Set(["non-chunkable"]);

/** Titoli pubblici delle parti della disciplina vigente (KB03). */
const DISCIPLINA_SECTIONS = [
  { scope: "protocollo-2026", title: "Protocollo Equino 2026", ordinal: 1,
    summary: "Il testo consolidato del Protocollo Equino per l'annualita' 2026, articolo per articolo." },
  { scope: "ordinanza-5-2026", title: "Ordinanza sindacale n. 5/2026", ordinal: 2,
    summary: "Disposizioni attuative sull'ordine pubblico e sullo svolgimento delle fasi del Palio." },
  { scope: "ordinanza-6-2026", title: "Ordinanza sindacale n. 6/2026 e Protocollo farmacologico", ordinal: 3,
    summary: "Disciplina dei trattamenti veterinari e delle sostanze ammesse, con la tabella dei farmaci controllati." },
  { scope: "programma-2026", title: "Programma 2026", ordinal: 4,
    summary: "Il calendario ufficiale delle fasi dell'annualita'." },
  { scope: "previsite-tratta-2026", title: "Previsite, prove regolamentate e Tratta 2026", ordinal: 5,
    summary: "Le procedure di selezione e verifica sanitaria dei cavalli prima della corsa." },
  { scope: "regolamento-palio", title: "Regolamento per il Palio", ordinal: 6,
    summary: "Il Regolamento generale della corsa, dagli articoli 1 a 105." },
  { scope: "coordinamento-regolamento", title: "Coordinamento con il Regolamento", ordinal: 7,
    summary: "I punti in cui Protocollo e Regolamento si intersecano e vanno letti insieme." },
  { scope: "stato-completezza", title: "Stato di completezza del corpus", ordinal: 8,
    summary: "Cosa risulta acquisito, cosa identificato ma non ancora reperito, cosa resta da verificare." },
];

const DISCIPLINA_SCOPE_MAP = new Map(DISCIPLINA_SECTIONS.map((s) => [s.scope, s]));

/** Trasforma un id canonico in ancora HTML stabile. */
function toAnchor(id) {
  return id.replace(/:/g, "--").replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
}

/** Estrae l'identificativo di atto dallo scope KB01 (atto-pe-2012-01 -> pe-2012-01). */
function actSlugFromScope(documentScope) {
  const m = /^atto-(pe-\d{4}-\d{2})$/.exec(documentScope);
  return m ? m[1] : null;
}

/**
 * Assegna la rotta pubblica di un chunk. Una rotta null significa
 * "presente nell'indice ma non reso come pagina pubblica".
 */
function assignRoute(candidate) {
  const { file, documentScope, year } = candidate;

  if (NON_PUBLIC_SCOPES.has(documentScope)) return null;

  if (file === "kb03") {
    if (!DISCIPLINA_SCOPE_MAP.has(documentScope)) return null;
    return `/disciplina-vigente/${documentScope}/`;
  }

  if (file === "kb01") {
    const slug = actSlugFromScope(documentScope);
    if (slug) return `/atti/${slug}/`;
    // corpus-storico-intro: materiale introduttivo del corpus storico
    return "/evoluzione-storica/";
  }

  if (file === "kb02") {
    if (documentScope === "memoria-incrementale-cornice") {
      return "/evoluzione-storica/tabelle-storiche/";
    }
    if (typeof year === "number") return `/evoluzione-storica/${year}/`;
    return "/evoluzione-storica/";
  }

  if (file === "kb04") {
    if (documentScope === "registro-fonti" && candidate.naturalId) {
      return `/fonti/${candidate.naturalId.toLowerCase()}/`;
    }
    return "/fonti/";
  }

  return null;
}

/**
 * Titolo pubblico del chunk. Preferisce l'ultimo segmento significativo
 * dell'headingPath; per gli articoli usa la forma "Articolo N".
 */
function chunkTitle(candidate) {
  if (typeof candidate.articleNumber === "number") {
    return `Articolo ${candidate.articleNumber}`;
  }
  if (candidate.naturalId) return candidate.naturalId;
  const hp = candidate.headingPath || [];
  return hp.length ? hp[hp.length - 1] : candidate.id;
}

/**
 * Normalizza una dimensione di stato nella forma consumata dalle pagine.
 * Preserva integralmente il letterale della fonte e la provvisorieta' della
 * mappatura: nessuna dimensione viene collassata o riformulata.
 */
function normalizeStatusDimension(dim) {
  if (!dim) return null;
  const out = {
    dimension: dim.dimension,
    value: dim.value ?? null,
    reason: dim.documentedNull ? dim.documentedNull.reason : null,
    literal: dim.documentedNull ? dim.documentedNull.literal ?? null : null,
    explanation: dim.documentedNull ? dim.documentedNull.explanation ?? null : null,
    source: dim.source
      ? {
          kind: dim.source.kind ?? null,
          file: dim.source.file ?? null,
          fileName: dim.source.file ? CANONICAL_FILE_NAMES[dim.source.file] ?? null : null,
          recordId: dim.source.recordId ?? null,
          field: dim.source.field ?? null,
          line: dim.source.line ?? null,
          literal: dim.source.literal ?? null,
        }
      : null,
    inheritedFrom: null,
  };
  if (dim.inheritedFrom) {
    out.inheritedFrom = {
      ref: dim.inheritedFrom.ref ?? null,
      naturalId: dim.inheritedFrom.naturalId ?? null,
      resolutionMethod: dim.inheritedFrom.resolutionMethod ?? null,
      provisional: dim.inheritedFrom.provisional === true,
    };
  }
  return out;
}

/** Vero se una qualunque dimensione del chunk deriva da mappatura provvisoria. */
function hasProvisionalProvenance(status) {
  return Object.values(status).some(
    (d) => d && d.inheritedFrom && d.inheritedFrom.provisional === true
  );
}

function sha256(text) {
  return "sha256:" + createHash("sha256").update(text, "utf-8").digest("hex");
}

// ---------------------------------------------------------------------------

function main() {
  const analysis = analyzeAll();

  // rawByFile per la ricostruzione del testo: rilettura diretta dei canonici.
  const rawByFile = {};
  for (const [key, fileName] of Object.entries(CANONICAL_FILE_NAMES)) {
    rawByFile[key] = readFileSync(path.join(ROOT, "content", "kb", fileName), "utf-8");
  }

  const allCandidates = [];
  for (const key of ["kb01", "kb02", "kb03", "kb04"]) {
    for (const c of analysis.perFile[key].candidates) allCandidates.push(c);
  }

  const chunks = [];
  const integrityFailures = [];

  for (const candidate of allCandidates) {
    const text = reconstructCandidateText(rawByFile, candidate);
    if (text == null) {
      integrityFailures.push({ id: candidate.id, problem: "textNotReconstructable" });
      continue;
    }

    // Verifica di integrita' non negoziabile: il testo servito al pubblico deve
    // corrispondere all'hash calcolato dalla diagnostica sulle stesse righe.
    const recomputed = sha256(text);
    if (candidate.contentHash && recomputed !== candidate.contentHash) {
      integrityFailures.push({
        id: candidate.id,
        problem: "contentHashMismatch",
        expected: candidate.contentHash,
        actual: recomputed,
      });
      continue;
    }

    const status = {
      documentaryStatus: normalizeStatusDimension(candidate.status?.documentaryStatus),
      legalStatus: normalizeStatusDimension(candidate.status?.legalStatus),
      presenceStatus: normalizeStatusDimension(candidate.status?.presenceStatus),
      researchStatus: normalizeStatusDimension(candidate.status?.researchStatus),
    };

    const route = assignRoute(candidate);

    chunks.push({
      id: candidate.id,
      anchor: toAnchor(candidate.id),
      route,
      file: candidate.file,
      sourceFileName: CANONICAL_FILE_NAMES[candidate.file],
      sourceFileLabel: CANONICAL_FILE_LABELS[candidate.file],
      documentScope: candidate.documentScope,
      candidateType: candidate.candidateType,
      title: chunkTitle(candidate),
      headingPath: candidate.headingPath ?? [],
      year: candidate.year ?? null,
      registerId: candidate.registerId ?? null,
      naturalId: candidate.naturalId ?? null,
      articleNumber: typeof candidate.articleNumber === "number" ? candidate.articleNumber : null,
      tag: candidate.tag ?? null,
      citation: {
        file: candidate.file,
        fileName: CANONICAL_FILE_NAMES[candidate.file],
        fileLabel: CANONICAL_FILE_LABELS[candidate.file],
        startLine: candidate.startLine,
        endLine: candidate.endLine,
        contentHash: candidate.contentHash,
        reference: `${CANONICAL_FILE_NAMES[candidate.file]}:${candidate.startLine}-${candidate.endLine}`,
      },
      lineCount: candidate.endLine - candidate.startLine + 1,
      charCount: text.length,
      text,
      status,
      provisionalProvenance: hasProvisionalProvenance(status),
    });
  }

  if (integrityFailures.length > 0) {
    console.error("ERRORE DI INTEGRITA' — indice di produzione NON scritto:");
    for (const f of integrityFailures) console.error("  ", JSON.stringify(f));
    process.exit(1);
  }

  // Ordinamento deterministico e totale: file, poi riga iniziale, poi id.
  const fileOrder = { kb01: 0, kb02: 1, kb03: 2, kb04: 3 };
  chunks.sort((a, b) => {
    if (fileOrder[a.file] !== fileOrder[b.file]) return fileOrder[a.file] - fileOrder[b.file];
    if (a.citation.startLine !== b.citation.startLine) return a.citation.startLine - b.citation.startLine;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const countByFile = {};
  const countByType = {};
  for (const c of chunks) {
    countByFile[c.file] = (countByFile[c.file] || 0) + 1;
    const k = `${c.file}:${c.candidateType}`;
    countByType[k] = (countByType[k] || 0) + 1;
  }

  const corpus = {};
  for (const key of ["kb01", "kb02", "kb03", "kb04"]) {
    corpus[key] = {
      fileName: CANONICAL_FILE_NAMES[key],
      label: CANONICAL_FILE_LABELS[key],
      contentHash: sha256(rawByFile[key]),
      lineCount: rawByFile[key].split("\n").length,
    };
  }

  const index = {
    schemaVersion: 1,
    generator: "scripts/build-content-index.mjs",
    chunkingRules: "Regole approvate e verificate dalla diagnostica congelata v3.1.3 (baseline interna).",
    note:
      "Indice dei chunk di produzione. Nessun embedding, nessun retrieval semantico, nessun layer AI: " +
      "questo file alimenta esclusivamente la generazione statica delle pagine documentali e la ricerca " +
      "locale Pagefind, che indicizza l'HTML generato.",
    corpus,
    chunkCount: chunks.length,
    chunkCountByFile: sortObject(countByFile),
    chunkCountByType: sortObject(countByType),
    provisionalProvenanceCount: chunks.filter((c) => c.provisionalProvenance).length,
    routedChunkCount: chunks.filter((c) => c.route !== null).length,
    chunks,
  };

  const outDir = path.join(ROOT, "data");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "chunks.generated.json"), JSON.stringify(index, null, 2) + "\n", "utf-8");

  console.log(
    `chunks.generated.json scritto: ${chunks.length} chunk di produzione ` +
      `(kb01=${countByFile.kb01 ?? 0} kb02=${countByFile.kb02 ?? 0} ` +
      `kb03=${countByFile.kb03 ?? 0} kb04=${countByFile.kb04 ?? 0}), ` +
      `${index.routedChunkCount} con rotta pubblica, ` +
      `${index.provisionalProvenanceCount} con provenienza provvisoria. Integrita': OK.`
  );
}

function sortObject(o) {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

main();
