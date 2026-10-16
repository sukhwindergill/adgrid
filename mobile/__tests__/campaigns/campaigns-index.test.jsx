import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import CampaignsScreen from '../../app/(tabs)/campaigns/index';

jest.mock('expo-linking', () => ({ openURL: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ profile: { id: 'adv-1' }, activeMode: 'advertiser' }),
}));

const mockCampaigns = [
  { id: 'c-1', campaign_name: 'Spring Sale', status: 'active', displayStatus: 'live', budget: 500, spent: 120, rejections: [] },
  {
    id: 'c-2', campaign_name: 'Launch', status: 'pending_review', displayStatus: 'rejected', budget: 300, spent: 0,
    rejections: [{ screenId: 's-2', screenName: 'Gym Lobby', reason: 'Wrong aspect ratio' }],
  },
  { id: 'c-3', campaign_name: 'Holiday', status: 'paused', displayStatus: 'paused', budget: 200, spent: 50, rejections: [] },
];

let mockHook;
jest.mock('../../hooks/useCampaigns', () => ({
  useCampaigns: () => mockHook,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockHook = { campaigns: mockCampaigns, loading: false, error: null, refetch: jest.fn() };
});

describe('CampaignsScreen', () => {
  it('lists campaigns with their status labels and rejection reasons', () => {
    const { getByText, getAllByText } = render(<CampaignsScreen />);
    expect(getByText('Spring Sale')).toBeTruthy();
    // Once as the filter pill, once as the campaign's status badge.
    expect(getAllByText('Live')).toHaveLength(2);
    expect(getByText('Rejected')).toBeTruthy();
    expect(getByText('Rejected on Gym Lobby: Wrong aspect ratio')).toBeTruthy();
  });

  it('filters by status', () => {
    const { getByText, getAllByText, queryByText } = render(<CampaignsScreen />);
    // Filter pills render above the list, so the first match is the pill.
    fireEvent.press(getAllByText('Paused')[0]);
    expect(getByText('Holiday')).toBeTruthy();
    expect(queryByText('Spring Sale')).toBeNull();
    expect(queryByText('Launch')).toBeNull();
  });

  it('opens campaign creation on the web', () => {
    const { getByLabelText } = render(<CampaignsScreen />);
    fireEvent.press(getByLabelText('Create a campaign on the web'));
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringMatching(/\/app\/adv-create$/));
  });

  it('shows an empty state pointing to the web when there are no campaigns', () => {
    mockHook = { campaigns: [], loading: false, error: null, refetch: jest.fn() };
    const { getByText } = render(<CampaignsScreen />);
    expect(getByText('No campaigns yet')).toBeTruthy();
  });

  it('shows an error state when campaigns fail to load', () => {
    mockHook = { campaigns: [], loading: false, error: 'boom', refetch: jest.fn() };
    const { getByText } = render(<CampaignsScreen />);
    expect(getByText("Couldn't load your campaigns")).toBeTruthy();
  });
});
