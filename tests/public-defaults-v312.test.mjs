// ---------------------------------------------------------------------------
// v3.1.2 §5 — Verifica pulita riproducibile senza segreti.
//
// La sequenza di verifica documentata falliva su un'estrazione fresca priva di
// .env, perche' `npm run check` usciva con codice 1 per assenza di
// PUBLIC_SITE_NAME e PUBLIC_SITE_URL. I default statici NON-SEGRETI vivono ora
// in una configurazione committata esplicita, `config/public-defaults.json`.
//
// Questi test garantiscono che:
//  a) il file esista e contenga esattamente le due chiavi pubbliche attese;
//  b) non contenga nulla che somigli a un segreto;
//  c) i valori di fallback cablati in `src/config/site.ts` non divergano dalla
//     configurazione committata (unica fonte di verita');
//  d) nessuna variabile AI sia richiesta quando AI_ENABLED non e' true.
// ---------------------------------------------------------------------------

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const defaults = JSON.parse(readFileSync(join(ROOT, "config", "public-defaults.json"), "utf8"));
const siteTs = readFileSync(join(ROOT, "src", "config", "site.ts"), "utf8");

test("v3.1.2 §5: config/public-defaults.json espone esattamente le due chiavi pubbliche attese", () => {
  const keys = Object.keys(defaults).filter((k) => !k.startsWith("_"));
  assert.deepEqual(keys.sort(), ["PUBLIC_SITE_NAME", "PUBLIC_SITE_URL"]);
  assert.equal(typeof defaults.PUBLIC_SITE_NAME, "string");
  assert.equal(typeof defaults.PUBLIC_SITE_URL, "string");
  assert.ok(defaults.PUBLIC_SITE_URL.startsWith("https://"), "l'URL pubblico deve essere https");
});

test("v3.1.2 §5: la configurazione committata non contiene alcun segreto", () => {
  const forbidden = /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i;
  for (const k of Object.keys(defaults)) {
    if (k.startsWith("_")) continue;
    assert.ok(!forbidden.test(k), `la chiave ${k} sembra un segreto e non puo' stare in un file committato`);
    assert.ok(k.startsWith("PUBLIC_"), `la chiave ${k} deve essere esplicitamente pubblica (prefisso PUBLIC_)`);
  }
});

test("v3.1.2 §5: i fallback di src/config/site.ts coincidono con la configurazione committata", () => {
  // Unica fonte di verita': se qualcuno cambia il default in un posto solo,
  // questo test fallisce invece di lasciar divergere check-env dal sito.
  for (const [key, value] of Object.entries(defaults)) {
    if (key.startsWith("_")) continue;
    assert.ok(
      siteTs.includes(`import.meta.env.${key}`),
      `site.ts deve leggere ${key} dall'ambiente`
    );
    assert.ok(
      siteTs.includes(`"${value}"`),
      `site.ts deve usare "${value}" come fallback di ${key}, coerente con config/public-defaults.json`
    );
  }
});

test("v3.1.2 §5: check-env riesce su un albero SENZA .env, usando i soli default committati", () => {
  // Prova decisiva: il repository di lavoro contiene un .env locale, quindi
  // eseguire lo script in loco non dimostrerebbe nulla. Qui si ricostruisce
  // in una directory temporanea la sola struttura che lo script legge
  // (scripts/ + config/), volutamente PRIVA di .env, come in un'estrazione
  // fresca dello ZIP.
  const tmp = mkdtempSync(join(tmpdir(), "fdp-clean-"));
  try {
    mkdirSync(join(tmp, "scripts"), { recursive: true });
    mkdirSync(join(tmp, "config"), { recursive: true });
    copyFileSync(join(ROOT, "scripts", "check-env.mjs"), join(tmp, "scripts", "check-env.mjs"));
    copyFileSync(
      join(ROOT, "config", "public-defaults.json"),
      join(tmp, "config", "public-defaults.json")
    );
    assert.ok(!existsSync(join(tmp, ".env")), "l'albero di prova non deve contenere .env");

    const out = execFileSync(process.execPath, [join(tmp, "scripts", "check-env.mjs")], {
      cwd: tmp,
      encoding: "utf8",
      env: { PATH: process.env.PATH, HOME: process.env.HOME, AI_ENABLED: "false" },
    });
    assert.match(out, /Validazione completata senza errori bloccanti/);
    assert.doesNotMatch(out, /MANCA/);
    // I due valori devono provenire esplicitamente dalla configurazione committata.
    assert.match(out, /PUBLIC_SITE_NAME: PRESENT \(Fonti del Palio\) — da config\/public-defaults\.json/);
    assert.match(out, /PUBLIC_SITE_URL: PRESENT \(https:\/\/fontidelpalio\.it\) — da config\/public-defaults\.json/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("v3.1.2 §5: npm run check riesce senza alcuna variabile d'ambiente e senza segreti AI", () => {
  // Ambiente completamente ripulito: nessuna variabile PUBLIC_*, nessun segreto.
  const out = execFileSync(process.execPath, [join(ROOT, "scripts", "check-env.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
  });
  assert.match(out, /Validazione completata senza errori bloccanti/);
  assert.doesNotMatch(out, /MANCA/, "nessuna variabile deve risultare mancante e bloccante");
});

test("v3.1.2 §5: nessun segreto AI e' richiesto quando AI_ENABLED non e' true", () => {
  const out = execFileSync(process.execPath, [join(ROOT, "scripts", "check-env.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: process.env.HOME, AI_ENABLED: "false" },
  });
  for (const secret of [
    "OPENAI_API_KEY",
    "TURNSTILE_SECRET_KEY",
    "UPSTASH_REDIS_REST_TOKEN",
    "RATE_LIMIT_HMAC_SECRET",
  ]) {
    assert.match(
      out,
      new RegExp(`n/d\\s+${secret}`),
      `${secret} deve risultare non richiesto (n/d) con AI_ENABLED=false`
    );
  }
  assert.match(out, /Validazione completata senza errori bloccanti/);
});
