import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StickyMobileCta } from './StickyMobileCta.jsx';

describe('StickyMobileCta', () => {
  it('fires onOperatorSignup and onBookCampaign from its two buttons', () => {
    const onOperatorSignup = vi.fn();
    const onBookCampaign = vi.fn();
    render(<StickyMobileCta onOperatorSignup={onOperatorSignup} onBookCampaign={onBookCampaign} />);

    fireEvent.click(screen.getByRole('button', { name: /list your screens/i }));
    fireEvent.click(screen.getByRole('button', { name: /book a campaign/i }));

    expect(onOperatorSignup).toHaveBeenCalledTimes(1);
    expect(onBookCampaign).toHaveBeenCalledTimes(1);
  });
});
