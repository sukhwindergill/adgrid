// src/views/advertiser/createCampaign/ScreenPickerCard.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScreenPickerCard } from './ScreenPickerCard.jsx';

const BASE_SCREEN = {
  id: 'scr-1', name: 'Corner Brew — King St', city: 'Toronto', environment: 'indoor',
  impressions: 84200, venue_category: 'cafe',
  screen_photos: ['https://example.com/a.jpg'],
};
const MARKED = {
  ...BASE_SCREEN,
  screen_photo_frames: [{ url: 'https://example.com/a.jpg', corners: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] }],
};
const IMAGE_CREATIVE = { media_url: 'https://example.com/ad.png', media_type: 'image' };
const NO_CREATIVE = { media_url: '', media_type: '' };

describe('ScreenPickerCard preview button', () => {
  it('shows no Preview button when the screen has no marked photos', () => {
    render(<ScreenPickerCard screen={BASE_SCREEN} selected={[]} onToggle={() => {}} creative={IMAGE_CREATIVE} />);
    expect(screen.queryByText('👁 Preview')).not.toBeInTheDocument();
  });

  it('shows a disabled Preview button when marked but no creative is uploaded yet', () => {
    render(<ScreenPickerCard screen={MARKED} selected={[]} onToggle={() => {}} creative={NO_CREATIVE} />);
    expect(screen.getByText('👁 Preview')).toBeDisabled();
  });

  it('opens the preview modal when clicked with a marked photo and an uploaded creative', () => {
    render(<ScreenPickerCard screen={MARKED} selected={[]} onToggle={() => {}} creative={IMAGE_CREATIVE} />);
    fireEvent.click(screen.getByText('👁 Preview'));
    expect(screen.getByText(/Approximate preview/)).toBeInTheDocument();
  });

  it('clicking Preview does not toggle the card selection', () => {
    const onToggle = vi.fn();
    render(<ScreenPickerCard screen={MARKED} selected={[]} onToggle={onToggle} creative={IMAGE_CREATIVE} />);
    fireEvent.click(screen.getByText('👁 Preview'));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
