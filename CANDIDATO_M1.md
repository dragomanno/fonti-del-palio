# Fonti del Palio — Candidato M1

> **Stato: accettato.** Le cifre riportate in questo documento sono allineate al
> rilascio finale v0.1.0. Le differenze rispetto alle misurazioni intermedie del
> candidato sono documentate in `CHANGELOG_v0.1.0.md`, §1.5 e §1.4.

Milestone M1 chiusa come **prodotto documentario static-first**. Nessun layer AI,
nessun embedding, nessun retrieval: `netlify/functions/ask.ts` resta un
segnaposto inerte e `npm run embeddings:build` esce con codice 1 per costruzione.

---

## 1. I cinque deliverable richiesti

### 1.1 Chunker di produzione

`scripts/build-content-index.mjs` genera `data/chunks.generated.json` dai quattro
file KB canonici riusando `analyzeAll` e `reconstructCandidateText` della
diagnostica: non esiste un secondo parser divergente.

- **710 chunk** — kb01 = 273, kb02 = 183, kb03 = 170, kb04 = 84
- **704** con rotta pubblica; 6 senza rotta (l'insieme non chunkabile di KB 03)
- **133** con almeno una provenienza provvisoria, marcata come tale e mai promossa
- Output **deterministico**: nessun timestamp, nessun `new Date()`. Su un'estrazione
  pulita in una directory diversa l'indice è byte-identico
  (SHA-256 `14bebfae52f0851439ff42ec92118cb2b979d030a34d66e28170a4a2db49a03c`).

Il gate `productionIndexMatchesCanonicalCorpus` verifica che ogni chunk pubblicato
coincida con il candidato diagnostico corrispondente per `contentHash`, `startLine`,
`endLine`, `file` e `documentScope`.

### 1.2 Pagine documentarie reali al posto dei segnaposto

| Sezione | Rotte | Contenuto |
| --- | --- | --- |
| Disciplina vigente | `/disciplina-vigente/` + 8 pagine di parte | KB 03, 164 unità documentali |
| Evoluzione storica | `/evoluzione-storica/` + una pagina per annualità 2012–2026 + tabelle storiche | KB 01 + KB 02 |
| Registro atti | `/atti/` + 17 pagine di atto | KB 01 → KB 04 |
| Fonti | `/fonti/` (indice delle fonti) + 65 pagine di dettaglio dei record | KB 04, 65 record in 4 famiglie |

Le pagine placeholder `disciplina-vigente.astro`, `evoluzione-storica.astro` e
`fonti.astro` sono state eliminate. **116 pagine** costruite in totale.

### 1.3 Ricerca statica Pagefind

`pagefind --site dist` in coda a `npm run build`. **115 pagine indicizzate, 4.346
parole, 1 lingua (it)**, nessuna chiamata di rete esterna. `/ricerca` è esclusa
dall'indice (`searchable={false}`); banner, header, footer e blocchi di citazione
portano `data-pagefind-ignore`.

Verifica reale in browser sul `dist` servito staticamente:

| Query | Risultati | Primo risultato |
| --- | --- | --- |
| previsite | 41 | `/disciplina-vigente/previsite-tratta-2026/` |
| PE-2019-01 | 6 | `/fonti/pe-2019-01/` |
| farmaci controllati | 33 | `/disciplina-vigente/ordinanza-6-2026/` |
| articolo 37 | 21 | `/fonti/leg-2019-sper-3738/` |

Se l'indice non è disponibile (per esempio in `astro dev`, dove `/pagefind/` non
esiste) la pagina mostra un fallback navigabile invece di fallire in silenzio.

### 1.4 Citazioni visibili e collegamenti alle fonti canoniche

Ogni chunk pubblicato espone il riferimento canonico completo — file KB, intervallo
di righe, `contentHash` `sha256:…` — tramite `SourceCitation.astro`, e il link alla
fonte ufficiale esterna quando esiste.

Le quattro dimensioni di stato restano **sempre separate**, mai collassate in
un'unica badge: disponibilità documentale, efficacia/ruolo storico, presenza
nell'annualità successiva, stato della ricerca. Le tre motivazioni di assenza
restano distinte: *non documentato*, *non applicabile*, *non ancora valutato*.

Dove la ricerca d'archivio è dichiaratamente incompleta il sito lo scrive: per **46
dei 65 record** del registro la ricerca risulta non conclusa, e la homepage riporta
questo numero invece di una metrica lusinghiera.

### 1.5 Navigazione e browsing del corpus

Navigazione principale su cinque sezioni, indici di sezione, timeline per annualità,
tabelle di registro con scorrimento orizzontale controllato su mobile, permalink
stabili basati sugli ID diagnostici.

---

## 2. Perimetro dei gate di rilascio

I 19 gate diagnostici **non sono stati rimossi**: continuano a essere calcolati e
riportati. Sono però classificati esplicitamente. Il verdetto di rilascio dipende
solo dai **12 gate bloccanti** che ricadono nei quattro ambiti autorizzati:

1. immutabilità e integrità documentale delle quattro KB;
2. correttezza della provenienza KB 01 → KB 04;
3. conservazione dello stato *provisional* e delle dimensioni dichiarate;
4. containment e risoluzione dei riferimenti canonici necessari alle citazioni.

Gli altri 7 gate restano osservazioni diagnostiche: una regressione va indagata, non
blocca il rilascio. Prosa, README, footer, wording e cosmesi non compaiono fra i
criteri bloccanti.

```
VERDETTO DI RILASCIO (12 gate bloccanti): PASS
VERDETTO DIAGNOSTICO COMPLETO (19 gate):  PASS
```

---

## 3. Governance applicata

- **Licenza software:** MIT, `Copyright (c) 2026 Fonti del Palio contributors`.
  La licenza copre il codice, non `content/kb/` né gli atti originali.
- **NOTICE.md:** Pistakkio® accreditata come ideatrice tecnica e curatrice del
  progetto, non come titolare esclusiva del copyright.
- **Descrizione pubblica** (verbatim): *Fonti del Palio is a free, non-profit civic
  and documentary side project by Fabrizio Gabrielli, founder of Pistakkio®.*
- **Repository:** `github.com/dragomanno/fonti-del-palio`, pubblico dal rilascio M1. Segnalazioni e contributi pubblici benvenuti;
  le modifiche editoriali e di repository finali restano sotto il controllo di
  Fabrizio Gabrielli.
- Footer invariati: *Fonti del Palio — un progetto non-profit di Fabrizio Gabrielli.*
  / *Made with Love 💚 by Pistakkio®*.

---

## 4. Verifica su estrazione pulita

Eseguita in `/tmp` da ZIP fresco, senza `.env` (i default pubblici non segreti
arrivano da `config/public-defaults.json`):

| Passo | Esito |
| --- | --- |
| `npm ci` | OK |
| `npm run check` | Validazione completata senza errori bloccanti |
| `npm test` | **107 test, 107 pass, 0 fail** |
| `npm run build` | 710 chunk · 116 pagine · sitemap 116 URL · Pagefind 115 pagine / 4.346 parole |
| Determinismo indice | SHA-256 identico all'ambiente di sviluppo |

### Immutabilità delle KB canoniche

Confronto byte a byte con i file originali caricati: **tutti e quattro identici**.

```
ff9c63de4ea9001aeddbcb97fb0b806ffec22b5cba28d215be4b6a5317db0cb3  01_KB_Corpus_Storico_Protocollo_Equino_2012_2026.md
6d7282df3c67322001646dc5127f7db3b4983dba8238c273a6ee849acb8c0979  02_KB_Memoria_Incrementale_Protocollo_Equino_2012_2026.md
a5ab22da9ec7ead082f523ca7c242794ac51cb744424f911acd91f25f750fc1a  03_KB_Disciplina_Vigente_Consolidata_2026.md
81f3e58ee026943c347a3f787382fca1d4c228803594fe20b70a6d6fa0297b89  04_KB_Manifest_Fonti_e_Registro_Atti_2012_2026.md
```

---

## 5. Limiti dichiarati del candidato

- Le 9 mappature KB 01 → KB 04 su `yearOnlyFallback` restano **provvisorie**. Per
  2013 e 2020 il campo Atto di KB 04 riporta un numero esplicito, ma l'evidenza non
  è stata promossa senza verifica manuale.
- Per 46 record del registro la ricerca d'archivio è dichiaratamente non conclusa.
- Le pagine legali (`/disclaimer`, `/privacy`, `/metodologia`) rendono i file
  markdown esistenti: la revisione editoriale completa è M3.
- Verifica mobile eseguita sulle pagine principali, non ancora su tutte (M4).
- `npm audit` segnala 13 advisory (1 low, 12 high) su **due catene distinte e
  indipendenti**, descritte in dettaglio in `SECURITY.md`:
  - **catena Astro** (`astro` → `sharp`, `esbuild`): la remediation richiede
    `astro@7.1.3`, un aggiornamento semver-major escluso dal mandato. Nessuna delle
    funzionalità interessate dagli advisory è usata dal progetto e la build è
    interamente statica, senza runtime server;
  - **catena Netlify** (`@netlify/functions` → `@netlify/zip-it-and-ship-it` → …):
    remediation disponibile senza salto di major, ma la catena serve solo al
    bundling delle Netlify Functions, non deployate. Rinviata a M5.
  Nessuna delle due catene entra nell'artefatto statico servito agli utenti.
- Nessun deploy Netlify eseguito: è M5.

---

## 6. Prossimo passo

Il candidato M1 è stato accettato. La preparazione del rilascio v0.1.0 —
documentazione pubblica allineata, canonical e og:url auto-referenziali, sitemap
completa — è descritta in `CHANGELOG_v0.1.0.md`.
