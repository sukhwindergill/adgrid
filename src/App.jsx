import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { supabase } from './lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from './lib/constants.js';
import { useToast } from './components/primitives/Toast.jsx';

import { LoginPage } from './components/login/LoginPage.jsx';
import { GlobalHeader } from './components/layout/GlobalHeader.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { Sidebar } from './components/layout/Sidebar.jsx';
import { ErrorBoundary } from './components/primitives/ErrorBoundary.jsx';

// Operator views
import { Dashboard }      from './views/operator/Dashboard.jsx';
import { Campaigns }      from './views/operator/Campaigns.jsx';
import { CampaignDetail } from './views/operator/CampaignDetail.jsx';
import { ScreensView }    from './views/operator/Screens.jsx';
import { Analytics }      from './views/operator/Analytics.jsx';
import { Audience }       from './views/operator/Audience.jsx';
import { Revenue }        from './views/operator/Revenue.jsx';
import { Billing }        from './views/operator/Billing.jsx';
import AdvertisersView    from './views/operator/AdvertisersView.jsx';

// Advertiser views
import { AdvDashboard }       from './views/advertiser/AdvDashboard.jsx';
import { CreateCampaign }     from './views/advertiser/CreateCampaign.jsx';
import ScansView              from './views/advertiser/ScansView.jsx';
import AdvertiserBillingView  from './views/advertiser/BillingView.jsx';
import SettingsView           from './views/advertiser/SettingsView.jsx';
import AdvIntegrationsView    from './views/advertiser/AdvIntegrationsView.jsx';

// Operator views (new)
import { ApprovalQueue }         from './views/operator/ApprovalQueue.jsx';
import { ScreenDetailView }      from './views/operator/ScreenDetail.jsx';
import { NotificationPrefsView } from './views/shared/NotificationPrefsView.jsx';

// Shared views
import { SignalsView }      from './views/shared/SignalsView.jsx';
import { IntegrationsView } from './views/shared/IntegrationsView.jsx';
import { DisplayView }      from './views/shared/DisplayView.jsx';
import { Placeholder }      from './views/shared/Placeholder.jsx';

// Public views (no auth required)
import { DisplayPlayer } from './views/display/DisplayPlayer.jsx';
import { MarketingHome } from './views/marketing/Home.jsx';

// Operator identity verification
import { VerificationOnboarding } from './views/operator/VerificationOnboarding.jsx';
import { VerificationQueue }      from './views/operator/VerificationQueue.jsx';
import { VerificationBanner }     from './components/operator/VerificationBanner.jsx';
import { InviteAcceptPage }       from './views/invite/InviteAcceptPage.jsx';

// Admin
import { AdminDashboard } from './views/admin/AdminDashboard.jsx';

// Operator onboarding + settings
import { OperatorOnboarding } from './views/operator/OperatorOnboarding.jsx';
import { OperatorSettings }   from './views/operator/OperatorSettings.jsx';

import { C, F } from './design/tokens.js';
import { Skeleton } from './components/ui/Skeleton.jsx';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function callNotification(userId, type, data = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  fetch(`${SUPABASE_FUNCTIONS_URL}/send-notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ userId, type, data }),
  }).catch(e => console.error('Notification error:', e));
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const { user, profile, role, loading, signOut } = useAuth();
  const toast = useToast();

  const [active,           setActive]        = useState('overview');
  const [impersonating,    setImpersonating] = useState(null); // { id, name }
  const impersonationLogId = useRef(null);
  const [campaigns,        setCampaigns]     = useState([]);
  const [dbScreens,        setDbScreens]     = useState([]);
  const [detail,           setDetail]        = useState(null);
  const [dataLoading,      setDataLoading]   = useState(false);
  const [loadError,        setLoadError]     = useState(null);
  const [selectedScreenId, setSelectedScreenId] = useState(null);
  const [localProfile,     setLocalProfile]  = useState(null);

  // ── Impersonation audit trail ─────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    if (impersonating) {
      supabase.from('impersonation_logs').insert({
        operator_id: user.id,
        advertiser_id: impersonating.id,
      }).select('id').single().then(({ data }) => {
        if (data) impersonationLogId.current = data.id;
      });
    } else if (impersonationLogId.current) {
      supabase.from('impersonation_logs')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', impersonationLogId.current)
        .then(() => { impersonationLogId.current = null; });
    }
  }, [impersonating, user]);

  // ── Impersonation ──────────────────────────────────────────────────────────
  function startImpersonation(adv) {
    setImpersonating({ id: adv.id, name: adv.name });
    setActive('adv-overview');
  }
  function stopImpersonation() {
    setImpersonating(null);
    setActive('advertisers');
  }

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setDataLoading(true);
    setLoadError(null);
    const [bookingsRes, screensRes] = await Promise.all([
      supabase.from('bookings').select('*').order('created_at', { ascending: false }),
      supabase.from('screens').select('*').order('name'),
    ]);
    if (bookingsRes.error) {
      console.error('Failed to load campaigns:', bookingsRes.error.message);
      setLoadError('Failed to load data. Please refresh.');
      setDataLoading(false);
      return;
    }
    if (screensRes.error) {
      console.error('Failed to load screens:', screensRes.error.message);
      setLoadError('Failed to load data. Please refresh.');
      setDataLoading(false);
      return;
    }
    const bookings = bookingsRes.data;
    const screens = screensRes.data;
    if (bookings && bookings.length > 0) {
      setCampaigns(bookings.map(b => ({
        ...b,
        advertiser: b.advertiser_name,
        screen: b.screen_name,
        start: b.start_date,
        end: b.end_date,
        days: b.schedule_days,
        timeStart: b.time_start,
        timeEnd: b.time_end,
        spent: b.spent ?? 0,
        scans: b.scans ?? 0,
        color: b.accent_color,
        destination: b.destination_url,
        cta: b.cta_text,
      })));
    } else {
      setCampaigns([]);
    }
    if (screens && screens.length > 0) {
      setDbScreens(screens.map(s => ({
        ...s,
        neighbourhood: s.location,
        owner: s.owner_name,
        cpm: s.cpm_floor || 4.20,
        maxDuration: s.max_ad_duration,
        revenue: s.monthly_revenue ?? 0,
        campaigns: 0,
      })));
    } else {
      setDbScreens([]);
    }
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      setActive(role === 'advertiser' ? 'adv-overview' : 'overview');
      loadData();
    }
  }, [user, role, loadData]);

  // Sync local profile copy for mutable settings updates
  useEffect(() => { setLocalProfile(profile); }, [profile]);

  // Auto-route new operators who haven't completed onboarding
  useEffect(() => {
    if (!user || role !== 'operator' || !profile) return;
    if (profile.is_platform_owner) return; // platform owners bypass onboarding redirect
    // Only redirect on first load (active still at default 'overview')
    if (active !== 'overview') return;
    const isIncomplete = !profile.name || !profile.company_name;
    if (isIncomplete) setActive('op-onboarding');
  }, [profile]);

  // ── Stripe Connect redirect ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);

    // Advertiser billing setup return
    const setup = params.get('setup');
    if (setup === 'success' || setup === 'cancelled') {
      if (setup === 'success') toast.success('Payment method added successfully.');
      window.history.replaceState({}, '', window.location.pathname);
      setActive('adv-billing');
      return;
    }

    if (params.get('connect') === 'success') {
      const storedState = sessionStorage.getItem('stripe_connect_state');
      const returnedState = params.get('state');
      sessionStorage.removeItem('stripe_connect_state');
      if (!storedState || !returnedState || storedState !== returnedState) {
        console.error('Stripe Connect: invalid or missing state token — ignoring redirect');
        window.location.replace(window.location.pathname);
        return;
      }
      supabase
        .from('profiles')
        .update({ connect_status: 'active' })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) {
            console.error('Failed to update connect status:', error.message);
          } else {
            toast.success('Bank account connected — payouts are now enabled!');
          }
          window.location.replace(window.location.pathname);
        });
    }
  }, [user]);

  // ── Loading / auth gates ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, padding: '40px 28px' }}>
        <div style={{ maxWidth: 1320, margin: '0 auto' }}>
          <Skeleton height={32} radius={8} style={{ width: 180, marginBottom: 32 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[0,1,2,3].map(i => <Skeleton key={i} height={90} radius={12} />)}
          </div>
          <Skeleton height={220} radius={12} style={{ marginBottom: 20 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <Skeleton height={160} radius={12} />
            <Skeleton height={160} radius={12} />
          </div>
        </div>
      </div>
    );
  }

  // Invite acceptance — public, no auth required
  const inviteMatch = window.location.pathname.match(/^\/invite\/([a-f0-9]{64})$/);
  if (inviteMatch) return <InviteAcceptPage token={inviteMatch[1]} />;

  if (!user) {
    const path = window.location.pathname;
    // Show login page directly on /login, otherwise show marketing home
    if (path === '/login') return <LoginPage />;
    return <MarketingHome onSignup={() => window.location.href = '/login'} onLogin={() => window.location.href = '/login'} />;
  }

  const effectiveRole = impersonating ? 'advertiser' : role;
  const isAdv = effectiveRole === 'advertiser';
  const displayUser = { name: profile?.name || user.email?.split('@')[0] || 'User', email: user.email, role };
  const pendingCount = campaigns.filter(c => c.status === 'pending_review').length;

  // ── Mutation helpers ───────────────────────────────────────────────────────
  const navigate = v => { setActive(v); setDetail(null); };

  const updateCampaign = async updated => {
    const prevCampaign = campaigns.find(c => c.id === updated.id);
    const becomingActive = updated.status === 'active' && prevCampaign?.status !== 'active';

    // Charge advertiser before activating campaign
    if (becomingActive) {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/charge-campaign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ campaign_id: updated.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(`Payment failed: ${json.error ?? 'Unknown error'}`);
        return;
      }
      // charge-campaign sets status to 'scheduled' on success — sync local state
      updated = { ...updated, status: 'scheduled', payment_status: 'paid' };
    }

    const { error } = await supabase
      .from('bookings')
      .update({ status: updated.status })
      .eq('id', updated.id);
    if (error) {
      console.error('Failed to update campaign:', error.message);
      toast.error(`Failed to update campaign: ${error.message}`);
      return;
    }
    setCampaigns(prev => prev.map(c => c.id === updated.id ? updated : c));
    setDetail(updated);
    if (becomingActive && updated.advertiser_id) {
      callNotification(updated.advertiser_id, 'campaign_approved', {
        campaignName: updated.advertiser_name ?? updated.advertiser ?? '',
        appUrl: '',
      });
    }
  };

  // ── View routing ───────────────────────────────────────────────────────────
  const view = () => {
    if (detail && (active === 'campaigns' || active === 'analytics' || active === 'adv-campaigns' || active === 'approval')) {
      return <CampaignDetail campaign={detail} onBack={() => setDetail(null)} onUpdate={updateCampaign} />;
    }

    if (isAdv) {
      // Payment method banner — shown on dashboard and campaign creation if no card on file
      const noCard = !profile?.stripe_customer_id;
      const paymentBanner = noCard && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
          fontFamily: F.sans, fontSize: 13, marginBottom: 16,
        }}>
          <span style={{ fontSize: 18 }}>💳</span>
          <span style={{ flex: 1, color: '#92400e' }}>
            Add a payment method so your campaigns can go live when approved.
          </span>
          <button
            onClick={() => navigate('adv-billing')}
            style={{
              padding: '5px 14px', borderRadius: 7, border: 'none',
              background: '#f59e0b', color: '#fff', fontFamily: F.sans,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            }}
          >
            Set up billing →
          </button>
        </div>
      );

      if (active === 'adv-overview') return (
        <>
          {paymentBanner}
          <AdvDashboard user={displayUser} campaigns={campaigns} setAdvNav={navigate} advertiserId={impersonating?.id ?? user.id} />
        </>
      );
      if (active === 'adv-create') return (
        <>
          {paymentBanner}
          <CreateCampaign
          dbScreens={dbScreens}
          onSave={async c => {
            const { data: row, error } = await supabase.from('bookings').insert({
              id:              crypto.randomUUID(),
              advertiser_name: c.advertiser,
              screen_name:     c.screen,
              city:            c.city || '',
              start_date:      c.start,
              end_date:        c.end,
              schedule_days:   c.days,
              time_start:      c.timeStart,
              time_end:        c.timeEnd,
              budget:          c.budget,
              impressions:     0,
              accent_color:    c.color,
              destination_url: c.destination,
              status:          'pending_review',
              advertiser_id:   user.id,
              category:        c.category,
              headline:        c.headline,
              cta_text:        c.cta,
              slots:           c.slots,
              duration:        c.duration,
              asset_url:       c.assetUrl ?? null,
              asset_type:      c.assetType ?? null,
            }).select().single();
            if (error || !row) {
              toast.error(`Failed to submit campaign: ${error?.message ?? 'Unknown error'}`);
              return;
            }
            setCampaigns(p => [{
              ...c, ...row,
              advertiser: row.advertiser_name,
              screen: row.screen_name,
              start: row.start_date,
              end: row.end_date,
              days: row.schedule_days,
              timeStart: row.time_start,
              timeEnd: row.time_end,
              color: row.accent_color,
              destination: row.destination_url,
            }, ...p]);
            navigate('adv-campaigns');
            supabase.from('profiles').select('id').eq('role', 'operator').then(({ data: ops }) => {
              (ops ?? []).forEach(op => {
                callNotification(op.id, 'campaign_submitted', {
                  advertiserName: profile?.name ?? user?.user_metadata?.name ?? 'An advertiser',
                  appUrl: '',
                });
              });
            });
          }}
          onCancel={() => navigate('adv-overview')}
        />
        </>
      );
      if (active === 'adv-campaigns')    return <Campaigns campaigns={campaigns} dbScreens={dbScreens} setCampaigns={setCampaigns} setDetail={c => setDetail(c)} loadError={loadError} loading={dataLoading} />;
      if (active === 'adv-analytics')    return <Analytics campaigns={campaigns} loading={dataLoading} />;
      if (active === 'adv-audience')     return <ScansView impersonatingId={impersonating?.id ?? null} />;
      if (active === 'adv-billing')      return <AdvertiserBillingView />;
      if (active === 'adv-integrations') return <AdvIntegrationsView />;
      if (active === 'adv-settings')     return <SettingsView />;
      if (active === 'notif-prefs')      return <NotificationPrefsView />;
      return <AdvDashboard user={displayUser} campaigns={campaigns} setAdvNav={navigate} advertiserId={impersonating?.id ?? user.id} />;
    }

    if (active === 'op-onboarding') return (
      <OperatorOnboarding
        profile={localProfile ?? profile}
        screenCount={dbScreens.length}
        onComplete={() => navigate('overview')}
        onProfileUpdate={updated => setLocalProfile(updated)}
        onScreenAdded={screen => setDbScreens(prev => [
          { ...screen, neighbourhood: screen.location, owner: screen.owner_name, cpm: screen.cpm_floor || 4.20, maxDuration: screen.max_ad_duration, revenue: 0, campaigns: 0 },
          ...prev,
        ])}
        onNavigate={navigate}
      />
    );
    if (active === 'op-settings')   return (
      <OperatorSettings
        profile={{ ...(localProfile ?? profile), email: user.email }}
        onProfileUpdate={updated => setLocalProfile(updated)}
      />
    );
    if (active === 'overview')     return (
      <>
        <VerificationBanner status={profile?.verification_status} onStartVerification={() => navigate('op-verify')} />
        <Dashboard campaigns={campaigns} dbScreens={dbScreens} setNav={navigate} loading={dataLoading} />
      </>
    );
    if (active === 'op-verify')    return (
      <VerificationOnboarding profile={profile} onVerified={() => navigate('overview')} />
    );
    if (active === 'op-verify-queue') return <VerificationQueue />;
    if (active === 'admin')           return <AdminDashboard onNavigate={navigate} />;
    if (active === 'screens')      return (
      <ScreensView
        dbScreens={dbScreens}
        setDbScreens={setDbScreens}
        profile={profile}
        loading={dataLoading}
        onSelectScreen={id => { setSelectedScreenId(id); navigate('screen-detail'); }}
        verificationStatus={profile?.verification_status}
        onVerify={() => navigate('op-verify')}
      />
    );
    if (active === 'approval')      return <ApprovalQueue campaigns={campaigns} setCampaigns={setCampaigns} setDetail={c => setDetail(c)} />;
    if (active === 'screen-detail') {
      if (!selectedScreenId) { navigate('screens'); return null; }
      return <ScreenDetailView screenId={selectedScreenId} onBack={() => navigate('screens')} profile={profile} onScreenUpdated={updated => setDbScreens(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s))} />;
    }
    if (active === 'notif-prefs')   return <NotificationPrefsView />;
    if (active === 'campaigns')    return <Campaigns campaigns={campaigns} dbScreens={dbScreens} setCampaigns={setCampaigns} setDetail={c => setDetail(c)} loadError={loadError} loading={dataLoading} />;
    if (active === 'analytics')    return <Analytics campaigns={campaigns} loading={dataLoading} />;
    if (active === 'audience')     return <Audience campaigns={campaigns} />;
    if (active === 'revenue')      return <Revenue campaigns={campaigns} loading={dataLoading} />;
    if (active === 'billing')      return <Billing campaigns={campaigns} />;
    if (active === 'advertisers')  return <AdvertisersView onImpersonate={startImpersonation} />;
    if (active === 'signals')      return <SignalsView campaigns={campaigns} />;
    if (active === 'integrations') return <IntegrationsView />;
    if (active === 'display')      return <DisplayView campaigns={campaigns} />;
    return <Dashboard campaigns={campaigns} setNav={navigate} loading={dataLoading} />;
  };

  return (
    <AppShell
      impersonating={impersonating}
      onStopImpersonation={stopImpersonation}
      sidebar={
        <Sidebar
          active={active}
          setActive={navigate}
          isAdv={isAdv}
          user={displayUser}
          onSignOut={signOut}
          pendingCount={pendingCount}
          isPlatformOwner={profile?.is_platform_owner ?? false}
          verificationStatus={role === 'operator' ? (profile?.verification_status ?? null) : null}
        />
      }
      header={
        <GlobalHeader
          user={displayUser}
          onSignOut={signOut}
        />
      }
    >
      {loadError && (
        <div style={{
          background: '#ff000022', border: '1px solid #ff4444', borderRadius: 8,
          padding: '10px 16px', marginBottom: 16, display: 'flex',
          alignItems: 'center', gap: 12, fontFamily: F.sans, fontSize: 13, color: '#ff6666',
        }}>
          <span style={{ flex: 1 }}>{loadError}</span>
          <button
            onClick={loadData}
            style={{
              background: '#ff444433', border: '1px solid #ff4444', borderRadius: 6,
              color: '#ff8888', fontFamily: F.sans, fontSize: 12, padding: '4px 12px', cursor: 'pointer',
            }}
          >Retry</button>
        </div>
      )}
      <ErrorBoundary key={active}>
        <div className="fade-in">
          {view()}
        </div>
      </ErrorBoundary>
    </AppShell>
  );
}
