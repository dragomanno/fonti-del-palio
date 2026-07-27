// Costruttore generale del coverage ledger per-riga — v3.1 §3.
//
// Sostituisce la logica precedente (coverage-kb0N.mjs), che classificava
// le righe con una logica di parsing INDIPENDENTE da quella usata per
// generare i candidati, garantendo unexplainedLines=0 "per costruzione"
// tramite categorie catch-all (proseText/blockIntro) che non provano nulla
// sulla copertura reale del contenuto.
//
// Il nuovo ledger e' costruito DIRETTAMENTE dai candidateIds prodotti dal
// candidate builder: ogni riga non vuota del file sorgente e' marcata con
// gli ID dei candidati che la contengono (0, 1, o multipli — multipli sono
// un difetto, vedi detectGlobalOverlaps), oppure con una classificazione
// esplicita ("structural-heading", "inherited-metadata",
// "explicitly-non-chunkable", "excluded") e un reasonCode motivato, oppure
// resta "unexplained" se nessuna delle precedenti si applica (e DEVE essere
// zero per l'accettazione).
//
// Classificazioni permesse (v3.1 §3):
//   candidate-content        — riga coperta da >=1 candidato
//   inherited-metadata        — riga di metadata ereditata da una riga
//                               madre (es. campi actMetadata) associata
//                               tramite riferimento, non duplicata nel testo
//   structural-heading        — riga di heading Markdown (# ## ### ####)
//                               che NON e' l'inizio di un candidato content
//                               (es. l'heading H1 di un blocco "whole-block"
//                               e' invece part of the candidate stesso)
//   explicitly-non-chunkable  — riga dentro uno scope "non-chunkable"
//                               dichiarato (intro KB, avvertenze editoriali)
//   excluded                  — riga esclusa con motivo specifico (es.
//                               marcatore di pagina PDF, separatore "---")
//   blank                     — riga vuota o solo whitespace
//   unexplained               — nessuna delle precedenti (DEVE essere 0)

/**
 * @param {object} params
 * @param {string[]} params.lines            righe del file (0-based, split("\n"))
 * @param {Array<{id:string,startLine:number,endLine:number}>} params.candidates
 * @param {Array<{startLine:number,endLine:number,reasonCode:string}>} params.structuralHeadings
 * @param {Array<{startLine:number,endLine:number,reasonCode:string}>} params.inheritedMetadata
 * @param {Array<{startLine:number,endLine:number,reasonCode:string}>} params.nonChunkable
 * @param {Array<{startLine:number,endLine:number,reasonCode:string}>} params.excluded
 */
export function buildCoverageLedger({
  lines,
  candidates,
  structuralHeadings = [],
  inheritedMetadata = [],
  nonChunkable = [],
  excluded = [],
}) {
  const totalLines = lines.length;
  /** @type {Array<{line:number, classification:string, candidateIds:string[], reasonCode:string|null}>} */
  const records = [];

  // Indicizza i candidati per riga (multi-mappa: una riga puo' essere
  // coperta da piu' candidati, il che e' esattamente l'anomalia da
  // rilevare come overlap).
  const candidateIdsByLine = new Map();
  for (const c of candidates) {
    if (c.startLine == null || c.endLine == null) continue;
    for (let i = c.startLine; i <= c.endLine; i++) {
      if (!candidateIdsByLine.has(i)) candidateIdsByLine.set(i, []);
      candidateIdsByLine.get(i).push(c.id);
    }
  }

  function rangeReasonAt(ranges, lineNo) {
    for (const r of ranges) {
      if (lineNo >= r.startLine && lineNo <= r.endLine) return r.reasonCode;
    }
    return null;
  }

  for (let i = 1; i <= totalLines; i++) {
    const text = lines[i - 1];
    if (text.trim() === "") {
      records.push({ line: i, classification: "blank", candidateIds: [], reasonCode: null });
      continue;
    }

    const candidateIds = candidateIdsByLine.get(i) || [];
    if (candidateIds.length > 0) {
      records.push({ line: i, classification: "candidate-content", candidateIds, reasonCode: null });
      continue;
    }

    const metaReason = rangeReasonAt(inheritedMetadata, i);
    if (metaReason) {
      records.push({ line: i, classification: "inherited-metadata", candidateIds: [], reasonCode: metaReason });
      continue;
    }

    const structReason = rangeReasonAt(structuralHeadings, i);
    if (structReason) {
      records.push({ line: i, classification: "structural-heading", candidateIds: [], reasonCode: structReason });
      continue;
    }

    const nonChunkReason = rangeReasonAt(nonChunkable, i);
    if (nonChunkReason) {
      records.push({
        line: i,
        classification: "explicitly-non-chunkable",
        candidateIds: [],
        reasonCode: nonChunkReason,
      });
      continue;
    }

    const excludedReason = rangeReasonAt(excluded, i);
    if (excludedReason) {
      records.push({ line: i, classification: "excluded", candidateIds: [], reasonCode: excludedReason });
      continue;
    }

    records.push({ line: i, classification: "unexplained", candidateIds: [], reasonCode: null });
  }

  const counts = {};
  for (const r of records) counts[r.classification] = (counts[r.classification] || 0) + 1;

  const unexplainedLines = records.filter((r) => r.classification === "unexplained").map((r) => r.line);
  const substantiveWithoutCandidateOrReason = records
    .filter((r) => r.classification === "unexplained")
    .map((r) => r.line);

  return {
    totalLines,
    blankLines: counts.blank || 0,
    nonBlankLines: totalLines - (counts.blank || 0),
    counts,
    records,
    unexplainedLines,
    unexplainedLineCount: unexplainedLines.length,
    substantiveLinesWithoutCandidateOrExplicitReason: substantiveWithoutCandidateOrReason.length,
  };
}

/**
 * Rileva overlap GLOBALI (v3.1 §2): una riga coperta da 2+ candidateIds,
 * indipendentemente dal documentScope di ciascun candidato. Questo e' il
 * fix del difetto per cui l'overlap veniva controllato solo entro lo
 * stesso `file + documentScope`, nascondendo overlap cross-scope (es.
 * Art. 38 coordinato che raggiungeva la tabella medicazioni).
 *
 * @param {Array<{id:string,startLine:number,endLine:number,documentScope?:string}>} candidates
 * @param {number} totalLines
 */
export function detectGlobalOverlaps(candidates, totalLines) {
  const idsByLine = new Map();
  for (const c of candidates) {
    if (c.startLine == null || c.endLine == null) continue;
    for (let i = c.startLine; i <= c.endLine; i++) {
      if (!idsByLine.has(i)) idsByLine.set(i, []);
      idsByLine.get(i).push(c.id);
    }
  }
  const duplicatedContentLines = [];
  for (const [line, ids] of idsByLine) {
    if (ids.length > 1) duplicatedContentLines.push({ line, candidateIds: ids });
  }
  duplicatedContentLines.sort((a, b) => a.line - b.line);
  return duplicatedContentLines;
}
