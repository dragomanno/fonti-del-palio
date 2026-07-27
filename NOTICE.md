# Notice

Questo repository contiene:

1. **Codice sorgente** del sito Fonti del Palio (Astro, TypeScript, script di build, Netlify Functions) — licenza MIT, vedi `LICENSE`.
2. **Contenuti canonici** in `content/kb/` — le quattro Knowledge Base fornite come fonti di riferimento del progetto, non riscritte né tradotte. Il loro utilizzo è disciplinato separatamente rispetto al codice; vedi `ATTRIBUTION.md` per l'attribuzione delle fonti primarie sottostanti.
3. **Artefatti generati** in `data/` — l'indice dei chunk di produzione (`chunks.generated.json`), prodotto da `scripts/build-content-index.mjs` a partire dai file in `content/kb/`, e gli artefatti della diagnostica di chunking read-only (`chunk-diagnostic-report.json`, `diagnostic-candidates.json`, `coverage-ledger.json`). Tutti riproducibili in modo deterministico. **Non esistono in questo repository embeddings né alcun layer AI:** nessuno script genera embeddings e `netlify/functions/ask.ts` resta un placeholder inerte.

Il progetto non rivendica alcuna ufficialità. Vedi `DISCLAIMER.md`.

## Licenza e titolare del copyright

Il codice sorgente è rilasciato sotto **licenza MIT**, con la seguente nota di copyright:

```
Copyright (c) 2026 Fonti del Palio contributors
```

Questa è una decisione presa e documentata, non un segnaposto.

## Natura del progetto e attribuzione

Fonti del Palio è un progetto civico e documentario gratuito e non-profit di **Fabrizio Gabrielli**,
fondatore di **Pistakkio®** (https://www.pistakkio.net/), nato come servizio alla Città di Siena e
alla comunità interessata allo studio e alla comprensione del Protocollo Equino.

Descrizione pubblica di riferimento, in inglese, da usare invariata dove serve una formulazione
sintetica del progetto:

> Fonti del Palio is a free, non-profit civic and documentary side project by Fabrizio Gabrielli,
> founder of Pistakkio®.

**Pistakkio® è accreditato come ideatore tecnico e curatore tecnico del progetto**
(*technical originator and curator*): ha concepito e realizzato l'impianto tecnico del sito, degli
script di parsing e dell'infrastruttura documentale. Questo credito è fattuale e riconosciuto.

Pistakkio® **non è il titolare esclusivo del copyright**: la titolarità del codice è quella indicata
nella nota MIT sopra. Il credito tecnico non attribuisce a Pistakkio® la proprietà del corpus
documentale, delle fonti originali o delle Knowledge Base canoniche, né alcuna forma di ufficialità.

La selezione e la validazione delle fonti, così come l'integrazione dei contenuti nelle Knowledge
Base canoniche, restano sotto la **responsabilità editoriale di Fabrizio Gabrielli**.

Il footer del sito riporta il credito approvato "Made with Love 💚 by Pistakkio®".

## Repository, segnalazioni e contributi

Repository dedicato: **https://github.com/dragomanno/fonti-del-palio**

Il repository è **pubblico dal rilascio della milestone M1 (v0.1.0)**. I flussi pubblici di
segnalazione e contribuzione sono attivi.

Segnalazioni pubbliche e proposte di integrazione sono benvenute: errori, documenti mancanti,
discrepanze nelle fonti. Le segnalazioni costituiscono **proposte di revisione** e non modificano
direttamente le Knowledge Base canoniche.

**Le modifiche editoriali e di repository restano sotto il controllo finale di Fabrizio Gabrielli.**

La pubblicità del repository non implica che l'intero contenuto sia open source: la licenza del
codice sorgente (MIT, `LICENSE`) e le condizioni applicabili al corpus documentale, alle
trascrizioni, ai metadati e alle fonti documentali originali (vedi `ATTRIBUTION.md`) restano
distinte e vanno valutate separatamente.
