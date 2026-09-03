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
import { sanitizeText } from '../../lib/sanitizeText.js';
import { makeBlankCreative, reconcileAssignments } from '../../lib/creativeAssignment.js';
import { mostRecentDraft, getDraft, saveDraft, deleteDraft } from '../../lib/campaignDrafts.js';
import { Stepper } from './createCampaign/Stepper.jsx';
import { StepTargeting } from './createCampaign/StepTargeting.jsx';
import { StepCreative } from './createCampaign/StepCreative.jsx';
import { StepBudgetReview } from './createCampaign/StepBudgetReview.jsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_LABELS = ['Targeting', 'Creative', 'Budget & Schedule'];

// Shared by the initial useState and by "Start fresh" (discarding a resumed
// draft) -- a plain function, not inlined in useState, so both call sites
// stay in sync as fields get added.
function blankForm(presetScreenIds) {
  return {
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
    selected_screen_ids: presetScreenIds && presetScreenIds.length > 0 ? presetScreenIds : [],
    creatives: [],  // StepCreative lazily seeds a blank one; see BLANK_CREATIVE there
    budget_level: 'unified',
    budget_mode: 'total',
    budget: '',
    start_date: '',
    end_date: '',
    schedule_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    time_start: '07:00',
    time_end: '22:00',
    dayparting: null, // null = same time every day; else { Mon: {time_start,time_end}, ... }
    duration: 15,
    slots: 10,
    start_when: 'partial',
    holdout_enabled: false,
  };
}

// Autosave only kicks in once the advertiser has actually put something into
// the draft -- otherwise every accidental "New Campaign" click (then
// immediately backing out) would leave a phantom empty draft cluttering the
// drafts list.
function hasDraftContent(form) {
  return !!(
    form.name || form.city || form.state || form.radius_center_lat ||
    form.selected_screen_ids.length > 0 || form.budget ||
    form.creatives.some(c => c.media_url || c.destination_url)
  );
}

function StepPay({ campaign, onPay, onSkip, paying, err, requiresAction, onGoToBilling }) {
  return (
    <div style={{ maxWidth: 580, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.display, margin: '0 0 8px' }}>Pay for your campaign</h2>
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

export function CreateCampaign({ onSave, onCancel, dbScreens = [], screensLoading = false, campaigns = [], existingCampaign = null, presetScreenIds = null, duplicateFrom = null, resumeDraftId = null }) {
  const { user, profile, activeAccount } = useAuth();
  const navigate = useNavigate();
  const isDelegate = activeAccount && !activeAccount.isOwn;
  const canChooseBilling = isDelegate && ['admin', 'manager'].includes(activeAccount?.role);
  const [billedTo, setBilledTo] = useState('client'); // 'client' | 'agency'
  const [step, setStep] = useState(() => (presetScreenIds && presetScreenIds.length > 0) ? 1 : 0);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState(null);
  const [showDupModal, setShowDupModal] = useState(false);
  const [created, setCreated] = useState(null);
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState(null);
  const [requiresAction, setRequiresAction] = useState(false);

  const [form, setForm] = useState(() => blankForm(presetScreenIds));

  // Draft autosave only applies to a genuinely fresh "New Campaign" session
  // -- not editing an existing campaign, not duplicating one, and not a
  // screen-invite signup (whose preset selection is authoritative and
  // shouldn't be silently swapped out for an unrelated resumed draft).
  const isFreshDraftFlow = !existingCampaign && !duplicateFrom && !(presetScreenIds && presetScreenIds.length > 0);
  const draftIdRef = useRef(null);
  const [resumedDraft, setResumedDraft] = useState(null); // { name, updated_at } | null

  // On mount, silently resume the most recent in-progress draft (if any)
  // rather than starting blank -- runs once; isFreshDraftFlow and user don't
  // change identity while this wizard instance is mounted.
  useEffect(() => {
    if (!isFreshDraftFlow || !user) return;
    // An explicit resumeDraftId (from DraftsCard's "Resume" click) wins over
    // "most recent" -- an advertiser picking an older draft from the list
    // should get exactly that one, not silently get bounced to whichever
    // draft happens to be newest.
    const draft = resumeDraftId ? getDraft(user.id, resumeDraftId) : mostRecentDraft(user.id);
    if (draft) {
      draftIdRef.current = draft.id;
      setForm(draft.form);
      setStep(draft.step ?? 0);
      setResumedDraft({ name: draft.name, updated_at: draft.updated_at });
    } else {
      draftIdRef.current = crypto.randomUUID();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startFresh() {
    if (user) deleteDraft(user.id, draftIdRef.current);
    draftIdRef.current = crypto.randomUUID();
    setForm(blankForm(null));
    setStep(0);
    setResumedDraft(null);
    brandKitSeeded.current = false;
  }

  // Debounced autosave -- skipped once the wizard has moved to the payment
  // step (a submitted campaign is no longer a "draft"), and gated on actual
  // content so an untouched wizard never writes a phantom draft.
  useEffect(() => {
    if (!isFreshDraftFlow || !user || !draftIdRef.current || step >= 3) return;
    if (!hasDraftContent(form)) return;
    const t = setTimeout(() => {
      saveDraft(user.id, draftIdRef.current, { step, form });
    }, 800);
    return () => clearTimeout(t);
  }, [form, step, isFreshDraftFlow, user]);

  // Screen matching
  const matchedScreens = (() => {
    // A screen-invite signup is already scoped to one specific screen --
    // area/venue filters (city, radius, category) don't apply and would
    // incorrectly narrow or widen the set away from the one screen this
    // advertiser was actually invited to. This bypasses the inactive/stale
    // filter below too: an advertiser who was legitimately invited to a
    // screen should still see it targeted even if its heartbeat has since
    // lapsed (invite-to-signup can take a while) -- that's an operator/ops
    // concern, not something that should silently break this advertiser's
    // invite flow. If the screen genuinely isn't in dbScreens at all (e.g.
    // deleted), this correctly falls through to an empty result, which
    // presetScreenUnavailable below turns into a blocking, explained state.
    if (presetScreenIds && presetScreenIds.length > 0) {
      return dbScreens.filter(s => presetScreenIds.includes(s.id));
    }
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
    // The preset selection from a screen invite is authoritative -- area
    // matching must never overwrite it (matchedScreens already returns
    // just the preset screen(s) above, but without this guard the effect
    // would still redundantly re-set the same value on every render; more
    // importantly, if dbScreens hasn't loaded yet on first mount,
    // matchedScreens could transiently be empty and this would wipe the
    // preset selection before dbScreens arrives).
    if (presetScreenIds && presetScreenIds.length > 0) return;
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

  // True only for the screen-invite flow, and only once dbScreens has
  // actually loaded and confirmed the invited screen isn't in it (deleted,
  // or otherwise no longer visible to this advertiser). form.selected_screen_ids
  // still holds the preset id in this case, so callers must check this flag
  // explicitly rather than relying on selected_screen_ids.length to detect
  // "no usable screen".
  const presetScreenUnavailable = !!(presetScreenIds && presetScreenIds.length > 0 && matchedScreens.length === 0);

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
      dayparting: c.dayparting ?? null,
      duration: c.duration || 15,
      slots: c.slots || 10,

      start_when: c.start_when || 'partial',
    }));
    setShowDupModal(false);
  };

  // Duplicate-from-detail entry point: App.jsx sets duplicateFrom when the
  // advertiser clicks "Duplicate" on an existing campaign's detail page.
  // Prefill once on mount rather than reactively -- duplicateFrom doesn't
  // change identity while this wizard is mounted, and re-running loadDuplicate
  // on every render would stomp on whatever the advertiser has since edited.
  const duplicateLoadedRef = useRef(false);
  useEffect(() => {
    if (duplicateFrom && !duplicateLoadedRef.current) {
      duplicateLoadedRef.current = true;
      loadDuplicate(duplicateFrom);
    }
  }, [duplicateFrom]);

  const handleSubmit = async () => {
    const budgetValue = parseFloat(form.budget);
    if (!form.budget || budgetValue <= 0) {
      setSubmitErr('Enter a budget greater than 0 before submitting.');
      return;
    }
    if (budgetValue > 1000000) {
      setSubmitErr('Budget cannot exceed $1,000,000.');
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
        campaign_name:         form.name ? sanitizeText(form.name, 200) : null,
        advertiser_name:       sanitizeText(profile?.name || user.email?.split('@')[0] || 'Advertiser', 200),
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
        holdout_enabled:       form.holdout_enabled,
        start_date:            form.start_date || null,
        end_date:              form.end_date || null,
        schedule_days:         form.schedule_days,
        time_start:            form.time_start,
        time_end:              form.time_end,
        dayparting:            form.dayparting,
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

      // campaign_creative_screens is inserted BEFORE campaign_screens on
      // purpose. reset_screen_approval_on_creative_change() (an AFTER
      // INSERT/DELETE trigger on campaign_creative_screens) resets any
      // campaign_screens row already sitting at approved/auto_approved back
      // to pending -- correct for an advertiser editing an existing,
      // already-reviewed campaign, but on a *brand-new* submission it has no
      // way to tell that apart from "this row was inserted 200ms ago and
      // never got to actually be auto-approved for anything." Inserting
      // campaign_creative_screens first means the trigger's UPDATE runs
      // against a campaign_id with zero campaign_screens rows yet -- a
      // harmless no-op -- instead of immediately reverting the
      // just-set auto_approved status the moment a multi-creative campaign
      // (2+ creatives, the normal case, not an edge case) is created.
      // campaign_creative_screens.screen_id references screens(id) directly,
      // not campaign_screens, so this ordering has no FK dependency issue.
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

      const screenRows = form.selected_screen_ids.map(screen_id => ({
        campaign_id: campaignId,
        screen_id,
        status: matchedScreens.find(s => s.id === screen_id)?.auto_approve ? 'auto_approved' : 'pending',
      }));
      const { error: screenErr } = await supabase.from('campaign_screens').insert(screenRows);
      if (screenErr) throw new Error(screenErr.message);

      // Control-screen assignment is server-computed (never client-set --
      // see the migration's comment on assign_holdout_control). A failure
      // here does not roll back the campaign; it just means the holdout
      // test won't have a control group, which the Lift Test panel's
      // "still collecting data" state covers gracefully either way.
      if (form.holdout_enabled) {
        const { data: { session: holdoutSession } } = await supabase.auth.getSession();
        if (holdoutSession) {
          await fetch(`${SUPABASE_FUNCTIONS_URL}/assign-holdout-control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${holdoutSession.access_token}` },
            body: JSON.stringify({ campaign_id: campaignId }),
          }).catch(() => {});
        }
      }

      // Booking status moves to 'scheduled' server-side (charge-campaign) once
      // payment succeeds — clients cannot write status, by design.

      const { data: { session } } = await supabase.auth.getSession();

      // If this campaign was created via a screen-invite signup, close the
      // loop for the inviting operator. Deliberately placed here -- after
      // every step of the submit pipeline that can still throw (bookings,
      // campaign_screens, and the multi-creative inserts) has already
      // succeeded -- rather than right after the bookings insert. Consuming
      // the token earlier would mean a later failure (e.g. campaign_screens)
      // leaves the token cleared but no complete campaign behind it; a
      // retried submit would then create a whole new booking that this
      // invite can never be attributed to. Still best-effort: a failure here
      // must never block the advertiser's own already-successful campaign
      // creation, so it's fire-and-forget with a logged (not swallowed)
      // failure -- this is the terminal conversion-attribution step for the
      // whole referral feature, so silent failure would make broken
      // attribution invisible.
      const pendingInviteToken = sessionStorage.getItem('adgrid_pending_screen_invite_token');
      if (pendingInviteToken) {
        sessionStorage.removeItem('adgrid_pending_screen_invite_token');
        if (session) {
          fetch(`${SUPABASE_FUNCTIONS_URL}/mark-screen-invite-booked`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ token: pendingInviteToken, campaign_id: campaignId }),
          }).catch(err => console.error('mark-screen-invite-booked failed:', err));
        }
      }

      // Notify each unique operator whose screens were targeted
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

      // Submitted successfully -- this is no longer a draft in progress.
      if (isFreshDraftFlow && user && draftIdRef.current) {
        deleteDraft(user.id, draftIdRef.current);
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
        dayparting: form.dayparting,
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
          <a href="#" onClick={e => { e.preventDefault(); navigate('/app/adv-billing'); }} style={{
            fontSize: 12, fontWeight: 600, color: '#fbbf24', fontFamily: F.sans,
            textDecoration: 'underline', whiteSpace: 'nowrap',
          }}>Set up billing →</a>
        </div>
      )}
      {step < 3 && resumedDraft && (
        <div style={{
          maxWidth: 620, margin: '0 auto 16px',
          background: C.purpleSoft, border: `1px solid ${C.purple}`,
          borderRadius: 10, padding: '10px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ fontSize: 12, color: C.text, fontFamily: F.sans }}>
            Continuing draft: <strong>{resumedDraft.name}</strong>
          </span>
          <button onClick={startFresh} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, color: C.purple, fontFamily: F.sans, textDecoration: 'underline',
          }}>Start fresh</button>
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

      {step === 0 && <StepTargeting form={form} setForm={setForm} reachSummary={reachSummary} matchedScreenCount={matchedScreens.length} allScreens={dbScreens} screensLoading={screensLoading} onPrevCampaigns={campaigns.length > 0 ? () => setShowDupModal(true) : null} existingCampaign={existingCampaign} pastCampaignIds={campaigns.map(c => c.id)} />}
      {step === 1 && <StepCreative form={form} setForm={setForm} matchedScreens={matchedScreens} presetScreenUnavailable={presetScreenUnavailable} />}
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
                // presetScreenUnavailable is checked separately from
                // selected_screen_ids.length -- the invited screen's id
                // stays in selected_screen_ids even when it's no longer a
                // real, matched screen, so length alone can't detect this.
                (step === 1 && (form.selected_screen_ids.length === 0 || presetScreenUnavailable)) ||
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
