// src/views/advertiser/createCampaign/StepCreative.creativeForScreen.test.jsx
// Dedicated coverage for which creative StepCreative hands each
// ScreenPickerCard for the ad-render preview button.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/supabase.js', () => ({
  supabase: { storage: { from: vi.fn() } },
}));
vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'u-1' } }),
}));

import { StepCreative } from './StepCreative.jsx';
import { makeBlankCreative } from '../../../lib/creativeAssignment.js';

const SCREEN_A = {
  id: 'scr-1', name: 'Corner Brew — Oxford St', city: 'London', environment: 'indoor',
  impressions: 84200, resolution_w: 1920, resolution_h: 1080, accepted_formats: ['jpg', 'mp4'], max_file_mb: 50,
  screen_photos: ['https://example.com/a.jpg'],
  screen_photo_frames: [{ url: 'https://example.com/a.jpg', corners: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] }],
};
const SCREEN_B = {
  id: 'scr-2', name: 'Canary Wharf Plaza', city: 'London', environment: 'outdoor',
  impressions: 210000, resolution_w: 1080, resolution_h: 1920, accepted_formats: ['jpg', 'mp4'], max_file_mb: 50,
};

describe('StepCreative creative-per-screen wiring', () => {
  it('gives every screen the single default creative when there is only one', () => {
    const form = {
      selected_screen_ids: [SCREEN_A.id],
      env_filter: 'any', duration: 15,
      creatives: [makeBlankCreative({ id: 'c1', media_url: 'https://example.com/ad.png', media_type: 'image' })],
    };
    render(<StepCreative form={form} setForm={() => {}} matchedScreens={[SCREEN_A, SCREEN_B]} />);
    expect(screen.getByText('👁 Preview')).toBeEnabled();
  });

  it('falls back to the first creative for a screen no creative has explicitly claimed', () => {
    const c1 = makeBlankCreative({ id: 'c1', media_url: 'https://example.com/ad1.png', media_type: 'image', assigned_screen_ids: [] });
    const c2 = makeBlankCreative({ id: 'c2', media_url: 'https://example.com/ad2.png', media_type: 'image', assigned_screen_ids: [] });
    const form = {
      selected_screen_ids: [SCREEN_A.id],
      env_filter: 'any', duration: 15,
      creatives: [c1, c2],
    };
    render(<StepCreative form={form} setForm={() => {}} matchedScreens={[SCREEN_A, SCREEN_B]} />);
    // SCREEN_A is unassigned in this multi-creative campaign -- falls back
    // to creatives[0] (c1), which has media, so Preview is enabled.
    expect(screen.getByText('👁 Preview')).toBeEnabled();
  });
});
