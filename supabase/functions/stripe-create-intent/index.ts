// LEGACY / SUPERSEDED. This on-session PaymentIntent path (currency hardcoded to
// GBP) predates the live advertiser flow, which now uses `charge-campaign`
// (off-session card charge with dynamic CAD/USD currency). Kept in source control
// for provenance; retire once confirmed no client calls it.
import Stripe from 'npm:stripe@14'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { campaign_id, advertiser_id, amount_cents } = await req.json()

    if (!campaign_id || !advertiser_id || !amount_cents) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: 'gbp',
      capture_method: 'manual',
      metadata: { campaign_id, advertiser_id },
      description: `ADGRID campaign ${campaign_id}`,
    })

    return new Response(
      JSON.stringify({
        payment_intent_id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
