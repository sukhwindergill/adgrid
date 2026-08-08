// Pure math for "pick a color from the creative" -- no DOM, no canvas, same
// shape as creativeQrPosition.js. Needed because the media element renders
// with CSS object-fit: cover, which center-crops the natural image/video to
// fill its box; a naive rescale of a click's on-screen position back to
// natural-image coordinates would sample the wrong pixel whenever the crop
// is non-trivial. The actual canvas draw + pixel read lives inline in
// CreativeCard.jsx (untested glue, same precedent as QrOverlay's pointer-
// drag handlers in CreativePreview.jsx -- only the pure math is unit tested).

export function mapCoverClickToNatural(clickX, clickY, elWidth, elHeight, naturalWidth, naturalHeight) {
  if (!elWidth || !elHeight || !naturalWidth || !naturalHeight) return { x: 0, y: 0 };
  const scale = Math.max(elWidth / naturalWidth, elHeight / naturalHeight);
  const displayedWidth = naturalWidth * scale;
  const displayedHeight = naturalHeight * scale;
  const offsetX = (displayedWidth - elWidth) / 2 / scale;
  const offsetY = (displayedHeight - elHeight) / 2 / scale;
  const naturalX = offsetX + clickX / scale;
  const naturalY = offsetY + clickY / scale;
  return {
    x: Math.min(naturalWidth - 1, Math.max(0, Math.round(naturalX))),
    y: Math.min(naturalHeight - 1, Math.max(0, Math.round(naturalY))),
  };
}

export function rgbToHex(r, g, b) {
  const hex = (n) => n.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`.toLowerCase();
}
