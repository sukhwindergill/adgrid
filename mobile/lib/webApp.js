// Campaign creation stays web-only (upload, targeting, checkout). The mobile
// app deep-links into the web app's create flow instead.
export const WEB_APP_URL = (process.env.EXPO_PUBLIC_WEB_APP_URL || 'https://adgrid.app').replace(/\/+$/, '');

export const CREATE_CAMPAIGN_URL = `${WEB_APP_URL}/app/adv-create`;
