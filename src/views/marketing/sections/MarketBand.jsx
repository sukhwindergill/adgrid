import { useReveal } from './useReveal.js';

export function MarketBand() {
  const [ref, on] = useReveal();
  return (
    <div className="market-band" ref={ref}>
      <p className={`rv ${on ? 'on' : ''}`}>
        <strong>Out-of-home advertising in Canada is a billion-dollar market</strong> — and most of
        it is still bought over email, phone calls, and PDFs. AdGrid brings it online.
      </p>
    </div>
  );
}
