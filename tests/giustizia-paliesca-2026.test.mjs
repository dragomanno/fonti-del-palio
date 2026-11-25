/**
 * Giustizia paliesca 2026 — deliberazioni della Giunta comunale del 24/11/2026.
 *
 * Il prospetto atteso qui sotto e' trascritto a mano dai quindici PDF ricevuti
 * il 25 novembre 2026, indipendentemente da KB 15: un errore di trascrizione
 * nel registro, nel generatore o nelle pagine fa fallire il confronto invece di
 * propagarsi in silenzio. I controlli su `dist/` presuppongono `npm run build`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const DIST = join(ROOT, "dist");
const PDF_DIR = join(ROOT, "public", "atti", "2026", "giustizia-paliesca");
const INDEX = JSON.parse(readFileSync(join(ROOT, "data", "carriera.generated.json"), "utf8"));
const KB15 = readFileSync(join(ROOT, "content", "carriere", "15_KB_Giustizia_Paliesca_Carriere_2026.md"), "utf8");

const L = "palio-3-luglio-2026";
const A = "palio-18-agosto-2026";

// n. | Carriera | destinatario | esito | Albo | pagine | SHA-256
const ATTESE = [
  [404, L, "Contrada della Torre", "censura", "2026/0005406", 4, "2ccfa4f94afe3553640b8f46df2d187a73606b1dd6d369120988c59bb3ce435e"],
  [405, L, "Enrico Bruschelli detto Bellocchio", "ammonizione", "2026/0005408", 5, "d9dd5b079c08b6f5218279e74713dda69b54e8c62d3f7f8698bc9fe56db7cc67"],
  [406, L, "Andrea Sanna detto Virgola", "diffida", "2026/0005410", 4, "654d3eff0a2a4d41b1f3967a5e42a4dcbd7306d77f4a621e5fc821613c33a64a"],
  [407, L, "Federico Guglielmi detto Tamurè", "diffida", "2026/0005412", 4, "8448938af6b5b2b652bbfa10e2452b72111b5bd9bcbf2c9164f7cb16f5ada968"],
  [408, L, "Contrada di Valdimontone", "archiviazione", "2026/0005413", 5, "d4f6919a1d355e5732027135de0f69207e7f25fb8c9064651ffa805ec0d4cdec"],
  [409, L, "Salvatore Nieddu detto Lesto", "diffida", "2026/0005409", 5, "f1991e11ef3d834f8060e5cfaba22fa5fe0db70cac5fe6b8f6e328b40cc85ab3"],
  [410, A, "Nobile Contrada dell’Oca", "censura", "2026/0005407", 4, "5320b3884bb203719e7c550b236bcbb6ea05a63668344676e732250cca736a37"],
  [411, A, "Michel Putzu detto Spago", "ammonizione", "2026/0005401", 4, "ae82facc2ef2b62f8a768521b523a40c227ca92680acb4fde220c14febd87786"],
  [412, A, "Imperiale Contrada della Giraffa", "censura", "2026/0005405", 4, "ba9f904a05add858a24decdae56b7dd93bf3534a0de55a6b6aa0abb7b4f44337"],
  [413, A, "Elias Mannucci detto Turbine", "ammonizione", "2026/0005400", 4, "89dfdf20d5076f827e2e7d9f54b6ad9b414ffd32c80057e3c9e25ac3afaefa2f"],
  [414, A, "Contrada della Torre", "deplorazione", "2026/0005403", 4, "dceaaec3e1e1234bdc1821ac958665ffdcdc959140c6786a204e1537005b7121"],
  [415, A, "Nobile Contrada del Nicchio", "deplorazione", "2026/0005404", 4, "012f8f69c43ec3f7e01d2c5609c2eb4bab2d063accd3e5f895555fa46dcd8f06"],
  [416, A, "Giovanni Atzeni detto Tittia", "ammonizione", "2026/0005399", 4, "f37f33de2c81f37eff8ae3b6dcfb65c6fb06177060c28f3547d54d4095995831"],
  [417, A, "Nobile Contrada del Nicchio", "censura", "2026/0005402", 4, "45a6c87ff1a98d542ddf2d68833a26cef754d7927ea20fc88b56e8e0e1d66941"],
  [418, A, "Giovanni Atzeni detto Tittia", "diffida", "2026/0005398", 4, "3dfe14eb1ceb305fbd3587bcc404d632a19970bd1db6d224161b142cd2c0aebb"],
];

const delibere = INDEX.giustizia.delibere;

function html(rotta) {
  const file = join(DIST, rotta, "index.html");
  assert.ok(existsSync(file), `rotta non generata: ${rotta}`);
  return readFileSync(file, "utf8");
}

test("le quindici delibere coincidono con il prospetto trascritto dai PDF", () => {
  assert.equal(delibere.length, 15);
  const perNumero = new Map(delibere.map((d) => [d.numero, d]));
  for (const [n, carriera, destinatario, esito, albo, pagine, sha] of ATTESE) {
    const d = perNumero.get(n);
    assert.ok(d, `delibera n. ${n} assente`);
    assert.equal(d.carriera, carriera, `Carriera della delibera n. ${n}`);
    assert.equal(d.destinatario, destinatario, `destinatario della delibera n. ${n}`);
    assert.equal(d.esito, esito, `esito della delibera n. ${n}`);
    assert.equal(d.albo.numero, albo, `numero di Albo della delibera n. ${n}`);
    assert.equal(d.albo.dal, "25/11/2026");
    assert.equal(d.albo.al, "10/12/2026");
    assert.equal(d.data, "24/11/2026");
    assert.equal(d.organo, "Giunta comunale");
    assert.equal(d.pagine, pagine, `pagine della delibera n. ${n}`);
    assert.equal(d.sha256, sha, `digest della delibera n. ${n}`);
  }
  assert.equal(delibere.filter((d) => d.esito !== "archiviazione").length, 14, "attese 14 sanzioni");
  assert.equal(delibere.filter((d) => d.esito === "archiviazione").length, 1, "attesa 1 archiviazione");
});

test("i PDF pubblicati sono i quindici originali, byte per byte", () => {
  const file = readdirSync(PDF_DIR).filter((f) => f.endsWith(".pdf")).sort();
  assert.equal(file.length, 15);
  for (const d of delibere) {
    const nome = d.pdf.split("/").pop();
    assert.ok(file.includes(nome), `PDF mancante: ${nome}`);
    const bytes = readFileSync(join(PDF_DIR, nome));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), d.sha256, `digest di ${nome}`);
    assert.equal(bytes.length, d.byte, `dimensione di ${nome}`);
    assert.ok(nome.includes(`_Copia_${d.numero}_2026.pdf`), `nome del file incoerente per ${d.id}`);
    assert.ok(existsSync(join(DIST, d.pdf)), `PDF non copiato in dist: ${d.pdf}`);
  }
});

test("KB 15 dichiara le lacune e tiene distinte proposta e delibera", () => {
  assert.match(KB15, /senza i numeri 5, 6, 15/);
  assert.match(KB15, /senza i numeri 24, 25, 34/);
  assert.match(KB15, /2026\/0005411 non compare nelle schermate fornite/);
  assert.match(KB15, /## 5\. Atti richiamati e non acquisiti/);
  assert.match(KB15, /le differenze fra le due non sono riportate/);
  for (const d of delibere) {
    assert.match(d.contestazione, /^atto n\. \d+, prot\. n\. \d+$/, `contestazione di ${d.id}`);
    assert.match(d.proposta, /^atto n\. (\d+) \(nel dispositivo «ordinanza n\. \1»\), prot\. n\. \d+$/, `proposta di ${d.id}`);
  }
});

test("la grafia «Tamurè» è rispettata ovunque", () => {
  const testi = [KB15, JSON.stringify(INDEX.giustizia), html("giustizia-paliesca/2026/palio-3-luglio-2026"), html("giustizia-paliesca/2026/delibera-407-2026")];
  for (const t of testi) {
    assert.ok(t.includes("Tamurè"), "grafia «Tamurè» assente");
    assert.doesNotMatch(t, /Tamur[eé](?!è)\b|Tamurre|TAMURE\b/, "grafia alterata di «Tamurè»");
  }
});

test("le rotte della giustizia paliesca sono generate, in sitemap e indicizzate", () => {
  const rotte = [
    "/giustizia-paliesca/",
    "/giustizia-paliesca/2026/",
    `/giustizia-paliesca/2026/${L}/`,
    `/giustizia-paliesca/2026/${A}/`,
    ...delibere.map((d) => `/giustizia-paliesca/2026/${d.slug}/`),
  ];
  assert.equal(rotte.length, 19);
  const sitemap = readFileSync(join(DIST, "sitemap.xml"), "utf8");
  const dir = join(DIST, "pagefind", "fragment");
  const indicizzate = new Set(
    readdirSync(dir).map((nome) => {
      const testo = gunzipSync(readFileSync(join(dir, nome))).toString("utf8");
      return JSON.parse(testo.slice(testo.indexOf("{"))).url;
    }),
  );
  for (const r of rotte) {
    const pagina = html(r);
    assert.ok(pagina.includes("data-pagefind-body"), `pagina non indicizzabile: ${r}`);
    assert.ok(sitemap.includes(`<loc>https://www.fontidelpalio.org${r}</loc>`), `rotta assente dalla sitemap: ${r}`);
    assert.ok(indicizzate.has(r), `rotta assente dall'indice Pagefind: ${r}`);
  }
});

test("ogni scheda espone estremi, digest ed etichetta di copia conforme", () => {
  for (const d of delibere) {
    const pagina = html(`giustizia-paliesca/2026/${d.slug}`);
    assert.ok(pagina.includes(`Delibera n. ${d.numero} del 24 novembre 2026`), `titolo di ${d.id}`);
    assert.ok(pagina.includes(d.sha256), `digest di ${d.id}`);
    assert.ok(pagina.includes(`n. ${d.albo.numero}, dal 25/11/2026 al 10/12/2026`), `Albo di ${d.id}`);
    assert.ok(pagina.includes(`href="${d.pdf}"`), `collegamento al PDF di ${d.id}`);
    assert.ok(
      pagina.includes("Copia conforme all’originale per uso amministrativo, ripresa dall’Albo Pretorio del Comune di Siena"),
      `etichetta di copia conforme assente in ${d.id}`,
    );
  }
});

test("le pagine di Carriera elencano tutte e sole le proprie delibere", () => {
  for (const [slug, attese] of [[L, 6], [A, 9]]) {
    const pagina = html(`giustizia-paliesca/2026/${slug}`);
    const proprie = delibere.filter((d) => d.carriera === slug);
    assert.equal(proprie.length, attese);
    for (const d of delibere) {
      const link = `href="/giustizia-paliesca/2026/${d.slug}/"`;
      if (d.carriera === slug) assert.ok(pagina.includes(link), `${slug}: manca ${d.id}`);
      else assert.ok(!pagina.includes(link), `${slug}: contiene ${d.id} di un'altra Carriera`);
    }
    assert.ok(pagina.includes('href="/regolamento-per-il-palio/#articolo-'), `${slug}: nessun rinvio al Regolamento`);
  }
});

test("la pagina 2026 spiega le sanzioni con il testo del Regolamento", () => {
  const pagina = html("giustizia-paliesca/2026");
  for (const voce of ["Censura", "Deplorazione", "Diffida", "Ammonizione"]) {
    assert.ok(pagina.includes(`<strong>${voce}</strong>`), `sanzione non spiegata: ${voce}`);
  }
  for (const art of [97, 98, 99, 101]) {
    assert.ok(pagina.includes(`href="/regolamento-per-il-palio/#articolo-${art}"`), `art. ${art} non collegato`);
  }
  assert.ok(
    pagina.includes(
      "«Avverso le delibere della Giunta Comunale che\n        devono essere adottate entro la chiusura dell’anno contradaiolo (30 novembre di ogni anno)\n        non è ammesso alcun tipo di ricorso»",
    ) || /Avverso le delibere della Giunta Comunale che\s+devono essere adottate entro la chiusura dell’anno contradaiolo \(30 novembre di ogni anno\)\s+non è ammesso alcun tipo di ricorso/.test(pagina),
    "citazione dell'art. 98 assente o alterata",
  );
  // La citazione deve coincidere con il testo vigente indicizzato.
  const art98 = INDEX.regolamento.articoli.find((a) => String(a.numero) === "98");
  assert.ok(art98.corpo.includes("Avverso le delibere della Giunta Comunale che devono essere adottate entro la chiusura dell’anno contradaiolo (30 novembre di ogni anno) non è ammesso alcun tipo di ricorso."));
});

test("i collegamenti a comune.siena.it sono nofollow", () => {
  const rotte = ["giustizia-paliesca/2026", `giustizia-paliesca/2026/${L}`, `giustizia-paliesca/2026/${A}`];
  let visti = 0;
  for (const r of rotte) {
    for (const [tag] of html(r).matchAll(/<a\b[^>]*href="https?:\/\/[^"]*comune\.siena\.it[^"]*"[^>]*>/g)) {
      visti++;
      assert.match(tag, /rel="[^"]*\bnofollow\b[^"]*"/, `collegamento senza nofollow in ${r}: ${tag}`);
    }
  }
  assert.ok(visti >= 5, `attesi almeno 5 collegamenti al Comune, trovati ${visti}`);
});

test("la Home mette in evidenza la giustizia paliesca 2026", () => {
  const pagina = html("");
  assert.ok(pagina.includes("Ultimo aggiornamento del corpus · 25 novembre 2026"));
  assert.ok(pagina.includes('href="/giustizia-paliesca/2026/"'));
  assert.ok(pagina.includes(`href="/giustizia-paliesca/2026/${L}/"`));
  assert.ok(pagina.includes(`href="/giustizia-paliesca/2026/${A}/"`));
});

test("le pagine non espongono i nomi dei componenti della Giunta", () => {
  // I nomi compaiono nei PDF ripubblicati integralmente, non nelle pagine:
  // non servono alla funzione documentaria della scheda.
  const nomi = ["Nicoletta Fabio", "FABIO NICOLETTA", "NARDI", "Nardi Giulio", "GIORDANO", "Giordano", "Capitani", "CAPITANI"];
  const rotte = ["giustizia-paliesca", "giustizia-paliesca/2026", `giustizia-paliesca/2026/${L}`, `giustizia-paliesca/2026/${A}`, ...delibere.map((d) => `giustizia-paliesca/2026/${d.slug}`)];
  for (const r of rotte) {
    const corpo = html(r).split('id="contenuto"')[1] ?? "";
    for (const n of nomi) assert.ok(!corpo.includes(n), `${r}: compare «${n}»`);
  }
});
