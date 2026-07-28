# Fonti del Palio — Rapporto di redesign (identità Media Kit)

Data: 28 luglio 2026 · Repository: `dragomanno/fonti-del-palio`, branch `main`, base `980866d`
Stato: **implementato, committato, pubblicato e verificato in produzione** su https://www.fontidelpalio.org (commit `0c8d3ec`, deploy Netlify `6a68a049f034ae11b427e190` del 28 luglio 2026, 14:28 CEST).

## 1. Componenti e file modificati (24 file, +575 / −130)

| File | Natura dell'intervento |
| --- | --- |
| `src/styles/tokens.css` | Palette scura nativa del Media Kit, scala tipografica, misura di lettura, focus ring, nuovo token `--color-border-strong` |
| `src/styles/global.css` | Riscrittura del foglio globale: link, wordmark, nav, banner, card, bottoni, tabelle scorrevoli, footer, `prose`, utility |
| `src/layouts/BaseLayout.astro` | Skip link `#contenuto`, wordmark `fontidelpalio.org` in header e footer, `<main id="contenuto">`, contatto `info@pistakkio.net` nel footer (approvato il 28 luglio) |
| `src/config/site.ts` | Origine `https://www.fontidelpalio.org`, costanti `GPT_ASSISTANT_URL` e `GPT_ASSISTANT_LABEL` |
| `src/pages/index.astro` | Hero riorganizzato: occhiello, H1 invariato, lead invariato, dichiarazione di indipendenza, due CTA, blocco dati in `<dl>` |
| `src/pages/ricerca.astro` | Adattamento del widget Pagefind al tema scuro: campo rettangolare, evidenziazioni tonali, filetti fra i risultati |
| `src/components/ChunkCard.astro` | Permalink sottolineato, intestazioni di tabella su superficie rialzata, metadati distinti |
| `src/components/StatusBadges.astro` | Filetto verde a sinistra, raggio 6 px, nessun badge decorativo |
| `src/components/SourceCitation.astro` | Superficie tonale, etichetta in verde, raggio 6 px |
| 10 pagine in `src/pages/**` | Sostituzione dei riferimenti a `--color-green-ink` (verde per fondo chiaro) e dei fondi `--color-bg` incoerenti sul tema scuro |
| `config/public-defaults.json`, `astro.config.mjs`, `public/robots.txt`, `.env`, `.env.example`, `.github/workflows/ci.yml`, `tests/public-defaults-v312.test.mjs` | Passaggio dell'origine a `https://www.fontidelpalio.org` e hostname Turnstile `fontidelpalio.org,www.fontidelpalio.org` |

Nota di trasparenza: in `tests/public-defaults-v312.test.mjs:90` è stato aggiornato il **valore atteso** dell'origine. Non è un'asserzione indebolita: è il valore di specifica approvato (acquisto del dominio `.org`). Nessuna asserzione è stata rimossa, saltata o resa condizionale.

## 2. Scelte tecniche introdotte

- **Identità.** Wordmark `fontidelpalio.org` in Fraunces 700 con tre marcatori verdi: il punto prima di `org` e i due tittle delle due `i`, resi con `.wordmark__i::after` (pseudo-elemento posizionato a `top: 0.44em`, 0.2 × 0.2 em, calibrato empiricamente sul rendering reale del font). Nessun simbolo, stemma o icona.
- **Tipografia.** Fraunces per logo e heading, Inter per corpo e UI, JetBrains Mono per date, identificativi e metadati tecnici. Tutti i font restano self-hosted via `@fontsource` con i soli pesi in uso: nessuna richiesta esterna.
- **Contrasto.** Testo 16,2:1; testo secondario 9,2:1; testo attenuato 5,6:1; verde su fondo 11,7:1; testo scuro su bottone verde 11,7:1; warning 8,0:1; error 6,7:1. Il verde non è usato per testo piccolo su fondo chiaro. Il token `--color-border-strong` (#6b6a5e, 3,4:1) è usato per i bordi dei componenti interattivi come richiede WCAG 2.2 SC 1.4.11.
- **Accessibilità.** Skip link come primo elemento focalizzabile, `:focus-visible` con outline verde 3 px e offset 2 px su ogni elemento interattivo, link sempre sottolineati e non distinti dal solo colore, `aria-current` sulla voce di nav attiva, contenitori di tabella focalizzabili e scorrevoli da tastiera, blocco `prefers-reduced-motion` conservato.
- **Correzioni di layout mobile.** Eliminato lo scorrimento orizzontale a 390 px: `overflow-wrap: anywhere` su `code`/`.mono` per gli identificativi documentari lunghi, e blocchi `pre` (i diagrammi ASCII delle relazioni fra atti) resi scorrevoli entro il proprio contenitore, restando testo selezionabile e indicizzabile. Nav mobile compattata, padding dell'hero ridotto perché il contenuto utile resti vicino alla piega.
- **Performance.** Nessuna libreria di animazione, nessun video, nessuna immagine decorativa aggiunta, solo transizioni CSS su colore e bordo. La spaziatura è invariata rispetto alla versione precedente, quindi nessun nuovo layout shift.

## 3. FINAL CHECK — sette passi

1. **Confronto URL prima/dopo.** Build di controllo dallo stato `980866d` in un worktree separato: **116 pagine prima, 116 dopo, 0 mancanti, 0 nuove.** Sitemap: 116 `<loc>`, tutte su `https://www.fontidelpalio.org`.
2. **Nessun contenuto o funzionalità perso.** Confronto del testo visibile pagina per pagina: le sole differenze sono lo skip link (112+4 pagine), il wordmark al posto della dicitura precedente e la riorganizzazione del blocco dati dell'hero (710 / 365 / 17 / 65, valori identici). Confronto dei link: **0 link rimossi in tutte le 116 pagine**; unico link aggiunto in tutto il sito, sull'hero della home, l'Assistente documentario su ChatGPT.
3. **Layout desktop e mobile.** Verificato con Playwright a 1440, 1280, 1024, 768 e 390 px su home, disciplina vigente, pagina di ordinanza, evoluzione storica, tabelle storiche, registro fonti, scheda record, atti, scheda atto, metodologia, progetto, disclaimer, privacy, ricerca. `document.scrollWidth === window.innerWidth` su tutte le pagine controllate a 390 px.
4. **Tastiera e contrasto.** Sequenza di tabulazione corretta a partire dallo skip link, focus sempre visibile con outline verde 3 px; rapporti di contrasto elencati al punto 2 della sezione precedente, tutti conformi ad AA.
5. **Titoli e metadati SEO.** Diff automatico su tutte le pagine: **0 differenze** su `<title>`, meta description, testo degli H1, sequenza dei livelli di heading, numero di blocchi JSON-LD e meta robots. Canonical e `og:url` differiscono solo per l'origine `.it → www…org`, come approvato.
6. **Link, form, filtri e ricerca.** Le quattro query di controllo restituiscono i valori attesi: previsite 41 → `/disciplina-vigente/previsite-tratta-2026/`; PE-2019-01 6 → `/fonti/pe-2019-01/`; farmaci controllati 33 → `/disciplina-vigente/ordinanza-6-2026/`; articolo 37 21 → `/fonti/leg-2019-sper-3738/`. Indice Pagefind: 115 pagine.
7. **Nessun contenuto segnaposto o inventato.** Nessun testo nuovo oltre alle etichette funzionali richieste (skip link, wordmark, etichette delle due CTA, etichette del blocco dati che riprendono i valori già presenti) e alla riga di contatto nel footer «Segnalazioni e correzioni: info@pistakkio.net», approvata esplicitamente e presente su tutte le 116 pagine. I quattro file KB canonici sono intatti: SHA-256 invariati. `netlify/functions/ask.ts` resta un placeholder inerte come da mandato.

**Contatto nel footer.** Aggiunto come `mailto:` in linea nella colonna sinistra del footer, in verde e sottolineato (riconoscibile anche senza percepire il colore), presente su 116/116 pagine. Le voci di navigazione del footer restano senza sottolineatura perché identificabili dalla posizione nella lista. Nessuno sforamento orizzontale introdotto a 390 px.

**Suite e build:** `npm test` → 107 test, 107 pass, 0 fail. `npm run build` → 710 chunk (kb01 273, kb02 183, kb03 170, kb04 84), integrità OK, 116 pagine HTML.

## 4. Stato reale della pubblicazione

Questa sezione sostituisce la precedente lista di punti in attesa. In particolare **è ritirata l'ipotesi di puntamento DNS su registrar esterno** (CNAME `www` → `fonti-del-palio.netlify.app`, A apex → `75.2.60.5`): l'ispezione delle zone ha mostrato che i domini sono già delegati ai nameserver Netlify, quindi non c'era alcun record da creare su Porkbun.

### 4.1 Repository e deploy

| Voce | Stato verificato |
| --- | --- |
| Commit del redesign | `0c8d3ec` — "feat(ui): trasferisci l'identità visiva del Media Kit al sito", 24 file, +575 / −130 |
| Commit successivo | `1ec768d` — "chore(seo): pubblica la chiave di verifica IndexNow" |
| Push | entrambi su `origin/main` (`dragomanno/fonti-del-palio`) |
| Deploy pubblicati | `6a68a049f034ae11b427e190` (redesign) e `6a68a1157bfd461a6f11cdd6` (chiave IndexNow), stato `ready` |
| File KB canonici | non toccati da nessuno dei due commit, SHA-256 invariati |
| Tag e release `v0.1.0` | intatti, nessuna ri-pacchettizzazione |

### 4.2 Dominio, DNS e certificato

- **DNS su Netlify DNS**, non sul registrar: `fontidelpalio.org` su `dns1–4.p08.nsone.net`, `fontidelpalio.it` su `dns1–4.p05.nsone.net`, `fontidipalio.org` su `dns2/dns4.p07.nsone.net`. Nessun intervento su Porkbun.
- **Dominio primario** su Netlify: `www.fontidelpalio.org`, con `force_ssl` attivo. Alias: `fontidelpalio.org`, `fontidipalio.org`, `fontidelpalio.it`, `fontidipalio.it`.
- **Redirect verificati:** `https://fontidelpalio.org/` e `https://fontidelpalio.org/disciplina-vigente/` rispondono 301 verso la pagina corrispondente su `www.fontidelpalio.org`, con percorso conservato.
- **Certificato Let's Encrypt** rigenerato dopo il cambio di dominio primario, stato `issued`, nomi coperti: `fontidelpalio.org`, `*.fontidelpalio.org`, `fontidelpalio.it`, `*.fontidelpalio.it`, `fontidipalio.org`, `*.fontidipalio.org`. Scadenza 26 ottobre 2026, rinnovo automatico, nessun errore di rinnovo. `fontidipalio.it` e `www.fontidipalio.it` sono serviti da certificati dedicati validi emessi da Netlify.
- **Scelta consapevole del titolare:** gli alias secondari (`fontidelpalio.it`, `fontidipalio.org`, `fontidipalio.it`) rispondono 200 anziché redirigere. Le regole 301 host-based in `netlify.toml` sono state proposte e non applicate su indicazione esplicita di Fabrizio Gabrielli, che gestisce direttamente la configurazione dei domini secondari. La duplicazione è mitigata dai canonical auto-referenziali su `www.fontidelpalio.org`.

### 4.3 Origine canonica in produzione

Verificato sul sito live: canonical e `og:url` auto-referenziali su `https://www.fontidelpalio.org` per home, `/disciplina-vigente/`, `/fonti/pe-2019-01/`, `/atti/pe-2026-01/`, `/ricerca/` e `/chi-siamo/`. Nessun residuo di `fonti-del-palio.netlify.app`. Sitemap: 116 `<loc>`, `content-type: application/xml`, 8933 byte. `robots.txt` dichiara `Sitemap: https://www.fontidelpalio.org/sitemap.xml`.

### 4.4 Segnalazione ai motori di ricerca

- **IndexNow.** Chiave `a2a035a9a44a49aeb05be1c6b226dca7`, pubblicata come `public/a2a035a9a44a49aeb05be1c6b226dca7.txt` e raggiungibile con HTTP 200. Ping con le 116 URL lette dalla sitemap generata: **202 Accepted** da `api.indexnow.org`, `www.bing.com/indexnow` e `yandex.com/indexnow` (quest'ultimo con corpo `{"success":true}`). Google non partecipa a IndexNow.
- **Google Search Console.** Proprietà dominio `fontidelpalio.org` verificata sull'account `pistakkiomarketing@gmail.com`. Sitemap inviata dal titolare: stato **Operazione riuscita, 116 pagine rilevate**. L'invio è avvenuto dall'interfaccia perché l'endpoint delle sitemap non è esposto dal connettore disponibile; l'Indexing API non è utilizzabile come sostituto (richiede un service account proprietario ed è limitata a job posting e livestream).
- **Performance di ricerca:** ancora nessuna riga di dati, atteso per una proprietà creata il 28 luglio 2026.

### 4.5 Rinviato

- **13 advisory npm** (1 low, 12 high, 0 critical) sulla catena Astro e Netlify: nessuna entra in `dist/`, trattazione rinviata a M5 come da mandato. Nessun `npm audit fix` eseguito.
- **Propagazione di `fontidipalio.it`:** seguita direttamente dal titolare.
