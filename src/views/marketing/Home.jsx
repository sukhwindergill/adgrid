import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import './marketing.css';
import { usePageMeta } from '../../lib/usePageMeta.js';
import { Nav } from './sections/Nav.jsx';
import { Hero } from './sections/Hero.jsx';
import { ProofStrip } from './sections/ProofStrip.jsx';
import { ProductShowcase } from './sections/ProductShowcase.jsx';
import { HowItWorks } from './sections/HowItWorks.jsx';
import { OperatorsSection } from './sections/OperatorsSection.jsx';
import { EarningsCalculator } from './sections/EarningsCalculator.jsx';
import { AdvertisersSection } from './sections/AdvertisersSection.jsx';
import { MarketBand } from './sections/MarketBand.jsx';
import { Faq } from './sections/Faq.jsx';
import { CtaBand } from './sections/CtaBand.jsx';
import { Footer } from './sections/Footer.jsx';
import { StickyMobileCta } from './sections/StickyMobileCta.jsx';
import { FloatingContactButton } from '../../components/chrome/FloatingContactButton.jsx';
import { CookieBanner } from '../../components/chrome/CookieBanner.jsx';

export function MarketingHome({ onLogin: onLoginProp }) {
  usePageMeta({
    title: "AdGrid | Canada's OOH Marketplace",
    description: "AdGrid is the self-serve marketplace connecting Canadian digital screen operators with local advertisers. Real-time pricing, full control on both sides.",
  });
  const navigate = useNavigate();
  const onLogin = onLoginProp ?? (() => navigate('/login'));
  // Pre-launch: every CTA lands on the waitlist form with the visitor's side
  // of the marketplace pre-selected, instead of the open sign-up page.
  // ?role=advertiser (e.g. from /screens) pre-selects the advertiser side.
  const [searchParams] = useSearchParams();
  const [waitlistRole, setWaitlistRole] = useState(() => (searchParams.get('role') === 'advertiser' ? 'advertiser' : 'operator'));

  const scrollTo = id => {
    const el = document.getElementById(id);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' });
  };

  const joinWaitlist = role => {
    setWaitlistRole(role);
    scrollTo('waitlist-form');
  };
  const onOperatorSignup = () => joinWaitlist('operator');

  // Deep links like /#earnings (from the thank-you page): the SPA router
  // doesn't scroll to hashes on its own. Sections render synchronously, so
  // one frame is enough for the target to exist.
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const id = requestAnimationFrame(() => scrollTo(hash.slice(1)));
    return () => cancelAnimationFrame(id);
  }, [hash]);
  const onAdvertiserSignup = () => joinWaitlist('advertiser');

  return (
    <div id="main-content" className="mktg" style={{ background: '#0A0A0F', minHeight: '100vh' }}>
      <Nav onScrollTo={scrollTo} onLogin={onLogin} />
      <Hero onOperatorSignup={onOperatorSignup} onAdvertiserSignup={onAdvertiserSignup} />
      <ProofStrip />
      <ProductShowcase />
      <HowItWorks />
      <OperatorsSection onOperatorSignup={onOperatorSignup} />
      <EarningsCalculator onOperatorSignup={onOperatorSignup} />
      <AdvertisersSection onAdvertiserSignup={onAdvertiserSignup} />
      <MarketBand />
      <Faq />
      <CtaBand role={waitlistRole} onRoleChange={setWaitlistRole} />
      <Footer onLogin={onLogin} onScrollTo={scrollTo} />
      <StickyMobileCta onOperatorSignup={onOperatorSignup} onBookCampaign={onAdvertiserSignup} />
      <FloatingContactButton onClick={() => scrollTo('waitlist-form')} />
      <CookieBanner />
    </div>
  );
}
