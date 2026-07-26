// Reads a File's pixel dimensions client-side, before or independent of any
// network upload. Image/video element creation is injected (matching the
// pattern in src/lib/playBuffer.js) so this is testable without a real
// browser decoding a real file.

export function getMediaDimensions(file, {
  createImage = () => new Image(),
  createVideo = () => document.createElement('video'),
} = {}) {
  return new Promise((resolve, reject) => {
    const isImage = typeof file?.type === 'string' && file.type.startsWith('image/');
    const isVideo = typeof file?.type === 'string' && file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      reject(new Error(`Unsupported file type: ${file?.type ?? 'unknown'}`));
      return;
    }

    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);

    if (isVideo) {
      const video = createVideo();
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const dims = { width: video.videoWidth, height: video.videoHeight };
        cleanup();
        resolve(dims);
      };
      video.onerror = () => { cleanup(); reject(new Error('Could not read video dimensions')); };
      video.src = url;
    } else {
      const img = createImage();
      img.onload = () => {
        const dims = { width: img.naturalWidth, height: img.naturalHeight };
        cleanup();
        resolve(dims);
      };
      img.onerror = () => { cleanup(); reject(new Error('Could not read image dimensions')); };
      img.src = url;
    }
  });
}
