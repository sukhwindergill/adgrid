import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntegrationsView } from './IntegrationsView.jsx';
import { supabase } from '../../lib/supabase.js';

// Product-audit finding: this page used to present fake "connected"
// status and a tracking-pixel snippet pointing at a script that has
// never existed (cdn.adgrid.io/pixel.js), misleading an operator who
// followed it into believing something was wired up. Replaced with an
// honest "not available yet" state -- these tests lock in that no
// fabricated pixel snippet or connection-status UI ever comes back.
//
// docs/superpowers/specs/2026-09-08-operator-webhook-integration-design.md
// then made "Custom Webhook" real -- these tests also cover its save/
// enable/test flow, while locking in that the other four platforms stay
// non-interactive placeholders.

vi.mock('../../lib/supabase.js', () => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    upsert: vi.fn(() => Promise.resolve({ error: null })),
    update: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null })),
  };
  return {
    supabase: {
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'op-1' } } })),
        getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: 'tok', user: { id: 'op-1' } } } })),
      },
      from: vi.fn(() => chain),
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'op-1' } } });
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'tok', user: { id: 'op-1' } } } });
});

describe('IntegrationsView (operator)', () => {
  it('honestly states nothing else is connected yet', async () => {
    render(<IntegrationsView />);
    expect(await screen.findByText("Operator-side integrations aren't available yet")).toBeInTheDocument();
  });

  it('never renders a tracking-pixel snippet pointing at a nonexistent script', async () => {
    render(<IntegrationsView />);
    await screen.findByText('Custom Webhook');
    expect(screen.queryByText(/cdn\.adgrid\.io\/pixel\.js/)).not.toBeInTheDocument();
    expect(screen.queryByText('Your Pixel ID')).not.toBeInTheDocument();
  });

  it('lists planned platforms without implying any are actually connected', async () => {
    render(<IntegrationsView />);
    await screen.findByText('Salesforce');
    expect(screen.getByText('Salesforce')).toBeInTheDocument();
    expect(screen.getByText('HubSpot')).toBeInTheDocument();
    expect(screen.getByText('Klaviyo')).toBeInTheDocument();
    expect(screen.getByText('TikTok Events API')).toBeInTheDocument();
    // Planned-platform cards have no inputs or buttons of their own.
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
  });

  it('renders a real, interactive webhook card', async () => {
    render(<IntegrationsView />);
    expect(await screen.findByPlaceholderText('https://example.com/adgrid-webhook')).toBeInTheDocument();
    expect(screen.getByText('Save webhook')).toBeInTheDocument();
  });

  it('saves a webhook URL and secret', async () => {
    global.fetch = vi.fn();
    render(<IntegrationsView />);
    const urlInput = await screen.findByPlaceholderText('https://example.com/adgrid-webhook');
    fireEvent.change(urlInput, { target: { value: 'https://example.com/hook' } });
    fireEvent.click(screen.getByText('Save webhook'));
    await waitFor(() => expect(supabase.from).toHaveBeenCalledWith('operator_webhooks'));
  });

  it('sends a test event and reports success', async () => {
    supabase.from.mockImplementation(() => ({
      select: vi.fn(function () { return this; }),
      eq: vi.fn(function () { return this; }),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(function () { return this; }),
      maybeSingle: vi.fn(() => Promise.resolve({
        data: { webhook_url: 'https://example.com/hook', secret: 'shh', enabled: true },
      })),
    }));
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }));
    render(<IntegrationsView />);
    const testBtn = await screen.findByText('Send test event');
    fireEvent.click(testBtn);
    expect(await screen.findByText('Test event delivered successfully.')).toBeInTheDocument();
  });

  it('sends a test event and reports failure', async () => {
    supabase.from.mockImplementation(() => ({
      select: vi.fn(function () { return this; }),
      eq: vi.fn(function () { return this; }),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(function () { return this; }),
      maybeSingle: vi.fn(() => Promise.resolve({
        data: { webhook_url: 'https://example.com/hook', secret: '', enabled: true },
      })),
    }));
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ ok: false }) }));
    render(<IntegrationsView />);
    const testBtn = await screen.findByText('Send test event');
    fireEvent.click(testBtn);
    expect(await screen.findByText(/Test event delivery failed/)).toBeInTheDocument();
  });
});
