# Diagnostica di chunking v3.1.1 — Fonti del Palio

Generato: 26 luglio 2026 (Europe/Rome) · Release correttiva su verdetto CONDITIONAL FAIL di v3.1.
Fonte: esecuzione reale di `scripts/chunk-diagnostic.mjs` (`analyzeAll()`) e della relativa CLI
(`npm run chunk:diagnostic`) contro i 4 file KB canonici correnti in `content/kb/`, eseguita più
volte in questa sessione (incl. la sequenza finale di comandi) con risultati identici. Nessun
conteggio qui riportato proviene da un JSON stale o da un'esecuzione precedente senza essere stato
riprodotto in questa sessione. Questo documento sostituisce integralmente la versione precedente
(`data/chunk-diagnostic-report-v3.1.md`, ora rinominata e superata — vedi `CHANGELOG_v3.1.1.md` per
il dettaglio dei 9 difetti corretti in questo ciclo).

## Verdetto

Vedi `VERDETTO_FINALE_v3.1.1.md` per il verdetto formale completo con tutte le condizioni di
accettazione verificate una per una. Riepilogo: tutti i 16 gate di accettazione automatici superano
la verifica su questa esecuzione (tabella §8 sotto), la suite di test passa 53/53, e l'idempotenza a
livello di byte è dimostrata su esecuzioni consecutive di `npm run chunk:diagnostic` all'interno
della sequenza finale di comandi. Restano decisioni/limiti non bloccanti esplicitamente dichiarati
(§12 sotto) fuori dallo scope di questa diagnostica — non difetti nella diagnostica stessa.

## 1. Conteggi diagnostici (separati, come richiesto dal §10 di `Diagnostic-v3.md`)

| Metrica | Valore | Nota |
|---|---|---|
| `diagnosticCandidateCount` (totale) | **710** | 273 (KB01) + 183 (KB02) + 170 (KB03) + 84 (KB04) |
| `estimatedSplitCount` (totale) | **766** | 297 (KB01) + 183 (KB02) + 202 (KB03) + 84 (KB04) — stima diagnostica di sotto-suddivisione per soglia di token, **non** un conteggio di produzione |
| `productionChunkCount` | `null` | Resta `null` per costruzione: `scripts/build-content-index.mjs` è ancora il placeholder inerte; nessuna subdivisione semantica reale è implementata. Verificato che `npm run build` esegue quel placeholder senza errori e senza generare conteggi di produzione. |

Il totale `diagnosticCandidateCount` per KB01 è passato da 269 (v3.1) a **273** (v3.1.1, +4) in
seguito alla correzione §1: 2 tabelle Markdown precedentemente assenti dall'inventario sono state
aggiunte come candidati atomici, con corrispondente correzione dei confini dei candidati padre.
Nessun totale storico viene riportato come riferimento se non riprodotto da questa esecuzione.

## 2. Coverage ledger per file (righe, non candidati)

| File | Righe totali | Righe vuote | Righe non spiegate | Overlap globali | Candidati |
|---|---|---|---|---|---|
| KB01 | 4463 | 1258 | 0 | 0 | 273 |
| KB02 | 601 | 181 | 0 | 0 | 183 |
| KB03 | 4634 | 1589 | 0 | 0 | 170 |
| KB04 | 1100 | 223 | 0 | 0 | 84 |

Zero righe non spiegate e zero overlap globali su tutti e 4 i file.

## 3. KB01 — struttura articoli

- Articoli ordinari totali: **247** (atteso 247) → OK
- Punti di modifica operativi: 2 (atto G.C. 133/2014)
- Nessun atto/record del registro KB04 orfano.
- 2 tabelle Markdown aggiunte all'inventario in questo ciclo (v3.1.1 §1) come candidati atomici,
  con confini dei candidati padre corretti di conseguenza.

## 4. KB03 — scope e struttura

- Protocollo 2026: 11 articoli ordinari in scope `protocollo-2026`.
- Articoli 37/38 coordinati: precedono il Regolamento, restano in scope separato.
- Regolamento per il Palio: Articoli 1–105 presenti senza buchi.
- Tabella delle medicazioni controllate: atomica, 30 righe dati.
- Ogni CAPITOLO (I–VIII) rilevato come sezione strutturale distinta.
- Nessun candidato con `documentScope: "unscoped"`.
- Containment check (v3.1.1 §5) esteso anche a questo file: nessuna violazione.

## 5. KB04 — famiglie di record

Tutte le 4 famiglie di record (PE / RP / ATT / LEG) sono presenti e non vuote. Nessun record ha ID
duplicato. Containment check (v3.1.1 §5) esteso anche a questo file: nessuna violazione.

## 6. KB02 — stabilità ID

Gli ID delle voci di cronologia (`kb02BulletId`, firma `(year, subsectionSlug, tag, contentSlug,
duplicateIndex)`) non dipendono dal numero di riga e restano stabili sotto inserimento. Tutti i
marcatori bullet sono tag validi, inclusi i tag composti multi-parola. Gli ID delle 6 tabelle
storiche (v3.1.1 §2) derivano ora dall'heading H3 più vicino, non dal numero di riga: dimostrato
stabile aggiungendo 40 righe di testo innocuo più una nuova tabella prima della sezione storica.

## 7. Tabelle Markdown

Ogni tabella Markdown rilevata indipendentemente nel corpus (inclusa la tabella delle medicazioni
controllate) ha un candidato atomico corrispondente nell'inventario — il gate v3.1.1
`allMarkdownTablesAtomic` verifica ora l'assenza di omissioni, non solo l'atomicità delle tabelle già
inventariate (v3.1.1 §1/§9).

## 8. Gate di accettazione (16/16 PASS)

| Gate | Risultato |
|---|---|
| `kb01ArticleTotalMatchesExpected247` | PASS |
| `kb01NoUnmatchedActs` | PASS |
| `kb01NoUnmatchedRegisterRecords` | PASS |
| `allCandidateRangesContainedWithinBlock` (ora su KB01+KB02+KB03+KB04, v3.1.1 §5) | PASS |
| `zeroGlobalCandidateOverlaps` | PASS |
| `coverageLedgerZeroUnexplainedAllFiles` | PASS |
| `zeroSubstantiveLinesWithoutCandidateOrReason` | PASS |
| `noStableIdCollisions` | PASS |
| `noUnscopedCandidates` | PASS |
| `kb03RegolamentoArticle1To105Present` | PASS |
| `kb03CoordinatedArt37And38Present` | PASS |
| `kb03ControlledMedicationsTableAtomic` | PASS |
| `allMarkdownTablesAtomic` (rafforzato, v3.1.1 §1/§9) | PASS |
| `kb04AllFourRecordFamiliesPresent` | PASS |
| `kb02IdsStableUnderInsertion` (check reale, v3.1.1 §2/§9) | PASS |
| `productionChunkCountRemainsNull` (check reale, v3.1.1 §9) | PASS |

Tutti i 16 gate sono espressioni booleane calcolate da strutture dati reali (parsing, rilevamento
indipendente, hashing) — nessun letterale `true`/`false` fisso, verificato per lettura diretta del
codice sorgente in questo ciclo (v3.1.1 §9).

## 9. Mapping KB01→KB04 (conteggio onesto, a due livelli genuini)

- `actNumberMatch`: **8** — numero di atto trovato nel titolo KB01 e confermato nel campo `Atto` del
  record KB04.
- `yearOnlyFallback` (PROVVISORIO): **9** — anni: 2013, 2017, 2018, 2020, 2021, 2022, 2023, 2024,
  2025. Il titolo KB01 non riporta un numero di atto; l'assegnazione si basa su anno + unicità del
  record nel registro KB04 e richiede verifica manuale sugli originali prima di un uso in citazioni
  legali o di atto esatto.
- **Totale: 17.**

**Evidenza supplementare non promossa:** per 2 di questi 9 anni provvisori (2013, 2020), il campo
`Atto` del record KB04 stesso riporta comunque un numero esplicito (rispettivamente "Commissario
straordinario n. 11" e "G.C. n. 51") che il titolo KB01 non riporta. Questa evidenza resta
documentata (`registerAttoEvidenceYears`, `registerAttoEvidenceDetail` nel JSON) come campo
supplementare sulla stessa voce `yearOnlyFallback` — **non** come terzo valore di `verifiedBy` e
**non** come promozione automatica a match verificato (v3.1.1 §3, correzione rispetto a una revisione
intermedia del ciclo precedente che aveva introdotto un terzo livello non autorizzato).

## 10. `npm audit` — stato corrente (questa sessione, dopo `npm ci` pulito)

- Vulnerabilità totali: **13** (1 low, 12 high).
- Advisory univoci: **11** (`1117141, 1118920, 1120680, 1120912, 1120917, 1123700, 1123899, 1123979, 1123981, 1124066, 1124334`).
- Nodi di package affetti: **13** (`@netlify/functions, @netlify/zip-it-and-ship-it, @vercel/nft, archiver, archiver-utils, astro, brace-expansion, esbuild, glob, minimatch, readdir-glob, sharp, zip-stream`).
- Fix disponibili senza breaking change (`npm audit fix` semplice, secondo `fixAvailable: true` nel JSON): **10 di 13 nodi affetti** (`brace-expansion` e la catena che ne dipende — `minimatch`, `glob`, `readdir-glob`, `archiver-utils`, `archiver`, `zip-stream`, `@vercel/nft`, `@netlify/zip-it-and-ship-it`, `@netlify/functions`) — non applicato in questo ciclo per restare strettamente entro la sequenza di comandi autorizzata (nessun comando di fix eseguito, `npm audit fix --dry-run` usato solo per ispezionare `fixAvailable` senza scrivere).
- Fix che richiedono l'upgrade ad Astro 7.1.3 (major, fuori scope per mandato esplicito): **3 di 13 nodi** (`astro`, `esbuild`, `sharp`).
- Versione Astro installata confermata invariata a **5.18.2** in questa sessione (nessun upgrade eseguito).
- `npm audit fix --force` e l'upgrade Astro 7 restano esplicitamente non eseguiti in questo ciclo, come vietato dal mandato.

## 11. Governance e identità civica (v3.1.1 §7, corretto il 26/07/2026)

Pistakkio® non ricopre alcun ruolo pubblico di originator/curatore/endorser/titolare del
copyright/proprietario/provider del corpus documentale, delle fonti originali o delle Knowledge Base
canoniche. `LICENSE` riporta un placeholder esplicito `[TITOLARE DEL COPYRIGHT — DA DECIDERE]`, non
assegnato a nessuno. La responsabilità editoriale sulla validazione delle fonti e l'integrazione
nelle KB canoniche resta esclusivamente di Fabrizio Gabrielli.

Una correzione approvata da Fabrizio Gabrielli il 26/07/2026 ha sostituito l'istruzione precedente
(rimozione totale di Pistakkio®) con un modello di attribuzione limitato: Fabrizio Gabrielli è
identificato pubblicamente come fondatore di Pistakkio® (in `chi-siamo.astro` e nel `README.md`), e
Pistakkio® riceve un credito tecnico/maker collegato nel footer del sito ("Made with Love 💚 by
Pistakkio®", link a `https://www.pistakkio.net/`, `rel="noopener noreferrer"`, nessun
`nofollow`/`sponsored`). Questo credito non implica in alcun modo titolarità del corpus, delle fonti
originali o delle KB canoniche, né un ruolo di autorità istituzionale su di esse — esplicitato in
`NOTICE.md`, `README.md` e `chi-siamo.astro`. Il link al repository GitHub in footer resta
condizionale e non renderizzato, poiché nessun URL di repository dedicato è stato fornito (nessun URL
inventato). Vedi la sezione "Correzione §7 del 26/07/2026" in `CHANGELOG_v3.1.1.md` per l'elenco
completo dei file modificati e delle occorrenze residue di `curation: "Pistakkio"` nel front matter
immutabile delle 4 KB canoniche.

## 12. Elementi che restano decisioni o limiti dichiarati (non difetti del parser)

Le 10 limitazioni non legate al parser sono elencate per intero in `CHANGELOG_v3.1.1.md`. In sintesi:
9 mapping year-only fallback provvisori; upgrade Astro 7 rinviato; ambito dei risultati di `npm
audit`; `estimatedSplitCount` solo diagnostico; chunking di produzione non implementato;
`build-content-index.mjs` placeholder; Pagefind non implementato; layer di retrieval/AI non
implementato; titolare del copyright non deciso; `CODEOWNERS` assente.
