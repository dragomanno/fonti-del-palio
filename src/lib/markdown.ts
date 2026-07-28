/**
 * Resa Markdown -> HTML del testo documentario riprodotto dal corpus canonico.
 *
 * Il modulo esiste per una ragione precisa: la configurazione di `marked`
 * (opzioni e renderer personalizzato) deve essere applicata UNA sola volta.
 * Dentro il frontmatter di un componente Astro verrebbe rieseguita a ogni
 * render, accumulando estensioni a ogni chunk reso.
 *
 * Il testo delle celle e dei paragrafi non viene mai riscritto, riassunto,
 * abbreviato o normalizzato: e' riprodotto verbatim dai file canonici. Qui
 * cambiano soltanto il contenitore e gli attributi del markup.
 */
import { Marked } from "marked";

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const marked = new Marked({ gfm: true, breaks: false });

marked.use({
  renderer: {
    /**
     * Le tabelle del corpus usano il sistema `.doc-table` condiviso invece di
     * `display: block; overflow-x: auto`.
     *
     * La resa precedente trasformava la tabella in un blocco scorrevole: le
     * tecnologie assistive perdevano completamente la semantica tabellare e
     * l'associazione fra cella e intestazione, e su schermo stretto restava
     * solo lo scorrimento orizzontale. Qui il markup resta una tabella vera.
     */
    table(this: any, token: any): string {
      const parser = this.parser;
      const labels: string[] = token.header.map((cell: any) =>
        parser
          .parseInline(cell.tokens)
          .replace(/<[^>]*>/g, "")
          .trim(),
      );

      const head = token.header
        .map((cell: any) => `<th scope="col">${parser.parseInline(cell.tokens)}</th>`)
        .join("");

      const body = token.rows
        .map((row: any[]) => {
          const cells = row
            .map((cell: any, index: number) => {
              const content = parser.parseInline(cell.tokens);
              const label = escapeAttr(labels[index] ?? "");
              // La prima colonna delle tabelle del corpus e' la chiave della
              // riga (numero d'ordine o periodo): resa come intestazione di
              // riga, cosi' ogni cella resta associata a due intestazioni.
              return index === 0
                ? `<th scope="row" data-label="${label}" role="rowheader">${content}</th>`
                : `<td data-label="${label}" role="cell">${content}</td>`;
            })
            .join("");
          return `<tr role="row">${cells}</tr>`;
        })
        .join("");

      const classes = ["doc-table"];
      // Intestazione persistente solo dove la tabella e' abbastanza lunga da
      // uscire dallo schermo durante la lettura.
      if (token.rows.length >= 12) classes.push("doc-table--sticky");
      // Riflusso in schede etichettate quando la tabella non entra nello
      // schermo. Oltre le tre colonne serve gia' sotto i 768px; con tre
      // colonne soltanto sotto i 400px, dove la larghezza minima del
      // contenuto supera il viewport.
      if (labels.length > 3) classes.push("doc-table--reflow");
      else if (labels.length === 3) classes.push("doc-table--reflow-sm");

      return (
        `<div class="doc-table-wrap">` +
        `<table class="${classes.join(" ")}" role="table">` +
        `<thead role="rowgroup"><tr role="row">${head}</tr></thead>` +
        `<tbody role="rowgroup">${body}</tbody>` +
        `</table></div>\n`
      );
    },
  },
});

/** Converte in HTML il testo Markdown di un'unita' documentale. */
export function renderDocumentaryMarkdown(source: string): string {
  return marked.parse(source) as string;
}
