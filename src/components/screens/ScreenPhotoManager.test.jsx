import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const uploadMock = vi.fn(() => Promise.resolve({ error: null }));
const getPublicUrlMock = vi.fn((path) => ({ data: { publicUrl: `https://cdn.test/${path}` } }));
const eqMock = vi.fn(() => Promise.resolve({ error: null }));
const updateMock = vi.fn(() => ({ eq: eqMock }));

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    storage: { from: () => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock }) },
    from: () => ({ update: updateMock }),
  },
}));

import { ScreenPhotoManager } from './ScreenPhotoManager.jsx';

beforeEach(() => {
  uploadMock.mockClear();
  getPublicUrlMock.mockClear();
  updateMock.mockClear();
  eqMock.mockClear();
});

const EXISTING_URL = 'https://cdn.test/scr-1/existing.jpg';

describe('ScreenPhotoManager', () => {
  it('uploading a photo persists screen_photos and opens the corner marker for it', async () => {
    render(<ScreenPhotoManager screenId="scr-1" photos={[]} frames={[]} onChange={() => {}} />);
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ screen_photos: expect.any(Array) })));
    expect(screen.getByRole('button', { name: 'Save corners' })).toBeInTheDocument();
  });

  it('saving corners persists screen_photo_frames and calls onChange', async () => {
    const onChange = vi.fn();
    render(<ScreenPhotoManager screenId="scr-1" photos={[EXISTING_URL]} frames={[]} onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Mark corners'));
    fireEvent.click(await screen.findByRole('button', { name: 'Save corners' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ screen_photo_frames: [{ url: EXISTING_URL, corners: [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]] }] })
    ));
    expect(onChange).toHaveBeenCalledWith({ photos: [EXISTING_URL], frames: [{ url: EXISTING_URL, corners: [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]] }] });
  });

  it('skipping the corner marker persists nothing', async () => {
    render(<ScreenPhotoManager screenId="scr-1" photos={[EXISTING_URL]} frames={[]} onChange={() => {}} />);
    fireEvent.click(screen.getByTitle('Mark corners'));
    fireEvent.click(await screen.findByText('Skip — no clear screen edge'));

    expect(updateMock).not.toHaveBeenCalledWith(expect.objectContaining({ screen_photo_frames: expect.anything() }));
    expect(screen.queryByRole('button', { name: 'Save corners' })).not.toBeInTheDocument();
  });

  it('removing a photo prunes both its URL and its frame entry', async () => {
    const frames = [{ url: EXISTING_URL, corners: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] }];
    render(<ScreenPhotoManager screenId="scr-1" photos={[EXISTING_URL]} frames={frames} onChange={() => {}} />);
    fireEvent.click(screen.getByText('×'));

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ screen_photos: [], screen_photo_frames: [] })
    ));
  });

  it('shows "✓ Corners" instead of "Mark corners" once a photo has a saved frame', () => {
    const frames = [{ url: EXISTING_URL, corners: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] }];
    render(<ScreenPhotoManager screenId="scr-1" photos={[EXISTING_URL]} frames={frames} onChange={() => {}} />);
    expect(screen.getByTitle('Edit corners')).toBeInTheDocument();
    expect(screen.queryByTitle('Mark corners')).not.toBeInTheDocument();
  });
});
