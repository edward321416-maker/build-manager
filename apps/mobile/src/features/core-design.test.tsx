import { fireEvent, render, screen } from "@testing-library/react-native";
import { ActionButton, CoreText, CoreWorkStatus, Screen } from "./core-ui";

it("keeps scroll, full long labels, selected state and disabled actions accessible", async () => {
  const onPress = jest.fn();
  const label = "합성 건물의 긴 호실 이름과 확인이 필요한 요청".repeat(4);
  const tree = (disabled: boolean) => <Screen><ActionButton label={label} selected disabled={disabled} onPress={onPress}/></Screen>;
  const view = await render(tree(true));
  expect(screen.getByTestId("screen-scroll")).toBeTruthy();
  expect(screen.getByRole("button", { name: label, selected: true, disabled: true })).toBeTruthy();
  expect(screen.getByText(`✓ ${label}`)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: label }));
  expect(onPress).not.toHaveBeenCalled();
  await view.rerender(tree(false));
  await fireEvent.press(screen.getByRole("button", { name: label, disabled: false }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it("retains manager-record qualification independently of intake completeness", async () => {
  await render(<Screen><CoreWorkStatus status="COMPLETED"/><CoreText>접수 정보: PARTIAL</CoreText></Screen>);
  expect(screen.getByTestId("work-status")).toHaveTextContent("처리 완료 (관리자 기록)");
  expect(screen.getByText("접수 정보: PARTIAL")).toBeTruthy();
});

it("keeps errors announced and native text scaling enabled", async () => {
  await render(<Screen><CoreText accessibilityRole="alert">연결을 확인해 주세요.</CoreText></Screen>);
  const alert = screen.getByRole("alert");
  expect(alert).toHaveTextContent("연결을 확인해 주세요.");
  expect(alert.props.allowFontScaling).not.toBe(false);
  expect(alert.props.numberOfLines).toBeUndefined();
});
