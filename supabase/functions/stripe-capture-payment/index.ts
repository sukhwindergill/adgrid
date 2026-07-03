// LEGACY / SUPERSEDED. Paired with the old `stripe-create-intent` manual-capture
// path; the live flow is `charge-campaign`. Kept for provenance.
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
    const { payment_intent_id, amount_cents } = await req.json()

    if (!payment_intent_id) {
      return new Response(
        JSON.stringify({ error: 'Missing payment_intent_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const paymentIntent = await stripe.paymentIntents.capture(payment_intent_id, {
      amount_to_capture: amount_cents,
    })

    const chargeId = paymentIntent.latest_charge as string

    return new Response(
      JSON.stringify({ charge_id: chargeId, status: paymentIntent.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
