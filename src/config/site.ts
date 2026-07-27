/**
 * Configurazione centrale dei valori esterni riutilizzati su più pagine.
 * Nessun URL esterno va scritto due volte direttamente in un file .astro:
 * importare da qui (§13 della revisione scaffold/chunking, 26/07/2026).
 */

export const SITE_NAME =
  import.meta.env.PUBLIC_SITE_NAME ?? "Fonti del Palio";

export const SITE_URL =
  import.meta.env.PUBLIC_SITE_URL ?? "https://fontidelpalio.it";

// Decisione di governance M1 (27/07/2026), definitiva.
// Pistakkio® è accreditato come ideatore e curatore TECNICO del progetto
// (technical originator and curator), non come titolare esclusivo del
// copyright: la titolarità del codice è "Fonti del Palio contributors"
// sotto licenza MIT. Vedi NOTICE.md.
export const PISTAKKIO_URL = "https://www.pistakkio.net/";
export const PISTAKKIO_LABEL = "Pistakkio®";

// Repository pubblico al rilascio M1 (decisione di governance del 27/07/2026).
export const GITHUB_URL: string | null = "https://github.com/dragomanno/fonti-del-palio";
export const GITHUB_LABEL = "GitHub";

/** Descrizione pubblica ufficiale del progetto, in inglese, da non riformulare. */
export const PROJECT_DESCRIPTION_EN =
  "Fonti del Palio is a free, non-profit civic and documentary side project by Fabrizio Gabrielli, founder of Pistakkio®.";

/** Licenza del codice sorgente. Non copre il corpus documentale. */
export const SOFTWARE_LICENSE = "MIT";
export const COPYRIGHT_NOTICE = "Copyright (c) 2026 Fonti del Palio contributors";
