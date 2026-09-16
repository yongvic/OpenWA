/**
 * Campaign product fork: trim optional Nest modules when CAMPAIGN_MINIMAL_BACKEND=true.
 * WebhookModule stays loaded because SessionModule depends on it for session lifecycle.
 */
export function isCampaignMinimalBackend(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CAMPAIGN_MINIMAL_BACKEND === 'true';
}
