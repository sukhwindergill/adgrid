import '@testing-library/jest-dom/vitest';

// jsdom does not implement the Blob URL APIs. Code that only needs a URL to
// hand to an <img>/<video> element (never to actually fetch it — tests fake
// the load/error events) works fine against a stub that returns a
// syntactically valid, harmless string.
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:mock-url';
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}
