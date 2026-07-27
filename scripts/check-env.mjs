#!/usr/bin/env node
/**
 * Validatore delle variabili d'ambiente all'avvio della build.
 * Stampa una matrice di presenza redaction-safe (mai il valore reale
 * di un secret, solo se e' presente o assente).
 *
 * Non blocca la build statica se le variabili AI sono assenti: per
 * decisione (§7), il sito documentale deve funzionare integralmente
 * anche con AI_ENABLED=false / variabili AI non configurate.
 *
 * Carica .env manualmente (nessuna dipendenza da dotenv) cosi' che
 * `npm run build` funzioni anche in locale, non solo su Netlify (dove
 * le variabili sono iniettate direttamente nell'ambiente).
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// v3.1.2 §5 — default statici NON-SEGRETI caricati da una configurazione
// committata esplicita. Prima di questa correzione la sequenza di verifica
// pulita documentata falliva su un'estrazione fresca priva di .env, perche'
// PUBLIC_SITE_NAME e PUBLIC_SITE_URL risultavano assenti e `npm run check`
// usciva con codice 1. Non sono segreti: sono il nome e l'URL pubblici del
// sito. Le variabili d'ambiente, se presenti, hanno sempre la precedenza.
const defaultsPath = path.resolve(__dirname, "..", "config", "public-defaults.json");
const publicDefaults = existsSync(defaultsPath)
  ? JSON.parse(readFileSync(defaultsPath, "utf-8"))
  : {};
const appliedDefaults = new Set();
for (const [key, value] of Object.entries(publicDefaults)) {
  if (key.startsWith("_")) continue;
  if (process.env[key] === undefined || process.env[key] === "") {
    process.env[key] = String(value);
    appliedDefaults.add(key);
  }
}

const REQUIRED_ALWAYS = ["PUBLIC_SITE_NAME", "PUBLIC_SITE_URL"];

const REQUIRED_IF_AI_ENABLED = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_EMBEDDING_MODEL",
  "OPENAI_REASONING_EFFORT",
  "OPENAI_MAX_OUTPUT_TOKENS",
  "TURNSTILE_SECRET_KEY",
  "TURNSTILE_ALLOWED_HOSTNAMES",
  "TURNSTILE_EXPECTED_ACTION",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "RATE_LIMIT_HMAC_SECRET",
  "RATE_LIMIT_BROWSER_DAILY",
  "RATE_LIMIT_IP_DAILY",
  "RATE_LIMIT_IP_MINUTE",
  "RATE_LIMIT_GLOBAL_DAILY",
  "ASK_TIMEOUT_MS",
];

const SECRET_NAMES = new Set([
  "OPENAI_API_KEY",
  "TURNSTILE_SECRET_KEY",
  "UPSTASH_REDIS_REST_TOKEN",
  "RATE_LIMIT_HMAC_SECRET",
]);

function present(name) {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0;
}

function redactedStatus(name) {
  if (!present(name)) return "ABSENT";
  if (SECRET_NAMES.has(name)) return "PRESENT (redacted)";
  const origin = appliedDefaults.has(name) ? " — da config/public-defaults.json" : "";
  return `PRESENT (${process.env[name]})${origin}`;
}

function main() {
  const aiEnabled = process.env.AI_ENABLED === "true";
  console.log("=== Fonti del Palio — Validazione variabili d'ambiente ===");
  console.log(`AI_ENABLED=${process.env.AI_ENABLED ?? "(non impostato)"}\n`);

  let hasBlockingError = false;

  console.log("-- Richieste sempre (sito statico) --");
  for (const name of REQUIRED_ALWAYS) {
    const ok = present(name);
    if (!ok) hasBlockingError = true;
    console.log(`  ${ok ? "OK  " : "MANCA"}  ${name}: ${redactedStatus(name)}`);
  }

  console.log("\n-- Richieste solo se AI_ENABLED=true --");
  for (const name of REQUIRED_IF_AI_ENABLED) {
    const ok = present(name);
    const marker = ok ? "OK  " : aiEnabled ? "MANCA" : "n/d  ";
    if (!ok && aiEnabled) hasBlockingError = true;
    console.log(`  ${marker}  ${name}: ${redactedStatus(name)}`);
  }

  if (hasBlockingError) {
    console.error("\nValidazione fallita: variabili richieste mancanti per la configurazione corrente.");
    process.exit(1);
  }

  console.log("\nValidazione completata senza errori bloccanti.");
}

main();
