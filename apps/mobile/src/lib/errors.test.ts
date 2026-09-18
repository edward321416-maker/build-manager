import { ApiClientError } from "@build-manager/api-client";
import { MOBILE_CONFIG_MESSAGE, MobileConfigError } from "./api-config";
import { GENERIC_ERROR_MESSAGE, describeMobileError } from "./errors";

describe("mobile error copy", () => {
  it("reports a configuration problem as configuration", () => {
    expect(describeMobileError(new MobileConfigError())).toBe(
      MOBILE_CONFIG_MESSAGE,
    );
  });

  it("passes through the api client's already-sanitized message", () => {
    const error = new ApiClientError("HTTP_ERROR", "요청을 확인해 주세요.", {
      status: 400,
    });

    expect(describeMobileError(error)).toBe("요청을 확인해 주세요.");
  });

  it("gives anything else a generic message", () => {
    expect(describeMobileError(new Error("connect ECONNREFUSED 10.0.2.2:3000"))).toBe(
      GENERIC_ERROR_MESSAGE,
    );
    expect(describeMobileError("boom")).toBe(GENERIC_ERROR_MESSAGE);
    expect(describeMobileError(null)).toBe(GENERIC_ERROR_MESSAGE);
  });

  it("never leaks host, path, or stack detail from an unknown failure", () => {
    const leaky = new Error(
      "SELECT * FROM tickets failed at /var/data/demo.sqlite for http://10.0.2.2:3000",
    );

    const shown = describeMobileError(leaky);

    for (const secret of ["SELECT", "sqlite", "10.0.2.2", "/var/data"]) {
      expect(shown).not.toContain(secret);
    }
  });
});
