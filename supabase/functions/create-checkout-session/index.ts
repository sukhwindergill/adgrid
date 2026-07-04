// RETIRED. Legacy GBP Stripe Checkout redirect flow, superseded by
// `charge-campaign` + `setup-billing`. 410 stub.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  return new Response(
    JSON.stringify({ error: "This endpoint has been retired. Use charge-campaign / setup-billing." }),
    { status: 410, headers: CORS },
  );
});
