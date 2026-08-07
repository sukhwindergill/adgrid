import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

let uploadImpl = () => Promise.resolve({ error: null });
const uploadMock = vi.fn((...args) => uploadImpl(...args));
const getPublicUrlMock = vi.fn((path) => ({ data: { publicUrl: `https://cdn.test/${path}` } }));
const removeMock = vi.fn(() => Promise.resolve({ error: null }));
let eqImpl = () => Promise.resolve({ error: null });
const eqMock = vi.fn((...args) => eqImpl(...args));
const updateMock = vi.fn(() => ({ eq: eqMock }));

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    storage: { from: () => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock, remove: removeMock }) },
    from: () => ({ update: updateMock }),
  },
}));

import { ScreenPhotoManager } from './ScreenPhotoManager.jsx';

beforeEach(() => {
  uploadMock.mockClear();
  getPublicUrlMock.mockClear();
  removeMock.mockClear();
  updateMock.mockClear();
  eqMock.mockClear();
  uploadImpl = () => Promise.resolve({ error: null });
  eqImpl = () => Promise.resolve({ error: null });
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

  it('surfaces the error and keeps the marker modal open when saving corners fails', async () => {
    eqImpl = () => Promise.resolve({ error: { message: 'some db error' } });
    const onChange = vi.fn();
    render(<ScreenPhotoManager screenId="scr-1" photos={[EXISTING_URL]} frames={[]} onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Mark corners'));
    fireEvent.click(await screen.findByRole('button', { name: 'Save corners' }));

    await waitFor(() => expect(screen.getByText('some db error')).toBeInTheDocument());
    // Modal stays open, corners were not marked as saved, onChange never fired.
    expect(screen.getByRole('button', { name: 'Save corners' })).toBeInTheDocument();
    expect(screen.queryByTitle('Edit corners')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('surfaces the error and does not remove the photo locally when removePhoto persist fails', async () => {
    eqImpl = () => Promise.resolve({ error: { message: 'some db error' } });
    const onChange = vi.fn();
    render(<ScreenPhotoManager screenId="scr-1" photos={[EXISTING_URL]} frames={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('×'));

    await waitFor(() => expect(screen.getByText('some db error')).toBeInTheDocument());
    expect(screen.getByAltText('Screen photo 1')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('surfaces the error and does not show upload success when handleFiles persist fails', async () => {
    eqImpl = () => Promise.resolve({ error: { message: 'some db error' } });
    const onChange = vi.fn();
    render(<ScreenPhotoManager screenId="scr-1" photos={[]} frames={[]} onChange={onChange} />);
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText('some db error')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Save corners' })).not.toBeInTheDocument();
    expect(screen.getByText('+ Add photos')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('surfaces a failed-upload count without masking it as success, for a partially-failed batch', async () => {
    let call = 0;
    uploadImpl = () => {
      call += 1;
      return Promise.resolve(call === 1 ? { error: { message: 'storage upload failed' } } : { error: null });
    };
    render(<ScreenPhotoManager screenId="scr-1" photos={[]} frames={[]} onChange={() => {}} />);
    const file1 = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    const file2 = new File(['y'], 'b.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file1, file2] } });

    await waitFor(() => expect(screen.getByText('1 of 2 photos failed to upload.')).toBeInTheDocument());
    // The one file that did succeed should still have been persisted.
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      screen_photos: expect.arrayContaining([expect.stringContaining('https://cdn.test/')]),
    }));
  });

  it('best-effort cleans up orphaned storage objects when the persist after a successful upload fails', async () => {
    eqImpl = () => Promise.resolve({ error: { message: 'some db error' } });
    render(<ScreenPhotoManager screenId="scr-1" photos={[]} frames={[]} onChange={() => {}} />);
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText('some db error')).toBeInTheDocument());
    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(removeMock.mock.calls[0][0]).toHaveLength(1);
    expect(removeMock.mock.calls[0][0][0]).toMatch(/^scr-1\//);
  });
});
