// Parser diagnostico per KB 02 — Memoria incrementale del Protocollo Equino.
//
// Struttura: sezioni H1 numerate (1..6), con la sezione "5. Cronologia
// incrementale" organizzata per annualita' H2 ("## YYYY — <titolo>"), a sua
// volta suddivisa in sotto-sezioni H3 (Operazioni, Nota documentale,
// Modifica del ..., Conseguenza storica, ecc.), ciascuna con elenchi puntati
// marcati da un tag fra parentesi quadre: [BASE] [CONFERMA] [MODIFICA]
// [AGGIUNTA] [SOPPRESSIONE] [RIPRISTINO] [CORREZIONE] [ANNUALE].
//
// Regola ID stabili (§7 del prompt v3, corretta in v3.1 dopo la prova di
// instabilita' fornita nel tool review): NON usare il numero di riga NE'
// un ordinale posizionale locale (un ordinale che riparte da 0 per
// sotto-sezione e' comunque instabile: inserire un bullet PRIMA di un
// altro nella stessa sotto-sezione cambia l'ordinale di tutti i bullet
// successivi). Usare invece un percorso semantico stabile: per le sezioni
// pre-cronologia, slug del titolo H1/H2/H3; per le voci di cronologia
// annuale, l'anno + lo slug della sotto-sezione H3 + il tag + uno slug
// derivato dal CONTENUTO del bullet (v. kb02ContentSlug in stable-ids.mjs).
// Questo dipende solo dal testo di quel bullet, quindi resta identico
// indipendentemente da quanti altri bullet vengono inseriti prima o dopo,
// nella stessa sotto-sezione o altrove nel documento.

import { kb02ContentSlug, kb02BulletId } from "./stable-ids.mjs";

const H1_RE = /^#\s+(.+)$/;
const H2_RE = /^##\s+(.+)$/;
const H3_RE = /^###\s+(.+)$/;
const YEAR_H2_RE = /^##\s+(\d{4})\s*[—–-]\s*(.+)$/;
// v3.1 §3/§9: la regex originale non ammetteva spazi dentro le parentesi
// quadre del tag, quindi bullet con tag composti ("MODIFICA FORMALE",
// "AGGIUNTA NELLA DELIBERAZIONE", "SOPPRESSIONE DAL PROTOCOLLO" —
// verificati presenti nel corpus reale via grep) venivano scartati in
// silenzio, senza generare candidato NE finding di errore. Corretto per
// ammettere anche spazi singoli fra parole maiuscole nel tag.
const TAG_BULLET_RE = /^-\s+\*\*\[([A-ZÀ-Ú]+(?:\s[A-ZÀ-Ú]+)*)\]\*\*\s+(.+)$/;

export const VALID_TAGS = [
  "BASE",
  "CONFERMA",
  "MODIFICA",
  "MODIFICA FORMALE",
  "AGGIUNTA",
  "AGGIUNTA NELLA DELIBERAZIONE",
  "SOPPRESSIONE",
  "SOPPRESSIONE DAL PROTOCOLLO",
  "RIPRISTINO",
  "CORREZIONE",
  "ANNUALE",
];

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // rimuove accenti per lo slug (solo per l'ID, non per il testo visualizzato)
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function parseKb02(raw) {
  const lines = raw.split("\n");
  const totalLines = lines.length;

  let frontMatterEndLine = 0;
  if (lines[0] === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === "---") {
        frontMatterEndLine = i + 1;
        break;
      }
    }
  }

  /** @type {Array<{year:number, title:string, headingLine:number, endLine:number, subsections: any[]}>} */
  const years = [];
  let currentYear = null;
  let currentSubsection = null;

  const nonYearH1Sections = [];
  const nonYearH2Sections = [];
  let inCronologia = false;
  let currentH1Section = null;

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i];

    const h1 = line.match(H1_RE);
    if (h1) {
      inCronologia = /^5\.\s*Cronologia incrementale/.test(h1[1].trim());
      currentYear = null;
      currentSubsection = null;
      currentH1Section = { title: h1[1].trim(), headingLine: lineNo, endLine: totalLines, slug: slugify(h1[1]) };
      nonYearH1Sections.push(currentH1Section);
      continue;
    }

    const yearH2 = line.match(YEAR_H2_RE);
    if (inCronologia && yearH2) {
      currentYear = {
        year: Number(yearH2[1]),
        title: yearH2[2].trim(),
        headingLine: lineNo,
        endLine: totalLines,
        subsections: [],
      };
      years.push(currentYear);
      currentSubsection = null;
      continue;
    }

    const h2 = line.match(H2_RE);
    if (h2 && !inCronologia) {
      nonYearH2Sections.push({ title: h2[1].trim(), headingLine: lineNo, slug: slugify(h2[1]) });
      continue;
    }

    const h3 = line.match(H3_RE);
    if (h3) {
      const slug = slugify(h3[1]);
      currentSubsection = {
        title: h3[1].trim(),
        slug,
        headingLine: lineNo,
        bullets: [],
      };
      if (currentYear) {
        currentYear.subsections.push(currentSubsection);
      } else {
        nonYearH2Sections.push({ title: h3[1].trim(), headingLine: lineNo, slug, isH3: true });
      }
      continue;
    }

    const bulletMatch = line.match(TAG_BULLET_RE);
    if (bulletMatch && currentSubsection) {
      const tag = bulletMatch[1];
      currentSubsection.bullets.push({
        tag,
        tagValid: VALID_TAGS.includes(tag),
        text: bulletMatch[2].trim(),
        line: lineNo,
        endLine: lineNo, // estesa sotto se seguono righe di sotto-elenco indentate
      });
      continue;
    }

    // Righe di sotto-elenco indentate ("  - ...") che continuano il bullet
    // taggato precedente (es. "[AGGIUNTA] Articolo 10 organico:" seguito da
    // un elenco indentato di punti) — v3.1 §3: prima venivano lasciate
    // "unexplained" perche' il candidato del bullet padre copriva solo la
    // propria riga singola.
    if (currentSubsection && currentSubsection.bullets.length > 0 && /^\s{2,}-\s+/.test(line)) {
      const lastBullet = currentSubsection.bullets[currentSubsection.bullets.length - 1];
      lastBullet.endLine = lineNo;
      continue;
    }
  }

  // Assegna a ogni bullet uno slug di contenuto stabile e un duplicateIndex
  // basato su QUANTE VOLTE quella stessa chiave semantica (tag+slug) e' GIA'
  // apparsa in questa sotto-sezione, nell'ordine di apparizione nel testo.
  // Non e' un ordinale di posizione generico: e' un contatore di occorrenze
  // di CONTENUTO IDENTICO, quindi resta 0 per ogni bullet il cui testo e'
  // unico nella sotto-sezione (la stragrande maggioranza dei casi), e non
  // cambia per un bullet esistente quando si inserisce un bullet con testo
  // DIVERSO altrove nella stessa sotto-sezione o nel documento.
  for (const y of years) {
    for (const sub of y.subsections) {
      const seenKeys = new Map();
      for (const b of sub.bullets) {
        const contentSlug = kb02ContentSlug(b.text);
        const key = `${b.tag}::${contentSlug}`;
        const dup = seenKeys.get(key) || 0;
        b.contentSlug = contentSlug;
        b.duplicateIndex = dup;
        seenKeys.set(key, dup + 1);
      }
    }
  }

  // endLine per ogni sezione H1 (comprese quelle di cronologia, che contengono anni al loro interno)
  for (let i = 0; i < nonYearH1Sections.length; i++) {
    nonYearH1Sections[i].endLine = nonYearH1Sections[i + 1]
      ? nonYearH1Sections[i + 1].headingLine - 1
      : totalLines;
  }

  // endLine per ogni annualita'.
  //
  // v3.1.2 §3 — l'annualita' e' una sotto-sezione della propria sezione H1
  // ("5. Cronologia incrementale") e non puo' estendersi oltre di essa.
  // Prima di questa correzione l'ultima annualita' (2026) riceveva
  // endLine = totalLines: il blocco 2026 risultava 373-601 e inghiottiva
  // le sei sezioni H1 di cornice successive (6...11, righe 394-601),
  // sovrapponendosi a esse. Il containment completo (§3) ha reso visibile
  // la sovrapposizione, perche' 6 tabelle della sezione di cornice "6.
  // Tracciato storico" risultavano contemporaneamente dentro l'annualita'
  // 2026 e dentro la propria sezione H1.
  for (let i = 0; i < years.length; i++) {
    const y = years[i];
    const owningH1 = nonYearH1Sections.find(
      (s) => y.headingLine >= s.headingLine && y.headingLine <= s.endLine
    );
    const nextBoundary = years[i + 1] ? years[i + 1].headingLine - 1 : totalLines;
    y.endLine = owningH1 ? Math.min(nextBoundary, owningH1.endLine) : nextBoundary;
  }

  // endLine per ogni sotto-sezione H3 dentro un anno (Operazioni, Nota
  // documentale, Conseguenza storica, ecc.): fino alla riga precedente la
  // prossima sotto-sezione H3, oppure la fine dell'anno se e' l'ultima.
  for (const y of years) {
    for (let i = 0; i < y.subsections.length; i++) {
      const sub = y.subsections[i];
      const next = y.subsections[i + 1];
      sub.endLine = next ? next.headingLine - 1 : y.endLine;
    }
  }

  // Righe di metadati dell'anno ("**Atto:** ...", "**Modifica:** ...",
  // "**Struttura:** ...") comprese fra il heading dell'anno e la prima
  // sotto-sezione H3.
  for (const y of years) {
    const firstSubHeading = y.subsections.length > 0 ? y.subsections[0].headingLine : y.endLine + 1;
    y.metadataStartLine = y.headingLine + 1;
    y.metadataEndLine = firstSubHeading - 1;
  }

  return { totalLines, frontMatterEndLine, years, nonYearH1Sections };
}

/**
 * Genera l'ID pubblico stabile per una singola voce di cronologia annuale,
 * delegando allo schema kb02BulletId (anno + slug sotto-sezione + tag +
 * slug del contenuto del bullet + duplicateIndex). Richiede che il bullet
 * sia stato arricchito da parseKb02 con contentSlug/duplicateIndex.
 */
export function bulletPublicId(year, subsection, bullet) {
  return kb02BulletId(year, subsection.slug, bullet.tag, bullet.contentSlug, bullet.duplicateIndex);
}
