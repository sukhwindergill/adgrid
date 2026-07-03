// LEGACY / SUPERSEDED. Direct charge refund helper from the old manual-capture
// path. Refunds in the live flow are handled via the dashboard/Stripe and the
// `charge.refunded` webhook in `stripe-webhook`. Kept for provenance.
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
    const { charge_id, amount_cents, reason } = await req.json()

    if (!charge_id) {
      return new Response(
        JSON.stringify({ error: 'Missing charge_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const validReasons = ['duplicate', 'fraudulent', 'requested_by_customer']
    const refundReason = validReasons.includes(reason) ? reason : 'requested_by_customer'

    const refund = await stripe.refunds.create({
      charge: charge_id,
      ...(amount_cents && { amount: amount_cents }),
      reason: refundReason,
    })

    return new Response(
      JSON.stringify({ refund_id: refund.id, status: refund.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
