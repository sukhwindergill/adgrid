// Pure request-shape/business-rule checks for the REST campaign API
// (Competitive Parity Program, Phase 6, G21 REST API half -- see
// docs/superpowers/specs/2026-09-08-rest-campaign-api-design.md). No Deno
// APIs -- so vitest runs these directly, same pattern as
// create-house-ad's ownership.ts.

export interface CreateCampaignBody {
  screen_ids?: unknown;
  budget?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  destination_url?: unknown;
  media_url?: unknown;
  media_type?: unknown;
  duration?: unknown;
  name?: unknown;
}

/**
 * Validates a POST /v1/campaigns body has the minimum fields to create a
 * campaign at all. Mirrors CreateCampaign.jsx's own required-field set for
 * the fields this v1 API surface accepts (see the spec's Non-goals: no
 * multi-creative/holdout-group parity in v1 -- one creative, one budget).
 */
export function validateCreateCampaignBody(body: CreateCampaignBody): string[] {
  const errors: string[] = [];
  if (!Array.isArray(body.screen_ids) || body.screen_ids.length === 0) {
    errors.push("screen_ids must be a non-empty array");
  }
  if (typeof body.budget !== "number" || !(body.budget > 0)) {
    errors.push("budget must be a positive number");
  }
  if (typeof body.start_date !== "string" || !body.start_date) {
    errors.push("start_date is required");
  }
  if (typeof body.end_date !== "string" || !body.end_date) {
    errors.push("end_date is required");
  }
  if (typeof body.media_url !== "string" || !body.media_url) {
    errors.push("media_url is required");
  }
  if (typeof body.media_type !== "string" || !["image", "video"].includes(body.media_type)) {
    errors.push('media_type must be "image" or "video"');
  }
  return errors;
}

/** A campaign can only be edited via PATCH before it's been paid for -- same rule the dashboard already enforces. */
export function canEditCampaign(paymentStatus: string): boolean {
  return paymentStatus === "unpaid";
}

/**
 * Validates a PATCH /v1/campaigns/:id body. Unlike create, every field is
 * optional (only the ones present get updated), but any field that IS
 * present must satisfy the same shape/range rules createCampaign enforces
 * -- otherwise a caller could set budget to a negative number, duration to
 * 0, or media_type to an arbitrary string, and those bad values would sit
 * in `bookings` unvalidated until charge-campaign or delivery rendering
 * choked on them downstream.
 */
export function validateEditCampaignBody(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if ("budget" in body && !(typeof body.budget === "number" && body.budget > 0)) {
    errors.push("budget must be a positive number");
  }
  if ("start_date" in body && !(typeof body.start_date === "string" && body.start_date)) {
    errors.push("start_date must be a non-empty string");
  }
  if ("end_date" in body && !(typeof body.end_date === "string" && body.end_date)) {
    errors.push("end_date must be a non-empty string");
  }
  if ("media_url" in body && !(typeof body.media_url === "string" && body.media_url)) {
    errors.push("media_url must be a non-empty string");
  }
  if ("media_type" in body && !(typeof body.media_type === "string" && ["image", "video"].includes(body.media_type))) {
    errors.push('media_type must be "image" or "video"');
  }
  if ("destination_url" in body && typeof body.destination_url !== "string") {
    errors.push("destination_url must be a string");
  }
  if ("duration" in body && !(typeof body.duration === "number" && body.duration > 0)) {
    errors.push("duration must be a positive number");
  }
  if ("campaign_name" in body && typeof body.campaign_name !== "string") {
    errors.push("campaign_name must be a string");
  }
  return errors;
}

/**
 * A campaign can only be cancelled via the API before it's live and
 * delivering -- there is no refund/makegood logic for an already-active
 * or completed campaign anywhere in this codebase yet, so cancellation is
 * scoped to the same window editing is: before payment, or scheduled but
 * not yet started.
 */
export function canCancelCampaign(status: string, paymentStatus: string): boolean {
  if (paymentStatus === "unpaid") return true;
  return status === "scheduled";
}
