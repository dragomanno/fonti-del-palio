/**
 * Gate del lotto dei manifesti a stampa acquisito il 4 agosto 2026.
 *
 * Il lotto ha una natura documentaria diversa da quella degli atti: sono
 * manifesti destinati all'affissione, privi di numero di protocollo. Questi
 * test difendono esattamente quella distinzione, oltre all'integrita' dei file
 * ripubblicati.
 *
 * I test leggono `dist/`: presuppongono un build eseguito.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const PUBLIC = path.join(ROOT, "public");
const index = JSON.parse(
  readFileSync(path.join(ROOT, "data", "carriera.generated.json"), "utf-8"),
);
const kb09 = readFileSync(
  path.join(ROOT, "content", "carriere", "09_KB_Corpus_Ordinanze_e_Atti_Palio_Agosto_2026.md"),
  "utf-8",
);

const ID_ATTESI = [
  "MAN-2026-08-001",
  "MAN-2026-08-002",
  "MAN-2026-08-003",
  "MAN-2026-08-004",
  "MAN-2026-08-005",
];

function html(route) {
  const file = path.join(DIST, route.replace(/^\/|\/$/g, ""), "index.html");
  assert.ok(existsSync(file), `rotta assente dal build: ${route}`);
  return readFileSync(file, "utf-8");
}

test("l'indice registra i cinque manifesti attesi", () => {
  assert.ok(Array.isArray(index.manifesti), "index.manifesti assente");
  assert.deepEqual(
    index.manifesti.map((m) => m.id),
    ID_ATTESI,
    "gli identificativi dei manifesti non coincidono con il lotto acquisito",
  );
});

test("ogni manifesto ha estremi completi e nessun estremo dedotto", () => {
  for (const m of index.manifesti) {
    assert.match(m.slug, /^manifesto-[1-5]-2026-08$/, `slug inatteso per ${m.id}`);
    assert.ok(m.titolo && m.titolo.length > 10, `titolo mancante per ${m.id}`);
    assert.ok(m.data && m.data.length > 0, `data mancante per ${m.id}`);
    assert.equal(m.pagine, 1, `consistenza inattesa per ${m.id}`);
    assert.match(m.sha256, /^[0-9a-f]{64}$/, `digest malformato per ${m.id}`);
    assert.equal(m.ripubblicabile, true, `${m.id} dovrebbe essere ripubblicabile`);
    assert.ok(m.scheda.length > 200, `scheda troppo breve per ${m.id}`);
    // Un numero di protocollo non e' stampato su nessuno dei cinque
    // manifesti: non deve comparire nemmeno come valore ricostruito.
    assert.ok(
      !/\bn\.\s*\d+\s*del\s*\d{2}\/\d{2}\/2026/.test(m.titolo),
      `${m.id} espone un numero d'atto che il manifesto non porta`,
    );
  }
});

test("MAN-2026-08-005 dichiara l'assenza di data invece di dedurla", () => {
  const m = index.manifesti.find((x) => x.id === "MAN-2026-08-005");
  assert.ok(m, "MAN-2026-08-005 assente dall'indice");
  assert.ok(
    /non indicat|non riportat|assente/i.test(m.data),
    "la data mancante di MAN-2026-08-005 deve essere dichiarata come tale",
  );
});

test("nessun manifesto trascrive lo strato residuo del 2 luglio 2026", () => {
  for (const m of index.manifesti) {
    assert.ok(
      !/\b2\s+luglio\s+2026\b/i.test(m.titolo),
      `${m.id} riporta nel titolo una data della Carriera di luglio`,
    );
  }
});

test("i PDF dei manifesti esistono, sono reali e coincidono con il digest", () => {
  for (const m of index.manifesti) {
    assert.ok(m.pdf && m.pdf.startsWith("/atti/2026/manifesti/"), `percorso PDF inatteso per ${m.id}`);
    const sorgente = path.join(PUBLIC, m.pdf.replace(/^\//, ""));
    assert.ok(existsSync(sorgente), `PDF assente da public/: ${m.pdf}`);
    const bytes = readFileSync(sorgente);
    assert.ok(statSync(sorgente).size > 20000, `PDF sospettosamente piccolo: ${m.pdf}`);
    assert.equal(bytes.subarray(0, 4).toString("latin1"), "%PDF", `non e' un PDF: ${m.pdf}`);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      m.sha256,
      `digest divergente per ${m.id}`,
    );
    const pubblicato = path.join(DIST, m.pdf.replace(/^\//, ""));
    assert.ok(existsSync(pubblicato), `PDF non copiato nel build: ${m.pdf}`);
  }
});

test("ogni manifesto ha una scheda pubblica raggiungibile", () => {
  for (const m of index.manifesti) {
    const pagina = html(`/ordinanze-e-atti/${m.slug}/`);
    assert.ok(pagina.includes(m.id), `la scheda di ${m.id} non espone il proprio identificativo`);
    assert.ok(pagina.includes(m.sha256), `la scheda di ${m.id} non espone il digest completo`);
    assert.ok(pagina.includes(m.pdf), `la scheda di ${m.id} non collega il PDF originale`);
  }
});

test("la scheda del manifesto ne dichiara la natura e i limiti", () => {
  for (const m of index.manifesti) {
    const pagina = html(`/ordinanze-e-atti/${m.slug}/`);
    assert.ok(
      pagina.includes("manifesto a stampa"),
      `la scheda di ${m.id} non dichiara di essere un manifesto a stampa`,
    );
    assert.ok(
      pagina.includes("non porta un numero di protocollo"),
      `la scheda di ${m.id} non dichiara l'assenza del numero di protocollo`,
    );
    assert.ok(
      pagina.includes("4 agosto 2026"),
      `la scheda di ${m.id} non dichiara la data di acquisizione`,
    );
    assert.ok(
      !/Scheda documentaria dell'atto/.test(pagina),
      `la scheda di ${m.id} chiama \"atto\" un manifesto`,
    );
  }
});

test("il registro pubblico elenca il lotto dei manifesti", () => {
  const registro = html("/ordinanze-e-atti/");
  assert.ok(registro.includes("Manifesti a stampa"), "il registro non ha il blocco dei manifesti");
  assert.ok(
    registro.includes("4 agosto 2026"),
    "il registro non dichiara la data di acquisizione del lotto",
  );
  for (const m of index.manifesti) {
    assert.ok(
      registro.includes(`/ordinanze-e-atti/${m.slug}/`),
      `il registro non collega ${m.id}`,
    );
  }
});

test("l'ingresso della Carriera dichiara il lotto dei manifesti", () => {
  const hub = html("/palio-16-agosto-2026/");
  assert.ok(
    hub.includes("manifesti a stampa"),
    "la pagina della Carriera non menziona i manifesti a stampa",
  );
});

test("KB 09 registra il lotto con provenienza e limiti", () => {
  assert.ok(
    kb09.includes("## 9. Registro dei manifesti ufficiali acquisiti il 4 agosto 2026"),
    "KB 09 non contiene il registro dei manifesti",
  );
  assert.ok(
    kb09.includes("https://servizi.comune.siena.it/openweb/albo/albo_pretorio.php"),
    "KB 09 non dichiara la fonte di provenienza del lotto",
  );
  for (const id of ID_ATTESI) {
    assert.ok(kb09.includes(id), `KB 09 non contiene la scheda di ${id}`);
  }
});

test("nessuno slug e' duplicato nel registro pubblico", () => {
  const slug = [...index.atti, ...index.manifesti].map((d) => d.slug);
  assert.equal(new Set(slug).size, slug.length, "slug duplicati nel registro pubblico");
});
