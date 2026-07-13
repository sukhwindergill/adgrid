import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ApprovalCard } from '../../components/approvals/ApprovalCard';

const mockRow = {
  id: 'cs-1', screen_id: 's-1', campaign_id: 'c-1',
  screen: { name: 'Lobby Screen' },
  campaign: {
    name: 'Spring Sale', advertiser_name: 'Acme Inc', budget: 500, start_when: 'all',
    headline: 'Save 20%', media_url: 'https://example.com/img.jpg', media_type: 'image',
  },
};

describe('ApprovalCard', () => {
  it('renders campaign name and advertiser', () => {
    const { getByText } = render(<ApprovalCard row={mockRow} onApprove={jest.fn()} onReject={jest.fn()} />);
    expect(getByText('Spring Sale')).toBeTruthy();
    expect(getByText('Acme Inc')).toBeTruthy();
  });

  it('calls onApprove when Approve pressed', () => {
    const onApprove = jest.fn();
    const { getByText } = render(<ApprovalCard row={mockRow} onApprove={onApprove} onReject={jest.fn()} />);
    fireEvent.press(getByText('Approve'));
    expect(onApprove).toHaveBeenCalled();
  });

  it('shows reject reason picker when Reject pressed', () => {
    const { getByText } = render(<ApprovalCard row={mockRow} onApprove={jest.fn()} onReject={jest.fn()} />);
    fireEvent.press(getByText('Reject'));
    expect(getByText('Inappropriate content')).toBeTruthy();
  });

  it('calls onReject with reason when confirmed', () => {
    const onReject = jest.fn();
    const { getByText } = render(<ApprovalCard row={mockRow} onApprove={jest.fn()} onReject={onReject} />);
    fireEvent.press(getByText('Reject'));
    fireEvent.press(getByText('Confirm Rejection'));
    expect(onReject).toHaveBeenCalledWith('Inappropriate content');
  });

  it('labels the creative image for screen readers', () => {
    const { getByLabelText } = render(<ApprovalCard row={mockRow} onApprove={jest.fn()} onReject={jest.fn()} />);
    expect(getByLabelText('Ad creative for Spring Sale')).toBeTruthy();
  });

  it('marks the selected reject reason as selected for screen readers', () => {
    const { getByText } = render(<ApprovalCard row={mockRow} onApprove={jest.fn()} onReject={jest.fn()} />);
    fireEvent.press(getByText('Reject'));
    const defaultReason = getByText('Inappropriate content').parent.parent;
    const otherReason = getByText('Competitor brand').parent.parent;
    expect(defaultReason.props.accessibilityState).toEqual({ selected: true });
    expect(otherReason.props.accessibilityState).toEqual({ selected: false });
    fireEvent.press(getByText('Competitor brand'));
    expect(otherReason.props.accessibilityState).toEqual({ selected: true });
  });
});
