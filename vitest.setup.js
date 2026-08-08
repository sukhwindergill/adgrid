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

// jsdom has no ResizeObserver. AdRenderPreview (and everything that renders
// it) needs one defined globally or it throws on mount. Individual tests
// that need to *drive* it override global.ResizeObserver locally; this
// default keeps every other test from crashing.
if (typeof globalThis.ResizeObserver !== 'function') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom has no native PointerEvent constructor. Without one,
// @testing-library's fireEvent.pointer* helpers fall back to a plain Event
// and silently drop non-standard init fields (clientX, clientY, pointerId),
// so components under test never see real drag coordinates. Polyfill it as
// a thin MouseEvent subclass, which is all jsdom's synthetic events need.
if (typeof globalThis.PointerEvent !== 'function') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type, params = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? 'mouse';
      this.isPrimary = params.isPrimary ?? true;
    }
  }
  globalThis.PointerEvent = PointerEventPolyfill;
}
