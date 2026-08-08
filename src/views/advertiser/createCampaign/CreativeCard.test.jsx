// Dedicated coverage for CreativeCard.jsx's screen-assignment checkboxes --
// previously only exercised indirectly via StepCreative.smoke.test.jsx.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// CreativeCard renders MediaUpload, which imports the real supabase client
// (throws "supabaseUrl is required" under jsdom with no env) and useAuth()
// from AuthContext. Neither is exercised here -- mock both, same pattern as
// StepCreative.smoke.test.jsx in this directory.
vi.mock('../../../lib/supabase.js', () => ({
  supabase: { storage: { from: vi.fn() } },
}));
vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'u-1' } }),
}));

import { CreativeCard } from './CreativeCard.jsx';
import { makeBlankCreative } from '../../../lib/creativeAssignment.js';
import { QR_CORNER_PRESETS, clampQrCenter } from '../../../lib/creativeQrPosition.js';

// Matches CreativeCard.jsx's own FRAME_ASPECT constant (not exported) --
// the preview frame is always rendered at 16:9.
const FRAME_ASPECT = 16 / 9;

const SCREEN_ONE = {
  id: 'scr-1', name: 'Screen One', city: 'London', environment: 'indoor',
  impressions: 84200, resolution_w: 1920, resolution_h: 1080, accepted_formats: ['jpg', 'mp4'], max_file_mb: 50,
};
const SCREEN_TWO = {
  id: 'scr-2', name: 'Screen Two', city: 'London', environment: 'outdoor',
  impressions: 210000, resolution_w: 1080, resolution_h: 1920, accepted_formats: ['jpg', 'mp4'], max_file_mb: 50,
};
const POOL_SCREENS = [SCREEN_ONE, SCREEN_TWO];

describe('CreativeCard', () => {
  it('hides the screen-assignment UI when showAssignment is false', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A' });
    render(
      <CreativeCard
        creative={creative}
        onChange={() => {}}
        onRemove={undefined}
        poolScreens={POOL_SCREENS}
        allCreatives={[creative]}
        showAssignment={false}
        duration={15}
        onSplitByType={() => {}}
        profile={null}
      />
    );
    expect(screen.queryByText(/Split by screen type/)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Screen One/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Screen Two/i })).not.toBeInTheDocument();
  });

  it('shows one checkbox per pool screen when showAssignment is true', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A' });
    const other = makeBlankCreative({ id: 'c2', label: 'B' });
    render(
      <CreativeCard
        creative={creative}
        onChange={() => {}}
        onRemove={() => {}}
        poolScreens={POOL_SCREENS}
        allCreatives={[creative, other]}
        showAssignment={true}
        duration={15}
        onSplitByType={() => {}}
        profile={null}
      />
    );
    expect(screen.getByRole('checkbox', { name: /Screen One/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Screen Two/i })).toBeInTheDocument();
  });

  it('calls onChange with the screen added to assigned_screen_ids when its checkbox is checked', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', assigned_screen_ids: [] });
    const other = makeBlankCreative({ id: 'c2', label: 'B' });
    const onChange = vi.fn();
    render(
      <CreativeCard
        creative={creative}
        onChange={onChange}
        onRemove={() => {}}
        poolScreens={POOL_SCREENS}
        allCreatives={[creative, other]}
        showAssignment={true}
        duration={15}
        onSplitByType={() => {}}
        profile={null}
      />
    );
    const checkbox = screen.getByRole('checkbox', { name: /Screen One/i });
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ ...creative, assigned_screen_ids: [SCREEN_ONE.id] })
    );
  });

  it('unchecks a checkbox by removing the screen from assigned_screen_ids', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', assigned_screen_ids: [SCREEN_ONE.id] });
    const other = makeBlankCreative({ id: 'c2', label: 'B' });
    const onChange = vi.fn();
    render(
      <CreativeCard
        creative={creative}
        onChange={onChange}
        onRemove={() => {}}
        poolScreens={POOL_SCREENS}
        allCreatives={[creative, other]}
        showAssignment={true}
        duration={15}
        onSplitByType={() => {}}
        profile={null}
      />
    );
    const checkbox = screen.getByRole('checkbox', { name: /Screen One/i });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ ...creative, assigned_screen_ids: [] })
    );
  });

  it('hides the weight input when this creative does not overlap another on a shared screen', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', assigned_screen_ids: [SCREEN_ONE.id] });
    const other = makeBlankCreative({ id: 'c2', label: 'B', assigned_screen_ids: [SCREEN_TWO.id] });
    render(
      <CreativeCard
        creative={creative}
        onChange={() => {}}
        onRemove={() => {}}
        poolScreens={POOL_SCREENS}
        allCreatives={[creative, other]}
        showAssignment={true}
        duration={15}
        onSplitByType={() => {}}
        profile={null}
      />
    );
    expect(screen.queryByText(/Share of plays on shared screens/)).not.toBeInTheDocument();
  });

  it('shows the weight input when this creative overlaps another on a shared screen', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', assigned_screen_ids: [SCREEN_ONE.id] });
    const other = makeBlankCreative({ id: 'c2', label: 'B', assigned_screen_ids: [SCREEN_ONE.id, SCREEN_TWO.id] });
    render(
      <CreativeCard
        creative={creative}
        onChange={() => {}}
        onRemove={() => {}}
        poolScreens={POOL_SCREENS}
        allCreatives={[creative, other]}
        showAssignment={true}
        duration={15}
        onSplitByType={() => {}}
        profile={null}
      />
    );
    expect(screen.getByText(/Share of plays on shared screens/)).toBeInTheDocument();
  });
});

describe('CreativeCard QR corner-snap buttons', () => {
  it('does not render corner-snap buttons when destination_url is empty', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', destination_url: '' });
    render(
      <CreativeCard
        creative={creative}
        onChange={() => {}}
        onRemove={() => {}}
        poolScreens={POOL_SCREENS}
        allCreatives={[creative]}
        showAssignment={false}
        duration={15}
        onSplitByType={() => {}}
        profile={null}
      />
    );
    expect(screen.queryByRole('button', { name: /top left/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /top right/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bottom left/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bottom right/i })).not.toBeInTheDocument();
  });

  it('renders corner-snap buttons based on presence, not validity, of destination_url', () => {
    // CreativeCard's hasDestination gate (`Boolean(creative.destination_url?.trim())`)
    // only checks for a non-empty string -- it does not call isValidDestinationUrl.
    // A non-empty-but-invalid destination still shows the corner-snap buttons (the
    // inline "enter a full web address" warning handles invalidity separately).
    // This test documents that real behavior so a future tightening of the gate
    // to require validity is a deliberate, visible change here.
    const creative = makeBlankCreative({ id: 'c1', label: 'A', destination_url: 'not-a-url' });
    render(
      <CreativeCard
        creative={creative}
        onChange={() => {}}
        onRemove={() => {}}
        poolScreens={POOL_SCREENS}
        allCreatives={[creative]}
        showAssignment={false}
        duration={15}
        onSplitByType={() => {}}
        profile={null}
      />
    );
    expect(screen.getByRole('button', { name: /top left/i })).toBeInTheDocument();
  });

  it('renders all four corner-snap buttons when destination_url is a valid URL', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', destination_url: 'https://example.com' });
    render(
      <CreativeCard
        creative={creative}
        onChange={() => {}}
        onRemove={() => {}}
        poolScreens={POOL_SCREENS}
        allCreatives={[creative]}
        showAssignment={false}
        duration={15}
        onSplitByType={() => {}}
        profile={null}
      />
    );
    expect(screen.getByRole('button', { name: /top left/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /top right/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bottom left/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bottom right/i })).toBeInTheDocument();
  });

  it('clicking a corner-snap button calls onChange with qr_x/qr_y clamped to that corner preset', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', destination_url: 'https://example.com' });
    const onChange = vi.fn();
    render(
      <CreativeCard
        creative={creative}
        onChange={onChange}
        onRemove={() => {}}
        poolScreens={POOL_SCREENS}
        allCreatives={[creative]}
        showAssignment={false}
        duration={15}
        onSplitByType={() => {}}
        profile={null}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /top left/i }));

    const preset = QR_CORNER_PRESETS.top_left;
    // creative.qr_size_pct is null on a blank creative -- CreativeCard falls
    // back to 0.12 (`creative.qr_size_pct ?? 0.12`) before clamping.
    const sizePct = 0.12;
    const expected = clampQrCenter(preset.x, preset.y, sizePct, FRAME_ASPECT);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ qr_x: expected.x, qr_y: expected.y, qr_size_pct: sizePct })
    );
  });

  it('clicking bottom right snaps to the bottom-right preset, distinct from top-left', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', destination_url: 'https://example.com' });
    const onChange = vi.fn();
    render(
      <CreativeCard
        creative={creative}
        onChange={onChange}
        onRemove={() => {}}
        poolScreens={POOL_SCREENS}
        allCreatives={[creative]}
        showAssignment={false}
        duration={15}
        onSplitByType={() => {}}
        profile={null}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /bottom right/i }));

    const preset = QR_CORNER_PRESETS.bottom_right;
    const sizePct = 0.12;
    const expected = clampQrCenter(preset.x, preset.y, sizePct, FRAME_ASPECT);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ qr_x: expected.x, qr_y: expected.y, qr_size_pct: sizePct })
    );
  });
});

describe('CreativeCard QR colours', () => {
  it('does not render the QR Colours section when destination_url is empty', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', destination_url: '' });
    render(
      <CreativeCard creative={creative} onChange={() => {}} onRemove={() => {}} poolScreens={POOL_SCREENS} allCreatives={[creative]} showAssignment={false} duration={15} onSplitByType={() => {}} profile={null} />
    );
    expect(screen.queryByText('QR Code Colours')).not.toBeInTheDocument();
  });

  it('renders Dots and Background color fields when destination_url is set', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', destination_url: 'https://example.com' });
    render(
      <CreativeCard creative={creative} onChange={() => {}} onRemove={() => {}} poolScreens={POOL_SCREENS} allCreatives={[creative]} showAssignment={false} duration={15} onSplitByType={() => {}} profile={null} />
    );
    expect(screen.getByText('QR Code Colours')).toBeInTheDocument();
    expect(screen.getByText('Dots')).toBeInTheDocument();
    expect(screen.getByText('Background')).toBeInTheDocument();
  });

  it('shows a low-contrast warning when qr_fg_color and qr_bg_color are too close', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', destination_url: 'https://example.com', qr_fg_color: '#ffffff', qr_bg_color: '#ffffff' });
    render(
      <CreativeCard creative={creative} onChange={() => {}} onRemove={() => {}} poolScreens={POOL_SCREENS} allCreatives={[creative]} showAssignment={false} duration={15} onSplitByType={() => {}} profile={null} />
    );
    expect(screen.getByText(/Low contrast/)).toBeInTheDocument();
  });

  it('does not show a low-contrast warning for the default accent-color/white pair', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', destination_url: 'https://example.com', accent_color: '#7c3aed' });
    render(
      <CreativeCard creative={creative} onChange={() => {}} onRemove={() => {}} poolScreens={POOL_SCREENS} allCreatives={[creative]} showAssignment={false} duration={15} onSplitByType={() => {}} profile={null} />
    );
    expect(screen.queryByText(/Low contrast/)).not.toBeInTheDocument();
  });

  it('hides every "From creative" button when no media is uploaded', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', destination_url: 'https://example.com', media_url: '' });
    render(
      <CreativeCard creative={creative} onChange={() => {}} onRemove={() => {}} poolScreens={POOL_SCREENS} allCreatives={[creative]} showAssignment={false} duration={15} onSplitByType={() => {}} profile={null} />
    );
    expect(screen.queryByText(/from creative/i)).not.toBeInTheDocument();
  });

  it('samples a color from the creative and applies it to the field that armed the pick', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', destination_url: 'https://example.com', media_url: 'https://x/y.jpg', media_type: 'image' });
    const onChange = vi.fn();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray([18, 52, 86, 255]) }),
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100 });

    render(
      <CreativeCard creative={creative} onChange={onChange} onRemove={() => {}} poolScreens={POOL_SCREENS} allCreatives={[creative]} showAssignment={false} duration={15} onSplitByType={() => {}} profile={null} />
    );

    // CreativeCard also renders MediaUpload's own upload-preview <img> (form.media_url
    // truthy), which appears earlier in DOM order but has no click handler or ref wired
    // to it -- scope to CreativePreview's root (`data-template`) to get the pickable one.
    const img = document.querySelector('[data-template] img');
    Object.defineProperty(img, 'naturalWidth', { value: 400, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 300, configurable: true });

    // First "From creative" button in DOM order belongs to Accent Colour.
    fireEvent.click(screen.getAllByText(/from creative/i)[0]);
    fireEvent.click(img, { clientX: 10, clientY: 10 });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ accent_color: '#123456' }));

    vi.restoreAllMocks();
  });

  it('shows a "couldn\'t sample" message when canvas sampling throws (e.g. a CORS-tainted canvas)', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', destination_url: 'https://example.com', media_url: 'https://x/y.jpg', media_type: 'image' });

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: () => { throw new Error('SecurityError'); },
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100 });

    render(
      <CreativeCard creative={creative} onChange={() => {}} onRemove={() => {}} poolScreens={POOL_SCREENS} allCreatives={[creative]} showAssignment={false} duration={15} onSplitByType={() => {}} profile={null} />
    );

    // CreativeCard also renders MediaUpload's own upload-preview <img> (form.media_url
    // truthy), which appears earlier in DOM order but has no click handler or ref wired
    // to it -- scope to CreativePreview's root (`data-template`) to get the pickable one.
    const img = document.querySelector('[data-template] img');
    fireEvent.click(screen.getAllByText(/from creative/i)[0]);
    fireEvent.click(img, { clientX: 10, clientY: 10 });

    expect(screen.getByText(/Couldn't sample this image/)).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
