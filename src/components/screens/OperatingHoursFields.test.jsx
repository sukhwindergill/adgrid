import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OperatingHoursFields } from './OperatingHoursFields.jsx';
import { hoursFormFromScreen, hoursUpdates, hoursError } from '../../lib/operatingHours.js';

describe('hoursFormFromScreen', () => {
  it('trims Postgres HH:MM:SS to HH:MM', () => {
    expect(hoursFormFromScreen({ operating_hours_start: '18:00:00', operating_hours_end: '02:00:00' }))
      .toEqual({ start: '18:00', end: '02:00', allDay: false });
  });

  it('falls back to the DB default when hours are missing', () => {
    expect(hoursFormFromScreen({})).toEqual({ start: '07:00', end: '22:00', allDay: false });
  });

  it('recognises a 24-hour screen', () => {
    expect(hoursFormFromScreen({ operating_hours_start: '00:00:00', operating_hours_end: '23:59:00' }).allDay).toBe(true);
  });
});

describe('hoursUpdates / hoursError', () => {
  it('stores 24 hours as 00:00-23:59', () => {
    expect(hoursUpdates({ start: '07:00', end: '22:00', allDay: true }))
      .toEqual({ operating_hours_start: '00:00', operating_hours_end: '23:59' });
  });

  it('accepts overnight hours', () => {
    expect(hoursError({ start: '18:00', end: '02:00', allDay: false })).toBeNull();
    expect(hoursUpdates({ start: '18:00', end: '02:00', allDay: false }))
      .toEqual({ operating_hours_start: '18:00', operating_hours_end: '02:00' });
  });

  it('rejects identical or blank times', () => {
    expect(hoursError({ start: '09:00', end: '09:00', allDay: false })).toMatch(/24 hours/);
    expect(hoursError({ start: '', end: '22:00', allDay: false })).toMatch(/opening and closing/);
  });
});

describe('OperatingHoursFields', () => {
  it('shows an overnight hint when closing is before opening', () => {
    render(<OperatingHoursFields value={{ start: '18:00', end: '02:00', allDay: false }} onChange={() => {}} />);
    expect(screen.getByText(/closes at 02:00 the next day/)).toBeInTheDocument();
  });

  it('hides the time inputs when open 24 hours', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(<OperatingHoursFields value={{ start: '07:00', end: '22:00', allDay: false }} onChange={onChange} />);
    expect(container.querySelectorAll('input[type="time"]')).toHaveLength(2);
    fireEvent.click(screen.getByLabelText('Open 24 hours'));
    expect(onChange).toHaveBeenCalledWith({ start: '07:00', end: '22:00', allDay: true });
    rerender(<OperatingHoursFields value={{ start: '07:00', end: '22:00', allDay: true }} onChange={onChange} />);
    expect(container.querySelectorAll('input[type="time"]')).toHaveLength(0);
  });
});
