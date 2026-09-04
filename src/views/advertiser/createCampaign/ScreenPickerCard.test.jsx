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
    expect(screen.queryByText('Preview')).not.toBeInTheDocument();
  });

  it('shows a disabled Preview button when marked but no creative is uploaded yet', () => {
    render(<ScreenPickerCard screen={MARKED} selected={[]} onToggle={() => {}} creative={NO_CREATIVE} />);
    expect(screen.getByText('Preview')).toBeDisabled();
  });

  it('opens the preview modal when clicked with a marked photo and an uploaded creative', () => {
    render(<ScreenPickerCard screen={MARKED} selected={[]} onToggle={() => {}} creative={IMAGE_CREATIVE} />);
    fireEvent.click(screen.getByText('Preview'));
    expect(screen.getByText(/Approximate preview/)).toBeInTheDocument();
  });

  it('clicking Preview does not toggle the card selection', () => {
    const onToggle = vi.fn();
    render(<ScreenPickerCard screen={MARKED} selected={[]} onToggle={onToggle} creative={IMAGE_CREATIVE} />);
    fireEvent.click(screen.getByText('Preview'));
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('ScreenPickerCard favorite star', () => {
  it('does not render a star when onToggleFavorite is not provided', () => {
    render(<ScreenPickerCard screen={BASE_SCREEN} selected={[]} onToggle={() => {}} creative={NO_CREATIVE} />);
    expect(screen.queryByTitle('Save as favorite')).not.toBeInTheDocument();
  });

  it('shows an unfilled star when not favorited, and calls onToggleFavorite with the screen id', () => {
    const onToggleFavorite = vi.fn();
    render(<ScreenPickerCard screen={BASE_SCREEN} selected={[]} onToggle={() => {}} creative={NO_CREATIVE} isFavorited={false} onToggleFavorite={onToggleFavorite} />);
    fireEvent.click(screen.getByTitle('Save as favorite'));
    expect(onToggleFavorite).toHaveBeenCalledWith('scr-1');
  });

  it('shows a filled star and different title when favorited', () => {
    render(<ScreenPickerCard screen={BASE_SCREEN} selected={[]} onToggle={() => {}} creative={NO_CREATIVE} isFavorited onToggleFavorite={() => {}} />);
    expect(screen.getByTitle('Remove from favorites')).toHaveTextContent('★');
  });

  it('clicking the star does not toggle the card selection', () => {
    const onToggle = vi.fn();
    render(<ScreenPickerCard screen={BASE_SCREEN} selected={[]} onToggle={onToggle} creative={NO_CREATIVE} onToggleFavorite={() => {}} />);
    fireEvent.click(screen.getByTitle('Save as favorite'));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
