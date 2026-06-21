import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Btn } from '../../components/ui/Btn';

describe('Btn', () => {
  it('renders children', () => {
    const { getByText } = render(<Btn onPress={() => {}}>Save</Btn>);
    expect(getByText('Save')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Btn onPress={onPress}>Save</Btn>);
    fireEvent.press(getByText('Save'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Btn onPress={onPress} disabled>Save</Btn>);
    fireEvent.press(getByText('Save'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders secondary variant', () => {
    const { getByText } = render(<Btn variant="secondary" onPress={() => {}}>Cancel</Btn>);
    expect(getByText('Cancel')).toBeTruthy();
  });
});
