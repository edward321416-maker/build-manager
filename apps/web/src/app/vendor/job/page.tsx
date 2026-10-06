import type { Metadata } from "next";
import { VendorJobScreen } from "./vendor-job-screen";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"작업 요청",robots:{index:false,follow:false}};
/** Standalone no-account Vendor job surface: no organization chrome, account, list or third-party resource. */
export default function Page(){
  return <VendorJobScreen/>;
}
