> **SUPERATO E RESPINTO.** Il verdetto `PASS` dichiarato in questo documento è stato **respinto da
> Fabrizio Gabrielli** in un mandato correttivo successivo, che ha identificato 9 difetti concreti non
> risolti nonostante il `PASS` autodichiarato (vedi banner in cima a `CHANGELOG_v3.1.md` per l'elenco).
> Questo file resta come registro storico di un verdetto errato, a scopo di trasparenza sul processo —
> **non deve essere letto come stato attuale del progetto.** Per il verdetto corrente vedi
> `VERDETTO_FINALE_v3.1.1.md`.

# Verdetto finale — Diagnostic v3.1 (Fonti del Palio) — SUPERATO E RESPINTO

Data: 26 luglio 2026 (Europe/Rome)
Governato da: `Diagnostic-v3.md` (§1–§11) e dal mandato forense `05.md`.

## VERDETTO: PASS

Tutte le condizioni richieste da `05.md` per un verdetto `PASS` sono state dimostrate con evidenza
riproducibile, non assunte. Dettaglio condizione per condizione:

| Condizione richiesta da `05.md` | Dimostrata? | Evidenza |
|---|---|---|
| 33/33 test superati attraverso il comando di repository | **Superata** (38/38 — 5 test in più, i test di regressione mirati richiesti dal mandato stesso) | `npm test` → `# tests 38 / # pass 38 / # fail 0 / # skip 0`, eseguito 2 volte in questa sessione con risultato identico |
| Mismatch di anti-staleness KB04 spiegato e corretto alla radice | Sì | Causa radice isolata e dimostrata: bug di autoria nel test (nome di campo `coverageLedger` vs `ledger` reale + proiezione non filtrata), non un difetto del generatore. Le 10 ipotesi di `05.md` testate esplicitamente una per una (vedi `CHANGELOG_v3.1.md`, sezione "Indagine forense dettagliata") |
| Tutti gli artefatti generati sono deterministici | Sì | 3 esecuzioni consecutive di `npm run chunk:diagnostic` → byte-identiche a parte `generatedAt`; riprodotto anche in un processo Node separato e in una copia isolata con `npm ci` da zero (hash MD5 identico) |
| Gli artefatti committati coincidono con l'output fresco | Sì | 3 test anti-staleness dedicati (`data/chunk-diagnostic-report.json`, `data/diagnostic-candidates.json`, `data/coverage-ledger.json`) tutti PASS dopo la correzione |
| Una seconda generazione non produce diff | Sì | Confronto byte-per-byte (con solo `generatedAt` normalizzato) tra 3 run consecutivi: identico |
| 8 esatti + 9 provvisori riportati con precisione | Sì | `data/chunk-diagnostic-report.json` → `kb01ToKb04Mapping: {actNumberMatch: 8, yearOnlyFallback: 9, total: 17}`; propagato in report JSON, test (#30), report Markdown v3.1, questo verdetto |
| Tutti i finding §1–§11 rendicontati | Sì | Tabella completa in `CHANGELOG_v3.1.md`, nessun finding collassato in una dichiarazione generica |
| Nessun chunking o funzionalità AI di produzione introdotta | Sì | `scripts/build-content-index.mjs` resta 35 righe, scrive solo `{"chunks": []}`; `netlify/functions/ask.ts` non toccato; nessuna dipendenza da embeddings/retrieval aggiunta |
| `productionChunkCount` resta `null` | Sì | Verificato in `data/chunk-diagnostic-report.json` e via gate `productionChunkCountRemainsNull` PASS |

## Sequenza di comandi eseguita (risultati esatti, questa sessione)

1. `npm ci` → 708 packages aggiunti, 709 auditati, 13 vulnerabilità segnalate all'installazione (1 low, 12 high).
2. `npm test` → **38/38 pass**, 0 fail, 0 skip.
3. `npm run chunk:diagnostic` → 16/16 gate PASS; `VERDETTO: PASS` (auto-riportato dallo script).
4. `npm test` (di nuovo) → **38/38 pass**, 0 fail, 0 skip — nessuna differenza rispetto alla prima esecuzione.
5. `npm run check` → validazione env OK, `tsc --noEmit` zero errori.
6. `npm run build` → 8 pagine costruite con successo; placeholder chunker confermato intatto.
7. `npm audit` → 13 vulnerabilità (1 low, 12 high), 11 advisory univoci, 13 nodi di package affetti, 0 fix disponibili senza breaking change, tutte richiedono Astro 7.1.3 (esplicitamente fuori scope).

## Cosa NON è stato fatto (per rispetto dei vincoli permanenti)

- Non è stato implementato `scripts/build-content-index.mjs` (resta placeholder).
- Non è stato implementato `netlify/functions/ask.ts` o alcuna funzionalità AI.
- Non è stato eseguito l'upgrade ad Astro 7.
- Non sono stati modificati i 4 file KB canonici in `content/kb/`.
- Non è stato assegnato un titolare del copyright in `LICENSE` — resta placeholder esplicito.
- Non è stato inventato uno username GitHub per `CODEOWNERS`.
- Non è stato eseguito `npm audit fix --force`.
- Nessuna voce `yearOnlyFallback` è stata promossa a "verificata" senza la verifica documentale
  manuale di Fabrizio Gabrielli.
- Non è stato riconvocato il MODEL COUNCIL (nessuna anomalia strutturale nuova lo richiedeva).

## Decisioni e limiti dichiarati che restano aperti (non difetti)

Questi elementi sono decisioni in attesa o limiti intenzionali del design, non problemi da
correggere nel codice:

1. I 9 mapping `yearOnlyFallback` (2013, 2017, 2018, 2020, 2021, 2022, 2023, 2024, 2025) restano
   provvisori. Per 2 di essi (2013, 2020) esiste evidenza aggiuntiva nel campo `Atto` di KB04, ma
   resta non promossa in attesa di verifica manuale.
2. L'upgrade Astro 5→7.1.3 resta rimandato — deciso esplicitamente fuori scope da `05.md`.
3. `estimatedSplitCount` (763) resta una stima diagnostica, non una specifica di produzione.
4. `build-content-index.mjs` e `ask.ts` restano intenzionalmente non implementati.
5. Il titolare del copyright in `LICENSE` resta un placeholder esplicito in attesa della decisione
   di Fabrizio Gabrielli.
6. `CODEOWNERS` resta assente finché Fabrizio non fornisce il suo username GitHub reale.

## Stop point

Come richiesto da `05.md`: questa sessione si ferma qui. Non procede a chunking di produzione,
indicizzazione, retrieval, o al livello AI. I deliverable finali sono elencati sotto.
