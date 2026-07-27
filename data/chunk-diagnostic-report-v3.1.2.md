# Diagnostica di chunking v3.1.2 — Fonti del Palio

> **DOCUMENTO SUPERATO.** Questa release e' stata sottoposta a verifica indipendente ed ha
> ricevuto un verdetto di **CONDITIONAL FAIL**. E' superata dalla release correttiva **v3.1.3**
> (27 luglio 2026) — vedi `VERDETTO_FINALE_v3.1.3.md`, `CHANGELOG_v3.1.3.md` e
> `data/chunk-diagnostic-report-v3.1.3.md`. Il contenuto sottostante e' conservato invariato
> come documentazione storica del ciclo v3.1.2 e NON descrive lo stato corrente del repository.

Release correttiva su v3.1.1 (ora superata — vedi `CHANGELOG_v3.1.2.md`). Fonte: esecuzione di
`scripts/chunk-diagnostic.mjs` (`analyzeAll()`) e della relativa CLI (`npm run chunk:diagnostic`)
contro i 4 file KB canonici correnti in `content/kb/`. Nessun conteggio riportato qui proviene da un
JSON stale: tutti i valori sono quelli dell'esecuzione corrente. Questo documento sostituisce
`data/chunk-diagnostic-report-v3.1.1.md`.

`version`: **3.1.2**.

## Verdetto

Vedi `VERDETTO_FINALE_v3.1.2.md` per il verdetto formale. Riepilogo: **18 gate di accettazione, tutti
PASS** (§8 sotto); suite **73 test, 73 pass, 0 fail**; containment `violationCount` **0** su tutti e
4 i file. Restano limiti dichiarati (§12) fuori dallo scope di questa diagnostica.

## 1. Conteggi diagnostici (metriche separate)

| Metrica | Valore | Nota |
|---|---|---|
| `diagnosticCandidateCount` (totale) | **710** | 273 (KB01) + 183 (KB02) + 170 (KB03) + 84 (KB04) |
| `estimatedSplitCount` (totale) | **766** | 297 (KB01) + 183 (KB02) + 202 (KB03) + 84 (KB04) — stima diagnostica di sotto-suddivisione per soglia di token, **non** un conteggio di produzione |
| `productionChunkCount` | `null` | Resta `null` **per progetto**: nessun chunker di produzione è implementato e `data/chunks.generated.json` è un placeholder inerte |

## 2. Le 11 famiglie di candidati

`kb01:articoloOrdinario`, `kb01:puntoDiModifica`, `kb01:tabellaAtomica`, `kb01:sezioneSemantica`,
`kb02:sezioneSemantica`, `kb02:voceCronologia`, `kb02:tabellaAtomica`, `kb03:articoloOrdinario`,
`kb03:tabellaAtomica`, `kb03:sezioneSemantica`, `kb04:recordRegistro`, `kb04:sezioneSemantica`.

Il mutation test di inserimento reale (v3.1.2 §2) copre tutte le famiglie: inserisce 7 righe prima
del candidato, riesegue il parser sulla sorgente mutata e verifica ID pubblico e `contentHash`
invariati con `startLine`/`endLine` spostati di +7.

## 3. Contratto di stato documentario a 4 dimensioni (v3.1.2 §1)

Ogni candidato espone quattro dimensioni indipendenti, ciascuna con il valore canonico esatto oppure
un documented-null tipizzato (`notDocumented`, `notApplicable`, `notYetEvaluated`), più il
riferimento macchina-leggibile alla fonte e il riferimento di ereditarietà. Nessuna normalizzazione,
nessuna inferenza: solo match esatto contro `KB04_LEGEND_CROSSWALK` (11 voci).

### 3.1 `documentaryStatus` — distribuzione sui 710 candidati

| Valore | Candidati |
|---|---|
| `null:notDocumented` | 379 |
| `null:notYetEvaluated` | 126 |
| «protocollo presente; atto di approvazione non incluso» | 109 |
| «presente nel corpus» | 96 |
| **Totale** | **710** |

### 3.2 `legalStatus` — distribuzione sui 710 candidati

| Valore | Candidati |
|---|---|
| `null:notDocumented` | 578 |
| `null:notYetEvaluated` | 110 |
| «efficacia annuale esaurita» | 13 |
| `null:notApplicable` | 6 |
| «efficacia esaurita» | 3 |
| **Totale** | **710** |

### 3.3 `presenceStatus` e `researchStatus`

| Dimensione | Valore | Candidati |
|---|---|---|
| `presenceStatus` | `null:notYetEvaluated` | 710 |
| `researchStatus` | `null:notDocumented` | 710 |

Entrambe restano documented-null su tutti i candidati perché le fonti canoniche non le documentano.

**266 candidati** espongono un riferimento di ereditarietà esplicito. L'integrità (`contentHash`,
range ricostruiti) è tenuta separata in `c.integrity`.

## 4. Containment v3.1.2 (§3)

| File | Blocchi contenitore |
|---|---|
| KB01 | 18 |
| KB02 | 26 |
| KB03 | 15 |
| KB04 | 89 |

`violationCount`: **0**. I `CONTAINMENT_VIOLATION_KINDS` congelati sono `noContainingBlock`,
`endsOutsideBlock`, `wrongScope`, `crossesBlockBoundary`; l'assenza di un blocco contenitore è ora
una violazione e non più un'esenzione silenziosa. Progressione misurata nel ciclo: 18 → 6 → 0.

## 5. KB02 — sezioni H1 e annualità corrette

Sezioni H1 (dopo la correzione della partizione): 13-30, 31-75, 76-94, 95-144, 145-393, 394-456,
457-519, 520-537, 538-554, 555-590, 591-601.

| Anno | Range |
|---|---|
| 2012 | 147-169 |
| 2013 | 170-189 |
| 2014 | 190-208 |
| 2015 | 209-224 |
| 2016 | 225-244 |
| 2017 | 245-259 |
| 2018 | 260-269 |
| 2019 | 270-294 |
| 2020 | 295-311 |
| 2021 | 312-321 |
| 2022 | 322-332 |
| 2023 | 333-350 |
| 2024 | 351-362 |
| 2025 | 363-372 |
| 2026 | 373-393 |

Il valore corretto di `endLine` per il 2026 è **393** (in v3.1.1 era 601, con uno sconfinamento di
208 righe che inghiottiva sei sezioni H1 di inquadramento).

## 6. Tabelle Markdown

**11 tabelle Markdown** inventariate, tutte atomiche.

## 7. Mapping KB01→KB04

- `actNumberMatch`: **8**
- `yearOnlyFallback`: **9** — anni 2013, 2017, 2018, 2020, 2021, 2022, 2023, 2024, 2025
- **Totale: 17**

La distinzione fra match verificato e fallback resta esplicita e **nessun fallback è stato promosso**.

## 8. Gate di accettazione (18/18 PASS)

| # | Gate | Risultato |
|---|---|---|
| 1 | `allCandidatesHaveCanonicalStatusDimensions` | PASS |
| 2 | `kb01ArticleTotalMatchesExpected247` | PASS |
| 3 | `kb01NoUnmatchedActs` | PASS |
| 4 | `kb01NoUnmatchedRegisterRecords` | PASS |
| 5 | `allCandidateRangesContainedWithinBlock` | PASS |
| 6 | `everyCandidateFullyContainedInDeclaredScope` | PASS |
| 7 | `zeroGlobalCandidateOverlaps` | PASS |
| 8 | `coverageLedgerZeroUnexplainedAllFiles` | PASS |
| 9 | `zeroSubstantiveLinesWithoutCandidateOrReason` | PASS |
| 10 | `noStableIdCollisions` | PASS |
| 11 | `noUnscopedCandidates` | PASS |
| 12 | `kb03RegolamentoArticle1To105Present` | PASS |
| 13 | `kb03CoordinatedArt37And38Present` | PASS |
| 14 | `kb03ControlledMedicationsTableAtomic` | PASS |
| 15 | `allMarkdownTablesAtomic` | PASS |
| 16 | `kb04AllFourRecordFamiliesPresent` | PASS |
| 17 | `kb02IdsStableUnderInsertion` | PASS |
| 18 | `productionChunkCountRemainsNull` | PASS |

## 9. Suite di test

**73 test, 73 pass, 0 fail.** Include i due nuovi file di questo ciclo:
`tests/containment-v312.test.mjs` (8 test) e `tests/public-defaults-v312.test.mjs` (6 test).

## 10. Integrità delle 4 KB canoniche

SHA-256 dei file canonici:

| File | SHA-256 |
|---|---|
| KB01 | `ff9c63de4ea9001aeddbcb97fb0b806ffec22b5cba28d215be4b6a5317db0cb3` |
| KB02 | `6d7282df3c67322001646dc5127f7db3b4983dba8238c273a6ee849acb8c0979` |
| KB03 | `a5ab22da9ec7ead082f523ca7c242794ac51cb744424f911acd91f25f750fc1a` |
| KB04 | `81f3e58ee026943c347a3f787382fca1d4c228803594fe20b70a6d6fa0297b89` |

Tutte e quattro sono state confrontate **byte a byte** con i file originali caricati e sono risultate
identiche.

## 11. `npm audit` — stato corrente

Dati esatti da `npm audit --json` sul lockfile finale: **13 nodi**, **13 vulnerabilità**, `metadata`
`{low: 1, high: 12, moderate: 0, critical: 0, info: 0}`, **11 advisory unici**.

Le due affermazioni della v3.1.1 (tutti i reperti richiedono Astro 7; 10 nodi su 13 hanno una
correzione semplice) sono **entrambe errate e ritirate**. La tabella per-nodo completa e la catena di
verifica che spiega perché `fixAvailable: true` non equivale a una remediation garantita
non-breaking sono in `CHANGELOG_v3.1.2.md` §6.1 e §6.2.

Non sono stati eseguiti `npm audit fix`, né `npm audit fix --force`, né alcun upgrade di Astro:
**nessuna remediation è stata applicata**.

## 12. Limiti dichiarati

1. Nessun chunker di produzione, Pagefind, embeddings, retrieval o layer AI implementato, per vincolo
   esplicito.
2. `productionChunkCount` resta `null` per progetto; `data/chunks.generated.json` resta un
   placeholder inerte.
3. `presenceStatus` e `researchStatus` sono documented-null su tutti i 710 candidati perché le fonti
   canoniche non li documentano.
4. Nessuna remediation di sicurezza applicata.
5. Il repository resta privato.
6. I 9 mapping `yearOnlyFallback` restano provvisori e non promossi.
7. `estimatedSplitCount` è solo diagnostico, non un impegno sul numero di chunk finali.
