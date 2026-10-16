// Expo push delivery for the mobile app. Tokens live in push_tokens, keyed
// by the user (the column is named operator_id for historical reasons; the
// advertiser side of the app registers under the same column).

// Notification types that also go to the recipient's phone. The mobile app
// routes taps on these to the campaign (mobile/lib/notificationRoute.js), so
// each push carries { type, campaignId } in its data payload.
export const PUSH_EVENT_TYPES = new Set(["campaign_approved", "campaign_rejected"]);

export interface PushMessage {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data: Record<string, string>;
}

export function buildPushMessages(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
): PushMessage[] {
  return [...new Set(tokens.filter(Boolean))].map((to) => ({ to, sound: "default", title, body, data }));
}

// deno-lint-ignore no-explicit-any
export async function sendExpoPush(supabase: any, userId: string, title: string, body: string, data: Record<string, string>): Promise<boolean> {
  const { data: rows } = await supabase.from("push_tokens").select("expo_token").eq("operator_id", userId);
  const messages = buildPushMessages((rows ?? []).map((r: { expo_token: string }) => r.expo_token), title, body, data);
  if (messages.length === 0) return false;
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  }).catch(() => null);
  if (!res || !res.ok) {
    console.error("Expo push failed:", res ? await res.text() : "network error");
    return false;
  }
  return true;
}
