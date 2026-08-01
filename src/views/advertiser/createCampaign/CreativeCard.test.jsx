// Dedicated coverage for CreativeCard.jsx's screen-assignment checkboxes --
// previously only exercised indirectly via StepCreative.smoke.test.jsx.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// CreativeCard renders MediaUpload, which imports the real supabase client
// (throws "supabaseUrl is required" under jsdom with no env) and useAuth()
// from AuthContext. Neither is exercised here -- mock both, same pattern as
// StepCreative.smoke.test.jsx in this directory.
vi.mock('../../../lib/supabase.js', () => ({
  supabase: { storage: { from: vi.fn() } },
}));
vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'u-1' } }),
}));

import { CreativeCard } from './CreativeCard.jsx';
import { makeBlankCreative } from '../../../lib/creativeAssignment.js';

const SCREEN_ONE = {
  id: 'scr-1', name: 'Screen One', city: 'London', environment: 'indoor',
  impressions: 84200, resolution_w: 1920, resolution_h: 1080, accepted_formats: ['jpg', 'mp4'], max_file_mb: 50,
};
const SCREEN_TWO = {
  id: 'scr-2', name: 'Screen Two', city: 'London', environment: 'outdoor',
  impressions: 210000, resolution_w: 1080, resolution_h: 1920, accepted_formats: ['jpg', 'mp4'], max_file_mb: 50,
};
const POOL_SCREENS = [SCREEN_ONE, SCREEN_TWO];

describe('CreativeCard', () => {
  it('hides the screen-assignment UI when showAssignment is false', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A' });
    render(
      <CreativeCard
        creative={creative}
        onChange={() => {}}
        onRemove={undefined}
        poolScreens={POOL_SCREENS}
        allCreatives={[creative]}
        showAssignment={false}
        duration={15}
        onSplitByType={() => {}}
        profile={null}
      />
    );
    expect(screen.queryByText(/Split by screen type/)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Screen One/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Screen Two/i })).not.toBeInTheDocument();
  });

  it('shows one checkbox per pool screen when showAssignment is true', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A' });
    const other = makeBlankCreative({ id: 'c2', label: 'B' });
    render(
      <CreativeCard
        creative={creative}
        onChange={() => {}}
        onRemove={() => {}}
        poolScreens={POOL_SCREENS}
        allCreatives={[creative, other]}
        showAssignment={true}
        duration={15}
        onSplitByType={() => {}}
        profile={null}
      />
    );
    expect(screen.getByRole('checkbox', { name: /Screen One/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Screen Two/i })).toBeInTheDocument();
  });

  it('calls onChange with the screen added to assigned_screen_ids when its checkbox is checked', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', assigned_screen_ids: [] });
    const other = makeBlankCreative({ id: 'c2', label: 'B' });
    const onChange = vi.fn();
    render(
      <CreativeCard
        creative={creative}
        onChange={onChange}
        onRemove={() => {}}
        poolScreens={POOL_SCREENS}
        allCreatives={[creative, other]}
        showAssignment={true}
        duration={15}
        onSplitByType={() => {}}
        profile={null}
      />
    );
    const checkbox = screen.getByRole('checkbox', { name: /Screen One/i });
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ ...creative, assigned_screen_ids: [SCREEN_ONE.id] })
    );
  });

  it('unchecks a checkbox by removing the screen from assigned_screen_ids', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', assigned_screen_ids: [SCREEN_ONE.id] });
    const other = makeBlankCreative({ id: 'c2', label: 'B' });
    const onChange = vi.fn();
    render(
      <CreativeCard
        creative={creative}
        onChange={onChange}
        onRemove={() => {}}
        poolScreens={POOL_SCREENS}
        allCreatives={[creative, other]}
        showAssignment={true}
        duration={15}
        onSplitByType={() => {}}
        profile={null}
      />
    );
    const checkbox = screen.getByRole('checkbox', { name: /Screen One/i });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ ...creative, assigned_screen_ids: [] })
    );
  });

  it('hides the weight input when this creative does not overlap another on a shared screen', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', assigned_screen_ids: [SCREEN_ONE.id] });
    const other = makeBlankCreative({ id: 'c2', label: 'B', assigned_screen_ids: [SCREEN_TWO.id] });
    render(
      <CreativeCard
        creative={creative}
        onChange={() => {}}
        onRemove={() => {}}
        poolScreens={POOL_SCREENS}
        allCreatives={[creative, other]}
        showAssignment={true}
        duration={15}
        onSplitByType={() => {}}
        profile={null}
      />
    );
    expect(screen.queryByText(/Share of plays on shared screens/)).not.toBeInTheDocument();
  });

  it('shows the weight input when this creative overlaps another on a shared screen', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', assigned_screen_ids: [SCREEN_ONE.id] });
    const other = makeBlankCreative({ id: 'c2', label: 'B', assigned_screen_ids: [SCREEN_ONE.id, SCREEN_TWO.id] });
    render(
      <CreativeCard
        creative={creative}
        onChange={() => {}}
        onRemove={() => {}}
        poolScreens={POOL_SCREENS}
        allCreatives={[creative, other]}
        showAssignment={true}
        duration={15}
        onSplitByType={() => {}}
        profile={null}
      />
    );
    expect(screen.getByText(/Share of plays on shared screens/)).toBeInTheDocument();
  });
});
