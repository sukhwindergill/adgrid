import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopyButton } from './CopyButton.jsx';

describe('CopyButton', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('renders the default label', () => {
    render(<CopyButton value="hello" />);
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('renders a custom label', () => {
    render(<CopyButton value="hello" label="Copy link" />);
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });

  it('copies the value to the clipboard on click', async () => {
    render(<CopyButton value="hello world" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello world'));
  });

  it('shows the copied label after a successful copy, then reverts', async () => {
    render(<CopyButton value="hello" copiedLabel="Copied!" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument(), { timeout: 3000 });
  }, 6000);

  it('calls onCopied after a successful copy', async () => {
    const onCopied = vi.fn();
    render(<CopyButton value="hello" onCopied={onCopied} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(onCopied).toHaveBeenCalledTimes(1));
  });

  it('calls onError when the clipboard write fails', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    const onError = vi.fn();
    render(<CopyButton value="hello" onError={onError} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });
});
