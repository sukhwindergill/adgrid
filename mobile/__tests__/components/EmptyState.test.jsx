import React from 'react';
import { render } from '@testing-library/react-native';
import { EmptyState } from '../../components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders icon, title, and subtitle', () => {
    const { getByText } = render(
      <EmptyState icon="📺" title="No screens yet" subtitle="Tap + to register your first screen" />
    );
    expect(getByText('📺')).toBeTruthy();
    expect(getByText('No screens yet')).toBeTruthy();
    expect(getByText('Tap + to register your first screen')).toBeTruthy();
  });

  it('omits icon when not provided', () => {
    const { queryByText, getByText } = render(<EmptyState title="No advertisers yet" />);
    expect(getByText('No advertisers yet')).toBeTruthy();
    expect(queryByText('📺')).toBeNull();
  });
});
