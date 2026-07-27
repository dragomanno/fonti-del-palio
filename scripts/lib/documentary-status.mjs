// ---------------------------------------------------------------------------
// Contratto di stato documentario a quattro dimensioni (v3.1.2 §1).
//
// Sostituisce la classificazione sintetica {state:"final", verifiedBy:"structural"}
// che v3.1.1 applicava identica a tutti i 710 candidati.
//
// Le quattro dimensioni sono quelle gia' dichiarate dal progetto in
// ATTRIBUTION.md (riga 10) e in src/pages/metodologia.astro (sezione 03):
//
//   documentaryStatus  disponibilita' documentale
//   legalStatus        ruolo storico o efficacia legale
//   presenceStatus     presenza nell'annualita' successiva
//   researchStatus     stato della ricerca sulle fonti
//
// PRINCIPIO VINCOLANTE: questo modulo NON inferisce, NON normalizza e NON
// inventa valori di stato. Un valore compare in una dimensione solo se il
// letterale trovato nella fonte canonica coincide ESATTAMENTE con una voce
// di legenda canonica della KB 04. Qualunque altra formulazione viene
// conservata verbatim e marcata come documented-null "notYetEvaluated",
// perche' assegnarla a una dimensione richiederebbe una normalizzazione
// editoriale che questo strumento non e' autorizzato a compiere.
//
// Il vocabolario NON e' codificato a mano: viene letto a runtime dal testo
// della KB 04, cosi' che ogni valore ammesso abbia un numero di riga reale
// e verificabile nella fonte canonica.
// ---------------------------------------------------------------------------

export const STATUS_DIMENSIONS = Object.freeze([
  "documentaryStatus",
  "legalStatus",
  "presenceStatus",
  "researchStatus",
]);

export const DOCUMENTED_NULL_REASONS = Object.freeze([
  // La fonte canonica associata e' stata ispezionata e non documenta questa
  // dimensione per questo candidato.
  "notDocumented",
  // La dimensione non e' applicabile alla natura del candidato (es. efficacia
  // legale di una sezione dichiarata non-chunkable dal parser, cioe' testo
  // redazionale di istruzioni e non disposizione documentaria).
  "notApplicable",
  // Esiste un letterale documentato, ma non coincide esattamente con una voce
  // di legenda canonica: l'assegnazione richiede valutazione editoriale non
  // ancora svolta. Vale anche per presenceStatus, che la metodologia tratta
  // come controllo editoriale vincolante e non come derivazione automatica.
  "notYetEvaluated",
]);

// Crosswalk dichiarato fra le voci di legenda della KB 04 e le quattro
// dimensioni. Ogni chiave DEVE esistere come voce di legenda nella KB 04:
// il gate verifica l'ancoraggio e fallisce se una chiave non e' piu'
// presente nella fonte. Nessuna voce e' assegnata a presenceStatus perche'
// la KB 04 non definisce alcun termine di legenda per quella dimensione.
export const KB04_LEGEND_CROSSWALK = Object.freeze({
  acquisito: "documentaryStatus",
  identificato: "documentaryStatus",
  "presente nel corpus": "documentaryStatus",
  "protocollo presente; atto di approvazione non incluso": "documentaryStatus",
  vigente: "legalStatus",
  "efficacia esaurita": "legalStatus",
  "efficacia annuale esaurita": "legalStatus",
  "superato/sostituito": "legalStatus",
  superato: "legalStatus",
  "testo efficace": "legalStatus",
  "ricerca aperta": "researchStatus",
});

// Campi dei record KB 04 che veicolano un letterale di stato, con la
// dimensione che il campo esprime secondo la legenda che lo governa.
//
// v3.1.3 §3: "Stato locale" riporta anche "researchStatus" come dimensione
// candidata, non solo "documentaryStatus". Il campo descrive nella prassi
// redazionale sia la disponibilita' documentale (es. "PDF presente nel
// corpus principale") sia lo stato di avanzamento della ricerca sulle fonti
// (es. "ricerca nell'Albo Pretorio e negli archivi da completare", "URL
// diretto identificato; PDF non trasferito nel pacchetto"): e' evidenza
// status-bearing per ENTRAMBE le dimensioni. Aggiungerlo come bersaglio non
// inventa ne' normalizza alcun valore: il letterale resta verbatim e, non
// coincidendo con alcuna voce del crosswalk (KB04_LEGEND_CROSSWALK non
// contiene ad oggi alcun letterale ricorrente di "Stato locale"), produce
// SEMPRE notYetEvaluated con il letterale e la fonte preservati -- mai piu'
// notDocumented quando il campo e' presente. Se in futuro un letterale di
// "Stato locale" coincidesse esattamente con una voce del crosswalk gia'
// assegnata a researchStatus (es. "ricerca aperta"), diventerebbe un valore
// canonico attraverso lo stesso meccanismo di resolveFromKb04Record, senza
// alcuna modifica a questo modulo.
export const KB04_STATUS_FIELDS = Object.freeze([
  { field: "Stato", dimensions: ["documentaryStatus", "legalStatus"] },
  { field: "Vigenza", dimensions: ["legalStatus"] },
  { field: "Stato locale", dimensions: ["documentaryStatus", "researchStatus"] },
]);

const LEGEND_BULLET_RE = /^-\s+\*\*([^:*]+):\*\*\s*(.*)$/;

// ---------------------------------------------------------------------------
// v3.1.3 §3: letterali di stato a livello di scope/front-matter in KB01-03.
//
// Il difetto originale non emetteva mai notDocumented in modo scorretto per
// QUESTI letterali -- semplicemente non li ingeriva mai in alcun contratto
// di stato: front-matter e' usato solo per l'esclusione dalla chunkabilita'
// (nonChunkable), e la tabella "Atti necessari" e' un candidato atomico
// unico la cui evidenza di riga (le celle di stato di ciascuna riga dati)
// non veniva mai letta. Questo modulo estrae quei letterali STRUTTURALMENTE
// (dal front-matter YAML e dall'header di colonna reale della tabella), non
// da un elenco cablato di valori: se il front-matter perde il campo
// "status" o la tabella perde la colonna "Stato nel corpus attuale", questa
// funzione semplicemente non trova piu' nulla da restituire, senza mai
// inventare un valore.
//
// Ogni hint prodotto e' un'evidenza status-bearing NON classificata: nessun
// letterale qui coincide con una voce di KB04_LEGEND_CROSSWALK (verificato
// per costruzione, il crosswalk e' derivato solo dalla legenda KB04), quindi
// buildDocumentaryStatus la rappresentera' sempre come notYetEvaluated con
// il letterale e la fonte preservati verbatim -- mai piu' come notDocumented
// quando l'evidenza esiste.
const FRONT_MATTER_STATUS_RE = /^status:\s*"([^"]*)"\s*$/;

/**
 * Estrae, per un singolo file grezzo KB01/KB02/KB03, il letterale dichiarato
 * dal campo "status" del front-matter YAML (fra le prime due righe "---"),
 * se presente. Ritorna null se il front-matter non esiste o non contiene
 * quel campo -- non inventa un valore di ripiego.
 */
export function extractFrontMatterStatusLiteral(rawText) {
  const lines = rawText.split("\n");
  if (lines[0] !== "---") return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return null;
  for (let i = 1; i < end; i++) {
    const m = lines[i].match(FRONT_MATTER_STATUS_RE);
    if (m) return { literal: m[1], line: i + 1 };
  }
  return null;
}

/**
 * Estrae, per un singolo file grezzo, ogni riga dati di ogni tabella
 * Markdown la cui intestazione contiene ESATTAMENTE la colonna "Stato nel
 * corpus attuale" (il nome reale della colonna nella KB 03, non un sinonimo
 * inventato). Per ciascuna riga dati ritorna la riga 1-based e il letterale
 * esatto della cella di quella colonna. Se nessuna tabella con quella
 * colonna esiste nel file, ritorna un array vuoto.
 */
export function extractTableRowStatusLiterals(rawText, detectAllMarkdownTables) {
  const lines = rawText.split("\n");
  const tables = detectAllMarkdownTables(rawText);
  const hints = [];
  for (const t of tables) {
    const statusColIdx = t.headerCells.findIndex((c) => c === "Stato nel corpus attuale");
    if (statusColIdx === -1) continue;
    if (t.firstDataLine === null || t.lastDataLine === null) continue;
    for (let ln = t.firstDataLine; ln <= t.lastDataLine; ln++) {
      const row = lines[ln - 1];
      // Ricostruzione robusta delle celle: split su "|" produce un primo e
      // un ultimo elemento vuoti quando la riga inizia/finisce con "|" (il
      // caso normale in queste tabelle); li scartiamo per allinearci a
      // headerCells, che e' filtrato allo stesso modo in detectAllMarkdownTables.
      const rawCells = row.split("|").map((c) => c.trim());
      const trimmedCells = rawCells[0] === "" ? rawCells.slice(1) : rawCells;
      const finalCells = trimmedCells[trimmedCells.length - 1] === "" ? trimmedCells.slice(0, -1) : trimmedCells;
      const literal = finalCells[statusColIdx];
      if (typeof literal === "string" && literal.length > 0) {
        hints.push({ line: ln, literal, headerLine: t.headerLine });
      }
    }
  }
  return hints;
}

/**
 * Costruisce l'elenco COMPLETO dell'evidenza di stato a livello di
 * scope/front-matter per KB01-KB03 (v3.1.3 §3): un letterale documentato
 * che NON e' mai stato ingerito nel contratto a quattro dimensioni di
 * alcun candidato (perche' non esiste un candidato di granularità fine
 * abbastanza da rappresentarlo, es. l'intero front-matter di un documento o
 * ciascuna riga di una tabella-lacune) ma che e' comunque status-bearing e
 * non deve essere silenziosamente assente dal referto.
 *
 * Ogni voce e' rappresentata come documented-null "notYetEvaluated" con il
 * letterale e la fonte preservati verbatim -- mai come "notDocumented"
 * (l'evidenza esiste ed e' stata ispezionata) e mai normalizzata a un
 * valore canonico (nessuno di questi letterali coincide con una voce del
 * crosswalk KB04_LEGEND_CROSSWALK, verificato per costruzione qui sotto).
 *
 * @param {{kb01:string, kb02:string, kb03:string}} rawByFile
 * @param {(raw:string)=>Array} detectAllMarkdownTablesFn
 * @returns {Array<{file:string, scope:string, kind:string, line:number, literal:string, dimension:string, documentedNull:object}>}
 */
export function buildScopeLevelStatusEvidence(rawByFile, detectAllMarkdownTablesFn) {
  const evidence = [];
  const FRONT_MATTER_SCOPE = { kb01: "corpus-storico-intro", kb02: "memoria-incrementale-cornice", kb03: "non-chunkable" };

  for (const file of ["kb01", "kb02", "kb03"]) {
    const raw = rawByFile[file];
    if (typeof raw !== "string") continue;
    const fm = extractFrontMatterStatusLiteral(raw);
    if (!fm) continue;
    const matchedDimension = KB04_LEGEND_CROSSWALK[fm.literal] || null;
    const dimension = matchedDimension || "documentaryStatus";
    evidence.push({
      file,
      scope: FRONT_MATTER_SCOPE[file],
      kind: "frontMatterStatus",
      line: fm.line,
      literal: fm.literal,
      dimension,
      documentedNull: {
        reason: "notYetEvaluated",
        explanation: `Il campo "status" del front-matter di ${file} riporta un letterale documentato che non coincide esattamente con alcuna voce di legenda canonica della KB 04; l'assegnazione a una dimensione classificata richiede valutazione editoriale non ancora svolta. Non esiste un candidato di granularità sufficiente a rappresentare questo letterale nel contratto a quattro dimensioni: è riportato qui come evidenza di stato a livello di documento.`,
        literal: fm.literal,
      },
    });
  }

  // KB03: tabella "Atti necessari per il consolidamento completo della
  // disciplina 2026" -- ogni riga dati porta un letterale nella colonna
  // "Stato nel corpus attuale" che il contratto per-candidato non puo'
  // rappresentare (la tabella e' UN candidato atomico con UNA sola entry
  // documentaryStatus, non otto).
  const raw03 = rawByFile.kb03;
  if (typeof raw03 === "string") {
    const rowHints = extractTableRowStatusLiterals(raw03, detectAllMarkdownTablesFn);
    for (const hint of rowHints) {
      const matchedDimension = KB04_LEGEND_CROSSWALK[hint.literal] || null;
      const dimension = matchedDimension || "documentaryStatus";
      evidence.push({
        file: "kb03",
        scope: "protocollo-2026",
        kind: "tableRowStatus",
        line: hint.line,
        literal: hint.literal,
        dimension,
        documentedNull: {
          reason: "notYetEvaluated",
          explanation: `La riga ${hint.line} della tabella "Atti necessari per il consolidamento completo della disciplina 2026" (KB 03) riporta un letterale nella colonna "Stato nel corpus attuale" che non coincide esattamente con alcuna voce di legenda canonica della KB 04; l'assegnazione a una dimensione classificata richiede valutazione editoriale non ancora svolta. Il candidato tabellare atomico che contiene questa riga non può rappresentare individualmente ciascuna delle otto righe nel proprio contratto a quattro dimensioni: è riportato qui come evidenza di stato a livello di riga.`,
          literal: hint.literal,
        },
      });
    }
  }

  return evidence;
}

/**
 * Estrae dal testo grezzo della KB 04 tutte le voci di legenda di stato,
 * con il numero di riga 1-based in cui ciascuna compare. Le voci sono
 * cercate nei blocchi introdotti dagli heading di legenda dichiarati dalla
 * KB stessa; se un heading atteso non esiste piu', il blocco semplicemente
 * non produce voci e il gate di ancoraggio fallira'.
 */
export function extractKb04StatusVocabulary(raw04) {
  const lines = raw04.split("\n");
  const LEGEND_HEADINGS = [/^##\s+Stati documentali\s*$/, /^##\s+Legenda dello stato\s*$/];
  const terms = new Map();
  let inLegend = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    if (/^#{1,6}\s+/.test(line)) {
      inLegend = LEGEND_HEADINGS.some((re) => re.test(line));
      continue;
    }

    // Le legende annuali della Parte II ripetono i termini di efficacia in
    // un elenco puntato preceduto da una riga esplicativa; le raccogliamo
    // anch'esse, perche' sono fonte canonica a tutti gli effetti.
    const bullet = line.match(LEGEND_BULLET_RE);
    if (!bullet) continue;
    const term = bullet[1].trim();
    if (!inLegend && !Object.prototype.hasOwnProperty.call(KB04_LEGEND_CROSSWALK, term)) continue;
    if (!terms.has(term)) {
      terms.set(term, { term, line: lineNo, gloss: bullet[2].trim() });
    }
  }

  return terms;
}

/**
 * Verifica che ogni chiave del crosswalk sia effettivamente ancorata a una
 * voce di legenda presente nella KB 04. Ritorna l'elenco delle chiavi non
 * ancorate (vuoto = crosswalk integralmente ancorato alla fonte canonica).
 */
export function findUnanchoredCrosswalkTerms(vocabulary) {
  return Object.keys(KB04_LEGEND_CROSSWALK).filter((term) => !vocabulary.has(term));
}

function canonicalValue(dimension, literal, sourceRef) {
  return {
    value: literal,
    documentedNull: null,
    source: sourceRef,
    inheritedFrom: null,
    dimension,
  };
}

function documentedNull(dimension, reason, explanation, sourceRef, literal = null) {
  return {
    value: null,
    documentedNull: { reason, explanation, literal },
    source: sourceRef,
    inheritedFrom: null,
    dimension,
  };
}

/**
 * Risolve le quattro dimensioni per un singolo record di registro KB 04,
 * cioe' per un candidato che E' esso stesso la fonte documentaria.
 */
function resolveFromKb04Record(record, vocabulary) {
  const out = {};
  for (const dim of STATUS_DIMENSIONS) out[dim] = null;

  for (const { field, dimensions } of KB04_STATUS_FIELDS) {
    const literal = record.fields ? record.fields[field] : undefined;
    const line = record.fieldLines ? record.fieldLines[field] : undefined;
    if (typeof literal !== "string" || literal.length === 0) continue;

    const matchedDimension = KB04_LEGEND_CROSSWALK[literal] || null;

    for (const dim of dimensions) {
      if (out[dim] !== null) continue;
      const sourceRef = {
        kind: matchedDimension === dim ? "canonicalValue" : "absenceChecked",
        file: "kb04",
        recordId: record.id,
        scope: "registro-fonti",
        field,
        line: typeof line === "number" ? line : null,
        literal,
      };
      if (matchedDimension === dim) {
        out[dim] = canonicalValue(dim, literal, sourceRef);
      } else if (matchedDimension === null) {
        out[dim] = documentedNull(
          dim,
          "notYetEvaluated",
          `Il campo "${field}" del record ${record.id} riporta un letterale documentato che non coincide esattamente con alcuna voce di legenda canonica della KB 04; l'assegnazione a una dimensione richiede valutazione editoriale non ancora svolta.`,
          sourceRef,
          literal
        );
      }
      // Se il letterale e' canonico ma appartiene a un'altra dimensione,
      // lasciamo out[dim] a null: sara' completato dai campi successivi o
      // dal fallback finale.
    }
  }

  return out;
}

/**
 * Costruisce il contratto di stato a quattro dimensioni per un candidato.
 *
 * @param candidate            il candidato diagnostico
 * @param ctx.vocabulary       Map termine -> {term,line,gloss} estratta dalla KB 04
 * @param ctx.kb04RecordsById  Map naturalId (es. "PE-2012-01") -> record KB 04
 * @param ctx.kb04CandidateIdByNaturalId Map naturalId -> id pubblico del candidato KB 04
 * @param ctx.mappingByRegisterId Map naturalId (registerId KB04) -> voce di
 *   `kb01Result.mapping` (v3.1.3 §1). Fonte UNICA di verita' per come un
 *   registerId e' stato risolto: `verifiedBy` vale "actNumberMatch" oppure
 *   "yearOnlyFallback", mai un terzo valore. Se assente (candidato non
 *   riconducibile a un atto KB01, es. il record KB04 stesso o un candidato
 *   di un'altra KB non derivato dal mapping), l'ereditarieta' non puo'
 *   dichiarare una resolutionMethod/provisional derivata dal mapping e
 *   ricade sul valore neutro non promosso definito sotto.
 */
export function buildDocumentaryStatus(candidate, ctx) {
  const { kb04RecordsById, kb04CandidateIdByNaturalId, vocabulary, mappingByRegisterId } = ctx;

  const isKb04Record = candidate.file === "kb04" && candidate.candidateType === "recordRegistro";
  const anchorNaturalId = isKb04Record
    ? candidate.naturalId
    : typeof candidate.registerId === "string"
      ? candidate.registerId
      : null;
  const anchorRecord = anchorNaturalId ? kb04RecordsById.get(anchorNaturalId) || null : null;

  const resolved = anchorRecord ? resolveFromKb04Record(anchorRecord, vocabulary) : {};

  const status = {};
  for (const dim of STATUS_DIMENSIONS) {
    let entry = resolved[dim] || null;

    if (entry === null) {
      // Nessun letterale documentato per questa dimensione.
      if (dim === "presenceStatus") {
        entry = documentedNull(
          dim,
          "notYetEvaluated",
          "La presenza nell'annualità successiva è un controllo editoriale vincolante (metodologia, sezione 04): la mancata riproduzione in un atto più recente non implica abrogazione. Nessuna fonte canonica la documenta per questo candidato e non è derivabile automaticamente.",
          anchorRecord
            ? {
                kind: "absenceChecked",
                file: "kb04",
                recordId: anchorRecord.id,
                scope: "registro-fonti",
                field: null,
                line: anchorRecord.headingLine,
                literal: null,
              }
            : {
                kind: "absenceChecked",
                file: candidate.file,
                recordId: null,
                scope: candidate.documentScope || null,
                field: null,
                line: candidate.startLine,
                literal: null,
              }
        );
      } else if (candidate.documentScope === "non-chunkable" && dim === "legalStatus") {
        entry = documentedNull(
          dim,
          "notApplicable",
          "Il parser dichiara questo candidato entro lo scope 'non-chunkable': testo redazionale di istruzioni d'uso della Knowledge Base, non disposizione documentaria. La dimensione di efficacia legale non è applicabile.",
          {
            kind: "absenceChecked",
            file: candidate.file,
            recordId: null,
            scope: candidate.documentScope,
            field: null,
            line: candidate.startLine,
            literal: null,
          }
        );
      } else if (anchorRecord) {
        entry = documentedNull(
          dim,
          "notDocumented",
          `Il record ${anchorRecord.id} della KB 04 è stato ispezionato sui campi di stato dichiarati (${KB04_STATUS_FIELDS.map((f) => f.field).join(", ")}) e non documenta questa dimensione.`,
          {
            kind: "absenceChecked",
            file: "kb04",
            recordId: anchorRecord.id,
            scope: "registro-fonti",
            field: null,
            line: anchorRecord.headingLine,
            literal: null,
          }
        );
      } else {
        entry = documentedNull(
          dim,
          "notDocumented",
          "Nessun record di registro della KB 04 è associato a questo candidato: le fonti canoniche non documentano questa dimensione a questo livello di granularità.",
          {
            kind: "absenceChecked",
            file: candidate.file,
            recordId: null,
            scope: candidate.documentScope || null,
            field: null,
            line: candidate.startLine,
            literal: null,
          }
        );
      }
    }

    // Ereditarieta' esplicita: se il valore (o l'assenza accertata) proviene
    // da un record KB 04 diverso dal candidato stesso, va dichiarata.
    //
    // v3.1.3 §1: resolutionMethod e provisional NON sono piu' hardcoded.
    // Quando l'ancora e' un registerId KB01->KB04 (es. "PE-2018-01"), la
    // voce REALE di kb01Result.mapping per quel registerId e' l'UNICA fonte
    // di verita' per come e' stato risolto: verifiedBy "actNumberMatch" ->
    // resolutionMethod "registerIdExactMatch"/provisional false; verifiedBy
    // "yearOnlyFallback" -> resolutionMethod "registerIdYearOnlyFallback"/
    // provisional true. Se il naturalId non compare nella mappa (candidato
    // non riconducibile a un atto KB01, es. i record KB04 diretti di altre
    // famiglie RP/ATT/LEG), non esiste alcuna voce di mapping da cui
    // derivare un metodo: si dichiara "directRecordReference"/provisional
    // false, perche' il candidato fa gia' riferimento diretto al proprio
    // naturalId KB04 senza passare per il mapping KB01->KB04.
    if (anchorRecord && !isKb04Record) {
      const targetCandidateId = kb04CandidateIdByNaturalId.get(anchorNaturalId) || null;
      const mappingEntry = mappingByRegisterId ? mappingByRegisterId.get(anchorNaturalId) || null : null;
      let resolutionMethod;
      let provisional;
      if (mappingEntry) {
        if (mappingEntry.verifiedBy === "actNumberMatch") {
          resolutionMethod = "registerIdExactMatch";
          provisional = false;
        } else if (mappingEntry.verifiedBy === "yearOnlyFallback") {
          resolutionMethod = "registerIdYearOnlyFallback";
          provisional = true;
        } else {
          throw new Error(
            `documentary-status: voce di mapping per ${anchorNaturalId} ha verifiedBy sconosciuto "${mappingEntry.verifiedBy}" (attesi solo "actNumberMatch" o "yearOnlyFallback")`
          );
        }
      } else {
        resolutionMethod = "directRecordReference";
        provisional = false;
      }
      entry.inheritedFrom = {
        ref: targetCandidateId,
        naturalId: anchorNaturalId,
        kind: "kb04RegisterRecord",
        resolutionMethod,
        provisional,
      };
    }

    status[dim] = entry;
  }

  return status;
}
