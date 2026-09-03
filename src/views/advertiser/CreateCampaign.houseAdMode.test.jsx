// src/views/advertiser/CreateCampaign.houseAdMode.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CreateCampaign } from './CreateCampaign.jsx';

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { id: 'op-1', email: 'op@example.com' },
    profile: { name: 'Op One', preferred_currency: 'cad' },
    activeAccount: null,
  }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Covers every supabase call this wizard's screen (StepCreative's favorites/
// recent-screens hooks), media upload (MediaUpload.jsx), and auth-session
// lookup (CreateCampaign's own handleSubmit) touch while driving the wizard
// through Creative -> Schedule -> submit.
vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [] })),
          then: (resolve) => Promise.resolve({ data: [] }).then(resolve),
        })),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/house-ad.jpg' } })),
      })),
    },
  },
}));

describe('CreateCampaign houseAdMode', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, campaign_id: 'c1' }) });
    // jsdom never fires an <img> element's load/error event for a blob: URL,
    // so MediaUpload's getMediaDimensions() call (real Image(), no injected
    // fake) would hang forever mid-upload. Stub a minimal Image that
    // resolves asynchronously, same shape mediaDimensions.test.js's fakeImage
    // helper uses for the same reason.
    global.Image = class {
      set src(_v) { setTimeout(() => this.onload?.(), 0); }
      get naturalWidth() { return 1920; }
      get naturalHeight() { return 1080; }
    };
  });

  it('calls create-house-ad instead of inserting bookings directly, and skips the pay step', async () => {
    const onSave = vi.fn();
    render(
      <MemoryRouter>
        <CreateCampaign
          houseAdMode
          presetScreenIds={['s1']}
          dbScreens={[{ id: 's1', name: 'Lobby Screen', status: 'live', operator_id: 'op-1' }]}
          onSave={onSave}
          onCancel={() => {}}
        />
      </MemoryRouter>
    );

    // houseAdMode + presetScreenIds starts the wizard directly on the
    // Creative step (screen targeting is preset, same as the existing
    // screen-invite flow) -- so this drives Creative -> Schedule -> submit.
    expect(await screen.findByText('Screens')).toBeInTheDocument();

    // Upload a creative via MediaUpload's real file input, same interaction
    // a real advertiser/operator performs. The mocked supabase.storage
    // upload/getPublicUrl above stand in for Supabase Storage.
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
    const file = new File(['fake-image-bytes'], 'house-ad.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/uploaded ✓/)).toBeInTheDocument();
    });

    // Advance to the Schedule step.
    const nextBtn = screen.getByRole('button', { name: /Next →/ });
    await waitFor(() => expect(nextBtn).not.toBeDisabled());
    fireEvent.click(nextBtn);

    // Now on StepBudgetReview (Schedule step in house-ad mode) -- budget UI
    // should be hidden, and the submit button should read "Create House Ad".
    const submitBtn = await screen.findByRole('button', { name: /Create House Ad/ });
    expect(screen.queryByText('Budget type')).not.toBeInTheDocument();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/create-house-ad'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    // The old direct-insert path (bookings/campaign_screens) must never be
    // hit -- create-house-ad is the only thing that should reach fetch.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.screen_ids).toEqual(['s1']);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ is_house_ad: true, id: 'c1' }));
    });
  });
});
