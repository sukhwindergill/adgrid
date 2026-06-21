import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ApprovalCard } from '../../components/approvals/ApprovalCard';

const mockRow = {
  id: 'cs-1', screen_id: 's-1', campaign_id: 'c-1',
  screen: { name: 'Lobby Screen' },
  campaign: {
    name: 'Spring Sale', budget: 500, start_when: 'all',
    advertiser: { full_name: 'Acme Inc' },
    creatives: [{ id: 'cr-1', type: 'image', url: 'https://example.com/img.jpg', headline: 'Save 20%' }],
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
});
