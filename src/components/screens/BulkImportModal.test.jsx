import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IMPORT_CSV_COLUMNS } from '../../lib/screenCsvImport.js';

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'op-1' } }),
}));

const insertMock = vi.fn(() => ({ select: () => Promise.resolve({ data: [{ id: 's1', name: 'Row 1' }], error: null }) }));
vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: vi.fn(() => ({ insert: (...args) => insertMock(...args) })) },
}));

vi.mock('../../lib/geocodeAddress.js', () => ({
  geocodeAddress: vi.fn(() => Promise.resolve({ lat: 43.6, lng: -79.3 })),
}));

import { BulkImportModal } from './BulkImportModal.jsx';

const HEADER = IMPORT_CSV_COLUMNS.join(',');
const validLine = 'Row 1,Acme,CA,Ontario,Toronto,123 Main St,retail,Clothing,Indoor,window,55in,5000,43.6708,-79.3899';
const invalidLine = ',Acme,CA,Ontario,Toronto,123 Main St,retail,Clothing,Indoor,window,55in,5000,43.6708,-79.3899';

function makeCsvFile(content) {
  const file = new File([content], 'screens.csv', { type: 'text/csv' });
  // jsdom's File doesn't implement .text() -- polyfill for this test env.
  file.text = () => Promise.resolve(content);
  return file;
}

describe('BulkImportModal', () => {
  it('shows row-level validation results after a CSV is uploaded', async () => {
    render(<BulkImportModal onClose={() => {}} onImported={() => {}} />);
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [makeCsvFile(`${HEADER}\n${validLine}\n${invalidLine}`)] } });

    await waitFor(() => expect(screen.getByText(/1 of 2 rows ready/)).toBeInTheDocument());
    expect(screen.getByText(/missing screen name/)).toBeInTheDocument();
  });

  it('disables import until valid, and only submits valid rows to supabase', async () => {
    render(<BulkImportModal onClose={() => {}} onImported={() => {}} />);
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [makeCsvFile(`${HEADER}\n${validLine}\n${invalidLine}`)] } });

    const importBtn = await screen.findByText('Import 1 valid row');
    expect(importBtn).not.toBeDisabled();

    fireEvent.click(importBtn);
    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    const inserted = insertMock.mock.calls[0][0];
    expect(inserted).toHaveLength(1);
    expect(inserted[0].name).toBe('Row 1');
  });

  it('keeps invalid rows visible without blocking import of the valid subset', async () => {
    render(<BulkImportModal onClose={() => {}} onImported={() => {}} />);
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [makeCsvFile(`${HEADER}\n${validLine}\n${invalidLine}`)] } });

    await waitFor(() => expect(screen.getByText(/missing screen name/)).toBeInTheDocument());
    expect(screen.getByText('Row 2: Row 1')).toBeInTheDocument();
  });
});
