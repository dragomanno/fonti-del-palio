# Come contribuire a Fonti del Palio

Fonti del Palio è un progetto gratuito, senza scopo di lucro e senza
finalità commerciali. Dal rilascio della milestone M1 (v0.1.0) il
repository è **pubblico** su GitHub e aperto a segnalazioni e contributi.

Le decisioni di governance sono chiuse: codice sorgente sotto licenza
**MIT** (`Copyright (c) 2026 Fonti del Palio contributors`), Pistakkio®
accreditata come ideatrice tecnica e curatrice del progetto, non come
titolare esclusiva del copyright. Vedi `LICENSE` e `NOTICE.md`.

Segnalazioni e proposte sono benvenute, ma **le modifiche editoriali
finali e quelle al repository restano sotto il controllo di Fabrizio
Gabrielli**: una segnalazione è una proposta di revisione, non una
modifica applicata.

## Prima di contribuire

1. Leggi `NOTICE.md` e `ATTRIBUTION.md` per capire la distinzione tra
   codice del sito, contenuti canonici e attribuzione delle fonti.
2. Leggi `README.md` per lo stato reale del progetto: cosa è implementato
   (chunker di produzione, pagine documentarie, ricerca Pagefind,
   citazioni canoniche) e cosa non lo è (nessun layer AI).
3. Se proponi una modifica che tocca `content/kb/`, leggi prima la sezione
   "Politica di modifica delle KB canoniche" più sotto: quei quattro file
   NON si modificano con una normale pull request.

## Tipi di contributo accettati

- Correzioni al codice del sito (`src/`, `scripts/`, `netlify/functions/`,
  `tests/`): bug fix, miglioramenti di accessibilità, performance, chiarezza.
- Miglioramenti alla suite di test (`tests/`) — sempre benvenuti, specie se
  rendono più severa la verifica di comportamento esistente.
- Segnalazioni di problemi tramite le issue di GitHub (vedi i template in
  `.github/ISSUE_TEMPLATE/`).
- Proposte di correzione ai contenuti delle KB canoniche — SOLO tramite
  issue, mai tramite pull request diretta sui file in `content/kb/` (vedi
  sotto).

## Politica di modifica delle KB canoniche

I quattro file in `content/kb/`:

- `01_KB_Corpus_Storico_Protocollo_Equino_2012_2026.md`
- `02_KB_Memoria_Incrementale_Protocollo_Equino_2012_2026.md`
- `03_KB_Disciplina_Vigente_Consolidata_2026.md`
- `04_KB_Manifest_Fonti_e_Registro_Atti_2012_2026.md`

sono **fonti canoniche immutabili** per questo repository. Questo significa:

1. **Nessuna pull request può modificare direttamente questi quattro file.**
   Qualunque PR che tocchi `content/kb/*.md` viene rifiutata a prescindere
   dal merito del contenuto proposto, finché non segue la procedura sotto.
2. **Il modo corretto di proporre una correzione** è apire una issue con il
   template "Segnalazione contenuto KB" (vedi
   `.github/ISSUE_TEMPLATE/kb-content-report.md`), indicando: il file KB, la
   riga o sezione, il contenuto attuale, la correzione proposta e — dove
   possibile — la fonte primaria (atto amministrativo, delibera, protocollo)
   che la supporta.
3. **Solo Fabrizio Gabrielli decide se e come integrare** la correzione nelle
   KB canoniche, tipicamente aggiornando la fonte primaria fuori da questo
   repository e poi sostituendo il file KB corrispondente in un commit
   dedicato e tracciabile, mai silenziosamente all'interno di una PR che
   contiene anche altre modifiche.
4. **Gli strumenti di questo repository (parser, diagnostica di chunking,
   chunker di produzione) trattano le quattro KB come input di sola
   lettura.** Nessuno script in `scripts/` scrive su `content/kb/`.
   Qualunque futura funzionalità che permetta la modifica assistita delle
   KB dovrà essere proposta, discussa e approvata esplicitamente prima
   dell'implementazione — non è nello scope attuale.

Questa politica esiste per preservare l'affidabilità documentale del
progetto: gli utenti di Fonti del Palio devono poter contare sul fatto che
il contenuto delle KB canoniche cambia solo tramite un processo deliberato
e tracciabile, non per effetto di una pull request di codice.

## Segnalare un problema

Usa i template delle issue in `.github/ISSUE_TEMPLATE/`:

- **Bug di codice** — comportamento del sito o degli script diverso da
  quanto documentato o testato.
- **Segnalazione contenuto KB** — proposta di correzione al contenuto delle
  quattro Knowledge Base canoniche (vedi politica sopra).
- **Proposta di funzionalità** — nuove funzionalità o miglioramenti non
  legati a un bug specifico.

## Requisiti minimi per una pull request

- `npm run check` deve passare senza errori (validazione variabili
  d'ambiente + `tsc --noEmit`).
- `npm test` deve passare senza fallimenti.
- `npm run build` deve completare senza errori.
- Se la modifica cambia il comportamento di `scripts/chunk-diagnostic.mjs`,
  di `scripts/build-content-index.mjs` o dei loro moduli in `scripts/lib/`,
  aggiungi o aggiorna i test corrispondenti — non limitarti ad adattare le
  asserzioni esistenti per farle coincidere con il nuovo comportamento
  senza spiegarne la motivazione nella descrizione della PR. In
  particolare: **non si indebolisce, rimuove o aggira un'asserzione che
  fallisce per ottenere una suite verde.**
- Se la modifica tocca il layout, le rotte o i metadati, deve continuare a
  passare `tests/release-output.test.mjs`: un solo canonical assoluto e
  auto-referenziale per pagina, `og:url` coincidente, sitemap uguale
  all'insieme delle rotte pubbliche indicizzabili, nessun duplicato.
- Ogni nuova pagina deve usare `BaseLayout`. Il canonical è derivato dalla
  rotta generata: `activePath` governa **solo** l'evidenziazione del menu e
  non va usato come identità del documento.
- Ogni nuova pagina che deve comparire nella ricerca interna deve esporre
  `<main data-pagefind-body>` (lo fa `BaseLayout` di default): senza quel
  marcatore Pagefind la esclude silenziosamente dall'indice.
- Non toccare `content/kb/*.md` (vedi politica sopra).
- Non implementare embeddings, retrieval o l'endpoint AI
  (`netlify/functions/ask.ts`) prima dell'approvazione esplicita della
  milestone M6 — vedi `data/static-site-milestone-plan.md`.
- Non eseguire `npm audit fix` né `npm audit fix --force`: applicano
  aggiornamenti major senza valutazione. Vedi `SECURITY.md`.

## Codice di condotta

Non esiste ancora un `CODE_OF_CONDUCT.md` dedicato. Nel frattempo, vale la
regola generale: contributi rispettosi, commenti orientati al merito
tecnico o documentale, nessuna discussione personale. Un codice di condotta
formale (es. basato su Contributor Covenant) sarà aggiunto quando il
progetto riceverà i primi contributi esterni pubblici.

## Gate bloccanti di rilascio

Non tutti i controlli automatici hanno lo stesso peso. Il verdetto di
rilascio dipende dai **12 gate bloccanti** della diagnostica, limitati a
quattro ambiti:

1. immutabilità delle quattro KB canoniche;
2. correttezza della provenienza KB 01 → KB 04;
3. conservazione dello stato *provisional*;
4. containment e risoluzione dei riferimenti canonici necessari alle
   citazioni.

Gli altri 7 gate sono osservazioni diagnostiche: una regressione va
indagata e spiegata, ma non blocca il rilascio. Prosa, README, footer,
commenti, wording e cosmesi sono normale manutenzione editoriale, non
criteri bloccanti.
