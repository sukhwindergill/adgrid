// RETIRED. This legacy GBP PaymentIntent path is superseded by `charge-campaign`
// (off-session card charge, dynamic CAD/USD currency). Kept as a 410 stub so the
// wrong-currency endpoint can't be called while the deployment is removed.
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
