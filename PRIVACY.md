# Privacy

## Versione 0.2.0 — sito statico documentale

Il sito è interamente statico. Non richiede account, non ha moduli di contatto, non
utilizza cookie di tracciamento o di profilazione, non integra analytics e non carica
risorse da CDN o servizi di terze parti.

In particolare:

- **Font self-hosted.** I caratteri (Fraunces, Inter, JetBrains Mono) sono serviti dal
  sito stesso tramite `@fontsource`. Nessuna richiesta a Google Fonts o ad altri
  fornitori esterni.
- **Ricerca documentale locale attiva.** La ricerca interna (Pagefind) **è
  implementata e funzionante** in questa versione. Funziona interamente lato client:
  l'indice statico viene scaricato dallo stesso sito e le interrogazioni **non lasciano
  mai il browser**. Nessuna interrogazione viene inviata a un server, registrata o
  conservata.
- **Nessuno script di terze parti.** L'unico codice eseguito nel browser è servito da
  questo sito: il runtime della ricerca e uno script di apertura dei gruppi di menu.
  Quest'ultimo non legge né scrive alcun dato persistente.
- **Nessun identificativo proprio.** Il sito non imposta cookie propri, non usa
  `localStorage` per profilare l'utente e non genera identificativi persistenti.

Questo non significa che nessun dato venga trattato: l'hosting elabora
transitoriamente l'indirizzo IP e i log di accesso standard per ogni richiesta HTTP,
secondo la propria politica di conservazione, indipendentemente dalle impostazioni di
questo progetto. Il sito è pubblicato su **Netlify**, che opera come fornitore di
hosting e gestisce i log di richiesta secondo le proprie condizioni. Questo progetto
non consulta, non esporta e non conserva quei log.

## Dati personali nei documenti pubblicati

Il sito ripubblica file originali di atti pubblici. Prima di ripubblicare un file, il
progetto verifica che la sua diffusione sia coerente con la funzione informativa del
sito e che non comporti la diffusione di dati personali non necessari.

Quando questa condizione non è soddisfatta, il documento **non viene ripubblicato**:
il sito espone la scheda documentaria — estremi, funzione, esito, digest — e dichiara
in pagina il motivo. È il caso del visto di regolarità contabile
`ATT-2026-VIS-1775`, il cui file contiene dati identificativi e recapiti di fornitori
non necessari alla comprensione dell'atto: la scheda è pubblica, il file no. La regola
è applicata dal generatore dell'indice ed è verificata da un controllo automatico, non
affidata alla diligenza di chi pubblica.

Per chiedere la rimozione o la rettifica di un dato personale presente in un documento
ripubblicato, scrivere a [info@pistakkio.net](mailto:info@pistakkio.net) indicando la
rotta e il documento. Le richieste fondate sono evase rimuovendo il file e mantenendo
la sola scheda documentaria, con dichiarazione in pagina della rimozione.

## Versione 1.1 — assistente AI opzionale ("Chiedi alle fonti")

**Non implementato.** `netlify/functions/ask.ts` è un segnaposto inerte, `AI_ENABLED`
è `false` per default e `npm run embeddings:build` esce con codice 1 per costruzione.
Nessun endpoint AI è raggiungibile in v0.2.0.

La sezione che segue descrive il comportamento **previsto** e non ancora attivo.
Sarà attivata solo dopo l'approvazione esplicita della milestone M6 e della relativa
fase AI (A1–A4), e questa informativa sarà verificata e aggiornata **prima**
dell'attivazione, non dopo.

Quando e se attivo, l'assistente AI:

- non richiederà login né raccoglierà identità personali;
- se la protezione Cloudflare Turnstile è attiva sull'endpoint, imposterà un
  cookie/token funzionale necessario alla verifica anti-bot, dichiarato qui solo
  quando effettivamente in uso;
- genererà un identificativo pseudonimo giornaliero (HMAC, non l'indirizzo IP in
  chiaro) usato solo per applicare i limiti di richieste giornaliere, non conservato
  oltre la finestra di rate-limiting;
- elaborerà transitoriamente l'indirizzo IP della richiesta ai soli fini del calcolo
  del limite anti-abuso (per IP al giorno, al minuto, limite globale); l'IP in chiaro
  non sarà conservato in forma persistente, solo l'identificativo pseudonimo derivato;
- se e quando l'integrazione con un fornitore di modello linguistico (OpenAI) sarà
  effettivamente attiva, invierà il testo della domanda dell'utente e i passaggi delle
  fonti recuperate a quel fornitore per generare la risposta; le condizioni di
  conservazione dati del fornitore saranno verificate e riportate qui prima
  dell'attivazione in produzione, e non vengono assunte o dichiarate in anticipo;
- non salverà cronologie di conversazione persistenti collegate a un utente
  identificabile.

## Contatti

Per domande su questa informativa, o per segnalare un problema di privacy, scrivere a
[info@pistakkio.net](mailto:info@pistakkio.net) oppure aprire una issue sul repository
[`github.com/dragomanno/fonti-del-palio`](https://github.com/dragomanno/fonti-del-palio).

Le modifiche a questa informativa sono registrate nel
[changelog](/changelog/) della versione in cui sono state introdotte.
