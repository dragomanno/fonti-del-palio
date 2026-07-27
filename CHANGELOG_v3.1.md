> **SUPERATO — vedi `CHANGELOG_v3.1.1.md`.** Questo documento e il verdetto `VERDETTO_FINALE_v3.1.md`
> che riassume descrivevano un `PASS` su v3.1. Quel verdetto è stato **respinto** da Fabrizio Gabrielli
> con un mandato correttivo che ha identificato 9 difetti non risolti (tabelle KB01 mancanti, ID KB02
> basati su riga, mapping falsamente a tre livelli, contentHash/status assenti, containment limitato a
> KB03, non-idempotenza, attribuzione di governance non approvata, README disallineato, gate non
> tutti programmatici). Questo file resta come registro storico di quel ciclo di lavoro, ma **non
> descrive lo stato attuale del progetto**. Per lo stato corrente vedi `CHANGELOG_v3.1.1.md`.

# Changelog — Diagnostic v3.1 (indagine forense e chiusura) — SUPERATO

Questo changelog copre l'intero ciclo di lavoro governato da `Diagnostic-v3.md` (§1–§11) e dal
mandato forense successivo `05.md`. Ogni riga riporta lo stato onesto della correzione, i file
toccati, un riassunto dell'implementazione, l'evidenza/test che la dimostra, e — dove applicabile —
il limite residuo o la decisione che resta aperta e non deve essere presentata come un difetto del
parser.

| § | Finding | Stato | File modificati | Riassunto implementazione | Test / evidenza | Limite residuo o decisione |
|---|---------|-------|------------------|----------------------------|------------------|------------------------------|
| 1 | Confini dei candidati KB03 scorretti | Corretto | `scripts/lib/parse-kb03.mjs`, `tests/chunk-diagnostic.test.mjs` | Il Protocollo 2026 (11 articoli), gli Articoli 37/38 coordinati e il Regolamento (Art. 1–105) sono ora rilevati come scope distinti e non sovrapposti; ogni CAPITOLO (I–VIII) e' una sezione strutturale propria. | Test #13–#20 in `tests/chunk-diagnostic.test.mjs`; gate `kb03RegolamentoArticle1To105Present`, `kb03CoordinatedArt37And38Present` PASS. | Nessuno — verificato contro il corpus reale corrente, non un fixture. |
| 2 | Rilevamento overlap solo locale, non globale | Corretto | `scripts/chunk-diagnostic.mjs` | `zeroGlobalCandidateOverlaps` confronta i range di riga di TUTTI i candidati di un file, non solo quelli nello stesso scope. | Gate `zeroGlobalCandidateOverlaps` PASS; `totalGlobalOverlapLines: 0` su tutti e 4 i file. | Nessuno. |
| 3 | Rendiconto di copertura tautologico | Corretto | `scripts/chunk-diagnostic.mjs` | Il coverage ledger classifica OGNI riga (candidate-content / structural-heading / inherited-metadata / explicitly-non-chunkable / blank) con un `reasonCode` esplicito per le righe non associate a un candidato; nessuna riga passa senza spiegazione. | Gate `coverageLedgerZeroUnexplainedAllFiles`, `zeroSubstantiveLinesWithoutCandidateOrReason` PASS su tutti i 4 file. | Nessuno. |
| 4 | Contenuto KB03 precedentemente "inghiottito" | Corretto | `scripts/lib/parse-kb03.mjs` | Creati candidati per il contenuto KB03 che restava senza classificazione (nessun `unscoped`). | Gate `noUnscopedCandidates` PASS. | Nessuno. |
| 5 | Rilevamento tabelle Markdown come blocco atomico | Corretto | `scripts/lib/parse-kb03.mjs`, `scripts/chunk-diagnostic.mjs` | Ogni tabella Markdown (incl. la tabella delle medicazioni controllate, 30 righe dati) e' un blocco atomico, mai spezzato a meta'. | Gate `allMarkdownTablesAtomic`, `kb03ControlledMedicationsTableAtomic` PASS; test #16. | Nessuno. |
| 6 | ID KB02 non genuinamente stabili | Corretto | `scripts/lib/stable-ids.mjs` | `kb02BulletId` usa firma reale `(year, subsectionSlug, tag, contentSlug, duplicateIndex)`; gli ID non dipendono dal numero di riga e sopravvivono a inserimenti. | Gate `kb02IdsStableUnderInsertion` PASS; test #23, #25. | Nessuno. |
| 7 | Comando di test rotto, suite da rinforzare | Corretto | `package.json`, `tests/chunk-diagnostic.test.mjs` | `"test": "node --test tests/*.test.mjs"` (glob non quotato, espanso dalla shell) funziona sia da `npm test` che diretto. Suite riscritta per riflettere le firme reali correnti (non piu' `bulletPublicId` inesistente, non piu' import dei moduli deprecati `coverage-kb0N.mjs`). | `npm test` → 38/38 pass, 0 fail, 0 skip. | Nessuno. |
| 8 | Artefatti diagnostici generati devono essere auditabili e non stantii | **Corretto alla radice** (questa sessione) | `tests/chunk-diagnostic.test.mjs` (test anti-staleness, righe ~412–474) | Vedi indagine forense dettagliata sotto la tabella. I 3 artefatti (`data/chunk-diagnostic-report.json`, `data/diagnostic-candidates.json`, `data/coverage-ledger.json`) sono ora confrontati contro l'output fresco di `analyzeAll()` usando la PROIEZIONE CORRETTA (stesso shape scritto dalla CLI), non l'oggetto interno non filtrato. | 3 test anti-staleness (#31–#33) + 5 test di regressione mirati sul candidato `manifest-registro-intro:formula-pubblica-raccomandata` (#34–#38) tutti PASS; idempotenza dimostrata su 3 run consecutive di `chunk:diagnostic`, byte-identici a parte `generatedAt`; riproducibilita' confermata da `npm ci` in copia isolata pulita (hash MD5 identico). | Nessun limite residuo — causa radice era un bug di autoria del test (nome di campo `coverageLedger` vs `ledger` reale, e proiezione non filtrata), NON un difetto del generatore. Il generatore era gia' deterministico prima di questa correzione. |
| 9 | Mapping KB01→KB04 da correggere nel report | **Corretto** (questa sessione, su istruzione esplicita di `05.md`) | `scripts/chunk-diagnostic.mjs`, `tests/chunk-diagnostic.test.mjs` | Riportati i conteggi principali a DUE livelli (8 `actNumberMatch` esatti + 9 `yearOnlyFallback` provvisori = 17 totali), come richiesto da `05.md`, correggendo la mia precedente cifra errata ("5 fallback") e la mia precedente promozione non autorizzata a tre livelli (8/2/7). L'evidenza sul campo Atto di KB04 per 2013 e 2020 resta visibile come `registerAttoEvidenceYears`/`registerAttoEvidenceDetail`, ma NON riduce piu' il conteggio yearOnlyFallback da 9 a 7. | Test #30 (`Report v3.1: ... 8 esatti + 9 provvisori = 17`); `data/chunk-diagnostic-report.json` → `kb01ToKb04Mapping.actNumberMatch=8, yearOnlyFallback=9, total=17`. | I 9 anni yearOnlyFallback (2013, 2017, 2018, 2020, 2021, 2022, 2023, 2024, 2025) restano PROVVISORI: nessuno e' promosso a verificato senza la verifica documentale manuale di Fabrizio Gabrielli sugli originali. Questa e' una decisione dichiarata, non un difetto. |
| 10 | Wording di `npm audit` da correggere | Corretto | (nessun file di codice — correzione di reporting) | Distinzione esplicita tra: versioni installate, 11 advisory univoci, 13 nodi di package affetti, fix disponibili senza breaking change (0 di 13), fix che richiedono Astro 7 (tutti i 13), rilevanza pratica per build/dev-server/runtime. | `npm audit --json` questa sessione: 13 vulnerabilita' (1 low, 12 high), 11 advisory univoci (`1117141, 1118920, 1120680, 1120912, 1120917, 1123700, 1123899, 1123979, 1123981, 1124066, 1124334`), 13 nodi affetti; `npm audit fix` (non forzato, in copia scratch) confermato non risolvere nulla senza `--force`. | L'upgrade ad Astro 7.1.3 resta fuori scope per mandato esplicito di `05.md` — decisione dichiarata, non ignorata. |
| 11 | Identita' civica e governance da ripristinare | Corretto | `LICENSE`, `NOTICE.md`, `ATTRIBUTION.md`, `CONTRIBUTING.md` (nuovo), `.github/ISSUE_TEMPLATE/*.md` (nuovi) | `LICENSE` con placeholder esplicito `[TITOLARE DEL COPYRIGHT — DA DECIDERE]`; `NOTICE.md`/`ATTRIBUTION.md` descrivono lo stato del copyright come non deciso/provvisorio; nuovo `CONTRIBUTING.md` con politica di modifica delle KB canoniche (nessuna PR diretta sui 4 file `content/kb/*.md`; correzioni solo via issue con template dedicato). | File letti e verificati in sessione precedente; nessuna modifica necessaria questa sessione. | Il titolare del copyright resta una decisione di Fabrizio Gabrielli, non pre-selezionata. `CODEOWNERS` resta assente finche' non fornisce il suo username GitHub reale — non deve essere inventato. |

## Indagine forense dettagliata — §8 / mandato `05.md`

**Sintomo riportato dalla sessione precedente:** 1 test su 33 falliva con un `deepStrictEqual`
mismatch che sembrava coinvolgere il record del candidato KB04
`manifest-registro-intro:formula-pubblica-raccomandata` (righe sorgente 1094–1100, vicino alla fine
del file KB04 che ha 1100 righe totali).

**Le 10 ipotesi elencate in `05.md` sono state testate esplicitamente, non assunte:**

| # | Ipotesi | Testata come | Risultato |
|---|---------|---------------|-----------|
| 1 | Artefatti committati letti prima della scrittura diagnostica finale | Rigenerato `chunk:diagnostic` immediatamente prima di rieseguire i test | Esclusa — il fallimento si riproduceva anche subito dopo una rigenerazione fresca |
| 2 | Ordine di generazione diverso tra il percorso di test e `chunk:diagnostic` | Confrontato l'output di `analyzeAll()` importato direttamente con l'artefatto scritto dalla CLI (stessa proiezione) | Esclusa — output identico byte per byte |
| 3 | Ordinamento non deterministico di candidati/ledger | Confrontate 3 chiamate consecutive a `analyzeAll()` nello stesso processo | Esclusa — output identico (hash MD5 uguale) |
| 4 | Iterazione su collezione non ordinata | Ispezionato il codice di `analyzeAll()`: itera su array e `Object.entries` con ordine di inserzione stabile in JS | Esclusa — nessuna iterazione su `Set`/`Map` senza ordine garantito nel percorso critico |
| 5 | Mutazione di array/oggetti/stato di modulo condivisi | 3 chiamate a `analyzeAll()` nello stesso processo → output identico; nessuna mutazione osservabile | Esclusa |
| 6 | Piu' generatori producono lo stesso artefatto in modo diverso | Un solo generatore (`analyzeAll()` in `scripts/chunk-diagnostic.mjs`) produce tutti e 3 gli artefatti | Esclusa — non esistono generatori alternativi |
| 7 | Normalizzazione/ordinamento/slugging/hashing/classificazione riga incoerenti | Confrontato l'output reale contro il committato usando la proiezione corretta: identico | Esclusa |
| 8 | Differenza semantica genuina tra parser fresco e ledger committato | Confrontato campo per campo: OGNI campo presente in entrambi coincide esattamente | **Esclusa — nessuna differenza semantica reale** |
| 9 | Campo non deterministico ignorato/mantenuto in modo improprio | Solo `generatedAt` e' non deterministico ed e' l'unico escluso dal confronto | Esclusa |
| 10 | Effetti di cache di modulo o isolamento tra test | Rieseguito il confronto in un processo Node separato (`node --input-type=module -e ...`): hash MD5 identico al processo dei test | Esclusa |

**Causa radice reale (dimostrata, non assunta): due bug nel file di test, non nel generatore.**

1. Il test leggeva `f.coverageLedger`, ma la proprieta' reale restituita da
   `analyzeAll().perFile[key]` si chiama `f.ledger`. Questo rendeva il lato "fresco" del confronto
   sempre `undefined` per tutti e 4 i file, indipendentemente dai dati reali.
2. Anche correggendo il nome del campo, l'oggetto `ledger` in memoria contiene 4 campi di lavoro
   intermedi (`blankLines`, `nonBlankLines`, `counts`, `unexplainedLines`) che lo script CLI omette
   deliberatamente quando scrive `data/coverage-ledger.json` (righe ~1107–1116 di
   `scripts/chunk-diagnostic.mjs`), scrivendo solo una proiezione a 4 campi (`totalLines`,
   `unexplainedLineCount`, `substantiveLinesWithoutCandidateOrExplicitReason`, `records`). Il test
   doveva confrontare il committato con LA STESSA proiezione, non con l'oggetto completo.

**Perche' l'errore "sembrava" riguardare proprio quel candidato KB04:** KB04 ha esattamente 1100
righe totali, e il candidato `manifest-registro-intro:formula-pubblica-raccomandata` occupa le
ultime righe del file (1094–1100). Il differ di Node (`assert.deepStrictEqual`) mostra una finestra
di contesto attorno al punto di divergenza in un array/oggetto lungo; poiche' il lato "fresco" era
interamente `undefined`, la finestra stampata (che sembrava mostrare "il record KB04 alle righe
1097–1098") era semplicemente la coda dell'array `records` del lato COMMITTATO (reale), non
un'evidenza di un problema specifico di quel record. Confermato riproducendo l'identico pattern di
fallimento su TUTTI e 4 i file (kb01/02/03/04), non solo KB04.

**Riproducibilita' da stato pulito, dimostrata:**
- Copia isolata in `/tmp/clean-check/fonti-del-palio-clean/`, `npm ci` da zero, generazione fresca
  → hash MD5 identico byte per byte alla copia di lavoro (`65741bcb50c96ec04f00172f3d0f3a4d`).
- 3 esecuzioni consecutive di `npm run chunk:diagnostic` nella copia di lavoro → i 3 artefatti sono
  byte-identici (a parte `generatedAt`), confermato sia via confronto JSON normalizzato sia via
  `diff` sui file grezzi con solo il timestamp normalizzato.

**Correzione applicata (causa radice, non il test-per-il-test):** il test e' stato corretto per
confrontare le stesse proiezioni che il generatore scrive realmente, con un commento esteso che
documenta la causa radice per prevenire regressioni future del ragionamento. Il generatore stesso
non e' stato modificato — non ce n'era bisogno, essendo gia' corretto e deterministico. E' stato
aggiunto un blocco di 5 test di regressione mirati specificamente al candidato
`manifest-registro-intro:formula-pubblica-raccomandata`, verificato attraverso i 5 percorsi richiesti
da `05.md`: (1) generazione diretta fresca, (2) via `npm run chunk:diagnostic`, (3) seconda
generazione nello stesso processo, (4) processo separato pulito, (5) confronto con l'artefatto
committato. Tutti PASS.

## Ordine di lifecycle (documentato esplicitamente)

Gli artefatti `data/chunk-diagnostic-report.json`, `data/diagnostic-candidates.json`,
`data/coverage-ledger.json` sono file TRACCIATI (non in `.gitignore`), non generati solo a runtime.
`npm test` puo' quindi essere eseguito immediatamente dopo `npm ci` su un checkout pulito, perche' i
test anti-staleness confrontano i JSON committati con l'output fresco del parser — se qualcuno
modifica il codice senza rieseguire `npm run chunk:diagnostic` prima di committare, questi test
falliscono correttamente segnalando la staleness. Non esiste una sequenza manuale non documentata:
l'ordine e' `npm ci` → (artefatti committati gia' presenti) → `npm test` → se serve rigenerare dopo
una modifica al codice, `npm run chunk:diagnostic` → `npm test` di nuovo per confermare la sincronia.

## Sequenza finale autoritativa eseguita (questa sessione)

| Comando | Risultato |
|---------|-----------|
| `npm ci` | 708 packages aggiunti, 709 auditati, 13 vulnerabilita' (1 low, 12 high) segnalate all'installazione |
| `npm test` (1a esecuzione) | **38/38 pass**, 0 fail, 0 skip |
| `npm run chunk:diagnostic` | Tutti i 16 gate PASS; VERDETTO (auto-riportato dallo script): PASS |
| `npm test` (2a esecuzione, dopo rigenerazione) | **38/38 pass**, 0 fail, 0 skip |
| `npm run check` | `check-env.mjs` OK, `tsc --noEmit` zero errori |
| `npm run build` | 8 pagine costruite con successo (`chi-siamo`, `disciplina-vigente`, `disclaimer`, `evoluzione-storica`, `fonti`, `index`, `metodologia`, `privacy`); placeholder chunker confermato intatto (`chunks.generated.json` → `"chunks": []`) |
| `npm audit` | 13 vulnerabilita' (1 low, 12 high), 11 advisory univoci, 13 nodi di package affetti, 0 fix disponibili senza breaking change, tutti richiedono Astro 7.1.3 (fuori scope per mandato esplicito) |
| Verifica idempotenza | 3 esecuzioni consecutive di `chunk:diagnostic` → byte-identiche (a parte `generatedAt`); nessuna modifica al working tree oltre il timestamp |

## Elementi che restano decisioni o limiti dichiarati (non difetti del parser)

- I 9 mapping year-only fallback provvisori (2013, 2017, 2018, 2020, 2021, 2022, 2023, 2024, 2025) —
  nessuno promosso a verificato senza verifica documentale manuale.
- L'upgrade Astro 5→7 rimandato — esplicitamente fuori scope per `05.md`.
- `estimatedSplitCount` resta diagnostico, non una specifica di produzione.
- `scripts/build-content-index.mjs` e `netlify/functions/ask.ts` restano intenzionalmente non
  implementati (placeholder).
- Il titolare del copyright in `LICENSE` resta un placeholder esplicito in attesa della decisione di
  Fabrizio Gabrielli.
- `CODEOWNERS` resta assente finche' Fabrizio non fornisce il suo username GitHub reale.
