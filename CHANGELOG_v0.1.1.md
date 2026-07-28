# Changelog — v0.1.1

**Tag:** `v0.1.1` · **Titolo release:** `v0.1.1 — Tabelle documentarie responsive e build Netlify`
· **Target:** `main` · **Rilascio precedente:** `v0.1.0` · Non è una pre-release.

Patch di formalizzazione dello stato di produzione verificato. Non introduce
nuove funzionalità, nuovi contenuti documentari né aggiornamenti di dipendenze.

## Contenuto della patch

- Refactor responsive delle tabelle documentarie.
- Migliore leggibilità e densità informativa su desktop e mobile.
- Rimozione della ripetizione visuale dei fallback generici, senza alterare il
  corpus documentario.
- Eliminazione dell'overflow orizzontale di pagina nei viewport verificati.
- Ripristino della build automatica Netlify mediante installazione delle
  devDependencies richieste da Pagefind.
- Ripristino completo della pipeline GitHub → Netlify.

Commit inclusi rispetto alla `v0.1.0`:

- `1acf7ea` — `fix(ui): improve responsive documentary tables`
- `9d0da75` — merge della pull request #1
- `60572f6` — `fix(build): install dev dependencies on Netlify`

## Verifiche

- `npm run check`: superato.
- `npm test`: 107/107 superati.
- `npm run build`: superato.
- 116 pagine HTML generate.
- 116 URL in sitemap.
- 115 pagine indicizzate da Pagefind.
- 4.444 parole indicizzate.
- `robots.txt` e `sitemap.xml`: HTTP 200.
- Asset Pagefind in produzione: HTTP 200.
- Nessun overflow orizzontale di pagina sui viewport verificati da 320 a 1440 px.
- Deploy di produzione Netlify automatico associato a `main`.

## Integrità documentaria

- Nessuna fonte documentaria, citazione, identificativo di atto o disposizione
  consolidata è stata intenzionalmente aggiunta, rimossa o riscritta.
- I file KB 01–04 non sono stati modificati. Impronte invariate rispetto alla
  `v0.1.0`:

```text
ff9c63de4ea9001aeddbcb97fb0b806ffec22b5cba28d215be4b6a5317db0cb3  01_KB_Corpus_Storico_Protocollo_Equino_2012_2026.md
6d7282df3c67322001646dc5127f7db3b4983dba8238c273a6ee849acb8c0979  02_KB_Memoria_Incrementale_Protocollo_Equino_2012_2026.md
a5ab22da9ec7ead082f523ca7c242794ac51cb744424f911acd91f25f750fc1a  03_KB_Disciplina_Vigente_Consolidata_2026.md
81f3e58ee026943c347a3f787382fca1d4c228803594fe20b70a6d6fa0297b89  04_KB_Manifest_Fonti_e_Registro_Atti_2012_2026.md
```

- La build locale validata e l'output di produzione sono risultati equivalenti:
  stessi hash degli asset generati, stesso numero di URL in sitemap, stessi
  identificativi sulle rotte verificate.
- Nessun output diagnostico interno è esposto pubblicamente.

La mancata riproduzione di una disposizione in un atto successivo non ne dimostra
automaticamente l'abrogazione.

## Elementi rinviati, non inclusi nella v0.1.1

- Riconciliazione fra i 47 identificativi mostrati sull'indice delle fonti e i 65
  record di fonte documentati in precedenza. Non si tratta di una perdita di dati:
  richiede un audit separato sulla definizione della metrica.
- Separazione a monte fra disponibilità documentale e stato storico-legale nei
  record in cui KB 04 espone un unico campo `Stato:`.
- Testo del diagramma ASCII preesistente a 11,375 px.
- Remediation della dipendenza `@netlify/functions`.
- Migrazione ad Astro 7 e relativa catena di dipendenze `esbuild` / `sharp`.

## Rollback

```bash
git revert 60572f6   # correzione della build Netlify
git revert 9d0da75   # refactor delle tabelle documentarie
git push
```

Vedi `CHANGELOG_v0.1.0.md`, `SECURITY.md`, `ATTRIBUTION.md`, `NOTICE.md`,
`DISCLAIMER.md`.
