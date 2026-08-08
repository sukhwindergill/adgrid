import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorField } from './ColorField.jsx';

afterEach(() => {
  vi.restoreAllMocks();
  delete window.EyeDropper;
});

describe('ColorField', () => {
  it('renders the label, swatch, and current hex value', () => {
    render(<ColorField label="Dots" value="#7c3aed" onChange={() => {}} />);
    expect(screen.getByText('Dots')).toBeInTheDocument();
    expect(screen.getByDisplayValue('#7c3aed')).toBeInTheDocument();
  });

  it('commits a valid typed hex value on blur', () => {
    const onChange = vi.fn();
    render(<ColorField label="Dots" value="#7c3aed" onChange={onChange} />);
    const hexInput = screen.getByDisplayValue('#7c3aed');
    fireEvent.change(hexInput, { target: { value: '#ff0000' } });
    fireEvent.blur(hexInput);
    expect(onChange).toHaveBeenCalledWith('#ff0000');
  });

  it('reverts an invalid typed hex value on blur without calling onChange', () => {
    const onChange = vi.fn();
    render(<ColorField label="Dots" value="#7c3aed" onChange={onChange} />);
    const hexInput = screen.getByDisplayValue('#7c3aed');
    fireEvent.change(hexInput, { target: { value: 'not-a-color' } });
    fireEvent.blur(hexInput);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('#7c3aed')).toBeInTheDocument();
  });

  it('calls onChange immediately when the native color swatch changes', () => {
    const onChange = vi.fn();
    render(<ColorField label="Dots" value="#7c3aed" onChange={onChange} />);
    const swatch = document.querySelector('input[type="color"]');
    fireEvent.change(swatch, { target: { value: '#00ff00' } });
    expect(onChange).toHaveBeenCalledWith('#00ff00');
  });

  it('shows the native eyedropper button only when window.EyeDropper exists', () => {
    const { rerender } = render(<ColorField label="Dots" value="#7c3aed" onChange={() => {}} />);
    expect(screen.queryByTitle('Pick color from screen')).not.toBeInTheDocument();

    window.EyeDropper = function () {};
    rerender(<ColorField label="Dots" value="#7c3aed" onChange={() => {}} />);
    expect(screen.getByTitle('Pick color from screen')).toBeInTheDocument();
  });

  it('applies the native EyeDropper result to the field', async () => {
    const onChange = vi.fn();
    window.EyeDropper = function () {
      this.open = () => Promise.resolve({ sRGBHex: '#abcdef' });
    };
    render(<ColorField label="Dots" value="#7c3aed" onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Pick color from screen'));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith('#abcdef'));
  });

  it('does not render the "from creative" button when onPickFromCreative is not passed', () => {
    render(<ColorField label="Dots" value="#7c3aed" onChange={() => {}} />);
    expect(screen.queryByText(/from creative/i)).not.toBeInTheDocument();
  });

  it('calls onPickFromCreative when its button is clicked', () => {
    const onPickFromCreative = vi.fn();
    render(<ColorField label="Dots" value="#7c3aed" onChange={() => {}} onPickFromCreative={onPickFromCreative} />);
    fireEvent.click(screen.getByText(/from creative/i));
    expect(onPickFromCreative).toHaveBeenCalledTimes(1);
  });
});
