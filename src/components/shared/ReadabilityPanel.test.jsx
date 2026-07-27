import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReadabilityPanel } from './ReadabilityPanel.jsx';

const baseCampaign = { headline: 'Half Price Burgers', media_url: 'https://example.com/a.png', media_type: 'image' };

describe('ReadabilityPanel', () => {
  it('renders nothing when score is null', () => {
    const { container } = render(<ReadabilityPanel campaign={baseCampaign} score={null} issues={[]} tiers={[]} />);
    expect(container.textContent).toBe('');
  });

  it('renders nothing when score is undefined', () => {
    const { container } = render(<ReadabilityPanel campaign={baseCampaign} />);
    expect(container.textContent).toBe('');
  });

  it('shows the score', () => {
    render(<ReadabilityPanel campaign={baseCampaign} score={82} issues={[]} tiers={[]} />);
    expect(screen.getByText(/82/)).toBeInTheDocument();
  });

  it('shows every issue message', () => {
    render(
      <ReadabilityPanel
        campaign={baseCampaign}
        score={50}
        issues={[
          { type: 'read_time', message: '14 words — a 10s play gives time to read about 8.' },
          { type: 'contrast', message: 'CTA color has weak contrast against the background (2.1:1, needs 4.5:1).' },
        ]}
        tiers={[]}
      />
    );
    expect(screen.getByText(/14 words/)).toBeInTheDocument();
    expect(screen.getByText(/weak contrast/)).toBeInTheDocument();
  });

  it('renders one preview per tier with its label', () => {
    render(<ReadabilityPanel campaign={baseCampaign} score={90} issues={[]} tiers={['close', 'far']} />);
    expect(screen.getByText('Up close')).toBeInTheDocument();
    expect(screen.getByText('From a distance')).toBeInTheDocument();
  });

  it('renders no preview cards when tiers is empty', () => {
    render(<ReadabilityPanel campaign={baseCampaign} score={90} issues={[]} tiers={[]} />);
    expect(screen.queryByText('Up close')).not.toBeInTheDocument();
    expect(screen.queryByText('From a distance')).not.toBeInTheDocument();
  });
});
