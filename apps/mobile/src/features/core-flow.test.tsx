import { fireEvent,render,screen,waitFor } from "@testing-library/react-native";
import { createCoreFlowClient,ApiClientError } from "@build-manager/api-client";
import CoreFlowScreen from "../app/core";
jest.mock("expo-router",()=>({useRouter:()=>({back:jest.fn()})}));
jest.mock("@build-manager/api-client",()=>({...jest.requireActual("@build-manager/api-client"),createCoreFlowClient:jest.fn()}));
const factory=jest.mocked(createCoreFlowClient);
const unit={id:"synthetic-unit",buildingId:"synthetic-building",buildingName:"합성 건물",label:"합성 호실"};
const record={ticketId:"synthetic-ticket",unitId:unit.id,workStatus:"OPEN",detail:{issueType:"LEAK"},events:[]};
function setup(role="TENANT"){
  const client={session:jest.fn().mockResolvedValue({role,synthetic:true}),units:jest.fn().mockResolvedValue([unit]),tickets:jest.fn().mockResolvedValue([]),photos:jest.fn().mockResolvedValue([]),create:jest.fn().mockResolvedValue(record),read:jest.fn().mockResolvedValue(record),handling:jest.fn().mockResolvedValue({...record,workStatus:"IN_PROGRESS"}),protocol:{}};
  factory.mockReturnValue(client as unknown as ReturnType<typeof createCoreFlowClient>);return client;
}
beforeEach(()=>{jest.clearAllMocks();process.env.EXPO_PUBLIC_API_URL="http://127.0.0.1:3130";});
async function signIn(){await fireEvent.changeText(screen.getByLabelText("개발 접근 코드"),"a".repeat(64));await fireEvent.press(screen.getByText("들어가기"));await screen.findByText("호실별 접수 이력");}
it("uses the configured bearer client and submits the selected authorized unit",async()=>{
  const client=setup();await render(<CoreFlowScreen />);await signIn();expect(factory).toHaveBeenCalledWith({baseUrl:"http://127.0.0.1:3130",accessCode:"a".repeat(64)});
  expect(screen.getByText("아직 접수 내역이 없습니다.")).toBeTruthy();await fireEvent.press(screen.getByText("누수"));await fireEvent.changeText(screen.getByLabelText("문제 설명"),"합성 누수");await fireEvent.press(screen.getByText("접수하기"));await screen.findByText("접수 상세");expect(client.create).toHaveBeenCalledWith({unitId:unit.id,issueType:"LEAK",rawUserText:"합성 누수"});expect(screen.queryByText("처리 시작 기록")).toBeNull();
});
it("renders manager handling without a tenant creation form",async()=>{
  const client=setup("ORG_ADMIN");client.tickets.mockResolvedValue([record]);await render(<CoreFlowScreen />);await signIn();expect(screen.queryByText("문제 접수")).toBeNull();await fireEvent.press(screen.getByText("누수 · 접수 · syntheti"));await screen.findByText("접수 상세");await fireEvent.changeText(screen.getByLabelText("처리 기록"),"합성 확인 시작");await fireEvent.press(screen.getByText("처리 시작 기록"));await waitFor(()=>expect(client.handling).toHaveBeenCalledWith("synthetic-ticket",{status:"IN_PROGRESS",message:"합성 확인 시작"}));await screen.findByText("처리중");
});
it("shows a sanitized error when the server rejects a session",async()=>{
  const client=setup();client.session.mockRejectedValue(new Error("private diagnostic"));await render(<CoreFlowScreen />);await fireEvent.changeText(screen.getByLabelText("개발 접근 코드"),"a".repeat(64));await fireEvent.press(screen.getByText("들어가기"));await screen.findByRole("alert");expect(screen.queryByText("private diagnostic")).toBeNull();expect(screen.queryByText("호실별 접수 이력")).toBeNull();
});
it("clears previously visible data after the session is denied",async()=>{
  const client=setup();await render(<CoreFlowScreen />);await signIn();client.tickets.mockRejectedValue(new ApiClientError("FORBIDDEN","denied",{status:403}));await fireEvent.press(screen.getByText("전체 새로고침"));await screen.findByRole("alert");expect(screen.queryByText("호실별 접수 이력")).toBeNull();expect(screen.getByLabelText("개발 접근 코드")).toBeTruthy();
});
