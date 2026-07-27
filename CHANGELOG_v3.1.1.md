# Changelog — Diagnostic v3.1.1 (release correttiva su verdetto CONDITIONAL FAIL)

Questo changelog copre il ciclo di lavoro correttivo aperto dal rigetto esplicito di Fabrizio
Gabrielli del verdetto `PASS` autodichiarato in `VERDETTO_FINALE_v3.1.md` (ora superato — vedi
banner in quel file). Il rigetto ha identificato **9 difetti concreti** (§1–§9) non risolti
nonostante il `PASS` dichiarato. Questo documento riporta, sezione per sezione, lo stato onesto
della correzione con lo stato assegnato a una di tre categorie esatte: `corretto`, `parzialmente
corretto`, `non risolto`. Nessuna asserzione qui è promossa a "corretto" senza un test o un'evidenza
riproducibile citata nella colonna dedicata.

`CHANGELOG_v3.1.md` (il changelog del ciclo precedente, ora superato) resta nel repository come
registro storico, con un banner esplicito che rimanda a questo file.

> **Correzione del 26/07/2026 alla riga §7 sotto:** l'istruzione originaria di rimuovere
> integralmente Pistakkio® da ogni ruolo pubblico era troppo restrittiva ed è stata sostituita da
> Fabrizio Gabrielli con un modello di governance approvato che reintroduce: (a) l'identificazione
> pubblica di Fabrizio Gabrielli come fondatore di Pistakkio®; (b) un credito tecnico/maker
> collegato in footer ("Made with Love 💚 by Pistakkio®"); (c) un link a
> [pistakkio.net](https://www.pistakkio.net/). Resta fermo che Pistakkio® NON è originator,
> curator, endorser, copyright holder, project owner o public provider del corpus documentale, delle
> fonti originali o delle Knowledge Base canoniche. La riga §7 sotto descrive lo stato del ciclo
> precedente (rimozione totale) al momento in cui fu eseguito; vedi la sezione "Correzione §7 del
> 26/07/2026" più avanti in questo file per lo stato attuale approvato.

| § | Finding (dal verdetto CONDITIONAL FAIL) | Stato | File modificati | Implementazione | Test / evidenza | Limite residuo o decisione esterna |
|---|---|---|---|---|---|---|
| 1 | 2 tabelle KB01 assenti dall'inventario; confini dei candidati padre scorretti; gate `allMarkdownTablesAtomic` troppo debole (verificava solo le tabelle già inventariate, non l'assenza di omissioni) | `corretto` | `scripts/lib/parse-kb01.mjs`, `scripts/chunk-diagnostic.mjs`, `tests/chunk-diagnostic.test.mjs` | Le 2 tabelle mancanti sono ora rilevate e aggiunte come candidati atomici; i confini dei candidati padre sono stati corretti per non sovrapporsi alle tabelle; il gate confronta ORA il rilevamento indipendente di tutte le tabelle Markdown (`detectAllMarkdownTables`) contro l'inventario, fallendo se una qualsiasi tabella rilevata manca o non è marcata atomica — non solo se le tabelle già presenti sono atomiche. | Gate `allMarkdownTablesAtomic` PASS sul corpus reale; `diagnosticCandidateCountByFile.kb01` passato da 269 a 273 (+4, le 2 tabelle più la correzione dei confini padre); test di regressione dedicati in `tests/chunk-diagnostic.test.mjs`. | Nessuno — verificato contro il corpus reale corrente. |
| 2 | 6 ID tabella KB02 basati sul numero di riga (non stabili sotto inserimento); `kb02IdsStableUnderInsertion` era un gate non reale | `corretto` | `scripts/lib/stable-ids.mjs`, `scripts/chunk-diagnostic.mjs`, `tests/chunk-diagnostic.test.mjs` | Gli ID delle tabelle KB02 derivano ora da `tableId(scope, slug)`, dove `slug` viene dall'heading H3 più vicino che precede la tabella (o dallo slug delle celle header come fallback) — nessuna dipendenza dal numero di riga. Il gate `kb02IdsStableUnderInsertion` ora esegue realmente una mutazione: inserisce 40 righe di testo innocuo più una nuova tabella con un proprio H3 univoco prima della sezione storica di KB02, ricalcola gli ID delle 6 tabelle originali e verifica che siano rimasti identici (con un settimo ID nuovo, corretto, per la tabella inserita). | Gate `kb02IdsStableUnderInsertion` PASS; test dedicato in `tests/chunk-diagnostic.test.mjs` mostra `before.every(id => after.includes(id)) && after.length === before.length + 1`. | Nessuno. |
| 3 | Il mapping KB01→KB04 esposto nel report era falsamente a tre livelli: `registerAttoMatch` era trattato come un `verifiedBy` separato, permettendo una promozione implicita a "verificato" senza conferma di Fabrizio Gabrielli | `corretto` | `scripts/lib/map-kb01-to-kb04.mjs`, `scripts/chunk-diagnostic.mjs`, `tests/chunk-diagnostic.test.mjs` | Il mapping è ora genuinamente a DUE livelli: `actNumberMatch` (8, esatto — numero di atto nel titolo KB01 confermato nel campo Atto di KB04) e `yearOnlyFallback` (9, provvisorio — nessun numero di atto nel titolo, assegnazione solo per anno+unicità). Per 2 dei 9 anni provvisori (2013, 2020) il campo Atto di KB04 riporta un numero esplicito non presente nel titolo KB01: questa evidenza è registrata come campo supplementare `registerAttoEvidence` SULLA STESSA voce `yearOnlyFallback`, non come terzo valore di `verifiedBy` e non come promozione automatica. | Report reale: `actNumberMatch: 8, yearOnlyFallback: 9, total: 17`; test dedicato verifica che nessun terzo valore di `verifiedBy` esista nell'inventario dettagliato esposto dal modulo di mapping. | I 9 anni `yearOnlyFallback` (2013, 2017, 2018, 2020, 2021, 2022, 2023, 2024, 2025) restano provvisori — nessuno viene promosso a verificato senza verifica documentale manuale di Fabrizio Gabrielli sugli originali. Decisione dichiarata, non un difetto. |
| 4 | Nessun `contentHash` deterministico né struttura di stato/eredità sui 706(+4) candidati — impossibile verificare che un candidato non sia stato alterato silenziosamente | `corretto` | `scripts/chunk-diagnostic.mjs`, `tests/chunk-diagnostic.test.mjs` | Ogni candidato (710 totali: 273 KB01 + 183 KB02 + 170 KB03 + 84 KB04) espone `contentHash` (SHA-256 del testo ricostruito da `startLine`/`endLine`), `status.state`, `status.verifiedBy` e `inheritance` (array, mai omesso). | 5 test dedicati: (1) ricostruzione testo coincide col contenuto atteso; (2) `contentHash` coincide con SHA-256 calcolato indipendentemente nel test; (3) alterare un carattere nel range di un candidato cambia il suo `contentHash` e nessun altro; (4) inserire testo estraneo lontano da un candidato non cambia il suo id né il suo hash; (5) tutti i candidati su tutti i 4 file espongono la struttura di stato completa. | Nessuno. |
| 5 | Containment check limitato a KB03 — KB01/KB02/KB04 non verificati contro sconfinamenti di riga | `corretto` | `scripts/chunk-diagnostic.mjs`, `tests/chunk-diagnostic.test.mjs` | Il gate `allCandidateRangesContainedWithinBlock` deriva ora da `allBlockViolations`, calcolato su TUTTI e 4 i file (KB01: candidato vs atto contenitore; KB02: candidato vs sezione annuale H1; KB03: candidato vs blocco H1, comportamento pre-esistente; KB04: candidato vs record contenitore). Nome del gate invariato per compatibilità con changelog/verdetto pregressi. | 4 test di mutazione dedicati (uno per file) dimostrano che un candidato con `endLine` oltre il blocco contenitore viene segnalato come violazione su KB01, KB02, KB03 e KB04 separatamente; test aggiuntivo confirma il gate PASS sul corpus reale con containment calcolato su tutti i 4 file. | Nessuno. |
| 6 | Generazione non byte-idempotente (`generatedAt` nei 3 artefatti tracciati); `npm test` poteva scrivere su `data/` durante l'esecuzione | `corretto` | `scripts/chunk-diagnostic.mjs`, `tests/chunk-diagnostic.test.mjs` | `generatedAt` rimosso dai 3 artefatti tracciati in `data/` (`chunk-diagnostic-report.json`, `diagnostic-candidates.json`, `coverage-ledger.json`); nessun campo non deterministico residuo. La suite di test non invoca più `main()`/non scrive su `data/` tracciato, salvo un unico test CLI che redirige esplicitamente su una directory temporanea. | Test dedicato dimostra che 2 esecuzioni consecutive di `npm run chunk:diagnostic` producono i 3 artefatti byte-identici; test dedicato dimostra che i 4 artefatti tracciati in `data/` non vengono modificati durante l'intera esecuzione della suite (sola lettura sul repository). | Nessuno — accettato come baseline in questo ciclo insieme a §5, riverificato nella sequenza finale di comandi (vedi sotto) senza riaprire l'implementazione. |
| 7 (stato al momento dell'esecuzione — vedi correzione sotto) | Attribuzione/endorsement definitivo a Pistakkio® presente in ruolo pubblico di originator/curatore/endorser/copyright holder/project owner/provider, in violazione della decisione di governance | `corretto` (poi corretto ulteriormente il 26/07/2026 — non più lo stato finale, vedi sotto) | `src/pages/index.astro`, `src/pages/chi-siamo.astro`, `src/layouts/BaseLayout.astro`, `src/config/site.ts`, `src/styles/tokens.css`, `NOTICE.md`, più `LICENSE`, `.env.example`, `.env`, `src/styles/global.css` (scoperti durante la verifica) | Rimossi tutti i riferimenti pubblici a Pistakkio® come originator/curatore/endorser/titolare del copyright/proprietario/provider. Sostituiti con il wording neutro approvato in quel momento (posizionamento civico/documentario, trasparenza del repository, responsabilità editoriale di Fabrizio Gabrielli, footer neutro, nessun credito Pistakkio). Colori esistenti (incl. `--color-green: #b8dc16`) mantenuti invariati, solo la terminologia di commento è stata neutralizzata. | Verifica grep a tappeto ripetuta due volte su `Pistakkio`, `endorser`, `endorsement`, `a cura di`, `curato`, `originato`, `Made with Love`, `copyright holder`: nessuna occorrenza residua assegnava un ruolo non approvato a Pistakkio® fuori dai 4 file KB canonici; `npm test` (53/53) e `npm run check` (exit 0) confermavano nessuna regressione. | Le occorrenze di `curation: "Pistakkio"` nel front matter dei 4 file KB canonici e 2 usi storici non correlati ("a cura di Funzionari ed Agenti", riferimento a "curatore" per provenienza file) restano intatte per il vincolo di immutabilità delle KB — dettagliate sotto. **Questa riga descrive uno stato intermedio, poi sostituito dalla correzione §7 del 26/07/2026 sotto.** |
| 8 | README descriveva funzionalità non implementate e citava file dati inesistenti (`data/model-council-synthesis.md`, `data/chunk-diagnostic-report.md`) | `corretto` | `README.md`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/feature-request.md`, `netlify/functions/ask.ts`, `scripts/build-content-index.mjs`, `.env`, `.env.example`, `data/chunk-diagnostic-report-v3.1.md` → rinominato `data/chunk-diagnostic-report-v3.1.1.md` | README riscritto per riflettere lo stato reale v3.1.1: stato del progetto aggiornato (diagnostica read-only completata, chunker di produzione non implementato, Pagefind non implementato, layer AI non implementato), sezione dedicata alla diagnostica di chunking con comandi reali, sezione di governance/responsabilità editoriale, nota esplicita sulla decisione di copyright non ancora presa. Tutti i riferimenti a `data/model-council-synthesis.md` (file mai esistito nel repository) rimossi dai punti in cui compariva come commento/riferimento (non solo nel README). Tutti i riferimenti a `data/chunk-diagnostic-report.md` corretti al nome file reale `data/chunk-diagnostic-report-v3.1.1.md`. | Verifica manuale: ogni percorso/link citato nel README risolto contro un file realmente presente nello ZIP finale (unica eccezione attesa: `CHANGELOG_v3.1.1.md`, questo stesso file, creato in §9); `npm test` (53/53) e `npm run check` (exit 0) dopo le modifiche a `ask.ts`/`build-content-index.mjs` confermano nessuna regressione. | `data/static-site-milestone-plan.md` (righe 7 e 19) contiene ancora 2 riferimenti storici a `data/chunk-diagnostic-report.md` (nome pre-rinomina). È un documento di pianificazione datato ("Diagnostica di chunking v2"), non documentazione corrente mantenuta in sincrono — lasciato intatto come registro storico della pianificazione, non riscritto. Non influisce sul verdetto perché non è citato dal README come fonte di stato corrente in modo che richieda quel nome file specifico. |
| 9 | Nessuna verifica esplicita che i 16 gate di accettazione siano calcolati programmaticamente (non hard-coded); changelog precedente non copriva onestamente §7–§9 | `corretto` | `CHANGELOG_v3.1.1.md` (questo file), `VERDETTO_FINALE_v3.1.1.md` | Ispezione riga per riga di `scripts/chunk-diagnostic.mjs`: tutti i 16 gate in `const gates = {...}` sono espressioni booleane derivate da strutture dati calcolate (conteggi di parsing, confronti di Set, risultati di funzioni di rilevamento indipendente) — nessun letterale `true`/`false` fisso. Diversi gate hanno test di mutazione dedicati che dimostrano la sensibilità reale al contenuto (contentHash su alterazione di un carattere; containment su 4 file; stabilità ID KB02 su inserimento; tabelle mancanti dall'inventario). Questo changelog v3.1.1 sostituisce onestamente `CHANGELOG_v3.1.md` con stati a 3 valori (`corretto`/`parzialmente corretto`/`non risolto`) invece del solo "Corretto" usato nel ciclo precedente. | Esecuzione diretta di `analyzeAll()` in sessione: `Gate count: 16`, tutti con valore booleano derivato, `allAcceptanceGatesPass: true` sul corpus reale corrente; nessun gate espresso come costante nel codice sorgente (verificato via lettura diretta del file, non per assunzione). | Nessuno. |

## Le 10 limitazioni non legate al parser (dichiarate esplicitamente, non difetti della diagnostica)

Queste 10 voci sono decisioni/limiti fuori dallo scope della diagnostica di chunking stessa — non
sono bug nella logica di parsing, containment, hashing o idempotenza, e non devono essere lette come
tali:

1. **9 mapping provvisori solo-anno** (`yearOnlyFallback`) nel mapping KB01→KB04 — anni 2013, 2017,
   2018, 2020, 2021, 2022, 2023, 2024, 2025 — restano non verificati fino a conferma documentale
   manuale di Fabrizio Gabrielli.
2. **Upgrade ad Astro 7 rinviato** — fuori scope per mandato esplicito, non implementato in questo
   ciclo.
3. **Ambito dei risultati di `npm audit`** — le vulnerabilità rilevate richiedono tutte l'upgrade ad
   Astro 7 per essere risolte senza `--force`; nessun fix applicato in questo ciclo (vedi comando
   finale sotto per i numeri aggiornati).
4. **`estimatedSplitCount` è solo diagnostico** — stima di sotto-suddivisione per soglia di token, non
   un conteggio di produzione né un impegno sul numero di chunk finali.
5. **Chunking di produzione non implementato** — nessuna logica di suddivisione semantica reale è
   stata scritta in questo ciclo.
6. **`scripts/build-content-index.mjs` resta un placeholder** — genera un `chunks.generated.json`
   vuoto e valido solo per non rompere `npm run build`; non contiene logica di chunking.
7. **Pagefind non implementato** — nessuna ricerca documentale locale funzionante in questo ciclo.
8. **Layer di retrieval/AI non implementato** — `netlify/functions/ask.ts` resta un placeholder
   architetturale (503 se `AI_ENABLED` non è `"true"`), nessuna chiamata reale a un modello.
9. **Titolare del copyright non deciso** — placeholder `[TITOLARE DEL COPYRIGHT — DA DECIDERE]`
   invariato in `LICENSE`, non assegnato a nessuno (né Pistakkio®, né Fabrizio Gabrielli, né altra
   organizzazione/collettivo).
10. **`CODEOWNERS` assente** — non creato perché lo username GitHub reale di Fabrizio Gabrielli non è
    ancora stato fornito; non deve essere inventato.

## Occorrenze dei termini di governance lasciate intenzionalmente invariate

Verifica a tappeto ripetuta due volte su: `Pistakkio`, `endorser`, `endorsement`, `a cura di`,
`curato`, `originato`, `Made with Love`, `copyright holder`. Le uniche occorrenze residue fuori dai
file corretti in §7 sono:

| File | Riga | Contenuto | Motivo per cui resta invariato |
|---|---|---|---|
| `content/kb/01_KB_Corpus_Storico_Protocollo_Equino_2012_2026.md` | 7 | `curation: "Pistakkio"` (front matter) | Fonte canonica immutabile — front matter incluso nel vincolo di non modifica |
| `content/kb/02_KB_Memoria_Incrementale_Protocollo_Equino_2012_2026.md` | 8 | `curation: "Pistakkio"` (front matter) | Idem |
| `content/kb/03_KB_Disciplina_Vigente_Consolidata_2026.md` | 7 | `curation: "Pistakkio"` (front matter) | Idem |
| `content/kb/04_KB_Manifest_Fonti_e_Registro_Atti_2012_2026.md` | 7 | `curation: "Pistakkio"` (front matter) | Idem |
| `content/kb/03_KB_Disciplina_Vigente_Consolidata_2026.md` | 2432 | "a cura di Funzionari ed Agenti" | Testo storico/regolamentare su autorità municipali del XIX/XX secolo, non correlato a Pistakkio; fonte canonica immutabile |
| `content/kb/04_KB_Manifest_Fonti_e_Registro_Atti_2012_2026.md` | 417 | "file fornito dal curatore, reperito sul sito ilpalio.org" | Nota di provenienza storica, non correlata a Pistakkio; fonte canonica immutabile |
| `ATTRIBUTION.md` | 12 | "Il curatore di questo progetto" | Generico, non nomina Pistakkio; consistente con la responsabilità editoriale di Fabrizio Gabrielli |
| `LICENSE` | (boilerplate MIT) | "AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM..." | Testo standard della licenza MIT, non un'assegnazione di ruolo |

Confermato via grep dedicato che il campo `curation` nel front matter delle 4 KB non è letto né
referenziato da alcuno script in `scripts/` o `tests/` — è metadato inerte, non propagato in alcuna
pagina pubblica generata.

## Correzione §7 del 26/07/2026 — reintroduzione governance Pistakkio® approvata

Fabrizio Gabrielli ha corretto l'istruzione di governance che aveva motivato la riga §7 sopra: la
rimozione integrale di Pistakkio® da ogni ruolo pubblico era eccessivamente restrittiva. La nuova
istruzione supersede quella precedente e ripristina un modello di attribuzione limitato e approvato.

**Modello approvato (verbatim dai requisiti):**
1. Fonti del Palio è un progetto indipendente, civico, documentario e non-profit di Fabrizio
   Gabrielli, fondatore/CEO di Pistakkio®.
2. Fabrizio Gabrielli può e deve essere identificato pubblicamente come fondatore di Pistakkio®.
3. Pistakkio® mantiene un credito maker/tecnico appropriato e collegato in footer ("Made with Love
   💚 by Pistakkio®").
4. Il repository GitHub pubblico deve anch'esso essere collegato dal footer (nessun URL dedicato
   esiste o è stato fornito al 26/07/2026 — vedi sotto — quindi il link resta condizionale/nascosto
   finché non verrà fornito, per non inventare un URL).
5. Questa attribuzione NON assegna la proprietà del copyright del corpus documentale, delle fonti
   originali o delle Knowledge Base canoniche a Pistakkio®.
6. Il placeholder del titolare del copyright resta non deciso.
7. Il controllo editoriale delle Knowledge Base canoniche resta di Fabrizio Gabrielli.

**File modificati per applicare la correzione:**

| File | Modifica |
|---|---|
| `src/config/site.ts` | Aggiunte le costanti `PISTAKKIO_URL` (`https://www.pistakkio.net/`), `PISTAKKIO_LABEL` (`Pistakkio®`), `GITHUB_URL` (`null` — nessun repo dedicato fornito), `GITHUB_LABEL`, con commenti che chiariscono ruoli approvati/non approvati. |
| `src/layouts/BaseLayout.astro` | Firma footer cambiata in "Fonti del Palio — un progetto non-profit di Fabrizio Gabrielli."; aggiunto nuovo paragrafo `.footer-credit` con "Made with Love 💚 by Pistakkio®" collegato (`rel="noopener noreferrer"`, `target="_blank"`), più link GitHub condizionale (nascosto, perché `GITHUB_URL` è `null`). |
| `src/styles/global.css` | Aggiunta regola CSS `.footer-credit` (font monospazio, colore muted, margine superiore) per il nuovo paragrafo del footer. |
| `src/pages/chi-siamo.astro` | Descrizione estesa del progetto sostituita col wording approvato (identifica Fabrizio Gabrielli come fondatore di Pistakkio®, collegato); paragrafo di responsabilità editoriale sostituito col wording approvato verbatim; nuovo paragrafo che nega esplicitamente la titolarità di corpus/fonti/KB a Pistakkio® nonostante il credito tecnico. |
| `NOTICE.md` | Sezione "Natura del progetto" (§7) riscritta con intestazione "posizionamento pubblico corretto il 26/07/2026"; descrive Fabrizio Gabrielli come fondatore di Pistakkio® con credito maker in footer, negando ruoli di originator/curator/endorser/copyright holder/project owner/public provider. Paragrafo del placeholder di copyright aggiornato con parentetica esplicita. |
| `README.md` | Sezione "Governance e responsabilità editoriale" riscritta per menzionare Fabrizio Gabrielli come fondatore di Pistakkio® (collegato) e il credito tecnico/maker in footer, ribadendo che ciò non implica titolarità o autorità istituzionale. |

**File verificati e lasciati invariati perché già coerenti con la correzione:**
- `LICENSE` — la nota §7 esistente su Pistakkio® esclude già correttamente Pistakkio® dalle opzioni di
  titolare del copyright; non contraddice il nuovo modello (il modello approvato non chiede a
  Pistakkio® la titolarità, solo un credito maker che LICENSE non tratta).
- `src/styles/tokens.css` (riga 5) — nota di commento storica sulla ridenominazione del colore, non
  un'attribuzione di ruolo pubblico; nessuna modifica necessaria.
- `.env`, `.env.example`, `netlify/functions/ask.ts`, `scripts/build-content-index.mjs` — nessuna
  occorrenza di Pistakkio® residua da correggere.
- `src/pages/index.astro` — il paragrafo introduttivo descrive la natura civica/indipendente del
  progetto rispetto agli enti ufficiali del Palio (claim distinto, ancora valido); il credito
  fondatore/Pistakkio® vive nella pagina dedicata `chi-siamo.astro` e nel footer del layout condiviso
  da tutte le pagine, quindi è comunque presente su ogni pagina del sito.

**Verifica eseguita dopo la correzione:** `npx tsc --noEmit` (nessun errore), `npm test` → 53/53
pass, `npm run check` (exit 0, nessun errore bloccante), `npm run build` → 8 pagine generate; ispezione
diretta dell'HTML generato in `dist/` confirma il footer con "Made with Love 💚 by Pistakkio®"
collegato correttamente con `rel="noopener noreferrer"` e nessun `rel="nofollow"`/`"sponsored"` in
tutto il sito; il link GitHub in footer resta assente/nascosto (nessun URL inventato).

**Risoluzione dell'URL GitHub — aggiornamento del 26/07/2026 (22:14 CEST):** inizialmente nessun
repository dedicato era stato individuato o fornito; il profilo generale GitHub di Fabrizio Gabrielli
(`https://github.com/dragomanno/`) mostrava solo "il-paroliere", non correlato. Fabrizio Gabrielli ha
successivamente fornito l'URL esatto: `https://github.com/dragomanno/fonti-del-palio`. Verificato via
`gh repo view` — il repository esiste, appartiene a `dragomanno` e la descrizione corrisponde al
progetto ("Archivio civico e documentario indipendente sul Protocollo Equino del Palio di Siena").
Tuttavia il repository è attualmente **privato** su GitHub: linkarlo nel footer pubblico del sito
produrrebbe un 404 per qualsiasi visitatore esterno. Interpellato sul da farsi, Fabrizio Gabrielli ha
scelto di **non collegare il link per ora**, lasciando la decisione sulla visibilità del repository in
sospeso. `GITHUB_URL` resta quindi `null` in `src/config/site.ts` (il link in footer resta
non renderizzato), ma una nuova costante `GITHUB_URL_PENDING =
"https://github.com/dragomanno/fonti-del-palio"` registra l'URL reale già confermato: quando il
repository verrà reso pubblico, basterà assegnare quel valore a `GITHUB_URL` per attivare il link,
senza dover ricercare nulla.

## Changelog superato

`CHANGELOG_v3.1.md` resta nel repository con un banner esplicito di "superato" in cima, che rimanda a
questo file. Non è stato eliminato per preservare la cronologia del ciclo di lavoro precedente.
