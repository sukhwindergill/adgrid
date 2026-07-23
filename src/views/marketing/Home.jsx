import { useNavigate } from 'react-router-dom';
import './marketing.css';
import { Nav } from './sections/Nav.jsx';
import { Hero } from './sections/Hero.jsx';
import { ProofStrip } from './sections/ProofStrip.jsx';
import { ProductShowcase } from './sections/ProductShowcase.jsx';
import { HowItWorks } from './sections/HowItWorks.jsx';
import { OperatorsSection } from './sections/OperatorsSection.jsx';
import { AdvertisersSection } from './sections/AdvertisersSection.jsx';
import { MarketBand } from './sections/MarketBand.jsx';
import { Faq } from './sections/Faq.jsx';
import { CtaBand } from './sections/CtaBand.jsx';
import { Footer } from './sections/Footer.jsx';

export function MarketingHome({ onLogin: onLoginProp }) {
  const navigate = useNavigate();
  const onLogin = onLoginProp ?? (() => navigate('/login'));
  const onOperatorSignup = () => navigate('/login?mode=signup&intent=operator');

  const scrollTo = id => {
    const el = document.getElementById(id);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' });
  };

  return (
    <div className="mktg" style={{ background: '#0A0A0F', minHeight: '100vh' }}>
      <Nav onScrollTo={scrollTo} onLogin={onLogin} />
      <Hero onScrollTo={scrollTo} onOperatorSignup={onOperatorSignup} />
      <ProofStrip />
      <ProductShowcase />
      <HowItWorks />
      <OperatorsSection onOperatorSignup={onOperatorSignup} />
      <AdvertisersSection />
      <MarketBand />
      <Faq />
      <CtaBand />
      <Footer onLogin={onLogin} onScrollTo={scrollTo} />
    </div>
  );
}
