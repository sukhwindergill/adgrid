ALTER TABLE bookings DROP CONSTRAINT bookings_payment_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status = ANY (ARRAY['unpaid','paid','failed','refunded']));
