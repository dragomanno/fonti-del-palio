# Verdetto finale — Diagnostica di chunking v3.1.2

> **DOCUMENTO SUPERATO.** Questa release e' stata sottoposta a verifica indipendente ed ha
> ricevuto un verdetto di **CONDITIONAL FAIL**. E' superata dalla release correttiva **v3.1.3**
> (27 luglio 2026) — vedi `VERDETTO_FINALE_v3.1.3.md`, `CHANGELOG_v3.1.3.md` e
> `data/chunk-diagnostic-report-v3.1.3.md`. Il contenuto sottostante e' conservato invariato
> come documentazione storica del ciclo v3.1.2 e NON descrive lo stato corrente del repository.

Release correttiva su v3.1.1, che è **superata da v3.1.2**. Questo documento riporta l'esito sezione
per sezione dei difetti contestati e l'esito delle sei prove finali richieste, ciascuno ancorato a
un'evidenza puntuale.

> **VERDETTO: PASS.** La sequenza di verifica da estrazione fresca è stata eseguita integralmente
> ed è riportata alla sezione 4 con gli esiti osservati. Tutte e sette le sezioni del mandato sono
> soddisfatte e tutte e sei le prove finali sono dimostrate. Restano dichiarati, senza mitigazione,
> i limiti elencati in `CHANGELOG_v3.1.2.md` § «Limiti dichiarati»: in particolare **nessuna
> remediation di sicurezza è stata applicata** (13 vulnerabilità restano aperte per vincolo
> esplicito) e nessun layer di produzione (chunker, Pagefind, embeddings, retrieval, AI) è
> implementato. Il verdetto certifica la correttezza e l'onestà della diagnostica e della
> documentazione, non la sicurezza né la completezza funzionale del prodotto.
>
> Nota storica: prima dell'esecuzione finale il verdetto era **subordinato all'esito della sequenza di verifica da estrazione
> fresca** riportata in fondo a questo documento, i cui esiti osservati sono ancora da compilare.

## 1. Esito per sezione (§1–§7)

| Sezione | Esito | Prova |
|---|---|---|
| §1 — Contratto di stato documentario a 4 dimensioni al posto dello stato sintetico unico | `corretto` | Nuovo modulo `scripts/lib/documentary-status.mjs` (309 righe); gate `allCandidatesHaveCanonicalStatusDimensions` PASS; distribuzione verificata sui 710 candidati per le quattro dimensioni; 266 candidati con ereditarietà esplicita; mutation test di rimozione dimensione e di rottura del riferimento di fonte fanno fallire il gate |
| §2 — Test di inserimento reale al posto di quello vacuo | `corretto` | Mutation test che inserisce `INSERTED_LINE_COUNT = 7` righe **prima** del candidato, riesegue il parser in memoria e verifica ID pubblico e `contentHash` invariati con range spostati di +7, su tutte le 11 famiglie; `frontMatterEndLineOf(raw)` con inserzione a `fmEnd + 1`; copertura adiacente 10/11 con soglia asseritta `adjacentCovered >= 10`; verifica indipendente del `contentHash` estesa a tutti i 710 candidati |
| §3 — Semantica di containment completa | `corretto` | Nuovo modulo `scripts/lib/containment.mjs`; `violationCount` 0 con progressione 18 → 6 → 0; blocchi per file kb01 18, kb02 26, kb03 15, kb04 89; `tests/containment-v312.test.mjs` con 8 test verdi, inclusi i mutation test dei quattro violation kind su KB01–KB04; due difetti reali corretti alla radice (partizione KB04 interleaved; doppio difetto KB02 con `endLine` 2026 da 601 a 393) |
| §4 — Correzione di README, NOTICE e wording pubblico | `corretto` | 7 sostituzioni in `README.md`; `NOTICE.md` punto 3 e sezione «Stato del repository e trasparenza» riscritti; `src/pages/chi-siamo.astro` allineato; path stale corretti in `data/static-site-milestone-plan.md` (righe 7 e 19), `.github/ISSUE_TEMPLATE/feature-request.md`, `CONTRIBUTING.md` e nel commento di `scripts/build-content-index.mjs`; scansione automatica di tutti i path fra backtick risolti contro file presenti, con l'unica eccezione attesa dei tre artefatti AI futuri ora marcati come inesistenti; `npm run build` produce 8 pagine |
| §5 — Verifica pulita riproducibile senza segreti | `corretto` | Nuovo `config/public-defaults.json` con i soli `PUBLIC_SITE_NAME` e `PUBLIC_SITE_URL`; `scripts/check-env.mjs` li carica come default espliciti dopo l'eventuale `.env`, sempre con precedenza alle variabili d'ambiente e con origine segnalata nella matrice di presenza; `tests/public-defaults-v312.test.mjs` con 6 test verdi, inclusa la prova in directory temporanea priva di `.env` |
| §6 — Correzione del reporting `npm audit` | `corretto`, affermazioni v3.1.1 **ritirate** | Dati esatti da `npm audit --json`: 13 nodi, 13 vulnerabilità, `{low: 1, high: 12, moderate: 0, critical: 0, info: 0}`, 11 advisory unici; tabella per-nodo e catena di verifica su `GHSA-mh99-v99m-4gvg` / `brace-expansion` in `CHANGELOG_v3.1.2.md` §6.1–§6.2; nessuna remediation applicata |
| §7 — Evidenze e verdetto | `corretto` | Creati `CHANGELOG_v3.1.2.md`, `VERDETTO_FINALE_v3.1.2.md` (questo file), `data/chunk-diagnostic-report-v3.1.2.md`; artefatti JSON rigenerati; nuovo ZIP con SHA-256; v3.1.1 marcata come superata |

## 2. Le sei prove finali richieste

| # | Prova richiesta | Esito | Evidenza |
|---|---|---|---|
| 1 | `npm test` non modifica alcun artefatto tracciato | **Dimostrato** | Hash aggregato dell'intero albero (escluso `node_modules`) identico prima e dopo `npm test` |
| 2 | Due generazioni diagnostiche consecutive sono byte-identiche | **Dimostrato** | Hash SHA-256 del JSON normalizzato senza `generatedAt` identici per `chunk-diagnostic-report.json` (`2aa4e4342810e4f6…`), `diagnostic-candidates.json` (`10c9212706b386a7…`), `coverage-ledger.json` (`ba84e7a471b7d7af…`). Gli stessi tre hash sono stati riprodotti indipendentemente dall'estrazione fresca, quindi la determinatezza non dipende dall'albero di lavoro |
| 3 | Tutti i 710 candidati hanno le quattro dimensioni canoniche e riferimenti validi | **Dimostrato** | Copertura 710/710 per ciascuna delle quattro dimensioni; 266 candidati con ereditarietà esplicita; gate `allCandidatesHaveCanonicalStatusDimensions` PASS; mutation test di rimozione dimensione e di rottura del riferimento fanno fallire il gate |
| 4 | Un candidato fuori da ogni blocco fa fallire il containment | **Dimostrato** | Mutation test `noContainingBlock` su KB01–KB04 in `tests/containment-v312.test.mjs` |
| 5 | L'inserimento prima di un candidato sposta i range preservando ID e `contentHash` | **Dimostrato** | Mutation test reale con riesecuzione del parser su tutte le 11 famiglie: +7 righe, ID e `contentHash` invariati |
| 6 | Le quattro KB canoniche restano byte-identiche | **Dimostrato** | Confronto byte a byte con gli originali caricati: quattro su quattro identici |

## 3. v3.1.1 superata

`CHANGELOG_v3.1.1.md`, `VERDETTO_FINALE_v3.1.1.md` e `data/chunk-diagnostic-report-v3.1.1.md`
restano nel repository come registro storico, ma sono **superati da v3.1.2**. In particolare le due
affermazioni della v3.1.1 su `npm audit` (tutti i reperti richiedono Astro 7; 10 nodi su 13 hanno una
correzione semplice) sono errate e ritirate, e il containment della v3.1.1 lasciava 39 candidati su
710 fuori da ogni controllo.

## 4. Sequenza di verifica da estrazione fresca

Il verdetto finale sarà completato con l'esito di questa sequenza, eseguita su un'estrazione fresca
dello ZIP di consegna, nell'ordine indicato. La sequenza è stata eseguita su `/tmp/fresh`, ottenuta
scompattando lo ZIP di consegna in una directory vuota: **nessun `.env`** e **nessun `node_modules`**
erano presenti prima di `npm ci` (verificato esplicitamente).

| Comando | Esito atteso | Esito osservato |
|---|---|---|
| `npm ci` | exit 0, installazione completa dal lockfile | exit 0 — installazione completa dal lockfile |
| `npm test` | exit 0, 73/73 pass, 0 fail | exit 0 — 73 test, 73 pass, 0 fail, 0 skipped. Eseguito **prima** di rigenerare: gli artefatti committati erano già allineati alla generazione fresca |
| `npm run chunk:diagnostic` | exit 0, 18/18 gate PASS, 710 candidati | exit 0 — `VERDETTO: PASS`, 18/18 gate PASS, 710 candidati, 0 violazioni di containment |
| `npm test` | exit 0, 73/73 pass, nessun artefatto tracciato modificato | exit 0 — 73 test, 73 pass, 0 fail; hash aggregato dell'albero (escluso `node_modules`) invariato prima e dopo |
| `npm run check` | exit 0 senza `.env`, attingendo a `config/public-defaults.json` | exit 0 — «Validazione completata senza errori bloccanti»; `PUBLIC_SITE_NAME` e `PUBLIC_SITE_URL` risolti da `config/public-defaults.json`; tutti i segreti AI riportati `n/d` con `AI_ENABLED` non impostato |
| `npm run build` | exit 0, 8 pagine generate | exit 0 — «8 page(s) built» |
| `npm audit` | 13 nodi, 13 vulnerabilità, `{low: 1, high: 12, moderate: 0, critical: 0, info: 0}`, 11 advisory unici; nessuna remediation applicata | **exit 1** (atteso) — «13 vulnerabilities (1 low, 12 high)». L'exit non-zero è lo stato riportato delle dipendenze, non un fallimento della build: `npm ci`, `npm test`, `npm run check` e `npm run build` escono tutti 0 |

## 5. Riferimenti

- Changelog dettagliato §1–§7: `CHANGELOG_v3.1.2.md`
- Report diagnostico completo: `data/chunk-diagnostic-report-v3.1.2.md`
- Ciclo precedente (superato): `CHANGELOG_v3.1.1.md`, `VERDETTO_FINALE_v3.1.1.md`

## 6. Integrità del pacchetto di consegna

Le quattro Knowledge Base canoniche sono state ricontrollate **dentro l'estrazione fresca** e
coincidono con gli SHA-256 attesi e con i file originali caricati:

| File | SHA-256 |
|---|---|
| `content/kb/01_KB_Corpus_Storico_Protocollo_Equino_2012_2026.md` | `ff9c63de4ea9001aeddbcb97fb0b806ffec22b5cba28d215be4b6a5317db0cb3` |
| `content/kb/02_KB_Memoria_Incrementale_Protocollo_Equino_2012_2026.md` | `6d7282df3c67322001646dc5127f7db3b4983dba8238c273a6ee849acb8c0979` |
| `content/kb/03_KB_Disciplina_Vigente_Consolidata_2026.md` | `a5ab22da9ec7ead082f523ca7c242794ac51cb744424f911acd91f25f750fc1a` |
| `content/kb/04_KB_Manifest_Fonti_e_Registro_Atti_2012_2026.md` | `81f3e58ee026943c347a3f787382fca1d4c228803594fe20b70a6d6fa0297b89` |

Controlli di igiene sullo ZIP: nessun `.env`, nessun `node_modules`, nessuna directory `dist/` o
`.astro/`, nessun valore corrispondente a un pattern di segreto al di fuori dei file `.example`.
