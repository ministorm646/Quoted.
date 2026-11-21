// The follow-up message used when a business has not written its own.
// Merge fields: [client] and [job]. The sign-off and buttons are added by the email layout.
export const DEFAULT_TEMPLATE =
  "Hi [client],\n\nJust checking in on the quote for [job]. I know things get busy, so there is no pressure either way.\n\nA quick tap below lets me know where you stand.";

export const DEFAULT_SCHEDULE = [3, 7, 14];

// Plain-text merge. Escape the result before putting it in HTML.
export function renderTemplate(tpl: string, vars: { client: string; job: string }): string {
  return tpl.replaceAll("[client]", vars.client).replaceAll("[job]", vars.job);
}
