import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { DisplayPlayer } from './DisplayPlayer.jsx';

function campaign(id, duration, headline) {
  return { id, duration, headline, destination_url: '', category: '', accent_color: '#7c3aed' };
}

function mockFeed(campaigns) {
  global.fetch = vi.fn((url) => {
    const u = String(url);
    if (u.includes('/display-feed')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ screen_id: 'scr-1', screen_name: 'Test Screen', campaigns }),
      });
    }
    // ingest-plays and anything else — accepted no-op.
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

// Realistic poll simulation: real fetch/res.json() (JSON.parse under the
// hood) always allocates a brand-new object graph, even when the feed
// content is byte-for-byte identical to the previous poll. `mockFeed` above
// closes over one `campaigns` array and returns that *same reference* from
// every json() call, which is why it can't catch reference-identity bugs.
// This helper deep-clones on every call instead, mirroring real `fetch`.
function mockFeedRealistic(campaigns) {
  global.fetch = vi.fn((url) => {
    const u = String(url);
    if (u.includes('/display-feed')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          screen_id: 'scr-1',
          screen_name: 'Test Screen',
          campaigns: JSON.parse(JSON.stringify(campaigns)),
        }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

// Realistic poll simulation where the feed genuinely changes partway through:
// call #1 (the initial fetch) returns `sequence[0]`, call #2 (the first poll)
// and every call after it return `sequence[1]`. Each call is deep-cloned
// like mockFeedRealistic, so this also exercises the identical-content case
// for repeated polls once the sequence is exhausted.
function mockFeedSequence(sequence) {
  let call = 0;
  global.fetch = vi.fn((url) => {
    const u = String(url);
    if (u.includes('/display-feed')) {
      const list = sequence[Math.min(call, sequence.length - 1)];
      call += 1;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          screen_id: 'scr-1',
          screen_name: 'Test Screen',
          campaigns: JSON.parse(JSON.stringify(list)),
        }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

describe('DisplayPlayer rotation timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // @testing-library/dom's findBy*/waitFor only auto-drives its polling
    // loop off fake timers when it detects a global `jest` with fake-timer
    // methods (see jestFakeTimersAreEnabled in its helpers.js) — it doesn't
    // yet recognize Vitest's fake timers on their own. Vitest's `vi` exposes
    // the same advanceTimersByTime/advanceTimersByTimeAsync API jest does,
    // so aliasing it here is enough to make findByText resolve immediately
    // instead of hanging until the real 5s test timeout. Scoped to this file
    // only; vitest.setup.js is intentionally left alone.
    globalThis.jest = vi;
  });
  afterEach(() => {
    delete globalThis.jest;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('advances each slide after its own duration, not a fixed 10s', async () => {
    mockFeed([campaign('b1', 5, 'Slide A'), campaign('b2', 20, 'Slide B')]);
    render(<DisplayPlayer screenToken="tok" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(await screen.findByText('Slide A')).toBeInTheDocument();

    // Just before the 5s duration elapses, still on slide A.
    await act(async () => { await vi.advanceTimersByTimeAsync(4999); });
    expect(screen.getByText('Slide A')).toBeInTheDocument();

    // Past 5s + the 400ms fade swap, slide B is showing.
    await act(async () => { await vi.advanceTimersByTimeAsync(2 + 400); });
    expect(await screen.findByText('Slide B')).toBeInTheDocument();
  });

  it('falls back to 10s for a campaign with no duration set', async () => {
    mockFeed([campaign('b1', null, 'Slide A'), campaign('b2', 15, 'Slide B')]);
    render(<DisplayPlayer screenToken="tok" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(await screen.findByText('Slide A')).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(9999); });
    expect(screen.getByText('Slide A')).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(2 + 400); });
    expect(await screen.findByText('Slide B')).toBeInTheDocument();
  });

  it('never advances when only one campaign is on the feed', async () => {
    mockFeed([campaign('b1', 5, 'Only Slide')]);
    render(<DisplayPlayer screenToken="tok" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(await screen.findByText('Only Slide')).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.getByText('Only Slide')).toBeInTheDocument();
  });

  // Regression coverage for the Critical bug found in review of cb6176f:
  // `campaigns` gets a fresh array/object reference on every 30s poll (real
  // fetch/JSON.parse behavior — simulated here via mockFeedRealistic, not
  // mockFeed's same-reference stub). The rotation effect used to depend on
  // raw `campaigns`, so identical-content polls re-triggered it and
  // restarted the slide's timer from scratch — any slide with duration >=
  // POLL_INTERVAL_MS (30s) could never survive a full poll cycle, so it
  // never rotated away.
  it('does not restart a >=30s slide timer when an identical-content poll lands mid-slide', async () => {
    mockFeedRealistic([campaign('b1', 45, 'Slide A'), campaign('b2', 10, 'Slide B')]);
    render(<DisplayPlayer screenToken="tok" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(await screen.findByText('Slide A')).toBeInTheDocument();

    // Cross a 30s poll boundary (identical content) while still on Slide A's
    // 45s window. A buggy rotation effect would restart Slide A's 45s timer
    // here, pushing its rotation out to t=75s instead of t=45.4s.
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.getByText('Slide A')).toBeInTheDocument();

    // Just before the *original* 45s cutoff — still Slide A.
    await act(async () => { await vi.advanceTimersByTimeAsync(15_399); }); // t=45,399
    expect(screen.getByText('Slide A')).toBeInTheDocument();

    // Past the original 45s cutoff + 400ms fade swap — must have rotated to
    // Slide B on schedule, not still be stuck on Slide A.
    await act(async () => { await vi.advanceTimersByTimeAsync(403); }); // t=45,802
    expect(await screen.findByText('Slide B')).toBeInTheDocument();
  });

  it('does not snap back to index 0 when an identical-content poll lands mid-rotation', async () => {
    mockFeedRealistic([
      campaign('b1', 20, 'Slide A'),
      campaign('b2', 20, 'Slide B'),
      campaign('b3', 20, 'Slide C'),
    ]);
    render(<DisplayPlayer screenToken="tok" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(await screen.findByText('Slide A')).toBeInTheDocument();

    // Rotate to Slide B (20s + 400ms fade).
    await act(async () => { await vi.advanceTimersByTimeAsync(20_402); }); // t=20,402
    expect(await screen.findByText('Slide B')).toBeInTheDocument();

    // A 30s poll lands 9.6s into Slide B's own 20s window (identical
    // content). A buggy reset-on-campaigns-change effect would snap the
    // display straight back to Slide A here.
    await act(async () => { await vi.advanceTimersByTimeAsync(9_598); }); // t=30,000
    expect(screen.getByText('Slide B')).toBeInTheDocument();

    // Slide B's own window still ends on its original schedule (t=40,400
    // cutoff + 400ms fade), rotating on to Slide C — not restarted, not
    // stuck.
    await act(async () => { await vi.advanceTimersByTimeAsync(10_802); }); // t=40,802
    expect(await screen.findByText('Slide C')).toBeInTheDocument();
  });

  // The two tests above only cover feedSignature's "should NOT reset" branch
  // (identical-content polls). This covers the other branch: when the feed
  // genuinely changes mid-rotation, the index must still reset to 0 and the
  // rotation timer must restart against the *new* schedule — not stay stuck
  // on the stale duration from before the edit. (Proof-of-play closing out
  // early on this same feedSignature change isn't separately asserted here:
  // DisplayPlayer constructs its playBuffer internally with no test seam to
  // read it back, and this environment has no global `localStorage` to
  // introspect either — see playBuffer.js's own `typeof localStorage ===
  // 'undefined'` guard. The proof-of-play effect was switched to the same
  // feedSignature dependency as the other two for the same identity-churn
  // reason, so it follows the same "does it re-run on a genuine change"
  // behavior this test exercises for the rotation effect.)
  it('resets to index 0 and restarts the rotation timer when the feed genuinely changes mid-rotation', async () => {
    const original = [campaign('b1', 20, 'Slide A'), campaign('b2', 20, 'Slide B'), campaign('b3', 20, 'Slide C')];
    // Same ids, same order — only b2's duration is edited (20s -> 5s). This
    // must still change feedSignature even though nothing about identity or
    // ordering changed.
    const edited = [campaign('b1', 20, 'Slide A'), campaign('b2', 5, 'Slide B'), campaign('b3', 20, 'Slide C')];
    mockFeedSequence([original, edited]);
    render(<DisplayPlayer screenToken="tok" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(await screen.findByText('Slide A')).toBeInTheDocument();

    // Rotate to Slide B under the original (unedited) schedule.
    await act(async () => { await vi.advanceTimersByTimeAsync(20_402); }); // t=20,402
    expect(await screen.findByText('Slide B')).toBeInTheDocument();

    // The 30s poll now returns the edited feed (b2's duration: 20 -> 5).
    // feedSignature changes, so — unlike the identical-content polls above —
    // the reset-index effect must fire and snap the display back to Slide A.
    await act(async () => { await vi.advanceTimersByTimeAsync(9_598); }); // t=30,000
    expect(await screen.findByText('Slide A')).toBeInTheDocument();
    expect(screen.queryByText('Slide B')).not.toBeInTheDocument();

    // From here the rotation timer must restart against the *new* schedule.
    // Slide A's own duration is unchanged (20s), so it holds until then...
    await act(async () => { await vi.advanceTimersByTimeAsync(19_999); }); // t=49,999
    expect(screen.getByText('Slide A')).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(402); }); // t=50,401
    expect(await screen.findByText('Slide B')).toBeInTheDocument();

    // ...but Slide B now honors its *edited* 5s duration, not the stale 20s
    // it would have used if the timer hadn't picked up the new schedule.
    await act(async () => { await vi.advanceTimersByTimeAsync(4_998); }); // t=55,399
    expect(screen.getByText('Slide B')).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(402); }); // t=55,801
    expect(await screen.findByText('Slide C')).toBeInTheDocument();
  });
});
