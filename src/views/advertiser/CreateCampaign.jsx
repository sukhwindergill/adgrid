// src/views/advertiser/CreateCampaign.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { ErrorBanner } from '../../components/primitives/ErrorBanner.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { formatCurrency } from '../../lib/formatCurrency.js';
import { haversineKm } from '../../lib/geo.js';
import { isValidDestinationUrl, normalizeDestinationUrl } from '../../lib/destinationUrl.js';
import { buildPreviewCampaign } from '../../lib/buildPreviewCampaign.js';
import { makeBlankCreative, reconcileAssignments } from '../../lib/creativeAssignment.js';
import { Stepper } from './createCampaign/Stepper.jsx';
import { StepTargeting } from './createCampaign/StepTargeting.jsx';
import { StepCreative } from './createCampaign/StepCreative.jsx';
import { StepBudgetReview } from './createCampaign/StepBudgetReview.jsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_LABELS = ['Targeting', 'Creative', 'Budget & Schedule'];

function StepPay({ campaign, onPay, onSkip, paying, err, requiresAction, onGoToBilling }) {
  return (
    <div style={{ maxWidth: 580, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 8px' }}>Pay for your campaign</h2>
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, margin: '0 0 24px' }}>
          Charge {formatCurrency(campaign.budget, campaign.currency)} to your card on file. Screens won't go live until payment is captured.
        </p>

        {requiresAction ? (
          <div style={{
            padding: '14px 16px', borderRadius: 10, marginBottom: 16,
            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24', fontFamily: F.sans, marginBottom: 4 }}>
              Card authentication required
            </div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 12 }}>
              Your card requires additional verification. Update your payment method and try again.
            </div>
            <Btn onClick={onGoToBilling} style={{ fontSize: 13, padding: '8px 16px' }}>
              Go to Billing →
            </Btn>
          </div>
        ) : (
          err && <ErrorBanner message={err} onDismiss={() => {}} />
        )}

        <Btn onClick={onPay} disabled={paying || requiresAction} style={{ width: '100%', fontSize: 15, padding: '14px 24px', marginBottom: 10 }}>
          {paying ? 'Charging…' : `Pay now — ${formatCurrency(campaign.budget, campaign.currency)}`}
        </Btn>
        <Btn variant="secondary" onClick={onSkip} disabled={paying} style={{ width: '100%' }}>
          Pay later
        </Btn>
      </Card>
    </div>
  );
}

// ─── Main Wizard ─────────────────────────────────────────────────────────────

export function CreateCampaign({ onSave, onCancel, dbScreens = [], screensLoading = false, campaigns = [], existingCampaign = null }) {
  const { user, profile, activeAccount } = useAuth();
  const navigate = useNavigate();
  const isDelegate = activeAccount && !activeAccount.isOwn;
  const canChooseBilling = isDelegate && ['admin', 'manager'].includes(activeAccount?.role);
  const [billedTo, setBilledTo] = useState('client'); // 'client' | 'agency'
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState(null);
  const [showDupModal, setShowDupModal] = useState(false);
  const [created, setCreated] = useState(null);
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState(null);
  const [requiresAction, setRequiresAction] = useState(false);

  const [form, setForm] = useState({
    name: '',
    area_type: 'city',
    country: 'CA',
    state: '',
    city: '',
    radius_center_lat: null,
    radius_center_lon: null,
    radius_km: 10,
    env_filter: 'any',
    venue_filter: '',
    selected_screen_ids: [],
    creatives: [],  // StepCreative lazily seeds a blank one; see BLANK_CREATIVE there
    budget_level: 'unified',
    budget_mode: 'total',
    budget: '',
    start_date: '',
    end_date: '',
    schedule_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    time_start: '07:00',
    time_end: '22:00',
    duration: 15,
    slots: 10,
    start_when: 'partial',
  });

  // Screen matching
  const matchedScreens = (() => {
    // Exclude inactive and screens not seen in the last 7 days (stale-live)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let screens = dbScreens.filter(s =>
      s.status !== 'inactive' &&
      (s.last_seen == null || s.last_seen >= sevenDaysAgo || s.status === 'pending')
    );
    if (form.area_type === 'country') {
      screens = screens.filter(s => s.country === form.country);
    } else if (form.area_type === 'state') {
      screens = screens.filter(s => s.country === form.country && s.state?.toLowerCase() === form.state.toLowerCase());
    } else if (form.area_type === 'city') {
      screens = screens.filter(s => s.city?.toLowerCase() === form.city.toLowerCase());
    } else if (form.area_type === 'radius') {
      const lat = form.radius_center_lat;
      const lon = form.radius_center_lon;
      if (lat && lon) {
        screens = screens.filter(s => {
          const d = haversineKm(lat, lon, s.lat, s.lon);
          return d !== null && d <= form.radius_km;
        });
      }
    }
    if (form.env_filter !== 'any') screens = screens.filter(s => s.environment === form.env_filter);
    if (form.venue_filter) screens = screens.filter(s => s.venue_category === form.venue_filter);
    return screens;
  })();

  // Auto-select all matched screens when the matched set changes. Also
  // reconciles each creative's assigned_screen_ids against the new selection
  // -- StepCreative's own screen-refinement filters can shrink the matched
  // set after an advertiser has already assigned specific screens to
  // specific creatives, and without this, a creative could keep pointing at
  // a screen id that's no longer part of the campaign at all.
  const matchedKey = matchedScreens.map(s => s.id).join(',');
  useEffect(() => {
    setForm(s => {
      const nextSelectedIds = matchedScreens.map(sc => sc.id);
      return {
        ...s,
        selected_screen_ids: nextSelectedIds,
        creatives: reconcileAssignments(s.creatives, nextSelectedIds),
      };
    });
  }, [matchedKey]);

  // Seeds a brand-new draft's first creative from the advertiser's brand kit,
  // once profile finishes loading (it starts null in AuthContext until its
  // own fetch resolves, so this can't be done in the initial useState
  // above). form.creatives starts empty and StepCreative would otherwise
  // lazily seed a blank creative with hardcoded defaults (not the profile's
  // brand colors) on first edit -- so instead this seeds the first creative
  // here, once, so the brand-kit colors are already in place before the
  // advertiser types anything. Only runs while form.creatives is still
  // empty, so it never clobbers an edit the advertiser already made.
  const brandKitSeeded = useRef(false);
  useEffect(() => {
    if (!profile || brandKitSeeded.current) return;
    brandKitSeeded.current = true;
    setForm(s => {
      if (s.creatives.length > 0) return s;
      return {
        ...s,
        creatives: [makeBlankCreative({
          accent_color: profile.brand_color_1 || '#7c3aed',
        })],
      };
    });
  }, [profile]);

  const selectedScreens = matchedScreens.filter(s => form.selected_screen_ids.includes(s.id));
  const totalImpressions = selectedScreens.reduce((a, s) => a + (s.impressions || 0), 0);

  const reachSummary = matchedScreens.length > 0
    ? `~${matchedScreens.length} screen${matchedScreens.length !== 1 ? 's' : ''} · ~${(totalImpressions / 1000).toFixed(0)}K impressions/mo estimated`
    : form.area_type === 'radius' && !form.radius_center_lat
    ? 'Enter a center location to see matching screens'
    : 'No screens match — try widening your area or removing filters';

  const next = () => setStep(s => Math.min(s + 1, STEP_LABELS.length - 1));
  const back = () => setStep(s => Math.max(s - 1, 0));

  const loadDuplicate = (c) => {
    setForm(s => ({
      ...s,
      // Media is intentionally NOT carried forward -- every campaign needs
      // its own uploaded creative, so duplicating a past campaign still
      // requires a fresh upload before the wizard lets it advance.
      creatives: [makeBlankCreative({
        destination_url: c.destination_url || c.destination || '',
        accent_color: c.accent_color || c.color || '#7c3aed',
        category: c.category || 'Food & Beverage',
        qr_x: c.qr_x ?? null,
        qr_y: c.qr_y ?? null,
        qr_size_pct: c.qr_size_pct ?? null,
        qr_fg_color: c.qr_fg_color ?? null,
        qr_bg_color: c.qr_bg_color ?? null,
      })],
      budget: String(c.budget || ''),
      budget_mode: c.budget_mode || 'total',
      start_date: '',
      end_date: '',
      schedule_days: c.schedule_days || c.days || ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      time_start: c.time_start || c.timeStart || '07:00',
      time_end: c.time_end || c.timeEnd || '22:00',
      duration: c.duration || 15,
      slots: c.slots || 10,

      start_when: c.start_when || 'partial',
    }));
    setShowDupModal(false);
  };

  const handleSubmit = async () => {
    if (!form.budget || parseFloat(form.budget) <= 0) {
      setSubmitErr('Enter a budget greater than 0 before submitting.');
      return;
    }
    setSubmitting(true);
    setSubmitErr(null);
    try {
      // Defensive second reconcile right at the submit choke point -- the
      // effect above keeps this in sync during normal editing, but this
      // guarantees no assignment referencing a since-removed screen can ever
      // reach the database, regardless of render timing.
      const creatives = reconcileAssignments(
        form.creatives.length > 0 ? form.creatives : [],
        form.selected_screen_ids,
      );
      const primary = creatives[0] ?? {};
      const isMulti = creatives.length > 1;
      const preview = buildPreviewCampaign(primary);

      // When adding a targeting group to an existing campaign, reuse its id
      // as the parent instead of inserting a brand-new `campaigns` row.
      let parentCampaignId = existingCampaign?.id;
      if (!parentCampaignId) {
        const { data: campaignRow, error: campaignErr } = await supabase
          .from('campaigns')
          .insert({ advertiser_id: user.id, name: form.name || 'Untitled Campaign' })
          .select('id')
          .single();
        if (campaignErr) throw new Error(campaignErr.message);
        parentCampaignId = campaignRow.id;
      }

      const campaignId = crypto.randomUUID();
      const firstScreen = selectedScreens[0];
      const { error: bookingErr } = await supabase.from('bookings').insert({
        id:                    campaignId,
        campaign_id:           parentCampaignId,
        budget_level:          isMulti ? form.budget_level : 'unified',
        advertiser_id:         user.id,
        campaign_name:         form.name || null,
        advertiser_name:       profile?.name || user.email?.split('@')[0] || 'Advertiser',
        screen_name:           firstScreen?.name || '',
        city:                  form.city || form.state || form.country || '',
        ...preview,
        // Normalized so a typed bare domain is stored as a real URL — the QR
        // encodes this value verbatim. Null (not '') when left blank, since
        // destination is optional now.
        destination_url:       preview.destination_url?.trim() ? normalizeDestinationUrl(preview.destination_url) : null,
        media_width:           primary.media_width ?? null,
        media_height:          primary.media_height ?? null,
        budget:                parseFloat(form.budget) || 0,
        currency:              profile?.preferred_currency || 'cad',
        budget_mode:           form.budget_mode,
        start_when:            form.start_when,
        start_date:            form.start_date || null,
        end_date:              form.end_date || null,
        schedule_days:         form.schedule_days,
        time_start:            form.time_start,
        time_end:              form.time_end,
        duration:              parseInt(form.duration, 10) || 15,
        slots:                 parseInt(form.slots, 10) || 10,
        billed_to_profile_id:  canChooseBilling && billedTo === 'agency' ? user.id : null,
        status:                'pending_review',
        payment_status:        'unpaid',
        impressions:           0,
        spent:                 0,
        scans:                 0,
      });
      if (bookingErr) throw new Error(bookingErr.message);

      const screenRows = form.selected_screen_ids.map(screen_id => ({
        campaign_id: campaignId,
        screen_id,
        status: matchedScreens.find(s => s.id === screen_id)?.auto_approve ? 'auto_approved' : 'pending',
      }));
      const { error: screenErr } = await supabase.from('campaign_screens').insert(screenRows);
      if (screenErr) throw new Error(screenErr.message);

      if (isMulti) {
        const { data: creativeRows, error: creativesErr } = await supabase
          .from('campaign_creatives')
          .insert(creatives.map((c, i) => ({
            targeting_id: campaignId,
            label: c.label || `Creative ${i + 1}`,
            media_url: c.media_url || null,
            media_type: c.media_type || null,
            media_width: c.media_width ?? null,
            media_height: c.media_height ?? null,
            destination_url: c.destination_url ? normalizeDestinationUrl(c.destination_url) : null,
            accent_color: c.accent_color || null,
            qr_x: c.qr_x ?? null,
            qr_y: c.qr_y ?? null,
            qr_size_pct: c.qr_size_pct ?? null,
            qr_fg_color: c.qr_fg_color ?? null,
            qr_bg_color: c.qr_bg_color ?? null,
            budget: form.budget_level === 'per_creative' ? (parseFloat(c.budget) || null) : null,
          })))
          .select('id');
        if (creativesErr) throw new Error(creativesErr.message);

        const assignedScreenIds = new Set(creatives.flatMap(c => c.assigned_screen_ids));
        const unassigned = form.selected_screen_ids.filter(id => !assignedScreenIds.has(id));

        const creativeScreenRows = creatives.flatMap((c, i) => {
          const ids = i === 0 ? [...c.assigned_screen_ids, ...unassigned] : c.assigned_screen_ids;
          return ids.map(screen_id => ({ creative_id: creativeRows[i].id, screen_id, weight: c.weight || 100 }));
        });
        if (creativeScreenRows.length > 0) {
          const { error: assignErr } = await supabase.from('campaign_creative_screens').insert(creativeScreenRows);
          if (assignErr) throw new Error(assignErr.message);
        }
      }

      // Booking status moves to 'scheduled' server-side (charge-campaign) once
      // payment succeeds — clients cannot write status, by design.

      // Notify each unique operator whose screens were targeted
      const { data: { session } } = await supabase.auth.getSession();
      if (session && SUPABASE_FUNCTIONS_URL) {
        const operatorIds = [...new Set(
          form.selected_screen_ids
            .map(sid => matchedScreens.find(s => s.id === sid)?.operator_id)
            .filter(Boolean)
        )];
        const advertiserName = profile?.name || user.email?.split('@')[0] || 'Advertiser';
        operatorIds.forEach(operatorId => {
          fetch(`${SUPABASE_FUNCTIONS_URL}/send-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              userId: operatorId,
              type: 'campaign_submitted',
              data: { advertiserName, appUrl: window.location.origin },
            }),
          }).catch(() => {});
        });
      }

      setSubmitting(false);
      setCreated({
        id: campaignId,
        campaign_id: parentCampaignId,
        advertiser: profile?.name || user.email?.split('@')[0] || 'Advertiser',
        advertiser_id: user.id,
        screen: firstScreen?.name || '',
        city: form.city || '',
        color: preview.accent_color || '#7c3aed',
        qr_x: preview.qr_x,
        qr_y: preview.qr_y,
        qr_size_pct: preview.qr_size_pct,
        qr_fg_color: preview.qr_fg_color,
        qr_bg_color: preview.qr_bg_color,
        destination: preview.destination_url?.trim() ? normalizeDestinationUrl(preview.destination_url) : null,
        category: preview.category || 'Food & Beverage',
        budget: parseFloat(form.budget) || 0,
        budget_mode: form.budget_mode,
        budget_level: isMulti ? form.budget_level : 'unified',
        currency: profile?.preferred_currency || 'cad',
        // Mirrors the camelCase aliases App.jsx's own bookings-load mapper
        // applies (start/end/days/timeStart/timeEnd) — this object is
        // prepended straight into the campaigns list via onSave, bypassing
        // that mapper, so CampaignDetail/DisplayView (which read these
        // camelCase fields) need them present here too.
        start: form.start_date,
        end: form.end_date,
        days: form.schedule_days,
        timeStart: form.time_start,
        timeEnd: form.time_end,
        duration: parseInt(form.duration, 10) || 15,
        slots: parseInt(form.slots, 10) || 10,
        spent: 0, impressions: 0, scans: 0,
        status: 'pending_review',
      });
      setStep(3);
    } catch (e) {
      setSubmitErr(e.message || 'Failed to submit campaign');
      setSubmitting(false);
    }
  };

  const handlePay = async () => {
    if (!created) return;
    setPaying(true);
    setPayErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/charge-campaign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ campaign_id: created.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.requires_action) setRequiresAction(true);
        throw new Error(body.error || 'Charge failed');
      }
      setPaying(false);
      onSave({ ...created, status: 'scheduled' });
    } catch (e) {
      setPayErr(e.message || 'Charge failed');
      setPaying(false);
    }
  };

  const skipPay = () => {
    if (!created) return;
    onSave(created);
  };

  const noBilling = !profile?.stripe_customer_id;

  return (
    <div>
      <PageHeader title="New Campaign" back="Overview" onBack={onCancel} />
      {noBilling && (
        <div style={{
          maxWidth: 620, margin: '0 auto 16px',
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)',
          borderRadius: 10, padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ fontSize: 13, color: '#fbbf24', fontFamily: F.sans }}>
            Add a payment method before submitting — your campaign won't go live without one.
          </span>
          <a href="#" onClick={e => { e.preventDefault(); onCancel(); }} style={{
            fontSize: 12, fontWeight: 600, color: '#fbbf24', fontFamily: F.sans,
            textDecoration: 'underline', whiteSpace: 'nowrap',
          }}>Set up billing →</a>
        </div>
      )}
      {step < 3 && <Stepper step={step} labels={STEP_LABELS} onCancel={onCancel} />}

      {showDupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <Card style={{ padding: 28, width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Start from a previous campaign</div>
            {campaigns.length === 0 ? (
              <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>No previous campaigns found.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {campaigns.map(c => (
                  <button key={c.id} onClick={() => loadDuplicate(c)} style={{
                    background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8,
                    padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans }}>{c.headline || c.advertiser}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>{c.city} · {formatCurrency(c.budget, c.currency)}</div>
                  </button>
                ))}
              </div>
            )}
            <Btn variant="secondary" onClick={() => setShowDupModal(false)} style={{ width: '100%', marginTop: 16 }}>Cancel</Btn>
          </Card>
        </div>
      )}

      {step === 0 && <StepTargeting form={form} setForm={setForm} reachSummary={reachSummary} allScreens={dbScreens} screensLoading={screensLoading} onPrevCampaigns={campaigns.length > 0 ? () => setShowDupModal(true) : null} existingCampaign={existingCampaign} />}
      {step === 1 && <StepCreative form={form} setForm={setForm} matchedScreens={matchedScreens} />}
      {step === 2 && <StepBudgetReview form={form} setForm={setForm} matchedScreens={selectedScreens} profile={profile} onSubmit={handleSubmit} submitting={submitting} err={submitErr} canChooseBilling={canChooseBilling} billedTo={billedTo} setBilledTo={setBilledTo} />}
      {step === 3 && created && <StepPay campaign={created} onPay={handlePay} onSkip={skipPay} paying={paying} err={payErr} requiresAction={requiresAction} onGoToBilling={() => navigate('/app/adv-billing')} />}

      {step < 3 && (
        <div style={{ maxWidth: 620, margin: '20px auto 0', display: 'flex', gap: 10 }}>
          {step > 0 && <Btn variant="secondary" onClick={back} disabled={submitting} style={{ flex: 1 }}>← Back</Btn>}
          {step < 2 && (
            <Btn onClick={next} style={{ flex: 1 }}
              disabled={
                (step === 0 && form.area_type === 'radius' && !form.radius_center_lat) ||
                (step === 0 && form.selected_screen_ids.length === 0 && form.area_type !== 'radius') ||
                (step === 1 && form.selected_screen_ids.length === 0) ||
                // Creative step: destination URL is optional (no QR is drawn
                // when it's left blank — see getCreativeRenderPlan's showQr),
                // but a *typed* value must be a real http(s) address, since a
                // malformed one would still send scanners to an error. A
                // creative with no uploaded media has no ad to show at all
                // (there's no generated text-card fallback anymore). A
                // never-touched creatives array (blank, lazily seeded by
                // StepCreative on first edit) is treated the same as
                // missing media — .some() over [] is always false and would
                // otherwise silently permit advancing past a wholly blank ad.
                (step === 1 && (
                  form.creatives.length === 0 ||
                  form.creatives.some(c => c.destination_url?.trim() && !isValidDestinationUrl(c.destination_url)) ||
                  form.creatives.some(c => !c.media_url)
                ))
              }
            >
              Next →
            </Btn>
          )}
        </div>
      )}
    </div>
  );
}
