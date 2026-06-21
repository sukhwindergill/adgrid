import React from 'react';
import { Badge } from '../ui/Badge';

export function healthSignal(screen) {
  if (screen.health_status === 'degraded') return { label: 'Degraded', variant: 'amber' };
  if (!screen.last_seen) return { label: 'Offline', variant: 'red' };
  const minsAgo = (Date.now() - new Date(screen.last_seen).getTime()) / 60000;
  if (minsAgo <= 5) return { label: 'Live', variant: 'green' };
  if (minsAgo <= 60) return { label: 'Stale', variant: 'amber' };
  return { label: 'Offline', variant: 'red' };
}

export function HealthBadge({ screen }) {
  const { label, variant } = healthSignal(screen);
  return <Badge label={label} variant={variant} dot />;
}
