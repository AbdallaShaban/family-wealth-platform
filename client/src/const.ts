export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Start the Google OAuth / OpenID Connect login flow.
 * Directs browser to the authoritative server-side endpoint (/api/oauth/login).
 */
export const startLogin = () => {
  window.location.href = "/login";
};
