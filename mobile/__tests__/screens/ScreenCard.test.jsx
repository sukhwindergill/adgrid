import React from 'react';
import { render } from '@testing-library/react-native';
import { ScreenCard } from '../../components/screens/ScreenCard';

const baseScreen = {
  id: '1', name: 'Lobby Screen', venue_category: 'retail', venue_subtype: 'Clothing',
  address_city: 'Toronto', health_status: null, last_seen: new Date().toISOString(), screen_photos: [],
};

describe('ScreenCard', () => {
  it('renders screen name', () => {
    const { getByText } = render(<ScreenCard screen={baseScreen} onPress={() => {}} />);
    expect(getByText('Lobby Screen')).toBeTruthy();
  });

  it('shows Live badge when last_seen within 5 minutes', () => {
    const { getByText } = render(<ScreenCard screen={baseScreen} onPress={() => {}} />);
    expect(getByText('Live')).toBeTruthy();
  });

  it('shows Offline when last_seen is null', () => {
    const { getByText } = render(<ScreenCard screen={{ ...baseScreen, last_seen: null }} onPress={() => {}} />);
    expect(getByText('Offline')).toBeTruthy();
  });
});
