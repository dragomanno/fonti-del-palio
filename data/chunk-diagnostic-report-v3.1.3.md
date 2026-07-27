# Diagnostica di chunking — v3.1.3

Report leggibile che accompagna l'artefatto macchina `data/chunk-diagnostic-report.json`
(`version: "3.1.3"`) e l'elenco completo dei candidati in `data/diagnostic-candidates.json`.

Questa diagnostica **non genera chunk di produzione**. Esegue i parser reali contro i quattro file
KB canonici e misura ciò che un chunker dovrebbe produrre, in modo che le regole possano essere
approvate prima di essere implementate. `productionChunkCount` resta deliberatamente `null`.

I quattro file KB canonici sono **immutati**: SHA-256 verificati identici agli originali caricati.

---

## Cifre osservate

| Metrica | Valore |
|---|---|
| Candidati diagnostici | **710** |
| — per file | kb01: 273 · kb02: 183 · kb03: 170 · kb04: 84 |
| Split stimati | **766** |
| — per file | kb01: 297 · kb02: 183 · kb03: 202 · kb04: 84 |
| Chunk di produzione | **`null`** (chunker non implementato) |
| Articoli ordinari KB01 | 247 su 247 attesi (+ 2 punti di modifica) |
| Evidenza di stato scope-level | 11 voci, **0 violazioni** |
| Gate di accettazione | **19 / 19 PASS** |
| Suite di test | **95 / 95 pass, 0 fail** |

## Copertura riga per riga — nessuna riga non spiegata

Ogni riga di ciascun file canonico è classificata in una categoria esplicita. Il gate
`coverageLedgerZeroUnexplainedAllFiles` fallisce se anche una sola riga resta non spiegata.

| File | Righe totali | Bianche | Non bianche | Non spiegate | Righe in sovrapposizione globale |
|---|---|---|---|---|---|
| kb01 | 4463 | 1258 | 3205 | **0** | **0** |
| kb02 | 601 | 181 | 420 | **0** | **0** |
| kb03 | 4634 | 1589 | 3045 | **0** | **0** |
| kb04 | 1100 | 223 | 877 | **0** | **0** |

Categorie usate: `candidate-content`, `blank`, `structural-heading`, `explicitly-non-chunkable`,
`inherited-metadata` (solo kb01, 85 righe), `excluded` (kb02 e kb03, 2 righe ciascuno).

## Stato documentale a quattro dimensioni

Le quattro dimensioni sono `documentaryStatus`, `legalStatus`, `presenceStatus`, `researchStatus`.
Ogni dimensione, per ogni candidato, porta o un valore ancorato a una fonte canonica risolta, o un
`documentedNull` con una delle tre motivazioni ammesse: `notDocumented`, `notApplicable`,
`notYetEvaluated`.

### Risoluzione semantica (§2)

`checkCanonicalStatusDimensions` risolve — non si limita a controllare i tipi. Verifica file, riga,
`recordId`, campo, coincidenza tra riga dichiarata e riga reale del campo, letterale esatto, scope,
dimensione padre, risoluzione del ref ereditato, `naturalId`, `resolutionMethod` e `provisional`.

Dodici tipi di violazione: `unresolvedSourceFile`, `unresolvedSourceLine`, `unresolvedRecordId`,
`unresolvedField`, `sourceLineMismatch`, `sourceLiteralMismatch`, `sourceScopeMismatch`,
`dimensionMismatch`, `unresolvedInheritanceRef`, `unresolvedInheritanceNaturalId`,
`resolutionMethodMismatch`, `provisionalFlagMismatch`. Sul corpus intatto: **0 violazioni**.

### Ereditarietà da KB04 e provenienza della mappatura (§1)

| Metrica | Valore |
|---|---|
| Candidati che ereditano stato da KB04 | 266 |
| Voci di stato ereditate (4 dimensioni × 266) | 1064 |
| `registerIdExactMatch` — `provisional: false` | **532** |
| `registerIdYearOnlyFallback` — `provisional: true` | **532** |
| Candidati distinti con almeno una voce provvisoria | **133** |

`resolutionMethod` e `provisional` derivano dalla voce di mapping reale. I 133 candidati che v3.1.2
promuoveva indebitamente a esatti sono ora tutti e soli quelli marcati provvisori.

### Mappatura KB01 → KB04

| Metodo | Conteggio | Significato |
|---|---|---|
| `actNumberMatch` | **8** | numero di atto trovato nel titolo KB01 e confermato nel campo `Atto` del record KB04 |
| `yearOnlyFallback` | **9** | *PROVVISORIO* — il titolo KB01 non riporta un numero di atto; assegnazione per anno + unicità del record, **richiede verifica manuale sugli originali** |
| **Totale** | **17** | |

Anni provvisori: 2013, 2017, 2018, 2020, 2021, 2022, 2023, 2024, 2025.

Per 2 di questi 9 anni il campo `Atto` del record KB04 riporta un numero esplicito che il titolo
KB01 non riporta — 2013: `"Commissario straordinario n. 11"`; 2020: `"G.C. n. 51"`. L'evidenza è
registrata nel report, ma **non è sufficiente** a promuovere automaticamente la mappatura: resta
provvisoria.

### Evidenza di stato documentata ma non classificata (§3)

Quattro record di gap in KB04 documentano esplicitamente ricerca ancora da completare. Sono
rappresentati come `notYetEvaluated`, **non** come `notDocumented`, con il letterale preservato
verbatim e **non** normalizzato a `"ricerca aperta"`:

`kb04:leg-2018-gap`, `kb04:leg-2015-gap`, `kb04:leg-2013-gap`, `kb04:leg-2012-gap` →
`researchStatus.documentedNull.reason = "notYetEvaluated"`,
`literal = "ricerca nell'Albo Pretorio e negli archivi da completare"`.

A livello di scope e front matter, `buildScopeLevelStatusEvidence` espone **11 voci** ulteriori — 3
`frontMatterStatus` (kb01:9, kb02:10, kb03:9) e 8 `tableRowStatus` (kb03, righe 314–321) — tutte
`notYetEvaluated`, con letterale e source preservati. Sono **esposte, non classificate**: restano in
attesa di valutazione editoriale. Gate dedicato
`allScopeLevelStatusEvidenceResolvesSemantically`: **0 violazioni**.

## Atomicità delle tabelle

Tutte le tabelle Markdown rilevate nei quattro file sono `atomic`: nessuna tabella viene mai spezzata
attraverso un confine di chunk. Il gate `allMarkdownTablesAtomic` copre l'intero inventario; i gate
`kb03ControlledMedicationsTableAtomic` e `kb03CoordinatedArt37And38Present` verificano i casi
specificamente critici.

## Stabilità e integrità degli identificatori

- **Nessuna collisione** di `stableId` (`noStableIdCollisions`).
- **Nessun candidato privo di scope** (`noUnscopedCandidates`).
- **Nessuna sovrapposizione** globale tra intervalli di candidati (`zeroGlobalCandidateOverlaps`).
- Ogni candidato è **interamente contenuto** nel blocco e nello scope dichiarati
  (`allCandidateRangesContainedWithinBlock`, `everyCandidateFullyContainedInDeclaredScope`).
- Gli identificatori KB02 sono **stabili all'inserimento** di righe (`kb02IdsStableUnderInsertion`).

## Mutation test di inserimento — 12 famiglie osservate

L'universo reale è di **12 famiglie** file × candidateType, ora asserito per uguaglianza esatta e
non più con una soglia:

| # | Famiglia | # | Famiglia |
|---|---|---|---|
| 1 | `kb01:articoloOrdinario` | 7 | `kb02:voceCronologia` |
| 2 | `kb01:puntoDiModifica` | 8 | `kb03:articoloOrdinario` |
| 3 | `kb01:sezioneSemantica` | 9 | `kb03:sezioneSemantica` |
| 4 | `kb01:tabellaAtomica` | 10 | `kb03:tabellaAtomica` |
| 5 | `kb02:sezioneSemantica` | 11 | `kb04:recordRegistro` |
| 6 | `kb02:tabellaAtomica` | 12 | `kb04:sezioneSemantica` |

- Mutation test principale: copre **12 / 12**.
- Variante di inserimento **adiacente**: copre **10 / 12**.

Le 2 famiglie escluse dalla variante adiacente — `kb01:sezioneSemantica` e `kb02:sezioneSemantica` —
lo sono per **ragione strutturale**: sono famiglie residuali che iniziano subito dopo contenuto non
vuoto, quindi non esiste una riga bianca precedente in cui inserire restando provatamente
all'esterno del candidato. L'esclusione è documentata nel test e verificata numericamente.

## Determinismo (§5)

`data/chunks.generated.json` non contiene più `generatedAt`; `scripts/build-content-index.mjs` non
chiama più `new Date()`. Tre build consecutive su estrazione pulita producono un file
**byte-identico** (`dfd38b6e…805d84`). Solo `dist/` e `.astro/`, entrambi in `.gitignore`, cambiano
durante la build. Gli artefatti diagnostici rigenerati da estrazione pulita risultano **identici** a
quelli committati.

## Verdetto della diagnostica

**PASS — 19 / 19 gate di accettazione.**

```
allCandidatesHaveCanonicalStatusDimensions      allMarkdownTablesAtomic
allScopeLevelStatusEvidenceResolvesSemantically kb04AllFourRecordFamiliesPresent
kb01ArticleTotalMatchesExpected247              kb02IdsStableUnderInsertion
kb01NoUnmatchedActs                             productionChunkCountRemainsNull
kb01NoUnmatchedRegisterRecords                  noStableIdCollisions
allCandidateRangesContainedWithinBlock          noUnscopedCandidates
everyCandidateFullyContainedInDeclaredScope     kb03RegolamentoArticle1To105Present
zeroGlobalCandidateOverlaps                     kb03CoordinatedArt37And38Present
coverageLedgerZeroUnexplainedAllFiles           kb03ControlledMedicationsTableAtomic
zeroSubstantiveLinesWithoutCandidateOrReason
```

## Cosa questa diagnostica **non** dimostra

- Non dimostra che il chunker di produzione funzioni: **non esiste**.
- Non dimostra la qualità del retrieval: embeddings, Pagefind e ricerca **non sono implementati**.
- Non promuove le 9 mappature provvisorie: restano da verificare manualmente.
- Non classifica le 11 voci di evidenza scope-level: le espone soltanto.
