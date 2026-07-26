// Pure creative-fit checking. No DOM, no network — takes already-known
// numbers and returns a verdict.
//
// A screen with ANY spec field missing is 'unknown', never a mismatch: all 12
// production screens have no spec today, and treating incompleteness as
// failure would flag every campaign on every screen.

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

export function extensionFromMime(mimeType) {
  if (typeof mimeType !== 'string' || !mimeType) return null;
  return MIME_TO_EXT[mimeType.toLowerCase()] ?? null;
}

export function aspectOrientation(widthPx, heightPx) {
  if (widthPx === heightPx) return 'square';
  return widthPx > heightPx ? 'landscape' : 'portrait';
}

function hasCompleteSpec(spec) {
  if (!spec) return false;
  return (
    spec.resolution_w !== null && spec.resolution_w !== undefined &&
    spec.resolution_h !== null && spec.resolution_h !== undefined &&
    Array.isArray(spec.accepted_formats) && spec.accepted_formats.length > 0 &&
    spec.max_file_mb !== null && spec.max_file_mb !== undefined
  );
}

function hasKnownDimensions(creative) {
  return Number.isFinite(creative?.widthPx) && Number.isFinite(creative?.heightPx);
}

export function checkCreativeFit(creative, spec) {
  if (!hasCompleteSpec(spec) || !hasKnownDimensions(creative)) {
    return { status: 'unknown', reasons: [] };
  }

  const reasons = [];

  const creativeOrientation = aspectOrientation(creative.widthPx, creative.heightPx);
  const screenOrientation = aspectOrientation(spec.resolution_w, spec.resolution_h);
  const eitherSquare = creativeOrientation === 'square' || screenOrientation === 'square';
  if (!eitherSquare && creativeOrientation !== screenOrientation) {
    reasons.push('orientation');
  }

  const ext = extensionFromMime(creative.fileType);
  const accepted = spec.accepted_formats.map(f => String(f).toLowerCase());
  if (!ext || !accepted.includes(ext)) {
    reasons.push('format');
  }

  if (Number(creative.fileSizeMb) > Number(spec.max_file_mb)) {
    reasons.push('file_size');
  }

  return { status: reasons.length > 0 ? 'mismatch' : 'fits', reasons };
}
