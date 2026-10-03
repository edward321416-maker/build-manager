import { parseApplicationMode } from "../../runtime/application-mode";
import CoreFlowPage from "./core-screen";
import { CoreLoginScreen } from "./login-screen";
import { CoreDesignRoot } from "./ui/core-design-root";
export const dynamic="force-dynamic";
export default function Page(){
 return <CoreDesignRoot>{parseApplicationMode(process.env.BUILD_MANAGER_MODE)==="B1"?<CoreLoginScreen/>:<CoreFlowPage/>}</CoreDesignRoot>;
}
