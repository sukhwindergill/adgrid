import { useReveal } from './useReveal.js';
import { useT } from '../../../i18n/useT.js';

export function MarketBand() {
  const { tx } = useT();
  const [ref, on] = useReveal();
  return (
    <div className="market-band" ref={ref}>
      <p className={`rv ${on ? 'on' : ''}`}>
        {tx('marketing.marketBand', { strong: chunk => <strong>{chunk}</strong> })}
      </p>
    </div>
  );
}
