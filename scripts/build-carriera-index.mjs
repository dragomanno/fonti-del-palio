#!/usr/bin/env node
/**
 * Fonti del Palio — generatore dell'indice della Carriera, v0.2.0.
 *
 * Costruisce `data/carriera.generated.json` a partire dalle sole fonti
 * committate in `content/carriere/` e `content/riferimenti/`. Il generatore
 * non riscrive, non riassume e non normalizza il testo documentario: estrae
 * struttura (tabelle, intestazioni, blocchi) e la serializza in forma stabile.
 *
 * Proprieta' richieste:
 *  - DETERMINISTICO: nessun timestamp, nessun percorso assoluto, nessun ordine
 *    dipendente dal filesystem. Due esecuzioni sulla stessa sorgente producono
 *    byte identici.
 *  - NON DISTRUTTIVO: non tocca `data/chunks.generated.json`, che resta
 *    l'indice del Protocollo Equino ed e' generato da `build-content-index.mjs`.
 *  - VERIFICABILE: fallisce con codice 1 se una qualunque delle invarianti
 *    strutturali dichiarate non e' soddisfatta, invece di emettere un indice
 *    parziale.
 *
 * Il documento `LE STRADE DELLE CONTRADE` (`RIF-STRADE-CONTRADE`) resta fuori
 * dal repository e fuori da questo indice: e' fonte di lavoro e di verifica,
 * non fonte ripubblicabile.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CARRIERE = path.join(ROOT, "content", "carriere");
const RIFERIMENTI = path.join(ROOT, "content", "riferimenti");
const PDF_DIR = path.join(ROOT, "public", "atti", "2026");
const TARGET = path.join(ROOT, "data", "carriera.generated.json");

const KB09 = "09_KB_Corpus_Ordinanze_e_Atti_Palio_Agosto_2026.md";
const KB10 = "10_KB_Disciplina_Consolidata_Accesso_Sicurezza_e_Servizi_Agosto_2026.md";
const KB11 = "11_KB_Guida_Pratica_Palio_16_Agosto_2026.md";
const KB12 = "12_KB_Manifest_Generale_Fonti_del_Palio_2026.md";

/** Invarianti strutturali attese: sono il gate del checkpoint, non decorazione. */
export const EXPECTED = {
  atti: 13,
  attiRipubblicabili: 12,
  attiNonRipubblicati: 1,
  attiRichiamati: 2,
  cavalli: 108,
  materie: 11,
  sezioniGuida: 13,
  contrade: 17,
  recordRegistro: 5,
  pagineAttiPubblicati: 35,
};

function read(dir, name) {
  return readFileSync(path.join(dir, name), "utf-8");
}

/** Righe di corpo di una tabella Markdown GFM, gia' divise per cella. */
export function parseTable(block) {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|"));
  const rows = lines
    .filter((l) => !/^\|[\s:|-]+\|$/.test(l))
    .map((l) =>
      l
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim())
    );
  return { header: rows[0] ?? [], body: rows.slice(1) };
}

/** Estrae la porzione di documento fra un'intestazione e la successiva di pari o superiore livello. */
export function section(source, heading) {
  const level = heading.match(/^#+/)[0].length;
  // L'intestazione puo' essere la prima riga del testo (sezione gia' estratta)
  // oppure comparire dopo un a capo. Entrambi i casi sono validi.
  let after;
  if (source.startsWith(`${heading}\n`)) {
    after = heading.length + 1;
  } else {
    const start = source.indexOf(`\n${heading}\n`);
    if (start === -1) throw new Error(`intestazione non trovata: ${heading}`);
    after = start + heading.length + 2;
  }
  const rest = source.slice(after);
  const nextRe = new RegExp(`\\n#{1,${level}} `);
  const nextIdx = rest.search(nextRe);
  return (nextIdx === -1 ? rest : rest.slice(0, nextIdx)).trim();
}

/** Tutti i blocchi introdotti da un'intestazione del livello indicato. */
export function blocks(source, level) {
  const marker = "#".repeat(level);
  const re = new RegExp(`^${marker} (.+)$`, "gm");
  const found = [...source.matchAll(re)];
  return found.map((m, i) => {
    const start = m.index + m[0].length;
    const end = i + 1 < found.length ? found[i + 1].index : source.length;
    return { title: m[1].trim(), body: source.slice(start, end).trim() };
  });
}

/** Rimuove il markup inline che non deve entrare in un valore di metadato. */
export function plain(value) {
  return value.replace(/[`*]/g, "").trim();
}

export function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Slug pubblico stabile di un atto: derivato dall'ID di registro, non dal titolo. */
export function attoSlug(id) {
  const m = id.match(/^ATT-(\d{4})-(DIR|ORD|VIS|SIND)-(\d+)$/);
  if (!m) throw new Error(`ID atto non riconosciuto: ${id}`);
  const tipo = { DIR: "atto-dirigenziale", ORD: "ordinanza", VIS: "visto-contabile", SIND: "ordinanza" }[m[2]];
  return `${tipo}-${Number(m[3])}-${m[1]}`;
}

/** Mappa ID di registro -> file PDF pubblicato, derivata dai file effettivamente presenti. */
export function mapPdfFiles(files) {
  const byNumber = new Map();
  for (const file of files) {
    const m = file.match(/_Copia_(\d+)_2026\.pdf$/);
    if (!m) throw new Error(`nome di file PDF non riconosciuto: ${file}`);
    const key = `${/Ordinanza/i.test(file) ? "ORD" : "DIR"}-${Number(m[1])}`;
    if (byNumber.has(key)) throw new Error(`numero di atto duplicato fra i PDF: ${key}`);
    byNumber.set(key, file);
  }
  return byNumber;
}

function buildAtti(kb09) {
  const registro = parseTable(section(kb09, "## 4. Registro dei tredici PDF acquisiti"));
  const schede = new Map(
    blocks(section(kb09, "## 5. Schede documentarie"), 3).map((b) => [b.title, b.body])
  );

  const pdfFiles = readdirSync(PDF_DIR)
    .filter((f) => f.endsWith(".pdf"))
    .sort();
  const pdfByKey = mapPdfFiles(pdfFiles);

  const atti = registro.body.map((row) => {
    const [idCell, documento, data, pagine, shaCell, stato] = row;
    const id = plain(idCell);
    const m = id.match(/^ATT-2026-(DIR|ORD|VIS)-(\d+)$/);
    const ripubblicabile = stato === "ripubblicabile";
    const key = `${m[1]}-${Number(m[2])}`;
    const pdf = ripubblicabile ? pdfByKey.get(key) : null;
    if (ripubblicabile && !pdf) throw new Error(`PDF mancante per l'atto ripubblicabile ${id}`);
    const scheda = schede.get(id);
    if (!scheda) throw new Error(`scheda documentaria mancante per ${id}`);
    return {
      id,
      slug: attoSlug(id),
      titolo: documento,
      data,
      pagine: Number(pagine),
      sha256: plain(shaCell),
      statoPubblico: stato,
      ripubblicabile,
      pdf: pdf ? `/atti/2026/${pdf}` : null,
      scheda,
    };
  });

  const orfani = [...pdfByKey.values()].filter(
    (f) => !atti.some((a) => a.pdf === `/atti/2026/${f}`)
  );
  if (orfani.length) throw new Error(`PDF non collegati ad alcun atto: ${orfani.join(", ")}`);
  return atti;
}

function buildCavalli(kb09) {
  const { body } = parseTable(section(kb09, "### 6.1 Elenco ufficiale"));
  return body.map((row) => ({
    numero: Number(row[0]),
    nome: row[1],
    proprietario: row[2],
  }));
}

function buildRichiamati(kb09) {
  return blocks(section(kb09, "## 7. Relazioni aperte"), 3).map((b) => ({
    id: b.title,
    scheda: b.body,
  }));
}

function buildMaterie(kb10) {
  return blocks(kb10, 1)
    .filter((b) => /^\d+\./.test(b.title))
    .filter((b) => !/^(1|2)\./.test(b.title))
    .map((b) => {
      const numero = Number(b.title.match(/^(\d+)\./)[1]);
      return {
        numero,
        titolo: b.title.replace(/^\d+\.\s*/, ""),
        slug: slugify(b.title.replace(/^\d+\.\s*/, "")),
        corpo: b.body,
      };
    });
}

function buildGuida(kb11) {
  return blocks(kb11, 2).map((b, i) => ({
    ordine: i + 1,
    titolo: b.title,
    slug: slugify(b.title),
    corpo: b.body,
  }));
}

function buildRegistro(kb12) {
  const { body } = parseTable(section(kb12, "## 8.1 Registro"));
  return body.map((row) => ({
    id: plain(row[0]),
    documento: row[1],
    estremi: row[2],
    consistenza: row[3],
    sha256: plain(row[4]),
    stato: row[5],
  }));
}

function buildBando() {
  const source = readFileSync(path.join(RIFERIMENTI, "bando-violante-1729.md"), "utf-8");
  const fmMatch = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fmMatch) throw new Error("frontmatter assente in bando-violante-1729.md");
  const meta = {};
  for (const line of fmMatch[1].split("\n")) {
    const m = line.match(/^([a-z_]+):\s*"([\s\S]*)"$/);
    if (m) meta[m[1]] = m[2];
  }
  const body = source.slice(fmMatch[0].length);
  const preambolo = blocks(body, 2)
    .filter((b) => b.title !== "Nuova divisione de' confini fra le Contrade")
    .map((b) => ({ titolo: b.title, slug: slugify(b.title), corpo: b.body }));
  const elenco = section(body, "## Nuova divisione de' confini fra le Contrade");
  const contrade = blocks(elenco, 3).map((b) => {
    const m = b.title.match(/^(\d+)\.\s+(.+)$/);
    const slug = b.body.match(/<!-- slug: ([a-z-]+) -->/)?.[1];
    if (!m || !slug) throw new Error(`sezione di Contrada malformata: ${b.title}`);
    return {
      numero: Number(m[1]),
      nome: m[2],
      slug,
      confini: b.body.replace(/<!-- slug: [a-z-]+ -->/, "").trim(),
    };
  });
  return { meta, preambolo, contrade };
}

/** Serializzazione stabile: chiavi nell'ordine di costruzione, indentazione fissa. */
export function serialize(index) {
  return `${JSON.stringify(index, null, 2)}\n`;
}

export function buildIndex() {
  const kb09 = read(CARRIERE, KB09);
  const kb10 = read(CARRIERE, KB10);
  const kb11 = read(CARRIERE, KB11);
  const kb12 = read(CARRIERE, KB12);

  const atti = buildAtti(kb09);
  const cavalli = buildCavalli(kb09);
  const comunicatoPrevisite = section(
    section(kb09, "## 6. Documento operativo successivo: cavalli ammessi alle Previsite"),
    "### COM-2026-08-PREVISITE-001"
  );
  const regoleLista = section(kb09, "### 6.2 Regole di interpretazione della lista");
  const bando = buildBando();

  const index = {
    schema: "carriera/1",
    carriera: {
      slug: "palio-16-agosto-2026",
      titolo: "Palio del 16 agosto 2026",
      data: "2026-08-16",
    },
    atti,
    attiRichiamati: buildRichiamati(kb09),
    previsite: {
      comunicato: comunicatoPrevisite,
      regoleLista,
      cavalli,
    },
    materie: buildMaterie(kb10),
    guida: buildGuida(kb11),
    registroFonti: buildRegistro(kb12),
    bando,
  };

  verify(index);
  return index;
}

/** Gate strutturali. Un'invariante violata blocca la generazione. */
export function verify(index) {
  const problems = [];
  const eq = (label, actual, expected) => {
    if (actual !== expected) problems.push(`${label}: ${actual} invece di ${expected}`);
  };

  eq("atti registrati", index.atti.length, EXPECTED.atti);
  eq("atti ripubblicabili", index.atti.filter((a) => a.ripubblicabile).length, EXPECTED.attiRipubblicabili);
  eq(
    "atti registrati e non ripubblicati",
    index.atti.filter((a) => !a.ripubblicabile).length,
    EXPECTED.attiNonRipubblicati
  );
  eq("atti richiamati", index.attiRichiamati.length, EXPECTED.attiRichiamati);
  eq("cavalli ammessi alle Previsite", index.previsite.cavalli.length, EXPECTED.cavalli);
  eq("materie consolidate", index.materie.length, EXPECTED.materie);
  eq("sezioni della guida", index.guida.length, EXPECTED.sezioniGuida);
  eq("Contrade del Bando", index.bando.contrade.length, EXPECTED.contrade);
  eq("record del registro fonti", index.registroFonti.length, EXPECTED.recordRegistro);
  eq(
    "pagine complessive degli atti pubblicati",
    index.atti.filter((a) => a.ripubblicabile).reduce((n, a) => n + a.pagine, 0),
    EXPECTED.pagineAttiPubblicati
  );

  // Il visto di regolarita' contabile contiene dati personali di fornitori:
  // deve restare registrato e privo di PDF pubblicato.
  const visto = index.atti.find((a) => a.id === "ATT-2026-VIS-1775");
  if (!visto) problems.push("ATT-2026-VIS-1775 assente dal registro");
  else if (visto.pdf !== null) problems.push("ATT-2026-VIS-1775 espone un PDF pubblico");

  // Numerazione dei cavalli continua e senza salti.
  const numeri = index.previsite.cavalli.map((c) => c.numero);
  const attesi = numeri.map((_, i) => i + 1);
  if (JSON.stringify(numeri) !== JSON.stringify(attesi)) {
    problems.push("numerazione dei cavalli non continua da 1");
  }

  // Ordine registrato delle Contrade nel Bando.
  const ordine = index.bando.contrade.map((c) => c.numero);
  if (JSON.stringify(ordine) !== JSON.stringify(ordine.map((_, i) => i + 1))) {
    problems.push("numerazione delle Contrade non continua da 1");
  }

  // Nessun identificativo o slug duplicato.
  for (const [label, values] of [
    ["ID degli atti", index.atti.map((a) => a.id)],
    ["slug degli atti", index.atti.map((a) => a.slug)],
    ["slug delle materie", index.materie.map((m) => m.slug)],
    ["slug delle sezioni della guida", index.guida.map((g) => g.slug)],
    ["slug delle Contrade", index.bando.contrade.map((c) => c.slug)],
  ]) {
    const dupes = values.filter((v, i) => values.indexOf(v) !== i);
    if (dupes.length) problems.push(`${label}: duplicati ${[...new Set(dupes)].join(", ")}`);
  }

  // Ogni SHA-256 registrato deve essere un digest esadecimale completo.
  for (const atto of index.atti) {
    if (!/^[0-9a-f]{64}$/.test(atto.sha256)) problems.push(`SHA-256 malformato per ${atto.id}`);
  }
  for (const record of index.registroFonti) {
    if (!/^[0-9a-f]{64}$/.test(record.sha256)) problems.push(`SHA-256 malformato per ${record.id}`);
  }

  // Il repertorio `RIF-STRADE-CONTRADE` resta fonte di lavoro: puo' comparire
  // come voce del registro delle fonti, mai come contenuto indicizzato.
  const strade = index.registroFonti.filter((r) => r.id === "RIF-STRADE-CONTRADE");
  if (strade.length !== 1) problems.push("RIF-STRADE-CONTRADE non registrato esattamente una volta");
  if (JSON.stringify(index.bando).includes("RIF-STRADE-CONTRADE")) {
    problems.push("RIF-STRADE-CONTRADE presente fra i contenuti ripubblicati");
  }

  if (problems.length) {
    throw new Error(`Gate strutturali della Carriera non superati:\n- ${problems.join("\n- ")}`);
  }
}

function main() {
  const index = buildIndex();
  const dir = path.dirname(TARGET);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(TARGET, serialize(index), "utf-8");
  console.log(
    `carriera.generated.json scritto: ${index.atti.length} atti ` +
      `(${index.atti.filter((a) => a.ripubblicabile).length} ripubblicabili), ` +
      `${index.previsite.cavalli.length} cavalli, ${index.materie.length} materie, ` +
      `${index.guida.length} sezioni di guida, ${index.bando.contrade.length} Contrade, ` +
      `${index.registroFonti.length} record di registro.`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
