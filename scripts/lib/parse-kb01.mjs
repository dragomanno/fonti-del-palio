// Parser diagnostico per KB 01 — Corpus storico integrale del Protocollo Equino.
//
// Riconosce, per ciascun atto (### heading), i confini reali degli articoli
// ordinari usando tutte le varianti di formattazione realmente presenti nel
// corpus (verificate manualmente sul testo, non ipotizzate):
//   - "Art. N —"   (em dash, spazio prima)
//   - "Art. N –"   (en dash)
//   - "Art. N-"    (hyphen attaccato, refuso OCR)
//   - "Art, N"     (virgola invece di punto, refuso OCR 2014)
//   - "Articolo N" (forma 2019-2026, con eventuale spazio iniziale da OCR/estrazione)
// Tutte le varianti possono avere spazi iniziali di riga (leading whitespace),
// dovuti a normalizzazione OCR/estrazione PDF imperfetta — questo NON è un
// refuso da correggere nella fonte, va gestito dal parser.
//
// Riconosce inoltre i "punti di modifica" (amendment points) scritti in
// minuscolo con la forma "- art. N:" o "- art. N comma M:", presenti solo
// nell'atto di modifica G.C. 133/2014, che NON sono articoli ordinari e non
// vanno mai fusi con l'atto base che modificano.

const ARTICLE_BOUNDARY_RE = /^\s*(Art[.,]\s*[0-9]+|Articolo\s+[0-9]+)/;
// Cattura la forma e il numero per classificazione diagnostica.
const ARTICLE_BOUNDARY_DETAIL_RE =
  /^\s*(Art[.,]|Articolo)\s*[-–—]?\s*([0-9]+)/;

const AMENDMENT_POINT_RE = /^\s*-\s*art\.\s*([0-9]+)(\s*comma\s*[0-9]+)?\s*:/i;

const YEAR_HEADING_RE = /^##\s+(\d{4})\s*$/;
const ACT_HEADING_RE = /^###\s+(.+)$/;

/**
 * @param {string} raw Testo completo del file KB01
 * @returns {{
 *   years: Array<{year:number, headingLine:number, acts: Array<Act>}>,
 *   frontMatterEndLine: number,
 *   totalLines: number,
 * }}
 */
export function parseKb01(raw) {
  const lines = raw.split("\n");
  const totalLines = lines.length;

  // Front-matter YAML (--- ... ---) a inizio file.
  let frontMatterEndLine = 0;
  if (lines[0] === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === "---") {
        frontMatterEndLine = i + 1; // 1-based
        break;
      }
    }
  }

  /** @type {Array<{year:number, headingLine:number, acts: any[]}>} */
  const years = [];
  let currentYear = null;
  let currentAct = null;

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1; // 1-based
    const line = lines[i];

    const yearMatch = line.match(YEAR_HEADING_RE);
    if (yearMatch) {
      currentYear = { year: Number(yearMatch[1]), headingLine: lineNo, acts: [] };
      years.push(currentYear);
      currentAct = null;
      continue;
    }

    const actMatch = line.match(ACT_HEADING_RE);
    if (actMatch && currentYear) {
      currentAct = {
        title: actMatch[1].trim(),
        headingLine: lineNo,
        endLine: totalLines, // aggiornato quando si trova il prossimo heading
        articles: [],
        amendmentPoints: [],
        metadataLines: [], // righe di metadati (- **Campo:** valore) subito dopo l'heading
        fullTextHeadingLine: null, // riga "#### Testo integrale"
      };
      currentYear.acts.push(currentAct);
      continue;
    }

    if (currentAct && /^####\s+Testo integrale\s*$/.test(line)) {
      currentAct.fullTextHeadingLine = lineNo;
      continue;
    }

    if (currentAct && currentAct.fullTextHeadingLine === null && /^-\s+\*\*/.test(line)) {
      currentAct.metadataLines.push(lineNo);
      continue;
    }

    if (currentAct) {
      const artMatch = line.match(ARTICLE_BOUNDARY_DETAIL_RE);
      if (artMatch && ARTICLE_BOUNDARY_RE.test(line)) {
        currentAct.articles.push({
          number: Number(artMatch[2]),
          line: lineNo,
          rawForm: artMatch[1],
          rawLine: line.trim(),
        });
        continue;
      }

      const amendMatch = line.match(AMENDMENT_POINT_RE);
      if (amendMatch) {
        // La stessa riformulazione compare tipicamente due volte nel testo
        // di una delibera di modifica: una volta nella premessa narrativa
        // ("risultano cosi riformulati") e una volta nella sezione
        // dispositiva formale ("DELIBERA ... come di seguito indicato").
        // Marchiamo la seconda occorrenza come operativa: e' quella che
        // costituisce il candidato di modifica canonico; la prima resta
        // testo di premessa incluso nella copertura ma non genera un
        // secondo candidato duplicato.
        const isOperative = currentAct.amendmentPoints.some(
          (p) => p.targetArticle === Number(amendMatch[1]) && Boolean(p.hasComma) === Boolean(amendMatch[2])
        );
        currentAct.amendmentPoints.push({
          targetArticle: Number(amendMatch[1]),
          hasComma: Boolean(amendMatch[2]),
          line: lineNo,
          rawLine: line.trim(),
          occurrence: isOperative ? "operative" : "context",
        });
        continue;
      }
    }
  }

  // Chiudi endLine di ogni atto = riga prima dell'heading successivo (o EOF).
  const flatActs = [];
  for (const y of years) {
    for (const a of y.acts) flatActs.push(a);
  }
  for (let i = 0; i < flatActs.length; i++) {
    const next = flatActs[i + 1];
    flatActs[i].endLine = next ? next.headingLine - 1 : totalLines;
  }

  return { years, frontMatterEndLine, totalLines };
}

/**
 * Classifica ogni atto come "baseAct" (Protocollo annuale ordinario, con
 * articoli propri) o "amendmentAct" (modifica/correzione che riformula solo
 * alcuni articoli/commi di un atto precedente, senza costituire un nuovo
 * Protocollo completo). Un atto è amendmentAct se contiene amendmentPoints
 * E non ha articoli ordinari propri (Art./Articolo N a inizio riga).
 */
export function classifyActs(years) {
  const classified = [];
  for (const y of years) {
    for (const act of y.acts) {
      const kind =
        act.articles.length === 0 && act.amendmentPoints.length > 0
          ? "amendmentAct"
          : "baseAct";
      classified.push({ year: y.year, ...act, kind });
    }
  }
  return classified;
}
