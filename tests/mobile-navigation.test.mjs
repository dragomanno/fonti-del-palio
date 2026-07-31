/**
 * FEATURE POST-RELEASE — Menu hamburger e drawer accessibile.
 *
 * Verifica statica del markup servito da `dist/`. Non verifica interazione
 * runtime (focus, Escape, resize): quella parte è coperta dal QA manuale
 * descritto nel rapporto di rilascio. Questo file controlla che il contratto
 * markup richiesto sia presente e stabile su ogni build.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname.replace(/\/$/, "");
const HOME = readFileSync(join(DIST, "index.html"), "utf8");

function headerOf(html) {
  const start = html.indexOf('<header class="site-header"');
  const end = html.indexOf("</header>");
  assert.ok(start !== -1 && end !== -1, "header di sito non trovato");
  return html.slice(start, end);
}

test("esiste un solo menu principale con id primary-navigation univoco", () => {
  // Esclude lo script inline dal conteggio: il markup reale, non i commenti
  // o riferimenti testuali nel codice JavaScript, deve avere un solo id.
  const senzaScript = HOME.replace(/<script[\s\S]*?<\/script>/g, "");
  const occorrenze = senzaScript.match(/id="primary-navigation"/g) || [];
  assert.equal(occorrenze.length, 1, "l'id primary-navigation deve comparire una sola volta nel markup");
});

test("il pulsante hamburger è un elemento button nativo con contratto ARIA corretto", () => {
  const header = headerOf(HOME);
  const match = header.match(/<button[^>]*id="nav-toggle"[^>]*>/);
  assert.ok(match, "pulsante hamburger #nav-toggle non trovato nell'header");
  const tag = match[0];
  assert.match(tag, /type="button"/, "il pulsante hamburger deve dichiarare type=\"button\"");
  assert.match(tag, /aria-controls="primary-navigation"/, "aria-controls deve puntare a primary-navigation");
  assert.match(tag, /aria-expanded="false"/, "stato iniziale atteso aria-expanded=\"false\"");
  assert.match(tag, /aria-label="Apri il menu"/, "label iniziale attesa «Apri il menu»");
});

test("il collegamento iconico alla ricerca punta a /ricerca/ con icona sottratta alle tecnologie assistive", () => {
  const header = headerOf(HOME);
  const match = header.match(/<a[^>]*class="nav-search-link"[^>]*>[\s\S]*?<\/a>/);
  assert.ok(match, "collegamento .nav-search-link non trovato nell'header");
  const block = match[0];
  assert.match(block, /href="\/ricerca\/"/, "il collegamento iconico deve puntare a /ricerca/ con barra finale");
  assert.match(block, /aria-label="Cerca nel sito"/, "il collegamento deve dichiarare aria-label=\"Cerca nel sito\"");
  const svgMatch = block.match(/<svg[^>]*>/);
  assert.ok(svgMatch, "icona SVG mancante nel collegamento di ricerca");
  assert.match(svgMatch[0], /aria-hidden="true"/, "l'SVG deve avere aria-hidden=\"true\"");
  assert.match(svgMatch[0], /focusable="false"/, "l'SVG non deve essere focalizzabile");
});

test("il backdrop è presente, inizialmente nascosto e non focalizzabile", () => {
  const header = headerOf(HOME);
  const match = header.match(/<div[^>]*id="nav-backdrop"[^>]*>/);
  assert.ok(match, "elemento #nav-backdrop non trovato");
  const tag = match[0];
  assert.match(tag, /\bhidden\b/, "il backdrop deve essere marcato hidden allo stato iniziale");
  assert.doesNotMatch(tag, /tabindex="0"/, "il backdrop non deve essere raggiungibile con Tab");
});

test("l'header resta escluso dall'indice Pagefind", () => {
  const start = HOME.indexOf('<header class="site-header"');
  const headerOpenTag = HOME.slice(start, HOME.indexOf(">", start) + 1);
  assert.match(headerOpenTag, /data-pagefind-ignore/, "l'header deve restare marcato data-pagefind-ignore");
});

test("i gruppi e i link originari della navigazione sono ancora presenti", () => {
  const header = headerOf(HOME);
  for (const voce of [
    "Palio 16 agosto 2026",
    "Documenti fondamentali",
    "Protocollo Equino",
    "Ordinanze e atti",
    "Fonti",
    "Progetto",
    "Ricerca",
  ]) {
    assert.ok(header.includes(voce), `voce di navigazione mancante: «${voce}»`);
  }
  const gruppi = [...header.matchAll(/class="nav-group__toggle"/g)];
  assert.equal(gruppi.length, 3, "attesi tre gruppi accordion nel markup");
});

test("i collegamenti interni della navigazione terminano con la barra finale", () => {
  const header = headerOf(HOME);
  const href = [...header.matchAll(/<a[^>]*href="(\/[^"]*)"/g)].map((m) => m[1]);
  const interni = href.filter((h) => h !== "/" && !h.startsWith("//"));
  for (const h of interni) {
    assert.ok(h.endsWith("/"), `collegamento interno senza barra finale: ${h}`);
  }
});

test("nessuna dipendenza o script esterno introdotto dalla navigazione", () => {
  const header = headerOf(HOME);
  assert.doesNotMatch(header, /<script[^>]*\ssrc=/, "la navigazione non deve caricare script esterni");
  assert.doesNotMatch(header, /<link[^>]*rel="stylesheet"[^>]*fonts\.googleapis/, "nessun font esterno introdotto dalla navigazione");
});
