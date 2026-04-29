import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { supabase } from './lib/supabase.js';
import { SCREENS, INIT_CAMPAIGNS } from './lib/data.js';

import { LoginPage } from './components/login/LoginPage.jsx';
import { GlobalHeader } from './components/layout/GlobalHeader.jsx';
import { AppShell } from './components/layout/AppShell.jsx';

import { Dashboard } from './views/operator/Dashboard.jsx';
import { Campaigns } from './views/operator/Campaigns.jsx';
import { CampaignDetail } from './views/operator/CampaignDetail.jsx';
import { ScreensView } from './views/operator/Screens.jsx';
import { Analytics } from './views/operator/Analytics.jsx';
import { Audience } from './views/operator/Audience.jsx';
import { Revenue } from './views/operator/Revenue.jsx';
import { Billing } from './views/operator/Billing.jsx';
import { Advertisers } from './views/operator/Advertisers.jsx';

import { AdvDashboard } from './views/advertiser/AdvDashboard.jsx';
import { CreateCampaign } from './views/advertiser/CreateCampaign.jsx';
import { ScansData } from './views/advertiser/ScansData.jsx';

import { SignalsView } from './views/shared/SignalsView.jsx';
import { IntegrationsView } from './views/shared/IntegrationsView.jsx';
import { DisplayView } from './views/shared/DisplayView.jsx';
import { Placeholder } from './views/shared/Placeholder.jsx';

import { C, F } from './design/tokens.js';

export default function App() {
  const { user, profile, role, loading, signOut } = useAuth();
  const [active,      setActive]      = useState('overview');
  const [campaigns,   setCampaigns]   = useState([]);
  const [dbScreens,   setDbScreens]   = useState([]);
  const [detail,      setDetail]      = useState(null);
  const [dataLoading, setDataLoading] = useState(false);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    const [{ data: bookings }, { data: screens }] = await Promise.all([
      supabase.from('bookings').select('*').order('created_at', { ascending: false }),
      supabase.from('screens').select('*').order('name'),
    ]);
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
        spent: Math.round(b.budget * 0.65),
        scans: Math.round(b.impressions * 0.003),
        color: b.accent_color,
        destination: b.destination_url,
      })));
    } else {
      setCampaigns(INIT_CAMPAIGNS);
    }
    if (screens && screens.length > 0) {
      setDbScreens(screens.map(s => ({
        ...s,
        neighbourhood: s.location,
        cpm: 4.20,
        maxDuration: s.max_ad_duration,
        revenue: s.monthly_revenue,
      })));
    }
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      setActive(role === 'advertiser' ? 'adv-overview' : 'overview');
      loadData();
    }
  }, [user, role, loadData]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>Loading…</div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const isAdv = role === 'advertiser';
  const displayUser = { name: profile?.name || user.email?.split('@')[0] || 'User', email: user.email, role };

  const updateCampaign = updated => {
    setCampaigns(prev => prev.map(c => c.id === updated.id ? updated : c));
    setDetail(updated);
  };

  const navigate = v => { setActive(v); setDetail(null); };

  const view = () => {
    if (detail && (active === 'campaigns' || active === 'analytics' || active === 'adv-campaigns')) {
      return <CampaignDetail campaign={detail} onBack={() => setDetail(null)} onUpdate={updateCampaign} />;
    }

    if (isAdv) {
      if (active === 'adv-overview')  return <AdvDashboard user={displayUser} campaigns={campaigns} setAdvNav={navigate} />;
      if (active === 'adv-create')    return <CreateCampaign onSave={c => { setCampaigns(p => [c, ...p]); navigate('adv-campaigns'); }} onCancel={() => navigate('adv-overview')} />;
      if (active === 'adv-campaigns') return <Campaigns campaigns={campaigns} setCampaigns={setCampaigns} setDetail={c => { setDetail(c); }} />;
      if (active === 'adv-analytics') return <Analytics campaigns={campaigns} />;
      if (active === 'adv-audience')  return <ScansData />;
      if (active === 'adv-billing')   return <Placeholder title="Billing" subtitle="Invoices and payments" icon="$" />;
      if (active === 'adv-settings')  return <Placeholder title="Settings" subtitle="Account and preferences" icon="⚙" />;
      return <AdvDashboard user={displayUser} campaigns={campaigns} setAdvNav={navigate} />;
    }

    if (active === 'overview')     return <Dashboard campaigns={campaigns} setNav={navigate} loading={dataLoading} />;
    if (active === 'screens')      return <ScreensView />;
    if (active === 'campaigns')    return <Campaigns campaigns={campaigns} setCampaigns={setCampaigns} setDetail={c => { setDetail(c); }} />;
    if (active === 'analytics')    return <Analytics campaigns={campaigns} />;
    if (active === 'audience')     return <Audience />;
    if (active === 'revenue')      return <Revenue campaigns={campaigns} />;
    if (active === 'billing')      return <Billing />;
    if (active === 'advertisers')  return <Advertisers campaigns={campaigns} setNav={navigate} />;
    if (active === 'signals')      return <SignalsView campaigns={campaigns} />;
    if (active === 'integrations') return <IntegrationsView />;
    if (active === 'display')      return <DisplayView />;
    return <Dashboard campaigns={campaigns} setNav={navigate} loading={dataLoading} />;
  };

  return (
    <AppShell
      header={
        <GlobalHeader
          active={active}
          setActive={navigate}
          user={displayUser}
          onSignOut={signOut}
          isAdv={isAdv}
        />
      }
    >
      <div key={active} className="fade-in">
        {view()}
      </div>
    </AppShell>
  );
}
