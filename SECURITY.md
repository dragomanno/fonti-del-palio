# Sicurezza e stato delle dipendenze

Ultimo controllo: rilascio **v0.1.0** (27 luglio 2026), su `npm ci` con lockfile
committato.

```text
npm audit — 13 advisory: 1 low, 12 high, 0 critical
```

Le advisory non appartengono a un unico problema. Ricadono in **due catene di
dipendenze distinte e indipendenti**, con cause, impatto e strategia di remediation
diversi. Trattarle come un blocco unico ("13 vulnerabilità, non risolte") sarebbe
fuorviante, ed è il motivo per cui vengono descritte separatamente.

Nessuna delle due catene entra nell'artefatto statico servito agli utenti: `dist/`
contiene solo HTML, CSS, font self-hosted, l'indice Pagefind e la sitemap.

---

## Catena 1 — Astro (build del sito statico)

**Pacchetti coinvolti:** `astro` (high), `sharp` (high, transitiva), `esbuild` (low, transitiva).

**Versione installata:** `astro@5.18.2`, `sharp@0.34.5`, `esbuild@0.27.7`.

**Remediation disponibile:** `astro@7.1.3` — **semver-major**.

**Perché non è applicata:** il salto ad Astro 7 è escluso dal perimetro di questo
rilascio per decisione esplicita del proprietario del progetto. È un aggiornamento
major che tocca l'intera pipeline di build e le API dei componenti, e non può essere
introdotto in una release-preparation limitata a documentazione, canonical e sitemap.
`npm audit fix` e `npm audit fix --force` sono vietati in questo repository proprio
perché applicherebbero silenziosamente questo salto.

**Esposizione effettiva.** Gli advisory Astro riguardano funzionalità di rendering
dinamico e di gestione dell'input a runtime. Verifica sul codice sorgente di questo
repository:

| Advisory | Funzionalità interessata | Usata qui |
| --- | --- | --- |
| XSS in `define:vars` | direttiva `define:vars` | no — 0 occorrenze |
| Replay dei parametri cifrati delle server island | `server:defer` | no — 0 occorrenze |
| XSS via nome di slot non escapato | `<slot name="…">` | no — 0 occorrenze |
| SSRF via header Host nella pagina di errore prerenderizzata | pagina di errore server-side | no — build interamente statica, nessun SSR |
| XSS via nomi di attributo negli spread props | spread props dinamici | no |
| XSS via proprietà di animazione delle View Transition | `<ViewTransitions />` | no — 0 occorrenze |
| XSS via `transition:*` su island idratate | direttive `transition:*` | no — l'unica occorrenza di `transition:` nel repository è la proprietà CSS in `src/styles/global.css` |
| `esbuild`: lettura arbitraria di file con il dev server su Windows | `astro dev` su Windows | non applicabile alla build di produzione |
| `sharp`: vulnerabilità ereditate da libvips | elaborazione immagini | no — il progetto non usa `astro:assets` né elabora immagini |

Il sito è generato con `output: "static"`: non esiste un runtime server Astro in
produzione, e l'output è HTML preprodotto. Gli advisory restano comunque tracciati e
la loro chiusura è vincolata alla valutazione dell'aggiornamento ad Astro 7, che è una
decisione separata da prendere fuori dal perimetro della v0.1.0.

---

## Catena 2 — Netlify (bundling delle Functions)

**Pacchetti coinvolti:** `@netlify/functions` (high) →
`@netlify/zip-it-and-ship-it` (high) → `@vercel/nft`, `archiver`,
`archiver-utils`, `zip-stream`, `readdir-glob`, `glob`, `minimatch` (high) →
`brace-expansion` (high, DoS per espansione non limitata con esaurimento di memoria).

**Versione installata:** `@netlify/functions@3.1.10`.

**Remediation disponibile:** sì, **senza salto di major** (`fixAvailable: true` su
tutta la catena).

**Perché non è applicata in v0.1.0:** questa catena serve esclusivamente al
*bundling* delle Netlify Functions in fase di deploy. In v0.1.0:

- non esiste alcun deploy Netlify (è la milestone M5);
- `netlify/functions/ask.ts` è un segnaposto inerte e non viene invocato;
- nessuno di questi pacchetti viene eseguito da `npm run build`, che produce solo
  l'output statico Astro, la sitemap e l'indice Pagefind;
- nessuno di questi pacchetti finisce in `dist/`.

L'aggiornamento della catena Netlify è una modifica di dipendenze e di lockfile, e
va fatta insieme al lavoro di deploy a cui appartiene. È quindi **rinviata a M5**,
dove deve essere eseguita e verificata prima del primo Deploy Preview.

**Nota di rischio residuo:** finché la catena resta alla versione attuale, il rischio
è confinato alla macchina che esegue il bundling (build agent o sviluppatore), non
agli utenti del sito.

---

## Politica

- `npm audit fix` e `npm audit fix --force` sono **vietati** in questo repository:
  applicano aggiornamenti major senza valutazione.
- Le advisory non vengono chiuse abbassando la soglia di controllo né sopprimendo
  l'output di `npm audit`.
- Ogni rilascio riporta lo stato aggiornato di entrambe le catene, separatamente.

## Segnalare una vulnerabilità

Aprire una issue sul repository
[`github.com/dragomanno/fonti-del-palio`](https://github.com/dragomanno/fonti-del-palio).
Per segnalazioni che non è opportuno rendere pubbliche immediatamente, usare la
funzione di *private vulnerability reporting* di GitHub sullo stesso repository.

Il progetto non gestisce dati personali di utenti registrati e non espone endpoint
autenticati: la superficie di attacco è quella di un sito statico. Vedi
[`PRIVACY.md`](./PRIVACY.md).
