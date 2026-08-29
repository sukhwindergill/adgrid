import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// StepCreative pulls in useAuth() and the favorites/recent-screens hooks
// (real supabase client throws under jsdom with no env) -- mock both, same
// pattern as StepCreative.smoke.test.jsx.
vi.mock('../../../lib/supabase.js', () => ({
  supabase: {
    storage: { from: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [] })),
          then: (resolve) => Promise.resolve({ data: [] }).then(resolve),
        })),
      })),
    })),
  },
}));
vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'u-1' } }),
}));

import { StepCreative } from './StepCreative.jsx';
import { makeBlankCreative } from '../../../lib/creativeAssignment.js';

// 3 screens: 'a' landscape, 'b' portrait, 'c' unknown resolution (defaults to landscape).
const matchedScreens = [
  { id: 'a', name: 'Landscape Screen', resolution_w: 1920, resolution_h: 1080, city: 'Toronto', impressions: 1000, screen_photos: [], screen_photo_frames: [] },
  { id: 'b', name: 'Portrait Screen', resolution_w: 1080, resolution_h: 1920, city: 'Toronto', impressions: 1000, screen_photos: [], screen_photo_frames: [] },
  { id: 'c', name: 'Third Creative Screen', resolution_w: 1920, resolution_h: 1080, city: 'Toronto', impressions: 1000, screen_photos: [], screen_photo_frames: [] },
];

function Wrapper() {
  const [form, setForm] = useState({
    selected_screen_ids: ['a', 'b', 'c'],
    env_filter: 'any', venue_filter: '',
    creatives: [
      makeBlankCreative({ id: 'cr-1', label: 'Creative 1', assigned_screen_ids: [] }),
      makeBlankCreative({ id: 'cr-2', label: 'Creative 2', assigned_screen_ids: [] }),
      // Creative 3 has already manually claimed screen 'c' -- this must survive a
      // split triggered from Creative 1 or 2.
      makeBlankCreative({ id: 'cr-3', label: 'Creative 3', assigned_screen_ids: ['c'] }),
    ],
  });
  return <StepCreative form={form} setForm={setForm} matchedScreens={matchedScreens} />;
}

describe('StepCreative splitByType (3+ creatives)', () => {
  it('does not steal a screen already manually assigned to a third creative', () => {
    render(<Wrapper />);

    const splitButtons = screen.getAllByText('Split by screen type →');
    // Click the first creative's split button.
    fireEvent.click(splitButtons[0]);

    // Screen 'a' (landscape) should now show "1 of 3" for Creative 1's assignment count,
    // and Creative 3's count must remain untouched at "1 of 3" (still just screen 'c').
    const counts = screen.getAllByText(/of 3 screen/);
    // Creative 1 (landscape: 'a'), Creative 2 (portrait: 'b'), Creative 3 (still just 'c')
    expect(counts).toHaveLength(3);
    counts.forEach(el => expect(el.textContent).toMatch(/^Show on \(1 of 3/));
  });
});
