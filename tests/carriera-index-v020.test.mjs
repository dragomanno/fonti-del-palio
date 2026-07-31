/**
 * Fonti del Palio — gate strutturali dell'indice della Carriera, v0.2.0.
 *
 * PERIMETRO STRETTO E DICHIARATO. Questi controlli non estendono il framework
 * diagnostico congelato alla v3.1.3 e non toccano il corpus del Protocollo
 * Equino: verificano soltanto le proprieta' dell'indice introdotto dalla
 * v0.2.0 e l'integrita' documentaria delle fonti che lo alimentano.
 *
 * I conteggi qui scritti NON sono valori di comodo: sono le consistenze
 * registrate in KB 09 e KB 12 e verificate sui byte originali dei documenti
 * acquisiti. Un conteggio che cambia senza una modifica dichiarata del registro
 * e' un difetto, non un aggiornamento.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { buildIndex, serialize, EXPECTED, attoSlug, parseTable } from "../scripts/build-carriera-index.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const GENERATED = path.join(ROOT, "data", "carriera.generated.json");
const PDF_DIR = path.join(ROOT, "public", "atti", "2026");

const index = JSON.parse(readFileSync(GENERATED, "utf-8"));

test("l'indice committato coincide con quello rigenerato dalle fonti", () => {
  const rebuilt = serialize(buildIndex());
  assert.equal(
    rebuilt,
    readFileSync(GENERATED, "utf-8"),
    "data/carriera.generated.json non e' allineato alle fonti: eseguire `npm run carriera:build`"
  );
});

test("il generatore e' deterministico", () => {
  assert.equal(serialize(buildIndex()), serialize(buildIndex()));
});

test("il registro contiene tredici atti, dodici dei quali ripubblicabili", () => {
  assert.equal(index.atti.length, EXPECTED.atti);
  assert.equal(index.atti.filter((a) => a.ripubblicabile).length, EXPECTED.attiRipubblicabili);
  assert.equal(index.atti.filter((a) => !a.ripubblicabile).length, EXPECTED.attiNonRipubblicati);
});

test("il visto di regolarita' contabile e' registrato senza PDF pubblicato", () => {
  // Il PDF contiene dati anagrafici e indirizzi di fornitori: la scheda
  // pubblica si limita a esito, data, relazione e funzione contabile.
  const visto = index.atti.find((a) => a.id === "ATT-2026-VIS-1775");
  assert.ok(visto, "ATT-2026-VIS-1775 assente dal registro");
  assert.equal(visto.ripubblicabile, false);
  assert.equal(visto.pdf, null);
  assert.match(visto.statoPubblico, /non ripubblicato/);
});

test("ogni atto ripubblicabile ha un PDF presente e nessun PDF resta orfano", () => {
  const pubblicati = index.atti.filter((a) => a.ripubblicabile);
  const attesi = new Set();
  for (const atto of pubblicati) {
    assert.ok(atto.pdf, `${atto.id} senza percorso PDF`);
    const file = path.join(ROOT, "public", atto.pdf.replace(/^\//, ""));
    assert.ok(existsSync(file), `file mancante per ${atto.id}: ${atto.pdf}`);
    attesi.add(path.basename(file));
  }
  const presenti = readdirSync(PDF_DIR).filter((f) => f.endsWith(".pdf"));
  assert.deepEqual(presenti.sort(), [...attesi].sort(), "PDF pubblicati e atti non coincidono");
});

test("gli atti pubblicati totalizzano trentacinque pagine", () => {
  const totale = index.atti.filter((a) => a.ripubblicabile).reduce((n, a) => n + a.pagine, 0);
  assert.equal(totale, EXPECTED.pagineAttiPubblicati);
});

test("i cavalli ammessi alle Previsite sono centotto e numerati senza salti", () => {
  assert.equal(index.previsite.cavalli.length, EXPECTED.cavalli);
  const numeri = index.previsite.cavalli.map((c) => c.numero);
  assert.deepEqual(numeri, numeri.map((_, i) => i + 1));
  assert.equal(index.previsite.cavalli[0].nome, "ANDA E BOLA");
  assert.equal(index.previsite.cavalli[EXPECTED.cavalli - 1].nome, "ZIO FRAC");
  const vuoti = index.previsite.cavalli.filter((c) => !c.nome.trim() || !c.proprietario.trim());
  assert.deepEqual(vuoti, [], "cavallo senza nome o senza proprietario");
});

test("le materie consolidate sono undici e le sezioni della guida tredici", () => {
  assert.equal(index.materie.length, EXPECTED.materie);
  assert.equal(index.guida.length, EXPECTED.sezioniGuida);
  for (const materia of index.materie) assert.ok(materia.corpo.length > 0, `materia vuota: ${materia.slug}`);
  for (const sezione of index.guida) assert.ok(sezione.corpo.length > 0, `sezione vuota: ${sezione.slug}`);
});

test("il Bando riporta diciassette Contrade nell'ordine registrato", () => {
  const attese = [
    "Chiocciola", "Pantera", "Tartuca", "Aquila", "Selva", "Onda",
    "Torre", "Valdimontone", "Nicchio", "Leocorno", "Civetta", "Giraffa",
    "Bruco", "Lupa", "Istrice", "Drago", "Oca",
  ];
  assert.equal(index.bando.contrade.length, EXPECTED.contrade);
  assert.deepEqual(index.bando.contrade.map((c) => c.nome), attese);
  assert.deepEqual(index.bando.contrade.map((c) => c.numero), attese.map((_, i) => i + 1));
  for (const contrada of index.bando.contrade) {
    assert.ok(contrada.confini.length > 100, `confini troppo brevi per ${contrada.nome}`);
  }
});

test("la provenienza del Bando resta dichiarata come da verificare", () => {
  // Il testo e' collazionato sulla copia acquisita; l'origine archivistica
  // della copia non lo e'. Le due affermazioni non vanno fuse.
  assert.equal(index.bando.meta.stato_documentale, "da_verificare");
  assert.equal(
    index.bando.meta.nota_provenienza,
    "Trascrizione verificata rispetto alla copia acquisita. La provenienza archivistica della copia resta da verificare."
  );
});

test("il registro delle fonti normative conta cinque record con digest completi", () => {
  assert.equal(index.registroFonti.length, EXPECTED.recordRegistro);
  for (const record of index.registroFonti) {
    assert.match(record.sha256, /^[0-9a-f]{64}$/, `digest malformato per ${record.id}`);
  }
});

test("le due edizioni del Regolamento restano distinte e correttamente datate", () => {
  const vigente = index.registroFonti.find((r) => r.id === "REG-PALIO-2019");
  const previgente = index.registroFonti.find((r) => r.id === "REG-PALIO-1949");
  assert.ok(vigente && previgente);
  assert.match(vigente.documento, /edizione vigente/);
  assert.match(vigente.estremi, /n\. 99 del 17\.6\.2019/);
  assert.match(vigente.estremi, /n\. 224 del 28\.11\.2019/);
  assert.match(vigente.estremi, /presentata il 28 maggio 2021/);
  assert.match(previgente.documento, /edizione previgente/);
  assert.match(previgente.estremi, /n\. 14 del 05\.02\.1949/);
  // Il 2021 non e' un anno di approvazione: non deve comparire come tale.
  assert.doesNotMatch(vigente.estremi, /approvat\w+ (con deliberazioni? del Consiglio Comunale [^;]*)?nel 2021/);
});

test("il repertorio delle strade resta fonte di lavoro e non entra nei contenuti", () => {
  const strade = index.registroFonti.filter((r) => r.id === "RIF-STRADE-CONTRADE");
  assert.equal(strade.length, 1, "RIF-STRADE-CONTRADE deve comparire una sola volta, nel registro");
  assert.equal(
    strade[0].sha256,
    "fab21455a27e58f9a564322668f6e83f7f87a3786c9e104f041bc53bf74a469d"
  );
  assert.ok(!JSON.stringify(index.bando).includes("RIF-STRADE-CONTRADE"));
  assert.ok(!JSON.stringify(index.materie).includes("RIF-STRADE-CONTRADE"));
  assert.ok(!JSON.stringify(index.guida).includes("RIF-STRADE-CONTRADE"));
  assert.ok(
    !existsSync(path.join(ROOT, "content", "riferimenti", "le-strade-delle-contrade.md")),
    "il repertorio delle strade non deve essere committato"
  );
});

test("i digest degli atti coincidono con quelli registrati in KB 09", () => {
  const kb09 = readFileSync(
    path.join(ROOT, "content", "carriere", "09_KB_Corpus_Ordinanze_e_Atti_Palio_Agosto_2026.md"),
    "utf-8"
  );
  for (const atto of index.atti) {
    assert.ok(kb09.includes(atto.sha256), `digest di ${atto.id} assente da KB 09`);
  }
});

test("nessun identificativo pubblico e' duplicato", () => {
  const gruppi = {
    "ID degli atti": index.atti.map((a) => a.id),
    "slug degli atti": index.atti.map((a) => a.slug),
    "slug delle materie": index.materie.map((m) => m.slug),
    "slug della guida": index.guida.map((g) => g.slug),
    "slug delle Contrade": index.bando.contrade.map((c) => c.slug),
  };
  for (const [label, values] of Object.entries(gruppi)) {
    assert.equal(new Set(values).size, values.length, `${label}: valori duplicati`);
  }
});

test("gli slug degli atti derivano dall'ID di registro e non dal titolo", () => {
  // Uno slug derivato dal titolo cambierebbe a ogni ritocco redazionale
  // dell'oggetto dell'atto, rompendo le URL pubbliche.
  assert.equal(attoSlug("ATT-2026-ORD-051"), "ordinanza-51-2026");
  assert.equal(attoSlug("ATT-2026-DIR-1775"), "atto-dirigenziale-1775-2026");
  assert.equal(attoSlug("ATT-2026-VIS-1775"), "visto-contabile-1775-2026");
  for (const atto of index.atti) assert.equal(atto.slug, attoSlug(atto.id));
});

test("le fonti committate sono prive di anomalie di codifica", () => {
  const files = [
    ...readdirSync(path.join(ROOT, "content", "carriere")).map((f) =>
      path.join(ROOT, "content", "carriere", f)
    ),
    path.join(ROOT, "content", "riferimenti", "bando-violante-1729.md"),
    GENERATED,
  ];
  const problems = [];
  for (const file of files) {
    const text = readFileSync(file, "utf-8");
    const name = path.relative(ROOT, file);
    if (text.includes("\uFFFD")) problems.push(`${name}: carattere di sostituzione U+FFFD`);
    if (text.includes("\u00AD")) problems.push(`${name}: soft hyphen`);
    if (text.includes("\r")) problems.push(`${name}: fine riga CRLF`);
    if (text.normalize("NFC") !== text) problems.push(`${name}: testo non normalizzato in NFC`);
    if (text.charCodeAt(0) === 0xfeff) problems.push(`${name}: BOM in testa al file`);
    if (!text.endsWith("\n")) problems.push(`${name}: manca l'a capo finale`);
  }
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("il Bando committato non contiene spazi non separatori residui", () => {
  // Nel documento acquisito gli spazi non separatori non hanno valore
  // documentario: sono artefatti di composizione, rimossi in trascrizione.
  const text = readFileSync(path.join(ROOT, "content", "riferimenti", "bando-violante-1729.md"), "utf-8");
  assert.ok(!text.includes("\u00A0"), "spazio non separatore residuo nella trascrizione del Bando");
});

test("i PDF pubblicati sono file reali e non segnaposto", () => {
  let totale = 0;
  for (const file of readdirSync(PDF_DIR).filter((f) => f.endsWith(".pdf"))) {
    const full = path.join(PDF_DIR, file);
    const size = statSync(full).size;
    totale += size;
    assert.ok(size > 50_000, `${file}: dimensione sospetta (${size} byte)`);
    assert.equal(readFileSync(full).subarray(0, 5).toString("latin1"), "%PDF-", `${file}: intestazione non PDF`);
  }
  assert.equal(totale, 1_716_251, "dimensione complessiva dei PDF diversa da quella acquisita");
});

test("parseTable ignora la riga di allineamento e conserva le celle", () => {
  const { header, body } = parseTable("| A | B |\n|---|---:|\n| 1 | 2 |\n| 3 | 4 |");
  assert.deepEqual(header, ["A", "B"]);
  assert.deepEqual(body, [["1", "2"], ["3", "4"]]);
});

test("l'indice del Protocollo Equino non e' toccato dalla v0.2.0", () => {
  // `chunks.generated.json` e' generato da un altro script e appartiene a un
  // altro corpus: la Carriera non deve modificarlo ne' dipenderne.
  const chunks = path.join(ROOT, "data", "chunks.generated.json");
  assert.ok(existsSync(chunks));
  const source = readFileSync(path.join(ROOT, "scripts", "build-carriera-index.mjs"), "utf-8");
  assert.ok(
    !source.includes("chunks.generated.json") || !/writeFileSync\([^)]*chunks/.test(source),
    "il generatore della Carriera non deve scrivere sull'indice del Protocollo Equino"
  );
});

test("la collazione conserva l'articolato integrale e le sue attribuzioni", () => {
  const { collazione } = buildIndex();
  assert.equal(collazione.prospetto.length, EXPECTED.unitaArticolo);
  assert.equal(collazione.totale, EXPECTED.unitaArticolo);
  // Il totale della sintesi deve coincidere con l'articolato: una sintesi che
  // non somma e' una sintesi che ha perso una riga.
  assert.equal(
    collazione.sintesi.reduce((n, r) => n + r.articoli, 0),
    EXPECTED.unitaArticolo
  );
  assert.equal(
    collazione.prospetto.filter((r) => r.prospetto2019).length,
    EXPECTED.articoliProspetto2019
  );
  // L'art. 99bis e' l'unita' inserita nel 1999: la sua presenza distingue un
  // articolato completo da uno troncato alla numerazione semplice.
  assert.ok(collazione.prospetto.some((r) => r.articolo === "99bis"));
  for (const riga of collazione.prospetto) {
    assert.match(riga.somiglianza, /^\d\.\d{3}$/, `somiglianza non normalizzata: ${riga.articolo}`);
    assert.ok(riga.rubrica.length > 0, `rubrica vuota all'art. ${riga.articolo}`);
    assert.ok(riga.esito.length > 0, `esito vuoto all'art. ${riga.articolo}`);
  }
});

test("il registro delle fonti espone lo stato come testo, non come marcatura", () => {
  const { registroFonti } = buildIndex();
  for (const record of registroFonti) {
    assert.ok(!record.stato.includes("`"), `stato ancora in code span: ${record.id}`);
    assert.match(record.sha256, /^[0-9a-f]{64}$/, `digest non valido: ${record.id}`);
  }
});
