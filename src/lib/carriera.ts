/**
 * Fonti del Palio — accesso all'indice della Carriera, v0.2.0.
 *
 * Espone in forma tipizzata `data/carriera.generated.json`, prodotto da
 * `scripts/build-carriera-index.mjs` a partire dalle sole fonti committate.
 * Questo modulo NON legge i documenti sorgente e non deriva contenuto: legge
 * l'indice generato e lo restituisce. Ogni invariante strutturale e' gia'
 * verificata in fase di generazione.
 *
 * Il modulo e' distinto da `corpus.ts`, che governa il corpus del Protocollo
 * Equino: i due indici non si sovrappongono e non condividono identificativi.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export interface Atto {
  id: string;
  slug: string;
  titolo: string;
  data: string;
  pagine: number;
  sha256: string;
  statoPubblico: string;
  ripubblicabile: boolean;
  /** Percorso pubblico del PDF, oppure `null` per gli atti registrati e non ripubblicati. */
  pdf: string | null;
  scheda: string;
}

export interface AttoRichiamato {
  id: string;
  scheda: string;
}

export interface Cavallo {
  numero: number;
  nome: string;
  proprietario: string;
}

export interface Materia {
  numero: number;
  titolo: string;
  slug: string;
  corpo: string;
}

export interface SezioneGuida {
  ordine: number;
  titolo: string;
  slug: string;
  corpo: string;
}

export interface RecordRegistro {
  id: string;
  documento: string;
  estremi: string;
  consistenza: string;
  sha256: string;
  stato: string;
}

export interface Contrada {
  numero: number;
  nome: string;
  slug: string;
  confini: string;
}

export interface Bando {
  meta: Record<string, string>;
  preambolo: Array<{ titolo: string; slug: string; corpo: string }>;
  contrade: Contrada[];
}

export interface CarrieraIndex {
  schema: string;
  carriera: { slug: string; titolo: string; data: string };
  atti: Atto[];
  attiRichiamati: AttoRichiamato[];
  previsite: { comunicato: string; regoleLista: string; cavalli: Cavallo[] };
  materie: Materia[];
  guida: SezioneGuida[];
  registroFonti: RecordRegistro[];
  bando: Bando;
}

let cached: CarrieraIndex | null = null;

export function loadCarriera(): CarrieraIndex {
  if (cached) return cached;
  const file = path.resolve(process.cwd(), "data", "carriera.generated.json");
  const parsed = JSON.parse(readFileSync(file, "utf-8")) as CarrieraIndex;
  if (parsed.schema !== "carriera/1") {
    throw new Error(`Schema dell'indice della Carriera non supportato: ${parsed.schema}`);
  }
  cached = parsed;
  return cached;
}

/** Gli atti nell'ordine del registro. */
export function listAtti(): Atto[] {
  return loadCarriera().atti;
}

/** I soli atti il cui PDF e' pubblicato sul sito. */
export function listAttiPubblicati(): Atto[] {
  return listAtti().filter((a) => a.ripubblicabile);
}

export function attoBySlug(slug: string): Atto | undefined {
  return listAtti().find((a) => a.slug === slug);
}

export function listMaterie(): Materia[] {
  return loadCarriera().materie;
}

export function materiaBySlug(slug: string): Materia | undefined {
  return listMaterie().find((m) => m.slug === slug);
}

export function listGuida(): SezioneGuida[] {
  return loadCarriera().guida;
}

export function listCavalli(): Cavallo[] {
  return loadCarriera().previsite.cavalli;
}

export function listRegistroFonti(): RecordRegistro[] {
  return loadCarriera().registroFonti;
}

export function getBando(): Bando {
  return loadCarriera().bando;
}

export function contradaBySlug(slug: string): Contrada | undefined {
  return getBando().contrade.find((c) => c.slug === slug);
}

/** Digest abbreviato per la resa a schermo: il valore completo resta nel titolo. */
export function shortDigest(sha256: string): string {
  return `${sha256.slice(0, 12)}…${sha256.slice(-8)}`;
}

/**
 * Denominazione ufficiale delle due edizioni del Regolamento.
 *
 * L'edizione vigente e' stata APPROVATA nel 2019 (deliberazioni del Consiglio
 * Comunale n. 99 del 17.6.2019 e n. 224 del 28.11.2019) e PRESENTATA nel 2021.
 * Il 2021 non e' un anno di approvazione e il 2019 non e' l'edizione previgente:
 * queste stringhe esistono perche' la distinzione non venga persa nelle pagine.
 */
export const REGOLAMENTO_VIGENTE_LABEL =
  "Regolamento per il Palio — edizione vigente approvata nel 2019 e presentata nel 2021.";

export const REGOLAMENTO_PREVIGENTE_LABEL =
  "Edizione previgente del Regolamento, approvata nel 1949 e successivamente modificata.";

/** Formula di provenienza del Bando, prudente per decisione documentaria. */
export const BANDO_PROVENIENZA =
  "Trascrizione verificata rispetto alla copia acquisita. La provenienza archivistica della copia resta da verificare.";
