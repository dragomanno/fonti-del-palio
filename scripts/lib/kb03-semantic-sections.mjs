// Estrazione delle sezioni semantiche H1/H2/H3 di KB03 che NON sono
// articoli numerati ("## Articolo N" o "### Art. N") o intestazioni
// CAPITOLO — v3.1 §4 del tool review.
//
// Prima della correzione, tutto questo contenuto veniva inghiottito come
// "blockIntro" generico nel coverage ledger, il che nascondeva contenuto
// sostanziale (Ordinanze 5/6, protocollo farmacologico, programma 2026,
// previsite/Tratta, stato documentale/completezza, note e avvertenze) sotto
// un'unica etichetta indistinta. Questo modulo produce candidati semantici
// espliciti per quel contenuto, ciascuno con range limitato (capped) al
// blocco H1 che lo contiene — che e' anche il fix del difetto §1 (endLine
// che superava il blocco H1 contenitore).
//
// Regola di struttura:
//   - Un H2 che non e' "Articolo N" ne' "CAPITOLO" diventa una sezione.
//   - Se quell'H2 ha H3 figli propri (che non siano "Art. N"), la sezione
//     H2 si ferma alla riga precedente il primo H3 figlio (diventa un
//     "container": titolo + eventuale testo introduttivo diretto), e
//     ciascun H3 figlio diventa una propria sotto-sezione.
//   - Un blocco H1 senza NESSUN H2 proprio (es. "Atti attuativi 2026
//     integrati", "Disposizioni storiche non riprodotte", "Atti necessari
//     per il consolidamento", "Stato del documento", "Stato di
//     completezza") diventa esso stesso un candidato: dal proprio heading
//     alla fine del blocco.
//   - Ogni range e' sempre limitato alla fine del blocco H1 contenente.

import { parseKb03 } from "./parse-kb03.mjs";

const H2_RE = /^##\s+(.+)$/;
const H3_RE = /^###\s+(.+)$/;
const ARTICOLO_H2_RE = /^##\s+Articolo\s+[0-9]+/;
const ART_H3_RE = /^###\s+Art\.\s*[0-9]+\s*$/;
const CAPITOLO_H2_RE = /^##\s+CAPITOLO\s+[IVXLCDM]+\s*$/;

/**
 * @param {string} raw
 */
export function extractKb03SemanticSections(raw) {
  const lines = raw.split("\n");
  const totalLines = lines.length;
  const { h1Blocks } = parseKb03(raw);

  const headings = [];
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const h2 = lines[i].match(H2_RE);
    const h3 = lines[i].match(H3_RE);
    if (h2) {
      headings.push({
        lineNo,
        level: 2,
        title: h2[1].trim(),
        isArticoloH2: ARTICOLO_H2_RE.test(lines[i]),
        isCapitoloH2: CAPITOLO_H2_RE.test(lines[i]),
        isArtH3: false,
      });
    } else if (h3) {
      headings.push({
        lineNo,
        level: 3,
        title: h3[1].trim(),
        isArticoloH2: false,
        isCapitoloH2: false,
        isArtH3: ART_H3_RE.test(lines[i]),
      });
    }
  }

  function findBlock(lineNo) {
    return h1Blocks.find((b) => lineNo >= b.headingLine && lineNo <= b.endLine) || null;
  }

  function rawEndLine(idx) {
    const cur = headings[idx];
    for (let j = idx + 1; j < headings.length; j++) {
      if (headings[j].level <= cur.level) return headings[j].lineNo - 1;
    }
    return totalLines;
  }

  const sections = [];

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    if (h.level !== 2) continue;
    if (h.isArticoloH2 || h.isCapitoloH2) continue;

    const block = findBlock(h.lineNo);
    if (!block) continue;

    const childH3 = [];
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level === 2) break;
      if (headings[j].level === 3 && !headings[j].isArtH3) childH3.push({ heading: headings[j], idx: j });
    }

    const parentRawEnd = rawEndLine(i);
    const parentEnd = Math.min(parentRawEnd, block.endLine);
    const firstChildLine = childH3.length > 0 ? childH3[0].heading.lineNo : null;
    const parentOwnEnd = firstChildLine ? Math.min(firstChildLine - 1, parentEnd) : parentEnd;

    sections.push({
      level: 2,
      title: h.title,
      headingLine: h.lineNo,
      startLine: h.lineNo,
      endLine: Math.max(parentOwnEnd, h.lineNo),
      scope: block.scope,
      blockTitle: block.title,
      parentTitle: null,
      hasChildren: childH3.length > 0,
      isWholeBlock: false,
    });

    for (const { heading: ch, idx: cIdx } of childH3) {
      const childRawEnd = rawEndLine(cIdx);
      const childEnd = Math.min(childRawEnd, block.endLine);
      sections.push({
        level: 3,
        title: ch.title,
        headingLine: ch.lineNo,
        startLine: ch.lineNo,
        endLine: Math.max(childEnd, ch.lineNo),
        scope: block.scope,
        blockTitle: block.title,
        parentTitle: h.title,
        hasChildren: false,
        isWholeBlock: false,
      });
    }
  }

  // Sotto-sezioni H3 figlie di un ARTICOLO H2 (non "### Art. N", che e' un
  // altro tipo di articolo): es. "### Precisazione sui quindici giorni"
  // dentro "## Articolo 6". Prima di questa correzione questi H3 non
  // generavano alcuna sezione (e l'articolo padre, grazie al fix HEADING_ANY_RE
  // nel chiamante, si fermava comunque a questi H3 lasciandoli "unexplained").
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    if (h.level !== 2 || !h.isArticoloH2) continue;
    const block = findBlock(h.lineNo);
    if (!block) continue;
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level === 2) break;
      const child = headings[j];
      if (child.level === 3 && !child.isArtH3) {
        const childRawEnd = rawEndLine(j);
        const childEnd = Math.min(childRawEnd, block.endLine);
        sections.push({
          level: 3,
          title: child.title,
          headingLine: child.lineNo,
          startLine: child.lineNo,
          endLine: Math.max(childEnd, child.lineNo),
          scope: block.scope,
          blockTitle: block.title,
          parentTitle: h.title,
          hasChildren: false,
          isWholeBlock: false,
        });
      }
    }
  }

  const blocksWithH2 = new Set(
    headings
      .filter((h) => h.level === 2)
      .map((h) => findBlock(h.lineNo)?.headingLine)
      .filter(Boolean)
  );
  for (const block of h1Blocks) {
    if (block.scope === "non-chunkable") continue;
    if (blocksWithH2.has(block.headingLine)) continue;
    if (block.endLine <= block.headingLine) continue;
    sections.push({
      level: 1,
      title: block.title,
      headingLine: block.headingLine,
      startLine: block.headingLine,
      endLine: block.endLine,
      scope: block.scope,
      blockTitle: block.title,
      parentTitle: null,
      hasChildren: false,
      isWholeBlock: true,
    });
  }

  return sections.sort((a, b) => a.startLine - b.startLine);
}
