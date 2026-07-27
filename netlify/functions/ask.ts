// PLACEHOLDER — endpoint /ask NON ancora implementato.
//
// Per decisione del 26/07/2026 (§7 "Static-first sequencing"), questo
// endpoint resta un placeholder architetturale finché il sito statico
// (milestone M0-M6, vedi data/static-site-milestone-plan.md) non è stato
// completato, deployato con AI_ENABLED=false e approvato.
//
// Architettura decisa per l'implementazione futura (da NON deviare senza
// nuova approvazione esplicita — vedi le 12 decisioni del 26/07/2026):
//
// 1. Guardia AI_ENABLED: se AI_ENABLED !== "true", rispondere 503 con un
//    messaggio che rimanda alla ricerca statica (Pagefind). NOTA: alla data
//    di questo commento la ricerca Pagefind stessa NON e' ancora implementata
//    nel sito statico (v1) -- e' pianificata, non presente. Il messaggio 503
//    dovra' riflettere lo stato reale della ricerca statica al momento in cui
//    questo endpoint verra' effettivamente implementato, non assumere che
//    Pagefind sia gia' disponibile.
// 2. Timeout applicativo totale ASK_TIMEOUT_MS (default 8000ms) via
//    AbortController — restituire 503 controllato PRIMA che Netlify
//    interrompa la funzione. Misurare separatamente i tempi di Turnstile,
//    rate limiting, retrieval, OpenAI (log strutturato, non nella risposta).
// 3. Validazione Turnstile: success, hostname (allowlist multi-hostname
//    TURNSTILE_ALLOWED_HOSTNAMES), action (TURNSTILE_EXPECTED_ACTION),
//    validità e monouso del token, tutto lato server.
// 4. Rate limiting: browser/IP/burst/globale applicati con UNA SOLA
//    operazione atomica (Lua script o equivalente) su Upstash Redis, per
//    evitare consumo parziale di contatori non correlati in caso di
//    richiesta respinta. Upstash Redis usato SOLO per contatori, nessuna
//    cache di domande/risposte in questa fase.
// 5. Retrieval sui chunk indicizzati (KBChunk), con citazioni verificabili:
//    ogni citation ID nella risposta finale deve provenire dal contesto
//    effettivamente recuperato — nessuna citazione inventata.
// 6. Chiamata al modello: OpenAI Responses API, OPENAI_MODEL=gpt-5-mini,
//    reasoning.effort=OPENAI_REASONING_EFFORT (default "low"; "minimal"
//    solo se confermato compatibile con SDK/tool-calling), max_output_tokens
//    =OPENAI_MAX_OUTPUT_TOKENS (default 3000, range 2500-4000). Nessun
//    fallback automatico a un secondo modello in questa beta
//    (OPENAI_FALLBACK_ENABLED=false di default).
// 7. Structured output tramite `text.format` (sintassi Responses API
//    corrente, verificata — NON il deprecato `response_format`).
// 8. Regressione: testare esplicitamente risposte vuote/troncate/con
//    schema incompleto causate da consumo di token di reasoning nascosti.
// 9. Categoria di test avversariali dedicata e bloccante al lancio per:
//    attribuzione a persone/enti nominati, sicurezza dei cavalli,
//    confusione tra annualità, confusione tra Protocollo e atti attuativi,
//    affermazioni di introduzione/abrogazione di una norma, responsabilità
//    legale/istituzionale non supportata.
//
// Nessuna di queste linee guida costituisce codice funzionante: questo
// file va sostituito con l'implementazione reale solo dopo l'approvazione
// del sito statico (M6) e la conferma delle regole di chunking definitive.

import type { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  return new Response(
    JSON.stringify({
      error: "not_implemented",
      message:
        "L'assistente AI non è ancora attivo. La ricerca documentale statica funziona comunque su /fonti e nelle pagine del sito.",
    }),
    { status: 503, headers: { "Content-Type": "application/json" } }
  );
};

export const config: Config = {
  path: "/.netlify/functions/ask",
};
