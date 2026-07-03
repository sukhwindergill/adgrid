// LEGACY / SUPERSEDED. Stripe Checkout redirect flow (currency hardcoded to GBP)
// that also writes bookings.stripe_checkout_session by a non-existent
// `campaign_id` column (no-op). The live flow is `charge-campaign` +
// `setup-billing`. Kept for provenance; retire once confirmed unused.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-04-10' });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  try {
    const { campaign_id, budget, advertiser_email } = await req.json();
    if (!campaign_id || !budget) {
      return new Response(JSON.stringify({ error: 'campaign_id and budget required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: advertiser_email,
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: { name: `Campaign #${campaign_id}` },
          unit_amount: Math.round(budget * 100),
        },
        quantity: 1,
      }],
      metadata: { campaign_id },
      success_url: `${siteUrl}/adv-billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/adv-campaigns`,
    });

    // Store checkout session id on booking
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    await supabase
      .from('bookings')
      .update({ stripe_checkout_session: session.id })
      .eq('campaign_id', campaign_id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
