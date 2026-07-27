// Endpoint di health-check, senza dati sensibili. Utile per verificare
// che le Netlify Functions siano deployate correttamente, indipendentemente
// dallo stato dell'endpoint AI.
import type { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  return new Response(
    JSON.stringify({
      status: "ok",
      aiEnabled: process.env.AI_ENABLED === "true",
      timestamp: new Date().toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const config: Config = {
  path: "/.netlify/functions/health",
};
