# Fonti del Palio

Progetto pubblico, indipendente e non ufficiale per rendere consultabile il corpus documentale del **Protocollo Equino del Palio di Siena**.

> Fonti del Palio is a free, non-profit civic and documentary side project by Fabrizio Gabrielli, founder of Pistakkio®.

Questo progetto **non è affiliato, autorizzato o approvato dal Comune di Siena**, dal Magistrato delle Contrade o da alcun ente ufficiale legato al Palio. Non utilizza loghi, stemmi o segni distintivi del Comune di Siena. Vedi [`DISCLAIMER.md`](./DISCLAIMER.md).

## Stato del progetto

**v0.1.0 — milestone M1: prodotto documentario statico.**

Il sito statico è completo e funzionante: chunker di produzione, pagine documentarie
reali, ricerca locale Pagefind, citazioni canoniche visibili, navigazione dell'intero
corpus. Non esiste alcun layer AI, e non è previsto prima dell'approvazione esplicita
della milestone M6.

| Milestone | Stato |
| --- | --- |
| Decisioni architetturali (12 punti) | completata |
| Scaffold del repository | completata |
| Diagnostica di chunking read-only | **congelata alla v3.1.3** come baseline interna |
| M0 — indice di contenuto di produzione validato | completata |
| M1 — pagine statiche core | completata |
| M2 — ricerca documentale locale (Pagefind) | completata, anticipata a M1 |
| M3 — pagine legali/editoriali complete | non iniziata |
| M4 — accessibilità, metadati, anteprime social | parziale (canonical, og:url e sitemap fatti in v0.1.0) |
| M5 — Netlify Deploy Preview con AI disabilitata | non iniziata |
| M6 — revisione e approvazione esplicita | non iniziata |
| Fase AI (A1–A4) | **non implementata**, `netlify/functions/ask.ts` è un segnaposto inerte |

Dettaglio per milestone in [`data/static-site-milestone-plan.md`](./data/static-site-milestone-plan.md);
sintesi del candidato in [`CANDIDATO_M1.md`](./CANDIDATO_M1.md).

## Cifre della v0.1.0

| Grandezza | Valore |
| --- | --- |
| Chunk di produzione | **710** (kb01 273, kb02 183, kb03 170, kb04 84) |
| Chunk con rotta pubblica | 704 |
| Chunk con provenienza provvisoria marcata | 133 |
| Pagine HTML generate | **116** |
| Pagine pubbliche indicizzabili | **116** |
| URL nella sitemap | **116** |
| Sezioni della disciplina vigente | 8 |
| Annualità storiche | 15 (2012–2026) più la pagina delle tabelle storiche |
| Atti | 17 |
| Record di fonte | **65**, più l'indice delle fonti |
| Pagine nell'indice Pagefind | 115 (`/ricerca/` è esclusa dal proprio indice) |
| Parole indicizzate da Pagefind | **4.346** |

Verifica della ricerca sul `dist` servito staticamente, senza rete esterna:

| Query | Risultati | Primo risultato |
| --- | --- | --- |
| previsite | 41 | `/disciplina-vigente/previsite-tratta-2026/` |
| PE-2019-01 | 6 | `/fonti/pe-2019-01/` |
| farmaci controllati | **33** | `/disciplina-vigente/ordinanza-6-2026/` |
| articolo 37 | 21 | `/fonti/leg-2019-sper-3738/` |

## Stack tecnico

- **Sito statico:** Astro 5 + TypeScript, `output: "static"`, `build.format: "directory"`.
- **Ricerca documentale locale:** Pagefind 1.5, indice costruito su `dist/` in coda a
  `npm run build`. Interamente lato client, nessuna chiamata di rete esterna.
- **Font:** self-hosted via `@fontsource` (Fraunces, Inter, JetBrains Mono). Nessuna
  richiesta a Google Fonts o ad altri CDN.
- **Sitemap:** generata dall'output reale della build, non mantenuta a mano.
- **Assistente AI (v1.1, opzionale):** **non implementato.** `netlify/functions/ask.ts`
  è un segnaposto architetturale inerte; `npm run embeddings:build` esce con codice 1
  per costruzione. Nessuna chiave API nel browser o nel repository.

## Struttura del repository

```text
/
├── content/kb/              # Le 4 fonti canoniche, immutabili (mai riscritte)
├── config/                  # Default pubblici non segreti (public-defaults.json)
├── data/                    # Indice di produzione + report diagnostici storici
├── scripts/                 # Chunker di produzione, diagnostica read-only,
│                            #   validazione env, generatore di sitemap
├── src/                     # Sito Astro (pagine, componenti, lib, stili)
├── netlify/functions/       # Endpoint server-side (ask.ts inerte, health.ts)
└── tests/                   # Test di regressione: diagnostica di parsing,
                             #   determinismo della build, output di rilascio
```

## Sviluppo locale

```bash
npm ci
cp .env.example .env       # opzionale — mai committare .env
npm run dev                # anteprima di sviluppo (senza indice Pagefind)
npm run build              # build completa: indice, pagine, sitemap, Pagefind
npm run preview            # anteprima della build statica, con ricerca funzionante
```

`.env` non è necessario per costruire il sito: i default pubblici non segreti
(`PUBLIC_SITE_NAME`, `PUBLIC_SITE_URL`) sono committati in
[`config/public-defaults.json`](./config/public-defaults.json). Le variabili
d'ambiente, se presenti, hanno sempre la precedenza.

In `astro dev` la directory `/pagefind/` non esiste: la pagina `/ricerca` mostra
un fallback navigabile invece di fallire in silenzio. Per provare la ricerca reale
usare `npm run build && npm run preview`.

## Comandi

| Comando | Effetto |
| --- | --- |
| `npm run check` | Validazione variabili d'ambiente + `tsc --noEmit` |
| `npm test` | Suite completa di test di regressione |
| `npm run build` | env → indice di produzione → Astro → sitemap → Pagefind |
| `npm run index:build` | Solo il chunker di produzione |
| `npm run sitemap:build` | Solo la sitemap, su un `dist/` esistente |
| `npm run chunk:diagnostic` | Diagnostica read-only sui 4 file KB canonici |
| `npm run embeddings:build` | Esce con codice 1 per costruzione (nessun layer AI) |

## Fonti canoniche e citazioni

I quattro file in `content/kb/` sono fonti canoniche **immutabili**: non vengono
tradotti, riscritti né modificati da alcuno script del repository. Le loro impronte
SHA-256, verificate a ogni rilascio:

```text
ff9c63de4ea9001aeddbcb97fb0b806ffec22b5cba28d215be4b6a5317db0cb3  01_KB_Corpus_Storico_Protocollo_Equino_2012_2026.md
6d7282df3c67322001646dc5127f7db3b4983dba8238c273a6ee849acb8c0979  02_KB_Memoria_Incrementale_Protocollo_Equino_2012_2026.md
a5ab22da9ec7ead082f523ca7c242794ac51cb744424f911acd91f25f750fc1a  03_KB_Disciplina_Vigente_Consolidata_2026.md
81f3e58ee026943c347a3f787382fca1d4c228803594fe20b70a6d6fa0297b89  04_KB_Manifest_Fonti_e_Registro_Atti_2012_2026.md
```

Ogni chunk pubblicato espone il riferimento canonico completo — file KB, intervallo
di righe, `contentHash` `sha256:…` — e il collegamento alla fonte ufficiale esterna
quando esiste. Le quattro dimensioni di stato restano **sempre separate** e mai
collassate in un'unica etichetta: disponibilità documentale, efficacia o ruolo
storico, presenza nell'annualità successiva, stato della ricerca. Le tre motivazioni
di assenza restano distinte: *non documentato*, *non applicabile*, *non ancora
valutato*. Vedi [`ATTRIBUTION.md`](./ATTRIBUTION.md).

Dove la ricerca d'archivio è incompleta il sito lo dichiara: per **46 dei 65 record**
del registro la ricerca risulta non conclusa, e questo numero è esposto in homepage.

## Diagnostica di chunking (congelata alla v3.1.3)

```bash
npm run chunk:diagnostic
```

`scripts/chunk-diagnostic.mjs` legge i 4 file KB, produce un inventario di candidati
con `contentHash` SHA-256 deterministico, un ledger di copertura riga per riga e 19
gate di accettazione. Il chunker di produzione riusa lo stesso parser: non esistono
due parser divergenti.

I 19 gate sono classificati esplicitamente. Il **verdetto di rilascio** dipende solo
dai **12 gate bloccanti**, limitati a quattro ambiti:

1. immutabilità e integrità documentale delle quattro KB;
2. correttezza della provenienza KB 01 → KB 04;
3. conservazione dello stato *provisional* e delle dimensioni dichiarate;
4. containment e risoluzione dei riferimenti canonici necessari alle citazioni.

Gli altri 7 gate restano osservazioni diagnostiche: una regressione va indagata, non
blocca il rilascio. Prosa, README, footer, wording e cosmesi non sono criteri
bloccanti di rilascio.

Storico congelato: `data/chunk-diagnostic-report-v3.1.1.md`, `-v3.1.2.md`,
`-v3.1.3.md` e i rispettivi `CHANGELOG_v3.1.*.md` / `VERDETTO_FINALE_v3.1.*.md`.
Questi documenti non vengono riscritti a posteriori.

L'universo osservato dei candidati è di **12 famiglie** (file × candidateType). Il
mutation test di inserimento copre tutte e 12 le famiglie; la variante di inserimento
*adiacente*, più stringente, ne copre **10 su 12**: `kb01:sezioneSemantica` e
`kb02:sezioneSemantica` iniziano subito dopo contenuto non vuoto, quindi non esiste
una riga bianca precedente in cui inserire restando provatamente all'esterno del
candidato.

## Canonical, sitemap e metadati

- Ogni pagina indicizzabile espone **un solo** `<link rel="canonical">`, assoluto e
  auto-referenziale, derivato dalla rotta effettivamente generata
  (`Astro.url.pathname`) e non dallo stato di navigazione del menu.
- `og:url` coincide sempre con il canonical.
- Politica trailing slash: `build.format: "directory"`, ogni URL termina con `/`
  (la home resta `/`).
- La sitemap è derivata dai file HTML realmente prodotti in `dist/`, esclude le
  pagine `noindex`, le pagine di errore, gli asset Pagefind e ogni artefatto non-HTML.
  Nessun conteggio atteso è scritto nel codice.
- `public/robots.txt` dichiara la sitemap.

Questi invarianti sono coperti da `tests/release-output.test.mjs`.

## Sicurezza delle dipendenze

`npm audit` segnala advisory su **due catene distinte e indipendenti**, descritte in
dettaglio in [`SECURITY.md`](./SECURITY.md). In sintesi:

- **Catena Astro** (`astro` → `esbuild`, `sharp`): la remediation richiede
  `astro@7.1.3`, un aggiornamento semver-major escluso dal perimetro di questo
  rilascio. Nessuna delle funzionalità interessate dagli advisory è usata dal
  progetto.
- **Catena Netlify** (`@netlify/functions` → `@netlify/zip-it-and-ship-it` → …):
  remediation disponibile senza salto di major, ma la catena serve esclusivamente
  al bundling delle Netlify Functions, che non sono ancora deployate. Rinviata a M5.

Nessuna delle due catena entra nell'artefatto statico servito agli utenti.

## Governance e responsabilità editoriale

Fonti del Palio è un progetto civico, documentario e non-profit di Fabrizio Gabrielli,
fondatore di [Pistakkio®](https://www.pistakkio.net/), nato come servizio alla Città
di Siena e alla comunità interessata allo studio del Protocollo Equino.

Il repository è [`github.com/dragomanno/fonti-del-palio`](https://github.com/dragomanno/fonti-del-palio),
**pubblico dal rilascio della milestone M1**. Segnalazioni pubbliche e contributi sono
benvenuti: si possono segnalare errori, documenti mancanti, discrepanze nelle fonti e
proporre integrazioni. Le segnalazioni costituiscono proposte di revisione; **le
modifiche editoriali finali e quelle al repository restano sotto il controllo di
Fabrizio Gabrielli**, così come la selezione e la validazione delle fonti e
l'integrazione dei contenuti nelle Knowledge Base canoniche.

Pistakkio® è accreditata come **ideatrice tecnica e curatrice** del progetto
(*technical originator and curator*), non come titolare esclusiva del copyright. Il
credito nel footer del sito — "Made with Love 💚 by Pistakkio®" — descrive un
contributo tecnico fattuale e non implica la titolarità del corpus documentale, delle
fonti originali o delle Knowledge Base canoniche, né alcun ruolo di autorità
istituzionale su di esse. Vedi [`NOTICE.md`](./NOTICE.md) e
[`CONTRIBUTING.md`](./CONTRIBUTING.md).

La pubblicità del repository non implica che l'intero contenuto sia open source: la
licenza del codice e le condizioni applicabili al corpus documentale restano distinte.

## Licenza

Codice sorgente: **MIT** — `Copyright (c) 2026 Fonti del Palio contributors`. Vedi
[`LICENSE`](./LICENSE).

La licenza copre esclusivamente il software di questo repository. **Non** copre i
contenuti in `content/kb/` né gli atti amministrativi originali, che restano soggetti
al proprio regime giuridico. Vedi [`ATTRIBUTION.md`](./ATTRIBUTION.md) e
[`NOTICE.md`](./NOTICE.md).
