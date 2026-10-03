import { parseApplicationMode } from "../../runtime/application-mode";
import CoreFlowPage from "./core-screen";
import { CoreLoginScreen } from "./login-screen";
export const dynamic="force-dynamic";
export default function Page(){
 return parseApplicationMode(process.env.BUILD_MANAGER_MODE)==="B1"?<CoreLoginScreen/>:<CoreFlowPage/>;
}
