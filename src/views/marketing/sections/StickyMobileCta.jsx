import { useT } from '../../../i18n/useT.js';
// Fixed-bottom CTA bar, mobile-only (see .sticky-mobile-cta in marketing.css
// — hidden above the site's existing 768px breakpoint). Reuses the same
// handlers Hero.jsx wires to its two primary buttons, so both entry points
// stay behaviorally identical.
export function StickyMobileCta({ onOperatorSignup, onBookCampaign }) {
  const { t } = useT();
  return (
    <div className="sticky-mobile-cta">
      <button className="btn-s" onClick={onOperatorSignup}>{t('marketing.cta.listScreens')}</button>
      <button className="btn-p" onClick={onBookCampaign}>{t('marketing.cta.bookCampaign')}</button>
    </div>
  );
}
