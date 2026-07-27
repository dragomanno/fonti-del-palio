# Changelog — v0.1.0

Primo rilascio pubblico. Milestone **M1 — prodotto documentario statico**, più un
singolo passaggio delimitato di preparazione al rilascio.

Nessun layer AI, nessun embedding, nessun retrieval. Nessuna funzionalità di M3, M4
o M5 implementata al di fuori di quanto elencato sotto.

---

## Cifre del rilascio

| Grandezza | Valore |
| --- | --- |
| Chunk di produzione | 710 (kb01 273, kb02 183, kb03 170, kb04 84) |
| Chunk con rotta pubblica | 704 |
| Chunk con provenienza provvisoria marcata | 133 |
| Pagine HTML generate | 116 |
| Pagine pubbliche indicizzabili | 116 |
| URL nella sitemap | 116 |
| Record di fonte | 65, più l'indice delle fonti |
| Atti | 17 |
| Sezioni della disciplina | 8 |
| Annualità storiche | 15 (2012–2026), più le tabelle storiche |
| Pagine nell'indice Pagefind | 115 |
| Parole indicizzate | 4.346 |
| Test | 107, tutti verdi |

---

## 1. Preparazione del rilascio

### 1.1 Canonical e Open Graph — correzione di un difetto reale

**Difetto.** Il canonical era derivato da `activePath`, che è una proprietà di
**navigazione**: serve a evidenziare la voce di menu attiva ed è volutamente
condivisa fra una sezione e le sue pagine figlie. Conseguenza: tutte le 65 pagine di
record dichiaravano `https://fontidelpalio.it/fonti/` come canonical, tutti i 17 atti
e le 15 annualità dichiaravano `/evoluzione-storica/`, le 8 sezioni di disciplina
dichiaravano `/disciplina-vigente/`. Le pagine di dettaglio si auto-deindicizzavano a
favore della sezione madre, e `og:url` ereditava lo stesso errore.

**Correzione.** Identità del documento e stato di navigazione sono ora due valori
distinti:

- il canonical è derivato esclusivamente da `Astro.url.pathname`, cioè dalla rotta
  effettivamente generata;
- `activePath` governa **solo** l'evidenziazione del menu e non ha più alcun effetto
  sui metadati;
- `og:url` coincide per costruzione con il canonical, perché entrambi leggono lo
  stesso valore;
- politica trailing slash coerente con `build.format: "directory"`: ogni URL termina
  con `/`, la home resta `/`. I suffissi `/index.html` vengono normalizzati.

Il dominio canonico non è stato toccato: resta quello configurato in
`PUBLIC_SITE_URL` / `config/public-defaults.json`.

### 1.2 Sitemap completa e derivata dalla build

**Difetto.** `public/sitemap.xml` era un file statico mantenuto a mano: elencava
**8 URL** su 116 pagine generate. L'intero corpus documentario — record di fonte,
atti, annualità, sezioni di disciplina — era assente.

**Correzione.** Il file statico è stato rimosso e sostituito da
`scripts/build-sitemap.mjs`, eseguito in coda ad `astro build`. La sitemap è derivata
dall'output HTML reale, quindi l'insieme delle sue URL è **per costruzione** uguale
all'insieme delle rotte pubbliche indicizzabili prodotte.

- include tutte e sole le pagine HTML pubbliche indicizzabili, comprese quelle di
  dettaglio (record di fonte, atti, annualità, sezioni di disciplina);
- esclude le pagine con `noindex`, le pagine di errore (404/500), gli endpoint di
  funzione, gli asset Pagefind, `_astro/` e qualunque artefatto non-HTML;
- URL assolute, con la stessa politica di trailing slash del canonical;
- **nessun conteggio atteso è scritto nel codice**: il numero di URL è una conseguenza
  delle pagine generate, non un valore da mantenere allineato a mano;
- deterministica: nessun timestamp, ordinamento lessicografico stabile.

`public/robots.txt` dichiarava già la sitemap; la dichiarazione è ora verificata da un
test.

### 1.3 Controlli di regressione sull'output di rilascio

Nuovo file `tests/release-output.test.mjs`, 11 controlli. Perimetro dichiarato: sono
**controlli sull'artefatto di build**, non un nuovo framework diagnostico e non
un'estensione della diagnostica congelata alla v3.1.3. Verificano quattro proprietà:

1. ogni pagina indicizzabile ha **esattamente un** canonical, assoluto e
   auto-referenziale;
2. `og:url` coincide con quel canonical;
3. l'insieme delle URL della sitemap è uguale all'insieme delle rotte pubbliche
   indicizzabili;
4. la sitemap non contiene duplicati né URL che non risolvono a una pagina generata.

Più tre controlli di supporto: regressione esplicita "una figlia non canonicalizza
mai sulla madre", presenza delle quattro famiglie documentarie nella sitemap,
`robots.txt` collegato alla sitemap.

Nessun conteggio atteso è codificato: i controlli sono relazioni fra insiemi.

Poiché la sequenza di verifica documentata esegue `npm test` **prima** di
`npm run build`, i controlli producono la build quando `dist/` manca o è più vecchio
dei sorgenti, invece di saltare in silenzio proprio nell'unica esecuzione che conta.

**Verifica di non-vacuità.** I controlli sono stati validati reintroducendo
temporaneamente il difetto (canonical derivato da `activePath`) e ricostruendo: la
suite è passata da 11/11 verdi a **2 fallimenti mirati**, esattamente i due controlli
sul canonical. Ripristinata la correzione, 11/11 di nuovo verdi.

### 1.3-bis Esecuzione seriale della suite di test

`npm test` è ora `node --test --test-concurrency=1 tests/*.test.mjs`.

Due file di test di integrazione — `tests/build-determinism-v313.test.mjs` e
`tests/release-output.test.mjs` — producono entrambi l'output di build nella stessa
directory `dist/`. In esecuzione concorrente potevano quindi lanciare due build
sovrapposte sullo stesso percorso: su Node 24 questo ha provocato una race reale su
`renderers.mjs`. La serializzazione elimina la sovrapposizione alla radice, senza
introdurre directory temporanee, dipendenze o un nuovo framework di test, e senza
toccare una sola asserzione.

Il comando seriale è verificato a **107/107**.

### 1.4 Documentazione pubblica allineata allo stato reale

- **`README.md`** riscritto. Prima dichiarava «chunker di produzione: resta un
  placeholder inerte, `productionChunkCount` resta `null`», «Pagefind: non
  implementato, non installato, non configurato», «le pagine generate non espongono
  ancora citazioni puntuali né badge di stato», «il titolare del copyright non è
  ancora stato deciso», «repository privato». Tutte affermazioni ormai false. Ora
  riporta lo stato reale, la tabella delle milestone, le cifre del rilascio, i comandi
  effettivi, le impronte SHA-256 delle quattro KB e il perimetro dei 12 gate
  bloccanti.
- **`CONTRIBUTING.md`**: repository pubblico, governance chiusa (MIT, Pistakkio®
  ideatrice tecnica e curatrice), requisiti di PR aggiornati (divieto di indebolire
  asserzioni, obbligo di passare i controlli di rilascio, `activePath` mai usato come
  identità del documento, `data-pagefind-body` sulle nuove pagine, divieto di
  `npm audit fix`), sezione sui gate bloccanti.
- **`ATTRIBUTION.md`**: le pagine di dettaglio con citazioni e badge **sono
  implementate**, non più «pianificate»; descrizione di cosa espone realmente ogni
  pagina (file KB, intervallo di righe, `contentHash`, fonte esterna, quattro
  dimensioni separate, tre motivazioni di assenza distinte); dichiarazione esplicita
  dei limiti (133 provenienze provvisorie, 46 record su 65 con ricerca non conclusa);
  licenza MIT sciolta.
- **`PRIVACY.md`**: la ricerca locale **è attiva** e le query non lasciano il browser;
  font self-hosted; nessun cookie proprio; precisazione che alla v0.1.0 non è stato
  effettuato alcun deploy pubblico.
- **`NOTICE.md`**: repository pubblico dal rilascio M1.
- **`src/pages/chi-siamo.astro`**: da «repository privato, in attesa
  dell'approvazione» a repository pubblico con flussi di segnalazione attivi e
  richiamo alla politica di immutabilità delle KB.
- **`data/static-site-milestone-plan.md`**: voci M0, M1 e M2 aggiornate.

### 1.5 Correzione di due cifre

- Le pagine sotto `/fonti/` sono **65 record più l'indice delle fonti**. Il documento
  di candidatura M1 riportava «66 pagine di record»: contava l'indice fra i record.
- La query «farmaci controllati» restituisce **33** risultati, non 28. Il valore 28
  era stato rilevato su una build precedente alla correzione tipografica delle
  spiegazioni di stato, che ha modificato il testo indicizzato.

Il conteggio di **4.307** parole indicizzate era corretto sulla build precedente
all'allineamento della documentazione. Le pagine `/privacy` e `/chi-siamo` sono
pagine indicizzate: riscriverne il testo (punto 1.4) ha necessariamente modificato
l'indice. La build finale di questo rilascio indicizza **4.346 parole** su 115 pagine.
Per la stessa ragione la query «previsite» passa da 40 a 41 risultati. La cifra non è
stata ritoccata a posteriori per farla coincidere con quella attesa: è il valore
misurato sull'artefatto effettivamente rilasciato.

### 1.6 Catene di dipendenze npm-audit descritte separatamente

Nuovo file **`SECURITY.md`**. Le 13 advisory di `npm audit` (1 low, 12 high) non sono
un blocco unico: ricadono in due catene indipendenti, con cause e strategie diverse.

- **Catena Astro** — `astro@5.18.2` → `sharp`, `esbuild`. Remediation richiede
  `astro@7.1.3`, **semver-major**, escluso dal perimetro. `SECURITY.md` verifica
  advisory per advisory che nessuna delle funzionalità interessate è usata dal
  progetto: `define:vars` 0 occorrenze, `server:defer` 0, `<slot name>` 0,
  `<ViewTransitions />` 0, `astro:assets` 0; l'unica occorrenza di `transition:` nel
  repository è la proprietà CSS in `global.css`. Build interamente statica, nessun
  runtime server.
- **Catena Netlify** — `@netlify/functions@3.1.10` → `@netlify/zip-it-and-ship-it`
  → `@vercel/nft`, `archiver`, `glob`, `minimatch`, `brace-expansion`. Remediation
  disponibile **senza salto di major**, ma la catena serve solo al bundling delle
  Netlify Functions, che non sono deployate: rinviata a M5, dove va eseguita prima
  del primo Deploy Preview. Rischio residuo confinato alla macchina che esegue il
  bundling.

Nessuna delle due catene entra in `dist/`.

### 1.7 Immutabilità delle quattro KB canoniche

Nessun file in `content/kb/` è stato toccato. Confronto byte a byte con gli originali:
tutti e quattro identici.

```text
ff9c63de4ea9001aeddbcb97fb0b806ffec22b5cba28d215be4b6a5317db0cb3  01_KB_Corpus_Storico_Protocollo_Equino_2012_2026.md
6d7282df3c67322001646dc5127f7db3b4983dba8238c273a6ee849acb8c0979  02_KB_Memoria_Incrementale_Protocollo_Equino_2012_2026.md
a5ab22da9ec7ead082f523ca7c242794ac51cb744424f911acd91f25f750fc1a  03_KB_Disciplina_Vigente_Consolidata_2026.md
81f3e58ee026943c347a3f787382fca1d4c228803594fe20b70a6d6fa0297b89  04_KB_Manifest_Fonti_e_Registro_Atti_2012_2026.md
```

---

## 2. Cosa NON è stato fatto

Deliberatamente fuori perimetro, come da mandato:

- nessuna M1.1, nessuna riapertura della fase diagnostica, nessun gate aggiuntivo
  estraneo ai quattro ambiti autorizzati;
- nessuna funzionalità di M3 (revisione editoriale completa delle pagine legali),
  M4 (accessibilità completa, verifica mobile su tutte le pagine, immagine di
  anteprima social, Lighthouse) o M5 (deploy Netlify);
- nessun embedding, nessun retrieval, nessuna implementazione di `ask.ts`;
- nessun aggiornamento di dipendenze;
- nessuna modifica ai documenti storici congelati `CHANGELOG_v3.1.*.md`,
  `VERDETTO_FINALE_v3.1.*.md`, `data/chunk-diagnostic-report-v3.1.*.md`.

---

## 3. Limiti dichiarati

- 9 mappature KB 01 → KB 04 restano **provvisorie** (`yearOnlyFallback`). Per 2013 e
  2020 il campo Atto di KB 04 riporta un numero esplicito, ma l'evidenza non è stata
  promossa senza verifica manuale.
- Per 46 dei 65 record del registro la ricerca d'archivio è dichiaratamente non
  conclusa. Il numero è esposto in homepage.
- Le pagine `/disclaimer`, `/privacy` e `/metodologia` rendono i file markdown del
  repository: la revisione editoriale completa è M3.
- Verifica mobile eseguita sulle pagine principali, non su tutte: è M4.
- Nessuna immagine di anteprima social (`og:image`): è M4.
- 13 advisory `npm audit` aperte, documentate in `SECURITY.md`.
- Nessun deploy eseguito: è M5.
