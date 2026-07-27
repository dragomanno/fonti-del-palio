# Piano milestone — Piattaforma statica (gate pre-AI)

Per decisione (§7 delle risoluzioni del 26/07, corretta per la sequenza in `RISPOSTA_AL_TOOL_REVIEW_SCAFFOLD_E_CHUNKING.md` §8): il sito statico è un gate di rilascio obbligatorio e indipendente. **Nessuna chiamata OpenAI, generazione di embedding, o endpoint AI pubblico è richiesta per completare il prodotto statico rilasciabile.** La generazione degli embedding è stata spostata dopo M6, nella fase AI (A1–A4), come richiesto dal review.

## M0 — Indice di contenuto di produzione validato
- [x] Struttura repository Astro + TypeScript.
- [x] Diagnostica di chunking v2 sui 4 file KB reali (`data/chunk-diagnostic-report-v3.1.2.md`) — classificazione container/leaf/atomicRecord/article/tableBlock/preamble/nonChunkableStructuralHeading, tutti i controlli di accettazione superati.
- [x] Regole di chunking v2 approvate esplicitamente da Fabrizio (mandato M1: fase diagnostica congelata alla v3.1.3, si procede al chunker di produzione).
- [x] `scripts/build-content-index.mjs` — chunker di produzione reale con i 4 profili per-file. Genera 710 chunk (kb01=273, kb02=183, kb03=170, kb04=84), 704 con rotta pubblica, 133 con provenienza provvisoria marcata; output deterministico, senza timestamp, byte-identico fra esecuzioni consecutive. Gate `productionIndexMatchesCanonicalCorpus`: ogni chunk pubblicato coincide con il candidato diagnostico corrispondente per hash, righe, file e scope.
- [x] `scripts/check-env.mjs` — validatore delle variabili d'ambiente all'avvio della build.

**Uscita:** indice dei chunk di produzione generato e verificato (710 chunk finali non sovrapposti, hash del corpus, nessuna tabella troncata, nessun ID duplicato).

## M1 — Pagine statiche core
- [x] Homepage con disclaimer "progetto documentale indipendente, non ufficiale e ad accesso pubblico" in evidenza (nessun logo/stemma del Comune di Siena) — testo aggiornato secondo le correzioni editoriali del review (§9).
- [x] Pagina "Disciplina vigente" (da KB03): indice delle 8 parti + una pagina per parte (`/disciplina-vigente/[scope]/`), 118 articoli su 164 unità documentali.
- [x] Pagina "Evoluzione storica" (da KB01 + KB02): indice con timeline 2012–2026, una pagina per annualità (`/evoluzione-storica/[anno]/`) e la cornice metodologica con le tabelle storiche.
- [x] Pagina "Fonti e registro atti" (da KB04), 65 record in 4 famiglie, con le QUATTRO dimensioni sempre separate — disponibilità documentale, efficacia/ruolo storico, presenza nell'annualità successiva, stato della ricerca — e le tre motivazioni di assenza distinte (non documentato / non applicabile / non ancora valutato). Requisito originario a tre dimensioni separate — disponibilità documentale, efficacia/ruolo storico, presenza nell'annualità successiva — mai un'unica badge "vigente / non riprodotto / superato" che confonde le dimensioni.
- [x] Pagine di dettaglio per singola annualità/atto (`/atti/[atto]/`, 17 atti; `/fonti/[record]/`, 65 pagine di record più l'indice delle fonti), con permalink stabili basati sugli ID definiti in `data/chunk-diagnostic-report-v3.1.2.md` §5/§9.

## M2 — Ricerca documentale locale
- [x] Integrazione Pagefind sulla build statica (anticipata a M1 su mandato): `pagefind --site dist` in coda a `npm run build`, 115 pagine e 4.346 parole indicizzate, UI italiana su `/ricerca/`.
- [x] Esclusione dei documenti di pianificazione interna dall'indice Pagefind: i report diagnostici e il piano milestone vivono in `data/` e non sono pubblicati; nell'HTML solo `<main data-pagefind-body>` è indicizzato e banner, header, footer e citazioni portano `data-pagefind-ignore`.
- [x] Verifica che la ricerca funzioni identicamente con `AI_ENABLED=false` e senza alcuna chiamata di rete esterna: indice statico servito dal sito, font self-hosted via @fontsource, nessuna richiesta a servizi terzi. Verificata in browser su `dist` servito staticamente (query «previsite» 41 risultati, «PE-2019-01» 6, «farmaci controllati» 33, «articolo 37» 21).

## M3 — Pagine legali/editoriali obbligatorie
- [ ] Metodologia (come sono state raccolte e classificate le fonti).
- [ ] Attribuzione (fonti primarie, nessuna rivendicazione di ufficialità) — separata dalla licenza software (§12 del review).
- [ ] Disclaimer (progetto indipendente, nessun logo/stemma comunale, nessuna responsabilità legale sulle informazioni).
- [ ] Privacy — bozza aggiornata secondo §12 del review: log di accesso hosting, cookie funzionale per rate limiting, Turnstile/OpenAI disclosed solo quando attivi.
- [ ] Ogni pagina documentale mostra: "Ultima verifica", stato della fonte, avvertenza di completezza/ricerca dove applicabile, link alla fonte ufficiale quando disponibile, notifica esplicita quando l'atto originale o l'URL diretto mancano ancora.

## M4 — Accessibilità, metadati, anteprime Telegram
- [ ] Layout mobile verificato su viewport reali per tutte le pagine (non solo la homepage).
- [ ] Skip link e revisione da tastiera.
- [x] URL canonico auto-referenziale su ogni pagina indicizzabile e `og:url` coincidente, derivati dalla rotta generata (v0.1.0).
- [x] `robots.txt` che dichiara la sitemap, e sitemap completa derivata dalle rotte pubbliche indicizzabili: 116 URL (v0.1.0).
- [ ] Immagine di anteprima social (`og:image`) e restanti metadati Open Graph/Twitter Card.
- [ ] Metadati "ultima verifica" esposti in pagina, non solo nei dati interni.
- [ ] Link e citazioni verificati (nessun link rotto verso le fonti); gestione chiara dei link ufficiali esterni.
- [ ] Lighthouse/accessibilità di base sulle pagine principali.

## M5 — Netlify Deploy Preview con AI disabilitata
- [ ] Deploy su Netlify Deploy Preview con `AI_ENABLED=false` (default anche in `.env.example`).
- [ ] `npm ci`, `npm run check`, `npm test`, `npm run build` eseguiti in CI prima del deploy.
- [ ] Verifica che nessuna funzione Netlify richieda segreti AI per il deploy statico.

## M6 — Revisione di Fabrizio e approvazione esplicita del sito statico
- [ ] Revisione completa: homepage, disciplina vigente, evoluzione storica, fonti, ricerca, pagine legali, mobile su tutte le pagine.
- [ ] Approvazione esplicita e separata prima di avviare la fase AI.

**Nessuna fase successiva (A1–A4) inizia prima dell'approvazione esplicita di M6.**

---

## Fase AI (dopo M6, non prima)

> **Nota sui percorsi citati in questa fase.** Tutti i file elencati qui sotto
> (`scripts/build-embeddings.mjs`, `data/embeddings.generated.f32`,
> `data/embeddings.manifest.json`) sono **artefatti futuri pianificati e non
> esistenti** nel repository. Nessuno script di generazione di embeddings è
> presente. Non vanno letti come percorsi risolvibili allo stato attuale.

## A1 — Valutazione offline della retrieval
- [ ] Set di domande di verifica (minimo 50, vedi Decisione 12) testato contro l'indice di contenuto senza ancora generare embedding — solo per validare la copertura dei chunk.

## A2 — Generazione embedding
- [ ] `scripts/build-embeddings.mjs` con `text-embedding-3-small`, output Float32 binario + manifest JSON (`data/embeddings.generated.f32`, `data/embeddings.manifest.json`).
- [ ] Verifica hash corpus↔embedding nel manifest.

**Uscita:** artefatto embedding riproducibile, non ancora collegato a un endpoint pubblico.

## A3 — Endpoint AI, Turnstile, rate limiting
- [ ] `netlify/functions/ask.ts` — implementazione reale (Responses API, budget di reasoning, fallback di modello secondo le Decisioni approvate).
- [ ] Turnstile attivo solo sui hostname configurati.
- [ ] Rate limiting con identificatore pseudonimo HMAC giornaliero (non IP grezzo persistito).
- [ ] Dipendenza `@netlify/functions` dichiarata in `package.json` prima del deploy delle Functions.

## A4 — Revisione delle 50 domande e test avversariali
- [ ] Le 50 domande + casi avversariali (Decisione 12) eseguiti contro l'endpoint reale.
- [ ] Verifica esplicita di attribuzione e rischio editoriale su ogni risposta campione.
- [ ] Approvazione esplicita di Fabrizio prima del lancio pubblico dell'endpoint AI.
