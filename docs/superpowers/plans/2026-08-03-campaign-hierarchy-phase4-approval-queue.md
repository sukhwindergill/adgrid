# Campaign Hierarchy — Phase 4: Approval Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the operator approval queue actually surface a screen that Phase 1's reset-to-pending trigger reopened, and show the operator which specific creative(s) are assigned to each of their screens — not just the campaign's single default creative — so their approve/reject decision reflects what's really going to play.

**Architecture:** One real bug found while reading the current code, fixed first (Task 1): the web queue only shows bookings whose own `status` is `'pending_review'`, but a booking can sit at `'scheduled'` (because some *other* screen was already approved under `start_when: 'partial'`) while one specific screen the trigger just reset still needs re-review — that booking would never reappear in the web queue at all. The mobile app already gets this right (`useApprovals` queries `campaign_screens` directly, not gated by booking status) — the web fix brings it in line with the pattern mobile already uses. Tasks 2-3 then layer per-screen creative-mix display on top of that corrected data flow; Tasks 4-5 extend the mobile app the same way, since Phase 1's design explicitly calls it out as a required touch point.

**Tech Stack:** React (web) + React Native/Expo (mobile), vitest (web) / jest (mobile) for tests — this codebase already keeps entirely separate test runners for the two apps.

---

### Task 1: Fix booking-status gating in the web approval queue

**Files:**
- Modify: `src/views/operator/ApprovalQueue.jsx:290-321`

Today: `const pending = campaigns.filter(c => c.status === 'pending_review');` then `campaign_screens` is fetched only for those booking ids. A booking that's already `'scheduled'` (because it has other approved screens) is excluded from `pending` entirely, so its `campaign_screens` are never fetched and a freshly-reset screen on that booking never shows up. Fix: derive relevance from `campaign_screens` directly — screen_id in this operator's screens, status `'pending'` — exactly the pattern `mobile/hooks/useApprovals.js` already uses correctly.

- [ ] **Step 1: Replace the two `useEffect`s and the `pending`/`myPendingCampaigns` derivation**

Replace lines 292-316 of `src/views/operator/ApprovalQueue.jsx` (the `auto_approve` effect stays; only the `pending`/`campaignScreens`/`myPendingCampaigns` block changes) with:

```js
  const [relevantCampaignIds, setRelevantCampaignIds] = useState([]);

  // Which campaigns actually have a pending screen among mine -- queried
  // directly against campaign_screens, not gated by the booking's own
  // status. A booking can be 'scheduled' overall (another screen already
  // approved under start_when: 'partial') while this specific screen was
  // just reset to 'pending' by a creative reassignment; gating on booking
  // status would silently hide it forever.
  useEffect(() => {
    if (myScreens.length === 0) { setRelevantCampaignIds([]); return; }
    supabase.from('campaign_screens')
      .select('campaign_id')
      .in('screen_id', myScreens.map(s => s.id))
      .eq('status', 'pending')
      .then(({ data }) => {
        setRelevantCampaignIds([...new Set((data || []).map(r => r.campaign_id))]);
      });
  }, [myScreens.map(s => s.id).join(',')]);

  // Full row set (every status, not just pending) for those campaigns --
  // MultiScreenCampaignCard needs approved/rejected rows too, e.g. to
  // compute totalScreens for the earnings estimate.
  useEffect(() => {
    if (relevantCampaignIds.length === 0) { setCampaignScreens({}); return; }
    supabase.from('campaign_screens').select('*').in('campaign_id', relevantCampaignIds).then(({ data }) => {
      if (!data) return;
      const grouped = {};
      data.forEach(row => {
        if (!grouped[row.campaign_id]) grouped[row.campaign_id] = [];
        grouped[row.campaign_id].push(row);
      });
      setCampaignScreens(grouped);
    });
  }, [relevantCampaignIds.join(',')]);

  const myPendingCampaigns = campaigns.filter(c => relevantCampaignIds.includes(c.id));
```

- [ ] **Step 2: Verify nothing downstream referenced the removed `pending` variable**

Run:
```bash
grep -n "\bpending\b" src/views/operator/ApprovalQueue.jsx
```
Expected: no remaining reference to a bare `pending` variable outside `togglingAuto`/`autoApprove`/`myPendingCampaigns`/`totalPending` (all different names) — `enriched`, `handleApproved`, `handleRejected`, and `bulkApproveAll` all read `campaignScreens`/`myPendingCampaigns`, which keep the same shape as before.

- [ ] **Step 3: Manual verification of the fix**

This scenario needs a `start_when: 'partial'` campaign with 2+ screens across different operators (or two screens for the same test operator, simulated), one already approved. Using the Phase 1 Task 5 verification pattern (a real screen row, a real booking row):

1. Insert/use a booking with `start_when = 'partial'`, two `campaign_screens` rows for two of this operator's screens, one `status = 'approved'`, one `status = 'pending'`.
2. Confirm the operator sees the campaign in the queue today (it should, since one row is still pending) — this is the case the *existing* code already handled correctly, so it's a regression check.
3. Manually flip the pending row to `'approved'` too (`UPDATE campaign_screens SET status = 'approved' WHERE ...`), and separately run the exact INSERT from Phase 1 Task 5's verification (assign a `campaign_creatives` row to that now-approved screen) — this fires the reset trigger, flipping it back to `'pending'`.
4. Confirm: before this task's fix, the campaign would NOT reappear in the queue (its booking status would already be `'scheduled'`); after this fix, reload the queue and confirm it reappears with exactly the one reset screen showing a pending action row.

- [ ] **Step 4: Commit**

```bash
git add src/views/operator/ApprovalQueue.jsx
git commit -m "fix: approval queue no longer hides a reset-to-pending screen behind a scheduled booking"
```

---

### Task 2: Fetch per-screen creative assignments (web)

**Files:**
- Modify: `src/views/operator/ApprovalQueue.jsx`

- [ ] **Step 1: Add the fetch, mirroring `display-feed`'s two-step lookup (Phase 2)**

Add alongside the two `useEffect`s from Task 1:

```js
  const [creativesByScreen, setCreativesByScreen] = useState({}); // `${campaignId}:${screenId}` -> [{ ...creative, weight }]

  useEffect(() => {
    if (myScreens.length === 0) { setCreativesByScreen({}); return; }
    supabase.from('campaign_creative_screens')
      .select('screen_id, weight, creative_id')
      .in('screen_id', myScreens.map(s => s.id))
      .then(async ({ data: ccsRows }) => {
        if (!ccsRows || ccsRows.length === 0) { setCreativesByScreen({}); return; }
        const creativeIds = [...new Set(ccsRows.map(r => r.creative_id))];
        const { data: creatives } = await supabase
          .from('campaign_creatives')
          .select('id, targeting_id, label, headline, media_url, media_type, accent_color')
          .in('id', creativeIds);
        const creativeById = new Map((creatives || []).map(c => [c.id, c]));
        const grouped = {};
        ccsRows.forEach(row => {
          const cr = creativeById.get(row.creative_id);
          if (!cr) return;
          const key = `${cr.targeting_id}:${row.screen_id}`;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push({ ...cr, weight: row.weight });
        });
        setCreativesByScreen(grouped);
      });
  }, [myScreens.map(s => s.id).join(',')]);
```

- [ ] **Step 2: Pass it down to the card**

In the `enriched.map(c => <MultiScreenCampaignCard ... />)` render call, add:
```jsx
            creativesByScreen={creativesByScreen}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/operator/ApprovalQueue.jsx
git commit -m "feat: fetch per-screen creative assignments for the approval queue"
```

---

### Task 3: Render per-screen creative mix in `MultiScreenCampaignCard`

**Files:**
- Modify: `src/views/operator/ApprovalQueue.jsx:63-281`

For a screen with explicit creative assignments, replace the single campaign-level fit check for that row with one check per assigned creative, and show each creative's label/headline plus its share of plays. A screen with no assignments (the common case, and every campaign before this phase) renders exactly as it does today.

- [ ] **Step 1: Accept the new prop**

Change the function signature:
```js
function MultiScreenCampaignCard({ campaign, myScreens, allScreens, creativesByScreen, onApproved, onRejected }) {
```

- [ ] **Step 2: Replace the per-row block**

Replace the `myRows.map(row => { ... })` body (the block computing `rowMedia`/`fit` and rendering the row, roughly lines 214-248) with:

```jsx
              {myRows.map(row => {
                const screen = allScreens.find(s => s.id === row.screen_id);
                const health = screen ? healthLabel(screen) : null;
                const screenCreatives = creativesByScreen[`${campaign.id}:${row.screen_id}`] ?? [];

                // Fit-check scope: one check per explicitly assigned creative when
                // there are any, otherwise the single campaign-level check exactly
                // as before this phase.
                const fitChecks = screen
                  ? (screenCreatives.length > 0
                      ? screenCreatives.map(cr => ({
                          creative: cr,
                          ...checkCreativeFit(
                            { widthPx: cr.media_width, heightPx: cr.media_height, fileType: cr.media_type === 'video' ? 'video/mp4' : 'image/png', fileSizeMb: 0 },
                            { resolution_w: screen.resolution_w, resolution_h: screen.resolution_h, accepted_formats: screen.accepted_formats, max_file_mb: screen.max_file_mb },
                          ),
                        }))
                      : [{
                          creative: null,
                          ...checkCreativeFit(
                            {
                              widthPx: row.media_width ?? campaign.media_width,
                              heightPx: row.media_height ?? campaign.media_height,
                              fileType: (row.media_type ?? campaign.media_type) === 'video' ? 'video/mp4' : 'image/png',
                              fileSizeMb: 0,
                            },
                            { resolution_w: screen?.resolution_w, resolution_h: screen?.resolution_h, accepted_formats: screen?.accepted_formats, max_file_mb: screen?.max_file_mb },
                          ),
                        }])
                  : [];

                return (
                  <div key={row.screen_id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: C.text, fontFamily: F.sans }}>{screen?.name || row.screen_id}</div>
                        {health && <span style={{ fontSize: 10, color: health.color, fontFamily: F.sans }}>⚠ {health.label}</span>}
                      </div>
                      <Btn size="sm" onClick={() => approveScreen(row.screen_id)} disabled={acting}>✓ Approve</Btn>
                      <Btn variant="danger" size="sm" onClick={() => setRejectScreenId(row.screen_id)} disabled={acting}>✗ Reject</Btn>
                    </div>

                    {screenCreatives.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 4 }}>
                        {screenCreatives.map(cr => {
                          const check = fitChecks.find(f => f.creative?.id === cr.id);
                          return (
                            <div key={cr.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textSub, fontFamily: F.sans }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: cr.accent_color || C.purple, flexShrink: 0 }} />
                              <span>{cr.label || cr.headline || 'Untitled creative'} · {cr.weight}%</span>
                              {check?.status === 'mismatch' && (
                                <span style={{ color: C.amber }}>⚠ {check.reasons.map(r => REASON_LABEL[r] ?? r).join(', ')}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {screenCreatives.length === 0 && fitChecks[0]?.status === 'mismatch' && (
                      <span style={{ fontSize: 10, color: C.amber, fontFamily: F.sans, paddingLeft: 4 }}>
                        ⚠ Creative may not fit ({fitChecks[0].reasons.map(r => REASON_LABEL[r] ?? r).join(', ')})
                      </span>
                    )}
                  </div>
                );
              })}
```

Note: the top-of-card `CreativePreview`/`ReadabilityPanel` (lines 189-191) are untouched — they keep showing the campaign's primary creative as a general representative preview, exactly as today. This task only changes what's shown per individual screen row, which is where the actual brand-safety decision is made.

- [ ] **Step 3: Update the call site to pass the new prop**

In `ApprovalQueue`'s render (Task 2 Step 2 already added this), confirm `MultiScreenCampaignCard` receives `creativesByScreen={creativesByScreen}`.

- [ ] **Step 4: Manual verification**

Using the same test data as Task 1 Step 3, additionally insert two `campaign_creatives` rows for one booking with overlapping screen assignment (50/50 weight) via the Phase 3 flow (or directly via SQL matching Phase 1/2's test patterns). Confirm the operator's queue shows both creatives listed under that one screen row with their weights, and confirm a screen with no assignment rows still renders exactly as before this phase.

- [ ] **Step 5: Commit**

```bash
git add src/views/operator/ApprovalQueue.jsx
git commit -m "feat: show per-screen creative mix and per-creative fit checks in approval queue"
```

---

### Task 4: Mobile — fetch per-screen creative assignments

**Files:**
- Modify: `mobile/hooks/useApprovals.js`

Mobile's `useApprovals` already queries `campaign_screens` directly (no booking-status gating bug to fix here — it's already correct, and its Supabase realtime subscription on `campaign_screens` already means a reset-to-pending row reappears automatically without a manual refresh). This task only adds the per-screen creative lookup, matching Task 2's web equivalent.

- [ ] **Step 1: Add the creative fetch to `fetchPending`**

Replace the `fetchPending` function body:

```js
  const fetchPending = useCallback(async () => {
    if (!operatorId || !screenIds || screenIds.length === 0) {
      setPending([]); setLoading(false); return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('campaign_screens')
      .select(SELECT)
      .eq('status', 'pending')
      .in('screen_id', screenIds);
    if (err) { setError(err.message); setLoading(false); return; }

    const rows = data || [];
    const { data: ccsRows } = await supabase
      .from('campaign_creative_screens')
      .select('screen_id, weight, creative_id')
      .in('screen_id', screenIds);

    if (ccsRows && ccsRows.length > 0) {
      const creativeIds = [...new Set(ccsRows.map(r => r.creative_id))];
      const { data: creatives } = await supabase
        .from('campaign_creatives')
        .select('id, targeting_id, label, headline, media_url, media_type, accent_color')
        .in('id', creativeIds);
      const creativeById = new Map((creatives || []).map(c => [c.id, c]));
      const byKey = new Map();
      ccsRows.forEach(row => {
        const cr = creativeById.get(row.creative_id);
        if (!cr) return;
        const key = `${cr.targeting_id}:${row.screen_id}`;
        const list = byKey.get(key) ?? [];
        list.push({ ...cr, weight: row.weight });
        byKey.set(key, list);
      });
      rows.forEach(row => {
        row.creatives = byKey.get(`${row.campaign_id}:${row.screen_id}`) ?? [];
      });
    } else {
      rows.forEach(row => { row.creatives = []; });
    }

    setError(null);
    setPending(rows);
    setLoading(false);
  }, [operatorId, JSON.stringify(screenIds)]);
```

- [ ] **Step 2: Commit**

```bash
git add mobile/hooks/useApprovals.js
git commit -m "feat: attach per-screen creative assignments to mobile approval rows"
```

---

### Task 5: Mobile — render creative mix in `ApprovalCard`

**Files:**
- Modify: `mobile/components/approvals/ApprovalCard.jsx`
- Modify: `mobile/__tests__/approvals/ApprovalCard.test.jsx`

- [ ] **Step 1: Write the failing test**

Add to `mobile/__tests__/approvals/ApprovalCard.test.jsx`:

```jsx
  it('shows each assigned creative with its share when the row has explicit creatives', () => {
    const rowWithCreatives = {
      ...mockRow,
      creatives: [
        { id: 'cr-1', label: 'Landscape version', weight: 70 },
        { id: 'cr-2', label: 'Portrait version', weight: 30 },
      ],
    };
    const { getByText } = render(<ApprovalCard row={rowWithCreatives} onApprove={jest.fn()} onReject={jest.fn()} />);
    expect(getByText(/Landscape version.*70%/)).toBeTruthy();
    expect(getByText(/Portrait version.*30%/)).toBeTruthy();
  });

  it('shows no creative-mix section when the row has no explicit creatives', () => {
    const { queryByText } = render(<ApprovalCard row={mockRow} onApprove={jest.fn()} onReject={jest.fn()} />);
    expect(queryByText(/%\)/)).toBeNull();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
cd mobile && npx jest __tests__/approvals/ApprovalCard.test.jsx
```
Expected: FAIL — no matching text found (the card doesn't render creatives yet).

- [ ] **Step 3: Add the creative-mix section**

In `mobile/components/approvals/ApprovalCard.jsx`, add after the existing `meta` block (after line 74, before the `{!rejecting ? (` block):

```jsx
        {row.creatives?.length > 0 && (
          <View style={styles.creativeMix}>
            {row.creatives.map(cr => (
              <Text key={cr.id} style={[styles.creativeMixText, { fontFamily: F.sans }]}>
                {cr.label || cr.headline || 'Untitled creative'} · {cr.weight}%
              </Text>
            ))}
          </View>
        )}
```

And add to the `styles` object:
```js
  creativeMix: { gap: 2, marginBottom: 10 },
  creativeMixText: { fontSize: 11, color: C.textMuted },
```

- [ ] **Step 4: Run to verify it passes**

Run:
```bash
cd mobile && npx jest __tests__/approvals/ApprovalCard.test.jsx
```
Expected: PASS — all tests including the two added above.

- [ ] **Step 5: Commit**

```bash
git add mobile/components/approvals/ApprovalCard.jsx mobile/__tests__/approvals/ApprovalCard.test.jsx
git commit -m "feat: render per-screen creative mix on mobile approval cards"
```

---

## Phase 4 exit criteria

- [ ] A screen reset to `'pending'` by Phase 1's trigger reliably reappears in the **web** queue even when its booking's own status is `'scheduled'` (verified manually — this was a real, pre-existing latent gap that Phase 1's trigger made newly reachable).
- [ ] Mobile's existing realtime-subscribed query already surfaces the same reset correctly (verified, no code change needed for that part — confirmed by reading `mobile/hooks/useApprovals.js` directly).
- [ ] Both web and mobile show each screen's actual assigned creative mix (label + weight) when one exists, and render identically to before this phase when it doesn't.
- [ ] Per-creative fit-mismatch warnings show correctly on web for a screen with 2+ assigned creatives.
- [ ] `npm test` (web) and `cd mobile && npx jest` both pass.

Phase 5 (accordion dashboard + "+ Add targeting group" entry point, reusing Phase 3's wizard scoped to an existing campaign) is the last piece of the original design.
