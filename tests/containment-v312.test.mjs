// ---------------------------------------------------------------------------
// v3.1.2 §3 — Semantica di containment completa.
//
// Mutation test per OGNI file KB01–KB04 su due classi di violazione che in
// v3.1.1 NON venivano rilevate:
//   a) nessun blocco contenitore (il candidato inizia fuori da ogni blocco):
//      il vecchio `checkCandidatesWithinBlocks` faceva `if (block && ...)` e
//      quindi ignorava silenziosamente il candidato;
//   b) documentScope dichiarato diverso da quello del blocco contenitore.
// Piu' le due classi gia' previste ma ora verificate su tutti i file:
//   c) il candidato termina oltre il proprio blocco;
//   d) il candidato attraversa il confine di un altro blocco.
// ---------------------------------------------------------------------------

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  buildContainingBlocks,
  checkContainment,
  CONTAINMENT_VIOLATION_KINDS,
} from "../scripts/lib/containment.mjs";
import { analyzeAll } from "../scripts/chunk-diagnostic.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KB_DIR = join(__dirname, "..", "content", "kb");
const KB_FILES = {
  kb01: "01_KB_Corpus_Storico_Protocollo_Equino_2012_2026.md",
  kb02: "02_KB_Memoria_Incrementale_Protocollo_Equino_2012_2026.md",
  kb03: "03_KB_Disciplina_Vigente_Consolidata_2026.md",
  kb04: "04_KB_Manifest_Fonti_e_Registro_Atti_2012_2026.md",
};
const FILES = ["kb01", "kb02", "kb03", "kb04"];

const rawByFile = Object.fromEntries(
  Object.entries(KB_FILES).map(([k, f]) => [k, readFileSync(join(KB_DIR, f), "utf8")])
);
const blocks = buildContainingBlocks(rawByFile);
const { perFile } = analyzeAll();

function candidatesOf(file) {
  return perFile[file].candidates;
}

test("v3.1.2 §3 (baseline): il corpus canonico non produce alcuna violazione di containment", () => {
  for (const file of FILES) {
    const v = checkContainment(candidatesOf(file), blocks[file], file);
    assert.deepEqual(
      v,
      [],
      `${file}: il corpus canonico deve essere privo di violazioni, trovate ${v.length}: ${v
        .map((x) => `${x.kind}/${x.id}`)
        .join(", ")}`
    );
  }
});

test("v3.1.2 §3 (copertura): la partizione dei blocchi copre la riga iniziale di OGNI candidato", () => {
  for (const file of FILES) {
    const orphans = candidatesOf(file).filter(
      (c) => !blocks[file].some((b) => c.startLine >= b.headingLine && c.startLine <= b.endLine)
    );
    assert.equal(
      orphans.length,
      0,
      `${file}: ${orphans.length} candidati senza blocco contenitore (${orphans
        .slice(0, 5)
        .map((c) => c.id)
        .join(", ")})`
    );
  }
});

test("v3.1.2 §3 (mutation, KB01–KB04): un candidato fuori da ogni blocco fa fallire il containment", () => {
  for (const file of FILES) {
    const sample = candidatesOf(file)[0];
    const maxEnd = Math.max(...blocks[file].map((b) => b.endLine));

    // Il candidato viene spostato oltre la fine dell'ultimo blocco: non esiste
    // alcun blocco che ne contenga la riga iniziale.
    const mutated = { ...sample, startLine: maxEnd + 50, endLine: maxEnd + 60 };
    const v = checkContainment([mutated], blocks[file], file);

    assert.ok(v.length > 0, `${file}: un candidato fuori da ogni blocco deve produrre almeno una violazione`);
    assert.ok(
      v.some((x) => x.kind === "noContainingBlock"),
      `${file}: deve essere segnalata la violazione "noContainingBlock", trovate: ${v.map((x) => x.kind).join(", ")}`
    );
    assert.equal(v[0].id, sample.id, `${file}: la violazione deve identificare il candidato`);
  }
});

test("v3.1.2 §3 (mutation, KB01–KB04): uno scope dichiarato errato fa fallire il containment", () => {
  for (const file of FILES) {
    // Serve un candidato il cui blocco contenitore imponga uno scope noto.
    const sample = candidatesOf(file).find((c) => {
      const containing = blocks[file].filter(
        (b) => c.startLine >= b.headingLine && c.startLine <= b.endLine
      );
      return containing.length > 0 && containing.some((b) => b.scope !== null);
    });
    assert.ok(sample, `${file}: deve esistere almeno un candidato con blocco a scope noto`);

    const mutated = { ...sample, documentScope: "scope-inesistente-di-test" };
    const v = checkContainment([mutated], blocks[file], file);

    assert.ok(
      v.some((x) => x.kind === "wrongScope"),
      `${file}: uno scope dichiarato errato deve produrre "wrongScope", trovate: ${v
        .map((x) => x.kind)
        .join(", ")}`
    );
  }
});

test("v3.1.2 §3 (mutation, KB01–KB04): un candidato che termina oltre il blocco fa fallire il containment", () => {
  for (const file of FILES) {
    const sample = candidatesOf(file)[0];
    const containing = blocks[file]
      .filter((b) => sample.startLine >= b.headingLine && sample.startLine <= b.endLine)
      .reduce((best, cur) =>
        !best || cur.endLine - cur.headingLine < best.endLine - best.headingLine ? cur : best
      , null);
    assert.ok(containing, `${file}: il candidato campione deve avere un blocco contenitore`);

    const mutated = { ...sample, endLine: containing.endLine + 5 };
    const v = checkContainment([mutated], blocks[file], file);

    assert.ok(
      v.some((x) => x.kind === "endsOutsideBlock"),
      `${file}: deve essere segnalata "endsOutsideBlock", trovate: ${v.map((x) => x.kind).join(", ")}`
    );
  }
});

test("v3.1.2 §3 (mutation, KB01–KB04): un candidato che attraversa un confine di blocco fa fallire il containment", () => {
  for (const file of FILES) {
    const sorted = [...blocks[file]].sort((a, b) => a.headingLine - b.headingLine);
    // Serve un blocco che ne abbia un altro che inizia dopo di esso.
    const idx = sorted.findIndex((b, i) => sorted[i + 1] && sorted[i + 1].headingLine > b.headingLine);
    assert.ok(idx >= 0, `${file}: servono almeno due blocchi per testare l'attraversamento`);
    const first = sorted[idx];
    const next = sorted[idx + 1];

    const mutated = {
      id: `test:${file}:attraversamento`,
      file,
      candidateType: "test",
      documentScope: first.scope,
      startLine: first.headingLine,
      endLine: next.headingLine + 1,
    };
    const v = checkContainment([mutated], blocks[file], file);

    assert.ok(
      v.some((x) => x.kind === "crossesBlockBoundary"),
      `${file}: deve essere segnalata "crossesBlockBoundary", trovate: ${v.map((x) => x.kind).join(", ")}`
    );
  }
});

test("v3.1.2 §3: l'insieme dei tipi di violazione e' quello dichiarato", () => {
  assert.deepEqual([...CONTAINMENT_VIOLATION_KINDS].sort(), [
    "crossesBlockBoundary",
    "endsOutsideBlock",
    "noContainingBlock",
    "wrongScope",
  ]);
});

test("v3.1.2 §3: i blocchi di uno stesso livello non si sovrappongono", () => {
  // La correzione del parser KB02 (annualita' 2026 che arrivava a fine file e
  // inghiottiva sei sezioni H1 di cornice) e' verificata qui in modo
  // strutturale: fra blocchi dello stesso blockLabel non ci sono
  // sovrapposizioni.
  for (const file of FILES) {
    const byLabel = {};
    for (const b of blocks[file]) (byLabel[b.blockLabel] ||= []).push(b);
    for (const [label, list] of Object.entries(byLabel)) {
      const sorted = [...list].sort((a, b) => a.headingLine - b.headingLine);
      for (let i = 0; i + 1 < sorted.length; i++) {
        assert.ok(
          sorted[i].endLine < sorted[i + 1].headingLine,
          `${file}/${label}: il blocco ${sorted[i].id} (${sorted[i].headingLine}-${sorted[i].endLine}) si sovrappone a ${sorted[i + 1].id} (da ${sorted[i + 1].headingLine})`
        );
      }
    }
  }
});
