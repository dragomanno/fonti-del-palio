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
import { createHash } from "node:crypto";
import path from "node:path";
import { buildRegolamento, verificaRegolamento } from "./build-regolamento.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const CARRIERE = path.join(ROOT, "content", "carriere");
const KB_DIR = path.join(ROOT, "content", "kb");
const RIFERIMENTI = path.join(ROOT, "content", "riferimenti");
const PDF_DIR = path.join(ROOT, "public", "atti", "2026");
const MANIFESTI_DIR = path.join(PDF_DIR, "manifesti");
const PROVEREG_DIR = path.join(PDF_DIR, "prove-regolamentate");
const TRATTA_DIR = path.join(PDF_DIR, "tratta");
const ORARI_DIR = path.join(PDF_DIR, "orari");
const TARGET = path.join(ROOT, "data", "carriera.generated.json");

const KB09 = "09_KB_Corpus_Ordinanze_e_Atti_Palio_Agosto_2026.md";
const KB10 = "10_KB_Disciplina_Consolidata_Accesso_Sicurezza_e_Servizi_Agosto_2026.md";
const KB11 = "11_KB_Guida_Pratica_Palio_16_Agosto_2026.md";
const KB12 = "12_KB_Manifest_Generale_Fonti_del_Palio_2026.md";
const KB14 = "14_KB_Collazione_Regolamento_Previgente_Vigente.md";
const KB03 = "03_KB_Disciplina_Vigente_Consolidata_2026.md";

/** Invarianti strutturali attese: sono il gate del checkpoint, non decorazione. */
export const EXPECTED = {
  atti: 13,
  attiRipubblicabili: 12,
  attiNonRipubblicati: 1,
  attiRichiamati: 2,
  cavalli: 108,
  materie: 11,
  sezioniGuida: 14,
  contrade: 17,
  recordRegistro: 5,
  pagineAttiPubblicati: 35,
  unitaArticolo: 106,
  articoliProspetto2019: 24,
  riscritture: 5,
  articoliRegolamento: 106,
  capitoliRegolamento: 8,
  manifesti: 5,
  manifestiRipubblicabili: 5,
  pagineManifesti: 5,
  cavalliProveRegolamentate: 77,
  cavalliTrattaDiretta: 8,
  pagineProveRegolamentate: 2,
  cavalliTratta: 35,
  pagineTratta: 1,
  giorniOrari: 7,
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

/**
 * Slug pubblico stabile di un manifesto: derivato dall'ID di registro.
 *
 * I manifesti non hanno numero di protocollo: l'unico identificativo stabile e'
 * quello assegnato dal registro, e lo slug non deve mai suggerire un numero
 * d'atto che il documento non porta.
 */
export function manifestoSlug(id) {
  const m = id.match(/^MAN-(\d{4})-(\d{2})-(\d{3})$/);
  if (!m) throw new Error(`ID manifesto non riconosciuto: ${id}`);
  return `manifesto-${Number(m[3])}-${m[1]}-${m[2]}`;
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

/**
 * Secondo lotto: i manifesti a stampa acquisiti il 4 agosto 2026.
 *
 * Sono tenuti separati dagli atti perche' non sono atti protocollati: nessuno
 * porta un numero, e il registro non deve dedurne uno. Il nome del file
 * acquisito e' un dato del registro, non una convenzione del generatore: viene
 * letto dalla tabella e confrontato con i file effettivamente presenti, insieme
 * al digest SHA-256, cosi' che un file sostituito faccia fallire la
 * generazione invece di essere pubblicato in silenzio.
 */
function buildManifesti(kb09) {
  const registro = parseTable(
    section(kb09, "## 9. Registro dei manifesti ufficiali acquisiti il 4 agosto 2026")
  );
  const schede = new Map(
    blocks(section(kb09, "## 10. Schede dei manifesti"), 3).map((b) => [b.title, b.body])
  );

  const presenti = new Set(
    existsSync(MANIFESTI_DIR) ? readdirSync(MANIFESTI_DIR).filter((f) => f.endsWith(".pdf")) : []
  );

  const manifesti = registro.body.map((row) => {
    const [idCell, documento, data, pagine, shaCell, stato, fileCell] = row;
    const id = plain(idCell);
    const file = plain(fileCell);
    const ripubblicabile = stato === "ripubblicabile";
    if (ripubblicabile && !presenti.has(file)) {
      throw new Error(`file mancante per il manifesto ripubblicabile ${id}: ${file}`);
    }
    const sha256 = plain(shaCell);
    if (ripubblicabile) {
      const digest = createHash("sha256")
        .update(readFileSync(path.join(MANIFESTI_DIR, file)))
        .digest("hex");
      if (digest !== sha256) {
        throw new Error(
          `digest non corrispondente per ${id}: registrato ${sha256}, calcolato ${digest}`
        );
      }
    }
    const scheda = schede.get(id);
    if (!scheda) throw new Error(`scheda documentaria mancante per ${id}`);
    return {
      id,
      slug: manifestoSlug(id),
      titolo: documento,
      data,
      pagine: Number(pagine),
      sha256,
      statoPubblico: stato,
      ripubblicabile,
      pdf: ripubblicabile ? `/atti/2026/manifesti/${file}` : null,
      scheda,
    };
  });

  const registrati = new Set(manifesti.filter((m) => m.pdf).map((m) => path.basename(m.pdf)));
  const orfani = [...presenti].filter((f) => !registrati.has(f)).sort();
  if (orfani.length) {
    throw new Error(`manifesti non collegati ad alcun record: ${orfani.join(", ")}`);
  }
  return manifesti;
}

/**
 * Terzo lotto: il documento operativo del 10 agosto 2026 con i cavalli ammessi
 * alle prove regolamentate e quelli ammessi direttamente alla Tratta.
 *
 * E' tenuto separato dagli atti e dai manifesti per la stessa ragione per cui
 * lo e' il comunicato delle Previsite: non e' un atto protocollato, non porta
 * numero e non deve entrare nel registro degli atti. Le due liste restano due
 * array distinti perche' l'ammissione alle prove regolamentate e l'ammissione
 * diretta alla Tratta sono fasi diverse: una loro fusione perderebbe la
 * distinzione documentaria. Il digest registrato viene confrontato con il file
 * effettivamente presente, cosi' che una sostituzione faccia fallire la
 * generazione invece di essere pubblicata in silenzio.
 */
function buildProveRegolamentate(kb09) {
  const sezione = section(kb09, "## 11. Registro del documento operativo acquisito il 10 agosto 2026");
  // Il registro e' la sola tabella che precede le sottosezioni: le liste
  // nominative di 11.1 e 11.2 vanno escluse dalla lettura del registro.
  const intro = sezione.split(/\n### /)[0];
  const registro = parseTable(intro);
  if (registro.body.length !== 1) {
    throw new Error(
      `il registro del 10 agosto 2026 deve contenere un solo record, trovati ${registro.body.length}`
    );
  }
  const [idCell, titolo, data, pagine, shaCell, stato, fileCell] = registro.body[0];
  const id = plain(idCell);
  const file = plain(fileCell);
  const sha256 = plain(shaCell);
  const ripubblicabile = stato === "ripubblicabile";

  const presenti = new Set(
    existsSync(PROVEREG_DIR) ? readdirSync(PROVEREG_DIR).filter((f) => f.endsWith(".pdf")) : []
  );
  if (ripubblicabile) {
    if (!presenti.has(file)) throw new Error(`file mancante per ${id}: ${file}`);
    const digest = createHash("sha256")
      .update(readFileSync(path.join(PROVEREG_DIR, file)))
      .digest("hex");
    if (digest !== sha256) {
      throw new Error(
        `digest non corrispondente per ${id}: registrato ${sha256}, calcolato ${digest}`
      );
    }
  }
  const orfani = [...presenti].filter((f) => f !== file).sort();
  if (orfani.length) {
    throw new Error(`file non collegati ad alcun record: ${orfani.join(", ")}`);
  }

  const scheda = section(sezione, `### ${id}`);

  const righe = (heading) =>
    parseTable(section(kb09, heading)).body.map((row) => ({
      numero: Number(row[0]),
      nome: row[1],
      proprietario: row[2],
    }));

  return {
    documento: {
      id,
      titolo,
      data,
      pagine: Number(pagine),
      sha256,
      statoPubblico: stato,
      ripubblicabile,
      pdf: ripubblicabile ? `/atti/2026/prove-regolamentate/${file}` : null,
      scheda,
    },
    proveRegolamentate: righe("### 11.1 Cavalli ammessi alle prove regolamentate dell\u201911 e 12 agosto"),
    trattaDiretta: righe("### 11.2 Cavalli ammessi direttamente alla Tratta del 13 agosto"),
    regoleLista: section(kb09, "### 11.3 Regole di interpretazione delle liste"),
  };
}

/**
 * Lotto successivo: l'elenco finale dei cavalli ammessi alla Tratta del 13
 * agosto 2026, acquisito il 12 agosto 2026 come acquisizione HITL fidata
 * fornita direttamente dal curatore. E' un lotto distinto da
 * `buildProveRegolamentate`: successivo, non sovrapponibile e non fuso con le
 * liste dell'11.1 e dell'11.2. Segue lo stesso schema di verifica del digest
 * sul file effettivamente presente.
 */
function buildTratta(kb09) {
  const sezione = section(
    kb09,
    "## 11bis. Registro del documento operativo acquisito il 12 agosto 2026 (elenco finale ammessi alla Tratta)"
  );
  const intro = sezione.split(/\n### /)[0];
  const registro = parseTable(intro);
  if (registro.body.length !== 1) {
    throw new Error(
      `il registro dell'elenco finale della Tratta deve contenere un solo record, trovati ${registro.body.length}`
    );
  }
  const [idCell, titolo, data, pagine, shaCell, stato, fileCell] = registro.body[0];
  const id = plain(idCell);
  const file = plain(fileCell);
  const sha256 = plain(shaCell);
  const ripubblicabile = stato === "ripubblicabile";

  const presenti = new Set(
    existsSync(TRATTA_DIR) ? readdirSync(TRATTA_DIR).filter((f) => f.endsWith(".pdf")) : []
  );
  if (ripubblicabile) {
    if (!presenti.has(file)) throw new Error(`file mancante per ${id}: ${file}`);
    const digest = createHash("sha256")
      .update(readFileSync(path.join(TRATTA_DIR, file)))
      .digest("hex");
    if (digest !== sha256) {
      throw new Error(
        `digest non corrispondente per ${id}: registrato ${sha256}, calcolato ${digest}`
      );
    }
  }
  const orfani = [...presenti].filter((f) => f !== file).sort();
  if (orfani.length) {
    throw new Error(`file non collegati ad alcun record: ${orfani.join(", ")}`);
  }

  const scheda = section(sezione, `### ${id}`);

  const { body } = parseTable(
    section(kb09, "### 11bis.1 Cavalli ammessi alla Tratta del 13 agosto (elenco finale)")
  );
  const cavalli = body.map((row) => ({
    numero: Number(row[0]),
    nome: row[1],
    proprietario: row[2],
  }));

  return {
    documento: {
      id,
      titolo,
      data,
      pagine: Number(pagine),
      sha256,
      statoPubblico: stato,
      ripubblicabile,
      pdf: ripubblicabile ? `/atti/2026/tratta/${file}` : null,
      scheda,
    },
    cavalli,
    regoleLista: section(kb09, "### 11bis.2 Regole di interpretazione della lista"),
  };
}

/**
 * Quarto lotto: il calendario operativo degli orari della Carriera del 16
 * agosto 2026, acquisito il 10 agosto 2026 come istantanea HTML.
 *
 * Il documento non e' un atto, non e' un manifesto e non e' il documento
 * operativo delle prove regolamentate (sezione 11): resta un quarto blocco
 * distinto. Non esiste un PDF ripubblicabile perche' la fonte e' nativamente
 * HTML: il digest e' calcolato sull'istantanea acquisita e verificato contro
 * il file effettivamente presente, cosi' come per gli altri lotti.
 *
 * Ogni giorno e' pubblicato come una tabella "Orario | Fase" propria
 * (sottosezioni 12.1-12.7): la struttura e' letta dalla tabella, non dedotta
 * dalla prosa introduttiva, cosi' come per le liste nominative della sezione
 * 11. La sottosezione 12.8 ("Limiti interpretativi") non e' un giorno e resta
 * fuori dall'array `giorni`.
 */
function buildOrari(kb09) {
  const sezione = section(
    kb09,
    "## 12. Registro del documento operativo acquisito il 10 agosto 2026 (calendario orari)"
  );
  const intro = sezione.split(/\n### /)[0];
  const registro = parseTable(intro);
  if (registro.body.length !== 1) {
    throw new Error(
      `il registro del calendario orari deve contenere un solo record, trovati ${registro.body.length}`
    );
  }
  const [idCell, titolo, data, pagineCell, shaCell, stato, fileCell] = registro.body[0];
  const id = plain(idCell);
  const file = plain(fileCell);
  const sha256 = plain(shaCell);
  const pagineRaw = plain(pagineCell);
  const pagine = pagineRaw === "\u2014" || pagineRaw === "-" ? null : Number(pagineRaw);

  const presenti = new Set(
    existsSync(ORARI_DIR) ? readdirSync(ORARI_DIR).filter((f) => f.endsWith(".html")) : []
  );
  if (!presenti.has(file)) throw new Error(`file mancante per ${id}: ${file}`);
  const digest = createHash("sha256")
    .update(readFileSync(path.join(ORARI_DIR, file)))
    .digest("hex");
  if (digest !== sha256) {
    throw new Error(
      `digest non corrispondente per ${id}: registrato ${sha256}, calcolato ${digest}`
    );
  }
  const orfani = [...presenti].filter((f) => f !== file).sort();
  if (orfani.length) {
    throw new Error(`file non collegati ad alcun record: ${orfani.join(", ")}`);
  }

  const scheda = section(sezione, `### ${id}`);

  const sottosezioni = blocks(sezione, 3).filter((b) => /^12\.\d+ /.test(b.title));
  const giornoBlocchi = sottosezioni.filter((b) => !/^12\.8 /.test(b.title));
  if (giornoBlocchi.length === 0) {
    throw new Error(`nessuna sottosezione giornaliera trovata per ${id}`);
  }

  const giorni = giornoBlocchi.map((b) => {
    const titoloGiorno = b.title.replace(/^12\.\d+\s+/, "").trim();
    const { body } = parseTable(b.body);
    if (body.length === 0) {
      throw new Error(`tabella vuota nella sottosezione "${b.title}"`);
    }
    const fasi = body.map((row) => {
      const orarioRaw = plain(row[0] ?? "");
      const fase = plain(row[1] ?? "");
      if (!fase) throw new Error(`fase vuota nella sottosezione "${b.title}"`);
      return { orario: orarioRaw, fase };
    });
    const orari = fasi
      .map((f) => f.orario)
      .filter((o) => /^\d{1,2}:\d{2}$/.test(o));
    return { titolo: titoloGiorno, fasi, orari };
  });

  const limiti = sottosezioni.find((b) => /^12\.8 /.test(b.title));

  return {
    documento: {
      id,
      titolo,
      data,
      pagine,
      sha256,
      statoPubblico: stato,
      ripubblicabile: false,
      pdf: null,
      html: `/atti/2026/orari/${file}`,
      scheda,
    },
    giorni,
    limitiInterpretativi: limiti ? limiti.body : "",
  };
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

/**
 * Collazione fra le due edizioni del Regolamento.
 *
 * Il prospetto e' riprodotto per intero perche' e' il dato: una sintesi senza
 * l'articolato non consente di verificare l'attribuzione di una modifica a una
 * delibera. Le percentuali di somiglianza restano come calcolate, non arrotondate.
 */
function buildCollazione(kb14) {
  const sintesi = parseTable(section(kb14, "## 3. Sintesi")).body.map((row) => ({
    esito: plain(row[0]),
    articoli: Number(plain(row[1])),
  }));
  const prospetto = parseTable(section(kb14, "## 8. Prospetto completo articolo per articolo")).body.map(
    (row) => ({
      articolo: row[0],
      rubrica: row[1],
      esito: row[2],
      somiglianza: row[3],
      prospetto2019: row[4] === "sì",
    })
  );
  return {
    sintesi: sintesi.filter((r) => r.esito !== "totale"),
    totale: sintesi.find((r) => r.esito === "totale")?.articoli ?? 0,
    prospetto,
    riscritture: section(kb14, "### 4.1 Le cinque riscritture integrali"),
    anomalie: section(kb14, "## 6. Anomalie da verificare sull'originale"),
    limiti: section(kb14, "## 7. Cosa questa collazione non dimostra"),
  };
}

function buildRegistro(kb12) {
  const { body } = parseTable(section(kb12, "## 8.1 Registro"));
  return body.map((row) => ({
    id: plain(row[0]),
    documento: row[1],
    estremi: row[2],
    consistenza: row[3],
    sha256: plain(row[4]),
    // Nel registro lo stato e' scritto in code span: qui serve come testo, non
    // come marcatura, perche' viene reso in una cella e non in un blocco prose.
    stato: row[5].replace(/`/g, ""),
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
  const kb14 = read(CARRIERE, KB14);
  const kb03 = read(KB_DIR, KB03);

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
    manifesti: buildManifesti(kb09),
    attiRichiamati: buildRichiamati(kb09),
    previsite: {
      comunicato: comunicatoPrevisite,
      regoleLista,
      cavalli,
    },
    proveRegolamentate: buildProveRegolamentate(kb09),
    tratta: buildTratta(kb09),
    orari: buildOrari(kb09),
    materie: buildMaterie(kb10),
    guida: buildGuida(kb11),
    registroFonti: buildRegistro(kb12),
    collazione: buildCollazione(kb14),
    regolamento: buildRegolamento(kb03),
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
  eq("manifesti registrati", index.manifesti.length, EXPECTED.manifesti);
  eq(
    "manifesti ripubblicabili",
    index.manifesti.filter((m) => m.ripubblicabile).length,
    EXPECTED.manifestiRipubblicabili
  );
  eq(
    "pagine complessive dei manifesti pubblicati",
    index.manifesti.filter((m) => m.ripubblicabile).reduce((n, m) => n + m.pagine, 0),
    EXPECTED.pagineManifesti
  );
  eq("cavalli ammessi alle Previsite", index.previsite.cavalli.length, EXPECTED.cavalli);
  eq(
    "cavalli ammessi alle prove regolamentate",
    index.proveRegolamentate.proveRegolamentate.length,
    EXPECTED.cavalliProveRegolamentate
  );
  eq(
    "cavalli ammessi direttamente alla Tratta",
    index.proveRegolamentate.trattaDiretta.length,
    EXPECTED.cavalliTrattaDiretta
  );
  eq(
    "pagine del documento operativo del 10 agosto 2026",
    index.proveRegolamentate.documento.pagine,
    EXPECTED.pagineProveRegolamentate
  );
  eq("cavalli ammessi alla Tratta (elenco finale)", index.tratta.cavalli.length, EXPECTED.cavalliTratta);
  eq(
    "pagine del documento operativo del 12 agosto 2026",
    index.tratta.documento.pagine,
    EXPECTED.pagineTratta
  );
  eq("giorni del calendario orari", index.orari.giorni.length, EXPECTED.giorniOrari);
  eq("materie consolidate", index.materie.length, EXPECTED.materie);
  eq("sezioni della guida", index.guida.length, EXPECTED.sezioniGuida);
  eq("Contrade del Bando", index.bando.contrade.length, EXPECTED.contrade);
  eq("record del registro fonti", index.registroFonti.length, EXPECTED.recordRegistro);
  eq("unità articolo collazionate", index.collazione.prospetto.length, EXPECTED.unitaArticolo);
  eq("totale dichiarato nella sintesi", index.collazione.totale, EXPECTED.unitaArticolo);
  eq(
    "articoli attribuiti al prospetto 2019",
    index.collazione.prospetto.filter((r) => r.prospetto2019).length,
    EXPECTED.articoliProspetto2019
  );
  eq(
    "riscritture integrali",
    index.collazione.sintesi.find((r) => r.esito === "riscritto")?.articoli ?? 0,
    EXPECTED.riscritture
  );
  eq(
    "somma della sintesi",
    index.collazione.sintesi.reduce((n, r) => n + r.articoli, 0),
    EXPECTED.unitaArticolo
  );
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

  // Numerazione continua e senza salti nelle due liste del 10 agosto 2026, e
  // digest esadecimale completo per il documento registrato.
  for (const [label, lista] of [
    ["prove regolamentate", index.proveRegolamentate.proveRegolamentate],
    ["Tratta diretta", index.proveRegolamentate.trattaDiretta],
    ["Tratta (elenco finale)", index.tratta.cavalli],
  ]) {
    const n = lista.map((c) => c.numero);
    if (JSON.stringify(n) !== JSON.stringify(n.map((_, i) => i + 1))) {
      problems.push(`numerazione non continua da 1 nella lista ${label}`);
    }
    const vuoti = lista.filter((c) => !c.nome.trim() || !c.proprietario.trim());
    if (vuoti.length) problems.push(`celle vuote nella lista ${label}`);
  }
  if (!/^[0-9a-f]{64}$/.test(index.proveRegolamentate.documento.sha256)) {
    problems.push(`SHA-256 malformato per ${index.proveRegolamentate.documento.id}`);
  }
  if (!/^[0-9a-f]{64}$/.test(index.tratta.documento.sha256)) {
    problems.push(`SHA-256 malformato per ${index.tratta.documento.id}`);
  }
  if (index.atti.some((a) => a.id === index.tratta.documento.id)) {
    problems.push(`${index.tratta.documento.id} compare fra gli atti`);
  }
  if (index.manifesti.some((m) => m.id === index.tratta.documento.id)) {
    problems.push(`${index.tratta.documento.id} compare fra i manifesti`);
  }
  if (index.tratta.documento.id === index.proveRegolamentate.documento.id) {
    problems.push("il documento dell'elenco finale della Tratta coincide con quello delle prove regolamentate");
  }

  // Il calendario orari e' un quarto lotto: non e' un atto, non e' un
  // manifesto e non coincide col documento delle prove regolamentate.
  if (!/^[0-9a-f]{64}$/.test(index.orari.documento.sha256)) {
    problems.push(`SHA-256 malformato per ${index.orari.documento.id}`);
  }
  if (index.atti.some((a) => a.id === index.orari.documento.id)) {
    problems.push(`${index.orari.documento.id} compare fra gli atti`);
  }
  if (index.manifesti.some((m) => m.id === index.orari.documento.id)) {
    problems.push(`${index.orari.documento.id} compare fra i manifesti`);
  }
  if (index.orari.documento.id === index.proveRegolamentate.documento.id) {
    problems.push("il documento del calendario orari coincide con quello delle prove regolamentate");
  }
  for (const giorno of index.orari.giorni) {
    if (!giorno.titolo.trim()) {
      problems.push("giorno del calendario orari con titolo vuoto");
    }
    if (!Array.isArray(giorno.fasi) || giorno.fasi.length === 0) {
      problems.push(`giorno del calendario orari senza fasi: ${giorno.titolo}`);
    }
    for (const f of giorno.fasi ?? []) {
      if (!f.orario.trim() || !f.fase.trim()) {
        problems.push(`fase con orario o testo vuoto nel giorno: ${giorno.titolo}`);
      }
    }
  }

  // Ordine registrato delle Contrade nel Bando.
  const ordine = index.bando.contrade.map((c) => c.numero);
  if (JSON.stringify(ordine) !== JSON.stringify(ordine.map((_, i) => i + 1))) {
    problems.push("numerazione delle Contrade non continua da 1");
  }

  // Nessun identificativo o slug duplicato.
  for (const [label, values] of [
    ["ID degli atti", index.atti.map((a) => a.id)],
    [
      "slug del registro pubblico",
      [...index.atti, ...index.manifesti].map((a) => a.slug),
    ],
    ["ID dei manifesti", index.manifesti.map((m) => m.id)],
    ["slug delle materie", index.materie.map((m) => m.slug)],
    ["slug delle sezioni della guida", index.guida.map((g) => g.slug)],
    ["slug delle Contrade", index.bando.contrade.map((c) => c.slug)],
  ]) {
    const dupes = values.filter((v, i) => values.indexOf(v) !== i);
    if (dupes.length) problems.push(`${label}: duplicati ${[...new Set(dupes)].join(", ")}`);
  }

  // Ogni SHA-256 registrato deve essere un digest esadecimale completo.
  for (const atto of [...index.atti, ...index.manifesti]) {
    if (!/^[0-9a-f]{64}$/.test(atto.sha256)) problems.push(`SHA-256 malformato per ${atto.id}`);
  }
  for (const record of index.registroFonti) {
    if (!/^[0-9a-f]{64}$/.test(record.sha256)) problems.push(`SHA-256 malformato per ${record.id}`);
  }

  // Articolato integrale del Regolamento per il Palio: gate propri.
  problems.push(...verificaRegolamento(index.regolamento, EXPECTED));

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
      `${index.manifesti.length} manifesti, ` +
      `${index.previsite.cavalli.length} cavalli, ${index.materie.length} materie, ` +
      `${index.guida.length} sezioni di guida, ${index.bando.contrade.length} Contrade, ` +
      `${index.registroFonti.length} record di registro, ` +
      `${index.collazione.prospetto.length} unità articolo collazionate, ` +
      `${index.regolamento.articoli.length} unità articolo del Regolamento ` +
      `in ${index.regolamento.capitoli.length} capitoli, ` +
      `${index.tratta.cavalli.length} cavalli ammessi alla Tratta (elenco finale).`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
