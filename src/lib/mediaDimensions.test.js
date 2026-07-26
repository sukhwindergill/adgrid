import { describe, it, expect, vi } from 'vitest';
import { getMediaDimensions } from './mediaDimensions.js';

// Fakes that behave like Image/HTMLVideoElement just enough to drive the
// promise: setting `.src` synchronously (via a microtask) fires the success
// or error handler.
function fakeImage({ shouldError = false, naturalWidth = 800, naturalHeight = 600 } = {}) {
  const img = { naturalWidth, naturalHeight, onload: null, onerror: null };
  Object.defineProperty(img, 'src', {
    set() {
      queueMicrotask(() => {
        if (shouldError) img.onerror?.();
        else img.onload?.();
      });
    },
  });
  return img;
}

function fakeVideo({ shouldError = false, videoWidth = 1080, videoHeight = 1920 } = {}) {
  const video = { videoWidth, videoHeight, onloadedmetadata: null, onerror: null, preload: '' };
  Object.defineProperty(video, 'src', {
    set() {
      queueMicrotask(() => {
        if (shouldError) video.onerror?.();
        else video.onloadedmetadata?.();
      });
    },
  });
  return video;
}

const pngFile = { type: 'image/png', name: 'a.png' };
const mp4File = { type: 'video/mp4', name: 'a.mp4' };

describe('getMediaDimensions', () => {
  it('resolves width/height for an image via the injected Image constructor', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
    const createImage = vi.fn(() => fakeImage({ naturalWidth: 1080, naturalHeight: 1920 }));
    const result = await getMediaDimensions(pngFile, { createImage, createVideo: fakeVideo });
    expect(result).toEqual({ width: 1080, height: 1920 });
    expect(createImage).toHaveBeenCalledTimes(1);
    const createdUrl = createObjectURLSpy.mock.results[0].value;
    expect(revokeSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith(createdUrl);
    revokeSpy.mockRestore();
    createObjectURLSpy.mockRestore();
  });

  it('resolves width/height for a video via the injected video element factory', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
    const createVideo = vi.fn(() => fakeVideo({ videoWidth: 1920, videoHeight: 1080 }));
    const result = await getMediaDimensions(mp4File, { createImage: fakeImage, createVideo });
    expect(result).toEqual({ width: 1920, height: 1080 });
    expect(createVideo).toHaveBeenCalledTimes(1);
    const createdUrl = createObjectURLSpy.mock.results[0].value;
    expect(revokeSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith(createdUrl);
    revokeSpy.mockRestore();
    createObjectURLSpy.mockRestore();
  });

  it('rejects when the image fails to load', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
    await expect(
      getMediaDimensions(pngFile, { createImage: () => fakeImage({ shouldError: true }), createVideo: fakeVideo })
    ).rejects.toThrow();
    const createdUrl = createObjectURLSpy.mock.results[0].value;
    expect(revokeSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith(createdUrl);
    revokeSpy.mockRestore();
    createObjectURLSpy.mockRestore();
  });

  it('rejects when the video fails to load', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
    await expect(
      getMediaDimensions(mp4File, { createImage: fakeImage, createVideo: () => fakeVideo({ shouldError: true }) })
    ).rejects.toThrow();
    const createdUrl = createObjectURLSpy.mock.results[0].value;
    expect(revokeSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith(createdUrl);
    revokeSpy.mockRestore();
    createObjectURLSpy.mockRestore();
  });

  it('rejects for a file with neither an image nor a video mime type', async () => {
    await expect(
      getMediaDimensions({ type: 'application/pdf', name: 'a.pdf' }, { createImage: fakeImage, createVideo: fakeVideo })
    ).rejects.toThrow();
  });
});
