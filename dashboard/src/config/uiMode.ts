/** Campaign-focused dashboard: hide advanced OpenWA menus for non-technical teams. */
export const CAMPAIGN_FOCUSED_UI = true;

export const CAMPAIGN_DEFAULT_ROUTE = '/campaigns';

/** Nav keys hidden while CAMPAIGN_FOCUSED_UI is enabled. */
export const HIDDEN_NAV_KEYS = new Set([
  'dashboard',
  'chats',
  'webhooks',
  'messageTester',
  'logs',
  'apiKeys',
  'infrastructure',
  'plugins',
]);

/** Preferred sidebar order in campaign mode. */
export const CAMPAIGN_NAV_ORDER = ['campaigns', 'sessions', 'templates'] as const;
