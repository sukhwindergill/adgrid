// RETIRED. Legacy manual-capture path, superseded by `charge-campaign`. 410 stub.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  return new Response(
    JSON.stringify({ error: "This endpoint has been retired. Use charge-campaign." }),
    { status: 410, headers: CORS },
  );
});
