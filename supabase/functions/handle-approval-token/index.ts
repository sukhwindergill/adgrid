// supabase/functions/handle-approval-token/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return new Response(html('Invalid link', 'This link is missing a token.'), {
      status: 400, headers: { 'Content-Type': 'text/html' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: tokenRow, error: tokenErr } = await supabase
    .from('approval_tokens')
    .select('*')
    .eq('token', token)
    .single()

  if (tokenErr || !tokenRow) {
    return new Response(html('Invalid link', 'This approval link is invalid or has expired.'), {
      status: 404, headers: { 'Content-Type': 'text/html' },
    })
  }

  if (tokenRow.used) {
    return new Response(html('Already used', 'This approval link has already been used.'), {
      status: 400, headers: { 'Content-Type': 'text/html' },
    })
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return new Response(html('Expired', 'This approval link has expired. Please log in to approve from the dashboard.'), {
      status: 400, headers: { 'Content-Type': 'text/html' },
    })
  }

  const { campaign_id, screen_id, action } = tokenRow

  const newStatus = action === 'approve' ? 'approved' : 'rejected'
  await supabase.from('campaign_screens')
    .update({
      status: newStatus,
      approved_at: action === 'approve' ? new Date().toISOString() : null,
    })
    .eq('campaign_id', campaign_id)
    .eq('screen_id', screen_id)

  if (action === 'approve') {
    const { data: booking } = await supabase
      .from('bookings').select('start_when').eq('id', campaign_id).single()
    if (booking?.start_when === 'partial') {
      await supabase.from('bookings').update({ status: 'scheduled' }).eq('id', campaign_id)
    } else {
      const { data: remaining } = await supabase
        .from('campaign_screens').select('status').eq('campaign_id', campaign_id).eq('status', 'pending')
      if (!remaining || remaining.length === 0) {
        await supabase.from('bookings').update({ status: 'scheduled' }).eq('id', campaign_id)
      }
    }
  }

  await supabase.from('approval_tokens').update({ used: true }).eq('token', token)

  const msg = action === 'approve'
    ? 'Campaign approved! It will start running on your screen.'
    : 'Campaign rejected.'

  return new Response(html(action === 'approve' ? '✓ Approved' : '✗ Rejected', msg), {
    status: 200, headers: { 'Content-Type': 'text/html' },
  })
})

function html(title: string, message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ADGRID — ${title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa}.card{background:#fff;border-radius:12px;padding:40px;max-width:400px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08)}h1{font-size:28px;margin:0 0 12px}p{color:#525252;font-size:15px;line-height:1.6;margin:0}</style></head><body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`
}
