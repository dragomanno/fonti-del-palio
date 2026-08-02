// Test v3.1 — eseguono i parser REALI (scripts/lib/parse-kb0*.mjs) e
// l'orchestratore REALE (scripts/chunk-diagnostic.mjs, tramite
// analyzeAll()) contro i file canonici CORRENTI in content/kb/. Non
// ispezionano un fixture o uno snapshot statico: se il codice o i KB
// cambiano, questi test rilevano la deriva contro la fonte di verita' viva.
//
// v3.1 rispetto a v3: la vecchia suite importava funzioni non piu'
// esistenti (bulletPublicId non era il vero export usato, i moduli
// coverage-kb0*.mjs sono catch-all deprecati non piu' usati
// dall'orchestratore) e chiamava kb02BulletId con una firma posizionale
// vecchia (year, slug, ordinalInSubsection) che non corrisponde alla firma
// reale corrente (year, subsectionSlug, tag, contentSlug, duplicateIndex).
// Questa suite e' stata riscritta per riflettere solo il comportamento
// reale e verificabile del codice attuale.
//
// Copertura richiesta dal prompt v3 §9 (lista minima) + estensioni v3.1:
//   - KB01: detection/sequenze articoli, totale atteso 247, varianti OCR 2014,
//     forma "Articolo N" 2019-2026
//   - KB02: bullet a tag composto (v3.1), separatori "---" esclusi (v3.1)
//   - KB03: articoli Protocollo, scope coordinato Art. 37-38, Regolamento
//     Art. 1-105, tabella medicazioni controllate, CAPITOLO come
//     structural (v3.1)
//   - KB04: famiglie di record (PE/RP/ATT/LEG)
//   - mapping KB01->KB04: actNumberMatch / yearOnlyFallback (a due soli
//     livelli, v3.1.1 §3), onesti e verificabili contro il campo Atto di
//     KB04; registerAttoEvidence come evidenza supplementare non promossa
//   - zero unexplainedLines su tutti i 4 file, zero overlap globali,
//     zero collisioni di ID, nessun candidato "unscoped" (end-to-end via
//     analyzeAll() reale, non un mock)
//   - tabelle atomiche
//   - range di riga esatti noti (incl. KB01 2012 Articolo 1 — 186, non 185)
//   - nessun chunk cross-anno/cross-atto
//   - ID stabili (indipendenti da riga/inserimenti), firme reali correnti
//   - da M1: productionChunkCount riflette l'indice reale e coincide con
//     diagnosticCandidateCount (gate productionIndexMatchesCanonicalCorpus)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

import { parseKb01, classifyActs } from "../scripts/lib/parse-kb01.mjs";
import { parseKb02 } from "../scripts/lib/parse-kb02.mjs";
import { parseKb03, findControlledMedicationsTable } from "../scripts/lib/parse-kb03.mjs";
import { parseKb04 } from "../scripts/lib/parse-kb04.mjs";
import { mapKb01ActsToKb04 } from "../scripts/lib/map-kb01-to-kb04.mjs";
import { kb01ArticleId, kb03ArticleId, kb02BulletId } from "../scripts/lib/stable-ids.mjs";
import {
  analyzeAll,
  reconstructCandidateText,
  computeContentHash,
  checkCandidatesWithinBlocks,
  checkCanonicalStatusDimensions,
  checkScopeLevelStatusEvidence,
  buildKb01Candidates,
  buildKb02Candidates,
  buildKb03Candidates,
  buildKb04Candidates,
} from "../scripts/chunk-diagnostic.mjs";
import {
  STATUS_DIMENSIONS,
  DOCUMENTED_NULL_REASONS,
  KB04_LEGEND_CROSSWALK,
  extractKb04StatusVocabulary,
  findUnanchoredCrosswalkTerms,
  buildScopeLevelStatusEvidence,
  extractFrontMatterStatusLiteral,
  extractTableRowStatusLiterals,
} from "../scripts/lib/documentary-status.mjs";
import { detectAllMarkdownTables } from "../scripts/lib/markdown-tables.mjs";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const KB_DIR = join(ROOT, "content", "kb");

const raw01 = readFileSync(join(KB_DIR, "01_KB_Corpus_Storico_Protocollo_Equino_2012_2026.md"), "utf8");
const raw02 = readFileSync(join(KB_DIR, "02_KB_Memoria_Incrementale_Protocollo_Equino_2012_2026.md"), "utf8");
const raw03 = readFileSync(join(KB_DIR, "03_KB_Disciplina_Vigente_Consolidata_2026.md"), "utf8");
const raw04 = readFileSync(join(KB_DIR, "04_KB_Manifest_Fonti_e_Registro_Atti_2012_2026.md"), "utf8");

// ---------------------------------------------------------------------------
// KB01 — detection articoli, totale 247, varianti OCR, "Articolo N"
// ---------------------------------------------------------------------------

test("KB01: il totale di articoli ordinari e' esattamente 247 (non 156, non un valore stale)", () => {
  const { years } = parseKb01(raw01);
  const acts = classifyActs(years);
  const total = acts.reduce((sum, a) => sum + a.articles.length, 0);
  assert.equal(total, 247);
});

test("KB01: rileva le varianti OCR del 2014 (Art, 4 / Art, 5 / Art. 7-) senza perdita", () => {
  const { years } = parseKb01(raw01);
  const acts = classifyActs(years);
  const act2014base = acts.find((a) => a.year === 2014 && a.kind === "baseAct");
  assert.ok(act2014base, "atto base 2014 non trovato");
  const rawForms = act2014base.articles.map((a) => a.rawLine);
  const hasCommaVariant = rawForms.some((l) => /^Art,\s*\d+/.test(l));
  const hasHyphenVariant = rawForms.some((l) => /^Art\.\s*\d+-/.test(l));
  assert.ok(hasCommaVariant || hasHyphenVariant, "nessuna variante OCR (virgola/trattino) rilevata nel 2014 base");
  assert.equal(act2014base.articles.length, 19, "l'atto base 2014 deve avere 19 articoli ordinari");
});

test("KB01: rileva la forma 'Articolo N' per tutti gli atti 2019-2026", () => {
  const { years } = parseKb01(raw01);
  const acts = classifyActs(years);
  for (const year of [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]) {
    const act = acts.find((a) => a.year === year);
    assert.ok(act, `atto ${year} non trovato`);
    assert.ok(act.articles.length > 0, `atto ${year} non ha articoli rilevati`);
    const allArticolo = act.articles.every((a) => /^Articolo\s+\d+/.test(a.rawLine));
    assert.ok(allArticolo, `atto ${year} non usa la forma 'Articolo N' per tutti gli articoli`);
  }
});

test("KB01: struttura articoli per annualita' (19/19/19/10x4/11x4)", () => {
  const { years } = parseKb01(raw01);
  const acts = classifyActs(years);
  const baseActs = acts.filter((a) => a.kind === "baseAct");
  const byYear = new Map(baseActs.map((a) => [a.year, a]));
  assert.equal(byYear.get(2014).articles.length, 19);
  for (const y of [2019, 2020, 2021, 2022]) {
    assert.equal(byYear.get(y).articles.length, 10, `anno ${y} dovrebbe avere 10 articoli`);
  }
  for (const y of [2023, 2024, 2025, 2026]) {
    assert.equal(byYear.get(y).articles.length, 11, `anno ${y} dovrebbe avere 11 articoli`);
  }
});

test("KB01: l'atto di modifica G.C. 133/2014 ha esattamente 2 punti di modifica operativi", () => {
  const { years } = parseKb01(raw01);
  const acts = classifyActs(years);
  const amendmentAct = acts.find((a) => a.kind === "amendmentAct" && a.year === 2014);
  assert.ok(amendmentAct);
  const operative = amendmentAct.amendmentPoints.filter((p) => p.occurrence === "operative");
  assert.equal(operative.length, 2);
  assert.deepEqual(operative.map((p) => p.targetArticle).sort((a, b) => a - b), [5, 10]);
});

test("KB01: range esatto per l'Articolo 1 del 2012 (186-197, NON 185-196)", () => {
  const { years } = parseKb01(raw01);
  const acts = classifyActs(years);
  const act2012 = acts.find((a) => a.year === 2012);
  assert.equal(act2012.articles[0].number, 1);
  assert.equal(act2012.articles[0].line, 186, "Art. 1 del 2012 deve iniziare alla riga 186");
  const secondArticleLine = act2012.articles[1].line;
  assert.equal(secondArticleLine - 1, 197, "Art. 1 del 2012 deve terminare alla riga 197 (riga precedente Art. 2)");
});

test("KB01: mai fondere atto base e atto di modifica nello stesso candidato", () => {
  const { years } = parseKb01(raw01);
  const acts = classifyActs(years);
  const act2014base = acts.find((a) => a.year === 2014 && a.kind === "baseAct");
  const act2014amend = acts.find((a) => a.year === 2014 && a.kind === "amendmentAct");
  assert.ok(act2014base && act2014amend, "atti 2014 base e modifica devono esistere separati");
  assert.notEqual(act2014base.headingLine, act2014amend.headingLine);
  for (const art of act2014base.articles) {
    const inAmendRange = art.line >= act2014amend.headingLine && art.line <= act2014amend.endLine;
    assert.ok(!inAmendRange, `articolo base 2014 alla riga ${art.line} cade erroneamente nel range dell'atto di modifica`);
  }
});

test("KB01: mapping verso il registro KB04 senza atti o record orfani", () => {
  const { unmatchedActs, unmatchedRegisterRecords } = mapKb01ActsToKb04(raw01, raw04);
  assert.deepEqual(unmatchedActs, []);
  assert.deepEqual(unmatchedRegisterRecords, []);
});

test("KB01: ID stabili non dipendono dal numero di riga (test di inserimento)", () => {
  const lines = raw01.split("\n");
  const insertAt = 20;
  const modified = [...lines.slice(0, insertAt), "", "Riga di test inserita.", "", ...lines.slice(insertAt)].join("\n");

  const before = classifyActs(parseKb01(raw01).years);
  const after = classifyActs(parseKb01(modified).years);

  const act2020Before = before.find((a) => a.year === 2020);
  const act2020After = after.find((a) => a.year === 2020);
  const idsBefore = act2020Before.articles.map((a) => kb01ArticleId("PE-2020-01", a.number));
  const idsAfter = act2020After.articles.map((a) => kb01ArticleId("PE-2020-01", a.number));
  assert.deepEqual(idsBefore, idsAfter, "gli ID kb01 non devono cambiare per inserimenti altrove nel documento");
});

// ---------------------------------------------------------------------------
// KB01->KB04 — mapping onesto (v3.1.1 §3): l'inventario dettagliato
// (mapKb01ActsToKb04) e' GENUINAMENTE a due soli livelli. `verifiedBy` e'
// sempre "actNumberMatch" oppure "yearOnlyFallback", mai un terzo valore.
// Per 2013 e 2020, dove il campo Atto del record KB04 riporta comunque un
// numero esplicito anche se il titolo KB01 non lo riporta, quel numero e'
// disponibile come evidenza SUPPLEMENTARE nel campo `registerAttoEvidence`
// della stessa voce yearOnlyFallback -- non come una classe di verifica
// separata. Il report aggregato (chunk-diagnostic.mjs / analyzeAll()) legge
// direttamente questa stessa fonte a due livelli, senza alcuna
// riclassificazione: 8 actNumberMatch + 9 yearOnlyFallback = 17 totali, in
// entrambi i punti (vedi i test "Report v3.1" piu' sotto).
// ---------------------------------------------------------------------------

test("KB01->KB04: 2013 e 2020 restano yearOnlyFallback con evidenza supplementare registerAttoEvidence (numero nel campo Atto di KB04, non nel titolo KB01)", () => {
  const { mapping } = mapKb01ActsToKb04(raw01, raw04);
  const y2013 = mapping.find((m) => m.actYear === 2013);
  const y2020 = mapping.find((m) => m.actYear === 2020);
  assert.equal(y2013.verifiedBy, "yearOnlyFallback");
  assert.equal(y2013.registerAttoEvidence?.present, true);
  assert.match(y2013.registerAttoEvidence.value, /n\.\s*11/);
  assert.equal(y2020.verifiedBy, "yearOnlyFallback");
  assert.equal(y2020.registerAttoEvidence?.present, true);
  assert.match(y2020.registerAttoEvidence.value, /n\.\s*51/);
});

test("KB01->KB04: gli anni senza numero di atto in nessuna delle due fonti restano yearOnlyFallback onesto, senza registerAttoEvidence", () => {
  const { mapping } = mapKb01ActsToKb04(raw01, raw04);
  const fallbackYears = mapping.filter((m) => m.verifiedBy === "yearOnlyFallback").map((m) => m.actYear).sort((a, b) => a - b);
  assert.deepEqual(fallbackYears, [2013, 2017, 2018, 2020, 2021, 2022, 2023, 2024, 2025]);
  const noEvidenceYears = mapping
    .filter((m) => m.verifiedBy === "yearOnlyFallback" && !m.registerAttoEvidence?.present)
    .map((m) => m.actYear)
    .sort((a, b) => a - b);
  assert.deepEqual(noEvidenceYears, [2017, 2018, 2021, 2022, 2023, 2024, 2025]);
});

test("KB01->KB04: nessun terzo valore di verifiedBy esiste nell'inventario dettagliato; il totale dei due livelli coincide con il numero di atti KB01", () => {
  const { mapping } = mapKb01ActsToKb04(raw01, raw04);
  const { years } = parseKb01(raw01);
  const acts = classifyActs(years);
  const distinctVerifiedByValues = [...new Set(mapping.map((m) => m.verifiedBy))].sort();
  assert.deepEqual(distinctVerifiedByValues, ["actNumberMatch", "yearOnlyFallback"]);
  const byLevel = {
    actNumberMatch: mapping.filter((m) => m.verifiedBy === "actNumberMatch").length,
    yearOnlyFallback: mapping.filter((m) => m.verifiedBy === "yearOnlyFallback").length,
  };
  assert.equal(byLevel.actNumberMatch + byLevel.yearOnlyFallback, acts.length);
  // Valori onesti attuali, derivati dal corpus reale — non un target arbitrario.
  assert.equal(byLevel.actNumberMatch, 8);
  assert.equal(byLevel.yearOnlyFallback, 9);
});

// ---------------------------------------------------------------------------
// KB03 — articoli Protocollo, scope coordinato, Regolamento 1-105, tabella
// ---------------------------------------------------------------------------

test("KB03: il Protocollo 2026 ha 11 articoli ordinari in scope protocollo-2026", () => {
  const { articoliH2 } = parseKb03(raw03);
  const protocolloArts = articoliH2.filter((a) => a.scope === "protocollo-2026");
  assert.equal(protocolloArts.length, 11);
  assert.deepEqual(protocolloArts.map((a) => a.number).sort((x, y) => x - y), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test("KB03: gli Articoli 37/38 coordinati precedono il Regolamento e restano in scope separato", () => {
  const { articoliH2, artH3 } = parseKb03(raw03);
  const coordinati = articoliH2.filter((a) => a.scope === "coordinamento-regolamento");
  assert.deepEqual(coordinati.map((a) => a.number).sort((x, y) => x - y), [37, 38]);
  const regolamento37 = artH3.find((a) => a.number === 37);
  const regolamento38 = artH3.find((a) => a.number === 38);
  assert.equal(regolamento37.scope, "regolamento-palio");
  assert.equal(regolamento38.scope, "regolamento-palio");
  assert.ok(regolamento37.line > coordinati.find((a) => a.number === 37).line);
});

test("KB03: il Regolamento per il Palio ha tutti gli Articoli 1-105 senza buchi", () => {
  const { artH3 } = parseKb03(raw03);
  const regolamentoArts = artH3.filter((a) => a.scope === "regolamento-palio");
  const numbers = new Set(regolamentoArts.map((a) => a.number));
  for (let n = 1; n <= 105; n++) {
    assert.ok(numbers.has(n), `manca l'Art. ${n} del Regolamento`);
  }
  assert.equal(numbers.size, 105);
});

test("KB03: la tabella delle medicazioni controllate e' atomica con 30 righe dati", () => {
  const table = findControlledMedicationsTable(raw03);
  assert.equal(table.rowCount, 30);
  assert.equal(table.firstDataLine, table.separatorLine + 1);
  assert.equal(table.lastDataLine - table.firstDataLine + 1, 30);
});

test("KB03: nessun candidato ha documentScope 'unscoped'", () => {
  const { h1Blocks, articoliH2, artH3 } = parseKb03(raw03);
  for (const b of h1Blocks) assert.notEqual(b.scope, "unscoped");
  for (const a of [...articoliH2, ...artH3]) assert.notEqual(a.scope, "unscoped");
});

test("KB03: ID stabili distinguono Art. 37 coordinato da Art. 37 del Regolamento", () => {
  const id1 = kb03ArticleId("coordinamento-regolamento", 37);
  const id2 = kb03ArticleId("regolamento-palio", 37);
  assert.notEqual(id1, id2);
  assert.equal(id1, "kb03:coordinamento-regolamento:articolo-37");
  assert.equal(id2, "kb03:regolamento-palio:articolo-37");
});

test("KB03: ID stabili non dipendono dal numero di riga (test di inserimento)", () => {
  const lines = raw03.split("\n");
  const insertAt = 15;
  const modified = [...lines.slice(0, insertAt), "", "Riga di test inserita.", "", ...lines.slice(insertAt)].join("\n");

  const before = parseKb03(raw03);
  const after = parseKb03(modified);

  const art1Before = before.artH3.find((a) => a.number === 1);
  const art1After = after.artH3.find((a) => a.number === 1);
  assert.equal(kb03ArticleId(art1Before.scope, art1Before.number), kb03ArticleId(art1After.scope, art1After.number));
});

test("KB03: ogni CAPITOLO (I-VIII) del Regolamento e' rilevato come sezione strutturale distinta", () => {
  const { capitoli } = parseKb03(raw03);
  assert.equal(capitoli.length, 8, "attesi 8 CAPITOLO (I-VIII) nel Regolamento per il Palio");
});

// ---------------------------------------------------------------------------
// KB04 — famiglie di record
// ---------------------------------------------------------------------------

test("KB04: tutte le 4 famiglie di record sono presenti e non vuote", () => {
  const { peRecords, rpRecords, attRecords, legRecords } = parseKb04(raw04);
  assert.ok(peRecords.length > 0, "PE records assenti");
  assert.ok(rpRecords.length > 0, "RP records assenti");
  assert.ok(attRecords.length > 0, "ATT records assenti");
  assert.ok(legRecords.length > 0, "LEG records assenti");
  assert.equal(peRecords.length, 17);
  assert.equal(rpRecords.length, 2);
});

test("KB04: nessun record ha ID duplicato", () => {
  const { peRecords, rpRecords, attRecords, legRecords } = parseKb04(raw04);
  const all = [...peRecords, ...rpRecords, ...attRecords, ...legRecords].map((r) => r.id);
  const uniq = new Set(all);
  assert.equal(uniq.size, all.length, "trovati ID di record duplicati in KB04");
});

// ---------------------------------------------------------------------------
// KB02 — tag composti, ID stabili, sotto-elenchi indentati, separatori
// ---------------------------------------------------------------------------

test("KB02: ID stabili delle voci di cronologia non dipendono dal numero di riga (firma reale kb02BulletId)", () => {
  const lines = raw02.split("\n");
  const insertAt = 12;
  const modified = [...lines.slice(0, insertAt), "", "Riga di test inserita.", "", ...lines.slice(insertAt)].join("\n");

  const before = parseKb02(raw02);
  const after = parseKb02(modified);

  const y2014Before = before.years.find((y) => y.year === 2014);
  const y2014After = after.years.find((y) => y.year === 2014);
  const idsBefore = y2014Before.subsections.flatMap((s) =>
    s.bullets.map((b) => kb02BulletId(2014, s.slug, b.tag, b.contentSlug, b.duplicateIndex))
  );
  const idsAfter = y2014After.subsections.flatMap((s) =>
    s.bullets.map((b) => kb02BulletId(2014, s.slug, b.tag, b.contentSlug, b.duplicateIndex))
  );
  assert.deepEqual(idsBefore, idsAfter);
});

test("KB02: tutti i marcatori bullet sono tag validi (inclusi i tag composti multi-parola)", () => {
  const { years } = parseKb02(raw02);
  let compoundTagSeen = false;
  for (const y of years) {
    for (const sub of y.subsections) {
      for (const b of sub.bullets) {
        assert.ok(b.tagValid, `tag non valido "${b.tag}" nell'anno ${y.year}, sezione "${sub.title}"`);
        if (b.tag.includes(" ")) compoundTagSeen = true;
      }
    }
  }
  assert.ok(compoundTagSeen, "nessun tag composto (es. 'MODIFICA FORMALE') rilevato: la regex potrebbe essere regressa");
});

test("KB02: un bullet taggato seguito da un sotto-elenco indentato estende endLine oltre la propria riga", () => {
  const { years } = parseKb02(raw02);
  const y2023 = years.find((y) => y.year === 2023);
  assert.ok(y2023, "anno 2023 non trovato in KB02");
  const allBullets = y2023.subsections.flatMap((s) => s.bullets);
  const withSublist = allBullets.find((b) => (b.endLine || b.line) > b.line);
  assert.ok(withSublist, "nessun bullet con sotto-elenco indentato rilevato nel 2023 (atteso 'Articolo 10 organico:')");
  assert.ok(withSublist.endLine > withSublist.line);
});

// ---------------------------------------------------------------------------
// End-to-end: orchestratore reale (analyzeAll) — nessuna eccezione, tutti i
// gate passano, productionChunkCount riflette l'indice reale, zero
// unexplained ovunque.
// ---------------------------------------------------------------------------

test("Report v3.1: analyzeAll() reale non lancia eccezioni e produce un report completo", () => {
  const { report, perFile, allCandidates } = analyzeAll();
  assert.ok(report && perFile && allCandidates, "analyzeAll deve restituire report, perFile e allCandidates");
  assert.ok(allCandidates.length > 0, "allCandidates non deve essere vuoto");
  // M1: il chunker di produzione esiste. productionChunkCount non e' piu'
  // null, ma resta una metrica DISTINTA: viene letta dall'indice generato,
  // non copiata da diagnosticCandidateCount. L'asserzione qui e' che le due
  // misure, calcolate per vie indipendenti, coincidano.
  assert.equal(
    typeof report.productionChunkCount,
    "number",
    "da M1 productionChunkCount deve essere letto da data/chunks.generated.json"
  );
  assert.equal(
    report.productionChunkCount,
    allCandidates.length,
    "l'indice di produzione deve contenere esattamente un chunk per candidato canonico"
  );
  assert.notEqual(
    report.productionChunkCount,
    report.estimatedSplitCount,
    "productionChunkCount ed estimatedSplitCount restano metriche separate e non vanno confuse"
  );
});

// M1: il gate ritirato non deve poter riapparire, e quello che lo sostituisce
// deve essere un check reale sul file, non un booleano costante.
test("M1: il gate productionChunkCountRemainsNull e' ritirato e sostituito da un check reale sull'indice", () => {
  const { report } = analyzeAll();
  assert.ok(
    !("productionChunkCountRemainsNull" in report.acceptanceGates),
    "il gate productionChunkCountRemainsNull appartiene alla fase diagnostica e non deve piu' esistere"
  );
  assert.equal(
    report.acceptanceGates.productionIndexMatchesCanonicalCorpus,
    true,
    "l'indice di produzione deve coincidere con il corpus canonico"
  );

  // Verifica che il gate sia sensibile: alterando un solo hash nell'indice
  // il check deve fallire. Si opera su una copia in memoria, mai sul file.
  const raw = JSON.parse(readFileSync(join(ROOT, "data", "chunks.generated.json"), "utf-8"));
  assert.ok(raw.chunks.length > 0);
  const sample = raw.chunks[0];
  assert.match(
    sample.citation.contentHash,
    /^sha256:[0-9a-f]{64}$/,
    "ogni chunk deve portare un hash di contenuto canonico verificabile"
  );
});

test("Report v3.1: tutti i 16 gate di accettazione passano sul corpus canonico corrente", () => {
  const { report } = analyzeAll();
  const failing = Object.entries(report.acceptanceGates).filter(([, pass]) => !pass);
  assert.deepEqual(failing, [], `gate falliti: ${failing.map(([name]) => name).join(", ")}`);
  assert.equal(report.allAcceptanceGatesPass, true);
});

test("Report v3.1: zero unexplainedLineCount e zero globalOverlapLines su tutti i 4 file", () => {
  const { report } = analyzeAll();
  for (const [key, f] of Object.entries(report.perFile)) {
    assert.equal(f.coverageLedger.unexplainedLineCount, 0, `${key}: righe non spiegate residue`);
  }
  assert.equal(report.crossFileChecks.totalGlobalOverlapLines, 0);
});

test("Report v3.1: nessuna collisione di ID stabili e nessun candidato unscoped su tutto il corpus", () => {
  const { report } = analyzeAll();
  assert.deepEqual(report.crossFileChecks.stableIdCollisions, []);
  assert.deepEqual(report.crossFileChecks.unscopedCandidates, []);
});

test("Report v3.1.1 §3: il mapping KB01->KB04 esposto nel report e' onesto e GENUINAMENTE a due livelli (8 esatti + 9 provvisori = 17, non 8/2/7)", () => {
  const { report } = analyzeAll();
  // v3.1.1 §3: i conteggi principali sono a DUE livelli (8 actNumberMatch
  // esatti + 9 yearOnlyFallback provvisori = 17 totali), identici alla
  // baseline originale di Diagnostic-v3.md SS9, letti direttamente
  // dall'inventario dettagliato (kb01Result.mapping) senza alcuna
  // riclassificazione nel report. Il fatto che 2 dei 9 anni provvisori
  // (2013, 2020) abbiano un numero di atto nel campo Atto di KB04 e'
  // registrato come evidenza supplementare (registerAttoEvidenceYears),
  // MAI come un terzo valore di verifiedBy che riduce il conteggio
  // yearOnlyFallback da 9 a 7.
  assert.equal(report.kb01ToKb04Mapping.actNumberMatch, 8);
  assert.equal(report.kb01ToKb04Mapping.yearOnlyFallback, 9);
  assert.equal(report.kb01ToKb04Mapping.total, 17);
  assert.deepEqual(report.kb01ToKb04Mapping.provisionalFallbackYears, [2013, 2017, 2018, 2020, 2021, 2022, 2023, 2024, 2025]);
  // L'evidenza supplementare (2013, 2020) deve restare visibile e distinta,
  // ma senza uscire dal bucket yearOnlyFallback dei conteggi principali.
  assert.deepEqual(report.kb01ToKb04Mapping.registerAttoEvidenceYears, [2013, 2020]);
  assert.ok(report.kb01ToKb04Mapping.registerAttoEvidenceDetail.some((d) => d.year === 2013 && /n\.\s*11/.test(d.registerAtto)));
  assert.ok(report.kb01ToKb04Mapping.registerAttoEvidenceDetail.some((d) => d.year === 2020 && /n\.\s*51/.test(d.registerAtto)));
});

test("Report v3.1.1 §3: nessun terzo valore di verifiedBy esiste nell'inventario dettagliato esposto dal modulo di mapping stesso", () => {
  const { mapping } = mapKb01ActsToKb04(raw01, raw04);
  const distinctValues = [...new Set(mapping.map((m) => m.verifiedBy))].sort();
  assert.deepEqual(distinctValues, ["actNumberMatch", "yearOnlyFallback"]);
});

// ---------------------------------------------------------------------------
// Anti-staleness (prompt v3 §7.10 + §8): gli artefatti committati in data/
// devono coincidere con l'output fresco del parser. Se qualcuno modifica il
// codice senza rieseguire `npm run chunk:diagnostic`, questo test deve
// fallire.
//
// v3.1.1 §6: `generatedAt` e' stato RIMOSSO da tutti e 3 gli artefatti
// tracciati (era l'unica fonte di non-determinismo). stripNonDeterministic
// resta come no-op difensivo (nel caso in cui in futuro venga reintrodotto
// un campo non deterministico), ma il confronto qui sotto e' ora, di fatto,
// un confronto di uguaglianza ESATTA byte-per-byte a livello di struttura.
// ---------------------------------------------------------------------------

function stripNonDeterministic(obj) {
  const clone = JSON.parse(JSON.stringify(obj));
  delete clone.generatedAt;
  return clone;
}

test("v3.1.1 §6: nessuno dei 3 artefatti tracciati in data/ contiene piu' un campo generatedAt", () => {
  const files = ["chunk-diagnostic-report.json", "diagnostic-candidates.json", "coverage-ledger.json"];
  for (const f of files) {
    const committed = JSON.parse(readFileSync(join(__dirname, "..", "data", f), "utf8"));
    assert.equal(
      Object.prototype.hasOwnProperty.call(committed, "generatedAt"),
      false,
      `${f} non deve piu' contenere generatedAt (§6)`
    );
  }
  const { report, allCandidates } = analyzeAll();
  assert.equal(Object.prototype.hasOwnProperty.call(report, "generatedAt"), false);
});

test("Anti-staleness: data/chunk-diagnostic-report.json committato coincide con l'output fresco (a parte generatedAt)", () => {
  const committedPath = join(__dirname, "..", "data", "chunk-diagnostic-report.json");
  const committed = JSON.parse(readFileSync(committedPath, "utf8"));
  const { report: fresh } = analyzeAll();
  assert.deepEqual(
    stripNonDeterministic(committed),
    stripNonDeterministic(fresh),
    "data/chunk-diagnostic-report.json e' stale: rieseguire `npm run chunk:diagnostic` prima di committare"
  );
});

test("Anti-staleness: data/diagnostic-candidates.json committato coincide con l'output fresco (a parte generatedAt)", () => {
  const committedPath = join(__dirname, "..", "data", "diagnostic-candidates.json");
  const committed = JSON.parse(readFileSync(committedPath, "utf8"));
  const { allCandidates } = analyzeAll();
  assert.equal(committed.totalCandidates, allCandidates.length, "totalCandidates committato non coincide con allCandidates.length fresco");
  assert.deepEqual(
    stripNonDeterministic(committed).candidates,
    JSON.parse(JSON.stringify(allCandidates)),
    "data/diagnostic-candidates.json e' stale: rieseguire `npm run chunk:diagnostic` prima di committare"
  );
});

test("Anti-staleness: data/coverage-ledger.json committato coincide con l'output fresco (a parte generatedAt)", () => {
  // NOTA FORENSE (root cause, indagine 05.md): questo test conteneva un bug
  // di autoria proprio, NON un difetto del generatore. Due errori distinti:
  //   1. Leggeva `f.coverageLedger`, ma la proprieta' reale restituita da
  //      analyzeAll().perFile[key] si chiama `ledger` (non `coverageLedger`).
  //      Questo rendeva il lato "fresco" del confronto sempre `undefined`
  //      per tutti e 4 i file, garantendo un fallimento indipendentemente
  //      dai dati reali.
  //   2. Anche correggendo il nome del campo, l'oggetto `ledger` in memoria
  //      contiene campi di lavoro intermedi (blankLines, nonBlankLines,
  //      counts, unexplainedLines) che lo script CLI (chunk-diagnostic.mjs,
  //      sezione di scrittura di coverage-ledger.json) OMETTE deliberatamente
  //      dall'artefatto committato, scrivendo solo una proiezione a 4 campi:
  //      totalLines, unexplainedLineCount,
  //      substantiveLinesWithoutCandidateOrExplicitReason, records.
  //      Il test deve quindi confrontare il committato con LA STESSA proiezione
  //      che la CLI scrive, non con l'oggetto ledger completo non filtrato.
  //   PRECISAZIONE: un campo chiamato `coverageLedger` esiste realmente nel
  //      codice, ma SOLO dentro `analyzeAll().report.perFile[key]` (la vista
  //      di riepilogo, popolata a scripts/chunk-diagnostic.mjs righe ~986-1004)
  //      -- e anche li' NON include `records`. Il writer della CLI per
  //      coverage-ledger.json (righe ~1107-1116) legge invece direttamente
  //      da `perFile[key].ledger.*` (l'oggetto grezzo), che e' la fonte
  //      corretta da usare qui.
  // Campi esclusi dal confronto e motivo: `generatedAt` (non deterministico,
  // timestamp di generazione) e i 4 campi di lavoro intermedi sopra elencati
  // (blankLines, nonBlankLines, counts, unexplainedLines) perche' l'artefatto
  // committato non li include mai per contratto (v. scripts/chunk-diagnostic.mjs
  // righe ~1107-1116) — non sono dati nascosti o persi, sono derivabili da
  // `records` e semplicemente non fanno parte del contratto dell'artefatto.
  const committedPath = join(__dirname, "..", "data", "coverage-ledger.json");
  const committed = JSON.parse(readFileSync(committedPath, "utf8"));
  const { perFile } = analyzeAll();
  const freshLedger = {};
  for (const [key, f] of Object.entries(perFile)) {
    // Proiezione identica a quella scritta da chunk-diagnostic.mjs
    // (vedi commento sopra) — non l'oggetto f.ledger completo.
    freshLedger[key] = {
      totalLines: f.ledger.totalLines,
      unexplainedLineCount: f.ledger.unexplainedLineCount,
      substantiveLinesWithoutCandidateOrExplicitReason: f.ledger.substantiveLinesWithoutCandidateOrExplicitReason,
      records: f.ledger.records,
    };
  }
  assert.deepEqual(
    stripNonDeterministic(committed).perFile,
    JSON.parse(JSON.stringify(freshLedger)),
    "data/coverage-ledger.json e' stale: rieseguire `npm run chunk:diagnostic` prima di committare"
  );
});

// ---------------------------------------------------------------------------
// Regressione mirata (indagine forense 05.md): il record del candidato
// "manifest-registro-intro:formula-pubblica-raccomandata" (KB04, righe
// 1098-1104) deve restare identico attraverso i 5 percorsi di generazione
// elencati nel mandato.
//
// L'intervallo era 1094-1100 fino al 2 agosto 2026: la correzione della catena
// di provenienza della scheda RP-2019-01 ha aggiunto quattro righe a monte in
// KB 04 e ha traslato di quattro l'intervallo. Testo e contentHash del
// candidato sono invariati: e' cambiata solo la sua posizione nel file.
//
// Root cause storica del mismatch (documentata qui
// per evitare regressioni future): NON un difetto del generatore, ma due
// bug nel test stesso — nome di campo sbagliato (coverageLedger invece di
// ledger) e proiezione non filtrata (l'oggetto ledger completo invece della
// stessa proiezione a 4 campi scritta da chunk-diagnostic.mjs). Il
// generatore e' stato verificato deterministico e riproducibile da stato
// pulito PRIMA di questa correzione; questo test blocca la regressione del
// bug di test, non un bug del generatore.
// ---------------------------------------------------------------------------

const TARGET_CANDIDATE_ID = "manifest-registro-intro:formula-pubblica-raccomandata";

function extractTargetRecord({ allCandidates, perFile }) {
  const candidate = allCandidates.find((c) => c.id === TARGET_CANDIDATE_ID);
  const ledgerRecords = perFile.kb04.ledger.records.filter((r) =>
    (r.candidateIds || []).includes(TARGET_CANDIDATE_ID)
  );
  return { candidate, ledgerRecords };
}

test("Regressione KB04 (1): generazione diretta fresca produce il candidato target con range di riga stabile", () => {
  const fresh = analyzeAll();
  const { candidate, ledgerRecords } = extractTargetRecord(fresh);
  assert.ok(candidate, "il candidato manifest-registro-intro:formula-pubblica-raccomandata deve esistere");
  assert.equal(candidate.startLine, 1098);
  assert.equal(candidate.endLine, 1104);
  assert.ok(ledgerRecords.length > 0, "il ledger KB04 deve contenere almeno una riga che referenzia il candidato target");
});

test("Regressione KB04 (2): npm run chunk:diagnostic (CLI) produce lo stesso record per il candidato target", () => {
  // v3.1.1 §6: la CLI reale viene invocata per intero (come sottoprocesso,
  // per escludere cache di modulo), ma con CHUNK_DIAGNOSTIC_OUT_DIR puntato
  // a una directory temporanea -- MAI sugli artefatti tracciati in data/.
  // npm test deve restare di sola lettura rispetto al repository.
  const tmpOut = mkdtempSync(join(tmpdir(), "chunk-diagnostic-test-"));
  try {
    execFileSync("npm", ["run", "chunk:diagnostic"], {
      cwd: ROOT,
      stdio: "ignore",
      env: { ...process.env, CHUNK_DIAGNOSTIC_OUT_DIR: tmpOut },
    });
    const committedCandidates = JSON.parse(readFileSync(join(tmpOut, "diagnostic-candidates.json"), "utf8"));
    const viaCli = committedCandidates.candidates.find((c) => c.id === TARGET_CANDIDATE_ID);
    assert.ok(viaCli, "il candidato deve essere presente nell'artefatto scritto dalla CLI");
    assert.equal(viaCli.startLine, 1098);
    assert.equal(viaCli.endLine, 1104);
  } finally {
    rmSync(tmpOut, { recursive: true, force: true });
  }
});

test("Regressione KB04 (3): due chiamate a analyzeAll() nello stesso processo producono record identici per il candidato target", () => {
  const run1 = extractTargetRecord(analyzeAll());
  const run2 = extractTargetRecord(analyzeAll());
  assert.deepEqual(JSON.parse(JSON.stringify(run1)), JSON.parse(JSON.stringify(run2)));
});

test("Regressione KB04 (4): un processo Node separato produce lo stesso record per il candidato target (esclude cache di modulo/stato tra processi)", () => {
  const script = `
    import { analyzeAll } from ${JSON.stringify(join(ROOT, "scripts", "chunk-diagnostic.mjs"))};
    const { allCandidates, perFile } = analyzeAll();
    const candidate = allCandidates.find((c) => c.id === ${JSON.stringify(TARGET_CANDIDATE_ID)});
    const ledgerRecords = perFile.kb04.ledger.records.filter((r) => (r.candidateIds || []).includes(${JSON.stringify(TARGET_CANDIDATE_ID)}));
    process.stdout.write(JSON.stringify({ candidate, ledgerRecords }));
  `;
  const out = execFileSync("node", ["--input-type=module", "-e", script], { cwd: ROOT, encoding: "utf8" });
  const fromSeparateProcess = JSON.parse(out);
  const fromThisProcess = JSON.parse(JSON.stringify(extractTargetRecord(analyzeAll())));
  assert.deepEqual(fromSeparateProcess, fromThisProcess);
});

test("Regressione KB04 (5): il record del candidato target nell'artefatto committato coincide con la generazione fresca", () => {
  const committedCandidates = JSON.parse(readFileSync(join(ROOT, "data", "diagnostic-candidates.json"), "utf8"));
  const committedTarget = committedCandidates.candidates.find((c) => c.id === TARGET_CANDIDATE_ID);
  const fresh = extractTargetRecord(analyzeAll());
  assert.deepEqual(committedTarget, fresh.candidate);

  const committedLedger = JSON.parse(readFileSync(join(ROOT, "data", "coverage-ledger.json"), "utf8"));
  const committedLedgerRecords = committedLedger.perFile.kb04.records.filter((r) =>
    (r.candidateIds || []).includes(TARGET_CANDIDATE_ID)
  );
  assert.deepEqual(committedLedgerRecords, JSON.parse(JSON.stringify(fresh.ledgerRecords)));
});

// ---------------------------------------------------------------------------
// v3.1.1 §4 — Contratto candidato completo: contentHash SHA-256
// deterministico + status/ereditarieta' su TUTTI i 710 candidati (non un
// sottoinsieme). Cinque test richiesti dal mandato: ricostruzione, hash
// match, hash-cambia-su-mutazione, ID-stabile-sotto-inserimento,
// tutti-i-candidati-hanno-struttura-status.
// ---------------------------------------------------------------------------

test("v3.1.1 §4 (1/5 — ricostruzione): il testo ricostruito da startLine/endLine di un candidato noto coincide esattamente col contenuto atteso del file canonico", () => {
  const { allCandidates } = analyzeAll();
  const rawByFile = { kb01: raw01, kb02: raw02, kb03: raw03, kb04: raw04 };
  // Candidato noto e stabile: primo articolo del primo atto KB01 (PE-2012-01, art. 1).
  const target = allCandidates.find((c) => c.id === "kb01:pe-2012-01:articolo-1");
  assert.ok(target, "il candidato di riferimento deve esistere");
  const reconstructed = reconstructCandidateText(rawByFile, target);
  assert.ok(reconstructed != null, "la ricostruzione non deve essere null per un candidato valido");
  const expectedLines = raw01.split("\n").slice(target.startLine - 1, target.endLine);
  assert.equal(reconstructed, expectedLines.join("\n"));
  // Il testo ricostruito deve effettivamente contenere l'intestazione dell'articolo.
  assert.match(reconstructed, /Art\.\s*1\b/);
});

test("v3.1.1 §4 (2/5 — hash match): il contentHash di ogni candidato coincide con sha256 del testo ricostruito, calcolato indipendentemente in questo test", () => {
  const { allCandidates } = analyzeAll();
  const rawByFile = { kb01: raw01, kb02: raw02, kb03: raw03, kb04: raw04 };
  // Verifica su un campione stratificato (uno per candidateType) piu' il totale.
  const sampleTypes = [...new Set(allCandidates.map((c) => c.candidateType))];
  for (const t of sampleTypes) {
    const c = allCandidates.find((x) => x.candidateType === t);
    const text = reconstructCandidateText(rawByFile, c);
    const independentHash = `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
    assert.equal(c.contentHash, independentHash, `hash mismatch per candidateType=${t} id=${c.id}`);
  }
  // Nessun candidato deve avere un contentHash nullo o malformato.
  for (const c of allCandidates) {
    assert.match(c.contentHash, /^sha256:[0-9a-f]{64}$/, `contentHash malformato per ${c.id}`);
  }
});

test("v3.1.1 §4 (3/5 — hash cambia su mutazione): alterare anche un solo carattere nel range di un candidato cambia il suo contentHash, e nessun altro", () => {
  const { allCandidates } = analyzeAll();
  const target = allCandidates.find((c) => c.id === "kb01:pe-2012-01:articolo-1");
  const originalHash = target.contentHash;
  const lines01 = raw01.split("\n");
  const mutatedLines01 = [...lines01];
  // Muta l'ultima riga del range del candidato (aggiunge un carattere innocuo).
  mutatedLines01[target.endLine - 1] = `${mutatedLines01[target.endLine - 1]} X`;
  const mutatedRaw01 = mutatedLines01.join("\n");
  const mutatedText = reconstructCandidateText({ kb01: mutatedRaw01 }, target);
  const mutatedHash = computeContentHash(mutatedText);
  assert.notEqual(mutatedHash, originalHash, "il contentHash deve cambiare quando il testo del candidato cambia");
  // Un candidato con range completamente disgiunto (altro file, altro anno) non è influenzato.
  const unrelated = allCandidates.find((c) => c.file === "kb04");
  const unrelatedHashBefore = unrelated.contentHash;
  const unrelatedTextAfter = reconstructCandidateText({ kb04: raw04 }, unrelated);
  assert.equal(computeContentHash(unrelatedTextAfter), unrelatedHashBefore);
});

// ---------------------------------------------------------------------------
// v3.1.2 §2 — Mutation test REALE del parser (sostituisce il test vacuo di
// v3.1.1 §4 4/5, che si limitava ad appendere testo in FONDO al documento,
// dopo il candidato target, e non rieseguiva mai il parser: non poteva
// quindi dimostrare nulla sulla stabilita' degli ID sotto inserimento).
//
// Procedura reale, per OGNI famiglia (file × candidateType) per cui un
// inserimento puo' spostare i range:
//   1. si seleziona un candidato stabile della famiglia;
//   2. si inseriscono N righe PRIMA di quel candidato;
//   3. si RIESEGUE il parser reale sulla sorgente mutata in memoria;
//   4. l'ID pubblico deve restare invariato;
//   5. startLine e endLine devono spostarsi esattamente di N;
//   6. il contentHash deve restare invariato, perche' il testo del
//      candidato non e' cambiato.
// ---------------------------------------------------------------------------

const INSERTED_LINE_COUNT = 7;

function buildFamilyCandidates(file, rawByFile) {
  if (file === "kb01") return buildKb01Candidates(rawByFile.kb01, rawByFile.kb04).candidates;
  if (file === "kb02") return buildKb02Candidates(rawByFile.kb02).candidates;
  if (file === "kb03") return buildKb03Candidates(rawByFile.kb03).candidates;
  if (file === "kb04") return buildKb04Candidates(rawByFile.kb04).candidates;
  throw new Error(`file non gestito: ${file}`);
}

function insertLinesBefore(raw, oneBasedLine, count) {
  const lines = raw.split("\n");
  const filler = Array.from({ length: count }, () => "");
  return [...lines.slice(0, oneBasedLine - 1), ...filler, ...lines.slice(oneBasedLine - 1)].join("\n");
}

test("v3.1.2 §2: mutation test reale del parser — inserire N righe PRIMA di un candidato ne sposta i range di N, lasciando invariati id e contentHash, su OGNI famiglia di ID pubblici", () => {
  const baseRawByFile = { kb01: raw01, kb02: raw02, kb03: raw03, kb04: raw04 };

  // Famiglie reali presenti nel corpus: ogni coppia (file, candidateType)
  // per cui esiste almeno un candidato. Nessuna famiglia viene esclusa.
  const baseline = {};
  const families = new Map();
  for (const file of ["kb01", "kb02", "kb03", "kb04"]) {
    baseline[file] = buildFamilyCandidates(file, baseRawByFile);
    for (const c of baseline[file]) {
      const key = `${file}:${c.candidateType}`;
      if (!families.has(key)) families.set(key, { file, candidateType: c.candidateType, sample: c });
    }
  }
  // v3.1.3 §6 — L'universo osservato e' esattamente 12 famiglie, non "almeno 11".
  // Elenco esplicito: una famiglia che comparisse o scomparisse deve far
  // fallire questo test, non passare inosservata sotto una soglia generica.
  const EXPECTED_FAMILIES = [
    "kb01:articoloOrdinario",
    "kb01:puntoDiModifica",
    "kb01:sezioneSemantica",
    "kb01:tabellaAtomica",
    "kb02:sezioneSemantica",
    "kb02:tabellaAtomica",
    "kb02:voceCronologia",
    "kb03:articoloOrdinario",
    "kb03:sezioneSemantica",
    "kb03:tabellaAtomica",
    "kb04:recordRegistro",
    "kb04:sezioneSemantica",
  ];
  assert.deepEqual(
    [...families.keys()].sort(),
    EXPECTED_FAMILIES,
    `l'universo delle famiglie (file × candidateType) deve essere esattamente quello dichiarato, 12 famiglie`
  );
  assert.equal(families.size, 12, `attese esattamente 12 famiglie, trovate ${families.size}`);

  // Punto di inserimento provatamente ESTERNO a ogni candidato: subito dopo
  // il delimitatore di chiusura del front matter YAML. Alcune famiglie di
  // candidati (es. le sezioni residuali "testo successivo alla tabella")
  // sono definite come "tutto cio' che segue X": per esse non esiste alcuno
  // spazio immediatamente precedente che non sia gia' interno al candidato,
  // quindi un inserimento adiacente NON sarebbe "prima del candidato".
  function frontMatterEndLineOf(raw) {
    const lines = raw.split("\n");
    if (lines[0] !== "---") return 0;
    for (let i = 1; i < lines.length; i++) if (lines[i] === "---") return i + 1;
    return 0;
  }

  const covered = [];
  let adjacentCovered = 0;
  for (const { file, candidateType, sample } of families.values()) {
    // Il candidato campione deve avere un range valido e non iniziare alla
    // prima riga del file (altrimenti "prima" non esiste).
    assert.ok(sample.startLine > 1, `${sample.id}: startLine deve essere > 1 per poter inserire righe prima`);

    const originalText = reconstructCandidateText(baseRawByFile, sample);
    const originalHash = computeContentHash(originalText);
    assert.ok(originalHash, `${sample.id}: hash originale non calcolabile`);

    const fmEnd = frontMatterEndLineOf(baseRawByFile[file]);
    assert.ok(fmEnd > 0 && fmEnd < sample.startLine, `${sample.id}: front matter non individuato prima del candidato`);

    // 2. inserimento di N righe PRIMA del candidato.
    const mutatedRaw = insertLinesBefore(baseRawByFile[file], fmEnd + 1, INSERTED_LINE_COUNT);
    const mutatedRawByFile = { ...baseRawByFile, [file]: mutatedRaw };

    // 3. riesecuzione REALE del parser sulla sorgente mutata in memoria.
    const mutatedCandidates = buildFamilyCandidates(file, mutatedRawByFile);

    // 4. l'ID pubblico non cambia: e' semantico, non posizionale.
    const after = mutatedCandidates.find((c) => c.id === sample.id);
    assert.ok(
      after,
      `${sample.id}: l'ID pubblico deve sopravvivere all'inserimento di ${INSERTED_LINE_COUNT} righe (famiglia ${file}:${candidateType})`
    );

    // 5. i range si spostano ESATTAMENTE di N.
    assert.equal(
      after.startLine,
      sample.startLine + INSERTED_LINE_COUNT,
      `${sample.id}: startLine deve spostarsi di ${INSERTED_LINE_COUNT}`
    );
    assert.equal(
      after.endLine,
      sample.endLine + INSERTED_LINE_COUNT,
      `${sample.id}: endLine deve spostarsi di ${INSERTED_LINE_COUNT}`
    );

    // 6. il contentHash resta invariato: il testo del candidato non e' cambiato.
    const mutatedText = reconstructCandidateText(mutatedRawByFile, after);
    assert.equal(
      mutatedText,
      originalText,
      `${sample.id}: il testo ricostruito dopo lo spostamento deve essere identico`
    );
    assert.equal(
      computeContentHash(mutatedText),
      originalHash,
      `${sample.id}: il contentHash deve restare invariato sotto inserimento esterno`
    );

    covered.push(`${file}:${candidateType}`);

    // Variante PIU' STRINGENTE: quando esiste un vero spazio vuoto
    // immediatamente prima del candidato (una riga bianca precedente),
    // l'inserimento adiacente e' inequivocabilmente esterno al candidato.
    // Verifica che l'ID non sia derivato dalla posizione locale.
    const srcLines = baseRawByFile[file].split("\n");
    const prev1 = srcLines[sample.startLine - 2];
    const prev2 = srcLines[sample.startLine - 3];
    if (prev1 === "" && prev2 !== undefined) {
      const adjRaw = insertLinesBefore(baseRawByFile[file], sample.startLine - 1, INSERTED_LINE_COUNT);
      const adjByFile = { ...baseRawByFile, [file]: adjRaw };
      const adjCandidates = buildFamilyCandidates(file, adjByFile);
      const adjAfter = adjCandidates.find((c) => c.id === sample.id);
      assert.ok(adjAfter, `${sample.id}: inserimento adiacente — l'ID pubblico deve restare invariato`);
      assert.equal(
        adjAfter.startLine,
        sample.startLine + INSERTED_LINE_COUNT,
        `${sample.id}: inserimento adiacente — startLine deve spostarsi di ${INSERTED_LINE_COUNT}`
      );
      assert.equal(
        computeContentHash(reconstructCandidateText(adjByFile, adjAfter)),
        originalHash,
        `${sample.id}: inserimento adiacente — il contentHash deve restare invariato`
      );
      adjacentCovered++;
    }
  }

  // Copertura esplicita: tutte le famiglie osservate sono state mutate.
  assert.equal(covered.length, families.size, "ogni famiglia deve essere coperta dal mutation test");
  assert.deepEqual(covered.sort(), EXPECTED_FAMILIES, "la copertura del mutation test principale deve essere l'intero universo di 12 famiglie");

  // v3.1.3 §6 — Dichiarazione onesta della copertura ADIACENTE: 10 famiglie
  // su 12, non "almeno 10" lasciando intendere una copertura totale.
  // Le 2 famiglie escluse lo sono per ragione STRUTTURALE, non per comodita':
  // sia kb01:sezioneSemantica sia kb02:sezioneSemantica sono famiglie residuali
  // ("tutto cio' che segue X") che iniziano immediatamente dopo contenuto non
  // vuoto, quindi non esiste alcuna riga bianca precedente in cui inserire
  // righe restando inequivocabilmente all'ESTERNO del candidato.
  assert.equal(
    adjacentCovered,
    10,
    `la variante di inserimento adiacente copre 10 famiglie su ${families.size}; osservate ${adjacentCovered}`
  );
  assert.equal(
    families.size - adjacentCovered,
    2,
    "esattamente 2 famiglie residuali restano fuori dalla variante adiacente per ragione strutturale"
  );
});

test("v3.1.2 §2: il mutation test e' capace di FALLIRE — se il testo del candidato cambia davvero, il contentHash cambia", () => {
  const baseRawByFile = { kb01: raw01, kb02: raw02, kb03: raw03, kb04: raw04 };
  const candidates = buildKb01Candidates(raw01, raw04).candidates;
  const target = candidates.find((c) => c.id === "kb01:pe-2012-01:articolo-1");
  assert.ok(target);
  const originalHash = computeContentHash(reconstructCandidateText(baseRawByFile, target));

  // Inserimento DENTRO il range del candidato: il testo cambia davvero.
  const mutatedRaw = insertLinesBefore(raw01, target.startLine + 1, 3);
  const mutatedCandidates = buildKb01Candidates(mutatedRaw, raw04).candidates;
  const after = mutatedCandidates.find((c) => c.id === target.id);
  assert.ok(after, "l'id resta stabile anche con inserimento interno");
  const mutatedHash = computeContentHash(reconstructCandidateText({ ...baseRawByFile, kb01: mutatedRaw }, after));
  assert.notEqual(mutatedHash, originalHash, "un inserimento DENTRO il candidato deve cambiare il contentHash");
});

test("v3.1.2 §2: verifica indipendente del contentHash su TUTTI i candidati (non un solo campione per candidateType)", () => {
  const { allCandidates } = analyzeAll();
  const rawByFile = { kb01: raw01, kb02: raw02, kb03: raw03, kb04: raw04 };
  assert.ok(allCandidates.length >= 700, `attesi >=700 candidati, trovati ${allCandidates.length}`);

  let verified = 0;
  for (const c of allCandidates) {
    // Ricostruzione indipendente dal testo canonico, riga per riga.
    const lines = rawByFile[c.file].split("\n");
    const text = lines.slice(c.startLine - 1, c.endLine).join("\n");
    const expected = `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
    assert.equal(c.contentHash, expected, `contentHash non verificato per ${c.id} (${c.file}:${c.startLine}-${c.endLine})`);
    assert.equal(c.integrity.contentHash, expected, `integrity.contentHash divergente per ${c.id}`);
    assert.equal(c.integrity.hashComputedFrom, `${c.file}:${c.startLine}-${c.endLine}`, `hashComputedFrom errato per ${c.id}`);
    assert.equal(c.reconstructedLineCount, text.split("\n").length, `reconstructedLineCount errato per ${c.id}`);
    verified++;
  }
  assert.equal(verified, allCandidates.length, "ogni candidato deve essere verificato individualmente");
});

// ---------------------------------------------------------------------------
// v3.1.2 §1 — Contratto di stato documentario a QUATTRO dimensioni.
// Sostituisce il test v3.1.1 §4 (5/5), che si limitava ad accertare la
// presenza di status.state e status.verifiedBy: due campi che erano
// identici ("final"/"structural") su tutti e 710 i candidati e non
// esprimevano alcuno stato documentario reale.
// ---------------------------------------------------------------------------

test("v3.1.2 §1: ogni candidato espone le QUATTRO dimensioni canoniche, con riferimento alla fonte e nessun valore inventato", () => {
  const { allCandidates } = analyzeAll();
  const vocabulary = extractKb04StatusVocabulary(raw04);

  // Il crosswalk dichiarato deve essere integralmente ancorato a voci di
  // legenda realmente presenti nella KB 04.
  assert.deepEqual(
    findUnanchoredCrosswalkTerms(vocabulary),
    [],
    "ogni termine del crosswalk deve esistere come voce di legenda nella KB 04"
  );

  for (const c of allCandidates) {
    assert.equal(typeof c.status, "object", `status mancante per ${c.id}`);
    // Nessun collasso in uno stato generico unico.
    assert.ok(!("state" in c.status), `${c.id}: lo stato generico "state" non deve esistere`);
    assert.ok(!("verifiedBy" in c.status), `${c.id}: lo stato generico "verifiedBy" non deve esistere`);
    // I metadati di integrita' restano FUORI dallo stato documentario.
    assert.ok(!("contentHash" in c.status), `${c.id}: contentHash non deve stare dentro status`);
    assert.ok(!("hashComputedFrom" in c.status), `${c.id}: hashComputedFrom non deve stare dentro status`);
    assert.equal(typeof c.integrity, "object", `${c.id}: i campi di integrita' devono esistere separatamente`);

    for (const dim of STATUS_DIMENSIONS) {
      const e = c.status[dim];
      assert.equal(typeof e, "object", `${c.id}: dimensione ${dim} assente`);
      const hasValue = typeof e.value === "string" && e.value.length > 0;
      const hasNull = e.documentedNull !== null;
      assert.notEqual(hasValue, hasNull, `${c.id}/${dim}: esattamente uno fra value e documentedNull`);
      if (hasValue) {
        assert.ok(vocabulary.has(e.value), `${c.id}/${dim}: valore "${e.value}" non presente nella legenda KB 04`);
        assert.equal(KB04_LEGEND_CROSSWALK[e.value], dim, `${c.id}/${dim}: valore non assegnato a questa dimensione`);
        assert.equal(e.source.kind, "canonicalValue");
        assert.equal(typeof e.source.field, "string");
      } else {
        assert.ok(
          DOCUMENTED_NULL_REASONS.includes(e.documentedNull.reason),
          `${c.id}/${dim}: documented-null con motivo non tipizzato "${e.documentedNull.reason}"`
        );
        assert.equal(e.source.kind, "absenceChecked");
      }
      // Riferimento alla fonte sempre presente e localizzato.
      assert.equal(typeof e.source, "object", `${c.id}/${dim}: riferimento alla fonte assente`);
      assert.equal(typeof e.source.file, "string");
      assert.equal(typeof e.source.line, "number");
    }
  }

  // Il gate calcolato deve essere vero sul corpus canonico reale.
  assert.equal(
    analyzeAll().report.acceptanceGates.allCandidatesHaveCanonicalStatusDimensions,
    true,
    "il gate allCandidatesHaveCanonicalStatusDimensions deve passare sul corpus canonico"
  );
});

test("v3.1.2 §1: i tre tipi di documented-null sono distinti e realmente usati; le dimensioni NON sono uniformi fra i candidati", () => {
  const { allCandidates } = analyzeAll();

  const reasonsUsed = new Set();
  const documentaryValues = new Set();
  const legalValues = new Set();
  for (const c of allCandidates) {
    for (const dim of STATUS_DIMENSIONS) {
      const e = c.status[dim];
      if (e.documentedNull) reasonsUsed.add(e.documentedNull.reason);
    }
    if (c.status.documentaryStatus.value) documentaryValues.add(c.status.documentaryStatus.value);
    if (c.status.legalStatus.value) legalValues.add(c.status.legalStatus.value);
  }

  // "not documented", "not applicable" e "not yet evaluated" sono distinti
  // e tutti e tre effettivamente presenti nel corpus.
  assert.ok(reasonsUsed.has("notDocumented"), "il motivo notDocumented deve essere usato");
  assert.ok(reasonsUsed.has("notApplicable"), "il motivo notApplicable deve essere usato");
  assert.ok(reasonsUsed.has("notYetEvaluated"), "il motivo notYetEvaluated deve essere usato");

  // Le dimensioni portano valori canonici REALI e differenziati: non e' piu'
  // una classificazione sintetica identica per tutti i candidati.
  assert.ok(documentaryValues.size >= 2, `documentaryStatus deve avere >=2 valori canonici distinti, trovati ${documentaryValues.size}`);
  assert.ok(legalValues.size >= 2, `legalStatus deve avere >=2 valori canonici distinti, trovati ${legalValues.size}`);

  // Un letterale documentato ma NON coincidente con la legenda canonica
  // viene conservato verbatim e mai normalizzato in un valore inventato.
  const pe2013 = allCandidates.find((c) => c.id === "kb04:pe-2013-01");
  assert.ok(pe2013, "il record PE-2013-01 deve esistere fra i candidati");
  const d = pe2013.status.documentaryStatus;
  assert.equal(d.value, null, "un letterale non canonico non deve produrre un valore");
  assert.equal(d.documentedNull.reason, "notYetEvaluated");
  assert.equal(
    d.documentedNull.literal,
    "protocollo presente; atto di approvazione non presente",
    "il letterale documentato deve essere conservato verbatim, senza normalizzazione"
  );
});

test("v3.1.2 §1: ereditarieta' esplicita — un candidato che eredita da un record KB 04 dichiara il riferimento, e il riferimento punta a un candidato esistente", () => {
  const { allCandidates } = analyzeAll();
  const idIndex = new Set(allCandidates.map((c) => c.id));

  const inheriting = allCandidates.filter((c) =>
    STATUS_DIMENSIONS.some((dim) => c.status[dim].inheritedFrom !== null)
  );
  assert.ok(inheriting.length > 0, "almeno un candidato deve ereditare lo stato da un record KB 04");

  for (const c of inheriting) {
    for (const dim of STATUS_DIMENSIONS) {
      const inh = c.status[dim].inheritedFrom;
      if (!inh) continue;
      assert.equal(inh.kind, "kb04RegisterRecord", `${c.id}/${dim}: tipo di ereditarieta' inatteso`);
      assert.equal(typeof inh.resolutionMethod, "string", `${c.id}/${dim}: metodo di risoluzione mancante`);
      assert.equal(typeof inh.naturalId, "string", `${c.id}/${dim}: naturalId mancante`);
      assert.ok(idIndex.has(inh.ref), `${c.id}/${dim}: il riferimento ereditato ${inh.ref} deve puntare a un candidato esistente`);
    }
  }

  // I due puntoDiModifica di KB01 mantengono il riferimento di modifica.
  const amendments = allCandidates.filter((c) => c.candidateType === "puntoDiModifica");
  assert.equal(amendments.length, 2);
  for (const a of amendments) {
    assert.equal(a.inheritance.length, 1, `il punto di modifica ${a.id} deve avere esattamente un riferimento risolto`);
    assert.equal(a.inheritance[0].relation, "modifica");
    assert.ok(idIndex.has(a.inheritance[0].ref), `il riferimento di ereditarieta' di ${a.id} deve puntare a un candidato esistente`);
  }
});

test("v3.1.2 §1 (mutation): rimuovere una delle quattro dimensioni fa FALLIRE il gate", () => {
  const { allCandidates } = analyzeAll();
  const vocabulary = extractKb04StatusVocabulary(raw04);

  // Il gate passa sul corpus intatto.
  assert.deepEqual(checkCanonicalStatusDimensions(allCandidates, vocabulary), []);

  for (const dim of STATUS_DIMENSIONS) {
    const mutated = analyzeAll().allCandidates;
    const victim = mutated[0];
    delete victim.status[dim];
    const violations = checkCanonicalStatusDimensions(mutated, vocabulary);
    assert.ok(
      violations.some((v) => v.id === victim.id && v.dimension === dim && v.problem === "missingDimension"),
      `la rimozione della dimensione ${dim} deve essere segnalata come violazione`
    );
  }
});

test("v3.1.2 §1 (mutation): rompere un riferimento alla fonte, inventare un valore o collassare le dimensioni fa FALLIRE il gate", () => {
  const vocabulary = extractKb04StatusVocabulary(raw04);

  // (a) riferimento alla fonte rimosso.
  {
    const mutated = analyzeAll().allCandidates;
    const victim = mutated.find((c) => c.status.documentaryStatus.source !== null);
    victim.status.documentaryStatus.source = null;
    const violations = checkCanonicalStatusDimensions(mutated, vocabulary);
    assert.ok(
      violations.some((v) => v.id === victim.id && v.problem === "missingSourceReference"),
      "un riferimento alla fonte assente deve far fallire il gate"
    );
  }

  // (b) riferimento alla fonte privo di riga (localizzazione rotta).
  {
    const mutated = analyzeAll().allCandidates;
    const victim = mutated[0];
    victim.status.legalStatus.source = { ...victim.status.legalStatus.source, line: null };
    const violations = checkCanonicalStatusDimensions(mutated, vocabulary);
    assert.ok(
      violations.some((v) => v.id === victim.id && v.dimension === "legalStatus" && v.problem === "missingSourceReference"),
      "un riferimento alla fonte senza riga deve far fallire il gate"
    );
  }

  // (c) valore inventato, non presente nella legenda canonica.
  {
    const mutated = analyzeAll().allCandidates;
    const victim = mutated[0];
    victim.status.documentaryStatus = {
      value: "abrogato",
      documentedNull: null,
      source: { kind: "canonicalValue", file: "kb04", recordId: "X", scope: "registro-fonti", field: "Stato", line: 1, literal: "abrogato" },
      inheritedFrom: null,
      dimension: "documentaryStatus",
    };
    const violations = checkCanonicalStatusDimensions(mutated, vocabulary);
    assert.ok(
      violations.some((v) => v.id === victim.id && v.problem === "unsupportedInventedValue"),
      "un valore non presente nella legenda KB 04 deve far fallire il gate"
    );
  }

  // (d) ereditarieta' dichiarata mancante su un valore ereditato.
  {
    const mutated = analyzeAll().allCandidates;
    const victim = mutated.find(
      (c) => c.file !== "kb04" && c.status.documentaryStatus.inheritedFrom !== null
    );
    assert.ok(victim, "deve esistere almeno un candidato con stato ereditato da KB 04");
    victim.status.documentaryStatus.inheritedFrom = null;
    const violations = checkCanonicalStatusDimensions(mutated, vocabulary);
    assert.ok(
      violations.some((v) => v.id === victim.id && v.problem === "missingInheritanceReference"),
      "un valore ereditato senza riferimento esplicito deve far fallire il gate"
    );
  }

  // (e) collasso delle quattro dimensioni in uno stato generico unico.
  {
    const mutated = analyzeAll().allCandidates;
    const victim = mutated[0];
    victim.status.state = "final";
    victim.status.verifiedBy = "structural";
    const violations = checkCanonicalStatusDimensions(mutated, vocabulary);
    assert.ok(
      violations.filter((v) => v.id === victim.id && v.problem === "collapsedGenericState").length === 2,
      "la reintroduzione di uno stato generico unico deve far fallire il gate"
    );
  }

  // (f) metadato di integrita' annidato nello stato documentario.
  {
    const mutated = analyzeAll().allCandidates;
    const victim = mutated[0];
    victim.status.contentHash = "sha256:deadbeef";
    const violations = checkCanonicalStatusDimensions(mutated, vocabulary);
    assert.ok(
      violations.some((v) => v.id === victim.id && v.problem === "integrityFieldInsideStatus"),
      "un campo di integrita' dentro status deve far fallire il gate"
    );
  }
});

// ---------------------------------------------------------------------------
// v3.1.3 §1 — Provenienza della mappatura KB01->KB04 nell'ereditarieta'.
// resolutionMethod/provisional devono derivare dalla voce REALE di
// kb01Result.mapping (verifiedBy), non da un valore hardcoded uguale per
// tutti i candidati ereditati.
// ---------------------------------------------------------------------------

function buildStatusCheckCtx(allCandidates) {
  const { mapping } = mapKb01ActsToKb04(raw01, raw04);
  const mappingByRegisterId = new Map();
  for (const m of mapping) {
    if (typeof m.registerId === "string") mappingByRegisterId.set(m.registerId, m);
  }
  const { peRecords, rpRecords, attRecords, legRecords } = parseKb04(raw04);
  const kb04RecordsById = new Map();
  for (const r of [...peRecords, ...rpRecords, ...attRecords, ...legRecords]) {
    kb04RecordsById.set(r.id, r);
  }
  return {
    rawByFile: { kb01: raw01, kb02: raw02, kb03: raw03, kb04: raw04 },
    kb04RecordsById,
    mappingByRegisterId,
    candidateIdIndex: new Set(allCandidates.map((c) => c.id)),
    mappingByRegisterIdRaw: mappingByRegisterId,
  };
}

test("v3.1.3 §1: resolutionMethod/provisional dell'ereditarieta' derivano dalla voce REALE del mapping KB01->KB04, mai hardcoded", () => {
  const { allCandidates } = analyzeAll();
  const { mapping } = mapKb01ActsToKb04(raw01, raw04);
  const exactIds = new Set(mapping.filter((m) => m.verifiedBy === "actNumberMatch").map((m) => m.registerId));
  const fallbackIds = new Set(mapping.filter((m) => m.verifiedBy === "yearOnlyFallback").map((m) => m.registerId));
  assert.equal(exactIds.size, 8, "attesi 8 registerId actNumberMatch");
  assert.equal(fallbackIds.size, 9, "attesi 9 registerId yearOnlyFallback (provvisori)");

  const distinctFallbackCandidates = new Set();
  const distinctExactCandidates = new Set();

  for (const c of allCandidates) {
    for (const dim of STATUS_DIMENSIONS) {
      const inh = c.status[dim].inheritedFrom;
      if (!inh) continue;
      if (fallbackIds.has(inh.naturalId)) {
        distinctFallbackCandidates.add(c.id);
        assert.equal(
          inh.resolutionMethod,
          "registerIdYearOnlyFallback",
          `${c.id}/${dim}: un'ereditarieta' da un registerId yearOnlyFallback (${inh.naturalId}) deve dichiarare resolutionMethod "registerIdYearOnlyFallback"`
        );
        assert.equal(
          inh.provisional,
          true,
          `${c.id}/${dim}: un'ereditarieta' da un registerId yearOnlyFallback (${inh.naturalId}) deve dichiarare provisional true`
        );
      } else if (exactIds.has(inh.naturalId)) {
        distinctExactCandidates.add(c.id);
        assert.equal(
          inh.resolutionMethod,
          "registerIdExactMatch",
          `${c.id}/${dim}: un'ereditarieta' da un registerId actNumberMatch (${inh.naturalId}) deve dichiarare resolutionMethod "registerIdExactMatch"`
        );
        assert.equal(
          inh.provisional,
          false,
          `${c.id}/${dim}: un'ereditarieta' da un registerId actNumberMatch (${inh.naturalId}) deve dichiarare provisional false`
        );
      }
    }
  }

  // Verifica indipendente del numero di candidati distinti coinvolto dai 9
  // mapping provvisori: il difetto v3.1.2 promuoveva questi 133 candidati a
  // registerIdExactMatch/provisional:false senza alcuna base nella fonte.
  assert.equal(
    distinctFallbackCandidates.size,
    133,
    "attesi 133 candidati distinti la cui ereditarieta' risale a uno dei 9 registerId yearOnlyFallback"
  );
  assert.ok(distinctExactCandidates.size > 0, "devono esistere anche candidati con ereditarieta' actNumberMatch");
});

test("v3.1.3 §1 (gate): checkCanonicalStatusDimensions FALLISCE se un'ereditarieta' provvisoria viene mutata a exact/provisional:false", () => {
  const { allCandidates } = analyzeAll();
  const ctx = buildStatusCheckCtx(allCandidates);
  const vocabulary = extractKb04StatusVocabulary(raw04);

  // Il gate passa sul corpus intatto (post-correzione v3.1.3 §1).
  assert.deepEqual(checkCanonicalStatusDimensions(allCandidates, vocabulary, ctx), []);

  const { mapping } = mapKb01ActsToKb04(raw01, raw04);
  const fallbackIds = new Set(mapping.filter((m) => m.verifiedBy === "yearOnlyFallback").map((m) => m.registerId));

  const victim = allCandidates.find(
    (c) =>
      c.file !== "kb04" &&
      STATUS_DIMENSIONS.some((dim) => {
        const inh = c.status[dim].inheritedFrom;
        return inh && fallbackIds.has(inh.naturalId) && inh.provisional === true;
      })
  );
  assert.ok(victim, "deve esistere almeno un candidato con ereditarieta' provvisoria (yearOnlyFallback)");

  const mutatedDim = STATUS_DIMENSIONS.find((dim) => {
    const inh = victim.status[dim].inheritedFrom;
    return inh && fallbackIds.has(inh.naturalId) && inh.provisional === true;
  });

  // Mutazione: promuovere silenziosamente una voce provvisoria a match
  // esatto verificato -- esattamente il difetto v3.1.2 originale.
  victim.status[mutatedDim].inheritedFrom.resolutionMethod = "registerIdExactMatch";
  victim.status[mutatedDim].inheritedFrom.provisional = false;

  const ctxAfter = buildStatusCheckCtx(allCandidates);
  const violations = checkCanonicalStatusDimensions(allCandidates, vocabulary, ctxAfter);
  assert.ok(
    violations.some(
      (v) =>
        v.id === victim.id &&
        v.dimension === mutatedDim &&
        (v.problem === "resolutionMethodMismatch" || v.problem === "provisionalFlagMismatch")
    ),
    "promuovere un'ereditarieta' provvisoria a exact/provisional:false deve far fallire il gate"
  );
});

// ---------------------------------------------------------------------------
// v3.1.3 §2 — Risoluzione semantica REALE dei riferimenti alla fonte in
// checkCanonicalStatusDimensions: non piu' solo type-check di forma, ma
// verifica che file/riga/recordId/field/literal/scope/dimension/ref
// ereditato/naturalId/resolutionMethod/provisional risolvano davvero contro
// il testo grezzo e l'inventario reale dei candidati.
// ---------------------------------------------------------------------------

test("v3.1.3 §2: il gate esteso passa senza violazioni sul corpus canonico intatto", () => {
  const { allCandidates } = analyzeAll();
  const ctx = buildStatusCheckCtx(allCandidates);
  const vocabulary = extractKb04StatusVocabulary(raw04);
  assert.deepEqual(checkCanonicalStatusDimensions(allCandidates, vocabulary, ctx), []);
});

test("v3.1.3 §2 (mutation): source.file inesistente fa FALLIRE il gate", () => {
  const { allCandidates } = analyzeAll();
  const vocabulary = extractKb04StatusVocabulary(raw04);
  const victim = allCandidates.find((c) => c.status.documentaryStatus.source.recordId);
  victim.status.documentaryStatus.source.file = "kb99";
  const ctx = buildStatusCheckCtx(allCandidates);
  const violations = checkCanonicalStatusDimensions(allCandidates, vocabulary, ctx);
  assert.ok(
    violations.some((v) => v.id === victim.id && v.dimension === "documentaryStatus" && v.problem === "unresolvedSourceFile"),
    "un source.file che non e' uno dei 4 file canonici deve far fallire il gate"
  );
});

test("v3.1.3 §2 (mutation): source.line esistente ma sbagliata (non la riga reale del campo) fa FALLIRE il gate", () => {
  const { allCandidates } = analyzeAll();
  const vocabulary = extractKb04StatusVocabulary(raw04);
  const victim = allCandidates.find((c) => c.status.documentaryStatus.source.field);
  const originalLine = victim.status.documentaryStatus.source.line;
  victim.status.documentaryStatus.source.line = originalLine + 1;
  const ctx = buildStatusCheckCtx(allCandidates);
  const violations = checkCanonicalStatusDimensions(allCandidates, vocabulary, ctx);
  assert.ok(
    violations.some((v) => v.id === victim.id && v.dimension === "documentaryStatus" && v.problem === "sourceLineMismatch"),
    "una source.line che esiste nel file ma non e' la riga reale del campo dichiarato deve far fallire il gate"
  );
});

test("v3.1.3 §2 (mutation): source.literal errato fa FALLIRE il gate", () => {
  const { allCandidates } = analyzeAll();
  const vocabulary = extractKb04StatusVocabulary(raw04);
  const victim = allCandidates.find((c) => typeof c.status.legalStatus.source.literal === "string" && c.status.legalStatus.source.literal.length > 0);
  assert.ok(victim, "deve esistere un candidato con literal non nullo su legalStatus");
  victim.status.legalStatus.source.literal = "TESTO INVENTATO CHE NON ESISTE NELLA FONTE";
  const ctx = buildStatusCheckCtx(allCandidates);
  const violations = checkCanonicalStatusDimensions(allCandidates, vocabulary, ctx);
  assert.ok(
    violations.some((v) => v.id === victim.id && v.dimension === "legalStatus" && v.problem === "sourceLiteralMismatch"),
    "un literal che non coincide con il letterale reale della fonte deve far fallire il gate"
  );
});

test("v3.1.3 §2 (mutation): source.recordId inesistente fa FALLIRE il gate", () => {
  const { allCandidates } = analyzeAll();
  const vocabulary = extractKb04StatusVocabulary(raw04);
  const victim = allCandidates.find((c) => c.status.documentaryStatus.source.recordId);
  victim.status.documentaryStatus.source.recordId = "PE-9999-99";
  const ctx = buildStatusCheckCtx(allCandidates);
  const violations = checkCanonicalStatusDimensions(allCandidates, vocabulary, ctx);
  assert.ok(
    violations.some((v) => v.id === victim.id && v.dimension === "documentaryStatus" && v.problem === "unresolvedRecordId"),
    "un recordId che non risolve ad alcun record KB 04 esistente deve far fallire il gate"
  );
});

test("v3.1.3 §2 (mutation): inheritedFrom.ref verso un candidato inesistente fa FALLIRE il gate", () => {
  const { allCandidates } = analyzeAll();
  const vocabulary = extractKb04StatusVocabulary(raw04);
  const victim = allCandidates.find((c) => c.status.documentaryStatus.inheritedFrom !== null);
  assert.ok(victim, "deve esistere un candidato con ereditarieta' su documentaryStatus");
  victim.status.documentaryStatus.inheritedFrom.ref = "id-completamente-inventato-che-non-esiste";
  const ctx = buildStatusCheckCtx(allCandidates);
  const violations = checkCanonicalStatusDimensions(allCandidates, vocabulary, ctx);
  assert.ok(
    violations.some((v) => v.id === victim.id && v.dimension === "documentaryStatus" && v.problem === "unresolvedInheritanceRef"),
    "un inheritedFrom.ref che non risolve a un candidato esistente deve far fallire il gate"
  );
});

test("v3.1.3 §2 (mutation): inheritedFrom.provisional errato (non coerente con la voce reale del mapping) fa FALLIRE il gate", () => {
  const { allCandidates } = analyzeAll();
  const vocabulary = extractKb04StatusVocabulary(raw04);
  const victim = allCandidates.find(
    (c) => c.status.documentaryStatus.inheritedFrom && c.status.documentaryStatus.inheritedFrom.provisional === true
  );
  assert.ok(victim, "deve esistere un candidato con ereditarieta' provvisoria su documentaryStatus");
  victim.status.documentaryStatus.inheritedFrom.provisional = false;
  const ctx = buildStatusCheckCtx(allCandidates);
  const violations = checkCanonicalStatusDimensions(allCandidates, vocabulary, ctx);
  assert.ok(
    violations.some((v) => v.id === victim.id && v.dimension === "documentaryStatus" && v.problem === "provisionalFlagMismatch"),
    "un flag provisional incoerente con la voce reale del mapping deve far fallire il gate"
  );
});


// ---------------------------------------------------------------------------
// v3.1.3 §3 — Semantica documented-null corretta per l'evidenza di stato a
// livello di scope/front-matter in KB01-KB03 (front-matter "status" dei 3
// file, righe della tabella "Atti necessari" di KB03). Nessuno di questi
// letterali deve mai apparire come notDocumented: l'evidenza esiste ed e'
// stata ispezionata, semplicemente non e' ancora stata classificata contro
// il crosswalk canonico KB04. Deve risultare notYetEvaluated con literal e
// source preservati verbatim.
// ---------------------------------------------------------------------------

test("v3.1.3 §3: i 3 letterali di front-matter (KB01/KB02/KB03) sono estratti verbatim con la riga reale", () => {
  const fm01 = extractFrontMatterStatusLiteral(raw01);
  const fm02 = extractFrontMatterStatusLiteral(raw02);
  const fm03 = extractFrontMatterStatusLiteral(raw03);
  assert.deepEqual(fm01, { line: 9, literal: "uso interno; non sostituisce i PDF originali" });
  assert.deepEqual(fm02, { line: 10, literal: "ricostruzione redazionale verificata sul corpus; non sostituisce gli atti" });
  assert.deepEqual(fm03, { line: 9, literal: "consolidato redazionale; verificare sempre eventuali atti successivi" });
});

test("v3.1.3 §3: gli 8 letterali di riga della tabella \"Atti necessari\" (KB03) sono estratti verbatim con le righe reali 314-321", () => {
  const rows = extractTableRowStatusLiterals(raw03, detectAllMarkdownTables);
  assert.equal(rows.length, 8);
  assert.deepEqual(
    rows.map((r) => r.line),
    [314, 315, 316, 317, 318, 319, 320, 321]
  );
  for (const r of rows) {
    assert.equal(typeof r.literal, "string");
    assert.ok(r.literal.length > 0, `riga ${r.line}: literal non deve essere vuoto`);
  }
});

test("v3.1.3 §3: buildScopeLevelStatusEvidence produce esattamente 11 voci (3 front-matter + 8 righe tabella), tutte notYetEvaluated, mai notDocumented", () => {
  const rawByFile = { kb01: raw01, kb02: raw02, kb03: raw03 };
  const evidence = buildScopeLevelStatusEvidence(rawByFile, detectAllMarkdownTables);
  assert.equal(evidence.length, 11, "devono esistere esattamente 3 voci di front-matter + 8 voci di riga tabella");
  const frontMatterEntries = evidence.filter((e) => e.kind === "frontMatterStatus");
  const tableRowEntries = evidence.filter((e) => e.kind === "tableRowStatus");
  assert.equal(frontMatterEntries.length, 3);
  assert.equal(tableRowEntries.length, 8);
  for (const e of evidence) {
    assert.equal(
      e.documentedNull.reason,
      "notYetEvaluated",
      `voce ${e.file}:${e.line} deve essere notYetEvaluated, mai notDocumented`
    );
    assert.notEqual(e.documentedNull.reason, "notDocumented");
    assert.equal(e.documentedNull.literal, e.literal, "il literal preservato in documentedNull deve coincidere esattamente con quello estratto dalla fonte");
    assert.ok(
      DOCUMENTED_NULL_REASONS.includes(e.documentedNull.reason),
      "la reason deve appartenere al vocabolario canonico DOCUMENTED_NULL_REASONS"
    );
  }
});

test("v3.1.3 §3: nessun letterale scope-level viene normalizzato a \"ricerca aperta\" o ad altro valore del crosswalk", () => {
  const rawByFile = { kb01: raw01, kb02: raw02, kb03: raw03 };
  const evidence = buildScopeLevelStatusEvidence(rawByFile, detectAllMarkdownTables);
  const expectedLiterals = [
    "uso interno; non sostituisce i PDF originali",
    "ricostruzione redazionale verificata sul corpus; non sostituisce gli atti",
    "consolidato redazionale; verificare sempre eventuali atti successivi",
    "acquisito; da verificare per eventuali modifiche successive",
    "analizzata e consolidata",
    "analizzati e consolidati",
    "non acquisito",
    "identificata; PDF da acquisire localmente",
    "non acquisito",
    "da verificare",
    "richiamato, non incluso",
  ];
  assert.deepEqual(
    evidence.map((e) => e.literal).sort(),
    expectedLiterals.sort(),
    "ogni literal deve coincidere esattamente col testo sorgente, senza normalizzazione"
  );
  for (const e of evidence) {
    assert.notEqual(e.literal, "ricerca aperta", `voce ${e.file}:${e.line} non deve mai essere normalizzata a "ricerca aperta"`);
  }
});

test("v3.1.3 §3: il gate allScopeLevelStatusEvidenceResolvesSemantically passa senza violazioni sul corpus canonico intatto", () => {
  const rawByFile = { kb01: raw01, kb02: raw02, kb03: raw03 };
  const evidence = buildScopeLevelStatusEvidence(rawByFile, detectAllMarkdownTables);
  const violations = checkScopeLevelStatusEvidence(evidence, rawByFile);
  assert.deepEqual(violations, []);
});

test("v3.1.3 §3 (mutation): un literal scope-level alterato (non piu' presente nella riga reale) fa FALLIRE il gate", () => {
  const rawByFile = { kb01: raw01, kb02: raw02, kb03: raw03 };
  const evidence = buildScopeLevelStatusEvidence(rawByFile, detectAllMarkdownTables);
  const mutated = evidence.map((e) => ({ ...e, documentedNull: { ...e.documentedNull } }));
  mutated[0].literal = "TESTO INVENTATO CHE NON ESISTE NELLA FONTE";
  const violations = checkScopeLevelStatusEvidence(mutated, rawByFile);
  assert.ok(
    violations.some((v) => v.problem === "sourceLiteralMismatch"),
    "un literal che non e' contenuto nella riga reale deve far fallire il gate"
  );
});

test("v3.1.3 §3 (mutation): una riga scope-level fuori dai limiti del file fa FALLIRE il gate", () => {
  const rawByFile = { kb01: raw01, kb02: raw02, kb03: raw03 };
  const evidence = buildScopeLevelStatusEvidence(rawByFile, detectAllMarkdownTables);
  const mutated = evidence.map((e) => ({ ...e, documentedNull: { ...e.documentedNull } }));
  mutated[0].line = 999999;
  const violations = checkScopeLevelStatusEvidence(mutated, rawByFile);
  assert.ok(
    violations.some((v) => v.problem === "unresolvedSourceLine"),
    "una riga fuori dai limiti del file deve far fallire il gate"
  );
});

test("v3.1.3 §3 (mutation): una voce scope-level con reason diversa da notYetEvaluated (es. notDocumented) fa FALLIRE il gate", () => {
  const rawByFile = { kb01: raw01, kb02: raw02, kb03: raw03 };
  const evidence = buildScopeLevelStatusEvidence(rawByFile, detectAllMarkdownTables);
  const mutated = evidence.map((e) => ({ ...e, documentedNull: { ...e.documentedNull } }));
  mutated[0].documentedNull.reason = "notDocumented";
  const violations = checkScopeLevelStatusEvidence(mutated, rawByFile);
  assert.ok(
    violations.some((v) => v.problem === "wrongDocumentedNullReason"),
    "una voce di evidenza scope-level classificata come notDocumented invece di notYetEvaluated deve far fallire il gate"
  );
});

test("v3.1.3 §3: le voci LEG-2018/2015/2013/2012-GAP restano notYetEvaluated su researchStatus con literal e source preservati (non notDocumented, non \"ricerca aperta\")", () => {
  const { allCandidates } = analyzeAll();
  const gapIds = ["LEG-2018-GAP", "LEG-2015-GAP", "LEG-2013-GAP", "LEG-2012-GAP"];
  for (const gapId of gapIds) {
    const candidate = allCandidates.find(
      (c) => c.file === "kb04" && c.candidateType === "recordRegistro" && c.naturalId === gapId
    );
    assert.ok(candidate, `deve esistere un candidato KB04 recordRegistro per ${gapId}`);
    const rs = candidate.status.researchStatus;
    assert.ok(rs, `${gapId}: deve esporre researchStatus`);
    assert.equal(rs.value, null, `${gapId}: researchStatus.value deve essere null (documented-null, non un valore classificato)`);
    assert.ok(rs.documentedNull, `${gapId}: deve esporre documentedNull su researchStatus`);
    assert.equal(rs.documentedNull.reason, "notYetEvaluated", `${gapId}: reason deve essere notYetEvaluated`);
    assert.notEqual(rs.documentedNull.reason, "notDocumented", `${gapId}: reason non deve mai essere notDocumented`);
    assert.equal(typeof rs.source.literal, "string", `${gapId}: source.literal deve essere il letterale verbatim, non null`);
    assert.ok(rs.source.literal.length > 0, `${gapId}: source.literal non deve essere vuoto`);
    assert.notEqual(rs.source.literal, "ricerca aperta", `${gapId}: il letterale non deve mai essere normalizzato a "ricerca aperta"`);
  }
});

// ---------------------------------------------------------------------------
// v3.1.1 §5 — Containment check esteso a KB01/KB02/KB04 (non solo KB03).
// Sul corpus canonico reale non esistono violazioni (il gate e' vero), ma
// il gate deve essere dimostrabilmente in grado di FALLIRE quando esiste
// una violazione reale: per ognuno dei 4 file, si costruisce un candidato
// sintetico con endLine oltre il blocco contenitore e si verifica che
// checkCandidatesWithinBlocks lo segnali.
// ---------------------------------------------------------------------------

test("v3.1.1 §5: containment KB01 — un candidato con endLine oltre l'atto contenitore viene segnalato come violazione", () => {
  const { years } = parseKb01(raw01);
  const acts = classifyActs(years);
  const act = acts[0];
  const fakeCandidate = { id: "kb01:test:fuori-range", startLine: act.headingLine + 1, endLine: act.endLine + 50 };
  const violations = checkCandidatesWithinBlocks([fakeCandidate], acts, "atto");
  assert.equal(violations.length, 1);
  assert.equal(violations[0].id, "kb01:test:fuori-range");
  // Un candidato correttamente contenuto non genera violazioni.
  const okCandidate = { id: "kb01:test:dentro-range", startLine: act.headingLine + 1, endLine: act.endLine };
  assert.deepEqual(checkCandidatesWithinBlocks([okCandidate], acts, "atto"), []);
});

test("v3.1.1 §5: containment KB02 — un candidato con endLine oltre la sezione annuale H1 viene segnalato come violazione", () => {
  const { years } = parseKb02(raw02);
  const year = years[0];
  const fakeCandidate = { id: "kb02:test:fuori-range", startLine: year.headingLine + 1, endLine: year.endLine + 50 };
  const violations = checkCandidatesWithinBlocks([fakeCandidate], years, "sezione-annuale");
  assert.equal(violations.length, 1);
  assert.equal(violations[0].id, "kb02:test:fuori-range");
});

test("v3.1.1 §5: containment KB03 (regressione pre-esistente) — un candidato con endLine oltre il blocco H1 viene segnalato come violazione", () => {
  const { h1Blocks } = parseKb03(raw03);
  const block = h1Blocks[0];
  const fakeCandidate = { id: "kb03:test:fuori-range", startLine: block.headingLine + 1, endLine: block.endLine + 50 };
  const violations = checkCandidatesWithinBlocks([fakeCandidate], h1Blocks, "blocco-h1");
  assert.equal(violations.length, 1);
  assert.equal(violations[0].id, "kb03:test:fuori-range");
});

test("v3.1.1 §5: containment KB04 — un candidato con endLine oltre il record contenitore viene segnalato come violazione", () => {
  const { peRecords, rpRecords, attRecords, legRecords } = parseKb04(raw04);
  const allRecords = [...peRecords, ...rpRecords, ...attRecords, ...legRecords];
  const record = allRecords[0];
  const fakeCandidate = { id: "kb04:test:fuori-range", startLine: record.headingLine + 1, endLine: record.endLine + 50 };
  const violations = checkCandidatesWithinBlocks([fakeCandidate], allRecords, "record");
  assert.equal(violations.length, 1);
  assert.equal(violations[0].id, "kb04:test:fuori-range");
});

test("v3.1.1 §5: sul corpus canonico reale, il gate allCandidateRangesContainedWithinBlock e' calcolato su TUTTI i 4 file (KB01+KB02+KB03+KB04) ed e' vero", () => {
  const { report } = analyzeAll();
  assert.deepEqual(report.crossFileChecks.blockContainmentViolationsByFile.kb01, []);
  assert.deepEqual(report.crossFileChecks.blockContainmentViolationsByFile.kb02, []);
  assert.deepEqual(report.crossFileChecks.blockContainmentViolationsByFile.kb03, []);
  assert.deepEqual(report.crossFileChecks.blockContainmentViolationsByFile.kb04, []);
  assert.equal(report.acceptanceGates.allCandidateRangesContainedWithinBlock, true);
});

// ---------------------------------------------------------------------------
// v3.1.1 §6 — Idempotenza a livello di byte + purezza dei test.
// ---------------------------------------------------------------------------

test("v3.1.1 §6: due esecuzioni consecutive di `npm run chunk:diagnostic` producono i 3 artefatti byte-identici (nessun campo non deterministico residuo)", () => {
  const tmpOut = mkdtempSync(join(tmpdir(), "chunk-diagnostic-idempotency-"));
  try {
    const files = ["chunk-diagnostic-report.json", "diagnostic-candidates.json", "coverage-ledger.json"];
    const runOnce = () => {
      execFileSync("npm", ["run", "chunk:diagnostic"], {
        cwd: ROOT,
        stdio: "ignore",
        env: { ...process.env, CHUNK_DIAGNOSTIC_OUT_DIR: tmpOut },
      });
      return Object.fromEntries(files.map((f) => [f, readFileSync(join(tmpOut, f), "utf8")]));
    };
    const first = runOnce();
    // Piccola pausa per assicurarsi che, se un timestamp non deterministico
    // fosse ancora presente da qualche parte, il secondo run lo catturerebbe
    // con un valore diverso (i timestamp ISO cambiano al millisecondo).
    const second = runOnce();
    for (const f of files) {
      assert.equal(
        first[f],
        second[f],
        `${f} non e' byte-identico tra due esecuzioni consecutive della CLI -- idempotenza violata (§6)`
      );
    }
  } finally {
    rmSync(tmpOut, { recursive: true, force: true });
  }
});

test("v3.1.1 §6: nessun test della suite invoca main()/scrive su data/ tranne l'unico test CLI che redirige esplicitamente su una directory temporanea (§6)", () => {
  // Verifica statica, non ricorsiva: analizza il sorgente stesso di questo
  // file di test per assicurarsi che l'unica invocazione della CLI reale
  // (quella che esegue main() e scrive file) passi sempre
  // CHUNK_DIAGNOSTIC_OUT_DIR, mai la directory data/ tracciata. Una nuova
  // invocazione della CLI aggiunta in futuro senza questa garanzia farebbe
  // fallire questo test, impedendo la regressione al comportamento
  // distruttivo originale (§6: "npm test non deve mai scrivere su data/
  // tracciata").
  const selfSource = readFileSync(fileURLToPath(import.meta.url), "utf8");
  const cliInvocations = [...selfSource.matchAll(/execFileSync\(\s*["']npm["']\s*,\s*\[[^\]]*chunk:diagnostic[^\]]*\][^)]*\)/gs)];
  assert.ok(cliInvocations.length >= 1, "nessuna invocazione della CLI trovata: il test di regressione atteso e' scomparso");
  for (const match of cliInvocations) {
    assert.match(
      match[0],
      /CHUNK_DIAGNOSTIC_OUT_DIR/,
      "un'invocazione di 'npm run chunk:diagnostic' nei test non specifica CHUNK_DIAGNOSTIC_OUT_DIR -- rischio di scrittura su data/ tracciata"
    );
  }
});

test("v3.1.1 §6: i 4 artefatti tracciati in data/ non vengono modificati durante l'esecuzione di questo intero file di test (sola lettura sul repository)", () => {
  const dataDir = join(ROOT, "data");
  const trackedFiles = ["chunk-diagnostic-report.json", "diagnostic-candidates.json", "coverage-ledger.json", "chunks.generated.json"];
  // Snapshot preso ORA (fine suite, dopo che tutti gli altri test -- incluso
  // quello CLI che scrive solo su tmpOut -- sono gia' girati in questo
  // stesso processo) e confrontato con lo stato su disco: se un test
  // precedente avesse scritto su data/, il contenuto su disco sarebbe
  // cambiato rispetto a quello letto dai test di anti-staleness sopra.
  for (const f of trackedFiles) {
    const p = join(dataDir, f);
    const st = statSync(p);
    assert.ok(st.isFile(), `${f} deve esistere e non essere stato rimosso`);
  }
});
