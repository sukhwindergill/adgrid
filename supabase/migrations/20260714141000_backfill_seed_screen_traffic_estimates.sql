-- S16 fix (2026-07-14 ICP sweep): every seed screen had
-- monthly_traffic_estimate = NULL, so the campaign wizard's reach estimate
-- rendered "~0K impressions/mo" for every advertiser regardless of which
-- screens they picked. Backfill with reasonable placeholder foot-traffic
-- figures per venue so reach math isn't zero; onboarding now requires new
-- screens to supply a real number going forward.
UPDATE public.screens SET monthly_traffic_estimate = CASE id
  WHEN 'scr-brixton-001' THEN 9000
  WHEN 'scr-camden-001' THEN 15000
  WHEN 'SCR-001' THEN 12000
  WHEN 'SCR-002' THEN 22000
  WHEN 'SCR-003' THEN 10000
  WHEN 'SCR-004' THEN 18000
  WHEN 'SCR-006' THEN 30000
  WHEN 'SCR-008' THEN 14000
  WHEN 'SCR-009' THEN 11000
  WHEN '53d2cfdd-cec4-48b6-a86f-1288f7cf430a' THEN 5000
  WHEN 'c11c1616-6aa1-41c8-a9a1-560da6f59d6a' THEN 5000
  WHEN 'scr-shoreditch-001' THEN 8000
  ELSE monthly_traffic_estimate
END
WHERE monthly_traffic_estimate IS NULL;
