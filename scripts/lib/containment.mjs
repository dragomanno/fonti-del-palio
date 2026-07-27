// ---------------------------------------------------------------------------
// Semantica di containment COMPLETA (v3.1.2 §3).
//
// In v3.1.1 checkCandidatesWithinBlocks ignorava silenziosamente qualunque
// candidato per cui non trovasse un blocco contenitore:
//
//     const block = blocks.find(...);
//     if (block && c.endLine > block.endLine) { ... }
//
// Con i blocchi allora passati (soli atti per KB01, sole sezioni annuali per
// KB02, soli record per KB04) 39 candidati su 710 non avevano alcun blocco
// corrispondente e uscivano dal controllo senza essere mai verificati.
//
// Qui il containment e' completo su due fronti:
//  1. la PARTIZIONE dei blocchi contenitore copre l'intero documento, incluse
//     le regioni introduttive/di cornice che prima non erano rappresentate;
//  2. il CONTROLLO segnala come violazione tutti i casi richiesti:
//       - nessun blocco contenitore (il candidato inizia fuori da ogni blocco);
//       - il candidato termina oltre il proprio blocco;
//       - il documentScope dichiarato non corrisponde al blocco contenitore;
//       - il candidato attraversa il confine di un atto, di un'annualita',
//         di uno scope H1 o di un record KB04.
// ---------------------------------------------------------------------------

import { parseKb01, classifyActs } from "./parse-kb01.mjs";
import { parseKb02 } from "./parse-kb02.mjs";
import { parseKb03 } from "./parse-kb03.mjs";
import { parseKb04 } from "./parse-kb04.mjs";
import { mapKb01ActsToKb04 } from "./map-kb01-to-kb04.mjs";

export const CONTAINMENT_VIOLATION_KINDS = Object.freeze([
  "noContainingBlock",
  "endsOutsideBlock",
  "wrongScope",
  "crossesBlockBoundary",
]);

function block(file, blockLabel, id, title, headingLine, endLine, scope) {
  return { file, blockLabel, id, title, headingLine, endLine, scope };
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Scansione delle sezioni H1 di un documento, consapevole dei recinti di
 * codice (``` ) per non scambiare un commento shell per un'intestazione.
 */
export function scanH1Sections(raw, frontMatterEndLine, totalLines) {
  const lines = raw.split("\n");
  const heads = [];
  let inFence = false;
  for (let i = frontMatterEndLine; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const mm = /^# (.+)$/.exec(line);
    if (mm) heads.push({ headingLine: i + 1, title: mm[1].trim() });
  }
  return heads.map((h, idx) => ({
    ...h,
    slug: slugify(h.title),
    endLine: idx + 1 < heads.length ? heads[idx + 1].headingLine - 1 : totalLines,
  }));
}

/**
 * Costruisce, per ciascuno dei 4 file, la partizione COMPLETA dei blocchi
 * contenitore ammessi, ciascuno annotato con lo scope che i candidati al suo
 * interno devono dichiarare. Le regioni introduttive sono derivate dalla
 * struttura reale del documento (fine del front matter -> primo blocco
 * strutturale), non elencate a mano.
 */
export function buildContainingBlocks(rawByFile) {
  const { kb01: raw01, kb02: raw02, kb03: raw03, kb04: raw04 } = rawByFile;
  const out = { kb01: [], kb02: [], kb03: [], kb04: [] };

  // --- KB01: regione introduttiva + un blocco per atto -----------------
  {
    const { years, frontMatterEndLine, totalLines } = parseKb01(raw01);
    const acts = classifyActs(years);
    const { mapping } = mapKb01ActsToKb04(raw01, raw04);
    const registerByActKey = new Map(mapping.map((m) => [`${m.actYear}::${m.actTitle}`, m]));

    const firstActLine = acts.length ? acts[0].headingLine : totalLines + 1;
    if (frontMatterEndLine + 1 <= firstActLine - 1) {
      out.kb01.push(
        block("kb01", "intro", "corpus-storico-intro", "Introduzione del corpus storico", frontMatterEndLine + 1, firstActLine - 1, "corpus-storico-intro")
      );
    }
    for (const act of acts) {
      const reg = registerByActKey.get(`${act.year}::${act.title}`);
      const registerId = reg ? reg.registerId : null;
      out.kb01.push(
        block(
          "kb01",
          "atto",
          registerId || `atto-${act.year}-${act.headingLine}`,
          act.title,
          act.headingLine,
          act.endLine,
          registerId ? `atto-${registerId.toLowerCase()}` : null
        )
      );
    }
  }

  // --- KB02: sezioni H1 non annuali (cornice) + sezioni annuali --------
  {
    const { years, nonYearH1Sections } = parseKb02(raw02);
    for (const s of nonYearH1Sections) {
      out.kb02.push(
        block("kb02", "sezione-cornice", s.slug, s.title, s.headingLine, s.endLine, "memoria-incrementale-cornice")
      );
    }
    for (const y of years) {
      out.kb02.push(
        block("kb02", "sezione-annuale", String(y.year), y.title, y.headingLine, y.endLine, "memoria-incrementale")
      );
    }
  }

  // --- KB03: blocchi H1, che gia' dichiarano il proprio scope ----------
  {
    const { h1Blocks } = parseKb03(raw03);
    for (const b of h1Blocks) {
      out.kb03.push(block("kb03", "blocco-h1", b.slug || b.title, b.title, b.headingLine, b.endLine, b.scope));
    }
  }

  // --- KB04: partizione H1 di cornice + record annidati ----------------
  //
  // KB04 non ha una sola regione introduttiva in testa: le sezioni di
  // cornice ("# Relazioni essenziali", "# Lacune documentali da colmare",
  // "# Parte III — Stato di completezza...") sono intercalate ai registri.
  // La partizione corretta e' quindi l'insieme delle sezioni H1, con i
  // record di registro annidati al loro interno: checkContainment sceglie
  // sempre il blocco piu' interno, quindi un candidato dentro un record
  // risolve al record, mentre un candidato di cornice risolve all'H1.
  {
    const p = parseKb04(raw04);
    const records = [...p.peRecords, ...p.rpRecords, ...p.attRecords, ...p.legRecords].sort(
      (a, b) => a.headingLine - b.headingLine
    );
    for (const h of scanH1Sections(raw04, p.frontMatterEndLine, p.totalLines)) {
      out.kb04.push(
        block("kb04", "sezione-h1", h.slug, h.title, h.headingLine, h.endLine, "manifest-registro-intro")
      );
    }
    for (const r of records) {
      out.kb04.push(block("kb04", "record", r.id, r.title, r.headingLine, r.endLine, "registro-fonti"));
    }
  }

  return out;
}

/**
 * Controllo di containment completo su un insieme di candidati contro la
 * partizione di blocchi del loro file. Ritorna l'elenco delle violazioni
 * (vuoto = nessuna violazione).
 */
export function checkContainment(candidates, blocks, file) {
  const violations = [];
  const sorted = [...blocks].sort((a, b) => a.headingLine - b.headingLine || a.endLine - b.endLine);

  for (const c of candidates) {
    const containing = sorted.filter((b) => c.startLine >= b.headingLine && c.startLine <= b.endLine);

    // 1. Nessun blocco contenitore: e' una VIOLAZIONE, non un caso da ignorare.
    if (containing.length === 0) {
      violations.push({
        kind: "noContainingBlock",
        id: c.id,
        file,
        documentScope: c.documentScope || null,
        startLine: c.startLine,
        endLine: c.endLine,
        blockId: null,
        detail: "il candidato inizia fuori da ogni blocco contenitore ammesso",
      });
      continue;
    }

    // Blocco effettivo = il piu' interno (span minimo) fra quelli che
    // contengono la riga iniziale.
    const b = containing.reduce((best, cur) =>
      cur.endLine - cur.headingLine < best.endLine - best.headingLine ? cur : best
    );

    // 2. Il candidato termina oltre il proprio blocco.
    if (c.endLine > b.endLine) {
      violations.push({
        kind: "endsOutsideBlock",
        id: c.id,
        file,
        documentScope: c.documentScope || null,
        startLine: c.startLine,
        endLine: c.endLine,
        blockId: b.id,
        detail: `il candidato termina alla riga ${c.endLine}, oltre la fine del blocco ${b.id} (${b.endLine})`,
      });
    }

    // 3. Lo scope dichiarato non corrisponde al blocco contenitore.
    if (b.scope !== null && c.documentScope !== b.scope) {
      violations.push({
        kind: "wrongScope",
        id: c.id,
        file,
        documentScope: c.documentScope || null,
        startLine: c.startLine,
        endLine: c.endLine,
        blockId: b.id,
        detail: `documentScope dichiarato "${c.documentScope}" ma il blocco contenitore ${b.id} impone "${b.scope}"`,
      });
    }

    // 4. Attraversamento di un confine: un altro blocco inizia dentro il
    //    range del candidato (atto, annualita', scope H1 o record KB04).
    const crossed = sorted.find(
      (other) => other !== b && other.headingLine > c.startLine && other.headingLine <= c.endLine
    );
    if (crossed) {
      violations.push({
        kind: "crossesBlockBoundary",
        id: c.id,
        file,
        documentScope: c.documentScope || null,
        startLine: c.startLine,
        endLine: c.endLine,
        blockId: b.id,
        detail: `il candidato attraversa il confine del blocco ${crossed.id} (${crossed.blockLabel}) che inizia alla riga ${crossed.headingLine}`,
      });
    }
  }

  return violations;
}
