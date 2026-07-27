#!/usr/bin/env node
// Chunking diagnostic v3.1 — Fonti del Palio
//
// Corregge i difetti individuati dal tool review sulla v3 (vedi
// data/chunk-diagnostic-report-v3.1.2.md per il changelog completo):
//   §1 endLine dei candidati KB03 mai oltre il blocco H1 contenitore
//   §2 rilevamento overlap GLOBALE per riga, non solo entro lo stesso scope
//   §3 coverage ledger costruito dai candidateIds reali, non da catch-all
//   §4 candidati semantici per il contenuto KB03 prima inghiottito
//   §5 rilevamento generale di OGNI tabella Markdown atomica (4 file)
//   §6 ID KB02 stabili per contenuto, non per ordinale posizionale
//   §9 mapping KB01->KB04 riportato con i conteggi reali
//
// Esegue i parser reali (scripts/lib/parse-kb0{1,2,3,4}.mjs) contro i 4
// file canonici correnti e produce:
//   - data/chunk-diagnostic-report.json     (machine-readable, riassunto)
//   - data/diagnostic-candidates.json        (inventario candidati completo)
//   - data/coverage-ledger.json              (ledger per-riga machine-readable)
//   - stdout: riepilogo leggibile con PASS/FAIL per ogni gate
//
// Principi non negoziabili (invariati dal v3):
//   - diagnosticCandidateCount, estimatedSplitCount e productionChunkCount
//     restano SEMPRE metriche separate e non intercambiabili. Da M1
//     productionChunkCount e' letto dall'indice reale; prima di M1 era null.
//     (Nota storica) productionChunkCount era null finche' non
//     esiste una vera subdivisione semantica in build-content-index.mjs.
//   - Nessun totale storico viene riportato come riferimento a meno che non
//     sia riprodotto indipendentemente da questo stesso script.
//
// Questo script NON scrive/modifica i file KB canonici. Legge solo.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";

import { parseKb01, classifyActs } from "./lib/parse-kb01.mjs";
import { parseKb02 } from "./lib/parse-kb02.mjs";
import { parseKb03 } from "./lib/parse-kb03.mjs";
import { extractKb03SemanticSections } from "./lib/kb03-semantic-sections.mjs";
import { parseKb04 } from "./lib/parse-kb04.mjs";
import { extractResidualSections } from "./lib/generic-sections.mjs";
import { detectAllMarkdownTables, tableSlug, nearestPrecedingHeadingSlug } from "./lib/markdown-tables.mjs";
import { mapKb01ActsToKb04 } from "./lib/map-kb01-to-kb04.mjs";
import { buildCoverageLedger, detectGlobalOverlaps } from "./lib/coverage-ledger.mjs";
import { buildContainingBlocks, checkContainment, CONTAINMENT_VIOLATION_KINDS } from "./lib/containment.mjs";
import {
  STATUS_DIMENSIONS,
  DOCUMENTED_NULL_REASONS,
  KB04_LEGEND_CROSSWALK,
  extractKb04StatusVocabulary,
  findUnanchoredCrosswalkTerms,
  buildDocumentaryStatus,
  buildScopeLevelStatusEvidence,
} from "./lib/documentary-status.mjs";
import {
  kb01ArticleId,
  kb01AmendmentPointId,
  kb03ArticleId,
  kb04RecordId,
  kb02BulletId,
  tableId,
  semanticSectionId,
} from "./lib/stable-ids.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const KB_DIR = join(ROOT, "content", "kb");

const KB_FILES = {
  kb01: "01_KB_Corpus_Storico_Protocollo_Equino_2012_2026.md",
  kb02: "02_KB_Memoria_Incrementale_Protocollo_Equino_2012_2026.md",
  kb03: "03_KB_Disciplina_Vigente_Consolidata_2026.md",
  kb04: "04_KB_Manifest_Fonti_e_Registro_Atti_2012_2026.md",
};

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

const MAX_TOKENS_PER_CHUNK = 500; // soglia diagnostica, non di produzione

function readKb(key) {
  return readFileSync(join(KB_DIR, KB_FILES[key]), "utf8");
}

function slugifyHeading(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// KB01
// ---------------------------------------------------------------------------

export function buildKb01Candidates(raw01, raw04) {
  const { years, frontMatterEndLine } = parseKb01(raw01);
  const acts = classifyActs(years);
  const { mapping, unmatchedActs, unmatchedRegisterRecords } = mapKb01ActsToKb04(raw01, raw04);
  const registerByActKey = new Map(mapping.map((m) => [`${m.actYear}::${m.actTitle}`, m]));

  const candidates = [];
  const findings = [];
  const knownBoundaryLines = new Set();

  // Tabelle Markdown atomiche di KB01 (v3.1.1 §1: il rilevamento generale
  // era gia' cablato in map/detect ma non era mai stato collegato ai
  // candidati KB01 -- le 2 tabelle di KB01 ("Indice dei documenti" alle
  // righe 53-71 e la tabella del programma di addestramento 2020 alle
  // righe 2969-2978) restavano inghiottite rispettivamente dalla sezione
  // residua "Indice dei documenti" e dall'ultimo articolo dell'atto
  // PE-2020-01. Rilevate QUI, prima di costruire qualsiasi altro
  // candidato, cosi' che knownBoundaryLines registri il loro headerLine e
  // tronchi correttamente sia le sezioni residue (extractResidualSections)
  // sia gli endLine degli articoli/atti che le contenevano.
  const kb01Tables = detectAllMarkdownTables(raw01);
  for (const t of kb01Tables) knownBoundaryLines.add(t.headerLine);

  for (const act of acts) {
    knownBoundaryLines.add(act.headingLine);
    if (act.fullTextHeadingLine) knownBoundaryLines.add(act.fullTextHeadingLine);

    const reg = registerByActKey.get(`${act.year}::${act.title}`);
    if (!reg) {
      findings.push({
        severity: "unresolved",
        area: "kb01-register-mapping",
        detail: `Nessuna corrispondenza di registro KB04 trovata per l'atto "${act.title}" (${act.year}).`,
      });
      continue;
    }
    const registerId = reg.registerId;

    if (act.kind === "baseAct") {
      for (const art of act.articles) {
        knownBoundaryLines.add(art.line);
        candidates.push({
          id: kb01ArticleId(registerId, art.number),
          file: "kb01",
          candidateType: "articoloOrdinario",
          documentScope: `atto-${registerId.toLowerCase()}`,
          headingPath: [act.title, `Articolo ${art.number}`],
          year: act.year,
          registerId,
          articleNumber: art.number,
          startLine: art.line,
        });
      }
    } else {
      for (const point of act.amendmentPoints.filter((p) => p.occurrence === "operative")) {
        knownBoundaryLines.add(point.line);
        candidates.push({
          id: kb01AmendmentPointId(registerId, point.targetArticle, point.hasComma ? "comma" : null),
          file: "kb01",
          candidateType: "puntoDiModifica",
          documentScope: `atto-${registerId.toLowerCase()}`,
          headingPath: [act.title, `Modifica art. ${point.targetArticle}`],
          year: act.year,
          registerId,
          targetArticle: point.targetArticle,
          startLine: point.line,
        });
      }
    }
  }

  const actsByYear = new Map();
  for (const act of acts) actsByYear.set(`${act.year}::${act.title}`, act);

  for (const cand of candidates) {
    const act = [...actsByYear.values()].find(
      (a) => registerByActKey.get(`${a.year}::${a.title}`)?.registerId === cand.registerId
    );
    if (!act) continue;
    const boundaries = [
      ...act.articles.map((a) => a.line),
      ...act.amendmentPoints.filter((p) => p.occurrence === "operative").map((p) => p.line),
    ].sort((a, b) => a - b);
    const idx = boundaries.indexOf(cand.startLine);
    // Capped SEMPRE a act.endLine (mai oltre l'atto contenitore) — v3.1 §1.
    cand.endLine = idx >= 0 && idx < boundaries.length - 1 ? Math.min(boundaries[idx + 1] - 1, act.endLine) : act.endLine;
    // v3.1.1 §1: capped ANCHE alla riga precedente la prima tabella
    // Markdown rilevata dentro il range corrente -- una tabella e' sempre
    // un candidato atomico separato (mai inghiottita da un articolo/punto
    // di modifica che la precede nel testo).
    const tableInsideRange = kb01Tables.find((t) => t.headerLine > cand.startLine && t.headerLine <= cand.endLine);
    if (tableInsideRange) cand.endLine = tableInsideRange.headerLine - 1;
  }

  // Tabelle Markdown atomiche di KB01 (v3.1.1 §1) -- ogni tabella rilevata
  // diventa un candidato indipendente, e il testo che la segue fino al
  // prossimo confine noto (altro articolo, altro atto, altra tabella)
  // diventa un proprio candidato semantico residuo, cosi' che troncare il
  // candidato che precedeva la tabella non lasci righe "unexplained".
  const kb01TableInventory = [];
  for (const t of kb01Tables) {
    const lastLine = t.lastDataLine || t.separatorLine;
    const headingSlug = nearestPrecedingHeadingSlug(raw01, t.headerLine);
    // Scope: se la tabella cade dentro il range di un atto conosciuto (es.
    // l'allegato/programma del fascicolo 2020), lo scope e' quello
    // dell'atto contenitore ("atto-pe-2020-01"), non l'intro generica di
    // KB01 -- coerente con il principio KB03/KB04 per cui una tabella
    // eredita lo scope del blocco documentale che la contiene. Altrimenti
    // (es. l'indice dei documenti, che precede ogni atto) resta nello
    // scope dell'intro.
    const containingAct = acts.find((a) => t.headerLine >= a.headingLine && t.headerLine <= a.endLine);
    const containingReg = containingAct ? registerByActKey.get(`${containingAct.year}::${containingAct.title}`) : null;
    const scope = containingReg ? `atto-${containingReg.registerId.toLowerCase()}` : "corpus-storico-intro";
    const id = tableId(scope, headingSlug || tableSlug(t.headerCells));
    candidates.push({
      id,
      file: "kb01",
      candidateType: "tabellaAtomica",
      documentScope: scope,
      headingPath: containingAct ? [containingAct.title, "Tabella"] : ["Tabella"],
      startLine: t.headerLine,
      endLine: lastLine,
      rowCount: t.rowCount,
    });
    kb01TableInventory.push({
      file: "kb01",
      tableId: id,
      scope,
      startLine: t.headerLine,
      endLine: lastLine,
      rowCount: t.rowCount,
      candidateId: id,
      atomicityResult: "atomic",
    });

    // Contenuto residuo DOPO la tabella, fino al prossimo confine noto
    // (altro articolo, altra tabella, o fine dell'atto/documento) -- senza
    // questo candidato, troncare l'articolo/sezione che precedeva la
    // tabella lascerebbe questo testo (es. l'informativa privacy dopo il
    // programma di addestramento 2020) "unexplained" nel ledger.
    const nextKnownLine = [
      ...kb01Tables.map((o) => o.headerLine),
      ...(containingAct ? containingAct.articles.map((a) => a.line) : []),
      ...acts.map((a) => a.headingLine),
    ]
      .filter((ln) => ln > lastLine)
      .sort((a, b) => a - b)[0];
    const gapEnd = (nextKnownLine ? nextKnownLine - 1 : containingAct ? containingAct.endLine : null);
    const gapStart = lastLine + 1;
    if (gapEnd != null && gapEnd >= gapStart && raw01.split("\n").slice(gapStart - 1, gapEnd).some((l) => l.trim().length > 0)) {
      const gapHeadingPath = containingAct ? [containingAct.title, "Testo successivo alla tabella"] : ["Testo successivo alla tabella"];
      candidates.push({
        id: semanticSectionId(scope, [headingSlug || tableSlug(t.headerCells), "seguito"]),
        file: "kb01",
        candidateType: "sezioneSemantica",
        documentScope: scope,
        headingPath: gapHeadingPath,
        startLine: gapStart,
        endLine: gapEnd,
      });
    }
  }

  // Preambolo/intestazione di ogni atto (es. "Comune di Siena / Verbale di
  // deliberazione ... OGGETTO: ..." prima del primo Art./Articolo, o testo
  // introduttivo del "Testo integrale" prima del primo confine) — prima di
  // questa correzione questo contenuto restava del tutto "unexplained" nel
  // ledger perche' non generava alcun candidato. Range: dalla riga
  // successiva all'ultimo confine noto (fullTextHeadingLine, o l'ultima
  // riga di metadataLines, o headingLine) fino alla riga precedente il
  // primo confine articolo/punto-di-modifica dell'atto.
  for (const act of acts) {
    const reg = registerByActKey.get(`${act.year}::${act.title}`);
    if (!reg) continue;
    const registerId = reg.registerId;
    const boundaries = [
      ...act.articles.map((a) => a.line),
      ...act.amendmentPoints.filter((p) => p.occurrence === "operative").map((p) => p.line),
    ].sort((a, b) => a - b);
    const lastMetadataLine = act.metadataLines.length > 0 ? Math.max(...act.metadataLines) : null;
    const introStart = (act.fullTextHeadingLine || lastMetadataLine || act.headingLine) + 1;
    const introEnd = boundaries.length > 0 ? boundaries[0] - 1 : act.endLine;
    if (introEnd >= introStart) {
      candidates.push({
        id: semanticSectionId(`atto-${registerId.toLowerCase()}`, ["preambolo"]),
        file: "kb01",
        candidateType: "sezioneSemantica",
        documentScope: `atto-${registerId.toLowerCase()}`,
        headingPath: [act.title, "Preambolo / intestazione atto"],
        year: act.year,
        registerId,
        startLine: introStart,
        endLine: introEnd,
      });
    }
  }

  // Sezioni residue: intro KB, principio di prevalenza, nota metodologica,
  // indice documenti (tabella, gestita a parte dal rilevatore tabelle),
  // year headings. Le sezioni "non-chunkable" (intro editoriale) sono
  // marcate come tali e non generano candidati content, ma restano
  // classificate esplicitamente (non "unexplained").
  const nonChunkableTitlePrefixes = ["KB 01", "Istruzioni", "Principio di prevalenza"];
  const isNonChunkableTitle = (title) => nonChunkableTitlePrefixes.some((t) => title.startsWith(t));
  const residualSections = extractResidualSections(
    raw01,
    knownBoundaryLines,
    (lineNo, title) => isNonChunkableTitle(title)
  ).filter((s) => !/^\d{4}$/.test(s.title)); // esclude i year heading "## 2012" ecc.

  // Range espliciti non-chunkable (intro editoriale KB01, istruzioni d'uso,
  // principio di prevalenza): calcolati con la stessa logica di
  // extractResidualSections ma SENZA il filtro isNonChunkable, cosi' da
  // ottenere anche il loro range esatto per il ledger (altrimenti restano
  // "unexplained" perche' non generano candidati content).
  const allTopSections = extractResidualSections(raw01, knownBoundaryLines, () => false).filter(
    (s) => !/^\d{4}$/.test(s.title)
  );
  const nonChunkableRanges = allTopSections
    .filter((s) => isNonChunkableTitle(s.title))
    .map((s) => ({ startLine: s.startLine, endLine: s.endLine, reasonCode: "editorial-intro-declared-non-chunkable" }));

  const semanticCandidates = [];
  for (const sec of residualSections) {
    // "Nota metodologica" e "Indice dei documenti" hanno contenuto
    // sostanziale (la tabella indice e' gestita a parte come tabella
    // atomica: qui generiamo comunque un candidato per l'intro testuale
    // residua, se ne resta).
    const scope = "corpus-storico-intro";
    const headingPath = sec.parentTitle ? [sec.parentTitle, sec.title] : [sec.title];
    semanticCandidates.push({
      id: semanticSectionId(scope, headingPath.map(slugifyHeading)),
      file: "kb01",
      candidateType: "sezioneSemantica",
      documentScope: scope,
      headingPath,
      startLine: sec.startLine,
      endLine: sec.endLine,
    });
  }
  return {
    candidates: [...candidates, ...semanticCandidates],
    tableInventory: kb01TableInventory,
    findings,
    unmatchedActs,
    unmatchedRegisterRecords,
    mapping,
    frontMatterEndLine,
    knownBoundaryLines,
    nonChunkableRanges,
  };
}

// ---------------------------------------------------------------------------
// KB03
// ---------------------------------------------------------------------------

export function buildKb03Candidates(raw03) {
  const { articoliH2, artH3, h1Blocks } = parseKb03(raw03);
  const candidates = [];
  const knownBoundaryLines = new Set();

  for (const art of articoliH2) {
    knownBoundaryLines.add(art.line);
    candidates.push({
      id: kb03ArticleId(art.scope, art.number),
      file: "kb03",
      candidateType: "articoloOrdinario",
      documentScope: art.scope,
      headingPath: [art.blockTitle, `Articolo ${art.number}`],
      articleNumber: art.number,
      startLine: art.line,
    });
  }
  for (const art of artH3) {
    knownBoundaryLines.add(art.line);
    candidates.push({
      id: kb03ArticleId(art.scope, art.number),
      file: "kb03",
      candidateType: "articoloOrdinario",
      documentScope: art.scope,
      headingPath: [art.blockTitle, `Art. ${art.number}`],
      articleNumber: art.number,
      startLine: art.line,
    });
  }

  // endLine: fino al prossimo confine DELLO STESSO blocco H1 — sia un altro
  // articolo SIA un qualsiasi altro heading H2/H3 (es. "## Criterio di
  // coordinamento" dopo l'ultimo articolo di un blocco) — capped SEMPRE
  // alla fine del blocco H1 contenitore. v3.1 §1: il difetto originale
  // usava SOLO i confini-articolo come limite, quindi un articolo che era
  // l'ultimo del proprio blocco si estendeva fino a includere heading
  // semantici successivi non-articolo dello stesso blocco (es. Art. 38
  // coordinato inglobava "Criterio di coordinamento").
  const HEADING_ANY_RE = /^#{1,4}\s+.+$/;
  const rawLines03 = raw03.split("\n");
  const allArticles = [...articoliH2, ...artH3];
  for (const cand of candidates) {
    const block = h1Blocks.find((b) => cand.startLine >= b.headingLine && cand.startLine <= b.endLine);
    const articleBoundariesInBlock = allArticles
      .filter((a) => a.line >= block.headingLine && a.line <= block.endLine)
      .map((a) => a.line);
    const anyHeadingBoundariesInBlock = [];
    for (let ln = block.headingLine + 1; ln <= block.endLine; ln++) {
      if (HEADING_ANY_RE.test(rawLines03[ln - 1])) anyHeadingBoundariesInBlock.push(ln);
    }
    const sameBlockBoundaries = [...new Set([...articleBoundariesInBlock, ...anyHeadingBoundariesInBlock])].sort(
      (a, b) => a - b
    );
    const idx = sameBlockBoundaries.indexOf(cand.startLine);
    const nextInBlock = idx >= 0 && idx < sameBlockBoundaries.length - 1 ? sameBlockBoundaries[idx + 1] - 1 : block.endLine;
    cand.endLine = Math.min(nextInBlock, block.endLine);
  }

  // Tabelle Markdown atomiche: rilevamento generale (v3.1 §5), non solo
  // quella delle medicazioni controllate.
  const tables = detectAllMarkdownTables(raw03);
  const tableInventory = [];
  for (const t of tables) {
    const block = h1Blocks.find((b) => t.headerLine >= b.headingLine && t.headerLine <= b.endLine);
    const scope = block ? block.scope : "unscoped";
    const lastLine = t.lastDataLine || t.separatorLine;
    knownBoundaryLines.add(t.headerLine);
    const id = tableId(scope, tableSlug(t.headerCells));
    candidates.push({
      id,
      file: "kb03",
      candidateType: "tabellaAtomica",
      documentScope: scope,
      headingPath: block ? [block.title, "Tabella"] : ["Tabella"],
      startLine: t.headerLine,
      endLine: lastLine,
      rowCount: t.rowCount,
    });
    tableInventory.push({
      file: "kb03",
      tableId: id,
      scope,
      startLine: t.headerLine,
      endLine: lastLine,
      rowCount: t.rowCount,
      candidateId: id,
      atomicityResult: "atomic",
    });
  }

  // Candidati semantici per il contenuto prima inghiottito come blockIntro
  // generico (v3.1 §4): Ordinanze 5/6, protocollo farmacologico, programma,
  // previsite/Tratta, stato documentale/completezza, note, avvertenze.
  // Le sezioni la cui riga di heading coincide con una tabella o un
  // articolo gia' noto vengono scartate per evitare doppioni; le sezioni
  // che CONTENGONO una tabella (es. "7. Medicazioni controllate ammesse
  // nell'elenco 2026") vengono troncate per fermarsi prima della tabella
  // (che e' un candidato atomico separato) — evita overlap.
  const semanticSections = extractKb03SemanticSections(raw03);
  for (const sec of semanticSections) {
    if (knownBoundaryLines.has(sec.headingLine)) continue;
    // Tronca se una tabella nota cade dentro il range della sezione.
    let endLine = sec.endLine;
    for (const t of tables) {
      if (t.headerLine > sec.startLine && t.headerLine <= endLine) {
        endLine = t.headerLine - 1;
      }
    }
    if (endLine < sec.startLine) continue; // sezione vuota dopo il troncamento
    const headingPath = sec.parentTitle
      ? [sec.blockTitle, sec.parentTitle, sec.title]
      : [sec.blockTitle, sec.title];
    candidates.push({
      id: semanticSectionId(sec.scope, headingPath.map(slugifyHeading)),
      file: "kb03",
      candidateType: "sezioneSemantica",
      documentScope: sec.scope,
      headingPath,
      startLine: sec.startLine,
      endLine,
    });
  }

  return { candidates, tableInventory, knownBoundaryLines };
}

// ---------------------------------------------------------------------------
// KB04
// ---------------------------------------------------------------------------

export function buildKb04Candidates(raw04) {
  const { peRecords, rpRecords, attRecords, legRecords } = parseKb04(raw04);
  const candidates = [];
  const knownBoundaryLines = new Set();

  for (const rec of [...peRecords, ...rpRecords, ...attRecords, ...legRecords]) {
    knownBoundaryLines.add(rec.headingLine);
    candidates.push({
      id: kb04RecordId(rec.id),
      file: "kb04",
      candidateType: "recordRegistro",
      documentScope: "registro-fonti",
      headingPath: [rec.id, rec.title],
      naturalId: rec.id,
      startLine: rec.headingLine,
      endLine: rec.endLine,
    });
  }

  // Tabelle Markdown atomiche (KB04 non ne ha di rilevate al momento della
  // verifica, ma il rilevamento resta generale per non perdere eventuali
  // tabelle future).
  const tables = detectAllMarkdownTables(raw04);
  const tableInventory = [];
  for (const t of tables) {
    const lastLine = t.lastDataLine || t.separatorLine;
    knownBoundaryLines.add(t.headerLine);
    const id = tableId("registro-fonti", tableSlug(t.headerCells));
    candidates.push({
      id,
      file: "kb04",
      candidateType: "tabellaAtomica",
      documentScope: "registro-fonti",
      headingPath: ["Tabella"],
      startLine: t.headerLine,
      endLine: lastLine,
      rowCount: t.rowCount,
    });
    tableInventory.push({
      file: "kb04",
      tableId: id,
      scope: "registro-fonti",
      startLine: t.headerLine,
      endLine: lastLine,
      rowCount: t.rowCount,
      candidateId: id,
      atomicityResult: "atomic",
    });
  }

  // Sezioni semantiche residue: Funzione, Regola fondamentale, Stati
  // documentali, Relazioni essenziali, Lacune documentali da colmare,
  // Fonti generali aggiunte (intro), Registro ordinanze (intro), Registri
  // aggiunti v1.3, Stati di consultazione, e i blocchi introduttivi dei
  // fascicoli annuali in "Parte II" (v3.1 §4, applicato anche a KB04 per
  // coerenza con lo stesso principio di non-inghiottimento).
  const nonChunkableTitles = ["KB 04"];
  const residualSections = extractResidualSections(
    raw04,
    knownBoundaryLines,
    (lineNo, title) => nonChunkableTitles.some((t) => title.startsWith(t))
  ).filter((s) => !/^\d{4}$/.test(s.title)); // esclude i year heading "# 2026" ecc.

  for (const sec of residualSections) {
    const scope = "manifest-registro-intro";
    const headingPath = sec.parentTitle ? [sec.parentTitle, sec.title] : [sec.title];
    candidates.push({
      id: semanticSectionId(scope, headingPath.map(slugifyHeading)),
      file: "kb04",
      candidateType: "sezioneSemantica",
      documentScope: scope,
      headingPath,
      startLine: sec.startLine,
      endLine: sec.endLine,
    });
  }

  // v3.1.2 §1: i record parsati sono esposti perche' costituiscono la fonte
  // canonica dello stato documentario per tutti i candidati che vi fanno capo.
  const recordsByNaturalId = new Map();
  for (const rec of [...peRecords, ...rpRecords, ...attRecords, ...legRecords]) {
    recordsByNaturalId.set(rec.id, rec);
  }

  return { candidates, tableInventory, knownBoundaryLines, recordsByNaturalId };
}

// ---------------------------------------------------------------------------
// KB02
// ---------------------------------------------------------------------------

export function buildKb02Candidates(raw02) {
  const { years, nonYearH1Sections } = parseKb02(raw02);
  const candidates = [];
  const knownBoundaryLines = new Set();

  for (const y of years) {
    knownBoundaryLines.add(y.headingLine);

    // Metadati dell'anno (**Atto:**, **Modifica:**, **Struttura:** ecc.) fra
    // l'heading dell'anno e la prima sotto-sezione H3 — prima non generavano
    // alcun candidato e restavano "unexplained".
    if (y.metadataEndLine >= y.metadataStartLine) {
      candidates.push({
        id: semanticSectionId("memoria-incrementale", [String(y.year), "metadati-atto"]),
        file: "kb02",
        candidateType: "sezioneSemantica",
        documentScope: "memoria-incrementale",
        headingPath: [`${y.year} — ${y.title}`, "Metadati atto"],
        year: y.year,
        startLine: y.metadataStartLine,
        endLine: y.metadataEndLine,
      });
    }

    for (const sub of y.subsections) {
      knownBoundaryLines.add(sub.headingLine);
      for (const b of sub.bullets) {
        knownBoundaryLines.add(b.line);
        candidates.push({
          id: kb02BulletId(y.year, sub.slug, b.tag, b.contentSlug, b.duplicateIndex),
          file: "kb02",
          candidateType: "voceCronologia",
          documentScope: "memoria-incrementale",
          headingPath: [`${y.year} — ${y.title}`, sub.title],
          year: y.year,
          tag: b.tag,
          startLine: b.line,
          endLine: b.endLine || b.line,
        });
      }
      // Sotto-sezioni senza bullet taggati (es. "Nota documentale",
      // "Conseguenza storica", "Modifica del ...") sono testo libero: prima
      // di questa correzione non generavano alcun candidato. Copriamo anche
      // l'eventuale testo introduttivo di una sotto-sezione CON bullet, se
      // presente prima del primo bullet (raro ma possibile).
      const firstBulletLine = sub.bullets.length > 0 ? sub.bullets[0].line : null;
      const proseStart = sub.headingLine + 1;
      const proseEnd = firstBulletLine ? firstBulletLine - 1 : sub.endLine;
      if (proseEnd >= proseStart) {
        candidates.push({
          id: semanticSectionId("memoria-incrementale", [String(y.year), sub.slug, "testo"]),
          file: "kb02",
          candidateType: "sezioneSemantica",
          documentScope: "memoria-incrementale",
          headingPath: [`${y.year} — ${y.title}`, sub.title],
          year: y.year,
          startLine: proseStart,
          endLine: proseEnd,
        });
      }
    }
  }

  // Tabelle Markdown atomiche (le 6 tabelle storiche per periodo — v3.1 §5).
  // v3.1.1 §2: l'ID pubblico NON deve mai dipendere dal numero di riga
  // (t.headerLine). Le 6 tabelle di KB02 condividono le stesse celle
  // header ("Periodo | Stato"/"Periodo | Stato essenziale"), quindi
  // tableSlug(headerCells) da solo collide fra loro. Il disambiguatore
  // stabile e' invece il TITOLO dell'H3 immediatamente precedente (es.
  // "6.1 Incentivi economici"), che e' un identificativo semantico del
  // periodo/argomento della tabella, non una posizione incidentale: resta
  // invariato sotto qualsiasi inserimento di righe o di un'altra tabella
  // prima o dopo, finche' l'heading semantico della tabella stessa non
  // cambia (nel qual caso e' corretto che l'ID cambi con esso).
  const tables = detectAllMarkdownTables(raw02);
  const tableInventory = [];
  for (const t of tables) {
    const lastLine = t.lastDataLine || t.separatorLine;
    knownBoundaryLines.add(t.headerLine);
    const headingSlug = nearestPrecedingHeadingSlug(raw02, t.headerLine);
    // v3.1.2 §3 — lo scope della tabella e' DERIVATO dalla regione che la
    // contiene realmente, non piu' cablato a "memoria-incrementale". Le 6
    // tabelle della sezione H1 di cornice "6. Tracciato storico delle
    // principali modifiche" non stanno dentro alcuna sezione annuale:
    // dichiararle "memoria-incrementale" era una violazione di scope che il
    // controllo di containment completo (§3) ha reso visibile.
    const tableScope = years.some((y) => t.headerLine >= y.headingLine && t.headerLine <= y.endLine)
      ? "memoria-incrementale"
      : "memoria-incrementale-cornice";
    const id = tableId(tableScope, headingSlug || tableSlug(t.headerCells));
    candidates.push({
      id,
      file: "kb02",
      candidateType: "tabellaAtomica",
      documentScope: tableScope,
      headingPath: ["Tabella storica"],
      startLine: t.headerLine,
      endLine: lastLine,
      rowCount: t.rowCount,
    });
    tableInventory.push({
      file: "kb02",
      tableId: id,
      scope: tableScope,
      startLine: t.headerLine,
      endLine: lastLine,
      rowCount: t.rowCount,
      candidateId: id,
      atomicityResult: "atomic",
    });
  }

  // Sezioni H1 non-cronologia (1..4, 6) e i loro H2/H3 figli (es. 6.1, 6.2,
  // 6.3 con le rispettive tabelle storiche) diventano candidati semantici
  // propri, correttamente annidati (il padre si ferma al primo figlio),
  // invece del vecchio catch-all "proseText" che inglobava tutto — v3.1
  // §3/§4, applicato qui per coerenza con lo stesso principio usato su
  // KB01/KB03/KB04.
  const residualSections = extractResidualSections(
    raw02,
    knownBoundaryLines,
    (lineNo, title) => /^5\.\s*Cronologia incrementale/.test(title)
  );
  for (const sec of residualSections) {
    const scope = "memoria-incrementale-cornice";
    const headingPath = sec.parentTitle ? [sec.parentTitle, sec.title] : [sec.title];
    candidates.push({
      id: semanticSectionId(scope, headingPath.map(slugifyHeading)),
      file: "kb02",
      candidateType: "sezioneSemantica",
      documentScope: scope,
      headingPath,
      startLine: sec.startLine,
      endLine: sec.endLine,
    });
  }

  return { candidates, tableInventory, knownBoundaryLines, years, nonYearH1Sections };
}

// ---------------------------------------------------------------------------
// Controlli cross-file
// ---------------------------------------------------------------------------

function checkStableIdCollisions(allCandidates) {
  const seen = new Map();
  const collisions = [];
  for (const c of allCandidates) {
    if (seen.has(c.id)) collisions.push(c.id);
    seen.set(c.id, true);
  }
  return collisions;
}

function checkNoUnscopedCandidates(allCandidates) {
  return allCandidates.filter((c) => !c.documentScope || c.documentScope === "unscoped");
}

function checkCandidatesWithinContainingBlock(kb03Candidates, h1Blocks) {
  // Verifica esplicita del fix §1: nessun candidato KB03 supera l'endLine
  // del blocco H1 che lo contiene.
  const violations = [];
  for (const c of kb03Candidates) {
    const block = h1Blocks.find((b) => c.startLine >= b.headingLine && c.startLine <= b.endLine);
    if (block && c.endLine > block.endLine) {
      violations.push({ id: c.id, endLine: c.endLine, blockEndLine: block.endLine, blockTitle: block.title });
    }
  }
  return violations;
}

/**
 * Generalizzazione del containment check (v3.1.1 §5): stessa logica di
 * checkCandidatesWithinContainingBlock, ma parametrica sui blocchi
 * contenitore di QUALSIASI file (non solo i blocchi H1 di KB03). Un
 * "blocco contenitore" e' qualunque struttura con headingLine/endLine che
 * il parser del file espone come unita' naturale (atto per KB01, sezione
 * annuale H1 per KB02, record per KB04, blocco H1 per KB03). Un candidato
 * senza alcun blocco corrispondente (startLine fuori da ogni range noto)
 * NON e' una violazione di questo check -- e' un problema di scope
 * diverso, gia' coperto da checkNoUnscopedCandidates.
 */
export function checkCandidatesWithinBlocks(candidates, blocks, blockLabel) {
  const violations = [];
  for (const c of candidates) {
    const block = blocks.find((b) => c.startLine >= b.headingLine && c.startLine <= b.endLine);
    if (block && c.endLine > block.endLine) {
      violations.push({
        id: c.id,
        file: c.file,
        blockLabel,
        endLine: c.endLine,
        blockEndLine: block.endLine,
        blockTitle: block.title || block.id || block.year || null,
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Contratto candidato completo (v3.1.1 §4): contentHash SHA-256
// deterministico, ricostruito dal testo esatto (startLine/endLine 1-based
// inclusivi), + struttura status/ereditarieta' su TUTTI i candidati, non
// solo su un sottoinsieme. Nessun campo qui dipende da hash gia' presenti
// altrove nel documento, ordine di iterazione, o conteggi totali -- solo
// dal testo del candidato stesso e (per l'ereditarieta') dagli id di altri
// candidati gia' noti.
// ---------------------------------------------------------------------------

export function reconstructCandidateText(rawByFile, candidate) {
  const raw = rawByFile[candidate.file];
  if (raw == null) return null;
  const lines = raw.split("\n");
  // 1-based inclusivo: startLine=1 => lines[0]. Guardia contro range invalidi.
  if (
    typeof candidate.startLine !== "number" ||
    typeof candidate.endLine !== "number" ||
    candidate.startLine < 1 ||
    candidate.endLine < candidate.startLine
  ) {
    return null;
  }
  return lines.slice(candidate.startLine - 1, candidate.endLine).join("\n");
}

export function computeContentHash(text) {
  if (text == null) return null;
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

/**
 * Determina i riferimenti di ereditarieta' di un candidato verso altri
 * candidati del corpus. Attualmente il solo caso concreto e' un
 * puntoDiModifica di KB01, che fa riferimento all'articolo ordinario che
 * modifica nell'atto base dello stesso anno (v3.1.1 §4). Per tutti gli
 * altri candidateType non esiste ancora un riferimento noto e affidabile,
 * quindi l'array resta vuoto (MAI omesso: la struttura e' sempre presente).
 */
function resolveInheritanceRefs(candidate, idIndex, baseActRegisterIdByYear) {
  const refs = [];
  if (candidate.candidateType === "puntoDiModifica" && typeof candidate.targetArticle === "number") {
    const baseRegisterId = baseActRegisterIdByYear.get(candidate.year);
    if (baseRegisterId) {
      const targetId = kb01ArticleId(baseRegisterId, candidate.targetArticle);
      if (idIndex.has(targetId)) {
        refs.push({ ref: targetId, relation: "modifica" });
      }
    }
  }
  return refs;
}

/**
 * Decora OGNI candidato in allCandidates con: contentHash (SHA-256 dal
 * testo esatto ricostruito), status (struttura sempre presente, calcolata
 * dai dati reali del candidato — mai un valore fisso identico per tutti se
 * i dati sottostanti differiscono), e inheritance (array, mai omesso).
 * Muta gli oggetti candidato in place (sono gia' referenziati altrove in
 * perFile[key].candidates con lo stesso oggetto, quindi la decorazione e'
 * visibile ovunque).
 */
function decorateCandidatesWithContract(allCandidates, rawByFile, baseActRegisterIdByYear, statusContext) {
  const idIndex = new Set(allCandidates.map((c) => c.id));
  for (const c of allCandidates) {
    const text = reconstructCandidateText(rawByFile, c);
    c.contentHash = computeContentHash(text);
    c.reconstructedLineCount = text == null ? null : text.split("\n").length;
    // v3.1.2 §1: i metadati di integrita' sono tenuti SEPARATI dallo stato
    // documentario. contentHash e range ricostruito descrivono l'integrita'
    // del testo, non la sua condizione legale o documentaria.
    c.integrity = {
      contentHash: c.contentHash,
      hashComputedFrom: text == null ? null : `${c.file}:${c.startLine}-${c.endLine}`,
      reconstructedLineCount: c.reconstructedLineCount,
    };
    // v3.1.2 §1: contratto reale a quattro dimensioni. Nessun valore e'
    // inferito, normalizzato o inventato: ogni dimensione porta o il
    // letterale canonico esatto con riferimento macchina-leggibile alla
    // fonte, o un documented-null tipizzato che dichiara dove si e'
    // verificata l'assenza.
    c.status = buildDocumentaryStatus(c, statusContext);
    c.inheritance = resolveInheritanceRefs(c, idIndex, baseActRegisterIdByYear);
  }
  return allCandidates;
}

/**
 * Gate computato (v3.1.2 §1, esteso v3.1.3 §2): allCandidatesHaveCanonicalStatusDimensions.
 * Fallisce se un candidato:
 *  - non espone una delle quattro dimensioni canoniche;
 *  - non porta un riferimento canonico alla fonte (o di ereditarieta');
 *  - usa un valore inventato, non presente nel vocabolario canonico KB 04;
 *  - collassa le quattro dimensioni in un unico stato generico;
 *  - [v3.1.3 §2] dichiara un riferimento alla fonte che non risolve
 *    SEMANTICAMENTE contro il testo grezzo delle 4 KB canoniche: file
 *    inesistente, riga inesistente, recordId che non risolve al record
 *    dichiarato, field assente da quel record, riga che non e' la riga
 *    reale del campo, literal che non coincide con il letterale reale,
 *    scope che non coincide con lo scope del record/documento risolto,
 *    dimension che non coincide con la dimensione dichiarante, ref di
 *    ereditarieta' che non risolve a un candidato esistente, naturalId che
 *    non risolve a un record KB 04 esistente, o resolutionMethod/provisional
 *    che non coincidono con la voce REALE del mapping KB01->KB04.
 *
 * @param allCandidates elenco completo dei candidati diagnostici
 * @param vocabulary    vocabolario di legenda KB 04 (extractKb04StatusVocabulary)
 * @param ctx.rawByFile        { kb01, kb02, kb03, kb04 } testo grezzo per riga
 * @param ctx.kb04RecordsById  Map naturalId -> record KB 04 (fields/fieldLines/headingLine)
 * @param ctx.mappingByRegisterId Map naturalId (registerId) -> voce reale di kb01Result.mapping
 * @param ctx.candidateIdIndex Set di tutti gli id pubblici dei candidati (per risolvere inheritedFrom.ref)
 */
export function checkCanonicalStatusDimensions(allCandidates, vocabulary, ctx) {
  const violations = [];
  const push = (c, dimension, problem, detail) =>
    violations.push({ id: c.id, file: c.file, dimension, problem, detail: detail || null });

  for (const c of allCandidates) {
    const s = c.status;
    if (!s || typeof s !== "object") {
      push(c, null, "missingStatusObject", "il candidato non espone alcun contratto di stato");
      continue;
    }

    // Collasso in stato generico: un contratto valido non ha un campo unico
    // di stato accanto (o al posto) delle quattro dimensioni.
    for (const collapsed of ["state", "verifiedBy"]) {
      if (Object.prototype.hasOwnProperty.call(s, collapsed)) {
        push(c, null, "collapsedGenericState", `campo generico "${collapsed}" presente nel contratto di stato`);
      }
    }
    // Metadati di integrita' non devono vivere dentro lo stato documentario.
    for (const integrityKey of ["contentHash", "hashComputedFrom", "reconstructedLineCount"]) {
      if (Object.prototype.hasOwnProperty.call(s, integrityKey)) {
        push(c, null, "integrityFieldInsideStatus", `campo di integrita' "${integrityKey}" annidato nello stato documentario`);
      }
    }

    for (const dim of STATUS_DIMENSIONS) {
      const e = s[dim];
      if (!e || typeof e !== "object") {
        push(c, dim, "missingDimension", "dimensione canonica assente");
        continue;
      }

      const hasValue = typeof e.value === "string" && e.value.length > 0;
      const hasNull = e.documentedNull !== null && typeof e.documentedNull === "object";

      if (hasValue === hasNull) {
        push(c, dim, "ambiguousDimension", "la dimensione deve portare esattamente uno fra value e documentedNull");
        continue;
      }

      if (hasValue) {
        // Il valore deve essere una voce di legenda realmente presente nella
        // KB 04 e assegnata a QUESTA dimensione dal crosswalk dichiarato.
        if (!vocabulary.has(e.value)) {
          push(c, dim, "unsupportedInventedValue", `"${e.value}" non e' una voce di legenda della KB 04`);
        } else if (KB04_LEGEND_CROSSWALK[e.value] !== dim) {
          push(c, dim, "unsupportedInventedValue", `"${e.value}" non e' assegnato a questa dimensione dal crosswalk canonico`);
        }
      } else {
        if (!DOCUMENTED_NULL_REASONS.includes(e.documentedNull.reason)) {
          push(c, dim, "unsupportedInventedValue", `documented-null con motivo non tipizzato: "${e.documentedNull.reason}"`);
        }
        if (typeof e.documentedNull.explanation !== "string" || e.documentedNull.explanation.length === 0) {
          push(c, dim, "missingSourceReference", "documented-null privo di motivazione tracciabile");
        }
      }

      // Riferimento alla fonte: sempre obbligatorio, sia per un valore
      // canonico sia per un'assenza accertata.
      const src = e.source;
      if (!src || typeof src !== "object") {
        push(c, dim, "missingSourceReference", "riferimento alla fonte assente");
        continue;
      }
      if (typeof src.file !== "string" || src.file.length === 0) {
        push(c, dim, "missingSourceReference", "riferimento alla fonte privo di file");
      }
      if (typeof src.line !== "number") {
        push(c, dim, "missingSourceReference", "riferimento alla fonte privo di riga");
      }
      const expectedKind = hasValue ? "canonicalValue" : "absenceChecked";
      if (src.kind !== expectedKind) {
        push(c, dim, "missingSourceReference", `kind della fonte incoerente: atteso ${expectedKind}, trovato ${src.kind}`);
      }
      if (hasValue && (typeof src.field !== "string" || src.field.length === 0)) {
        push(c, dim, "missingSourceReference", "valore canonico privo del campo di origine");
      }

      // Ereditarieta': se la fonte e' un record KB 04 diverso dal candidato
      // stesso, il riferimento di ereditarieta' deve essere esplicito.
      const isOwnRecord = c.file === "kb04" && c.candidateType === "recordRegistro";
      if (src.file === "kb04" && src.recordId && !isOwnRecord) {
        const inh0 = e.inheritedFrom;
        if (!inh0 || typeof inh0 !== "object" || typeof inh0.naturalId !== "string" || typeof inh0.resolutionMethod !== "string") {
          push(c, dim, "missingInheritanceReference", "valore ereditato da un record KB 04 senza riferimento di ereditarieta' esplicito");
        }
      }

      // v3.1.3 §2: risoluzione semantica REALE del riferimento alla fonte,
      // non solo type-check di forma. Richiede ctx (rawByFile, kb04RecordsById,
      // mappingByRegisterId, candidateIdIndex); se ctx manca, questi controlli
      // vengono saltati (compatibilita' con chiamate legacy che non li usano).
      if (ctx && src && typeof src === "object") {
        const fileLines = typeof src.file === "string" && ctx.rawByFile[src.file] ? ctx.rawByFile[src.file].split("\n") : null;

        // (a) source.file deve essere uno dei 4 file canonici con testo disponibile.
        if (typeof src.file === "string" && !fileLines) {
          push(c, dim, "unresolvedSourceFile", `source.file "${src.file}" non e' uno dei 4 file canonici (kb01-kb04)`);
        }

        // (b) source.line deve esistere realmente in quel file.
        let lineText = null;
        if (fileLines && typeof src.line === "number") {
          if (src.line < 1 || src.line > fileLines.length) {
            push(c, dim, "unresolvedSourceLine", `source.line ${src.line} non esiste in ${src.file} (file di ${fileLines.length} righe)`);
          } else {
            lineText = fileLines[src.line - 1];
          }
        }

        // (c)-(d) source.recordId deve risolvere al record dichiarato; il
        // campo dichiarato deve esistere su quel record; la riga dichiarata
        // deve essere la riga REALE di quel campo.
        let resolvedRecord = null;
        if (typeof src.recordId === "string" && src.recordId.length > 0) {
          resolvedRecord = ctx.kb04RecordsById ? ctx.kb04RecordsById.get(src.recordId) || null : null;
          if (!resolvedRecord) {
            push(c, dim, "unresolvedRecordId", `source.recordId "${src.recordId}" non risolve ad alcun record KB 04 esistente`);
          } else {
            if (typeof src.field === "string" && src.field.length > 0) {
              const realFieldLine = resolvedRecord.fieldLines ? resolvedRecord.fieldLines[src.field] : undefined;
              const realFieldValue = resolvedRecord.fields ? resolvedRecord.fields[src.field] : undefined;
              if (typeof realFieldLine !== "number") {
                push(c, dim, "unresolvedField", `source.field "${src.field}" non esiste nel record ${src.recordId}`);
              } else if (typeof src.line === "number" && src.line !== realFieldLine) {
                push(c, dim, "sourceLineMismatch", `source.line ${src.line} non e' la riga reale del campo "${src.field}" (riga reale ${realFieldLine}) nel record ${src.recordId}`);
              }
              // (e) source.literal deve coincidere con il letterale reale del campo.
              if (typeof src.literal === "string" && typeof realFieldValue === "string" && src.literal !== realFieldValue) {
                push(c, dim, "sourceLiteralMismatch", `source.literal "${src.literal}" non coincide con il letterale reale del campo "${src.field}" ("${realFieldValue}") nel record ${src.recordId}`);
              }
            } else if (src.literal !== null && src.literal !== undefined) {
              // Riferimento al record senza campo dichiarato (es. absenceChecked
              // sull'intero record): il literal, se presente, deve comunque
              // comparire testualmente sulla riga dichiarata.
              if (lineText !== null && !lineText.includes(src.literal)) {
                push(c, dim, "sourceLiteralMismatch", `source.literal "${src.literal}" non compare sulla riga ${src.line} dichiarata di ${src.recordId}`);
              }
            }
            // (f) source.scope, quando la fonte e' un record KB 04, deve
            // coincidere con lo scope canonico dei record di registro.
            if (typeof src.scope === "string" && src.scope !== "registro-fonti") {
              push(c, dim, "sourceScopeMismatch", `source.scope "${src.scope}" non coincide con lo scope canonico "registro-fonti" del record ${src.recordId}`);
            }
          }
        } else if (typeof src.literal === "string" && src.literal.length > 0 && lineText !== null) {
          // Nessun recordId dichiarato ma un literal e' comunque presente
          // (es. absenceChecked ancorato a una riga di scope/front-matter):
          // il letterale deve comparire testualmente sulla riga dichiarata.
          if (!lineText.includes(src.literal)) {
            push(c, dim, "sourceLiteralMismatch", `source.literal "${src.literal}" non compare sulla riga ${src.line} dichiarata di ${src.file}`);
          }
        }

        // (g) quando la fonte non e' un record KB 04 (assenza sul candidato
        // stesso), lo scope dichiarato deve coincidere con il documentScope
        // reale del candidato.
        if (!resolvedRecord && typeof src.scope === "string" && typeof c.documentScope === "string" && src.scope !== c.documentScope) {
          push(c, dim, "sourceScopeMismatch", `source.scope "${src.scope}" non coincide con il documentScope reale del candidato ("${c.documentScope}")`);
        }

        // (h) entry.dimension deve coincidere con la dimensione dichiarante.
        if (typeof e.dimension === "string" && e.dimension !== dim) {
          push(c, dim, "dimensionMismatch", `entry.dimension "${e.dimension}" non coincide con la dimensione dichiarante "${dim}"`);
        }

        // (i)-(j) inheritedFrom.ref deve risolvere a un candidato esistente;
        // inheritedFrom.naturalId deve risolvere a un record KB 04 esistente;
        // resolutionMethod/provisional devono coincidere con la voce REALE
        // del mapping KB01->KB04 per quel naturalId.
        const inh = e.inheritedFrom;
        if (inh && typeof inh === "object") {
          if (typeof inh.ref !== "string" || !(ctx.candidateIdIndex && ctx.candidateIdIndex.has(inh.ref))) {
            push(c, dim, "unresolvedInheritanceRef", `inheritedFrom.ref "${inh.ref}" non risolve a un candidato esistente`);
          }
          const inhRecord = typeof inh.naturalId === "string" && ctx.kb04RecordsById ? ctx.kb04RecordsById.get(inh.naturalId) || null : null;
          if (typeof inh.naturalId === "string" && !inhRecord) {
            push(c, dim, "unresolvedInheritanceNaturalId", `inheritedFrom.naturalId "${inh.naturalId}" non risolve ad alcun record KB 04 esistente`);
          }
          if (typeof inh.naturalId === "string" && ctx.mappingByRegisterId) {
            const mappingEntry = ctx.mappingByRegisterId.get(inh.naturalId) || null;
            if (mappingEntry) {
              const expectedMethod = mappingEntry.verifiedBy === "actNumberMatch" ? "registerIdExactMatch" : mappingEntry.verifiedBy === "yearOnlyFallback" ? "registerIdYearOnlyFallback" : null;
              const expectedProvisional = mappingEntry.verifiedBy === "actNumberMatch" ? false : mappingEntry.verifiedBy === "yearOnlyFallback" ? true : null;
              if (expectedMethod !== null && inh.resolutionMethod !== expectedMethod) {
                push(c, dim, "resolutionMethodMismatch", `inheritedFrom.resolutionMethod "${inh.resolutionMethod}" non coincide con la voce reale del mapping (${mappingEntry.verifiedBy} -> ${expectedMethod}) per ${inh.naturalId}`);
              }
              if (expectedProvisional !== null && inh.provisional !== expectedProvisional) {
                push(c, dim, "provisionalFlagMismatch", `inheritedFrom.provisional ${inh.provisional} non coincide con la voce reale del mapping (${mappingEntry.verifiedBy} -> ${expectedProvisional}) per ${inh.naturalId}`);
              }
            } else if (inh.resolutionMethod !== "directRecordReference") {
              push(c, dim, "resolutionMethodMismatch", `naturalId "${inh.naturalId}" non ha una voce nel mapping KB01->KB04: resolutionMethod atteso "directRecordReference", trovato "${inh.resolutionMethod}"`);
            }
          }
        }
      }

    }
  }

  return violations;
}

/**
 * Gate computato (v3.1.3 §3): allScopeLevelStatusEvidenceResolvesSemantically.
 * Valida ogni voce prodotta da buildScopeLevelStatusEvidence contro il testo
 * grezzo REALE del file dichiarato: la riga deve esistere, e per le voci di
 * front-matter la riga deve contenere esattamente il letterale dichiarato in
 * un campo `status: "..."`; per le voci di riga di tabella la riga deve
 * contenere il letterale come sottostringa. Impedisce che un refactor futuro
 * di buildScopeLevelStatusEvidence inventi righe o letterali non presenti
 * nel testo grezzo.
 *
 * @param scopeLevelStatusEvidence elenco prodotto da buildScopeLevelStatusEvidence
 * @param rawByFile { kb01, kb02, kb03, kb04 } testo grezzo per riga
 */
export function checkScopeLevelStatusEvidence(scopeLevelStatusEvidence, rawByFile) {
  const violations = [];
  const push = (entry, problem, detail) =>
    violations.push({ file: entry.file, line: entry.line, kind: entry.kind, problem, detail: detail || null });

  for (const entry of scopeLevelStatusEvidence) {
    const raw = rawByFile[entry.file];
    if (typeof raw !== "string") {
      push(entry, "unresolvedSourceFile", `file dichiarato "${entry.file}" non presente in rawByFile`);
      continue;
    }
    const lines = raw.split("\n");
    if (!Number.isInteger(entry.line) || entry.line < 1 || entry.line > lines.length) {
      push(entry, "unresolvedSourceLine", `riga ${entry.line} fuori dai limiti del file (1..${lines.length})`);
      continue;
    }
    const lineText = lines[entry.line - 1];
    if (typeof entry.literal !== "string" || entry.literal.length === 0) {
      push(entry, "missingLiteral", "il letterale dichiarato e' vuoto o assente");
      continue;
    }
    if (!lineText.includes(entry.literal)) {
      push(
        entry,
        "sourceLiteralMismatch",
        `il letterale dichiarato ("${entry.literal}") non e' contenuto nella riga reale ${entry.line} ("${lineText.trim()}")`
      );
      continue;
    }
    if (entry.documentedNull?.reason !== "notYetEvaluated") {
      push(
        entry,
        "wrongDocumentedNullReason",
        `evidenza di stato non classificato deve dichiarare reason "notYetEvaluated", trovato "${entry.documentedNull?.reason}"`
      );
      continue;
    }
    if (entry.documentedNull?.literal !== entry.literal) {
      push(entry, "documentedNullLiteralMismatch", "documentedNull.literal non coincide con entry.literal");
      continue;
    }
  }

  return violations;
}

function estimateSplitCount(candidates, raw) {
  const lines = raw.split("\n");
  let totalEstimatedSplits = 0;
  for (const c of candidates) {
    if (c.startLine == null || c.endLine == null) continue;
    const text = lines.slice(c.startLine - 1, c.endLine).join("\n");
    const tokens = estimateTokens(text);
    totalEstimatedSplits += Math.max(1, Math.ceil(tokens / MAX_TOKENS_PER_CHUNK));
  }
  return totalEstimatedSplits;
}

// ---------------------------------------------------------------------------
// Ledger builders per file (usano il coverage-ledger.mjs generale)
// ---------------------------------------------------------------------------

function buildKb01Ledger(raw01, candidates, frontMatterEndLine, years, acts, nonChunkableRanges) {
  const lines = raw01.split("\n");
  const structuralHeadings = [];
  const nonChunkable = [...nonChunkableRanges];
  const inheritedMetadata = [];
  const excluded = [];

  for (const y of years) {
    structuralHeadings.push({ startLine: y.headingLine, endLine: y.headingLine, reasonCode: "year-heading" });
  }
  for (const act of acts) {
    structuralHeadings.push({ startLine: act.headingLine, endLine: act.headingLine, reasonCode: "act-heading" });
    if (act.fullTextHeadingLine) {
      structuralHeadings.push({
        startLine: act.fullTextHeadingLine,
        endLine: act.fullTextHeadingLine,
        reasonCode: "full-text-heading",
      });
    }
    for (const m of act.metadataLines) {
      inheritedMetadata.push({ startLine: m, endLine: m, reasonCode: "act-metadata-field" });
    }
  }
  if (frontMatterEndLine > 0) {
    nonChunkable.push({ startLine: 1, endLine: frontMatterEndLine, reasonCode: "front-matter" });
  }
  for (let i = 1; i <= lines.length; i++) {
    const t = lines[i - 1].trim();
    if (t === "---") excluded.push({ startLine: i, endLine: i, reasonCode: "markdown-separator" });
    if (/^<!--.*-->\s*$/.test(t)) excluded.push({ startLine: i, endLine: i, reasonCode: "html-comment-page-marker" });
  }
  // Intro editoriale non-chunkable (KB 01 titolo, Istruzioni d'uso, Principio di prevalenza) e' passata
  // gia' come nonChunkableRanges (calcolata in buildKb01Candidates con la stessa logica di estrazione
  // sezioni, cosi' il range usato qui e' IDENTICO a quello scartato in fase di candidate-building).

  const ledger = buildCoverageLedger({
    lines,
    candidates,
    structuralHeadings,
    inheritedMetadata,
    nonChunkable,
    excluded,
  });
  return ledger;
}

function buildKb02Ledger(raw02, candidates, years, nonYearH1Sections) {
  const lines = raw02.split("\n");
  const structuralHeadings = [];
  for (const y of years) {
    structuralHeadings.push({ startLine: y.headingLine, endLine: y.headingLine, reasonCode: "year-heading" });
    for (const sub of y.subsections) {
      structuralHeadings.push({ startLine: sub.headingLine, endLine: sub.headingLine, reasonCode: "subsection-heading" });
    }
  }
  for (const sec of nonYearH1Sections) {
    structuralHeadings.push({ startLine: sec.headingLine, endLine: sec.headingLine, reasonCode: "section-heading" });
  }
  const nonChunkable = [];
  let frontMatterEndLine02 = 0;
  if (lines[0] === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === "---") {
        frontMatterEndLine02 = i + 1;
        break;
      }
    }
  }
  if (frontMatterEndLine02 > 0) {
    nonChunkable.push({ startLine: 1, endLine: frontMatterEndLine02, reasonCode: "front-matter" });
  }
  const excluded02 = [];
  for (let i = frontMatterEndLine02 + 1; i <= lines.length; i++) {
    const t = lines[i - 1].trim();
    if (t === "---") excluded02.push({ startLine: i, endLine: i, reasonCode: "markdown-separator" });
  }
  const ledger = buildCoverageLedger({
    lines,
    candidates,
    structuralHeadings,
    inheritedMetadata: [],
    nonChunkable,
    excluded: excluded02,
  });
  return ledger;
}

function buildKb03Ledger(raw03, candidates) {
  const lines = raw03.split("\n");
  const { h1Blocks, frontMatterEndLine, capitoli } = parseKb03(raw03);
  const structuralHeadings = [];
  const nonChunkable = [];

  for (const block of h1Blocks) {
    structuralHeadings.push({ startLine: block.headingLine, endLine: block.headingLine, reasonCode: "h1-block-heading" });
    if (block.scope === "non-chunkable") {
      nonChunkable.push({
        startLine: block.headingLine,
        endLine: block.endLine,
        reasonCode: "editorial-intro-declared-non-chunkable",
      });
    }
  }
  // Heading H2/H3 dei candidati semantici e degli articoli sono parte del
  // candidato stesso (inclusi nel range), quindi non serve marcarli a
  // parte come structural — sono coperti da candidate-content.
  //
  // Heading "## CAPITOLO N" (Regolamento per il Palio) e la riga di
  // sottotitolo descrittivo che segue (es. "Disposizioni fondamentali") non
  // sono articoli e non generano candidati content: sono titolo puramente
  // strutturale, marcati qui come structuralHeadings — v3.1 §3 (prima
  // restavano "unexplained").
  for (const cap of capitoli) {
    structuralHeadings.push({ startLine: cap.line, endLine: cap.line, reasonCode: "capitolo-heading" });
    let subtitleLine = null;
    for (let ln = cap.line + 1; ln <= Math.min(cap.line + 5, lines.length); ln++) {
      if (lines[ln - 1].trim() !== "") {
        subtitleLine = ln;
        break;
      }
    }
    if (subtitleLine) {
      structuralHeadings.push({ startLine: subtitleLine, endLine: subtitleLine, reasonCode: "capitolo-subtitle" });
    }
  }
  // Righe separatore markdown ("---") isolate, non front-matter — v3.1 §3.
  const excluded03 = [];
  for (let i = frontMatterEndLine + 1; i <= lines.length; i++) {
    if (lines[i - 1].trim() === "---") {
      excluded03.push({ startLine: i, endLine: i, reasonCode: "markdown-separator" });
    }
  }
  if (frontMatterEndLine > 0) {
    nonChunkable.push({ startLine: 1, endLine: frontMatterEndLine, reasonCode: "front-matter" });
  }

  const ledger = buildCoverageLedger({
    lines,
    candidates,
    structuralHeadings,
    inheritedMetadata: [],
    nonChunkable,
    excluded: excluded03,
  });
  return ledger;
}

function buildKb04Ledger(raw04, candidates) {
  const lines = raw04.split("\n");
  const { frontMatterEndLine } = parseKb04(raw04);
  const structuralHeadings = [];
  const nonChunkable = [];
  const inheritedMetadata = [];

  const HEADING_RE = /^(#{1,4})\s+.+$/;
  const FIELD_RE = /^-\s+\*\*[^:*]+:\*\*\s*.*$/;
  const knownIds = new Set(candidates.map((c) => c.id));
  const candidateLineSet = new Set();
  for (const c of candidates) {
    if (c.startLine == null || c.endLine == null) continue;
    for (let i = c.startLine; i <= c.endLine; i++) candidateLineSet.add(i);
  }
  for (let i = 1; i <= lines.length; i++) {
    if (candidateLineSet.has(i)) continue;
    if (HEADING_RE.test(lines[i - 1])) {
      structuralHeadings.push({ startLine: i, endLine: i, reasonCode: "heading-not-yet-a-record" });
    } else if (FIELD_RE.test(lines[i - 1])) {
      inheritedMetadata.push({ startLine: i, endLine: i, reasonCode: "record-metadata-field-outside-range" });
    }
  }
  if (frontMatterEndLine > 0) {
    nonChunkable.push({ startLine: 1, endLine: frontMatterEndLine, reasonCode: "front-matter" });
  }

  const ledger = buildCoverageLedger({
    lines,
    candidates,
    structuralHeadings,
    inheritedMetadata,
    nonChunkable,
    excluded: [],
  });
  return ledger;
}

// ---------------------------------------------------------------------------
// Analisi principale
// ---------------------------------------------------------------------------

export function analyzeAll() {
  const raw01 = readKb("kb01");
  const raw02 = readKb("kb02");
  const raw03 = readKb("kb03");
  const raw04 = readKb("kb04");

  const kb01Result = buildKb01Candidates(raw01, raw04);
  const kb03Result = buildKb03Candidates(raw03);
  const kb04Result = buildKb04Candidates(raw04);
  const kb02Result = buildKb02Candidates(raw02);

  const { years: kb01Years } = parseKb01(raw01);
  const kb01Acts = classifyActs(kb01Years);
  const { h1Blocks: kb03H1Blocks } = parseKb03(raw03);
  // v3.1.1 §5: blocchi contenitore per l'estensione del containment check
  // a KB01/KB02/KB04 (atti per KB01, sezioni annuali H1 per KB02, i 4
  // registri di record per KB04).
  const { years: kb02YearsForContainment } = parseKb02(raw02);
  const { peRecords, rpRecords, attRecords, legRecords } = parseKb04(raw04);
  const kb04RecordBlocks = [...peRecords, ...rpRecords, ...attRecords, ...legRecords];

  const perFile = {
    kb01: {
      fileName: KB_FILES.kb01,
      candidates: kb01Result.candidates,
      ledger: buildKb01Ledger(
        raw01,
        kb01Result.candidates,
        kb01Result.frontMatterEndLine,
        kb01Years,
        kb01Acts,
        kb01Result.nonChunkableRanges
      ),
      registerMapping: {
        matched: kb01Result.candidates.length > 0,
        unmatchedActs: kb01Result.unmatchedActs,
        unmatchedRegisterRecords: kb01Result.unmatchedRegisterRecords.map((r) => r.id),
        mapping: kb01Result.mapping,
      },
      findings: kb01Result.findings,
      tableInventory: kb01Result.tableInventory,
    },
    kb02: {
      fileName: KB_FILES.kb02,
      candidates: kb02Result.candidates,
      ledger: buildKb02Ledger(raw02, kb02Result.candidates, kb02Result.years, kb02Result.nonYearH1Sections),
      tableInventory: kb02Result.tableInventory,
    },
    kb03: {
      fileName: KB_FILES.kb03,
      candidates: kb03Result.candidates,
      ledger: buildKb03Ledger(raw03, kb03Result.candidates),
      tableInventory: kb03Result.tableInventory,
    },
    kb04: {
      fileName: KB_FILES.kb04,
      candidates: kb04Result.candidates,
      ledger: buildKb04Ledger(raw04, kb04Result.candidates),
      tableInventory: kb04Result.tableInventory,
    },
  };

  const allCandidates = [
    ...kb01Result.candidates,
    ...kb02Result.candidates,
    ...kb03Result.candidates,
    ...kb04Result.candidates,
  ];

  // v3.1.1 §4: contentHash + status + inheritance su TUTTI i candidati.
  // Per l'ereditarieta' dei puntoDiModifica: il registerId dell'atto BASE
  // di un dato anno e' letto direttamente dai candidati articoloOrdinario
  // gia' costruiti per quell'anno (nessuna logica di mapping duplicata).
  const rawByFileForContract = { kb01: raw01, kb02: raw02, kb03: raw03, kb04: raw04 };
  const baseActRegisterIdByYear = new Map();
  for (const c of kb01Result.candidates) {
    if (c.candidateType === "articoloOrdinario" && !baseActRegisterIdByYear.has(c.year)) {
      baseActRegisterIdByYear.set(c.year, c.registerId);
    }
  }
  // v3.1.2 §1: vocabolario di stato estratto a runtime dalla KB 04, con i
  // numeri di riga reali delle voci di legenda. Il crosswalk dichiarato deve
  // risultare integralmente ancorato a queste voci.
  const kb04StatusVocabulary = extractKb04StatusVocabulary(raw04);
  const unanchoredCrosswalkTerms = findUnanchoredCrosswalkTerms(kb04StatusVocabulary);
  const kb04CandidateIdByNaturalId = new Map();
  for (const c of kb04Result.candidates) {
    if (c.candidateType === "recordRegistro" && typeof c.naturalId === "string") {
      kb04CandidateIdByNaturalId.set(c.naturalId, c.id);
    }
  }
  // v3.1.3 §1: Map registerId (naturalId KB04, es. "PE-2018-01") -> voce
  // REALE di kb01Result.mapping. Fonte unica di verita' per resolutionMethod
  // e provisional nell'ereditarieta' di documentary-status.mjs: prima di
  // questa correzione tali campi erano hardcoded a "registerIdExactMatch"/
  // false per OGNI candidato ereditato, promuovendo silenziosamente le 9
  // voci yearOnlyFallback (provvisorie) a match verificati.
  const mappingByRegisterId = new Map();
  for (const m of kb01Result.mapping) {
    if (typeof m.registerId === "string") {
      mappingByRegisterId.set(m.registerId, m);
    }
  }
  const statusContext = {
    vocabulary: kb04StatusVocabulary,
    kb04RecordsById: kb04Result.recordsByNaturalId,
    kb04CandidateIdByNaturalId,
    mappingByRegisterId,
  };

  decorateCandidatesWithContract(allCandidates, rawByFileForContract, baseActRegisterIdByYear, statusContext);

  // v3.1.3 §2: ctx per la risoluzione semantica reale dei riferimenti alla
  // fonte (non solo type-check di forma). candidateIdIndex serve a validare
  // inheritedFrom.ref contro l'inventario REALE dei candidati.
  const candidateIdIndex = new Set(allCandidates.map((cand) => cand.id));
  const statusCheckCtx = {
    rawByFile: rawByFileForContract,
    kb04RecordsById: kb04Result.recordsByNaturalId,
    mappingByRegisterId,
    candidateIdIndex,
  };
  const statusViolations = checkCanonicalStatusDimensions(allCandidates, kb04StatusVocabulary, statusCheckCtx);

  // v3.1.3 §3: evidenza di stato a livello di scope/front-matter in
  // KB01-KB03 (front-matter "status", righe della tabella "Atti necessari")
  // che nessun candidato di granularita' fine puo' rappresentare nel
  // proprio contratto a quattro dimensioni. Riportata separatamente, mai
  // come notDocumented, mai collassata in un unico candidato arbitrario.
  const scopeLevelStatusEvidence = buildScopeLevelStatusEvidence(rawByFileForContract, detectAllMarkdownTables);
  const scopeLevelStatusEvidenceViolations = checkScopeLevelStatusEvidence(scopeLevelStatusEvidence, rawByFileForContract);

  const idCollisions = checkStableIdCollisions(allCandidates);
  const unscoped = checkNoUnscopedCandidates(allCandidates);
  // v3.1.2 §3 — containment COMPLETO. Le vecchie funzioni per-file
  // ignoravano silenziosamente ogni candidato privo di blocco contenitore:
  // 39 candidati su 710 (5 in KB01, 15 in KB02, 19 in KB04) non venivano mai
  // verificati. La nuova partizione copre l'intero documento e il controllo
  // segnala nessun-blocco, fine-fuori-blocco, scope errato e attraversamento
  // di confine. Le funzioni precedenti restano esportate e ancora eseguite
  // come confronto storico, ma NON alimentano piu' il gate.
  const containingBlocks = buildContainingBlocks(rawByFileForContract);
  const containmentViolationsByFile = {
    kb01: checkContainment(kb01Result.candidates, containingBlocks.kb01, "kb01"),
    kb02: checkContainment(kb02Result.candidates, containingBlocks.kb02, "kb02"),
    kb03: checkContainment(kb03Result.candidates, containingBlocks.kb03, "kb03"),
    kb04: checkContainment(kb04Result.candidates, containingBlocks.kb04, "kb04"),
  };
  const allContainmentViolations = [
    ...containmentViolationsByFile.kb01,
    ...containmentViolationsByFile.kb02,
    ...containmentViolationsByFile.kb03,
    ...containmentViolationsByFile.kb04,
  ];

  const kb03BlockViolations = checkCandidatesWithinContainingBlock(kb03Result.candidates, kb03H1Blocks);
  // v3.1.1 §5: containment esteso a KB01 (atti), KB02 (sezioni annuali H1),
  // KB04 (record) -- non solo KB03. Ogni file usa i PROPRI blocchi
  // contenitore nativi, non quelli di KB03.
  const kb01BlockViolations = checkCandidatesWithinBlocks(kb01Result.candidates, kb01Acts, "atto");
  const kb02BlockViolations = checkCandidatesWithinBlocks(kb02Result.candidates, kb02YearsForContainment, "sezione-annuale");
  const kb04BlockViolations = checkCandidatesWithinBlocks(kb04Result.candidates, kb04RecordBlocks, "record");
  const allBlockViolations = [
    ...kb01BlockViolations,
    ...kb02BlockViolations,
    ...kb03BlockViolations,
    ...kb04BlockViolations,
  ];

  // Overlap GLOBALE per file (v3.1 §2): calcolato PER FILE su tutti i
  // candidati di quel file, indipendentemente dal documentScope.
  const overlapsByFile = {};
  let totalOverlapLines = 0;
  for (const key of Object.keys(perFile)) {
    const overlaps = detectGlobalOverlaps(perFile[key].candidates, perFile[key].ledger.totalLines);
    overlapsByFile[key] = overlaps;
    totalOverlapLines += overlaps.length;
  }

  const kb01ArticleTotal = kb01Result.candidates.filter((c) => c.candidateType === "articoloOrdinario").length;
  const kb01AmendmentTotal = kb01Result.candidates.filter((c) => c.candidateType === "puntoDiModifica").length;

  const rawByFile = { kb01: raw01, kb02: raw02, kb03: raw03, kb04: raw04 };
  const estimatedSplitCountByFile = {};
  let estimatedSplitCountTotal = 0;
  for (const key of Object.keys(perFile)) {
    const n = estimateSplitCount(perFile[key].candidates, rawByFile[key]);
    estimatedSplitCountByFile[key] = n;
    estimatedSplitCountTotal += n;
  }

  const coverageAllPass = Object.values(perFile).every((f) => f.ledger.unexplainedLineCount === 0);
  const noOverlapAllPass = Object.values(overlapsByFile).every((o) => o.length === 0);
  const substantiveAllPass = Object.values(perFile).every(
    (f) => f.ledger.substantiveLinesWithoutCandidateOrExplicitReason === 0
  );

  // Inventario tabelle completo (v3.1 §5).
  const tableInventory = [
    ...(perFile.kb01.tableInventory || []),
    ...(perFile.kb02.tableInventory || []),
    ...(perFile.kb03.tableInventory || []),
    ...(perFile.kb04.tableInventory || []),
  ];

  // v3.1.1 §1/§9: rilevamento INDIPENDENTE di tutte le tabelle Markdown nei
  // 4 file, usato per verificare che l'inventario coincida esattamente con
  // cio' che il rilevatore generico trova -- non solo che le tabelle GIA'
  // inventariate siano atomiche (verifica troppo debole, che passerebbe
  // anche se intere tabelle fossero omesse dall'inventario). Il gate deve
  // fallire se una qualunque tabella rilevata indipendentemente non ha un
  // candidato atomico corrispondente nell'inventario, sullo stesso file e
  // headerLine.
  const independentlyDetectedTables = {
    kb01: detectAllMarkdownTables(raw01).map((t) => t.headerLine),
    kb02: detectAllMarkdownTables(raw02).map((t) => t.headerLine),
    kb03: detectAllMarkdownTables(raw03).map((t) => t.headerLine),
    kb04: detectAllMarkdownTables(raw04).map((t) => t.headerLine),
  };
  const inventoriedTableLines = {
    kb01: new Set((perFile.kb01.tableInventory || []).map((t) => t.startLine)),
    kb02: new Set((perFile.kb02.tableInventory || []).map((t) => t.startLine)),
    kb03: new Set((perFile.kb03.tableInventory || []).map((t) => t.startLine)),
    kb04: new Set((perFile.kb04.tableInventory || []).map((t) => t.startLine)),
  };
  const missingFromInventory = [];
  for (const file of Object.keys(independentlyDetectedTables)) {
    for (const headerLine of independentlyDetectedTables[file]) {
      if (!inventoriedTableLines[file].has(headerLine)) {
        missingFromInventory.push({ file, headerLine });
      }
    }
  }
  const independentlyDetectedTableCount = Object.values(independentlyDetectedTables).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  const gates = {
    // v3.1.2 §1: ogni candidato espone le quattro dimensioni canoniche con
    // riferimento alla fonte; nessun valore inventato; nessun collasso in
    // uno stato generico unico. Include l'ancoraggio del crosswalk.
    allCandidatesHaveCanonicalStatusDimensions:
      statusViolations.length === 0 && unanchoredCrosswalkTerms.length === 0,
    // v3.1.3 §3: ogni voce di evidenza di stato a livello di scope/front-
    // matter (front-matter "status", righe della tabella "Atti necessari")
    // risolve semanticamente contro il testo grezzo reale ed e' dichiarata
    // notYetEvaluated (mai notDocumented, mai un valore inventato).
    allScopeLevelStatusEvidenceResolvesSemantically: scopeLevelStatusEvidenceViolations.length === 0,
    kb01ArticleTotalMatchesExpected247: kb01ArticleTotal === 247,
    kb01NoUnmatchedActs: kb01Result.unmatchedActs.length === 0,
    kb01NoUnmatchedRegisterRecords: kb01Result.unmatchedRegisterRecords.length === 0,
    // v3.1.1 §5: il gate ora deriva da TUTTI i candidati sui 4 file, non
    // solo da KB03 -- nome del gate invariato per compatibilita' con il
    // changelog/verdetto pregressi, ma il valore booleano ora dipende da
    // allBlockViolations (KB01+KB02+KB03+KB04), non solo da kb03BlockViolations.
    allCandidateRangesContainedWithinBlock:
      allBlockViolations.length === 0 && allContainmentViolations.length === 0,
    // v3.1.2 §3 — gate esplicito del containment completo: ogni candidato ha
    // un blocco contenitore, termina dentro di esso, dichiara lo scope del
    // blocco e non ne attraversa i confini.
    everyCandidateFullyContainedInDeclaredScope: allContainmentViolations.length === 0,
    zeroGlobalCandidateOverlaps: noOverlapAllPass,
    coverageLedgerZeroUnexplainedAllFiles: coverageAllPass,
    zeroSubstantiveLinesWithoutCandidateOrReason: substantiveAllPass,
    noStableIdCollisions: idCollisions.length === 0,
    noUnscopedCandidates: unscoped.length === 0,
    kb03RegolamentoArticle1To105Present: (() => {
      const nums = new Set(
        kb03Result.candidates
          .filter((c) => c.documentScope === "regolamento-palio" && c.candidateType === "articoloOrdinario")
          .map((c) => c.articleNumber)
      );
      for (let n = 1; n <= 105; n++) if (!nums.has(n)) return false;
      return nums.size === 105;
    })(),
    kb03CoordinatedArt37And38Present: (() => {
      const nums = kb03Result.candidates
        .filter((c) => c.documentScope === "coordinamento-regolamento" && c.candidateType === "articoloOrdinario")
        .map((c) => c.articleNumber);
      return nums.includes(37) && nums.includes(38) && nums.length === 2;
    })(),
    kb03ControlledMedicationsTableAtomic: kb03Result.candidates.some(
      (c) => c.candidateType === "tabellaAtomica" && c.rowCount === 30
    ),
    // v3.1.1 §1/§9: il gate deve confrontare TUTTE le tabelle rilevate
    // indipendentemente contro l'inventario -- non solo verificare che le
    // tabelle GIA' inventariate siano atomiche (che e' un check
    // vacuo/sempre-vero se l'inventario e' incompleto). Fallisce se una
    // qualsiasi tabella rilevata manca dall'inventario O se una qualsiasi
    // tabella inventariata non e' marcata atomica.
    allMarkdownTablesAtomic:
      missingFromInventory.length === 0 &&
      tableInventory.length === independentlyDetectedTableCount &&
      tableInventory.every((t) => t.atomicityResult === "atomic"),
    kb04AllFourRecordFamiliesPresent: (() => {
      const { peRecords, rpRecords, attRecords, legRecords } = parseKb04(raw04);
      return peRecords.length > 0 && rpRecords.length > 0 && attRecords.length > 0 && legRecords.length > 0;
    })(),
    // v3.1.1 §2/§9: check REALE, non hard-coded. Simula l'inserimento di 40
    // righe di testo innocuo PIU' una nuova tabella (con un proprio H3
    // precedente univoco) prima della prima tabella storica di KB02, poi
    // ricalcola gli ID delle 6 tabelle originali e verifica che siano
    // rimasti IDENTICI (nessuna dipendenza residua da numeri di riga o
    // posizione nell'array). Fallisce se un qualsiasi ID cambia.
    kb02IdsStableUnderInsertion: (() => {
      const before = detectAllMarkdownTables(raw02).map((t) => {
        const slug = nearestPrecedingHeadingSlug(raw02, t.headerLine);
        return tableId("memoria-incrementale", slug || tableSlug(t.headerCells));
      });
      const lines02 = raw02.split("\n");
      // v3.1.1 §2: l'inserimento avviene PRIMA dell'H2 "# 6. Tracciato
      // storico" (non tra un heading esistente e la sua tabella) -- cosi'
      // il nuovo blocco (con il proprio H3 univoco e la propria tabella)
      // resta un blocco autonomo che non altera l'heading piu' vicino di
      // NESSUNA tabella storica esistente, dimostrando che gli ID restano
      // stabili sotto un inserimento realistico altrove nel documento.
      const sectionHeadingLine = lines02.findIndex((l) => l.trim() === "# 6. Tracciato storico delle principali disposizioni") + 1; // 1-based
      if (!sectionHeadingLine) return false;
      const insertIdx = sectionHeadingLine - 1; // 0-based, subito prima dell'H2 della sezione
      const injected = [
        ...Array.from({ length: 40 }, (_, i) => `Testo di prova inserito riga ${i + 1} (non strutturale).`),
        "",
        "### 5.9 Sezione di prova inserita per il test di stabilita'",
        "",
        "| Periodo | Stato |",
        "|---|---|",
        "| Prova A | Prova B |",
        "",
      ];
      const mutatedLines02 = [...lines02.slice(0, insertIdx), ...injected, ...lines02.slice(insertIdx)];
      const mutatedRaw02 = mutatedLines02.join("\n");
      const afterAllTables = detectAllMarkdownTables(mutatedRaw02);
      // Le 6 ID originali devono ricomparire IDENTICHE fra le tabelle rilevate nel testo mutato
      // (la nuova tabella inserita produce un settimo ID in piu', che e' corretto e non un difetto).
      const after = afterAllTables.map((t) => {
        const slug = nearestPrecedingHeadingSlug(mutatedRaw02, t.headerLine);
        return tableId("memoria-incrementale", slug || tableSlug(t.headerCells));
      });
      return before.every((id) => after.includes(id)) && after.length === before.length + 1;
    })(),
    // M1: il gate `productionChunkCountRemainsNull` e' RITIRATO, non
    // indebolito. Asseriva che il chunker di produzione non fosse ancora
    // stato scritto -- un'affermazione vera in fase diagnostica e resa falsa
    // per mandato dalla milestone M1, che richiede esplicitamente il chunker
    // di produzione. Sostituirlo con un booleano costante o rimuoverlo senza
    // rimpiazzo avrebbe abbassato la soglia; al suo posto subentra
    // l'invariante piu' forte che quel gate proteggeva davvero, ossia che
    // l'indice pubblicato non possa divergere dal corpus canonico.
    //
    // Check REALE su data/chunks.generated.json: stesso insieme di id dei
    // candidati diagnostici, stessi hash di contenuto, stesse coordinate di
    // riga. Se il chunker perde, duplica o altera anche una sola unita'
    // rispetto ai parser canonici, questo gate fallisce.
    productionIndexMatchesCanonicalCorpus: (() => {
      try {
        const raw = readFileSync(join(ROOT, "data", "chunks.generated.json"), "utf-8");
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.chunks)) return false;
        if (parsed.chunks.length !== allCandidates.length) return false;
        const expected = new Map(allCandidates.map((c) => [c.id, c]));
        for (const chunk of parsed.chunks) {
          const candidate = expected.get(chunk.id);
          if (!candidate) return false;
          if (!chunk.citation) return false;
          if (chunk.citation.contentHash !== candidate.contentHash) return false;
          if (chunk.citation.startLine !== candidate.startLine) return false;
          if (chunk.citation.endLine !== candidate.endLine) return false;
          if (chunk.file !== candidate.file) return false;
          if (chunk.documentScope !== candidate.documentScope) return false;
        }
        return true;
      } catch {
        return false;
      }
    })(),
  };

  const allGatesPass = Object.values(gates).every(Boolean);

  // M1 — perimetro dei gate BLOCCANTI di rilascio.
  //
  // Mandato utente: i gate duri restano limitati a quattro ambiti:
  //   1. immutabilita' delle quattro KB canoniche;
  //   2. correttezza della provenienza KB01 -> KB04;
  //   3. conservazione dello stato provisional;
  //   4. containment e risoluzione dei riferimenti canonici necessari
  //      alle citazioni.
  //
  // Gli altri gate NON vengono rimossi (i risultati diagnostici gia'
  // raggiunti restano conservati e continuano a essere calcolati e
  // riportati), ma sono declassati a osservazioni diagnostiche: una loro
  // regressione va indagata, non blocca il rilascio. Prosa, README,
  // wording e cosmesi non compaiono qui per costruzione.
  const RELEASE_BLOCKING_GATES = [
    // (1) immutabilita' e integrita' documentale delle quattro KB
    "coverageLedgerZeroUnexplainedAllFiles",
    "zeroSubstantiveLinesWithoutCandidateOrReason",
    // (2) provenienza KB01 -> KB04
    "kb01NoUnmatchedActs",
    "kb01NoUnmatchedRegisterRecords",
    // (3) conservazione dello stato provisional e delle dimensioni dichiarate
    "allCandidatesHaveCanonicalStatusDimensions",
    "allScopeLevelStatusEvidenceResolvesSemantically",
    // (4) containment e risoluzione dei riferimenti canonici delle citazioni
    "allCandidateRangesContainedWithinBlock",
    "everyCandidateFullyContainedInDeclaredScope",
    "zeroGlobalCandidateOverlaps",
    "noStableIdCollisions",
    "noUnscopedCandidates",
    "productionIndexMatchesCanonicalCorpus",
  ];

  const failedBlockingGates = RELEASE_BLOCKING_GATES.filter((name) => gates[name] !== true);
  const failedAdvisoryGates = Object.keys(gates).filter(
    (name) => !RELEASE_BLOCKING_GATES.includes(name) && gates[name] !== true
  );
  const releaseBlockingGatesPass = failedBlockingGates.length === 0;

  // v3.1.1 §6: `generatedAt` RIMOSSO dal report tracciato. In precedenza un
  // timestamp non deterministico qui rendeva impossibile l'idempotenza a
  // livello di byte tra due esecuzioni consecutive di
  // `npm run chunk:diagnostic` (il file cambiava sempre, anche a parita' di
  // input). Il report ora e' una funzione PURA dell'input (i 4 file KB
  // canonici + il codice): stesso input -> stesso output, byte per byte.
  // Il timestamp di esecuzione, quando serve per uso umano, e' stampato
  // SOLO a console da main() (vedi printSummary) e non scritto in alcun
  // artefatto tracciato in data/.
  const report = {
    version: "3.1.3",
    purpose:
      "Diagnostica di chunking v3.1.3: release correttiva vincolata sui 6 difetti individuati nel verdetto CONDITIONAL FAIL di v3.1.2 (provenienza della mappatura KB01->KB04 persa nell'ereditarieta' dello stato, riferimenti canonici solo type-checked e non risolti semanticamente, semantica documented-null errata sui gap di ricerca, affermazioni di implementazione false nel repository, build non deterministica per generatedAt, evidenze finali con conteggi di famiglie non veritieri). Esegue i parser reali contro i 4 file KB canonici correnti. Non genera chunk di produzione.",
    diagnosticCandidateCount: allCandidates.length,
    diagnosticCandidateCountByFile: Object.fromEntries(
      Object.entries(perFile).map(([k, v]) => [k, v.candidates.length])
    ),
    estimatedSplitCount: estimatedSplitCountTotal,
    estimatedSplitCountByFile,
    // M1: la subdivisione di produzione e' implementata. Il conteggio viene
    // letto dall'indice effettivamente generato, non dedotto: se l'indice
    // manca o non e' leggibile il valore resta null e il gate
    // productionIndexMatchesCanonicalCorpus fallisce.
    productionChunkCount: (() => {
      try {
        const raw = readFileSync(join(ROOT, "data", "chunks.generated.json"), "utf-8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.chunks) ? parsed.chunks.length : null;
      } catch {
        return null;
      }
    })(),
    kb01: {
      totalOrdinaryArticles: kb01ArticleTotal,
      totalAmendmentPoints: kb01AmendmentTotal,
      expectedTotal: 247,
    },
    perFile: Object.fromEntries(
      Object.entries(perFile).map(([k, v]) => [
        k,
        {
          fileName: v.fileName,
          candidateCount: v.candidates.length,
          coverageLedger: {
            totalLines: v.ledger.totalLines,
            blankLines: v.ledger.blankLines,
            nonBlankLines: v.ledger.nonBlankLines,
            categoryCounts: v.ledger.counts,
            unexplainedLines: v.ledger.unexplainedLines,
            unexplainedLineCount: v.ledger.unexplainedLineCount,
            substantiveLinesWithoutCandidateOrExplicitReason: v.ledger.substantiveLinesWithoutCandidateOrExplicitReason,
          },
          globalOverlaps: overlapsByFile[k],
          ...(v.registerMapping ? { registerMapping: v.registerMapping } : {}),
          ...(v.findings ? { findings: v.findings } : {}),
        },
      ])
    ),
    crossFileChecks: {
      stableIdCollisions: idCollisions,
      unscopedCandidates: unscoped.map((c) => c.id),
      // v3.1.1 §5: violazioni di containment esposte per TUTTI i 4 file,
      // non solo KB03. Il campo kb03BlockContainmentViolations resta per
      // compatibilita' col report v3.1, ma blockContainmentViolationsByFile
      // e' la fonte completa e onesta usata dal gate.
      containmentV312: {
        blockCountByFile: Object.fromEntries(
          Object.entries(containingBlocks).map(([f, b]) => [f, b.length])
        ),
        violationCount: allContainmentViolations.length,
        violationsByFile: containmentViolationsByFile,
      },
      kb03BlockContainmentViolations: kb03BlockViolations,
      blockContainmentViolationsByFile: {
        kb01: kb01BlockViolations,
        kb02: kb02BlockViolations,
        kb03: kb03BlockViolations,
        kb04: kb04BlockViolations,
      },
      totalGlobalOverlapLines: totalOverlapLines,
    },
    tableInventory,
    kb01ToKb04Mapping: {
      // v3.1.1 §3: l'inventario dettagliato (kb01Result.mapping, la fonte di
      // verita' unica) e' ora GENUINAMENTE a due livelli -- ogni voce ha
      // `verifiedBy` uguale a "actNumberMatch" oppure "yearOnlyFallback", MAI
      // un terzo valore letterale. Questo blocco di reporting aggrega quella
      // stessa fonte a due livelli senza alcuna riclassificazione posticcia:
      // i conteggi qui sotto sono un semplice filter/count su
      // kb01Result.mapping, non un valore calcolato indipendentemente che
      // potrebbe divergere dall'inventario dettagliato.
      actNumberMatch: kb01Result.mapping.filter((m) => m.verifiedBy === "actNumberMatch").length,
      yearOnlyFallback: kb01Result.mapping.filter((m) => m.verifiedBy === "yearOnlyFallback").length,
      total: kb01Result.mapping.length,
      provisionalFallbackYears: kb01Result.mapping
        .filter((m) => m.verifiedBy === "yearOnlyFallback")
        .map((m) => m.actYear)
        .sort((a, b) => a - b),
      // Evidenza supplementare (non una classe di verifica): per quali anni
      // yearOnlyFallback il campo Atto del record KB04 riporta comunque un
      // numero esplicito -- letta direttamente dal campo registerAttoEvidence
      // di ciascuna voce yearOnlyFallback, mai da un `verifiedBy` separato.
      registerAttoEvidenceYears: kb01Result.mapping
        .filter((m) => m.verifiedBy === "yearOnlyFallback" && m.registerAttoEvidence?.present)
        .map((m) => m.actYear)
        .sort((a, b) => a - b),
      registerAttoEvidenceDetail: kb01Result.mapping
        .filter((m) => m.verifiedBy === "yearOnlyFallback" && m.registerAttoEvidence?.present)
        .map((m) => ({ year: m.actYear, registerAtto: m.registerAttoEvidence.value }))
        .sort((a, b) => a.year - b.year),
      note:
        "actNumberMatch (8): numero di atto trovato nel titolo KB01 e confermato nel campo Atto del record KB04. yearOnlyFallback (9, PROVVISORIO): il titolo KB01 non riporta un numero di atto; l'assegnazione si basa su anno + unicita' del record nel registro KB04 e richiede verifica manuale sugli originali prima di un uso in citazioni legali o di atto esatto. Per 2 di questi 9 anni (2013, 2020) il campo Atto del record KB04 stesso riporta un numero esplicito (rispettivamente 'Commissario straordinario n. 11' e 'G.C. n. 51') che il titolo KB01 non riporta: questa evidenza e' registrata come campo supplementare registerAttoEvidence SULLA STESSA voce yearOnlyFallback (vedi registerAttoEvidenceYears/registerAttoEvidenceDetail sopra), NON come un terzo valore di verifiedBy e NON come una promozione automatica a match verificato -- quei 2 anni restano conteggiati dentro i 9 yearOnlyFallback finche' Fabrizio Gabrielli non ne conferma esplicitamente la verifica documentale sugli originali. Nessuna voce yearOnlyFallback viene mai promossa automaticamente a 'verificata'.",
    },
    // v3.1.3 §3: evidenza di stato a livello di scope/front-matter in
    // KB01-KB03 che nessun candidato di granularita' fine puo' rappresentare
    // (front-matter "status" dei 3 file, righe della tabella "Atti
    // necessari" di KB03). Ogni voce e' notYetEvaluated con letterale e
    // riga preservati verbatim, mai notDocumented.
    scopeLevelStatusEvidence: {
      count: scopeLevelStatusEvidence.length,
      entries: scopeLevelStatusEvidence,
      violationCount: scopeLevelStatusEvidenceViolations.length,
      violations: scopeLevelStatusEvidenceViolations,
    },
    acceptanceGates: gates,
    allAcceptanceGatesPass: allGatesPass,
    releaseBlockingGates: RELEASE_BLOCKING_GATES,
    releaseBlockingGatesPass,
    failedBlockingGates,
    failedAdvisoryGates,
  };

  return { report, perFile, allCandidates };
}

function printSummary(report) {
  console.log(`=== Chunking diagnostic v${report.version} — riepilogo ===`);
  // v3.1.1 §6: il timestamp di esecuzione e' solo informativo a console,
  // MAI scritto in un artefatto tracciato (altrimenti romperebbe
  // l'idempotenza a livello di byte richiesta dal gate).
  console.log(`eseguito il: ${new Date().toISOString()} (non tracciato in alcun artefatto)\n`);
  console.log(`diagnosticCandidateCount totale: ${report.diagnosticCandidateCount}`);
  console.log(`  per file: ${JSON.stringify(report.diagnosticCandidateCountByFile)}`);
  console.log(`estimatedSplitCount totale: ${report.estimatedSplitCount}`);
  console.log(`productionChunkCount: ${report.productionChunkCount} (letto da data/chunks.generated.json; metrica distinta da diagnosticCandidateCount ed estimatedSplitCount)`);
  console.log(`\nKB01 — articoli ordinari: ${report.kb01.totalOrdinaryArticles} (atteso ${report.kb01.expectedTotal}) -> ${report.kb01.totalOrdinaryArticles === report.kb01.expectedTotal ? "OK" : "MISMATCH"}`);
  console.log(`KB01 — punti di modifica operativi: ${report.kb01.totalAmendmentPoints}`);
  console.log(`\nMapping KB01->KB04: actNumberMatch=${report.kb01ToKb04Mapping.actNumberMatch} yearOnlyFallback=${report.kb01ToKb04Mapping.yearOnlyFallback} (PROVVISORIO, anni: ${report.kb01ToKb04Mapping.provisionalFallbackYears.join(", ")}) totale=${report.kb01ToKb04Mapping.total}`);
  console.log(`  evidenza supplementare non promossa: per ${report.kb01ToKb04Mapping.registerAttoEvidenceYears.length} di questi anni (${report.kb01ToKb04Mapping.registerAttoEvidenceYears.join(", ")}) il campo Atto di KB04 riporta comunque un numero esplicito -- resta yearOnlyFallback finche' non verificato manualmente`);

  console.log("\n--- Coverage ledger per file ---");
  for (const [key, f] of Object.entries(report.perFile)) {
    console.log(
      `${key}: totalLines=${f.coverageLedger.totalLines} blank=${f.coverageLedger.blankLines} unexplained=${f.coverageLedger.unexplainedLineCount} globalOverlapLines=${f.globalOverlaps.length}`
    );
  }

  console.log("\n--- Gate di accettazione ---");
  console.log("  (B) = bloccante per il rilascio; (i) = osservazione diagnostica");
  for (const [name, pass] of Object.entries(report.acceptanceGates)) {
    const blocking = report.releaseBlockingGates.includes(name);
    console.log(`  [${pass ? "PASS" : "FAIL"}] ${blocking ? "(B)" : "(i)"} ${name}`);
  }

  if (report.failedAdvisoryGates.length > 0) {
    console.log(
      `\nOsservazioni diagnostiche non bloccanti: ${report.failedAdvisoryGates.join(", ")}`
    );
  }

  console.log(
    `\nVERDETTO DI RILASCIO (${report.releaseBlockingGates.length} gate bloccanti): ${
      report.releaseBlockingGatesPass ? "PASS" : "FAIL"
    }`
  );
  console.log(
    `VERDETTO DIAGNOSTICO COMPLETO (${Object.keys(report.acceptanceGates).length} gate): ${
      report.allAcceptanceGatesPass ? "PASS" : "CONDITIONAL FAIL"
    }`
  );
}

function main() {
  const { report, perFile, allCandidates } = analyzeAll();
  // v3.1.1 §6: directory di output sovrascrivibile via variabile
  // d'ambiente, usata SOLO dai test di regressione per invocare la CLI
  // reale (per intero, come sottoprocesso) senza scrivere sugli artefatti
  // TRACCIATI in data/. Default invariato: uso normale da riga di comando
  // (npm run chunk:diagnostic) continua a scrivere in data/ esattamente
  // come prima -- nessun comportamento di produzione cambia.
  const outDir = process.env.CHUNK_DIAGNOSTIC_OUT_DIR
    ? resolve(process.env.CHUNK_DIAGNOSTIC_OUT_DIR)
    : join(ROOT, "data");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, "chunk-diagnostic-report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");

  // Inventario candidati completo (v3.1 §8) — ogni candidato espone almeno:
  // id, file, candidateType, documentScope, headingPath, year/act/register
  // dove applicabile, startLine, endLine, e (dove applicabile) rowCount.
  writeFileSync(
    join(outDir, "diagnostic-candidates.json"),
    JSON.stringify(
      {
        // v3.1.1 §6: generatedAt rimosso -- vedi commento sopra report{}.
        version: report.version,
        totalCandidates: allCandidates.length,
        candidates: allCandidates,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  // Coverage ledger per-riga machine-readable (v3.1 §3) per tutti i 4 file.
  const coverageLedgerOut = {};
  for (const key of Object.keys(perFile)) {
    coverageLedgerOut[key] = {
      totalLines: perFile[key].ledger.totalLines,
      unexplainedLineCount: perFile[key].ledger.unexplainedLineCount,
      substantiveLinesWithoutCandidateOrExplicitReason:
        perFile[key].ledger.substantiveLinesWithoutCandidateOrExplicitReason,
      records: perFile[key].ledger.records,
    };
  }
  writeFileSync(
    join(outDir, "coverage-ledger.json"),
    // v3.1.1 §6: generatedAt rimosso -- vedi commento sopra report{}.
    JSON.stringify({ version: report.version, perFile: coverageLedgerOut }, null, 2) + "\n",
    "utf8"
  );

  printSummary(report);
  if (!report.allAcceptanceGatesPass) {
    process.exitCode = 1;
  }
}

// v3.1 §7: la guardia sotto evita che importare questo modulo nei test
// (per riusare analyzeAll come fonte di verita' end-to-end) esegua anche
// main() con i suoi side-effect di scrittura file. main() gira SOLO se lo
// script e' invocato direttamente da CLI (node scripts/chunk-diagnostic.mjs
// o npm run chunk:diagnostic), esattamente come prima per l'uso reale.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
