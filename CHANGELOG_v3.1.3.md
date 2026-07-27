# Changelog — Diagnostic v3.1.3 (release correttiva)

Questo changelog copre il ciclo correttivo aperto sul verdetto indipendente **CONDITIONAL FAIL**
emesso su v3.1.2. Per ciascuna delle sei sezioni contestate la tabella riporta il difetto, la
correzione applicata, i file toccati, il metodo di verifica e i limiti residui dichiarati.

Nessuna voce è promossa a esito positivo senza un test o un'evidenza riproducibile citata. Nessuna
asserzione è stata indebolita, rimossa, resa condizionale o aggiornata via snapshot per ottenere una
suite verde.

**Perimetro invariato.** Non sono stati implementati: chunker di produzione, Pagefind, embeddings,
retrieval, `ask.ts` o qualunque layer AI. I quattro file KB canonici in `content/kb/` non sono stati
modificati in alcun modo (contenuto, front matter, whitespace, line ending, nomi file).

---

## §1 — Provenienza della mappatura KB01→KB04 nell'ereditarietà dello stato

| Voce | Dettaglio |
|---|---|
| **Difetto contestato** | Ogni stato ereditato veniva etichettato `registerIdExactMatch` / `provisional: false`, anche quando derivava da una voce di mapping `yearOnlyFallback`. 133 candidati appartenenti a 9 mapping provvisori risultavano indebitamente promossi a esatti. |
| **Correzione** | `resolutionMethod` e `provisional` sono ora **derivati dalla voce di mapping reale**, non cablati: `actNumberMatch` → `registerIdExactMatch` / `provisional: false`; `yearOnlyFallback` → `registerIdYearOnlyFallback` / `provisional: true`. |
| **File toccati** | `scripts/lib/documentary-status.mjs`, `scripts/chunk-diagnostic.mjs` |
| **Evidenza osservata** | 266 candidati ereditano da KB04, per un totale di 1064 voci di stato ereditate (4 dimensioni × 266). Ripartizione onesta: **532 voci `registerIdExactMatch` / `provisional: false`** e **532 voci `registerIdYearOnlyFallback` / `provisional: true`**. I candidati distinti che portano almeno una voce provvisoria sono esattamente **133** — il numero contestato, ora correttamente marcato provvisorio anziché promosso. |
| **Gate** | `allCandidatesHaveCanonicalStatusDimensions` verifica che `resolutionMethod` e `provisional` coincidano con la voce di mapping reale (violazioni `resolutionMethodMismatch`, `provisionalFlagMismatch`). |
| **Mutation test** | Cambiare un mapping provvisorio in esatto, o forzare `provisional: false` su una voce `yearOnlyFallback`, fa **fallire** il gate. |
| **Limiti residui dichiarati** | I 9 anni provvisori (2013, 2017, 2018, 2020, 2021, 2022, 2023, 2024, 2025) restano provvisori: l'assegnazione si basa su anno + unicità del record e **richiede verifica manuale sugli originali** prima di qualunque uso in citazioni legali. Nessuna promozione automatica è possibile. |

## §2 — Risoluzione semantica reale dei riferimenti

| Voce | Dettaglio |
|---|---|
| **Difetto contestato** | `checkCanonicalStatusDimensions` eseguiva solo un controllo di tipo: un riferimento sintatticamente valido ma semanticamente falso passava il gate. |
| **Correzione** | Il gate ora **risolve** ogni riferimento contro le fonti canoniche reali: `source.file` ∈ {kb01..kb04}; `source.line` esistente nel file; `source.recordId` risolve al record dichiarato; `source.field` esistente in quel record; `source.line` uguale alla riga reale del campo; `source.literal` uguale al letterale sorgente esatto; `source.scope` coerente con il record/documento risolto; `entry.dimension` uguale alla dimensione padre; `inheritedFrom.ref` risolve a un candidato esistente; `naturalId`, `resolutionMethod` e `provisional` coincidenti con la mappatura reale. |
| **File toccati** | `scripts/chunk-diagnostic.mjs` |
| **Tipi di violazione** | `unresolvedSourceFile`, `unresolvedSourceLine`, `unresolvedRecordId`, `unresolvedField`, `sourceLineMismatch`, `sourceLiteralMismatch`, `sourceScopeMismatch`, `dimensionMismatch`, `unresolvedInheritanceRef`, `unresolvedInheritanceNaturalId`, `resolutionMethodMismatch`, `provisionalFlagMismatch` |
| **Mutation test tipizzati** | File errato, riga esistente ma sbagliata, letterale errato, `recordId` inesistente, ref ereditato inesistente, flag `provisional` incoerente. **Ogni mutazione fa fallire il gate.** |
| **Limiti residui dichiarati** | La risoluzione è ancorata alla struttura corrente dei record KB04. Un cambio di formato dei campi di stato richiederebbe l'aggiornamento del risolutore, non del gate. |

## §3 — Semantica documented-null

| Voce | Dettaglio |
|---|---|
| **Difetto contestato** | Veniva emesso `notDocumented` là dove la fonte canonica contiene evidenza di stato non ancora classificata. In particolare i record `LEG-2018-GAP`, `LEG-2015-GAP`, `LEG-2013-GAP`, `LEG-2012-GAP` documentano esplicitamente ricerca ancora da completare. |
| **Correzione (record LEG-*-GAP)** | Il campo `Stato locale` della KB04 è ora mappato anche su `researchStatus`. I quattro record espongono `researchStatus.documentedNull.reason = "notYetEvaluated"` con il **letterale preservato verbatim**: `"ricerca nell'Albo Pretorio e negli archivi da completare"`. Non normalizzato a `"ricerca aperta"`. |
| **Correzione (scope-level / front matter)** | Nuovo meccanismo autonomo `buildScopeLevelStatusEvidence` che espone l'evidenza di stato documentata ma non classificata a livello di documento e di riga di tabella, **senza** attribuirla arbitrariamente a un candidato. Produce **11 voci**: 3 `frontMatterStatus` (KB01 riga 9, KB02 riga 10, KB03 riga 9) e 8 `tableRowStatus` (KB03, tabella "Atti necessari", righe 314–321). Tutte con `reason: "notYetEvaluated"`, letterale e source preservati. |
| **Motivazione della scelta di progetto** | L'alternativa — agganciare i letterali a un candidato esistente — è stata **scartata e revertita** perché disonesta: nessun candidato è ancorato alle righe di front matter, e la tabella "Atti necessari" è un unico candidato atomico con un solo slot `documentaryStatus` a fronte di 8 letterali distinti di riga. Collassarli avrebbe richiesto un'aggregazione arbitraria. |
| **File toccati** | `scripts/lib/documentary-status.mjs`, `scripts/chunk-diagnostic.mjs`, `tests/chunk-diagnostic.test.mjs` |
| **Gate** | Nuovo `allScopeLevelStatusEvidenceResolvesSemantically`. Tipi di violazione: `unresolvedSourceFile`, `unresolvedSourceLine`, `missingLiteral`, `sourceLiteralMismatch`, `wrongDocumentedNullReason`, `documentedNullLiteralMismatch`. |
| **Mutation test** | Letterale alterato, riga fuori dai limiti del file, `reason` diversa da `notYetEvaluated`: ognuna fa **fallire** il gate. |
| **Limiti residui dichiarati** | Le 11 voci scope-level sono **esposte, non classificate**: restano evidenza documentale in attesa di valutazione editoriale. Il meccanismo non tenta di dedurne un valore. |

## §4 — Rimozione delle affermazioni di implementazione false

| File | Affermazione falsa | Correzione |
|---|---|---|
| `PRIVACY.md` (riga 5) | "La ricerca documentale locale (Pagefind) **funziona** interamente lato client" | Riscritta: Pagefind è **pianificata ma non ancora implementata**; il comportamento client-side è descritto al futuro, con impegno ad aggiornare l'informativa prima dell'attivazione. Rimossa anche "ricerca" dall'elenco delle sezioni del sito statico. |
| `netlify/functions/ask.ts` (riga 12, solo commento) | "(Pagefind **funziona sempre**)" | Nota esplicita: alla data del commento Pagefind **non** è implementato; il messaggio 503 dovrà riflettere lo stato reale al momento dell'implementazione. Il file resta un placeholder inerte. |
| `src/layouts/BaseLayout.astro` (righe 17–19) | Il commento descriveva l'esclusione "dalla ricerca Pagefind" come attiva | Chiarito che il marcatore `data-pagefind-ignore` è **predisposizione futura** e non attiva alcuna esclusione reale finché Pagefind non sarà integrato. |
| `ATTRIBUTION.md` | "**Ogni pagina generata dal sito riporta:** … collegamento diretto … stato documentale a quattro dimensioni" | Premessa esplicita: il sito v1 **non genera ancora** pagine per atto con collegamento diretto o badge di stato pubblico; l'elenco è riformulato al futuro. Aggiunta precisazione che il contratto a quattro dimensioni è implementato **solo negli strumenti diagnostici interni**, non collegato alle pagine pubbliche. |
| **HTML generato (`dist/`)** | `dist/privacy/index.html` conteneva la vecchia affermazione compilata | Build rigenerata; verificato che la stringa `"funziona interamente lato client"` **non compare più in alcun file di `dist/`**. |
| Verificati e già onesti (nessuna modifica) | `README.md`, `NOTICE.md`, `src/pages/chi-siamo.astro`, `src/pages/metodologia.astro`, `src/pages/fonti.astro`, `src/pages/disciplina-vigente.astro` | Già al futuro ("in costruzione", "presenterà", "mostrerà") o già marcati "non implementato". |

**Metodo di ricerca:** grep dell'intero repository (esclusi `node_modules/`) su `pagefind` e su termini
correlati (`consultabil`, `ricercabil`, `motore di ricerca`, `badge`, `citazion`, `documentaryStatus`
…), più ispezione di **tutti** i file HTML generati in `dist/`, non del solo README/NOTICE.

## §5 — Determinismo dell'albero di build

| Voce | Dettaglio |
|---|---|
| **Difetto contestato** | `data/chunks.generated.json` conteneva `generatedAt`, rendendo ogni build diversa dalla precedente e sporcando l'albero tracciato. |
| **Correzione** | Rimosso `generatedAt` dal placeholder e da `scripts/build-content-index.mjs` (eliminata la chiamata `new Date()`). Aggiornato anche il riferimento interno stale a v3.1.2 → v3.1.3. |
| **File toccati** | `scripts/build-content-index.mjs`, `data/chunks.generated.json` |
| **Test nuovi** | `tests/build-determinism-v313.test.mjs` (4 test): (a) `npm run build` non crea, elimina né modifica alcun file tracciato — confronto SHA-256 dell'intero albero prima/dopo, con le sole esclusioni di `.gitignore`; (b) due build consecutive lasciano `data/chunks.generated.json` **byte-identico**; (c) il file committato non contiene `generatedAt` né alcun valore simile a un timestamp ISO-8601; (d) lo script sorgente non contiene più `generatedAt` né `new Date()`. |
| **Esito osservato** | 4/4 pass. Solo `dist/` e `.astro/` (entrambi in `.gitignore`) cambiano durante la build. |

## §6 — Evidenze finali pulite

| Voce | Dettaglio |
|---|---|
| **Difetto contestato** | README fermo a una release precedente; nota stale "risultati ancora da compilare" nel verdetto; conteggio delle famiglie non veritiero ("almeno 11", copertura adiacente dichiarata su un universo sbagliato). |
| **Universo reale osservato** | **12 famiglie** file × candidateType: `kb01:articoloOrdinario`, `kb01:puntoDiModifica`, `kb01:sezioneSemantica`, `kb01:tabellaAtomica`, `kb02:sezioneSemantica`, `kb02:tabellaAtomica`, `kb02:voceCronologia`, `kb03:articoloOrdinario`, `kb03:sezioneSemantica`, `kb03:tabellaAtomica`, `kb04:recordRegistro`, `kb04:sezioneSemantica`. |
| **Correzione delle asserzioni** | `families.size >= 11` sostituito da un confronto **esatto** con l'elenco delle 12 famiglie (`assert.deepEqual`): una famiglia che comparisse o scomparisse ora fa fallire il test invece di passare sotto soglia. Il mutation test principale copre **tutte e 12**. |
| **Copertura adiacente — dichiarazione onesta** | La variante di inserimento *adiacente* copre **10 famiglie su 12**, non "almeno 10". L'asserzione è ora un'uguaglianza esatta (`adjacentCovered === 10`, `families.size - adjacentCovered === 2`). Le 2 escluse — `kb01:sezioneSemantica` e `kb02:sezioneSemantica` — lo sono per **ragione strutturale**: sono famiglie residuali che iniziano subito dopo contenuto non vuoto, quindi non esiste riga bianca precedente in cui inserire restando provatamente all'esterno del candidato. |
| **Documenti** | README aggiornato a v3.1.3 con le 12 famiglie elencate e la copertura 10/12 esplicitata. `VERDETTO_FINALE_v3.1.2.md`, `CHANGELOG_v3.1.2.md` e `data/chunk-diagnostic-report-v3.1.2.md` marcati **DOCUMENTO SUPERATO** con banner in testa, contenuto conservato invariato come storico. `version` del report JSON aggiornata da `3.1.2` a `3.1.3`. |
| **Nota stale** | La frase "i cui esiti osservati sono ancora da compilare" resta **solo** nel documento v3.1.2, ora esplicitamente storico e superato. Il verdetto v3.1.3 riporta esiti effettivamente osservati. |

---

## Conservazione del lavoro già verificato

Preservati senza regressioni, come richiesto: i quattro file KB canonici (immutati), i parser, i
`contentHash` SHA-256, l'implementazione del containment, i mutation test di inserimento, gli
artefatti diagnostici deterministici, i default pubblici committati e il reporting corrente di
`npm audit`.

## Vincoli rispettati

- `scripts/build-content-index.mjs` resta un **placeholder** che scrive un `chunks.generated.json`
  vuoto e valido.
- `netlify/functions/ask.ts` resta un **placeholder architetturale inerte** (modificato solo un
  commento).
- Nessuna riconvocazione del MODEL COUNCIL.
- `LICENSE`: il segnaposto `[TITOLARE DEL COPYRIGHT — DA DECIDERE]` è invariato.
- Nessun `CODEOWNERS` creato.
- `GITHUB_URL` resta `null`; `GITHUB_URL_PENDING` invariato.
- Formulazioni di governance §7 (attribuzione Pistakkio®, footer, responsabilità editoriale)
  invariate.
- Nessun comando vietato eseguito (`npm audit fix`, `--force`, upgrade ad Astro 7).
