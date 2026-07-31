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
const CSS = readFileSync(
  new URL("../src/styles/global.css", import.meta.url),
  "utf8",
);

/**
 * Isola il blocco `@media (max-width: 71.99rem) { ... }` che governa la
 * navigazione compatta (hamburger/drawer/backdrop), gestendo correttamente
 * l'annidamento delle graffe. Il file contiene altre due occorrenze dello
 * stesso breakpoint (per `.site-header` e `.site-header__inner`): il blocco
 * cercato e' identificato univocamente dalla presenza di `.nav-toggle`.
 */
function compactNavMediaBlock(css) {
  const marker = "@media (max-width: 71.99rem) {";
  let searchFrom = 0;
  while (true) {
    const idx = css.indexOf(marker, searchFrom);
    assert.ok(idx !== -1, "blocco @media (max-width: 71.99rem) della navigazione compatta non trovato");
    let depth = 0;
    let i = idx;
    for (; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          i += 1;
          break;
        }
      }
    }
    const block = css.slice(idx, i);
    if (block.includes(".nav-toggle")) {
      return block;
    }
    searchFrom = i;
  }
}

function wideNavMediaBlock(css) {
  // Il file contiene due blocchi "@media (min-width: 72rem)": il primo
  // governa il dropdown dei gruppi in modalita' ampia (righe iniziali), il
  // secondo disattiva il drawer/backdrop per la stessa modalita' e contiene
  // la dichiarazione "position: static" che lo identifica univocamente.
  const marker = "@media (min-width: 72rem) {";
  let searchFrom = 0;
  let start = -1;
  while (true) {
    const idx = css.indexOf(marker, searchFrom);
    assert.ok(idx !== -1, "blocco @media (min-width: 72rem) con reset del drawer non trovato");
    let depth = 0;
    let i = idx;
    for (; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          i += 1;
          break;
        }
      }
    }
    const block = css.slice(idx, i);
    if (block.includes("position: static")) {
      start = idx;
      return block;
    }
    searchFrom = i;
  }
}

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

/**
 * PATCH — Eliminazione dello scroll orizzontale del drawer (2026-08-01).
 *
 * Verifica statica del contratto CSS della correzione, isolata dal resto
 * del foglio di stile tramite lettura dei soli blocchi @media pertinenti.
 * Non sostituisce una verifica visiva reale a viewport multipli: controlla
 * solo che le dichiarazioni richieste siano presenti, nel blocco corretto,
 * e assenti dove non devono applicarsi.
 */

test("il documento e' contenuto orizzontalmente solo in modalita' compatta (<= 71.99rem)", () => {
  const compact = compactNavMediaBlock(CSS);
  assert.match(
    compact,
    /html\s*\{[^}]*overflow-x:\s*clip/,
    "atteso overflow-x: clip su html dentro il blocco compatto",
  );
  // overflow-x: clip non deve comparire fuori dal blocco compatto (nessuna
  // regola equivalente applicata anche in modalita' ampia).
  const senzaBloccoCompatto = CSS.replace(compact, "");
  assert.doesNotMatch(
    senzaBloccoCompatto,
    /html\s*\{[^}]*overflow-x:\s*clip/,
    "overflow-x: clip su html non deve comparire fuori dalla modalita' compatta",
  );
});

test("il drawer blocca il proprio overflow orizzontale mantenendo lo scroll verticale", () => {
  const compact = compactNavMediaBlock(CSS);
  const drawerRule = compact.match(
    /\.main-nav--js#primary-navigation\s*\{[^}]*\}/,
  );
  assert.ok(drawerRule, "regola .main-nav--js#primary-navigation non trovata nel blocco compatto");
  const decl = drawerRule[0];
  assert.match(decl, /overflow-x:\s*hidden/, "atteso overflow-x: hidden sul drawer");
  assert.match(decl, /overflow-y:\s*auto/, "lo scroll verticale del drawer deve restare auto");
  assert.match(decl, /max-width:\s*100vw/, "atteso max-width: 100vw sul drawer per non eccedere il viewport");
  assert.match(
    decl,
    /overscroll-behavior-x:\s*none/,
    "atteso overscroll-behavior-x: none per impedire il rimbalzo orizzontale",
  );
});

test("i discendenti del drawer non possono eccedere la larghezza del pannello", () => {
  const compact = compactNavMediaBlock(CSS);
  assert.match(
    compact,
    /\.main-nav--js#primary-navigation\s*>\s*li,\s*\n\s*\.main-nav--js#primary-navigation \.nav-group,\s*\n\s*\.main-nav--js#primary-navigation \.nav-group__panel\s*\{\s*\n\s*min-width:\s*0;\s*\n\s*max-width:\s*100%;/,
    "attese le regole min-width: 0 / max-width: 100% sui discendenti (li, .nav-group, .nav-group__panel) del drawer",
  );
});

test("la correzione e' assente in modalita' ampia (>= 72rem): nessuna limitazione sul menu orizzontale", () => {
  const wide = wideNavMediaBlock(CSS);
  assert.doesNotMatch(
    wide,
    /overflow-x:\s*hidden/,
    "la modalita' ampia non deve introdurre overflow-x: hidden sul menu orizzontale",
  );
  assert.doesNotMatch(
    wide,
    /overscroll-behavior-x/,
    "la modalita' ampia non deve introdurre overscroll-behavior-x: la correzione riguarda solo il drawer compatto",
  );
  assert.match(wide, /position:\s*static/, "in modalita' ampia il menu deve restare position: static, invariato");
  assert.match(wide, /overflow:\s*visible/, "in modalita' ampia l'overflow del menu deve restare visible, invariato");
});

test("il breakpoint della navigazione resta 71.99rem/72rem, invariato dalla correzione", () => {
  assert.match(CSS, /@media \(max-width: 71\.99rem\)/, "breakpoint compatto atteso a 71.99rem");
  assert.match(CSS, /@media \(min-width: 72rem\)/, "breakpoint ampio atteso a 72rem");
});

test("i wrapper delle tabelle documentarie conservano il proprio scroll orizzontale", () => {
  // Le regole overflow-x: auto preesistenti sui wrapper delle tabelle non
  // devono essere rimosse ne' alterate da questa correzione: il clip sul
  // root element non deve impedire lo scroll interno di un discendente che
  // dichiara esplicitamente un proprio overflow-x.
  const occorrenzeTabelle = [...CSS.matchAll(/overflow-x:\s*auto/g)];
  assert.ok(
    occorrenzeTabelle.length >= 3,
    "attese almeno le tre regole overflow-x: auto preesistenti sui wrapper delle tabelle documentarie",
  );
});

test("--sticky-offset non e' toccata da questa correzione", () => {
  assert.match(CSS, /--sticky-offset:\s*0px/, "valore di base --sticky-offset invariato");
  assert.match(CSS, /--sticky-offset:\s*7\.75rem/, "valore --sticky-offset a 768px invariato");
  assert.match(CSS, /--sticky-offset:\s*4\.625rem/, "valore --sticky-offset a 54rem invariato");
});

test("nessun comportamento JavaScript e' stato modificato da questa correzione (solo CSS)", () => {
  // Astro compila la direttiva `is:inline` rimuovendola dal tag in output:
  // nell'HTML servito resta il semplice `<script>`.
  const scriptMatch = HOME.match(/<script>[\s\S]*?<\/script>/);
  assert.ok(scriptMatch, "script inline della navigazione non trovato");
  // Le funzioni chiave dello script (apertura/chiusura, focus trap, breakpoint
  // change) devono restare presenti e non essere state alterate nel nome.
  for (const fn of ["openDrawer", "closeDrawer", "trapFocus", "lockScroll", "unlockScroll"]) {
    assert.ok(scriptMatch[0].includes(fn), `funzione ${fn} attesa nello script, invariata`);
  }
});
