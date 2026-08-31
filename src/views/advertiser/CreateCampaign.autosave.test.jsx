// Smoke test for the wizard's draft-autosave wiring: typing into the
// Targeting step should eventually persist a draft, and remounting the
// wizard should silently resume it.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: () => ({ insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'c1' }, error: null }) }) }) }),
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
  },
}));
vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'adv@example.com' },
    profile: { name: 'Adv', brand_color_1: '#7c3aed' },
    activeAccount: null,
  }),
}));

import { CreateCampaign } from './CreateCampaign.jsx';
import { listDrafts } from '../../lib/campaignDrafts.js';

function renderWizard() {
  return render(
    <MemoryRouter>
      <CreateCampaign onSave={() => {}} onCancel={() => {}} dbScreens={[]} campaigns={[]} />
    </MemoryRouter>
  );
}

describe('CreateCampaign draft autosave', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('persists a draft once the advertiser types a campaign name, and resumes it on remount', async () => {
    renderWizard();
    const nameInput = await screen.findByPlaceholderText(/summer promo/i);
    fireEvent.change(nameInput, { target: { value: 'Ottawa Launch' } });

    await waitFor(() => {
      const drafts = listDrafts('user-1');
      expect(drafts).toHaveLength(1);
      expect(drafts[0].form.name).toBe('Ottawa Launch');
    }, { timeout: 2000 });

    cleanup();
    renderWizard();

    await waitFor(() => {
      expect(screen.getByText(/continuing draft/i)).toBeInTheDocument();
    });
    expect(await screen.findByDisplayValue('Ottawa Launch')).toBeInTheDocument();
  });

  it('does not save a draft for an untouched wizard', async () => {
    renderWizard();
    await screen.findByPlaceholderText(/summer promo/i);
    await new Promise(r => setTimeout(r, 1000));
    expect(listDrafts('user-1')).toHaveLength(0);
  });
});
