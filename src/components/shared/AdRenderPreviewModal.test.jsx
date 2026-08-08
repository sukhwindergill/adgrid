import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdRenderPreviewModal } from './AdRenderPreviewModal.jsx';

const PHOTOS = [
  { url: 'https://example.com/a.jpg', corners: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] },
  { url: 'https://example.com/b.jpg', corners: [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]] },
];

describe('AdRenderPreviewModal', () => {
  it('shows the screen name and a thumbnail strip when there are multiple marked photos', () => {
    render(<AdRenderPreviewModal screenName="Corner Brew" markedPhotos={PHOTOS} mediaUrl="https://example.com/ad.png" mediaType="image" onClose={() => {}} />);
    expect(screen.getByText('Corner Brew')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /Photo \d/ })).toHaveLength(2);
  });

  it('does not show a thumbnail strip with only one marked photo', () => {
    render(<AdRenderPreviewModal screenName="Corner Brew" markedPhotos={[PHOTOS[0]]} mediaUrl="https://example.com/ad.png" mediaType="image" onClose={() => {}} />);
    expect(screen.queryByRole('img', { name: /Photo \d/ })).not.toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<AdRenderPreviewModal screenName="Corner Brew" markedPhotos={PHOTOS} mediaUrl="https://example.com/ad.png" mediaType="image" onClose={onClose} />);
    fireEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the × button is clicked', () => {
    const onClose = vi.fn();
    render(<AdRenderPreviewModal screenName="Corner Brew" markedPhotos={PHOTOS} mediaUrl="https://example.com/ad.png" mediaType="image" onClose={onClose} />);
    fireEvent.click(screen.getByText('×'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
