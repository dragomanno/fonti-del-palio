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

export interface RigaSintesiCollazione {
  esito: string;
  articoli: number;
}

export interface RigaProspetto {
  /** Numero d'articolo come stampato nel prospetto: puo' essere "99bis". */
  articolo: string;
  rubrica: string;
  esito: string;
  /** Somiglianza sostanziale come calcolata, non arrotondata. */
  somiglianza: string;
  /** Vero se l'articolo compare fra quelli modificati dalle deliberazioni del 2019. */
  prospetto2019: boolean;
}

export interface Collazione {
  sintesi: RigaSintesiCollazione[];
  totale: number;
  prospetto: RigaProspetto[];
  riscritture: string;
  anomalie: string;
  limiti: string;
}

/**
 * Unità articolo dell'articolato del Regolamento per il Palio, edizione vigente.
 *
 * `numero` è il numero come stampato, in forma compatta ("99bis"); `etichetta`
 * è la forma di lettura ("Art. 99-bis"); `anchor` è l'ancora HTML stabile
 * ("articolo-99-bis"). `corpo` è testo semplice: i capoversi sono separati da
 * una riga vuota, le righe logiche interne a un capoverso da un solo `\n`.
 * Non è Markdown e non va passato a un renderer Markdown.
 *
 * `rubrica` è una stringa vuota per tutti gli articoli: l'edizione vigente
 * numera gli articoli senza titolo. Il campo esiste per non perdere la forma
 * del dato se una futura edizione introducesse le rubriche.
 */
export interface ArticoloRegolamento {
  numero: string;
  etichetta: string;
  anchor: string;
  rubrica: string;
  /** Capitolo di appartenenza, nella forma "I — Disposizioni fondamentali". */
  capitolo: string | null;
  corpo: string;
}

export interface CapitoloRegolamento {
  numero: string;
  titolo: string;
}

export interface FonteRegolamento {
  id: string;
  file: string;
  sezione: string;
  sha256: string;
  pagine: number;
  byte: number;
}

export interface RegolamentoVigente {
  fonte: FonteRegolamento;
  capitoli: CapitoloRegolamento[];
  articoli: ArticoloRegolamento[];
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
  collazione: Collazione;
  regolamento: RegolamentoVigente;
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

export function getCollazione(): Collazione {
  return loadCarriera().collazione;
}

/** L'articolato integrale del Regolamento vigente, nell'ordine della stampa. */
export function getRegolamento(): RegolamentoVigente {
  return loadCarriera().regolamento;
}

/** Le 106 unità articolo del Regolamento vigente, art. 99-bis compreso. */
export function listArticoliRegolamento(): ArticoloRegolamento[] {
  return getRegolamento().articoli;
}

/**
 * Gli articoli raggruppati per capitolo, nell'ordine della stampa.
 * Serve all'indice iniziale: il raggruppamento è di sola resa, non altera
 * l'ordine né la numerazione delle unità.
 */
export function articoliPerCapitolo(): Array<{
  capitolo: string | null;
  articoli: ArticoloRegolamento[];
}> {
  const gruppi: Array<{ capitolo: string | null; articoli: ArticoloRegolamento[] }> = [];
  for (const articolo of listArticoliRegolamento()) {
    const ultimo = gruppi[gruppi.length - 1];
    if (ultimo && ultimo.capitolo === articolo.capitolo) ultimo.articoli.push(articolo);
    else gruppi.push({ capitolo: articolo.capitolo, articoli: [articolo] });
  }
  return gruppi;
}

export function getBando(): Bando {
  return loadCarriera().bando;
}

export function contradaBySlug(slug: string): Contrada | undefined {
  return getBando().contrade.find((c) => c.slug === slug);
}

/**
 * Abbassa di `livelli` le intestazioni Markdown di un blocco documentario.
 *
 * Le materie e le sezioni della guida sono estratte da file in cui erano
 * intestazioni di primo o secondo livello. Reinserite in una pagina che ha gia'
 * il proprio `h1` e i propri `h2`, quelle intestazioni produrrebbero una
 * gerarchia scorretta e un sommario incoerente per le tecnologie assistive.
 * Qui cambia SOLO il livello dell'intestazione: il testo non e' toccato.
 */
export function demoteHeadings(markdown: string, livelli = 1): string {
  return markdown.replace(/^(#{1,5}) (?=\S)/gm, (_match, hashes: string) => {
    const nuovo = Math.min(hashes.length + livelli, 6);
    return `${"#".repeat(nuovo)} `;
  });
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
