import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { supabase } from './lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from './lib/constants.js';
import { useToast } from './components/primitives/Toast.jsx';

import { LoginPage } from './components/login/LoginPage.jsx';
import { GlobalHeader } from './components/layout/GlobalHeader.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { Sidebar } from './components/layout/Sidebar.jsx';
import { ErrorBoundary } from './components/primitives/ErrorBoundary.jsx';
import { RequireAuth } from './components/auth/RequireAuth.jsx';

import { RequirePlatformOwner } from './components/auth/RequirePlatformOwner.jsx';

// Authenticated dashboard + other public views — lazy-loaded so none of this
// code ships in the bundle a first-time marketing-page visitor downloads.
// Operator views
const Dashboard      = lazy(() => import('./views/operator/Dashboard.jsx').then(m => ({ default: m.Dashboard })));
const Campaigns      = lazy(() => import('./views/operator/Campaigns.jsx').then(m => ({ default: m.Campaigns })));
const CampaignDetail = lazy(() => import('./views/operator/CampaignDetail.jsx').then(m => ({ default: m.CampaignDetail })));
const ScreensView    = lazy(() => import('./views/operator/Screens.jsx').then(m => ({ default: m.ScreensView })));
const Analytics      = lazy(() => import('./views/operator/Analytics.jsx').then(m => ({ default: m.Analytics })));
const Audience       = lazy(() => import('./views/operator/Audience.jsx').then(m => ({ default: m.Audience })));
const Revenue        = lazy(() => import('./views/operator/Revenue.jsx').then(m => ({ default: m.Revenue })));
const Billing        = lazy(() => import('./views/operator/Billing.jsx').then(m => ({ default: m.Billing })));
const AdvertisersView = lazy(() => import('./views/operator/AdvertisersView.jsx'));
const OperatorSettingsView = lazy(() => import('./views/operator/OperatorSettingsView.jsx').then(m => ({ default: m.OperatorSettingsView })));

// Advertiser views
const AdvDashboard      = lazy(() => import('./views/advertiser/AdvDashboard.jsx').then(m => ({ default: m.AdvDashboard })));
const CreateCampaign    = lazy(() => import('./views/advertiser/CreateCampaign.jsx').then(m => ({ default: m.CreateCampaign })));
const ScansView              = lazy(() => import('./views/advertiser/ScansView.jsx'));
const AdvertiserBillingView  = lazy(() => import('./views/advertiser/BillingView.jsx'));
const SettingsView           = lazy(() => import('./views/advertiser/SettingsView.jsx'));
const AdvIntegrationsView    = lazy(() => import('./views/advertiser/AdvIntegrationsView.jsx'));

// Operator views (new)
const ApprovalQueue         = lazy(() => import('./views/operator/ApprovalQueue.jsx').then(m => ({ default: m.ApprovalQueue })));
const ScreenDetailView      = lazy(() => import('./views/operator/ScreenDetail.jsx').then(m => ({ default: m.ScreenDetailView })));
const ScreenOnboardView     = lazy(() => import('./views/operator/ScreenOnboard.jsx').then(m => ({ default: m.ScreenOnboardView })));
const NotificationPrefsView = lazy(() => import('./views/shared/NotificationPrefsView.jsx').then(m => ({ default: m.NotificationPrefsView })));

// Shared views
const SignalsView      = lazy(() => import('./views/shared/SignalsView.jsx').then(m => ({ default: m.SignalsView })));
const IntegrationsView = lazy(() => import('./views/shared/IntegrationsView.jsx').then(m => ({ default: m.IntegrationsView })));
const DisplayView      = lazy(() => import('./views/shared/DisplayView.jsx').then(m => ({ default: m.DisplayView })));

const AccountHub      = lazy(() => import('./views/accounts/AccountHub.jsx').then(m => ({ default: m.AccountHub })));
const AcceptGrantView = lazy(() => import('./views/accounts/AcceptGrantView.jsx').then(m => ({ default: m.AcceptGrantView })));

const AdminInvites = lazy(() => import('./views/admin/AdminInvites.jsx').then(m => ({ default: m.AdminInvites })));

// Public views (no auth required) — also lazy so the marketing/display
// bundles don't ship with the authenticated dashboard's first paint.
const InviteAcceptPage = lazy(() => import('./views/invite/InviteAcceptPage.jsx').then(m => ({ default: m.InviteAcceptPage })));
const DisplayPlayer  = lazy(() => import('./views/display/DisplayPlayer.jsx').then(m => ({ default: m.DisplayPlayer })));
const MarketingHome  = lazy(() => import('./views/marketing/Home.jsx').then(m => ({ default: m.MarketingHome })));
const PrivacyPolicy  = lazy(() => import('./views/legal/PrivacyPolicy.jsx').then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import('./views/legal/TermsOfService.jsx').then(m => ({ default: m.TermsOfService })));

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

// ─── AppInner (auth-gated shell) ─────────────────────────────────────────────

function AppInner() {
  const { user, profile, activeMode, setActiveMode, loading, signOut, activeAccount, grants } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [impersonating,    setImpersonating] = useState(null); // { id, name }
  const impersonationLogId = useRef(null);
  const [campaigns,        setCampaigns]     = useState([]);
  const [dbScreens,        setDbScreens]     = useState([]); // advertiser-safe: live screens, no revenue/cpm
  const [myScreens,        setMyScreens]     = useState([]); // operator's own screens, full columns
  const [detail,           setDetail]        = useState(null);
  const [dataLoading,      setDataLoading]   = useState(false);
  const [loadError,        setLoadError]     = useState(null);
  const [selectedScreenId, setSelectedScreenId] = useState(null);

  // Derive active from current URL path
  const active = location.pathname.replace(/^\/app\/?/, '') || 'overview';

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
    navTo('adv-overview');
  }
  function stopImpersonation() {
    setImpersonating(null);
    navTo('advertisers');
  }

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setDataLoading(true)
    setLoadError(null)

    const bookingsQuery = supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false })

    // When acting as delegate, scope bookings to that account's data
    if (activeAccount && !activeAccount.isOwn) {
      bookingsQuery.eq('advertiser_id', activeAccount.id)
    }

    const [bookingsRes, screensRes, myScreensRes] = await Promise.all([
      bookingsQuery,
      // Advertiser-safe view: live screens only, no monthly_revenue.
      supabase.from('advertiser_screens').select('id,name,owner_name,owner_type,city,state,country,location,status,lat,lon,venue_category,venue_subtype,environment,screen_position,display_size,monthly_traffic_estimate,cpm_floor,operating_hours_start,operating_hours_end,auto_approve,screen_photos,content_categories_blocked,timezone,max_ad_duration,operator_id,last_seen,health_status').order('name'),
      // Operator's own screens: full columns, but only rows they own.
      supabase.from('screens').select('id,name,owner_name,owner_type,city,state,country,location,status,lat,lon,venue_category,venue_subtype,environment,screen_position,display_size,monthly_traffic_estimate,cpm_floor,operating_hours_start,operating_hours_end,auto_approve,screen_photos,content_categories_blocked,timezone,max_ad_duration,monthly_revenue,operator_id,last_seen,health_status').eq('operator_id', user.id).order('name'),
    ])

    if (bookingsRes.error) {
      console.error('Failed to load campaigns:', bookingsRes.error.message)
      setLoadError('Failed to load data. Please refresh.')
      setDataLoading(false)
      return
    }
    if (screensRes.error || myScreensRes.error) {
      console.error('Failed to load screens:', (screensRes.error || myScreensRes.error).message)
      setLoadError('Failed to load data. Please refresh.')
      setDataLoading(false)
      return
    }

    const bookings = bookingsRes.data
    const screens = screensRes.data
    const ownedScreens = myScreensRes.data
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
      })))
    } else {
      setCampaigns([])
    }
    if (screens && screens.length > 0) {
      setDbScreens(screens.map(s => ({
        ...s,
        neighbourhood: s.location,
        owner: s.owner_name,
        cpm: s.cpm_floor || 4.20,
        maxDuration: s.max_ad_duration,
        campaigns: 0,
      })))
    } else {
      setDbScreens([])
    }
    if (ownedScreens && ownedScreens.length > 0) {
      setMyScreens(ownedScreens.map(s => ({
        ...s,
        neighbourhood: s.location,
        owner: s.owner_name,
        cpm: s.cpm_floor || 4.20,
        maxDuration: s.max_ad_duration,
        revenue: s.monthly_revenue ?? 0,
        campaigns: 0,
      })))
    } else {
      setMyScreens([])
    }
    setDataLoading(false)
  }, [activeAccount, user])

  // Load data when user or activeAccount changes
  useEffect(() => {
    if (user) loadData()
  }, [user, activeAccount, loadData])

  // Update nav when mode changes
  useEffect(() => {
    if (user && activeMode) {
      navTo(activeMode === 'advertiser' ? 'adv-overview' : 'overview');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeMode]);

  // Redirect to account hub when user has grants and no active account chosen
  useEffect(() => {
    if (!user || !profile || !grants) return
    if (grants.length > 0 && !activeAccount && !sessionStorage.getItem('adgrid_active_account') && !sessionStorage.getItem('adgrid_hub_visited')) {
      const currentPath = location.pathname
      if (currentPath !== '/app/accounts' && !currentPath.startsWith('/app/accept-grant')) {
        navigate('/app/accounts')
      }
    }
  }, [user, profile, grants, activeAccount, navigate, location.pathname])

  // ── Stripe Connect redirect ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
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
          if (error) console.error('Failed to update connect status:', error.message);
          window.location.replace(window.location.pathname);
        });
    }
  }, [user]);

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

  const isAdv = impersonating ? true : activeMode === 'advertiser';
  const displayUser = { name: profile?.name || user.email?.split('@')[0] || 'User', email: user.email };
  const pendingCount = campaigns.filter(c => c.status === 'pending_review').length;

  // ── Navigation helper ──────────────────────────────────────────────────────
  const navTo = v => {
    navigate('/app/' + v);
    setDetail(null);
  };

  // ── Mutation helpers ───────────────────────────────────────────────────────
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

    // status is set by charge-campaign (service role) on payment, or by edge
    // functions for other transitions. The authenticated role does not have a
    // column-level UPDATE grant on status, so we skip the redundant client write.
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
      if (active === 'adv-overview')     return <AdvDashboard user={displayUser} campaigns={campaigns} setAdvNav={navTo} advertiserId={impersonating?.id ?? user.id} />;
      if (active === 'adv-create')       return (
        <CreateCampaign
          dbScreens={dbScreens}
          campaigns={campaigns}
          onSave={c => {
            setCampaigns(p => [c, ...p]);
            navTo('adv-campaigns');
          }}
          onCancel={() => navTo('adv-overview')}
        />
      );
      if (active === 'adv-campaigns')    return <Campaigns campaigns={campaigns} dbScreens={dbScreens} setCampaigns={setCampaigns} setDetail={c => setDetail(c)} loadError={loadError} loading={dataLoading} onNewCampaign={() => navTo('adv-create')} allowCancel />;
      if (active === 'adv-analytics')    return <Analytics campaigns={campaigns} loading={dataLoading} />;
      if (active === 'adv-audience')     return <ScansView impersonatingId={impersonating?.id ?? null} />;
      if (active === 'adv-billing')      return <AdvertiserBillingView />;
      if (active === 'adv-integrations') return <AdvIntegrationsView />;
      if (active === 'adv-settings')     return <SettingsView />;
      if (active === 'notif-prefs')      return <NotificationPrefsView />;
      return <AdvDashboard user={displayUser} campaigns={campaigns} setAdvNav={navTo} advertiserId={impersonating?.id ?? user.id} />;
    }

    if (active === 'overview')     return <Dashboard campaigns={campaigns} dbScreens={myScreens} setNav={navTo} loading={dataLoading} />;
    if (active === 'screen-onboard') return (
      <ScreenOnboardView
        onComplete={(newScreen) => {
          setMyScreens(prev => [...prev, {
            ...newScreen,
            neighbourhood: newScreen.location || '',
            cpm: 3.00,
            maxDuration: 30,
            revenue: 0,
            campaigns: 0,
            status: 'pending',
          }]);
          setSelectedScreenId(newScreen.id);
          setActiveMode('operator');
          navTo('screen-detail');
        }}
        onCancel={() => navTo('screens')}
      />
    );
    if (active === 'screens')      return (
      <ScreensView
        dbScreens={myScreens}
        setDbScreens={setMyScreens}
        loading={dataLoading}
        onSelectScreen={id => { setSelectedScreenId(id); navTo('screen-detail'); }}
        onStartOnboard={() => navTo('screen-onboard')}
      />
    );
    if (active === 'approval')      return <ApprovalQueue campaigns={campaigns} setCampaigns={setCampaigns} setDetail={c => setDetail(c)} dbScreens={myScreens} />;
    if (active === 'screen-detail') {
      if (!selectedScreenId) { navTo('screens'); return null; }
      return <ScreenDetailView screenId={selectedScreenId} onBack={() => navTo('screens')} profile={profile} onScreenUpdated={updated => setMyScreens(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s))} />;
    }
    if (active === 'notif-prefs')   return <NotificationPrefsView />;
    if (active === 'campaigns')    return <Campaigns campaigns={campaigns} dbScreens={myScreens} setCampaigns={setCampaigns} setDetail={c => setDetail(c)} loadError={loadError} loading={dataLoading} onNewCampaign={() => navTo('adv-create')} />;
    if (active === 'analytics')    return <Analytics campaigns={campaigns} loading={dataLoading} />;
    if (active === 'audience')     return <Audience campaigns={campaigns} />;
    if (active === 'revenue')      return <Revenue campaigns={campaigns} loading={dataLoading} />;
    if (active === 'billing')      return <Billing campaigns={campaigns} />;
    if (active === 'advertisers')  return <AdvertisersView onImpersonate={startImpersonation} />;
    if (active === 'signals')      return <SignalsView campaigns={campaigns} />;
    if (active === 'integrations') return <IntegrationsView />;
    if (active === 'display')      return <DisplayView campaigns={campaigns} />;
    if (active === 'op-settings')  return <OperatorSettingsView />;
    return <Dashboard campaigns={campaigns} setNav={navTo} loading={dataLoading} />;
  };

  return (
    <AppShell
      impersonating={impersonating}
      onStopImpersonation={stopImpersonation}
      sidebar={
        <Sidebar
          active={active}
          activeMode={impersonating ? 'advertiser' : activeMode}
          onModeSwitch={impersonating ? undefined : mode => {
            setActiveMode(mode);
            navTo(mode === 'advertiser' ? 'adv-overview' : 'overview');
          }}
          user={displayUser}
          onSignOut={signOut}
          pendingCount={pendingCount}
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

// ─── App ─────────────────────────────────────────────────────────────────────

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<PublicOnlyRoute><MarketingHome /></PublicOnlyRoute>} />
        <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/display/:token" element={<DisplayPlayerRoute />} />
        <Route path="/invite/:token" element={<InviteAcceptPage />} />
        <Route path="/app/accounts" element={<RequireAuth><AccountHubRoute /></RequireAuth>} />
        <Route
          path="/app/admin/invites"
          element={<RequireAuth><RequirePlatformOwner><AdminInvites /></RequirePlatformOwner></RequireAuth>}
        />
        <Route path="/app/accept-grant" element={<AcceptGrantView />} />
        <Route
          path="/app/*"
          element={
            <RequireAuth>
              <AppInner />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function AccountHubRoute() {
  const { setActiveAccount, setActiveMode, profile, user, signOut } = useAuth()
  const navigate = useNavigate()

  const displayUser = { name: profile?.name || user?.email?.split('@')[0] || 'User', email: user?.email }

  function handleSelect(account) {
    sessionStorage.setItem('adgrid_hub_visited', '1')
    if (account.isOwn) {
      setActiveAccount(null)
    } else {
      setActiveAccount(account)
      setActiveMode('advertiser')
    }
    navigate(account.isOwn ? '/app/overview' : '/app/adv-overview')
  }

  return (
    <AppShell
      sidebar={null}
      header={<GlobalHeader user={displayUser} onSignOut={signOut} />}
    >
      <AccountHub onSelectAccount={handleSelect} />
    </AppShell>
  )
}

function DisplayPlayerRoute() {
  const { token } = useParams();
  return <DisplayPlayer screenToken={token} />;
}
