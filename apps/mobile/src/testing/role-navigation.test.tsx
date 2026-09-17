import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

/**
 * Navigation is asserted against the real route tree under src/app, so a route
 * that does not exist fails here rather than passing against a mocked push.
 */
afterEach(() => {
  jest.useRealTimers();
});

/**
 * renderRouter returns a promise carrying the path helpers. Returning it bare
 * from an async function would await it again and hand back only the render
 * result, so it is wrapped.
 */
async function renderApp(initialUrl: string) {
  const router = renderRouter("src/app", { initialUrl });
  await router;
  return { router };
}

describe("role selection home", () => {
  it("offers both roles with the demo banner", async () => {
    await renderApp("/");

    expect(await screen.findByText("세입자로 시작")).toBeTruthy();
    expect(screen.getByText("임대인으로 시작")).toBeTruthy();
    expect(screen.getByTestId("demo-banner")).toBeTruthy();
  });

  it("navigates into the tenant stack", async () => {
    const { router } = await renderApp("/");

    await fireEvent.press(await screen.findByTestId("start-tenant"));

    expect(router.getPathname()).toBe("/tenant");
  });

  it("navigates into the landlord stack", async () => {
    const { router } = await renderApp("/");

    await fireEvent.press(await screen.findByTestId("start-landlord"));

    expect(router.getPathname()).toBe("/landlord");
  });
});

describe("missing demo server configuration", () => {
  // EXPO_PUBLIC_API_URL is not set in this environment, so every screen that
  // needs the client must say so rather than fail while the module loads.
  it("renders the configuration screen instead of crashing the tenant home", async () => {
    await renderApp("/tenant");

    expect(await screen.findByTestId("config-error")).toBeTruthy();
    expect(
      screen.getByText(/EXPO_PUBLIC_API_URL을 설정한 뒤 앱을 다시 실행해 주세요/),
    ).toBeTruthy();
  });

  it("renders the configuration screen instead of crashing a ticket screen", async () => {
    await renderApp("/tenant/tickets/ticket-demo-1");

    expect(await screen.findByTestId("config-error")).toBeTruthy();
  });

  it("renders configuration guidance instead of the old landlord placeholder", async () => {
    await renderApp("/landlord");

    expect(await screen.findByTestId("config-error")).toBeTruthy();
    expect(
      screen.getByText(/EXPO_PUBLIC_API_URL을 설정한 뒤 앱을 다시 실행해 주세요/),
    ).toBeTruthy();
    expect(
      screen.queryByText("임대인 앱 데모는 다음 단계에서 연결됩니다."),
    ).toBeNull();
  });

  it.each([
    "/landlord/buildings/server-building-id",
    "/landlord/tickets/server-ticket-id",
  ])("shows configuration guidance on %s", async (initialUrl) => {
    await renderApp(initialUrl);

    expect(await screen.findByTestId("config-error")).toBeTruthy();
    expect(
      screen.getByText(/EXPO_PUBLIC_API_URL을 설정한 뒤 앱을 다시 실행해 주세요/),
    ).toBeTruthy();
  });
});
