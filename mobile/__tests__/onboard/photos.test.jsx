import React from 'react';
import { render } from '@testing-library/react-native';
import PhotosScreen from '../../app/onboard/photos';
import { OnboardProvider, useOnboard } from '../../context/OnboardContext';

function Seed() {
  const { update } = useOnboard();
  React.useEffect(() => { update({ screenId: 'screen-1', photos: ['file:///a.jpg'] }); }, []);
  return null;
}

const wrapper = ({ children }) => (
  <OnboardProvider><Seed />{children}</OnboardProvider>
);

describe('PhotosScreen', () => {
  it('labels selected photos and their remove buttons for screen readers', async () => {
    const { findByLabelText } = render(<PhotosScreen />, { wrapper });
    expect(await findByLabelText('Selected photo 1')).toBeTruthy();
    expect(await findByLabelText('Remove photo 1')).toBeTruthy();
  });
});
