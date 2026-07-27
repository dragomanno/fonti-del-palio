/**
 * Accesso all'indice dei chunk di produzione generato da
 * scripts/build-content-index.mjs.
 *
 * L'indice viene letto da disco con `fs` invece che con un import JSON:
 * il file supera i 3 MB e sottoporlo a `tsc --noEmit` come modulo tipizzato
 * renderebbe il type-check inutilmente lento e fragile. Qui la forma del dato
 * e' dichiarata una volta come interfaccia e verificata al caricamento.
 *
 * Nessuna logica AI, nessun ranking semantico: solo lettura, filtri e
 * raggruppamenti deterministici usati dalla generazione statica.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

export type CanonicalFileKey = "kb01" | "kb02" | "kb03" | "kb04";

export type DocumentedNullReason =
  | "notDocumented"
  | "notApplicable"
  | "notYetEvaluated";

export interface StatusSource {
  kind: string | null;
  file: CanonicalFileKey | null;
  fileName: string | null;
  recordId: string | null;
  field: string | null;
  line: number | null;
  literal: string | null;
}

export interface InheritedFrom {
  ref: string | null;
  naturalId: string | null;
  resolutionMethod: string | null;
  provisional: boolean;
}

export interface StatusDimension {
  dimension: string;
  value: string | null;
  reason: DocumentedNullReason | null;
  literal: string | null;
  explanation: string | null;
  source: StatusSource | null;
  inheritedFrom: InheritedFrom | null;
}

export interface ChunkStatus {
  documentaryStatus: StatusDimension | null;
  legalStatus: StatusDimension | null;
  presenceStatus: StatusDimension | null;
  researchStatus: StatusDimension | null;
}

export interface Citation {
  file: CanonicalFileKey;
  fileName: string;
  fileLabel: string;
  startLine: number;
  endLine: number;
  contentHash: string;
  reference: string;
}

export interface Chunk {
  id: string;
  anchor: string;
  route: string | null;
  file: CanonicalFileKey;
  sourceFileName: string;
  sourceFileLabel: string;
  documentScope: string;
  candidateType: string;
  title: string;
  headingPath: string[];
  year: number | null;
  registerId: string | null;
  naturalId: string | null;
  articleNumber: number | null;
  tag: string | null;
  citation: Citation;
  lineCount: number;
  charCount: number;
  text: string;
  status: ChunkStatus;
  provisionalProvenance: boolean;
}

export interface CorpusFileInfo {
  fileName: string;
  label: string;
  contentHash: string;
  lineCount: number;
}

export interface ContentIndex {
  schemaVersion: number;
  generator: string;
  chunkingRules: string;
  note: string;
  corpus: Record<CanonicalFileKey, CorpusFileInfo>;
  chunkCount: number;
  chunkCountByFile: Record<string, number>;
  chunkCountByType: Record<string, number>;
  provisionalProvenanceCount: number;
  routedChunkCount: number;
  chunks: Chunk[];
}

const INDEX_PATH = path.resolve(process.cwd(), "data/chunks.generated.json");

let cached: ContentIndex | null = null;

export function loadIndex(): ContentIndex {
  if (cached) return cached;
  const raw = readFileSync(INDEX_PATH, "utf-8");
  const parsed = JSON.parse(raw) as ContentIndex;
  if (!Array.isArray(parsed.chunks) || parsed.chunks.length === 0) {
    throw new Error(
      "data/chunks.generated.json non contiene chunk. Eseguire `npm run index:build` prima della build."
    );
  }
  cached = parsed;
  return parsed;
}

export function allChunks(): Chunk[] {
  return loadIndex().chunks;
}

export function chunksByRoute(route: string): Chunk[] {
  return allChunks().filter((c) => c.route === route);
}

export function chunksByScope(scope: string): Chunk[] {
  return allChunks().filter((c) => c.documentScope === scope);
}

export function chunkById(id: string): Chunk | undefined {
  return allChunks().find((c) => c.id === id);
}

/** Sezioni pubbliche della disciplina vigente, nell'ordine editoriale approvato. */
export const DISCIPLINA_SECTIONS: Array<{
  scope: string;
  title: string;
  ordinal: number;
  summary: string;
}> = [
  {
    scope: "protocollo-2026",
    title: "Protocollo Equino 2026",
    ordinal: 1,
    summary:
      "Il testo consolidato del Protocollo Equino per l'annualità 2026, articolo per articolo.",
  },
  {
    scope: "ordinanza-5-2026",
    title: "Ordinanza sindacale n. 5/2026",
    ordinal: 2,
    summary:
      "Disposizioni attuative sull'ordine pubblico e sullo svolgimento delle fasi del Palio.",
  },
  {
    scope: "ordinanza-6-2026",
    title: "Ordinanza sindacale n. 6/2026 e Protocollo farmacologico",
    ordinal: 3,
    summary:
      "Disciplina dei trattamenti veterinari e delle sostanze ammesse, con la tabella dei farmaci controllati.",
  },
  {
    scope: "programma-2026",
    title: "Programma 2026",
    ordinal: 4,
    summary: "Il calendario ufficiale delle fasi dell'annualità.",
  },
  {
    scope: "previsite-tratta-2026",
    title: "Previsite, prove regolamentate e Tratta 2026",
    ordinal: 5,
    summary:
      "Le procedure di selezione e verifica sanitaria dei cavalli prima della corsa.",
  },
  {
    scope: "regolamento-palio",
    title: "Regolamento per il Palio",
    ordinal: 6,
    summary: "Il Regolamento generale della corsa, dagli articoli 1 a 105.",
  },
  {
    scope: "coordinamento-regolamento",
    title: "Coordinamento con il Regolamento",
    ordinal: 7,
    summary:
      "I punti in cui Protocollo e Regolamento si intersecano e vanno letti insieme.",
  },
  {
    scope: "stato-completezza",
    title: "Stato di completezza del corpus",
    ordinal: 8,
    summary:
      "Cosa risulta acquisito, cosa identificato ma non ancora reperito, cosa resta da verificare.",
  },
];

/** Atti del corpus storico (KB01), ordinati per annualità. */
export interface ActSummary {
  slug: string;
  registerId: string;
  year: number;
  title: string;
  chunkCount: number;
  articleCount: number;
  provisional: boolean;
}

export function listActs(): ActSummary[] {
  const byScope = new Map<string, Chunk[]>();
  for (const c of allChunks()) {
    if (c.file !== "kb01") continue;
    if (!/^atto-pe-\d{4}-\d{2}$/.test(c.documentScope)) continue;
    const arr = byScope.get(c.documentScope) ?? [];
    arr.push(c);
    byScope.set(c.documentScope, arr);
  }
  const acts: ActSummary[] = [];
  for (const [scope, chunks] of byScope) {
    const slug = scope.replace(/^atto-/, "");
    const first = chunks[0];
    const title = first.headingPath[0] ?? slug.toUpperCase();
    acts.push({
      slug,
      registerId: first.registerId ?? slug.toUpperCase(),
      year: first.year ?? 0,
      title,
      chunkCount: chunks.length,
      articleCount: chunks.filter((c) => c.articleNumber !== null).length,
      provisional: chunks.some((c) => c.provisionalProvenance),
    });
  }
  acts.sort((a, b) => a.year - b.year || a.registerId.localeCompare(b.registerId));
  return acts;
}

/** Annualità coperte dalla memoria incrementale (KB02). */
export function listMemoryYears(): number[] {
  const years = new Set<number>();
  for (const c of allChunks()) {
    if (c.file === "kb02" && typeof c.year === "number") years.add(c.year);
  }
  return [...years].sort((a, b) => a - b);
}

/** Record del registro fonti (KB04). */
export interface RegistryRecord {
  slug: string;
  naturalId: string;
  family: "PE" | "RP" | "ATT" | "LEG";
  year: number | null;
  chunk: Chunk;
}

export function listRegistryRecords(): RegistryRecord[] {
  const out: RegistryRecord[] = [];
  for (const c of allChunks()) {
    if (c.file !== "kb04" || c.documentScope !== "registro-fonti") continue;
    if (!c.naturalId) continue;
    const family = c.naturalId.split("-")[0] as RegistryRecord["family"];
    const ym = /-(\d{4})-/.exec(c.naturalId);
    out.push({
      slug: c.naturalId.toLowerCase(),
      naturalId: c.naturalId,
      family,
      year: ym ? Number(ym[1]) : null,
      chunk: c,
    });
  }
  const familyOrder: Record<string, number> = { PE: 0, RP: 1, ATT: 2, LEG: 3 };
  out.sort(
    (a, b) =>
      (familyOrder[a.family] ?? 9) - (familyOrder[b.family] ?? 9) ||
      (a.year ?? 0) - (b.year ?? 0) ||
      a.naturalId.localeCompare(b.naturalId)
  );
  return out;
}

export const FAMILY_LABELS: Record<string, string> = {
  PE: "Protocolli Equini",
  RP: "Regolamenti del Palio",
  ATT: "Atti attuativi",
  LEG: "Note di ricerca e lacune",
};

/** Etichette leggibili delle quattro dimensioni di stato. */
export const DIMENSION_LABELS: Record<string, string> = {
  documentaryStatus: "Disponibilità documentale",
  legalStatus: "Efficacia / ruolo storico",
  presenceStatus: "Presenza nell'annualità successiva",
  researchStatus: "Stato della ricerca",
};

export const REASON_LABELS: Record<string, string> = {
  notDocumented: "Non documentato dalle fonti",
  notApplicable: "Non applicabile",
  notYetEvaluated: "Non ancora valutato",
};
