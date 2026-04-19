export const ACCESS_COOKIE = "vacation_access";
export const DEV_FALLBACK_PASSWORD = "asheville2026";

export function getExpectedPassword() {
  if (process.env.VACATION_SITE_PASSWORD) {
    return process.env.VACATION_SITE_PASSWORD;
  }

  if (process.env.NODE_ENV !== "production") {
    return DEV_FALLBACK_PASSWORD;
  }

  return "";
}

export function isPasswordConfigured() {
  return getExpectedPassword().length > 0;
}
