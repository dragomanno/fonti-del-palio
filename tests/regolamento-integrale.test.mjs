/**
 * Fonti del Palio — gate del testo integrale del «Regolamento per il Palio».
 *
 * PERIMETRO STRETTO E DICHIARATO. Questi controlli riguardano soltanto
 * l'articolato dell'edizione vigente e la sua resa nella pagina unica
 * `/regolamento-per-il-palio/`. Non estendono il framework diagnostico
 * congelato alla v3.1.3 e non toccano il corpus del Protocollo Equino.
 *
 * I conteggi non sono valori di comodo: 106 unità articolo (artt. 1–105 con
 * l'art. 99-bis) e 8 capitoli sono la consistenza registrata della fonte
 * REG-PALIO-2019 e verificata sulla trascrizione canonica. Un conteggio che
 * cambia senza una modifica dichiarata della fonte è un difetto.
 *
 * I controlli sull'HTML generato si eseguono soltanto se `dist/` esiste: il
 * test non forza una build, così `npm test` resta eseguibile da solo.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { EXPECTED } from "../scripts/build-carriera-index.mjs";
import { estraiRegolamento, verificaRegolamento } from "../scripts/build-regolamento.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const GENERATED = path.join(ROOT, "data", "carriera.generated.json");
const KB03 = path.join(ROOT, "content", "kb", "03_KB_Disciplina_Vigente_Consolidata_2026.md");
const PAGINA = path.join(ROOT, "dist", "regolamento-per-il-palio", "index.html");

const index = JSON.parse(readFileSync(GENERATED, "utf-8"));
const regolamento = index.regolamento;
const articoli = regolamento.articoli;
const numeri = articoli.map((a) => a.numero);

/** Digest del PDF REG-PALIO-2019 registrato in KB 12 e verificato sui byte. */
const SHA_REG_PALIO_2019 = "a09afe7b863f7b1b5329f8fb069503a59dc67b92053c3a156b7d62ce9855b86d";

const html = existsSync(PAGINA) ? readFileSync(PAGINA, "utf-8") : null;
const seDist = { skip: html === null ? "dist/ assente: eseguire `npm run build`" : false };

// ---------------------------------------------------------------- dati

test("l'articolato conta 106 unità articolo", () => {
  assert.equal(articoli.length, 106);
  assert.equal(articoli.length, EXPECTED.articoliRegolamento);
});

test("la numerazione ordinaria è continua dall'art. 1 all'art. 105", () => {
  const ordinari = numeri.filter((n) => /^\d+$/.test(n)).map(Number);
  assert.deepEqual(ordinari, Array.from({ length: 105 }, (_, i) => i + 1));
});

test("l'art. 99-bis esiste e sta fra l'art. 99 e l'art. 100", () => {
  const i = numeri.indexOf("99bis");
  assert.notEqual(i, -1, "art. 99-bis assente");
  assert.equal(numeri[i - 1], "99");
  assert.equal(numeri[i + 1], "100");
});

test("numeri, etichette e ancore degli articoli sono univoci", () => {
  for (const valori of [numeri, articoli.map((a) => a.etichetta), articoli.map((a) => a.anchor)]) {
    assert.equal(new Set(valori).size, valori.length);
  }
});

test("ogni ancora ha la forma articolo-N oppure articolo-N-bis", () => {
  for (const a of articoli) {
    assert.match(a.anchor, /^articolo-(?:\d+|\d+-bis)$/, `ancora non conforme: ${a.anchor}`);
  }
  assert.equal(articoli.find((a) => a.numero === "99bis").anchor, "articolo-99-bis");
  assert.equal(articoli.find((a) => a.numero === "99bis").etichetta, "Art. 99-bis");
});

test("nessun articolo ha il corpo vuoto", () => {
  const vuoti = articoli.filter((a) => a.corpo.trim() === "").map((a) => a.etichetta);
  assert.deepEqual(vuoti, []);
});

test("gli articoli abrogati conservano la formula stampata", () => {
  for (const numero of ["40", "74", "86"]) {
    const a = articoli.find((x) => x.numero === numero);
    assert.match(a.corpo, /^Abrogato con delib/, `${a.etichetta} non riporta la formula di abrogazione`);
  }
});

test("l'articolato è distribuito negli otto capitoli della pubblicazione", () => {
  assert.equal(regolamento.capitoli.length, EXPECTED.capitoliRegolamento);
  assert.equal(regolamento.capitoli.length, 8);
  assert.deepEqual(
    regolamento.capitoli.map((c) => c.numero),
    ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"]
  );
  assert.equal(articoli.filter((a) => a.capitolo === null).length, 0);
});

test("l'ultimo articolo non ingloba allegati, appendice o indice del volume", () => {
  const ultimo = articoli[articoli.length - 1];
  assert.equal(ultimo.numero, "105");
  assert.doesNotMatch(ultimo.corpo, /ALLEGATO|APPENDICE|INDICE GENERALE/);
});

test("nessun corpo contiene residui di paginazione o di struttura Markdown", () => {
  for (const a of articoli) {
    assert.doesNotMatch(a.corpo, /<!--|-->/, `${a.etichetta}: marcatore di pagina residuo`);
    assert.doesNotMatch(a.corpo, /^\s*#/m, `${a.etichetta}: intestazione Markdown residua`);
    assert.doesNotMatch(a.corpo, /\uFFFD/, `${a.etichetta}: carattere di sostituzione`);
    assert.doesNotMatch(a.corpo, /[\u00A0\u00AD\u200B\u200E\u200F]/, `${a.etichetta}: carattere invisibile`);
  }
});

test("nessun articolo ha rubrica: l'edizione vigente li numera senza titolo", () => {
  for (const a of articoli) assert.equal(a.rubrica, "");
});

test("la fonte dichiarata è REG-PALIO-2019 con il digest verificato", () => {
  assert.equal(regolamento.fonte.id, "REG-PALIO-2019");
  assert.equal(regolamento.fonte.sha256, SHA_REG_PALIO_2019);
  assert.equal(regolamento.fonte.pagine, 82);
  assert.equal(regolamento.fonte.byte, 1988492);
  const registro = index.registroFonti.find((r) => r.id === "REG-PALIO-2019");
  assert.equal(registro.sha256, SHA_REG_PALIO_2019);
});

test("l'articolato deriva dalla trascrizione canonica, non dalla collazione", () => {
  assert.equal(regolamento.fonte.file, "03_KB_Disciplina_Vigente_Consolidata_2026.md");
  const dallaFonte = estraiRegolamento(readFileSync(KB03, "utf-8"));
  assert.equal(dallaFonte.articoli.length, articoli.length);
  assert.deepEqual(
    dallaFonte.articoli.map((a) => a.corpo),
    articoli.map((a) => a.corpo)
  );
});

test("i gate strutturali dell'articolato non segnalano problemi", () => {
  assert.deepEqual(verificaRegolamento(regolamento, EXPECTED), []);
});

// ---------------------------------------------------------------- pagina

test("la pagina unica espone 106 ancore di articolo, tutte distinte", seDist, () => {
  const ids = [...html.matchAll(/id="(articolo-(?:\d+|\d+-bis))"/g)].map((m) => m[1]);
  assert.equal(ids.length, 106);
  assert.equal(new Set(ids).size, 106);
  assert.ok(ids.includes("articolo-99-bis"));
  assert.ok(ids.includes("articolo-1"));
  assert.ok(ids.includes("articolo-105"));
});

test("l'indice iniziale collega tutte e 106 le unità articolo", seDist, () => {
  const nav = /<nav id="indice-articoli"[\s\S]*?<\/nav>/.exec(html);
  assert.ok(nav, "indice degli articoli assente dalla pagina");
  const link = [...nav[0].matchAll(/href="#(articolo-(?:\d+|\d+-bis))"/g)].map((m) => m[1]);
  assert.equal(link.length, 106);
  assert.equal(new Set(link).size, 106);
  const ancore = new Set([...html.matchAll(/id="(articolo-(?:\d+|\d+-bis))"/g)].map((m) => m[1]));
  for (const l of link) assert.ok(ancore.has(l), `voce d'indice senza ancora: ${l}`);
});

test("l'indice precede l'articolato e resta fuori dall'indice di ricerca", seDist, () => {
  const nav = html.indexOf('id="indice-articoli"');
  const primo = html.indexOf('id="articolo-1"');
  assert.ok(nav !== -1 && primo !== -1 && nav < primo, "l'indice non precede il primo articolo");
  assert.match(
    /<nav id="indice-articoli"[^>]*>/.exec(html)[0],
    /data-pagefind-ignore/,
    "l'indice degli articoli non è escluso da Pagefind"
  );
});

test("il testo di apertura e di chiusura dell'articolato è in pagina", seDist, () => {
  assert.ok(html.includes("solennizza le ricorrenze religiose della Visitazione"));
  assert.ok(html.includes("costituire un indirizzo sanzionatorio di riferimento"));
  assert.ok(html.includes("quello approvato in data 18 ottobre 1906"));
});

test("il Regolamento vigente resta un'unica rotta, senza pagina per articolo", seDist, () => {
  const dir = path.join(ROOT, "dist", "regolamento-per-il-palio");
  const voci = readdirSync(dir, { withFileTypes: true }).map((e) => e.name);
  assert.deepEqual(voci.filter((n) => /^articolo/.test(n)), []);
  assert.ok(voci.includes("index.html"));
  const sitemap = readFileSync(path.join(ROOT, "dist", "sitemap.xml"), "utf-8");
  const rotte = [...sitemap.matchAll(/<loc>([^<]*regolamento-per-il-palio[^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(rotte.sort(), [
    "https://www.fontidelpalio.org/regolamento-per-il-palio/",
    "https://www.fontidelpalio.org/regolamento-per-il-palio/edizione-previgente/",
  ]);
});

test("la pagina dichiara il canonical della sola rotta del Regolamento", seDist, () => {
  const canonici = [...html.matchAll(/rel="canonical" href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(canonici, ["https://www.fontidelpalio.org/regolamento-per-il-palio/"]);
});

test("la pagina espone il digest della fonte e la nota sui limiti", seDist, () => {
  assert.ok(html.includes(SHA_REG_PALIO_2019), "digest SHA-256 assente dalla pagina");
  assert.ok(html.includes("Per il testo fa fede la pubblicazione del Comune di"));
  assert.ok(/Allegato\s*A/.test(html), "la nota non dichiara che l'Allegato A non è riprodotto");
});

test("l'articolato non è reso come blocco di codice né con residui di paginazione", seDist, () => {
  const corpo = [...html.matchAll(/class="art__corpo"[^>]*>([\s\S]*?)<p class="art__ritorno"/g)]
    .map((m) => m[1])
    .join("\n");
  assert.equal(corpo.match(/<pre/g), null);
  assert.equal(corpo.match(/PDF_PAGE/g), null);
  assert.doesNotMatch(corpo, /\uFFFD/);
  // Il corpo di ogni articolo è reso in capoversi, non in un blocco unico.
  assert.ok((corpo.match(/<p /g) ?? []).length >= 106);
});

// -------------------------------------------------- catena di provenienza

/*
 * Collazione integrale del 2 agosto 2026 fra il PDF REG-PALIO-2019 e la
 * trascrizione canonica: 106 unita' su 106 coincidenti. Il PDF non e' versionato
 * nel repository, quindi la collazione non e' rieseguibile in CI. Questi gate
 * bloccano la regressione dei fatti che ne sono derivati, registrati in KB 12
 * sezione 8.6 e in KB 04 alla scheda RP-2019-01.
 */

const KB04 = path.join(ROOT, "content", "kb", "04_KB_Manifest_Fonti_e_Registro_Atti_2012_2026.md");
const KB12 = path.join(ROOT, "content", "carriere", "12_KB_Manifest_Generale_Fonti_del_Palio_2026.md");
const kb04 = readFileSync(KB04, "utf-8");
const kb12 = readFileSync(KB12, "utf-8");
const schedaRP = kb04.slice(kb04.indexOf("### RP-2019-01"), kb04.indexOf("### RP-2021-02"));

test("KB 04 rinvia alla trascrizione canonica esistente, non a un file inesistente", () => {
  assert.match(schedaRP, /03_KB_Disciplina_Vigente_Consolidata_2026\.md/);
  assert.match(schedaRP, /Parte III/);
  // Il riferimento pendente non deve tornare come percorso di trascrizione.
  assert.doesNotMatch(schedaRP, /\*\*Trascrizione:\*\*\s*`05_Regolamento/);
  assert.ok(
    !existsSync(path.join(ROOT, "content", "kb", "05_Regolamento_per_il_Palio_edizione_2021.md")),
    "il file esiste: aggiornare la scheda RP-2019-01 invece di dichiararlo assente"
  );
});

test("KB 04 registra il canale di acquisizione e i metadati interni del file", () => {
  assert.match(schedaRP, /ilpalio\.org/);
  assert.match(schedaRP, /InDesign 15\.0/);
  assert.match(schedaRP, /10 febbraio 2020/);
  assert.match(schedaRP, /29 luglio 2020/);
  assert.match(schedaRP, /1\.988\.492/);
  assert.ok(schedaRP.includes(SHA_REG_PALIO_2019));
});

test("KB 12 registra la collazione integrale e la provenienza della copia", () => {
  assert.match(kb12, /^## 8\.6 Collazione integrale/m);
  const sez = kb12.slice(kb12.indexOf("## 8.6 Collazione integrale"));
  assert.match(sez, /106 su 106/);
  assert.match(sez, /10 febbraio 2020/);
  assert.match(sez, /29 luglio 2020/);
  assert.match(sez, /ilpalio\.org/);
  // La data del comunicato non deve tornare attribuita al volume.
  assert.match(sez, /29 maggio 2021.*COM-2021-05-REGOLAMENTO-001/s);
});

test("KB 12 non dichiara piu' assente la collazione integrale del Regolamento", () => {
  const limiti = kb12.slice(
    kb12.indexOf("## 8.5 Cosa questa sezione non dimostra"),
    kb12.indexOf("## 8.6 Collazione integrale")
  );
  assert.doesNotMatch(limiti, /^\d+\. Non equivale a una collazione integrale/m);
  assert.match(limiti, /8\.6/);
});

test("la pagina non attribuisce al volume la data del comunicato", seDist, () => {
  // Il 29 maggio 2021 e' la data di generazione del PDF del comunicato stampa.
  // Se compare in pagina deve comparire come tale, non come data del volume.
  const occorrenze = [...html.matchAll(/.{160}29 maggio 2021/g)].map((m) => m[0]);
  for (const contesto of occorrenze) {
    assert.match(
      contesto,
      /comunicato|COM-2021-05|attribuiva/,
      `29 maggio 2021 attribuito al volume: ${contesto}`
    );
  }
  assert.doesNotMatch(html, /PDF diffuso dall'Ufficio Palio reca la data di generazione/);
});

test("la pagina dichiara la collazione integrale e il canale di acquisizione", seDist, () => {
  assert.match(html, /collazionato per intero/);
  assert.match(html, /ilpalio\.org/);
  assert.match(html, /non che il volume acquisito sia il testo\s+attualmente in vigore/);
  assert.match(html, /10 febbraio 2020/);
});
