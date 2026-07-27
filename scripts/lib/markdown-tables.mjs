// Rilevamento generale di tabelle Markdown atomiche (spec v3.1 §5).
//
// Individua OGNI tabella Markdown (header + separator + righe dati) in un
// testo grezzo, indipendentemente dal file KB. Ogni tabella rilevata deve
// diventare un candidato atomico unico — mai spezzata riga per riga.
//
// Una tabella e' riconosciuta da:
//   - una riga header che inizia con "|"
//   - seguita immediatamente da una riga separatore "|---|---|" (con
//     eventuali allineamenti :---/---:/:---:)
//   - seguita da zero o piu' righe dati che iniziano con "|"
// Zero righe dati e' comunque una tabella valida (solo header, raro ma
// possibile) — la logica non richiede righe dati per riconoscerla.

const SEPARATOR_RE = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function isTableRow(line) {
  return /^\s*\|/.test(line);
}

function isSeparatorRow(line) {
  return SEPARATOR_RE.test(line.trim()) && line.includes("-");
}

/**
 * Rileva tutte le tabelle Markdown in un testo grezzo.
 * @param {string} raw
 * @returns {Array<{headerLine:number, separatorLine:number, firstDataLine:number|null, lastDataLine:number|null, rowCount:number, headerCells:string[]}>}
 */
export function detectAllMarkdownTables(raw) {
  const lines = raw.split("\n");
  const tables = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isTableRow(line) && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const headerLine = i + 1; // 1-based
      const separatorLine = i + 2;
      let j = i + 2; // indice della prima possibile riga dati (0-based)
      let lastDataIdx = separatorLine - 1; // se non ci sono righe dati, resta sul separatore
      while (j < lines.length && isTableRow(lines[j])) {
        lastDataIdx = j;
        j++;
      }
      const rowCount = lastDataIdx - (separatorLine - 1); // 0 se nessuna riga dati
      const headerCells = line
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      tables.push({
        headerLine,
        separatorLine,
        firstDataLine: rowCount > 0 ? separatorLine + 1 : null,
        lastDataLine: rowCount > 0 ? lastDataIdx + 1 : null,
        rowCount,
        headerCells,
      });
      i = j;
    } else {
      i++;
    }
  }
  return tables;
}

/**
 * Genera uno slug stabile per l'ID di una tabella basato sulla prima cella
 * dell'header (mai dipendente da riga o posizione nell'array).
 */
export function tableSlug(headerCells) {
  const base = (headerCells[0] || "tabella").toLowerCase();
  return base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "tabella";
}

const HEADING_RE_FOR_TABLES = /^(#{1,4})\s+(.+)$/;

function slugify(text) {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "sezione"
  );
}

/**
 * Slug stabile derivato dal TITOLO del heading Markdown (di qualsiasi
 * livello H1-H4) piu' vicino che precede `lineNo` nel testo grezzo. Usato
 * come disambiguatore semantico per gli ID delle tabelle quando piu'
 * tabelle nello stesso scope condividono le stesse celle header (es. le 6
 * tabelle storiche di KB02, che condividono l'header "Periodo | Stato" ma
 * si trovano ciascuna sotto un proprio H3 univoco "## 6.1 Incentivi
 * economici", "## 6.2 ...", ecc.).
 *
 * Non dipende MAI dal numero di riga della tabella stessa: dipende solo dal
 * TESTO del heading piu' vicino che la precede, che e' stabile per
 * costruzione rispetto a qualsiasi inserimento di righe prima o dopo la
 * tabella (finche' non si inserisce un nuovo heading tra il vecchio
 * heading e la tabella -- nel qual caso la tabella "eredita" correttamente
 * il nuovo heading piu' vicino, che e' il comportamento semanticamente
 * corretto, non un difetto di stabilita').
 *
 * @param {string} raw
 * @param {number} lineNo riga 1-based (tipicamente headerLine di una tabella)
 * @returns {string|null} slug del heading piu' vicino, o null se nessun
 *   heading precede `lineNo`.
 */
export function nearestPrecedingHeadingSlug(raw, lineNo) {
  const lines = raw.split("\n");
  for (let i = lineNo - 2; i >= 0; i--) {
    const m = lines[i].match(HEADING_RE_FOR_TABLES);
    if (m) return slugify(m[2].trim());
  }
  return null;
}
