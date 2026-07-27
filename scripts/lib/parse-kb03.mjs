// Parser diagnostico per KB 03 — Disciplina vigente consolidata 2026.
//
// KB03 e' un documento a piu' livelli con blocchi H1 ("# ...") che si
// ripetono con la stessa etichetta a nesting diverso (es. "Parte I" appare
// sia come sezione macro del file, sia come sotto-sezione dentro "Parte II
// — Ordinanze e disposizioni attuative 2026"). Il documentScope quindi non
// puo' derivare dalla sola etichetta H1: va assegnato in base al blocco H1
// reale (nell'ordine in cui compare nel file), verificato manualmente sul
// contenuto di ciascun blocco.
//
// Mappa dei blocchi H1 (ordine di apparizione nel file, verificato a mano):
//   1. "# KB 03 — ..."                              -> non-chunkable (intro/istruzioni KB)
//   2. "# Parte I — Protocollo Equino 2026 ..."      -> avvertenza (non-chunkable, testo introduttivo)
//   3. "# Testo consolidato"                          -> protocollo-2026 (contiene Articolo 1..11)
//   4. "# Atti attuativi 2026 integrati"               -> protocollo-2026 (rinvio, testo breve)
//   5. "# Coordinamento con il Regolamento per il Palio" -> coordinamento-regolamento (Art. 37/38 pre-Regolamento)
//   6. "# Disposizioni storiche non riprodotte..."     -> protocollo-2026 (nota storica sul Protocollo)
//   7. "# Atti necessari per il consolidamento..."     -> protocollo-2026 (tabella lacune)
//   8. "# Stato del documento"                          -> stato-completezza
//   9. "# Parte II — Ordinanze e disposizioni attuative 2026" -> non-chunkable (intro macro-sezione)
//  10. "# Parte I — Ordinanza sindacale n. 5/2026"      -> ordinanza-5-2026
//  11. "# Parte II — Ordinanza sindacale n. 6/2026 ..."  -> ordinanza-6-2026
//  12. "# Parte III — Programma 2026"                    -> programma-2026
//  13. "# Parte IV — Previsite, prove regolamentate..."  -> previsite-tratta-2026
//  14. "# Stato di completezza"                          -> stato-completezza
//  15. "# Parte III — Regolamento per il Palio"           -> regolamento-palio (Art. 1..105, CAPITOLO I-VIII)
//
// "note-documentali" e' riservato a paragrafi di avvertenza/nota metodologica
// che non appartengono a nessuno scope operativo sopra (es. "Nota documentale"
// dentro il Regolamento, "Avvertenza sul perimetro").

const H1_RE = /^#\s+(.+)$/;
const H2_RE = /^##\s+(.+)$/;
const H3_RE = /^###\s+(.+)$/;
const H4_RE = /^####\s+(.+)$/;

const ARTICOLO_H2_RE = /^##\s+Articolo\s+([0-9]+)\s*[—–-]?\s*(.*)$/;
const ART_H3_RE = /^###\s+Art\.\s*([0-9]+)\s*$/;
const CAPITOLO_H2_RE = /^##\s+CAPITOLO\s+([IVXLCDM]+)\s*$/;

/**
 * Sequenza dei blocchi H1 con lo scope assegnato, verificata manualmente
 * sul contenuto (vedi commento sopra). L'indice N-esimo di questa lista
 * corrisponde all'N-esima occorrenza di un heading H1 nel file.
 */
export const H1_SCOPE_SEQUENCE = [
  { titleIncludes: "KB 03", scope: "non-chunkable", label: "Intro KB03" },
  { titleIncludes: "Parte I — Protocollo Equino 2026", scope: "non-chunkable", label: "Avvertenza perimetro Protocollo" },
  { titleIncludes: "Testo consolidato", scope: "protocollo-2026", label: "Testo consolidato Protocollo 2026" },
  { titleIncludes: "Atti attuativi 2026 integrati", scope: "protocollo-2026", label: "Atti attuativi 2026 integrati" },
  { titleIncludes: "Coordinamento con il Regolamento per il Palio", scope: "coordinamento-regolamento", label: "Coordinamento Regolamento (Art. 37-38 pre-Regolamento)" },
  { titleIncludes: "Disposizioni storiche non riprodotte", scope: "protocollo-2026", label: "Disposizioni storiche non riprodotte" },
  { titleIncludes: "Atti necessari per il consolidamento", scope: "protocollo-2026", label: "Atti necessari per il consolidamento" },
  { titleIncludes: "Stato del documento", scope: "stato-completezza", label: "Stato del documento (Parte I)" },
  { titleIncludes: "Parte II — Ordinanze e disposizioni attuative 2026", scope: "non-chunkable", label: "Intro macro-sezione ordinanze" },
  { titleIncludes: "Parte I — Ordinanza sindacale n. 5/2026", scope: "ordinanza-5-2026", label: "Ordinanza sindacale n. 5/2026" },
  { titleIncludes: "Parte II — Ordinanza sindacale n. 6/2026", scope: "ordinanza-6-2026", label: "Ordinanza sindacale n. 6/2026 e Protocollo farmacologico" },
  { titleIncludes: "Parte III — Programma 2026", scope: "programma-2026", label: "Programma 2026" },
  { titleIncludes: "Parte IV — Previsite, prove regolamentate", scope: "previsite-tratta-2026", label: "Previsite, prove regolamentate e Tratta 2026" },
  { titleIncludes: "Stato di completezza", scope: "stato-completezza", label: "Stato di completezza (Parte II)" },
  { titleIncludes: "Parte III — Regolamento per il Palio", scope: "regolamento-palio", label: "Regolamento per il Palio" },
];

/**
 * @param {string} raw
 */
export function parseKb03(raw) {
  const lines = raw.split("\n");
  const totalLines = lines.length;

  let frontMatterEndLine = 0;
  if (lines[0] === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === "---") {
        frontMatterEndLine = i + 1;
        break;
      }
    }
  }

  /** @type {Array<{title:string, headingLine:number, endLine:number, scope:string, label:string}>} */
  const h1Blocks = [];
  let h1SeqIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const m = lines[i].match(H1_RE);
    if (m) {
      h1SeqIndex++;
      const spec = H1_SCOPE_SEQUENCE[h1SeqIndex];
      if (!spec) {
        throw new Error(
          `parseKb03: heading H1 #${h1SeqIndex + 1} ("${m[1]}" alla riga ${lineNo}) non ha una voce corrispondente in H1_SCOPE_SEQUENCE. Il documento ha piu' blocchi H1 di quanti mappati: verificare manualmente e aggiungere la voce mancante.`
        );
      }
      if (!m[1].includes(spec.titleIncludes)) {
        throw new Error(
          `parseKb03: mismatch alla posizione H1 #${h1SeqIndex + 1}. Attesto un heading contenente "${spec.titleIncludes}" ma ho trovato "${m[1]}" alla riga ${lineNo}. Il documento e' cambiato rispetto alla mappa verificata: aggiornare H1_SCOPE_SEQUENCE dopo nuova verifica manuale.`
        );
      }
      h1Blocks.push({
        title: m[1].trim(),
        headingLine: lineNo,
        endLine: totalLines,
        scope: spec.scope,
        label: spec.label,
      });
    }
  }

  // Verifica che non ci siano PIU' voci mappate di quante trovate nel file
  // (documento ridotto rispetto alla mappa attesa).
  if (h1Blocks.length < H1_SCOPE_SEQUENCE.length) {
    throw new Error(
      `parseKb03: attesi ${H1_SCOPE_SEQUENCE.length} blocchi H1 mappati, trovati solo ${h1Blocks.length} nel file. Verificare se il documento e' stato modificato.`
    );
  }

  for (let i = 0; i < h1Blocks.length; i++) {
    h1Blocks[i].endLine = h1Blocks[i + 1] ? h1Blocks[i + 1].headingLine - 1 : totalLines;
  }

  // Estrai gli articoli "## Articolo N" dentro ogni blocco H1 (usati nel
  // Testo consolidato del Protocollo 2026 e nel Coordinamento).
  const articoliH2 = [];
  for (const line of lines.map((text, idx) => ({ text, lineNo: idx + 1 }))) {
    const m = line.text.match(ARTICOLO_H2_RE);
    if (m) {
      articoliH2.push({ number: Number(m[1]), line: line.lineNo, titleTail: m[2].trim() });
    }
  }

  // Estrai gli articoli "### Art. N" dentro il Regolamento.
  const artH3 = [];
  const capitoli = [];
  for (const line of lines.map((text, idx) => ({ text, lineNo: idx + 1 }))) {
    const mArt = line.text.match(ART_H3_RE);
    if (mArt) artH3.push({ number: Number(mArt[1]), line: line.lineNo });
    const mCap = line.text.match(CAPITOLO_H2_RE);
    if (mCap) capitoli.push({ roman: mCap[1], line: line.lineNo });
  }

  // Assegna ogni articolo H2/H3 al blocco H1 che lo contiene, per derivarne
  // lo scope e distinguere le due coppie Articolo/Art. 37-38.
  function findContainingBlock(lineNo) {
    return h1Blocks.find((b) => lineNo >= b.headingLine && lineNo <= b.endLine) || null;
  }

  const articoliWithScope = articoliH2.map((a) => {
    const block = findContainingBlock(a.line);
    return { ...a, scope: block ? block.scope : null, blockTitle: block ? block.title : null };
  });
  const artWithScope = artH3.map((a) => {
    const block = findContainingBlock(a.line);
    return { ...a, scope: block ? block.scope : null, blockTitle: block ? block.title : null };
  });

  return {
    totalLines,
    frontMatterEndLine,
    h1Blocks,
    articoliH2: articoliWithScope,
    artH3: artWithScope,
    capitoli,
  };
}

/**
 * Trova la tabella markdown atomica delle medicazioni controllate (KB03
 * §7 "Medicazioni controllate ammesse nell'elenco 2026") e restituisce il
 * suo range di righe esatto (header + separator + righe dati), verificato
 * manualmente: la tabella ha intestazione "| N. | Sostanza | Categoria
 * riportata |" seguita dal separatore "|---:|---|---|" e 30 righe dati.
 */
export function findControlledMedicationsTable(raw) {
  const lines = raw.split("\n");
  const headerIdx = lines.findIndex((l) => l.trim() === "| N. | Sostanza | Categoria riportata |");
  if (headerIdx === -1) {
    throw new Error(
      "findControlledMedicationsTable: intestazione tabella medicazioni controllate non trovata. Verificare se il testo della fonte e' cambiato."
    );
  }
  const sepIdx = headerIdx + 1;
  if (!/^\|-+:?\|/.test(lines[sepIdx].trim())) {
    throw new Error(
      `findControlledMedicationsTable: riga separatore tabella assente/malformata alla riga ${sepIdx + 1}.`
    );
  }
  let lastRowIdx = sepIdx;
  for (let i = sepIdx + 1; i < lines.length; i++) {
    if (/^\|\s*[0-9]+\s*\|/.test(lines[i])) {
      lastRowIdx = i;
    } else {
      break;
    }
  }
  const rowCount = lastRowIdx - sepIdx;
  return {
    headerLine: headerIdx + 1,
    separatorLine: sepIdx + 1,
    firstDataLine: sepIdx + 2,
    lastDataLine: lastRowIdx + 1,
    rowCount,
  };
}
