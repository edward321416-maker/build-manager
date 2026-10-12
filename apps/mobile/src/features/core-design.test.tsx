import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { ActionButton as DemoActionButton } from "../components/ui";
import { color, status, text } from "../design/tokens";
import { ActionButton, CoreText, CoreWorkStatus, Screen } from "./core-ui";

// Design rules v1 colours on the shared buttons and status labels (§2.2–§2.4, §8.7).
it.each([["core", ActionButton], ["demo", DemoActionButton]] as const)("draws the %s button in the rules' colours, disabled without transparency", async (_name, Button) => {
  const view = await render(<Button label="접수하기" onPress={() => {}}/>);
  const box = () => StyleSheet.flatten(screen.getByRole("button", { name: "접수하기" }).props.style);
  const label = () => StyleSheet.flatten(screen.getByText(/접수하기$/).props.style);
  expect(box()).toMatchObject({ backgroundColor: color.surface, borderColor: color.borderStrong });
  expect(label()).toMatchObject({ ...text.label, color: color.text });
  await view.rerender(<Button label="접수하기" selected onPress={() => {}}/>);
  expect(box()).toMatchObject({ backgroundColor: color.primarySoft, borderColor: color.primary, borderWidth: 2 });
  await view.rerender(<Button label="접수하기" disabled onPress={() => {}}/>);
  expect(box()).toMatchObject({ backgroundColor: color.fillSubtle, borderColor: color.border });
  expect(box().opacity).toBeUndefined();
  expect(label()).toMatchObject({ color: color.textSecondary });
});

it("fills the core primary button with the brand blue and inverse text", async () => {
  await render(<ActionButton label="접수하기" primary onPress={() => {}}/>);
  expect(StyleSheet.flatten(screen.getByRole("button", { name: "접수하기" }).props.style)).toMatchObject({ backgroundColor: color.primary });
  expect(StyleSheet.flatten(screen.getByText("접수하기").props.style)).toMatchObject({ color: color.textInverse });
});

it.each([["OPEN", status.neutral], ["IN_PROGRESS", status.progress], ["COMPLETED", status.done]] as const)("shows %s in its status colour pair", async (work, pair) => {
  await render(<CoreWorkStatus status={work}/>);
  expect(StyleSheet.flatten(screen.getByTestId("work-status").props.style)).toMatchObject({ ...pair, ...text.label, borderRadius: 5 });
});

it.each([
  ["core", ActionButton, {}], ["core selected", ActionButton, { selected: true }], ["core primary", ActionButton, { primary: true }],
  ["core disabled", ActionButton, { disabled: true }], ["demo", DemoActionButton, {}], ["demo selected", DemoActionButton, { selected: true }],
  ["demo disabled", DemoActionButton, { disabled: true }],
] as const)("puts the %s button label in the middle of its box both ways", async (_name, Button, variant) => {
  await render(<Button label="접수하기" onPress={() => {}} {...variant}/>);
  const box = StyleSheet.flatten(screen.getByRole("button", { name: "접수하기" }).props.style);
  expect(box).toMatchObject({ justifyContent: "center", alignItems: "center" });
  expect(StyleSheet.flatten(screen.getByText(/접수하기$/).props.style)).toMatchObject({ textAlign: "center" });
});

it("centres a status label that wraps", async () => {
  await render(<CoreWorkStatus status="COMPLETED"/>);
  expect(StyleSheet.flatten(screen.getByTestId("work-status").props.style)).toMatchObject({ textAlign: "center" });
});

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
