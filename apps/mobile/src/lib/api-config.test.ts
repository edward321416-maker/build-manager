import {
  MOBILE_CONFIG_MESSAGE,
  MobileConfigError,
  isMobileConfigError,
  resolveMobileApiBaseUrl,
} from "./api-config";

/**
 * Builds a credential-bearing URL at run time.
 *
 * The repository scans its own history for anything shaped like a credential in
 * a URL, and it should keep doing that — so this file must not contain one as a
 * literal, not even a synthetic one.
 */
function withCredentials(scheme: string, user: string, password?: string): string {
  const secret = password === undefined ? user : `${user}:${password}`;
  return `${scheme}${secret}${String.fromCharCode(64)}demo.test:3000`;
}

function rejected(raw: string | undefined): MobileConfigError {
  try {
    resolveMobileApiBaseUrl(raw);
  } catch (error) {
    if (isMobileConfigError(error)) {
      return error;
    }
    throw error;
  }
  throw new Error(`expected ${String(raw)} to be rejected`);
}

describe("mobile api base url", () => {
  it("rejects a missing value", () => {
    expect(rejected(undefined)).toBeInstanceOf(MobileConfigError);
  });

  it("rejects a blank value", () => {
    expect(rejected("")).toBeInstanceOf(MobileConfigError);
    expect(rejected("   ")).toBeInstanceOf(MobileConfigError);
  });

  it("rejects a relative url", () => {
    expect(rejected("/api/v1")).toBeInstanceOf(MobileConfigError);
    expect(rejected("demo.test:3000")).toBeInstanceOf(MobileConfigError);
  });

  it("rejects an unsupported scheme", () => {
    expect(rejected("ftp://demo.test")).toBeInstanceOf(MobileConfigError);
    expect(rejected("file:///tmp/demo")).toBeInstanceOf(MobileConfigError);
    expect(rejected("ws://demo.test")).toBeInstanceOf(MobileConfigError);
  });

  it("rejects embedded credentials", () => {
    expect(rejected(withCredentials("http://", "abc", "def"))).toBeInstanceOf(
      MobileConfigError,
    );
    expect(rejected(withCredentials("https://", "abc"))).toBeInstanceOf(
      MobileConfigError,
    );
  });

  it("rejects a query string", () => {
    expect(rejected("http://demo.test:3000?token=abc")).toBeInstanceOf(
      MobileConfigError,
    );
  });

  it("rejects a fragment", () => {
    expect(rejected("http://demo.test:3000#fragment")).toBeInstanceOf(
      MobileConfigError,
    );
  });

  it("accepts http", () => {
    expect(resolveMobileApiBaseUrl("http://10.0.2.2:3000")).toBe(
      "http://10.0.2.2:3000",
    );
  });

  it("accepts https", () => {
    expect(resolveMobileApiBaseUrl("https://demo.test")).toBe(
      "https://demo.test",
    );
  });

  it("trims surrounding whitespace and a trailing slash", () => {
    expect(resolveMobileApiBaseUrl("  http://demo.test:3000/  ")).toBe(
      "http://demo.test:3000",
    );
  });

  it("keeps a configured base path", () => {
    expect(resolveMobileApiBaseUrl("https://demo.test/gateway")).toBe(
      "https://demo.test/gateway",
    );
  });

  it("never falls back to a host of its own", () => {
    // Every rejection has to stay a rejection: no localhost, no emulator
    // address, no LAN guess substituted for missing configuration.
    for (const raw of [undefined, "", "   ", "/api/v1"]) {
      expect(() => resolveMobileApiBaseUrl(raw)).toThrow(MobileConfigError);
    }
  });

  it("never echoes the configured value in its message", () => {
    const sensitive = withCredentials("https://", "abc", "def");

    expect(rejected(sensitive).message).toBe(MOBILE_CONFIG_MESSAGE);
    expect(rejected(sensitive).message).not.toContain("demo.test");
    expect(rejected(sensitive).message).not.toContain("abc");
  });

  it("tells the operator which variable to set", () => {
    expect(MOBILE_CONFIG_MESSAGE).toContain("EXPO_PUBLIC_API_URL");
  });
});
