/** Campaign-focused dashboard: hide advanced OpenWA menus for non-technical teams. */
export const CAMPAIGN_FOCUSED_UI = true;

export const CAMPAIGN_DEFAULT_ROUTE = '/campaigns';

/** Routes kept in campaign product mode (see CAMPAIGN-SCOPE.md at repo root). */
export const CAMPAIGN_ROUTES = ['/campaigns', '/sessions', '/templates'] as const;

/** Nav keys shown in campaign mode. */
export const CAMPAIGN_NAV_ORDER = ['campaigns', 'sessions', 'templates'] as const;

/** Nav keys hidden while CAMPAIGN_FOCUSED_UI is enabled (legacy list for reference). */
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
