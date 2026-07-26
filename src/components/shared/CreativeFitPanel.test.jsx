import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CreativeFitPanel } from './CreativeFitPanel.jsx';

const baseCampaign = { headline: 'Test', media_url: 'https://example.com/a.png', media_type: 'image' };

describe('CreativeFitPanel', () => {
  it('renders nothing when there are no mismatches', () => {
    const { container } = render(<CreativeFitPanel campaign={baseCampaign} mismatches={[]} />);
    expect(container.textContent).toBe('');
  });

  it('renders nothing when mismatches is not provided', () => {
    const { container } = render(<CreativeFitPanel campaign={baseCampaign} />);
    expect(container.textContent).toBe('');
  });

  it('shows the screen name and reasons for each mismatch', () => {
    render(
      <CreativeFitPanel
        campaign={baseCampaign}
        mismatches={[
          { screenId: 's1', screenName: 'Shoreditch Coffee Co', reasons: ['orientation'], resolution_w: 1080, resolution_h: 1920 },
        ]}
      />
    );
    expect(screen.getByText('Shoreditch Coffee Co')).toBeInTheDocument();
    expect(screen.getByText(/wrong orientation/i)).toBeInTheDocument();
  });

  it('lists every reason for a screen with multiple mismatches', () => {
    render(
      <CreativeFitPanel
        campaign={baseCampaign}
        mismatches={[
          { screenId: 's1', screenName: 'Brixton Market Bar', reasons: ['format', 'file_size'], resolution_w: 1920, resolution_h: 1080 },
        ]}
      />
    );
    expect(screen.getByText(/format not accepted/i)).toBeInTheDocument();
    expect(screen.getByText(/file too large/i)).toBeInTheDocument();
  });

  it('renders one panel per mismatched screen', () => {
    render(
      <CreativeFitPanel
        campaign={baseCampaign}
        mismatches={[
          { screenId: 's1', screenName: 'Screen One', reasons: ['orientation'], resolution_w: 1080, resolution_h: 1920 },
          { screenId: 's2', screenName: 'Screen Two', reasons: ['format'], resolution_w: 1920, resolution_h: 1080 },
        ]}
      />
    );
    expect(screen.getByText('Screen One')).toBeInTheDocument();
    expect(screen.getByText('Screen Two')).toBeInTheDocument();
  });
});
