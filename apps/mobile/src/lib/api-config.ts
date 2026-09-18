/**
 * The demo server address is configuration, never a guess.
 *
 * A phone build has no same-origin server to fall back to, and the addresses a
 * fallback would have to invent — localhost, the Android emulator's 10.0.2.2,
 * some LAN address — are each wrong on most devices. Guessing would fail as a
 * confusing network error at the first request; refusing fails immediately and
 * says what to set.
 */
export const MOBILE_CONFIG_MESSAGE =
  "데모 서버 주소가 설정되지 않았습니다. EXPO_PUBLIC_API_URL을 설정한 뒤 앱을 다시 실행해 주세요.";

export class MobileConfigError extends Error {
  constructor() {
    // Fixed wording: the configured value can carry a host or a credential and
    // must not be echoed into a screen or a log.
    super(MOBILE_CONFIG_MESSAGE);
    this.name = "MobileConfigError";
  }
}

export function isMobileConfigError(value: unknown): value is MobileConfigError {
  return value instanceof MobileConfigError;
}

/**
 * Validates the configured base URL. Pure, so the rules can be tested without
 * touching the environment.
 */
export function resolveMobileApiBaseUrl(raw: string | undefined): string {
  const value = raw?.trim() ?? "";
  if (value.length === 0) {
    throw new MobileConfigError();
  }

  let parsed: URL;
  try {
    // Absolute only: a relative value has no base to resolve against on a phone.
    parsed = new URL(value);
  } catch {
    throw new MobileConfigError();
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new MobileConfigError();
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new MobileConfigError();
  }
  // A base URL is a prefix for API paths; a query or fragment would be silently
  // dropped when a path is appended, so it is a configuration mistake.
  if (parsed.search.length > 0 || parsed.hash.length > 0) {
    throw new MobileConfigError();
  }

  return value.replace(/\/+$/, "");
}
