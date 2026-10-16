import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import CampaignDetailScreen from '../../app/(tabs)/campaigns/[id]';

const baseHook = {
  campaign: { id: 'c-1', campaign_name: 'Spring Sale', status: 'active', budget: 500, spent: 120, start_date: '2026-10-01', end_date: '2026-10-31' },
  screens: [{ screen_id: 's-1', status: 'approved' }],
  screenNames: { 's-1': 'Lobby' },
  displayStatus: 'live',
  rejections: [],
  metrics: { plays: 1234, impressions: 56000, scans: 42 },
  loading: false,
  error: null,
  updating: false,
  refetch: jest.fn(),
};

let mockHook;
jest.mock('../../hooks/useCampaignDetail', () => ({
  useCampaignDetail: () => mockHook,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockHook = { ...baseHook, pause: jest.fn(), resume: jest.fn() };
});

describe('CampaignDetailScreen', () => {
  it('shows key metrics: plays, impressions, scans and spend', () => {
    const { getByText } = render(<CampaignDetailScreen />);
    expect(getByText('Spring Sale')).toBeTruthy();
    expect(getByText((1234).toLocaleString())).toBeTruthy();
    expect(getByText((56000).toLocaleString())).toBeTruthy();
    expect(getByText('42')).toBeTruthy();
    expect(getByText('$120.00 CAD')).toBeTruthy();
    expect(getByText('Lobby')).toBeTruthy();
  });

  it('confirms before pausing a live campaign', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText, queryByText } = render(<CampaignDetailScreen />);
    expect(queryByText('Resume campaign')).toBeNull();

    fireEvent.press(getByText('Pause campaign'));
    expect(alertSpy).toHaveBeenCalledWith('Pause campaign?', expect.any(String), expect.any(Array));
    const pauseButton = alertSpy.mock.calls[0][2].find(b => b.text === 'Pause');
    pauseButton.onPress();
    expect(mockHook.pause).toHaveBeenCalled();
  });

  it('offers resume on a paused campaign', () => {
    mockHook = { ...mockHook, campaign: { ...baseHook.campaign, status: 'paused' }, displayStatus: 'paused' };
    const { getByText, queryByText } = render(<CampaignDetailScreen />);
    expect(queryByText('Pause campaign')).toBeNull();
    fireEvent.press(getByText('Resume campaign'));
    expect(mockHook.resume).toHaveBeenCalled();
  });

  it('offers neither action while pending approval', () => {
    mockHook = { ...mockHook, campaign: { ...baseHook.campaign, status: 'pending_review' }, displayStatus: 'pending' };
    const { getByText, queryByText } = render(<CampaignDetailScreen />);
    expect(getByText('Pending approval')).toBeTruthy();
    expect(queryByText('Pause campaign')).toBeNull();
    expect(queryByText('Resume campaign')).toBeNull();
  });

  it('lists operator rejection reasons', () => {
    mockHook = {
      ...mockHook,
      campaign: { ...baseHook.campaign, status: 'pending_review' },
      displayStatus: 'rejected',
      rejections: [{ screenId: 's-1', screenName: 'Lobby', reason: 'Alcohol not allowed' }],
    };
    const { getByText } = render(<CampaignDetailScreen />);
    expect(getByText('Rejected by operators')).toBeTruthy();
    expect(getByText('Lobby: Alcohol not allowed')).toBeTruthy();
  });

  it('shows the error banner from a refused status change', () => {
    mockHook = { ...mockHook, error: "Cannot pause a campaign with status 'completed'" };
    const { getByText } = render(<CampaignDetailScreen />);
    expect(getByText("Cannot pause a campaign with status 'completed'")).toBeTruthy();
  });
});
