import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ToastProvider } from '../../../components/primitives/Toast.jsx';
import { SavedAudiencesBar } from './SavedAudiencesBar.jsx';

vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'adv-1' } }),
}));

let templateRows = [];

vi.mock('../../../lib/targetingTemplates.js', () => ({
  listTargetingTemplates: vi.fn(() => Promise.resolve(templateRows)),
  saveTargetingTemplate: vi.fn(() => Promise.resolve({ id: 'new-1' })),
  deleteTargetingTemplate: vi.fn(() => Promise.resolve()),
  applyTargetingTemplate: (t) => ({ area_type: t.area_type, city: t.city, venue_filter: t.venue_filter }),
}));

import { listTargetingTemplates, saveTargetingTemplate, deleteTargetingTemplate } from '../../../lib/targetingTemplates.js';

function renderBar(props = {}) {
  return render(
    <ToastProvider>
      <SavedAudiencesBar form={{ area_type: 'city', city: 'Toronto', env_filter: 'any', venue_filter: '' }} onApply={vi.fn()} {...props} />
    </ToastProvider>
  );
}

describe('SavedAudiencesBar', () => {
  beforeEach(() => {
    templateRows = [];
    listTargetingTemplates.mockClear();
    saveTargetingTemplate.mockClear();
    deleteTargetingTemplate.mockClear();
  });

  it('lists saved audiences and applies one on click', async () => {
    templateRows = [{ id: 't1', name: 'Downtown malls', area_type: 'city', city: 'Toronto', venue_filter: 'mall' }];
    const onApply = vi.fn();
    renderBar({ onApply });

    await waitFor(() => screen.getByText('Downtown malls'));
    fireEvent.click(screen.getByText('Downtown malls'));

    expect(onApply).toHaveBeenCalledWith({ area_type: 'city', city: 'Toronto', venue_filter: 'mall' });
  });

  it('deletes a saved audience without applying it', async () => {
    templateRows = [{ id: 't1', name: 'Downtown malls', area_type: 'city' }];
    const onApply = vi.fn();
    renderBar({ onApply });

    await waitFor(() => screen.getByText('Downtown malls'));
    fireEvent.click(screen.getByLabelText('Delete Downtown malls'));

    await waitFor(() => expect(deleteTargetingTemplate).toHaveBeenCalledWith('t1'));
    expect(onApply).not.toHaveBeenCalled();
  });

  it('saves the current targeting under a typed name', async () => {
    renderBar();

    await waitFor(() => screen.getByText('🔖 Save current targeting as an audience'));
    fireEvent.click(screen.getByText('🔖 Save current targeting as an audience'));

    fireEvent.change(screen.getByPlaceholderText('e.g. Downtown malls'), { target: { value: 'My audience' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(saveTargetingTemplate).toHaveBeenCalledWith(
      'adv-1', 'My audience', { area_type: 'city', city: 'Toronto', env_filter: 'any', venue_filter: '' },
    ));
  });

  it('does not save with a blank name', async () => {
    renderBar();
    await waitFor(() => screen.getByText('🔖 Save current targeting as an audience'));
    fireEvent.click(screen.getByText('🔖 Save current targeting as an audience'));

    expect(screen.getByText('Save')).toBeDisabled();
  });

  it('renders nothing extra (no crash) when there are no saved audiences yet', async () => {
    renderBar();
    await waitFor(() => screen.getByText('Saved Audiences'));
    expect(screen.queryByLabelText(/Delete/)).not.toBeInTheDocument();
  });
});
