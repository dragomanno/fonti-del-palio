// Parser diagnostico per KB 04 — Manifest delle fonti e registro degli atti.
//
// Struttura: due "famiglie" di record, ciascuna gia' identificata da un ID
// naturale stabile nell'heading stesso (non serve costruirne uno nuovo):
//   - "### PE-YYYY-NN — YYYY"      (Parte I — Manifest documenti principali)
//   - "### RP-YYYY-NN — <titolo>"  (fonti generali aggiunte, es. Regolamento)
//   - "## ATT-YYYY-TIPO-NNN — <titolo>" (Parte II — Registro ordinanze/atti)
// Ogni record e' un blocco di bullet "- **Campo:** valore" fino al prossimo
// heading di pari o superiore livello.

const H1_RE = /^#\s+(.+)$/;
const H2_RE = /^##\s+(.+)$/;
const H3_RE = /^###\s+(.+)$/;

const PE_RECORD_RE = /^###\s+(PE-\d{4}-\d+)\s*[—–-]\s*(.+)$/;
const RP_RECORD_RE = /^###\s+(RP-\d{4}-\d+)\s*[—–-]\s*(.+)$/;
const ATT_RECORD_RE = /^##\s+(ATT-\d{4}-[A-Z0-9-]+)\s*[—–-]\s*(.+)$/;
// "LEG" = atti di nomina/collaborazione con estremi ancora da verificare
// (Parte II, sezioni annuali senza record ATT-, es. 2020: LEG-2020-COLL-VET).
const LEG_RECORD_RE = /^##\s+(LEG-\d{4}-[A-Z0-9-]+)\s*[—–-]\s*(.+)$/;
const YEAR_H1_RE = /^#\s+(\d{4})\s*$/;

const FIELD_RE = /^-\s+\*\*([^:*]+):\*\*\s*(.*)$/;

export function parseKb04(raw) {
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

  const peRecords = [];
  const rpRecords = [];
  const attRecords = [];
  const legRecords = [];
  let currentYearH1 = null;
  let currentRecord = null;

  function closeCurrent(endLine) {
    if (currentRecord) currentRecord.endLine = endLine;
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i];

    const yearH1 = line.match(YEAR_H1_RE);
    if (yearH1) {
      closeCurrent(lineNo - 1);
      currentRecord = null;
      currentYearH1 = Number(yearH1[1]);
      continue;
    }

    const peMatch = line.match(PE_RECORD_RE);
    if (peMatch) {
      closeCurrent(lineNo - 1);
      currentRecord = { id: peMatch[1], title: peMatch[2].trim(), headingLine: lineNo, endLine: totalLines, fields: {}, fieldLines: {} };
      peRecords.push(currentRecord);
      continue;
    }

    const rpMatch = line.match(RP_RECORD_RE);
    if (rpMatch && !peMatch) {
      closeCurrent(lineNo - 1);
      currentRecord = { id: rpMatch[1], title: rpMatch[2].trim(), headingLine: lineNo, endLine: totalLines, fields: {}, fieldLines: {} };
      rpRecords.push(currentRecord);
      continue;
    }

    const attMatch = line.match(ATT_RECORD_RE);
    if (attMatch) {
      closeCurrent(lineNo - 1);
      currentRecord = {
        id: attMatch[1],
        title: attMatch[2].trim(),
        headingLine: lineNo,
        endLine: totalLines,
        year: currentYearH1,
        fields: {},
        fieldLines: {},
      };
      attRecords.push(currentRecord);
      continue;
    }

    const legMatch = line.match(LEG_RECORD_RE);
    if (legMatch) {
      closeCurrent(lineNo - 1);
      currentRecord = {
        id: legMatch[1],
        title: legMatch[2].trim(),
        headingLine: lineNo,
        endLine: totalLines,
        year: currentYearH1,
        fields: {},
        fieldLines: {},
      };
      legRecords.push(currentRecord);
      continue;
    }

    // Qualsiasi altro H1/H2/H3 che non sia un record chiude il record corrente.
    if ((H1_RE.test(line) || H2_RE.test(line) || H3_RE.test(line)) && currentRecord) {
      closeCurrent(lineNo - 1);
      currentRecord = null;
      continue;
    }

    if (currentRecord) {
      const fieldMatch = line.match(FIELD_RE);
      if (fieldMatch) {
        const fieldName = fieldMatch[1].trim();
        currentRecord.fields[fieldName] = fieldMatch[2].trim();
        // v3.1.2 §1: numero di riga 1-based del campo, necessario per il
        // riferimento macchina-leggibile alla fonte canonica nel contratto
        // di stato documentario. Additivo: non altera fields.
        currentRecord.fieldLines[fieldName] = lineNo;
      }
    }
  }
  closeCurrent(totalLines);

  return { totalLines, frontMatterEndLine, peRecords, rpRecords, attRecords, legRecords };
}
