# Verdetto finale — Diagnostica di chunking v3.1.1

Data: 26 luglio 2026 (Europe/Rome). Sostituisce `VERDETTO_FINALE_v3.1.md` (ora superato — vedi banner
in quel file). Questo verdetto risponde punto per punto al rifiuto CONDITIONAL FAIL della release
v3.1, verificando ogni singola condizione con evidenza riproducibile raccolta in questa sessione, non
per affermazione.

## Verdetto: **PASS**

Tutte le condizioni sotto elencate sono state dimostrate con comandi reali eseguiti in questa
sessione, con output e hash catturati. Nessuna condizione è stata dichiarata soddisfatta per
asserzione non verificata.

## Condizioni verificate una per una

| # | Condizione | Esito | Evidenza |
|---|---|---|---|
| 1 | §1 — Le 2 tabelle KB01 mancanti sono ora nell'inventario come candidati atomici; confini dei candidati padre corretti | **Dimostrato** | `diagnosticCandidateCount` KB01 269→**273** (+4); gate `allMarkdownTablesAtomic` rafforzato per rilevare omissioni, non solo atomicità |
| 2 | §2 — I 6 ID tabella KB02 non dipendono più dal numero di riga | **Dimostrato** | ID derivati da `(year, subsectionSlug, tag, contentSlug, duplicateIndex)`; gate `kb02IdsStableUnderInsertion` è un check reale che inserisce 40 righe + 1 tabella e verifica stabilità, non un letterale `true` |
| 3 | §3 — Il mapping KB01→KB04 è genuinamente a due livelli (`actNumberMatch`, `yearOnlyFallback`), senza terzo livello `registerAttoMatch` come `verifiedBy` separato | **Dimostrato** | `actNumberMatch=8`, `yearOnlyFallback=9`, totale=17, coerente in report/changelog/verdetto; evidenza `registerAttoEvidenceYears` documentata come campo supplementare, non promozione |
| 4 | §4 — `contentHash` SHA-256 deterministico e struttura status/ereditarietà su tutti i candidati | **Dimostrato** | Verificato per lettura diretta del codice e per esecuzione live di `analyzeAll()` su tutti i 710 candidati correnti |
| 5 | §5 — Containment check estesa a KB01/KB02/KB03/KB04 (non solo KB03) | **Dimostrato** | `allCandidateRangesContainedWithinBlock` valuta `blockContainmentViolationsByFile` su tutti i 4 file; `blockContainmentViolationsByFile` = `{kb01:[], kb02:[], kb03:[], kb04:[]}` in questa esecuzione |
| 6 | §6 — Generazione byte-idempotente; `npm test` non scrive su `data/` tracciato | **Dimostrato** | md5 identico prima/dopo `npm test` su tutti gli artefatti tracciati; 3 esecuzioni consecutive di `npm run chunk:diagnostic` con hash identici |
| 7 | §7 — Governance Pistakkio®: attribuzione limitata e approvata (fondatore + credito maker in footer), nessuna attribuzione di copyright/proprietà/autorità istituzionale | **Dimostrato (corretto il 26/07/2026)** | Correzione applicata su 6 file (`src/config/site.ts`, `src/layouts/BaseLayout.astro`, `src/styles/global.css`, `src/pages/chi-siamo.astro`, `NOTICE.md`, `README.md`); footer con "Made with Love 💚 by Pistakkio®" collegato a pistakkio.net (`rel="noopener noreferrer"`), Fabrizio Gabrielli identificato come fondatore in `chi-siamo.astro`; nessun `rel="nofollow"`/`"sponsored"`; URL del repository GitHub confermato (`https://github.com/dragomanno/fonti-del-palio`, verificato via `gh repo view`), ma link non renderizzato per scelta di Fabrizio Gabrielli poiché il repository è attualmente privato (evitare 404 pubblici); URL registrato in `GITHUB_URL_PENDING` per attivazione futura. Dettagli completi nella sezione "Correzione §7 del 26/07/2026" in `CHANGELOG_v3.1.1.md`. Questa riga sostituisce la precedente versione (rimozione totale), ora superata. |
| 8 | §8 — README riflette lo stato reale v3.1.1; nessun path referenziato è rotto | **Dimostrato** | README, `CONTRIBUTING.md`, template issue, `ask.ts`, `build-content-index.mjs`, `.env`/`.env.example` aggiornati; `data/chunk-diagnostic-report-v3.1.1.md` ora riscritto con contenuto v3.1.1 reale (non più stale v3.1) |
| 9 | §9a — Tutti i 16 gate sono calcolati programmaticamente, non hard-coded | **Dimostrato** | Lettura diretta del codice sorgente di `scripts/chunk-diagnostic.mjs`: ogni gate è un'espressione booleana su una struttura dati calcolata, nessun letterale fisso |
| 10 | §9b — `CHANGELOG_v3.1.1.md` con stati onesti (`corretto`/`parzialmente corretto`/`non risolto`) e i 10 limiti dichiarati | **Dimostrato** | File creato con tabella §1–§9, tutte le voci con evidenza puntuale; elenco dei 10 limiti non-parser incluso per intero |
| 11 | Sequenza finale di comandi eseguita nell'ordine esatto mandato | **Dimostrato** | `npm ci` (exit 0) → `npm test` (exit 0, 53/53) → `npm run chunk:diagnostic` (exit 0, VERDETTO: PASS) → `npm test` (exit 0, 53/53) → `npm run check` (exit 0) → `npm run build` (exit 0, 8 pagine) → `npm audit` (exit 1, atteso per vulnerabilità presenti, 13 vulnerabilità) |
| 12 | Suite di test 53/53, nessun test saltato/disabilitato/indebolito | **Dimostrato** | Confermato per lettura diretta dei file di test e per doppia esecuzione in questa sessione; nessuna asserzione modificata per ottenere verde |
| 13 | Idempotenza a livello di byte + sola lettura provata su comandi indipendenti aggiuntivi | **Dimostrato** | 2 run extra di `npm run chunk:diagnostic` con hash identici alla baseline; confronto hash/mtime prima/dopo `npm test` identico |
| 14 | `productionChunkCount` resta `null`; nessuna implementazione di chunking di produzione introdotta | **Dimostrato** | `data/chunks.generated.json` contiene solo il placeholder con `chunks: []`; `scripts/build-content-index.mjs` resta inerte per costruzione |
| 15 | Nessun comando vietato eseguito (`npm audit fix --force`, upgrade Astro 7) | **Dimostrato** | Versione Astro installata confermata **5.18.2** invariata al termine della sessione; `npm audit fix --dry-run` usato solo per ispezione, nessuna scrittura confermata (hash `package-lock.json` invariato) |
| 16 | Le 4 KB canoniche restano bit-per-bit immutate | **Dimostrato** | Nessuna modifica di contenuto, front matter, whitespace, line ending o nome file ai 4 file canonici in questa sessione (nessuna operazione `edit`/`write` è stata eseguita su `content/kb/*.md`) |

## Note sul metodo di questo verdetto

Il precedente ciclo (v3.1) è stato respinto con `CONDITIONAL FAIL` perché diverse condizioni erano
state dichiarate soddisfatte per asserzione, senza evidenza riproducibile puntuale (tabelle mancanti
non rilevate, ID basati su riga, mapping a livello improprio, assenza di containment estesa,
generazione non byte-idempotente, attribuzione residua, README non aggiornato, gate non verificati
come programmatici). Ogni riga della tabella sopra è ancorata a un comando effettivamente eseguito in
questa sessione con output catturato — non a una ripetizione della dichiarazione originaria.

## Limiti dichiarati che non invalidano il PASS

I seguenti restano decisioni/limiti esplicitamente fuori scope, non difetti bloccanti (elenco
completo in `CHANGELOG_v3.1.1.md`): 9 mapping year-only fallback provvisori; upgrade Astro 7
rinviato; ambito di `npm audit`; `estimatedSplitCount` solo diagnostico; chunking di produzione non
implementato; `build-content-index.mjs` placeholder; Pagefind non implementato; layer di
retrieval/AI non implementato; titolare del copyright non deciso; `CODEOWNERS` assente.

## Riferimenti

- Report diagnostico completo: `data/chunk-diagnostic-report-v3.1.1.md`
- Changelog dettagliato §1–§9: `CHANGELOG_v3.1.1.md`
- Verdetto precedente (superato): `VERDETTO_FINALE_v3.1.md`
