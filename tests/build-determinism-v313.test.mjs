// ---------------------------------------------------------------------------
// v3.1.3 §5 — Determinismo dell'albero di build.
//
// Il mandato v3.1.3 richiede che `npm run build`:
//  a) non modifichi alcun file tracciato del repository (tutto cio' che non
//     e' escluso da .gitignore: dist/, .astro/, node_modules/, .env*, *.log,
//     .netlify/, .DS_Store, data/embeddings.generated.f32);
//  b) produca, in due esecuzioni consecutive, un data/chunks.generated.json
//     byte-identico (il placeholder non deve contenere alcun timestamp o
//     altro valore non deterministico).
//
// Questi test eseguono la build reale (npm run build) nel repository di
// lavoro stesso, non in una copia temporanea: il comando scrive solo
// data/chunks.generated.json (tracciato, deterministico) e dist/ (ignorato),
// quindi eseguirlo qui e' sicuro e rappresentativo dell'ambiente reale.
// ---------------------------------------------------------------------------

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Stessa lista di esclusioni di .gitignore, piu' i due segnaposto di lock
// che npm potrebbe toccare in ambienti diversi (non rilevanti qui: la CI di
// questo repo non esegue npm install durante il test).
const IGNORED_TOP_LEVEL = new Set([
  "node_modules",
  "dist",
  ".astro",
  ".netlify",
  ".git",
]);
const IGNORED_FILE_PATTERNS = [
  /^\.env(\..*)?$/,
  /\.log$/,
  /^\.DS_Store$/,
];
const IGNORED_RELATIVE_PATHS = new Set(["data/embeddings.generated.f32"]);

function isIgnored(relPath) {
  const parts = relPath.split("/");
  if (IGNORED_TOP_LEVEL.has(parts[0])) return true;
  const base = parts[parts.length - 1];
  if (IGNORED_FILE_PATTERNS.some((re) => re.test(base))) return true;
  if (IGNORED_RELATIVE_PATHS.has(relPath)) return true;
  return false;
}

/** Cammina l'albero del repository e produce una mappa relPath -> {mtimeMs, size, sha}
 *  per ogni file NON ignorato. Usato per dimostrare che npm run build non
 *  modifica alcun file tracciato (confronto sia di dimensione/mtime sia di
 *  contenuto byte-per-byte per i soli file toccabili). */
import { createHash } from "node:crypto";

function snapshotTree(dirAbs, dirRel = "") {
  const out = new Map();
  for (const entry of readdirSync(dirAbs, { withFileTypes: true })) {
    const relPath = dirRel ? `${dirRel}/${entry.name}` : entry.name;
    if (isIgnored(relPath)) continue;
    const abs = join(dirAbs, entry.name);
    if (entry.isDirectory()) {
      for (const [k, v] of snapshotTree(abs, relPath)) out.set(k, v);
    } else if (entry.isFile()) {
      const buf = readFileSync(abs);
      out.set(relPath, {
        size: buf.length,
        sha: createHash("sha256").update(buf).digest("hex"),
      });
    }
  }
  return out;
}

test("v3.1.3 §5: npm run build non modifica alcun file tracciato del repository", () => {
  const before = snapshotTree(ROOT);

  execFileSync("npm", ["run", "build"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, AI_ENABLED: "false" },
  });

  const after = snapshotTree(ROOT);

  assert.deepEqual(
    [...before.keys()].sort(),
    [...after.keys()].sort(),
    "npm run build non deve creare né eliminare file tracciati"
  );

  const changed = [];
  for (const [relPath, beforeInfo] of before) {
    const afterInfo = after.get(relPath);
    if (afterInfo.sha !== beforeInfo.sha) changed.push(relPath);
  }

  assert.deepEqual(
    changed,
    [],
    `npm run build ha modificato file tracciati inattesi: ${changed.join(", ")}`
  );
});

test("v3.1.3 §5: due build consecutive producono un data/chunks.generated.json byte-identico", () => {
  const chunksPath = join(ROOT, "data", "chunks.generated.json");

  execFileSync("npm", ["run", "build"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, AI_ENABLED: "false" },
  });
  const firstRun = readFileSync(chunksPath, "utf8");

  execFileSync("npm", ["run", "build"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, AI_ENABLED: "false" },
  });
  const secondRun = readFileSync(chunksPath, "utf8");

  assert.equal(
    firstRun,
    secondRun,
    "data/chunks.generated.json deve essere byte-identico tra due build consecutive"
  );
});

test("v3.1.3 §5: data/chunks.generated.json committato non contiene alcun campo generatedAt o timestamp", () => {
  const raw = readFileSync(join(ROOT, "data", "chunks.generated.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.ok(!("generatedAt" in parsed), "generatedAt deve essere stato rimosso per il determinismo (§5)");
  // Nessun valore stringa deve somigliare a un timestamp ISO-8601.
  const isoLike = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      assert.ok(!isoLike.test(value), `il campo ${key} sembra contenere un timestamp non deterministico`);
    }
  }
});

test("v3.1.3 §5: scripts/build-content-index.mjs non genera piu' generatedAt / new Date()", () => {
  const src = readFileSync(join(ROOT, "scripts", "build-content-index.mjs"), "utf8");
  assert.ok(!/generatedAt/.test(src), "build-content-index.mjs non deve piu' scrivere generatedAt");
  assert.ok(!/new Date\(\)/.test(src), "build-content-index.mjs non deve piu' invocare new Date() (fonte di non-determinismo)");
});
