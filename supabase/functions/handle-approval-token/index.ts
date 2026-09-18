// supabase/functions/handle-approval-token/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { rateLimited, clientIp } from '../_shared/rateLimit.ts'
import { rejectedOutcome, pendingOutcome, chargeSucceededOutcome, chargeFailedOutcome } from '../_shared/approvalTokenOutcome.ts'

serve(async (req) => {
  const url = new URL(req.url)
  const isPost = req.method === 'POST'

  let token: string | null = null
  if (isPost) {
    const form = await req.formData()
    token = form.get('token')?.toString() ?? null
  } else {
    token = url.searchParams.get('token')
  }

  if (!token) {
    return new Response(html('Invalid link', 'This link is missing a token.'), {
      status: 400, headers: { 'Content-Type': 'text/html' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Public token-guess surface -- throttle per IP.
  if (await rateLimited(supabase, `handle-approval-token:${clientIp(req)}`, { limit: 20, windowSeconds: 60 })) {
    return new Response(html('Too many requests', 'Please try again in a minute.'), {
      status: 429, headers: { 'Content-Type': 'text/html' },
    })
  }

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

  // GET only ever renders a confirmation page — link scanners/prefetchers (Outlook
  // SafeLinks, Gmail image proxies, etc.) fetch GET links automatically, so the actual
  // mutation must live behind an explicit POST the operator triggers by clicking a button.
  if (!isPost) {
    const { data: booking } = await supabase
      .from('bookings').select('campaign_name, advertiser_name, screen_name').eq('id', campaign_id).single()

    const verb = action === 'approve' ? 'Approve' : 'Reject'
    const campaignLabel = booking?.campaign_name || campaign_id
    const advertiserLabel = booking?.advertiser_name ? ` by ${escapeHtml(booking.advertiser_name)}` : ''
    const screenLabel = booking?.screen_name || screen_id

    return new Response(confirmHtml(verb, escapeHtml(campaignLabel), advertiserLabel, escapeHtml(screenLabel), token), {
      status: 200, headers: { 'Content-Type': 'text/html' },
    })
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected'
  await supabase.from('campaign_screens')
    .update({
      status: newStatus,
      approved_at: action === 'approve' ? new Date().toISOString() : null,
    })
    .eq('campaign_id', campaign_id)
    .eq('screen_id', screen_id)

  let outcome = action === 'approve' ? pendingOutcome() : rejectedOutcome()

  if (action === 'approve') {
    const { data: booking } = await supabase
      .from('bookings').select('start_when').eq('id', campaign_id).single()
    const { data: remaining } = await supabase
      .from('campaign_screens').select('status').eq('campaign_id', campaign_id).eq('status', 'pending')
    const allClear = booking?.start_when === 'partial' || !remaining || remaining.length === 0

    if (allClear) {
      // Every other approval path (ApprovalQueue.jsx, mobile's
      // useApprovals.js, campaignActions.jsx's ApproveBtn, sweep-approvals)
      // charges the advertiser via charge-campaign the moment a campaign
      // clears every screen -- this email-link flow used to just flip
      // bookings.status to 'scheduled' directly, skipping payment entirely.
      // A campaign approved by clicking the email link would go live and
      // run without the advertiser ever being charged. Route through the
      // same internal-secret trusted-caller path sweep-approvals uses.
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/charge-campaign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': Deno.env.get('INTERNAL_NOTIFICATION_SECRET') ?? '',
        },
        body: JSON.stringify({ campaign_id }),
      })
      if (res.ok) {
        outcome = chargeSucceededOutcome()
      } else {
        const body = await res.json().catch(() => ({}))
        outcome = chargeFailedOutcome(body.error ?? 'Unknown error')
        if (outcome.scheduleWithoutCharge) {
          // Same "approve without charging" fallback every other approval
          // surface offers when the advertiser has no card on file yet --
          // there's no interactive confirm dialog on this static page, so
          // schedule it and say so plainly rather than leaving the operator
          // stuck with no way to approve at all.
          await supabase.from('bookings').update({ status: 'scheduled' }).eq('id', campaign_id)
        }
      }
    }
  }

  await supabase.from('approval_tokens').update({ used: true }).eq('token', token)

  return new Response(html(outcome.title, escapeHtml(outcome.msg)), {
    status: 200, headers: { 'Content-Type': 'text/html' },
  })
})

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function html(title: string, message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ADGRID — ${title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa}.card{background:#fff;border-radius:12px;padding:40px;max-width:400px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08)}h1{font-size:28px;margin:0 0 12px}p{color:#525252;font-size:15px;line-height:1.6;margin:0}</style></head><body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`
}

function confirmHtml(verb: string, campaignLabel: string, advertiserLabel: string, screenLabel: string, token: string): string {
  const isApprove = verb === 'Approve'
  const btnColor = isApprove ? '#16a34a' : '#dc2626'
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ADGRID — ${verb} campaign</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa}.card{background:#fff;border-radius:12px;padding:40px;max-width:420px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08)}h1{font-size:24px;margin:0 0 12px}p{color:#525252;font-size:15px;line-height:1.6;margin:0 0 24px}button{width:100%;padding:14px;font-size:16px;font-weight:600;color:#fff;background:${btnColor};border:none;border-radius:8px;cursor:pointer}button:hover{opacity:0.9}</style></head><body><div class="card"><h1>${verb} “${campaignLabel}”?</h1><p>Campaign${advertiserLabel} for screen <strong>${screenLabel}</strong>. This link is single-use — clicking the button below is final.</p><form method="POST"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit">${verb} campaign</button></form></div></body></html>`
}
