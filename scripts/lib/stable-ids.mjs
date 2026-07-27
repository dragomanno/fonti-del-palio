// Generatori di ID pubblici stabili (§7 del prompt v3).
//
// Regola: nessun ID deve dipendere da numero di riga, hash di contenuto,
// posizione incidentale nell'array, o conteggi totali. Gli hash di
// contenuto restano disponibili come metadato SEPARATO (per il change
// detection), ma non fanno parte dell'identita' pubblica del candidato.
//
// Schema (esempi dal prompt):
//   kb01:pe-2014-01:articolo-5
//   kb01:pe-2014-02:modifica-articolo-5
//   kb03:protocollo-2026:articolo-1
//   kb03:coordinamento-regolamento:articolo-37
//   kb03:regolamento-palio:articolo-37
//   kb04:att-2026-ord-005

/**
 * ID per un articolo ordinario di KB01, ancorato al registro (PE-YYYY-NN),
 * non al numero di riga o alla posizione dell'atto nell'array.
 */
export function kb01ArticleId(registerId, articleNumber) {
  return `kb01:${registerId.toLowerCase()}:articolo-${articleNumber}`;
}

/**
 * ID per un punto di modifica (amendment point) di un atto di modifica KB01.
 * Distinto dall'ID dell'articolo target che modifica.
 */
export function kb01AmendmentPointId(registerId, targetArticleNumber, extra) {
  const suffix = extra ? `-${extra}` : "";
  return `kb01:${registerId.toLowerCase()}:modifica-articolo-${targetArticleNumber}${suffix}`;
}

/**
 * ID per un articolo di KB03, ancorato allo scope documentale del blocco H1
 * che lo contiene (non alla riga). Lo stesso numero di articolo (es. 37)
 * produce ID diversi in scope diversi (coordinamento-regolamento vs
 * regolamento-palio), che e' esattamente il comportamento richiesto per
 * evitare collisioni tra i due sistemi di numerazione paralleli.
 */
export function kb03ArticleId(scope, articleNumber) {
  return `kb03:${scope}:articolo-${articleNumber}`;
}

/**
 * ID per la tabella atomica delle medicazioni controllate in KB03.
 */
export function kb03ControlledMedicationsTableId(scope) {
  return `kb03:${scope}:tabella-medicazioni-controllate`;
}

/**
 * ID per un record del registro KB04: riusa l'ID naturale gia' presente
 * nell'heading del documento (PE-/RP-/ATT-/LEG-), che e' di per se' stabile
 * (non dipende da riga/posizione). Normalizzato in minuscolo per coerenza
 * con gli altri schemi.
 */
export function kb04RecordId(naturalId) {
  return `kb04:${naturalId.toLowerCase()}`;
}

/**
 * Slug semantico stabile derivato dal TESTO del bullet (non dalla riga o
 * dalla posizione nell'array). Usa le prime parole significative del testo,
 * normalizzate: e' stabile per costruzione rispetto all'inserimento di
 * qualsiasi altro bullet, prima o dopo, nella stessa sotto-sezione o
 * altrove nel documento, perche' dipende solo dal contenuto del bullet
 * stesso.
 */
export function kb02ContentSlug(text, maxWords = 6) {
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords);
  return words.join("-") || "voce";
}

/**
 * ID per una voce di cronologia di KB02 (bullet taggato), ancorato ad
 * anno + slug della sotto-sezione H3 + tag + slug semantico del CONTENUTO
 * del bullet. Non dipende dal numero di riga assoluto ne' da un ordinale
 * posizionale nell'array: inserire un nuovo bullet prima o dopo, nella
 * stessa sotto-sezione o altrove nel documento, non altera l'ID di nessun
 * bullet esistente, perche' l'ID e' funzione del contenuto di QUEL bullet.
 *
 * `duplicateIndex` e' 0 per il primo bullet con una data chiave semantica
 * (tag+slug) in una sotto-sezione, e n per l'n-esimo bullet che condivide
 * esattamente la stessa chiave semantica (caso raro di testo duplicato
 * verbatim) — e' un contatore di OCCORRENZE DI CONTENUTO IDENTICO, non un
 * indice di posizione: se si inserisce un bullet CON TESTO DIVERSO altrove,
 * duplicateIndex non cambia per nessun bullet esistente.
 */
export function kb02BulletId(year, subsectionSlug, tag, contentSlug, duplicateIndex = 0) {
  const suffix = duplicateIndex > 0 ? `-${duplicateIndex}` : "";
  return `kb02:${year}:${subsectionSlug}:${tag.toLowerCase()}:${contentSlug}${suffix}`;
}

/**
 * ID per una tabella Markdown atomica generica, ancorata allo scope
 * documentale + uno slug derivato dalla prima cella dell'header (mai dalla
 * riga). Se piu' tabelle nello stesso scope avessero lo stesso slug header
 * (raro), un discriminante di contenuto (prima cella della prima riga dati)
 * distingue le istanze senza dipendere dalla posizione.
 */
export function tableId(scope, headerSlug, disambiguator) {
  const suffix = disambiguator ? `:${disambiguator}` : "";
  return `${scope}:tabella-${headerSlug}${suffix}`;
}

/**
 * ID per un candidato semantico H2/H3/H4 (sezione con contenuto proprio,
 * non un articolo numerato), ancorato allo scope documentale + percorso di
 * heading slugificato (mai alla riga).
 */
export function semanticSectionId(scope, headingPathSlugs) {
  return `${scope}:${headingPathSlugs.join(":")}`;
}
