# Verdetto finale — Diagnostica di chunking v3.1.3

Release correttiva sul verdetto indipendente **CONDITIONAL FAIL** emesso su v3.1.2, che è
**superata da v3.1.3**. Questo documento riporta l'esito sezione per sezione delle sei correzioni
richieste, ciascuna ancorata a un'evidenza puntuale, e gli esiti **effettivamente osservati** della
sequenza di verifica da estrazione pulita.

Tutti i valori riportati provengono dall'esecuzione registrata più sotto. Nessun esito è dichiarato
in anticipo, nessun risultato è lasciato "da compilare".

---

## Esito complessivo

| | |
|---|---|
| **Verdetto** | **PASS** |
| Data | 27 luglio 2026 |
| Gate di accettazione | **19 / 19 PASS** |
| Suite di test | **95 / 95 pass, 0 fail** (estrazione pulita, senza `.env`) |
| File KB canonici | **immutati** — SHA-256 identici agli originali caricati |
| Chunker di produzione | **non implementato** — `productionChunkCount` resta `null` |

Il PASS è dichiarato **solo** dopo che ogni riferimento si è risolto semanticamente e ogni mappatura
provvisoria è rimasta provvisoria lungo l'intero contratto dei candidati.

---

## §1 — Provenienza della mappatura KB01→KB04 — **PASS**

`resolutionMethod` e `provisional` sono derivati dalla voce di mapping reale, non più cablati.

Evidenza osservata su `data/diagnostic-candidates.json`:

- 266 candidati ereditano stato da KB04 → **1064 voci** di stato ereditate (4 dimensioni × 266);
- **532 voci** `registerIdExactMatch` con `provisional: false` (dagli 8 mapping `actNumberMatch`);
- **532 voci** `registerIdYearOnlyFallback` con `provisional: true` (dai 9 mapping `yearOnlyFallback`);
- **133 candidati distinti** portano almeno una voce provvisoria.

I 133 candidati contestati — che v3.1.2 promuoveva indebitamente a `registerIdExactMatch` — sono
ora tutti e soli quelli marcati provvisori. Nessuna promozione silenziosa.

Il gate `allCandidatesHaveCanonicalStatusDimensions` fallisce se un mapping provvisorio viene
dichiarato esatto o se `provisional` viene forzato a `false` (violazioni `resolutionMethodMismatch`
e `provisionalFlagMismatch`), come dimostrato dai mutation test.

**Limite dichiarato:** i 9 anni provvisori (2013, 2017, 2018, 2020, 2021, 2022, 2023, 2024, 2025)
restano provvisori e **richiedono verifica manuale sugli originali** prima di qualunque uso in
citazioni legali o di atto esatto.

## §2 — Risoluzione semantica reale dei riferimenti — **PASS**

`checkCanonicalStatusDimensions` non esegue più un semplice controllo di tipo: risolve ogni
riferimento contro le fonti canoniche. Sono validati file, riga, `recordId`, campo, coincidenza tra
riga dichiarata e riga reale del campo, letterale esatto, scope, dimensione padre, risoluzione del
ref ereditato, `naturalId`, `resolutionMethod` e `provisional`.

Dodici tipi di violazione distinti: `unresolvedSourceFile`, `unresolvedSourceLine`,
`unresolvedRecordId`, `unresolvedField`, `sourceLineMismatch`, `sourceLiteralMismatch`,
`sourceScopeMismatch`, `dimensionMismatch`, `unresolvedInheritanceRef`,
`unresolvedInheritanceNaturalId`, `resolutionMethodMismatch`, `provisionalFlagMismatch`.

Mutation test tipizzati eseguiti e verdi: file errato, riga esistente ma sbagliata, letterale
errato, `recordId` inesistente, ref ereditato inesistente, flag `provisional` incoerente. **Ogni
mutazione fa fallire il gate.**

Sul corpus canonico intatto: **0 violazioni**.

## §3 — Semantica documented-null — **PASS**

**Record LEG-*-GAP.** Il campo `Stato locale` della KB04 è mappato anche su `researchStatus`. I
quattro record espongono ora, verificato sull'artefatto generato:

| Record | `researchStatus.value` | `documentedNull.reason` | `literal` |
|---|---|---|---|
| `kb04:leg-2018-gap` | `null` | `notYetEvaluated` | `"ricerca nell'Albo Pretorio e negli archivi da completare"` |
| `kb04:leg-2015-gap` | `null` | `notYetEvaluated` | `"ricerca nell'Albo Pretorio e negli archivi da completare"` |
| `kb04:leg-2013-gap` | `null` | `notYetEvaluated` | `"ricerca nell'Albo Pretorio e negli archivi da completare"` |
| `kb04:leg-2012-gap` | `null` | `notYetEvaluated` | `"ricerca nell'Albo Pretorio e negli archivi da completare"` |

Non `notDocumented`. Il letterale è **preservato verbatim** e **non** normalizzato a
`"ricerca aperta"`.

**Evidenza scope-level e front matter.** Nuovo meccanismo autonomo `buildScopeLevelStatusEvidence`,
che espone **11 voci** di evidenza documentata ma non ancora classificata, tutte con
`reason: "notYetEvaluated"`, letterale e source preservati:

| Tipo | File | Riga | Letterale |
|---|---|---|---|
| `frontMatterStatus` | kb01 | 9 | `"uso interno; non sostituisce i PDF originali"` |
| `frontMatterStatus` | kb02 | 10 | `"ricostruzione redazionale verificata sul corpus; non sostituisce gli atti"` |
| `frontMatterStatus` | kb03 | 9 | `"consolidato redazionale; verificare sempre eventuali atti successivi"` |
| `tableRowStatus` | kb03 | 314 | `"acquisito; da verificare per eventuali modifiche successive"` |
| `tableRowStatus` | kb03 | 315 | `"analizzata e consolidata"` |
| `tableRowStatus` | kb03 | 316 | `"analizzati e consolidati"` |
| `tableRowStatus` | kb03 | 317 | `"non acquisito"` |
| `tableRowStatus` | kb03 | 318 | `"identificata; PDF da acquisire localmente"` |
| `tableRowStatus` | kb03 | 319 | `"non acquisito"` |
| `tableRowStatus` | kb03 | 320 | `"da verificare"` |
| `tableRowStatus` | kb03 | 321 | `"richiamato, non incluso"` |

**Scelta di progetto dichiarata.** L'approccio alternativo — agganciare questi letterali a candidati
esistenti — è stato implementato, riconosciuto disonesto e **revertito**: nessun candidato è ancorato
alle righe di front matter, e la tabella "Atti necessari" è un unico candidato atomico con un solo
slot `documentaryStatus` a fronte di 8 letterali di riga distinti. Collassarli avrebbe richiesto
un'aggregazione arbitraria. Il meccanismo adottato **espone** l'evidenza senza classificarla né
attribuirla a un'unità di chunking arbitraria.

Nuovo gate `allScopeLevelStatusEvidenceResolvesSemantically`: **0 violazioni**. Mutation test
(letterale alterato, riga fuori dai limiti, `reason` diversa da `notYetEvaluated`) tutti verdi:
ognuna fa fallire il gate.

## §4 — Rimozione delle affermazioni di implementazione false — **PASS**

Corretti: `PRIVACY.md`, `netlify/functions/ask.ts` (solo commento — il file resta placeholder
inerte), `src/layouts/BaseLayout.astro`, `ATTRIBUTION.md`.

Verificati e già onesti, nessuna modifica necessaria: `README.md`, `NOTICE.md`,
`src/pages/chi-siamo.astro`, `src/pages/metodologia.astro`, `src/pages/fonti.astro`,
`src/pages/disciplina-vigente.astro` — tutti già al futuro o già marcati "non implementato".

Pagefind, ricerca documentale, citazioni generate e badge di stato pubblico sono ora descritti
ovunque come **futuri / non implementati**.

Ricerca estesa all'intero repository e all'**HTML generato**, non al solo README/NOTICE. La build è
stata rigenerata: verificato che la stringa `"funziona interamente lato client"` **non compare in
alcun file di `dist/`** nell'estrazione pulita.

## §5 — Determinismo dell'albero di build — **PASS**

`generatedAt` rimosso da `data/chunks.generated.json` e da `scripts/build-content-index.mjs`
(eliminata la chiamata `new Date()`). Il placeholder è ora deterministico.

Nuovo file `tests/build-determinism-v313.test.mjs`, 4/4 pass:

- `npm run build` non crea, elimina né modifica alcun file tracciato — confronto SHA-256 dell'intero
  albero prima/dopo, con le sole esclusioni di `.gitignore`;
- due build consecutive lasciano `data/chunks.generated.json` byte-identico;
- il file committato non contiene `generatedAt` né alcun valore simile a un timestamp ISO-8601;
- lo script sorgente non contiene più `generatedAt` né `new Date()`.

Verifica indipendente su estrazione pulita, **tre** build consecutive:

```
dfd38b6efcbedb453c55f123494a0953fceeffe9605b729c348b8ea4db805d84
dfd38b6efcbedb453c55f123494a0953fceeffe9605b729c348b8ea4db805d84
dfd38b6efcbedb453c55f123494a0953fceeffe9605b729c348b8ea4db805d84
```

Solo `dist/` e `.astro/`, entrambi in `.gitignore`, cambiano durante la build.

## §6 — Evidenze finali pulite — **PASS**

**Universo reale: 12 famiglie** file × candidateType, ora asserito per uguaglianza esatta
(`assert.deepEqual`) e non più con una soglia `>= 11`:

`kb01:articoloOrdinario`, `kb01:puntoDiModifica`, `kb01:sezioneSemantica`, `kb01:tabellaAtomica`,
`kb02:sezioneSemantica`, `kb02:tabellaAtomica`, `kb02:voceCronologia`, `kb03:articoloOrdinario`,
`kb03:sezioneSemantica`, `kb03:tabellaAtomica`, `kb04:recordRegistro`, `kb04:sezioneSemantica`.

Il mutation test di inserimento copre **tutte e 12** le famiglie.

La variante di inserimento **adiacente** copre **10 famiglie su 12** — dichiarato onestamente come
uguaglianza esatta, non come "almeno 10" su un universo taciuto. Le 2 escluse,
`kb01:sezioneSemantica` e `kb02:sezioneSemantica`, lo sono per ragione **strutturale**: sono famiglie
residuali che iniziano subito dopo contenuto non vuoto, quindi non esiste riga bianca precedente in
cui inserire restando provatamente all'esterno del candidato. L'esclusione è documentata nel test
stesso e verificata (`families.size - adjacentCovered === 2`).

README aggiornato a **v3.1.3**, con l'elenco delle 12 famiglie e la copertura 10/12 esplicitata.
`version` del report JSON aggiornata da `3.1.2` a `3.1.3`.

`VERDETTO_FINALE_v3.1.2.md`, `CHANGELOG_v3.1.2.md` e `data/chunk-diagnostic-report-v3.1.2.md` sono
marcati **DOCUMENTO SUPERATO** con banner in testa; il contenuto è conservato invariato come
documentazione storica. La nota stale "i cui esiti osservati sono ancora da compilare" resta
confinata al solo documento v3.1.2, ora esplicitamente storico.

---

## Sequenza di verifica da estrazione pulita — esiti osservati

Eseguita su un albero estratto da archivio in `/tmp/clean-v313`, **privo di `.env`**, di
`node_modules/`, di `dist/` e di `.astro/`.

| # | Passo | Esito osservato |
|---|---|---|
| 1 | Estrazione pulita dell'archivio | OK — nessun `.env` presente nell'albero estratto |
| 2 | `npm ci` | 706 pacchetti installati, 707 auditati |
| 3 | `npm audit` (solo reporting) | **13 vulnerabilità (1 low, 12 high)** — riportate, **non** corrette: la correzione richiederebbe `astro@7.1.3`, un breaking change vietato dal perimetro. Origine principale: vulnerabilità ereditate da `libvips` via `sharp`. |
| 4 | `npm run check` senza alcuna variabile d'ambiente | **EXIT 0** — "Validazione completata senza errori bloccanti"; nessun segreto AI richiesto |
| 5 | `npm test` | **95 test, 95 pass, 0 fail** |
| 6 | `npm run build` | 8 pagine generate, build completata |
| 7 | `npm run chunk:diagnostic` | **VERDETTO: PASS — 19/19 gate** |
| 8 | Immutabilità KB canoniche | **4/4 SHA-256 identici** agli originali caricati |
| 9 | Determinismo (3 build consecutive) | `chunks.generated.json` **byte-identico** |
| 10 | Riproducibilità artefatti diagnostici | `diagnostic-candidates.json` e `chunk-diagnostic-report.json` **identici** a quelli committati |
| 11 | Affermazioni false nell'HTML generato | **assenti** |
| 12 | Vincoli invariabili | placeholder LICENSE presente; nessun `CODEOWNERS`; `GITHUB_URL = null`; `GITHUB_URL_PENDING` invariato; `chunks.generated.json` resta placeholder vuoto |

### Gate di accettazione — 19/19 PASS

```
[PASS] allCandidatesHaveCanonicalStatusDimensions
[PASS] allScopeLevelStatusEvidenceResolvesSemantically
[PASS] kb01ArticleTotalMatchesExpected247
[PASS] kb01NoUnmatchedActs
[PASS] kb01NoUnmatchedRegisterRecords
[PASS] allCandidateRangesContainedWithinBlock
[PASS] everyCandidateFullyContainedInDeclaredScope
[PASS] zeroGlobalCandidateOverlaps
[PASS] coverageLedgerZeroUnexplainedAllFiles
[PASS] zeroSubstantiveLinesWithoutCandidateOrReason
[PASS] noStableIdCollisions
[PASS] noUnscopedCandidates
[PASS] kb03RegolamentoArticle1To105Present
[PASS] kb03CoordinatedArt37And38Present
[PASS] kb03ControlledMedicationsTableAtomic
[PASS] allMarkdownTablesAtomic
[PASS] kb04AllFourRecordFamiliesPresent
[PASS] kb02IdsStableUnderInsertion
[PASS] productionChunkCountRemainsNull
```

---

## Limiti residui dichiarati

Questi limiti non sono difetti nascosti: sono lo stato reale, dichiarato per evitare che il PASS
venga letto come più ampio di quanto sia.

1. **9 mappature KB01→KB04 restano provvisorie** e richiedono verifica manuale sugli originali prima
   di un uso in citazioni legali o di atto esatto. Per 2 di questi 9 anni (2013, 2020) il campo
   `Atto` del record KB04 riporta un numero esplicito che il titolo KB01 non riporta; l'evidenza è
   registrata, ma non è sufficiente a promuovere automaticamente la mappatura.
2. **Le 11 voci di evidenza scope-level sono esposte, non classificate.** Restano in attesa di
   valutazione editoriale; il sistema non tenta di dedurne un valore.
3. **La copertura del mutation test adiacente è 10/12**, per ragione strutturale documentata.
4. **13 vulnerabilità npm** aperte (1 low, 12 high), non correggibili senza l'upgrade vietato ad
   Astro 7. Riportate, non silenziate.
5. **Nessun layer AI, retrieval, embedding, Pagefind o chunker di produzione è implementato.** Il
   perimetro è invariato rispetto al mandato.
6. **Il titolare del copyright resta indeciso**: `LICENSE` conserva il segnaposto
   `[TITOLARE DEL COPYRIGHT — DA DECIDERE]`. Richiede una decisione esplicita.
7. **Il repository GitHub resta privato**: `GITHUB_URL` è `null`. I flussi pubblici di segnalazione
   non sono attivi.
