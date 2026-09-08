// Scheduled programmatic-fill fetcher (Competitive Parity Program, Phase
// 6, G20 -- see docs/superpowers/specs/2026-09-08-programmatic-backfill-
// design.md). Runs on a fixed cron interval (not per display-feed poll --
// see the spec's scope decision on why this isn't live per-impression
// OpenRTB). For each screen that's opted in and doesn't already have a
// valid cached fill, asks every enabled partner's adapter for a fill and
// caches the first one that meets the screen's cpm_floor.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronSecret } from "../_shared/cronGuard.ts";
import { shouldFetchFill, meetsCpmFloor } from "../_shared/programmaticFill.ts";
import { fetchFillFromAdapter } from "../_shared/programmaticAdapters.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FILL_TTL_MS = 15 * 60 * 1000; // 15 minutes -- survives a few display-feed polls without going stale

Deno.serve(async (req: Request) => {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const [{ data: screens }, { data: partners }] = await Promise.all([
    supabase
      .from("screens")
      .select("id, venue_category, city, country, resolution_w, resolution_h, accepted_formats, cpm_floor, programmatic_backfill_enabled")
      .eq("programmatic_backfill_enabled", true)
      .eq("status", "live"),
    supabase.from("programmatic_partners").select("id, adapter_key").eq("enabled", true),
  ]);

  if (!screens?.length || !partners?.length) {
    return new Response(JSON.stringify({ fetched: 0 }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const results = await Promise.allSettled(
    screens.map(async (screen) => {
      const { data: existing } = await supabase
        .from("programmatic_fills")
        .select("id, played, expires_at")
        .eq("screen_id", screen.id)
        .eq("played", false)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!shouldFetchFill(screen, existing)) return { screen_id: screen.id, skipped: true };

      for (const partner of partners) {
        const fill = fetchFillFromAdapter(partner.adapter_key, {
          venue_category: screen.venue_category,
          city: screen.city,
          country: screen.country,
          resolution_w: screen.resolution_w,
          resolution_h: screen.resolution_h,
          accepted_formats: screen.accepted_formats,
          cpm_floor: screen.cpm_floor,
        });

        if (fill && meetsCpmFloor(fill.cpm, screen.cpm_floor)) {
          await supabase.from("programmatic_fills").insert({
            screen_id: screen.id,
            partner_id: partner.id,
            external_creative_id: fill.external_creative_id,
            media_url: fill.media_url,
            media_type: fill.media_type,
            duration: fill.duration,
            cpm: fill.cpm,
            expires_at: new Date(Date.now() + FILL_TTL_MS).toISOString(),
          });
          return { screen_id: screen.id, filled: true, partner: partner.adapter_key };
        }
      }
      return { screen_id: screen.id, filled: false };
    }),
  );

  const fetched = results.filter((r) => r.status === "fulfilled" && (r.value as { filled?: boolean }).filled).length;
  return new Response(JSON.stringify({ fetched, total: screens.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
