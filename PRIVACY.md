# Privacy

## Versione 0.1.0 — sito statico documentale

Il sito è interamente statico. Non richiede account, non ha moduli di contatto, non
utilizza cookie di tracciamento o di profilazione, non integra analytics e non carica
risorse da CDN o servizi di terze parti.

In particolare:

- **Font self-hosted.** I caratteri (Fraunces, Inter, JetBrains Mono) sono serviti dal
  sito stesso tramite `@fontsource`. Nessuna richiesta a Google Fonts o ad altri
  fornitori esterni.
- **Ricerca documentale locale attiva.** La ricerca interna (Pagefind) **è
  implementata e funzionante** in questa versione. Funziona interamente lato client:
  l'indice statico viene scaricato dallo stesso sito e le query **non lasciano mai il
  browser**. Nessuna query viene inviata a un server, registrata o conservata.
- **Nessun identificativo proprio.** Il sito non imposta cookie propri, non usa
  `localStorage` per profilare l'utente e non genera identificativi persistenti.

Questo non significa che nessun dato venga trattato: l'hosting elabora
transitoriamente l'indirizzo IP e i log di accesso standard per ogni richiesta HTTP,
secondo la propria politica di conservazione, indipendentemente dalle impostazioni di
questo progetto. Al momento della v0.1.0 **non è stato effettuato alcun deploy** su
hosting pubblico: il deploy su Netlify è la milestone M5 e questa sezione sarà
verificata e aggiornata prima della messa online.

## Versione 1.1 — assistente AI opzionale ("Chiedi alle fonti")

**Non implementato.** `netlify/functions/ask.ts` è un segnaposto inerte, `AI_ENABLED`
è `false` per default e `npm run embeddings:build` esce con codice 1 per costruzione.
Nessun endpoint AI è raggiungibile in v0.1.0.

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

Per domande su questa informativa, o per segnalare un problema di privacy, aprire una
issue sul repository
[`github.com/dragomanno/fonti-del-palio`](https://github.com/dragomanno/fonti-del-palio).
