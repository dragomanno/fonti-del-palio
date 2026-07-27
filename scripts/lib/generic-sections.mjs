// Estrattore generico di sezioni H1/H2/H3/H4 "residue" — usato per KB01 e
// KB04 (oltre al modulo dedicato kb03-semantic-sections.mjs per KB03) per
// produrre candidati semantici sul contenuto introduttivo/di cornice che
// altrimenti verrebbe inghiottito da un catch-all (v3.1 §3/§4).
//
// Principio (identico a kb03-semantic-sections.mjs, generalizzato a
// qualsiasi profondita' di heading): OGNI heading non gia' posseduto da un
// confine noto (articolo, record, tabella...) genera un candidato. Se quel
// heading ha figli heading di livello piu' profondo che NON sono a loro
// volta confini noti, il candidato del padre si ferma alla riga precedente
// il primo figlio (diventa un "container": solo titolo + eventuale testo
// introduttivo diretto), e ciascun figlio diventa una propria sezione
// indipendente con lo stesso trattamento recursivo. Questo evita l'overlap
// padre/figlio che si verificava quando il padre includeva ciecamente
// tutto il proprio range fino al prossimo heading di pari livello, senza
// considerare i figli generati separatamente.

const HEADING_RE = /^(#{1,4})\s+(.+)$/;

/**
 * @param {string} raw
 * @param {Set<number>} knownBoundaryLines righe che sono heading di un
 *   candidato GIA' costruito altrove (es. act heading di KB01, record
 *   heading di KB04, year heading) — non generano una sezione residua
 *   propria, e FERMANO il range del genitore se cadono al suo interno.
 * @param {(lineNo:number, title:string, level:number) => boolean} isNonChunkable
 * @returns {Array<{level:number, title:string, headingLine:number, startLine:number, endLine:number, parentTitle:string|null}>}
 */
export function extractResidualSections(raw, knownBoundaryLines, isNonChunkable) {
  const lines = raw.split("\n");
  const totalLines = lines.length;
  const headings = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(HEADING_RE);
    if (m) headings.push({ level: m[1].length, title: m[2].trim(), lineNo: i + 1 });
  }

  function rawEndLine(idx) {
    const cur = headings[idx];
    for (let j = idx + 1; j < headings.length; j++) {
      if (headings[j].level <= cur.level) return headings[j].lineNo - 1;
    }
    return totalLines;
  }

  // Prima riga (esclusa) in cui appare QUALSIASI heading o confine noto
  // successivo a partire da (esclusivo) headingLine, entro rawEnd. Questo
  // "taglia" il proprio candidato non appena inizia un figlio (heading di
  // qualsiasi livello, noto o residuo) o un confine noto interno.
  function ownEndLine(idx, rawEnd) {
    const cur = headings[idx];
    let end = rawEnd;
    // Ferma al primo heading successivo di QUALSIASI livello (diventa figlio).
    for (let j = idx + 1; j < headings.length; j++) {
      if (headings[j].lineNo > rawEnd) break;
      end = Math.min(end, headings[j].lineNo - 1);
      break; // il primo heading successivo (di qualsiasi livello) e' il taglio
    }
    // Ferma anche a un confine noto (es. record/articolo) che cada dentro.
    for (let ln = cur.lineNo + 1; ln <= end; ln++) {
      if (knownBoundaryLines.has(ln)) {
        end = ln - 1;
        break;
      }
    }
    return Math.max(end, cur.lineNo);
  }

  const sections = [];
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    if (knownBoundaryLines.has(h.lineNo)) continue;
    if (isNonChunkable && isNonChunkable(h.lineNo, h.title, h.level)) continue;

    const rawEnd = rawEndLine(i);
    const endLine = ownEndLine(i, rawEnd);

    // Titolo del genitore immediato (per headingPath), se esiste ed e' un
    // heading di livello inferiore che lo precede senza interruzioni di
    // pari/minor livello.
    let parentTitle = null;
    for (let j = i - 1; j >= 0; j--) {
      if (headings[j].level < h.level) {
        parentTitle = headings[j].title;
        break;
      }
      if (headings[j].level <= h.level) break;
    }

    sections.push({
      level: h.level,
      title: h.title,
      headingLine: h.lineNo,
      startLine: h.lineNo,
      endLine,
      parentTitle,
    });
  }
  return sections;
}
