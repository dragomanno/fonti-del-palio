# Changelog — Diagnostic v3.1.2 (release correttiva)

> **DOCUMENTO SUPERATO.** Questa release e' stata sottoposta a verifica indipendente ed ha
> ricevuto un verdetto di **CONDITIONAL FAIL**. E' superata dalla release correttiva **v3.1.3**
> (27 luglio 2026) — vedi `VERDETTO_FINALE_v3.1.3.md`, `CHANGELOG_v3.1.3.md` e
> `data/chunk-diagnostic-report-v3.1.3.md`. Il contenuto sottostante e' conservato invariato
> come documentazione storica del ciclo v3.1.2 e NON descrive lo stato corrente del repository.

Questo changelog copre il ciclo di lavoro correttivo aperto sui difetti contestati alla release
v3.1.1. Per ciascuna sezione contestata (§1–§7) la tabella riporta il difetto, l'esito, i file
toccati, la correzione applicata, il metodo di verifica e i limiti residui dichiarati. Nessuna voce è
promossa a esito positivo senza un test o un'evidenza riproducibile citata nella colonna dedicata.

`CHANGELOG_v3.1.1.md` (il changelog del ciclo precedente) resta nel repository come registro
storico: v3.1.1 è marcata come **superata** da v3.1.2.

## §1–§7 — Stato onesto delle correzioni

| Sezione | Difetto contestato | Esito | File toccati | Cosa è stato fatto | Come è stato verificato | Limiti residui dichiarati |
|---|---|---|---|---|---|---|
| §1 | Contratto di stato documentario assente: tutti i 710 candidati ricevevano lo stesso stato sintetico `{"state":"final","verifiedBy":"structural"}` | `corretto` | `scripts/lib/documentary-status.mjs` (nuovo, 309 righe), `scripts/chunk-diagnostic.mjs`, `tests/chunk-diagnostic.test.mjs` | Rimossa la classificazione sintetica. Nuovo modulo `scripts/lib/documentary-status.mjs` che espone `STATUS_DIMENSIONS`, `DOCUMENTED_NULL_REASONS` (`notDocumented`, `notApplicable`, `notYetEvaluated`), `KB04_LEGEND_CROSSWALK` (11 voci), `extractKb04StatusVocabulary`, `findUnanchoredCrosswalkTerms`, `buildDocumentaryStatus`. Ogni candidato espone quattro dimensioni — `documentaryStatus`, `legalStatus`, `presenceStatus`, `researchStatus` — ciascuna con il valore canonico esatto **oppure** un documented-null tipizzato, più un riferimento macchina-leggibile alla fonte e un riferimento di ereditarietà esplicito. La corrispondenza avviene **solo per match esatto**: nessuna normalizzazione, nessuna inferenza. L'integrità (`contentHash`, range ricostruiti) è tenuta separata in `c.integrity` e non viene confusa con lo stato documentario. Nuovo gate `allCandidatesHaveCanonicalStatusDimensions`. | Distribuzione verificata sui 710 candidati: `documentaryStatus` → 379 `null:notDocumented`, 126 `null:notYetEvaluated`, 109 «protocollo presente; atto di approvazione non incluso», 96 «presente nel corpus»; `legalStatus` → 578 `null:notDocumented`, 110 `null:notYetEvaluated`, 13 «efficacia annuale esaurita», 6 `null:notApplicable`, 3 «efficacia esaurita»; `presenceStatus` → 710 `null:notYetEvaluated`; `researchStatus` → 710 `null:notDocumented`; 266 candidati con ereditarietà esplicita. Mutation test: la rimozione di una dimensione e la rottura di un riferimento di fonte fanno **fallire** il gate. | `presenceStatus` e `researchStatus` restano documented-null su tutti i 710 candidati perché le fonti canoniche non li documentano — è un limite delle fonti, non del parser. Reperti onesti dichiarati: (a) `verifiedBy` era `undefined` su tutti i 710 candidati prima della correzione; (b) «ricerca aperta» compare **solo** alla riga 38 di KB04 (legenda) e mai come letterale di record — riportato come reperto, non come difetto; (c) esempio di non-normalizzazione: `kb04:pe-2013-01` ha il letterale `documentaryStatus` «protocollo presente; atto di approvazione non presente» alla riga 98 di KB04, diverso dal «non incluso» della legenda alla riga 60, e **non** è stato normalizzato. |
| §2 | Test di inserimento vacuo: il vecchio test appendeva testo **dopo** il candidato e non rieseguiva il parser, quindi non dimostrava nulla sulla stabilità degli ID | `corretto` | `tests/chunk-diagnostic.test.mjs`, `scripts/chunk-diagnostic.mjs` | Sostituito con un mutation test reale: inserisce `INSERTED_LINE_COUNT = 7` righe **prima** del candidato, riesegue il parser sulla sorgente mutata in memoria e verifica che l'ID pubblico resti invariato, che `startLine` ed `endLine` risultino spostati di **+7** e che il `contentHash` resti invariato. Copre tutte le **11 famiglie** di candidati. Introdotto `frontMatterEndLineOf(raw)` e spostata l'inserzione primaria a `fmEnd + 1`, punto provabilmente esterno a ogni candidato; aggiunta una variante più stringente che inserisce nel gap adiacente a `sample.startLine - 1`. | Verifica indipendente del `contentHash` estesa a **tutti i 710 candidati** contro il testo ricostruito, non più su un campione per `candidateType`. Copertura adiacente misurata: **10 famiglie su 11**; soglia asseritta `adjacentCovered >= 10` come guardia di regressione. | Reperto reale emerso e risolto onestamente: il primo tentativo falliva su `corpus-storico-intro:indice-dei-documenti:seguito` con «72 !== 79» perché le sezioni residue «seguito» sono definite come «tutto il testo che segue la tabella», quindi righe inserite al loro inizio cadono **dentro** il candidato: il punto di inserimento era interno, non precedente. L'unica famiglia non coperta dalla variante adiacente è proprio la famiglia «seguito», documentata in commento inline nel test. |
| §3 | Semantica di containment incompleta: `checkCandidatesWithinBlocks` ignorava un candidato quando non trovava alcun blocco contenitore; **39 candidati su 710** sfuggivano del tutto al containment (kb01 5 in `corpus-storico-intro`, kb02 15 in `memoria-incrementale-cornice`, kb03 0, kb04 19 in `manifest-registro-intro`) | `corretto` | `scripts/lib/containment.mjs` (nuovo), `scripts/lib/parse-kb02.mjs`, `scripts/chunk-diagnostic.mjs`, `tests/containment-v312.test.mjs` (nuovo) | Nuovo modulo `scripts/lib/containment.mjs` con `CONTAINMENT_VIOLATION_KINDS` congelato (`noContainingBlock`, `endsOutsideBlock`, `wrongScope`, `crossesBlockBoundary`), `scanH1Sections` fence-aware con `slugify`, `buildContainingBlocks` e `checkContainment`, che seleziona il blocco contenitore **più interno** e applica le quattro regole in ordine. **Ora l'assenza di blocco è una violazione**, non un'esenzione silenziosa. Partizione completa: KB01 → blocco intro `corpus-storico-intro` più un blocco per atto con scope `atto-${registerId}`; KB02 → `nonYearH1Sections` con scope `memoria-incrementale-cornice` più sezioni annuali con scope `memoria-incrementale`; KB03 → `h1Blocks` che già dichiarano il proprio scope; KB04 → tutte le sezioni H1 con scope `manifest-registro-intro` e blocchi record annidati con scope `registro-fonti`. | Progressione delle violazioni misurata: **18 → 6 → 0**. Nuovo file `tests/containment-v312.test.mjs` con **8 test, tutti verdi**: baseline a zero violazioni; la partizione copre ogni riga iniziale; mutation `noContainingBlock`, `wrongScope`, `endsOutsideBlock`, `crossesBlockBoundary` su KB01–KB04; insieme dei violation kind coerente con la dichiarazione; blocchi dello stesso livello non sovrapposti. | Il vecchio `checkCandidatesWithinBlocks` resta esportato come confronto storico ma **non alimenta più il gate**. Due difetti reali trovati e corretti alla radice: (1) partizione KB04 — le sezioni H1 di inquadramento sono *interleaved* con i record, non un semplice prefisso (range orfani 373-391, 392-402, 403-404, 432-444, 445-457, 458-461, 462-470, 1056-1057, 1058-1077, 1078-1089, 1090-1093, 1094-1100; primo record riga 67, ultimo record fine 1055); (2) KB02 doppio difetto — (a) `buildKb02Candidates` cablava `documentScope` `"memoria-incrementale"` per tutte le tabelle, ora derivato da `tableScope` in base alla containment reale, con impatto su 6 tabelle alle righe 398, 410, 419, 428, 436, 445; (b) `scripts/lib/parse-kb02.mjs` assegnava all'anno 2026 `endLine` 601 invece di 393, con uno sconfinamento di **208 righe** che inghiottiva sei sezioni H1 di inquadramento — la correzione sposta il loop degli `endLine` H1 **prima** di quello degli anni e clampa `y.endLine` al blocco H1 proprietario. |
| §4 | README, NOTICE e wording pubblico descrivevano come esistenti funzionalità non implementate e citavano path stale | `corretto` | `README.md`, `NOTICE.md`, `src/pages/chi-siamo.astro`, `data/static-site-milestone-plan.md`, `.github/ISSUE_TEMPLATE/feature-request.md`, `CONTRIBUTING.md`, `scripts/build-content-index.mjs` | **7 sostituzioni in `README.md`**: la sezione «Stack tecnico» dichiara ora di descrivere l'architettura **di destinazione** e non lo stato corrente; Pagefind marcato *(previsto)* / non implementato, non installato né configurato, e nessuna build genera un indice Pagefind; assistente AI marcato *(previsto)* / non implementato, con `netlify/functions/ask.ts` descritto come placeholder architetturale inerte; commento di `scripts/` corretto in «Diagnostica read-only + validazione env; nessun generatore di embedding esiste in questo repository»; commento di `tests/` corretto in «Test di regressione della sola diagnostica di parsing (nessun test di retrieval o di risposte AI: non esistono)»; la citazione esatta nelle pagine generate riqualificata come requisito di progetto **previsto e non ancora implementato**; governance aggiornata da repository pubblico a **repository privato in attesa di approvazione finale**. **`NOTICE.md`**: il punto 3 sugli artefatti generati dichiara ora che gli unici artefatti realmente prodotti sono quelli della diagnostica read-only e che non esistono indici di chunk di produzione né embeddings, essendo `data/chunks.generated.json` un placeholder inerte con array vuoto; la sezione «Repository pubblico e trasparenza» è diventata «Stato del repository e trasparenza» e dichiara che il repository dedicato esiste ma è privato, con flussi pubblici di segnalazione e contribuzione attivi solo dopo la pubblicazione. `src/pages/chi-siamo.astro` allineato allo stesso wording. **Path stale corretti**: `data/static-site-milestone-plan.md` righe 7 e 19 puntano ora a `data/chunk-diagnostic-report-v3.1.2.md`; stessa rinomina in `.github/ISSUE_TEMPLATE/feature-request.md`, `CONTRIBUTING.md` e nel commento di `scripts/build-content-index.mjs`. Aggiunta nota esplicita nella «Fase AI» del piano milestone che dichiara `scripts/build-embeddings.mjs`, `data/embeddings.generated.f32` e `data/embeddings.manifest.json` come artefatti **futuri pianificati e non esistenti**. | Scansione automatica di tutti i path citati fra backtick in `README.md`, `NOTICE.md`, `CONTRIBUTING.md` e `data/static-site-milestone-plan.md`: tutti risolvono contro file realmente presenti, con l'unica eccezione attesa dei tre artefatti AI futuri, ora esplicitamente marcati come inesistenti. `npm run build` continua a produrre **8 pagine**. | Preservati senza modifiche: Fabrizio Gabrielli fondatore di Pistakkio®, il credito «Made with Love 💚 by Pistakkio®» collegato, `GITHUB_URL = null`, `GITHUB_URL_PENDING = "https://github.com/dragomanno/fonti-del-palio"`. Il repository resta privato: i flussi pubblici di segnalazione e contribuzione non sono attivi. |
| §5 | Verifica pulita non riproducibile: su un'estrazione fresca priva di `.env` la sequenza documentata falliva a `npm run check` con exit 1, perché `PUBLIC_SITE_NAME` e `PUBLIC_SITE_URL` erano assenti | `corretto` | `config/public-defaults.json` (nuovo, committato), `scripts/check-env.mjs`, `tests/public-defaults-v312.test.mjs` (nuovo) | Nuovo file committato `config/public-defaults.json` con i **soli due valori pubblici non-segreti** (`PUBLIC_SITE_NAME` = «Fonti del Palio», `PUBLIC_SITE_URL` = `https://fontidelpalio.it`) e un campo `_comment` che ne spiega la natura. `scripts/check-env.mjs` li carica come default espliciti **dopo** l'eventuale `.env`, dando **sempre** la precedenza alle variabili d'ambiente, e segnala l'origine nella matrice di presenza con il suffisso «— da `config/public-defaults.json`». Nessun segreto AI è richiesto quando `AI_ENABLED` non è `true`. | Nuovo file `tests/public-defaults-v312.test.mjs` con **6 test verdi**, fra cui la prova decisiva che ricostruisce in una directory temporanea la sola struttura letta dallo script (`scripts/` e `config/`), volutamente **priva di `.env`**, e verifica che `check-env` esca senza errori bloccanti attingendo esplicitamente ai default committati; più un test che impedisce la divergenza fra i fallback cablati in `src/config/site.ts` e la configurazione committata, e un test che rifiuta qualunque chiave che somigli a un segreto o non abbia prefisso `PUBLIC_`. | Nessun segreto è committato né richiesto: i default coprono esclusivamente i due valori pubblici. Il comportamento AI resta non esercitato perché `AI_ENABLED` non è `true` e nessun layer AI esiste. |
| §6 | Reporting `npm audit` contraddittorio: la v3.1.1 affermava sia che tutti i reperti richiedono Astro 7, sia che 10 nodi su 13 hanno una correzione semplice | `corretto` (affermazioni v3.1.1 **ritirate**) | `data/chunk-diagnostic-report-v3.1.2.md`, `CHANGELOG_v3.1.2.md` (questo file) | Entrambe le affermazioni della v3.1.1 sono **errate** e vengono ritirate. Sostituite dai dati esatti letti da `npm audit --json` sul lockfile finale e dalla catena di dipendenze verificata riportata nelle due sottosezioni sotto. | `npm audit --json` sul lockfile finale: **13 nodi**, **13 vulnerabilità**, `metadata` `{low: 1, high: 12, moderate: 0, critical: 0, info: 0}`, **11 advisory unici**. Tabella per-nodo e catena di verifica nelle sottosezioni «§6.1» e «§6.2» sotto. | **Nessuna remediation di sicurezza è stata applicata.** Non sono stati eseguiti `npm audit fix`, né `npm audit fix --force`, né alcun upgrade di Astro. |
| §7 | Evidenze e verdetto del ciclo non prodotti | `corretto` | `CHANGELOG_v3.1.2.md`, `VERDETTO_FINALE_v3.1.2.md`, `data/chunk-diagnostic-report-v3.1.2.md`, artefatti JSON, ZIP di consegna | Creati `CHANGELOG_v3.1.2.md` (questo file), `VERDETTO_FINALE_v3.1.2.md` e `data/chunk-diagnostic-report-v3.1.2.md`; artefatti JSON rigenerati; nuovo ZIP con SHA-256. v3.1.1 marcata come superata. | I tre documenti sono presenti nel repository, gli artefatti JSON sono stati rigenerati e il nuovo ZIP è accompagnato dal proprio SHA-256. | Il verdetto formale resta subordinato all'esito della sequenza di verifica da estrazione fresca documentata in `VERDETTO_FINALE_v3.1.2.md`. |

## §6.1 — `npm audit --json`: inventario per-nodo

Dati esatti dal lockfile finale: 13 nodi, 13 vulnerabilità, `metadata` `{low: 1, high: 12,
moderate: 0, critical: 0, info: 0}`, 11 advisory unici.

| Nodo | Severity | Diretto/Transitivo | Advisory di origine | `fixAvailable` esatto | Tipo di remediation |
|---|---|---|---|---|---|
| `@netlify/functions` | high | Diretto | Nessun advisory proprio — eredita da `@netlify/zip-it-and-ship-it` | `true` | Classificata da npm come non-breaking |
| `@netlify/zip-it-and-ship-it` | high | Transitivo | Eredita da `@vercel/nft`, `archiver`, `minimatch` | `true` | Classificata da npm come non-breaking |
| `@vercel/nft` | high | Transitivo | Eredita da `glob` | `true` | Classificata da npm come non-breaking |
| `archiver` | high | Transitivo | Eredita da `archiver-utils`, `readdir-glob`, `zip-stream` | `true` | Classificata da npm come non-breaking |
| `archiver-utils` | high | Transitivo | Eredita da `glob` | `true` | Classificata da npm come non-breaking |
| `astro` | high | Diretto | 8 advisory propri: `GHSA-j687-52p2-xcff` (moderate), `GHSA-xr5h-phrj-8vxv` (low), `GHSA-8hv8-536x-4wqp` (high), `GHSA-2pvr-wf23-7pc7` (high), `GHSA-jrpj-wcv7-9fh9` (moderate), `GHSA-4g3v-8h47-v7g6` (moderate), `GHSA-f48w-9m4c-m7f5` (moderate), `GHSA-7pw4-f3q4-r2p2` (low); più eredità da `esbuild` e `sharp` | `{"name":"astro","version":"7.1.3","isSemVerMajor":true}` | Richiede upgrade **major** di una dipendenza diretta |
| `brace-expansion` | high | Transitivo | Advisory proprio `GHSA-mh99-v99m-4gvg` | `true` | Classificata da npm come non-breaking |
| `esbuild` | low | Transitivo | Advisory proprio `GHSA-g7r4-m6w7-qqqr` | `{"name":"astro","version":"7.1.3","isSemVerMajor":true}` | Richiede upgrade **major** di una dipendenza diretta |
| `glob` | high | Transitivo | Eredita da `minimatch` | `true` | Classificata da npm come non-breaking |
| `minimatch` | high | Transitivo | Eredita da `brace-expansion` | `true` | Classificata da npm come non-breaking |
| `readdir-glob` | high | Transitivo | Eredita da `minimatch` | `true` | Classificata da npm come non-breaking |
| `sharp` | high | Transitivo | Advisory proprio `GHSA-f88m-g3jw-g9cj` | `{"name":"astro","version":"7.1.3","isSemVerMajor":true}` | Richiede upgrade **major** di una dipendenza diretta |
| `zip-stream` | high | Transitivo | Eredita da `archiver-utils` | `true` | Classificata da npm come non-breaking |

## §6.2 — Perché `fixAvailable: true` non equivale a una remediation garantita non-breaking

Catena verificata sul grafo di dipendenze reale di questo repository.

I 10 nodi con `fixAvailable: true` discendono tutti da **un solo advisory**,
`GHSA-mh99-v99m-4gvg` su `brace-expansion`, raggiunto esclusivamente attraverso la dipendenza
diretta `@netlify/functions@3.1.10` (dichiarata `^3.0.0`).

Versioni installate rilevanti: `astro` 5.18.2, `@netlify/functions` 3.1.10,
`@netlify/zip-it-and-ship-it` 12.2.1, `brace-expansion` 2.1.2, `minimatch` 9.0.9 e 5.1.9 e 10.2.5,
`glob` 10.5.0, `esbuild` 0.27.7, `sharp` 0.34.5, `archiver` 7.0.1, `@vercel/nft` 0.29.4.

L'advisory copre `brace-expansion <= 5.0.7`. L'ultima release della linea 2.x è la **2.1.2**, cioè
esattamente la versione installata e vulnerabile: **non esiste alcuna patch nella linea 2.x**.

I consumatori sono vincolati a quella linea:

- `minimatch@9.0.9` richiede `brace-expansion ^2.0.2`; `minimatch@5.1.9` richiede `^2.0.1`.
- `minimatch@9` è richiesto da `@netlify/zip-it-and-ship-it` (`^9.0.0`) e da `glob@10.5.0` (`^9.0.4`).
- `minimatch@5` è richiesto da `readdir-glob@1.1.3` (`^5.1.0`), a sua volta richiesto da
  `archiver@7.0.1` (`^1.1.2`).
- `glob@10` è richiesto da `archiver-utils@5.0.2` (`^10.0.0`) e da `@vercel/nft@0.29.4` (`^10.4.5`).

L'unica `brace-expansion` non vulnerabile è la **5.0.8**, accettata soltanto da `minimatch@10.x`
(`^5.0.5`) — come si osserva nel ramo indipendente `@typescript-eslint/typescript-estree@8.65.0`,
che infatti monta `minimatch@10.2.5` con `brace-expansion@5.0.8` e non risulta vulnerabile.

Uscire dall'advisory richiederebbe quindi di portare `minimatch` alla linea 10 dentro rami i cui
range dichiarati (`^9` e `^5`) lo vietano, in pacchetti non controllati da questo repository.

Inoltre il range vulnerabile di `@netlify/functions` è `3.1.0 - 4.1.12` e l'ultima release della
linea 3.x è proprio la **3.1.10** installata: nessuna 3.x esce dal range, e uscirne imporrebbe il
salto major a 4.x, fuori dal `^3.0.0` dichiarato.

**Conclusione onesta:** `fixAvailable: true` su questi 10 nodi **non è stato confermato** come
remediation reale non-breaking su questo grafo di dipendenze; è la classificazione di npm, non un
esito verificato. I 3 nodi restanti (`astro`, `esbuild`, `sharp`) richiedono esplicitamente
`astro@7.1.3`, dichiarato da npm stesso `isSemVerMajor: true` e «Will install astro@7.1.3, which is a
breaking change». **Nessuna remediation è stata applicata.**

## Limiti dichiarati

1. **Nessun chunker di produzione, Pagefind, embeddings, retrieval o layer AI implementato**, per
   vincolo esplicito.
2. **`productionChunkCount` resta `null` per progetto** e `data/chunks.generated.json` resta un
   placeholder inerte.
3. **`presenceStatus` e `researchStatus` sono documented-null su tutti i 710 candidati**, perché le
   fonti canoniche non li documentano.
4. **Nessuna remediation di sicurezza applicata** (né `npm audit fix`, né `--force`, né upgrade di
   Astro).
5. **Il repository resta privato.**

## Riferimenti

- Report diagnostico completo: `data/chunk-diagnostic-report-v3.1.2.md`
- Verdetto: `VERDETTO_FINALE_v3.1.2.md`
- Ciclo precedente (superato): `CHANGELOG_v3.1.1.md`, `VERDETTO_FINALE_v3.1.1.md`,
  `data/chunk-diagnostic-report-v3.1.1.md`
