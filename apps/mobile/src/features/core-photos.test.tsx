import { fireEvent,render,screen } from "@testing-library/react-native";
import { ApiClientError,type CoreFlowClient } from "@build-manager/api-client";
import { CorePhotos } from "./core-photos";
const photo={photoId:"synthetic-photo",path:"/protected/photo"};
it("renders protected source and enlargement without an upload entry",async()=>{
  const source={uri:"http://synthetic.invalid/protected/photo",headers:{Authorization:"Bearer synthetic"},cache:"reload"};
  const client={photos:jest.fn().mockResolvedValue([photo]),photoSource:jest.fn().mockReturnValue(source)};
  await render(<CorePhotos client={client as unknown as CoreFlowClient} ticketId="synthetic-ticket" onDenied={jest.fn()} />);
  const image=await screen.findByLabelText("접수 참고 사진 1");expect(image.props.source).toEqual(source);await fireEvent.press(screen.getByText("사진 1 확대"));expect(screen.getByLabelText("확대한 접수 참고 사진")).toBeTruthy();expect(screen.queryByText("사진만 전송")).toBeNull();
});
it("clears protected photos and parent access on a denied image refresh",async()=>{
  const denied=jest.fn(),client={photos:jest.fn().mockResolvedValueOnce([photo]).mockRejectedValue(new ApiClientError("DENIED","denied",{status:401})),photoSource:jest.fn().mockReturnValue({uri:"http://synthetic.invalid/protected/photo"})};
  await render(<CorePhotos client={client as unknown as CoreFlowClient} ticketId="synthetic-ticket" onDenied={denied} />);await fireEvent(await screen.findByLabelText("접수 참고 사진 1"),"error");await screen.findByRole("alert");expect(screen.queryByLabelText("접수 참고 사진 1")).toBeNull();expect(denied).toHaveBeenCalledTimes(1);
});
