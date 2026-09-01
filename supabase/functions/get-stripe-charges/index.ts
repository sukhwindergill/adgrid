import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-04-10' });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // Verify caller via Supabase JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
    }

    // Check operator role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, stripe_connect_account_id, connect_status')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'operator') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS });
    }

    // BUG FIX: this previously called stripe.charges.list() with no
    // `stripeAccount`, which lists charges on the *platform's* Stripe
    // account — every operator calling this endpoint would see the same
    // platform-wide charge list (or none, depending on how charges are
    // created), not their own. Charges belonging to a specific operator only
    // exist on their Connect account, same as the balance/payouts lookup in
    // operator-billing/index.ts.
    if (!profile.stripe_connect_account_id || profile.connect_status !== 'active') {
      return new Response(JSON.stringify([]), { headers: CORS });
    }

    const charges = await stripe.charges.list(
      { limit: 50 },
      { stripeAccount: profile.stripe_connect_account_id },
    );
    const result = charges.data.map(c => ({
      id: c.id,
      amount: c.amount / 100,
      fee: c.application_fee_amount ? c.application_fee_amount / 100 : 0,
      currency: c.currency,
      status: c.status,
      created: new Date(c.created * 1000).toISOString(),
      description: c.description,
    }));

    return new Response(JSON.stringify(result), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
});
