import { describe, it, expect } from 'vitest';
import { checkCreativeFit, aspectOrientation, extensionFromMime } from './creativeFit.js';

describe('aspectOrientation', () => {
  it('reports landscape when wider than tall', () => {
    expect(aspectOrientation(1920, 1080)).toBe('landscape');
  });

  it('reports portrait when taller than wide', () => {
    expect(aspectOrientation(1080, 1920)).toBe('portrait');
  });

  it('reports square when equal', () => {
    expect(aspectOrientation(1080, 1080)).toBe('square');
  });
});

describe('extensionFromMime', () => {
  it('maps common image and video mime types to short extensions', () => {
    expect(extensionFromMime('image/jpeg')).toBe('jpg');
    expect(extensionFromMime('image/png')).toBe('png');
    expect(extensionFromMime('image/gif')).toBe('gif');
    expect(extensionFromMime('image/webp')).toBe('webp');
    expect(extensionFromMime('video/mp4')).toBe('mp4');
    expect(extensionFromMime('video/webm')).toBe('webm');
    expect(extensionFromMime('video/quicktime')).toBe('mov');
  });

  it('returns null for an unrecognised mime type', () => {
    expect(extensionFromMime('application/octet-stream')).toBeNull();
    expect(extensionFromMime('')).toBeNull();
    expect(extensionFromMime(null)).toBeNull();
  });
});

const spec = { resolution_w: 1080, resolution_h: 1920, accepted_formats: ['jpg', 'png', 'mp4'], max_file_mb: 20 };

describe('checkCreativeFit', () => {
  it('fits when orientation, format and size all match', () => {
    const creative = { widthPx: 1080, heightPx: 1920, fileType: 'image/png', fileSizeMb: 5 };
    expect(checkCreativeFit(creative, spec)).toEqual({ status: 'fits', reasons: [] });
  });

  it('is unknown when any spec field is null, regardless of the creative', () => {
    const creative = { widthPx: 1080, heightPx: 1920, fileType: 'image/png', fileSizeMb: 5 };
    for (const missing of ['resolution_w', 'resolution_h', 'accepted_formats', 'max_file_mb']) {
      const partial = { ...spec, [missing]: null };
      expect(checkCreativeFit(creative, partial)).toEqual({ status: 'unknown', reasons: [] });
    }
  });

  it('is unknown for a null or undefined spec object', () => {
    const creative = { widthPx: 1080, heightPx: 1920, fileType: 'image/png', fileSizeMb: 5 };
    expect(checkCreativeFit(creative, null).status).toBe('unknown');
    expect(checkCreativeFit(creative, undefined).status).toBe('unknown');
  });

  it('flags an orientation mismatch', () => {
    const landscapeCreative = { widthPx: 1920, heightPx: 1080, fileType: 'image/png', fileSizeMb: 5 };
    const r = checkCreativeFit(landscapeCreative, spec); // spec wants portrait
    expect(r.status).toBe('mismatch');
    expect(r.reasons).toContain('orientation');
  });

  it('does not flag orientation when the creative is square', () => {
    // A square creative can be reasonably cropped into either orientation.
    const squareCreative = { widthPx: 1080, heightPx: 1080, fileType: 'image/png', fileSizeMb: 5 };
    const r = checkCreativeFit(squareCreative, spec);
    expect(r.reasons).not.toContain('orientation');
  });

  it('does not flag orientation when the screen spec is square', () => {
    const landscapeCreative = { widthPx: 1920, heightPx: 1080, fileType: 'image/png', fileSizeMb: 5 };
    const squareSpec = { ...spec, resolution_w: 1080, resolution_h: 1080 };
    const r = checkCreativeFit(landscapeCreative, squareSpec);
    expect(r.reasons).not.toContain('orientation');
  });

  it('flags a format not in the accepted list', () => {
    const creative = { widthPx: 1080, heightPx: 1920, fileType: 'video/webm', fileSizeMb: 5 };
    const r = checkCreativeFit(creative, spec); // spec accepts jpg,png,mp4 — not webm
    expect(r.status).toBe('mismatch');
    expect(r.reasons).toContain('format');
  });

  it('matches accepted_formats case-insensitively', () => {
    const creative = { widthPx: 1080, heightPx: 1920, fileType: 'image/png', fileSizeMb: 5 };
    const upperSpec = { ...spec, accepted_formats: ['PNG', 'JPG'] };
    expect(checkCreativeFit(creative, upperSpec).reasons).not.toContain('format');
  });

  it('flags a file over the size limit', () => {
    const creative = { widthPx: 1080, heightPx: 1920, fileType: 'image/png', fileSizeMb: 25 };
    const r = checkCreativeFit(creative, spec);
    expect(r.status).toBe('mismatch');
    expect(r.reasons).toContain('file_size');
  });

  it('does not flag a file exactly at the size limit', () => {
    const creative = { widthPx: 1080, heightPx: 1920, fileType: 'image/png', fileSizeMb: 20 };
    expect(checkCreativeFit(creative, spec).reasons).not.toContain('file_size');
  });

  it('does not flag a resolution that differs but shares orientation', () => {
    // Fit checking is orientation-based, not exact-pixel-match — a screen
    // spec of 1080x1920 and a creative of 1440x2560 are both portrait.
    const creative = { widthPx: 1440, heightPx: 2560, fileType: 'image/png', fileSizeMb: 5 };
    expect(checkCreativeFit(creative, spec).reasons).not.toContain('orientation');
  });

  it('collects multiple reasons at once', () => {
    const creative = { widthPx: 1920, heightPx: 1080, fileType: 'video/webm', fileSizeMb: 99 };
    const r = checkCreativeFit(creative, spec);
    expect(r.status).toBe('mismatch');
    expect(r.reasons).toEqual(expect.arrayContaining(['orientation', 'format', 'file_size']));
    expect(r.reasons).toHaveLength(3);
  });

  it('is unknown when the creative itself is missing dimensions, rather than guessing', () => {
    const incomplete = { widthPx: null, heightPx: null, fileType: 'image/png', fileSizeMb: 5 };
    expect(checkCreativeFit(incomplete, spec).status).toBe('unknown');
  });
});
