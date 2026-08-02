#!/usr/bin/env node
/**
 * Estrattore dell'articolato del «Regolamento per il Palio», edizione vigente.
 *
 * Fonte unica: la trascrizione integrale del PDF REG-PALIO-2019 conservata nel
 * repository in `content/kb/03_KB_Disciplina_Vigente_Consolidata_2026.md`,
 * sezione «Parte III — Regolamento per il Palio». La collazione
 * (`content/carriere/14_KB_Collazione_Regolamento_Previgente_Vigente.md`) è un
 * documento analitico e NON viene usata come fonte dell'articolato.
 *
 * Il testo non viene riscritto, riassunto, integrato né modernizzato. Le uniche
 * trasformazioni applicate sono meccaniche e reversibili, e sono documentate qui:
 *
 * 1. i marcatori di paginazione `<!-- PDF_PAGE: n -->` vengono rimossi;
 * 2. le righe composte dal solo numero di pagina del piè di pagina vengono
 *    rimosse, e soltanto quando il numero coincide con la pagina in corso;
 * 3. il rientro tipografico di riga viene rimosso (nel Markdown diventerebbe
 *    un blocco di codice), la spaziatura interna alla riga resta invariata;
 * 4. le righe mandate a capo dalla giustificazione della stampa vengono
 *    riunite nella stessa riga logica; un nuovo capoverso logico inizia
 *    soltanto in corrispondenza di una riga vuota o di un contrassegno di
 *    elenco («a)», «1.», «-»);
 * 5. una parola divisa dal fine riga con trattino viene riunita senza
 *    inserire spazio, conservando il trattino («Vice-Barbaresco»,
 *    «pre-iscrizione»: in entrambi i casi il trattino è lessicale);
 * 6. un capoverso interrotto da un salto di pagina viene ricongiunto quando la
 *    riga precedente non termina con punteggiatura conclusiva.
 *
 * Nessuna rubrica viene generata: l'edizione vigente numera gli articoli senza
 * titolo, e inventarne uno sarebbe una alterazione documentaria.
 */

import { readFileSync } from "node:fs";

/** Nome del file canonico che contiene la trascrizione integrale. */
export const KB03_FILE = "03_KB_Disciplina_Vigente_Consolidata_2026.md";

/** Intestazione della parte che contiene la trascrizione integrale. */
const PARTE = "\n# Parte III — Regolamento per il Palio\n";
/** Primo titolo dopo l'articolato: gli allegati non appartengono agli articoli. */
const FINE_ARTICOLATO = "\nALLEGATI\n";

const RE_PAGE_MARKER = /^<!-- PDF_PAGE: (\d+) -->$/;
const RE_CAPITOLO = /^## CAPITOLO ([IVXLC]+)\s*$/;
const RE_ARTICOLO = /^### Art\. (\d+)\s*$/;
/** L'art. 99bis è composto centrato nella stampa, non come titolo di livello 3. */
const RE_ARTICOLO_BIS = /^\s{4,}Art\.\s*(\d+)\s*bis\s*$/;
const RE_ELENCO = /^\s*(?:[a-z]\)|[0-9]{1,2}[.)]|[-–—•])\s/;
const RE_CHIUSURA = /[.;:!?»)"”]$/;

/** «99bis» → «99-bis»; «7» → «7». Etichetta e ancora restano allineate. */
function etichettaDi(numero) {
  return `Art. ${numero.replace(/bis$/, "-bis")}`;
}

function ancoraDi(numero) {
  return `articolo-${numero.replace(/bis$/, "-bis")}`;
}

/**
 * Ricompone il corpo di un articolo a partire dalle righe grezze della
 * trascrizione. Ogni elemento di `righe` è `{ testo, saltoPagina }`.
 */
function componiCorpo(righe) {
  const capoversi = [];
  let corrente = [];
  const chiudi = () => {
    if (corrente.length) {
      capoversi.push(corrente.join("\n"));
      corrente = [];
    }
  };

  for (const riga of righe) {
    if (riga.testo === "") {
      chiudi();
      continue;
    }
    const testo = riga.testo.trim();
    const ultima = corrente[corrente.length - 1];

    // Salto di pagina in mezzo a un periodo: la frase continua.
    if (riga.saltoPagina && ultima !== undefined && !RE_CHIUSURA.test(ultima)) {
      corrente[corrente.length - 1] = unisci(ultima, testo);
      continue;
    }
    if (riga.saltoPagina) {
      chiudi();
      corrente.push(testo);
      continue;
    }
    if (ultima === undefined || RE_ELENCO.test(riga.testo)) {
      corrente.push(testo);
      continue;
    }
    corrente[corrente.length - 1] = unisci(ultima, testo);
  }
  chiudi();
  return capoversi.join("\n\n");
}

/** Riunisce due frammenti di riga rispettando la sillabazione lessicale. */
function unisci(precedente, successivo) {
  if (/[A-Za-zÀ-ÿ]-$/.test(precedente)) return precedente + successivo;
  return `${precedente} ${successivo}`;
}

/**
 * Estrae l'articolato dalla trascrizione canonica.
 * @param {string} testoKb03 contenuto integrale di KB 03.
 * @returns {{ articoli: object[], capitoli: object[] }}
 */
export function estraiRegolamento(testoKb03) {
  const inizio = testoKb03.indexOf(PARTE);
  if (inizio === -1) {
    throw new Error(
      "Struttura della fonte non riconosciuta: «Parte III — Regolamento per il Palio» assente da KB 03."
    );
  }
  const parte = testoKb03.slice(inizio + 1);
  const fine = parte.indexOf(FINE_ARTICOLATO);
  if (fine === -1) {
    throw new Error(
      "Struttura della fonte non riconosciuta: fine dell'articolato («ALLEGATI») non individuata in KB 03."
    );
  }

  const righe = parte.slice(0, fine).split("\n");
  const articoli = [];
  const capitoli = [];

  let pagina = 0;
  let saltoPagina = false;
  let capitoloCorrente = null;
  let attesaTitoloCapitolo = null;
  let corrente = null;

  for (const riga of righe) {
    const marker = RE_PAGE_MARKER.exec(riga);
    if (marker) {
      pagina = Number(marker[1]);
      saltoPagina = true;
      continue;
    }
    const nudo = riga.trim();

    // Numero di piè di pagina: rimosso solo se coincide con la pagina precedente.
    if (/^\d+$/.test(nudo) && Number(nudo) === pagina - 1) continue;

    if (attesaTitoloCapitolo !== null && nudo !== "") {
      capitoloCorrente = { numero: attesaTitoloCapitolo, titolo: nudo };
      capitoli.push(capitoloCorrente);
      attesaTitoloCapitolo = null;
      saltoPagina = false;
      continue;
    }

    const capitolo = RE_CAPITOLO.exec(riga);
    if (capitolo) {
      if (corrente) corrente = chiudiArticolo(corrente, articoli);
      attesaTitoloCapitolo = capitolo[1];
      saltoPagina = false;
      continue;
    }

    const articolo = RE_ARTICOLO.exec(riga) ?? RE_ARTICOLO_BIS.exec(riga);
    if (articolo) {
      const numero = RE_ARTICOLO.test(riga) ? articolo[1] : `${articolo[1]}bis`;
      if (corrente) chiudiArticolo(corrente, articoli);
      corrente = {
        numero,
        righe: [],
        capitolo: capitoloCorrente ? `${capitoloCorrente.numero} — ${capitoloCorrente.titolo}` : null,
      };
      saltoPagina = false;
      continue;
    }

    if (!corrente) {
      saltoPagina = false;
      continue;
    }
    corrente.righe.push({ testo: riga.replace(/\s+$/, ""), saltoPagina });
    saltoPagina = false;
  }
  if (corrente) chiudiArticolo(corrente, articoli);

  return { articoli, capitoli };
}

function chiudiArticolo(corrente, articoli) {
  articoli.push({
    numero: corrente.numero,
    etichetta: etichettaDi(corrente.numero),
    anchor: ancoraDi(corrente.numero),
    rubrica: "",
    capitolo: corrente.capitolo,
    corpo: componiCorpo(corrente.righe).trim(),
  });
  return null;
}

/**
 * Costruisce il blocco `regolamento` dell'indice generato.
 * @param {string} testoKb03 contenuto integrale di KB 03.
 */
export function buildRegolamento(testoKb03) {
  const { articoli, capitoli } = estraiRegolamento(testoKb03);
  return {
    fonte: {
      id: "REG-PALIO-2019",
      file: KB03_FILE,
      sezione: "Parte III — Regolamento per il Palio",
      sha256: "a09afe7b863f7b1b5329f8fb069503a59dc67b92053c3a156b7d62ce9855b86d",
      pagine: 82,
      byte: 1988492,
    },
    capitoli,
    articoli,
  };
}

/** Lettura diretta dalla fonte canonica, usata dal generatore principale. */
export function buildRegolamentoDaFile(percorso) {
  return buildRegolamento(readFileSync(percorso, "utf-8"));
}

/**
 * Gate strutturali dell'articolato. Restituisce l'elenco dei problemi: un
 * elenco non vuoto deve bloccare la generazione.
 */
export function verificaRegolamento(regolamento, attesi) {
  const problemi = [];
  const { articoli } = regolamento;

  if (articoli.length !== attesi.articoliRegolamento) {
    problemi.push(
      `unità articolo del Regolamento: ${articoli.length} invece di ${attesi.articoliRegolamento}`
    );
  }
  if (regolamento.capitoli.length !== attesi.capitoliRegolamento) {
    problemi.push(
      `capitoli del Regolamento: ${regolamento.capitoli.length} invece di ${attesi.capitoliRegolamento}`
    );
  }

  const numeri = articoli.map((a) => a.numero);
  const ordinari = numeri.filter((n) => /^\d+$/.test(n)).map(Number);
  const attesiOrdinari = Array.from({ length: 105 }, (_, i) => i + 1);
  if (JSON.stringify(ordinari) !== JSON.stringify(attesiOrdinari)) {
    const mancanti = attesiOrdinari.filter((n) => !ordinari.includes(n));
    const duplicati = ordinari.filter((n, i) => ordinari.indexOf(n) !== i);
    problemi.push(
      "numerazione ordinaria del Regolamento non continua da 1 a 105" +
        (mancanti.length ? ` — mancanti: ${mancanti.join(", ")}` : "") +
        (duplicati.length ? ` — duplicati: ${[...new Set(duplicati)].join(", ")}` : "")
    );
  }

  const indiceBis = numeri.indexOf("99bis");
  if (indiceBis === -1) {
    problemi.push("art. 99-bis assente dall'articolato del Regolamento");
  } else if (numeri[indiceBis - 1] !== "99" || numeri[indiceBis + 1] !== "100") {
    problemi.push("art. 99-bis non collocato fra l'art. 99 e l'art. 100");
  }

  for (const [etichetta, valori] of [
    ["numeri degli articoli del Regolamento", numeri],
    ["ancore degli articoli del Regolamento", articoli.map((a) => a.anchor)],
    ["etichette degli articoli del Regolamento", articoli.map((a) => a.etichetta)],
  ]) {
    const duplicati = valori.filter((v, i) => valori.indexOf(v) !== i);
    if (duplicati.length) {
      problemi.push(`${etichetta}: duplicati ${[...new Set(duplicati)].join(", ")}`);
    }
  }

  for (const articolo of articoli) {
    if (!/^articolo-(?:\d+|\d+-bis)$/.test(articolo.anchor)) {
      problemi.push(`ancora non conforme per ${articolo.etichetta}: ${articolo.anchor}`);
    }
    if (articolo.corpo.trim() === "") {
      problemi.push(`corpo vuoto per ${articolo.etichetta}`);
    }
    if (articolo.capitolo === null) {
      problemi.push(`${articolo.etichetta} non è assegnato ad alcun capitolo`);
    }
    // Nessun residuo di paginazione o di marcatore di struttura nel corpo.
    if (/<!--|-->/.test(articolo.corpo)) {
      problemi.push(`residuo di marcatore di paginazione in ${articolo.etichetta}`);
    }
    if (/^\s*#/m.test(articolo.corpo)) {
      problemi.push(`intestazione Markdown residua in ${articolo.etichetta}`);
    }
  }

  // L'ultimo articolo deve chiudere l'articolato senza inglobare gli allegati.
  const ultimo = articoli[articoli.length - 1];
  if (ultimo && (/ALLEGATO/.test(ultimo.corpo) || /INDICE GENERALE/.test(ultimo.corpo))) {
    problemi.push("l'art. 105 ingloba materiale successivo all'articolato");
  }

  return problemi;
}
