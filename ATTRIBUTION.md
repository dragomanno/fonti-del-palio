# Attribuzione delle fonti

I contenuti pubblicati su Fonti del Palio derivano dalle quattro Knowledge Base canoniche in `content/kb/`, curate a partire da atti pubblici relativi al Protocollo Equino del Palio di Siena (deliberazioni di Giunta Comunale, ordinanze sindacali, protocolli di addestramento, regolamenti) per il periodo 2012-2026.

## Cosa espone ogni pagina generata (v0.1.0)

Le pagine per singola sezione di disciplina, annualità, atto e record di fonte **sono implementate** e generate dall'indice di produzione. Ogni unità documentale pubblicata riporta:

- **il documento di origine**: il file KB di provenienza e lo scope documentale;
- **la porzione esatta di testo citata**: intervallo di righe `startLine`–`endLine` nel file canonico;
- **l'impronta del contenuto**: `contentHash` in forma `sha256:…`, che lega la citazione al testo esatto e ne rende verificabile l'integrità;
- **l'anno o l'annualità di riferimento**, dove applicabile;
- **il collegamento alla fonte ufficiale esterna**, quando esiste ed è noto;
- **lo stato documentale secondo quattro dimensioni separate**, mai un'unica etichetta:
  - disponibilità documentale (`documentaryStatus`),
  - ruolo storico o efficacia legale (`legalStatus`),
  - presenza nell'annualità successiva (`presenceStatus`),
  - stato della ricerca sulle fonti (`researchStatus`).

Quando una dimensione non ha valore, la pagina **dichiara il motivo** invece di lasciare un vuoto o di inventare uno stato. Le tre motivazioni ammesse restano distinte e non vengono collassate in un'unica formula: *non documentato*, *non applicabile*, *non ancora valutato*.

Il contratto a quattro dimensioni è verificato dai gate diagnostici bloccanti e dal gate `productionIndexMatchesCanonicalCorpus`, che confronta ogni chunk pubblicato con il candidato diagnostico corrispondente per hash, righe, file e scope: le pagine pubbliche non possono divergere dalle fonti canoniche senza far fallire la build.

## Provenienza provvisoria e ricerca incompleta

Il progetto dichiara i propri limiti invece di nasconderli.

- **133 chunk** hanno almeno una provenienza **provvisoria** (mappatura KB 01 → KB 04 risolta per sola annualità, `yearOnlyFallback`): sono marcati come tali e non vengono promossi a "verificati" senza controllo manuale documentato.
- Per **46 dei 65 record** del registro delle fonti la ricerca d'archivio è **dichiaratamente non conclusa**. Il numero è esposto in homepage, non nascosto.
- Quattro record LEG-GAP (2012, 2013, 2015, 2018) riportano letteralmente che la ricerca nell'Albo Pretorio e negli archivi è da completare.

## Titolarità

Il curatore di questo progetto non rivendica alcuna titolarità sugli atti amministrativi originali. La provenienza istituzionale di ciascun atto (ente emanante, tipo di atto, data) è indicata dove nota nella KB 04; questo progetto ne organizza, classifica e indicizza il contenuto pubblicamente accessibile, **senza modificarne il testo**.

La licenza software ([`LICENSE`](./LICENSE), **MIT**, `Copyright (c) 2026 Fonti del Palio contributors`) copre **esclusivamente il codice** di questo repository. Non copre:

- il contenuto dei quattro file in `content/kb/`;
- gli atti amministrativi originali, che restano soggetti al proprio regime giuridico.

Pistakkio® è accreditata come ideatrice tecnica e curatrice del progetto; questo credito non implica titolarità sul corpus documentale né alcun ruolo di autorità istituzionale. Vedi [`NOTICE.md`](./NOTICE.md).

## Assistente AI

L'assistente AI opzionale ("Chiedi alle fonti") **non è implementato** in v0.1.0 e non è previsto prima dell'approvazione esplicita della milestone M6. Se e quando sarà attivato, ogni risposta generata dovrà citare esclusivamente le fonti effettivamente recuperate dal sistema di ricerca, con collegamento verificabile al passaggio esatto della fonte canonica. Questo requisito non è negoziabile e precede l'implementazione.

## Le quattro Knowledge Base canoniche sono immutabili

I quattro file in `content/kb/` sono trattati come fonti canoniche immutabili da questo repository e dagli strumenti che lo accompagnano (parser, diagnostica, chunker di produzione). Nessuno script in `scripts/` scrive né modifica questi file. Le loro impronte SHA-256 sono verificate a ogni rilascio e pubblicate in [`README.md`](./README.md).

Qualunque correzione, aggiornamento o integrazione al loro contenuto richiede una decisione esplicita e documentata di Fabrizio Gabrielli — vedi la sezione "Politica di modifica delle KB canoniche" in [`CONTRIBUTING.md`](./CONTRIBUTING.md) per la procedura completa.
