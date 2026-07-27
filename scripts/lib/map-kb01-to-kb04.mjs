// Mappa ogni atto KB01 al proprio record di registro PE-YYYY-NN in KB04,
// verificando la corrispondenza tramite anno + numero di delibera (campo
// "Atto" del record), NON per sola posizione/ordine nel documento (anche se
// nel corpus attuale l'ordine coincide, la spec §2 richiede una verifica
// esplicita contro il registro canonico, non un'inferenza posizionale).
//
// v3.1.1 §3 — il mapping e' GENUINAMENTE a due livelli: `verifiedBy` assume
// SOLO uno dei due valori "actNumberMatch" o "yearOnlyFallback", mai un
// terzo valore. Per 2013 e 2020, il titolo KB01 non riporta un numero di
// atto ma il campo "Atto" del record KB04 candidato ne riporta uno
// (rispettivamente "Commissario straordinario n. 11" e "G.C. n. 51"): questa
// e' evidenza SUPPLEMENTARE, registrata nel campo `registerAttoEvidence` di
// quella stessa voce yearOnlyFallback -- NON una promozione a una classe di
// verifica diversa. La classificazione resta yearOnlyFallback (provvisoria,
// da confermare manualmente da Fabrizio Gabrielli sugli originali) finche'
// non arriva conferma esplicita: l'evidenza supplementare non cambia MAI la
// classe di verifica da sola. (Prima di questa correzione, il codice
// assegnava un terzo valore letterale "registerAttoMatch" a `verifiedBy`
// per questi 2 anni: un vero e proprio terzo livello nell'inventario
// dettagliato, che il report aggregato poi ri-etichettava come
// yearOnlyFallback solo nei conteggi -- contraddizione fra inventario
// dettagliato e sintesi che questa versione elimina alla radice.)

import { parseKb01, classifyActs } from "./parse-kb01.mjs";
import { parseKb04 } from "./parse-kb04.mjs";

// Estrae il numero di delibera/atto dal titolo KB01, es.
// "Deliberazione G.C. n. 133 del 20 marzo 2014 - Modifica..." -> "133"
const ACT_NUMBER_RE = /n\.\s*(\d+)/;

// Estrae il numero di atto dal campo "Atto" del record KB04, es.
// "G.C. n. 51" -> "51", "Commissario straordinario n. 11" -> "11".
// La stringa placeholder "non presente nel documento acquisito" non
// contiene "n. <numero>" e quindi non produce match (correttamente).
const REGISTER_ATTO_NUMBER_RE = /n\.\s*(\d+)/;

export function mapKb01ActsToKb04(raw01, raw04) {
  const { years } = parseKb01(raw01);
  const acts = classifyActs(years);
  const { peRecords } = parseKb04(raw04);

  const mapping = [];
  const unmatchedActs = [];
  const usedRecordIds = new Set();

  for (const act of acts) {
    const actNumMatch = act.title.match(ACT_NUMBER_RE);
    const actNum = actNumMatch ? actNumMatch[1] : null;

    // Candidati KB04 dello stesso anno.
    const candidates = peRecords.filter((r) => r.title.includes(String(act.year)) || r.id.startsWith(`PE-${act.year}-`));

    let match = null;
    let verifiedBy = null;
    let registerAttoEvidence = null;

    if (actNum) {
      match = candidates.find((r) => {
        const attoField = r.fields["Atto"] || "";
        return attoField.includes(`n. ${actNum}`) && !usedRecordIds.has(r.id);
      });
      if (match) verifiedBy = "actNumberMatch";
    }

    // Il titolo KB01 non riporta un numero di atto. Prova comunque a
    // trovare un record KB04 univoco per l'anno (fallback puro per anno).
    // Se quel record ha un campo "Atto" con un numero esplicito, quel
    // numero e' registrato come evidenza SUPPLEMENTARE (registerAttoEvidence)
    // sulla stessa voce yearOnlyFallback -- v3.1.1 §3: non promuove MAI la
    // classificazione a una terza classe di verifica. Resta yearOnlyFallback
    // (provvisorio) finche' Fabrizio Gabrielli non conferma manualmente sugli
    // originali.
    if (!match) {
      match = candidates.find((r) => !usedRecordIds.has(r.id));
      if (match) {
        verifiedBy = "yearOnlyFallback";
        const attoField = match.fields["Atto"] || "";
        if (REGISTER_ATTO_NUMBER_RE.test(attoField)) {
          registerAttoEvidence = { present: true, value: attoField };
        }
      }
    }

    if (match) {
      usedRecordIds.add(match.id);
      mapping.push({
        actYear: act.year,
        actTitle: act.title,
        actKind: act.kind,
        registerId: match.id,
        registerAtto: match.fields["Atto"] || null,
        verifiedBy,
        ...(registerAttoEvidence ? { registerAttoEvidence } : {}),
      });
    } else {
      unmatchedActs.push({ year: act.year, title: act.title });
    }
  }

  const unmatchedRegisterRecords = peRecords.filter((r) => !usedRecordIds.has(r.id));

  return { mapping, unmatchedActs, unmatchedRegisterRecords };
}
