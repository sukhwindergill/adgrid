// CRUD for saved, reusable campaign targeting configurations
// (campaign_targeting_templates). RLS scopes every row to the caller's own
// advertiser_id — no explicit filter needed on read, but insert/delete still
// pass it for clarity and so a stubbed-out client in tests doesn't need to
// infer auth.uid() itself.
import { supabase } from './supabase.js';

const COLUMNS = 'id, name, area_type, country, state, city, radius_center_lat, radius_center_lon, radius_km, env_filter, venue_filter, created_at';

export async function listTargetingTemplates() {
  const { data, error } = await supabase
    .from('campaign_targeting_templates')
    .select(COLUMNS)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data ?? [];
}

// `form` is the CreateCampaign wizard's full state — pulls out only the
// targeting subset this table stores, so callers can pass the whole form
// without needing to know which fields matter here.
export async function saveTargetingTemplate(advertiserId, name, form) {
  const row = {
    advertiser_id: advertiserId,
    name: name.trim(),
    area_type: form.area_type,
    country: form.country || null,
    state: form.state || null,
    city: form.city || null,
    radius_center_lat: form.radius_center_lat ?? null,
    radius_center_lon: form.radius_center_lon ?? null,
    radius_km: form.area_type === 'radius' ? (form.radius_km ?? null) : null,
    env_filter: form.env_filter || null,
    venue_filter: form.venue_filter || null,
  };
  const { data, error } = await supabase
    .from('campaign_targeting_templates')
    .insert(row)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTargetingTemplate(id) {
  const { error } = await supabase.from('campaign_targeting_templates').delete().eq('id', id);
  if (error) throw error;
}

// Applies a saved template onto the wizard's form state, clearing (not
// merging) the fields it owns first — switching from a saved radius
// template back to a saved city template shouldn't leave a stale radius
// center behind.
export function applyTargetingTemplate(template) {
  return {
    area_type: template.area_type,
    country: template.country || '',
    state: template.state || '',
    city: template.city || '',
    radius_center_lat: template.radius_center_lat ?? null,
    radius_center_lon: template.radius_center_lon ?? null,
    radius_km: template.radius_km ?? 10,
    env_filter: template.env_filter || 'any',
    venue_filter: template.venue_filter || '',
  };
}
