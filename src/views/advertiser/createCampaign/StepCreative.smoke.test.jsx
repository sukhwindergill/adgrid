// Throwaway smoke test — confirms StepCreative.jsx and CreativeCard.jsx are
// syntactically valid and resolvable (imports exist, renders without
// throwing) before they are wired into CreateCampaign.jsx's render switch in
// a later task.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// StepCreative pulls in CreativeCard -> MediaUpload, which imports the real
// supabase client (throws "supabaseUrl is required" under jsdom with no env)
// and useAuth() from AuthContext. Neither is exercised by this smoke test --
// mock both, same pattern as SettingsView.test.jsx / AuthContext.test.jsx.
vi.mock('../../../lib/supabase.js', () => ({
  supabase: { storage: { from: vi.fn() } },
}));
vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'u-1' } }),
}));

import { StepCreative } from './StepCreative.jsx';

const SCREEN_A = {
  id: 'scr-1', name: 'Corner Brew — Oxford St', city: 'London', environment: 'indoor',
  impressions: 84200, resolution_w: 1920, resolution_h: 1080, accepted_formats: ['jpg', 'mp4'], max_file_mb: 50,
};
const SCREEN_B = {
  id: 'scr-2', name: 'Canary Wharf Plaza', city: 'London', environment: 'outdoor',
  impressions: 210000, resolution_w: 1080, resolution_h: 1920, accepted_formats: ['jpg', 'mp4'], max_file_mb: 50,
};

const baseForm = {
  selected_screen_ids: [SCREEN_A.id, SCREEN_B.id],
  env_filter: 'any',
  duration: 15,
  creatives: [],
};

describe('StepCreative', () => {
  it('renders the default single-creative flow without assignment UI', () => {
    render(
      <StepCreative form={baseForm} setForm={() => {}} matchedScreens={[SCREEN_A, SCREEN_B]} />
    );
    expect(screen.getByText('Screens')).toBeInTheDocument();
    expect(screen.getByText('Creative')).toBeInTheDocument();
    expect(screen.queryByText(/Split by screen type/)).not.toBeInTheDocument();
  });

  it('reveals per-creative assignment once a second creative is added', () => {
    const form = {
      ...baseForm,
      creatives: [
        { id: 'c1', label: 'A', headline: '', cta_text: '', destination_url: '', accent_color: '#7c3aed', category: 'Food & Beverage', media_url: '', media_type: '', media_width: null, media_height: null, assigned_screen_ids: [SCREEN_A.id], weight: 100 },
        { id: 'c2', label: 'B', headline: '', cta_text: '', destination_url: '', accent_color: '#7c3aed', category: 'Food & Beverage', media_url: '', media_type: '', media_width: null, media_height: null, assigned_screen_ids: [], weight: 100 },
      ],
    };
    render(
      <StepCreative form={form} setForm={() => {}} matchedScreens={[SCREEN_A, SCREEN_B]} />
    );
    expect(screen.getByText('Creatives')).toBeInTheDocument();
    expect(screen.getAllByText(/Split by screen type/).length).toBe(2);
    // scr-2 isn't claimed by either creative -- the "unassigned" banner should surface it.
    expect(screen.getByText(/aren't assigned to a creative yet/)).toBeInTheDocument();
  });
});
