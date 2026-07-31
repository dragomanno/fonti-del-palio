# Changelog — v0.2.0

**Rilascio precedente:** `v0.1.1` · **Baseline:**
`20f4bc65cd7d12746855f923c2aa2e9174f5dcb4`

Versione di ampliamento documentario. Introduce tre corpus che nella `v0.1.1` non
esistevano — gli atti di una singola Carriera, i documenti di lunga durata e il
Bando di Violante — e ricostruisce navigazione e ricerca perché i tre piani
restino distinguibili.

## Che cosa cambia per chi consulta il sito

- **Il Palio del 16 agosto 2026 ha una sezione propria**: i cavalli ammessi alle
  previsite, le materie di accesso e sicurezza ricavate dalle ordinanze, una guida
  pratica per chi va in Piazza. Ogni pagina dichiara che quegli atti valgono per
  quella Carriera soltanto.
- **Ogni atto ha una scheda**: estremi, funzione, esito, digest del file acquisito
  e stato di ripubblicazione dichiarato caso per caso.
- **Il Regolamento per il Palio è documentato per quello che è**: edizione vigente
  approvata nel 2019 e presentata nel 2021, edizione previgente approvata nel 1949
  tenuta distinta, collazione articolo per articolo fra le due.
- **Il Bando di Violante è consultabile per Contrada**, con l'avvertenza sulla
  provenienza archivistica non accertata.
- **La ricerca copre tutto il nuovo materiale** e il campo di ricerca è in testa
  alla pagina.

## Contenuti aggiunti

### Fonti acquisite e verificate

- 12 PDF di atti pubblici del Palio del 16 agosto 2026, ripubblicati
  (1.716.251 byte complessivi, 35 pagine).
- 1 atto acquisito e **non ripubblicato**: il visto di regolarità contabile
  `ATT-2026-VIS-1775`, il cui file contiene dati identificativi e recapiti di
  fornitori non necessari alla comprensione dell'atto.
- 2 atti richiamati dagli atti acquisiti ma non acquisiti: `ATT-2026-SIND-044` e
  `ATT-2026-SIND-045`.
- 108 cavalli ammessi alle previsite, con proprietario.
- Le due edizioni del *Regolamento per il Palio* e il comunicato stampa del
  29 maggio 2021, registrati con consistenza e digest.
- La trascrizione del *Bando di Violante* con i confini delle 17 Contrade.
- Il repertorio `RIF-STRADE-CONTRADE`, registrato per completezza e **non
  ripubblicato**: opera editoriale moderna senza attribuzione interna, per la quale
  non è stato accertato il regime dei diritti.

Tutte le impronte SHA-256 delle fonti sono pubblicate nel registro in
[Documenti fondamentali](/documenti-fondamentali/#registro).

### Rotte

40 rotte nuove, nessuna rotta preesistente rimossa: da 116 a 156.

| Sezione | Rotte |
| --- | ---: |
| `/palio-16-agosto-2026/` e sottopagine | 4 |
| `/ordinanze-e-atti/` e schede degli atti | 14 |
| `/documenti-fondamentali/` | 1 |
| `/documenti-fondamentali/bando-di-violante/` e Contrade | 18 |
| `/regolamento-per-il-palio/` ed edizione previgente | 2 |
| `/changelog/` | 1 |

### Codice

- `scripts/build-carriera-index.mjs`: generatore deterministico dell'indice della
  Carriera, con controlli di invariante che bloccano la build in caso di
  discordanza fra fonti e modello.
- `src/lib/carriera.ts`: modello tipizzato e formule documentarie condivise, perché
  la distinzione fra approvazione e presentazione, e fra acquisizione e
  ripubblicazione, non possa perdersi nelle singole pagine.
- `src/components/NotaDocumentaria.astro`: componente per le avvertenze
  documentarie.
- Navigazione a sette voci con tre gruppi apribili, a potenziamento progressivo:
  senza JavaScript i gruppi restano elenchi navigabili.

## Che cosa il sito continua a non fare

- Non stabilisce che cosa sia in vigore al posto degli atti.
- Non ripubblica i PDF delle due edizioni del Regolamento: ne documenta identità,
  storia di approvazione, consistenza e digest, e rimanda al Comune di Siena.
- Non converte la toponomastica settecentesca in quella odierna e non pubblica
  mappe dei confini.
- Non corregge in silenzio i difetti presenti negli originali.

## Osservazioni documentarie aperte

- **Datazione del Bando.** La copia acquisita reca il decreto al *13 settembre
  1729*, la deliberazione della Balìa a *venerdì 19 agosto 1729* e la relazione dei
  deputati a *27 luglio 1729*, mentre il documento è comunemente citato come «del
  1730». La discordanza è riprodotta, non risolta.
- **Rubrica dell'articolo 23** dell'edizione previgente: nella fonte la rubrica è
  troncata («Sorteggio delle Contrade - Modalità di estrazione delle Contrade che
  non»). Riprodotta fedelmente, non riparata.
- **Difetto `addotti.x`** all'articolo 16 dell'edizione vigente: presente
  nell'originale, assente nella previgente. Conservato.
- **Provenienza archivistica** della trascrizione del Bando: non accertata.
- **Tre locuzioni sconsigliate** ricorrono nel sito unicamente all'interno di
  citazioni letterali di atti e non sono state riscritte.

## Verifiche eseguite

- `npm run check`: superato.
- `npm test`: 170/170 superati, 0 falliti.
- `npm run build`: superato.
- 156 pagine HTML generate; 156 URL in sitemap.
- 155 pagine indicizzate da Pagefind; la sola `/ricerca/` è esclusa dall'indice.
- 116 rotte preesistenti tutte preservate; 40 rotte nuove tutte presenti.
- Smoke test HTTP locale su tutte le 156 rotte: HTTP 200.
- `canonical` e `og:url` corretti su tutte le rotte.
- Nessun collegamento interno rotto, nessuna ancora interna senza bersaglio.
- 12 PDF pubblici: HTTP 200, `application/pdf`, SHA-256 corrispondente
  all'atteso.
- PDF del visto contabile: assente dall'output, come previsto.
- Doppia generazione degli indici: identica.
- `data/chunks.generated.json`: identico alla baseline `v0.1.1`.
- Testo UTF-8 senza BOM, Unicode NFC, terminatori LF; nessun carattere di
  sostituzione, nessun carattere invisibile spurio.
- Nessun overflow orizzontale a 390 × 844 e su desktop.

## Integrità documentaria

I file KB 01–04 del corpus storico non sono stati modificati. Le impronte restano
quelle registrate nella `v0.1.1`:

```text
ff9c63de4ea9001aeddbcb97fb0b806ffec22b5cba28d215be4b6a5317db0cb3  01_KB_Corpus_Storico_Protocollo_Equino_2012_2026.md
6d7282df3c67322001646dc5127f7db3b4983dba8238c273a6ee849acb8c0979  02_KB_Memoria_Incrementale_Protocollo_Equino_2012_2026.md
a5ab22da9ec7ead082f523ca7c242794ac51cb744424f911acd91f25f750fc1a  03_KB_Disciplina_Vigente_Consolidata_2026.md
81f3e58ee026943c347a3f787382fca1d4c228803594fe20b70a6d6fa0297b89  04_KB_Manifest_Fonti_e_Registro_Atti_2012_2026.md
```

Nessuna citazione, identificativo di atto o disposizione consolidata preesistente è
stata aggiunta, rimossa o riscritta.

## Elementi rinviati

- Verifica della provenienza archivistica del Bando presso un fondo identificato.
- Riconciliazione della datazione 1729 / 1730.
- Eventuale ripubblicazione dei PDF delle due edizioni del Regolamento, subordinata
  a una verifica esplicita.
- 13 vulnerabilità dichiarate da `npm audit` (1 bassa, 12 alte), ereditate dalla
  `v0.1.1` e fuori dal perimetro di questa versione.
- Riconciliazione fra gli identificativi mostrati sull'indice delle fonti e i
  record di fonte documentati, già rinviata dalla `v0.1.1`.

## Rollback

Il ripristino avviene con un commit di revert, senza riscrittura della storia
e senza cancellazione di riferimenti già pubblicati. Individuato il commit da
annullare:

```bash
git revert <sha-del-commit>
git push
```

La pubblicazione è innescata dal Git: il commit di revert riporta il sito allo
stato precedente attraverso una nuova costruzione. Un ripristino eseguito dal
pannello dell'hosting restituisce il servizio più in fretta, ma va riconciliato
subito con il Git, perché altrimenti la costruzione successiva rimetterebbe in
linea la versione difettosa.

Vedi `CHANGELOG_v0.1.1.md`, `CHANGELOG_v0.1.0.md`, `DISCLAIMER.md`, `PRIVACY.md`,
`SECURITY.md`, `ATTRIBUTION.md`, `NOTICE.md`.

La mancata riproduzione di una disposizione in un atto successivo non ne dimostra
automaticamente l'abrogazione.
