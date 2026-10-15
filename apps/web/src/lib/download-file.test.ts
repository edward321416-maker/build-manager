// @vitest-environment jsdom
import { afterEach,expect,it,vi } from "vitest";
import { downloadFile } from "./download-file";

afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});
it("saves through a temporary link of the given type and releases the object URL a minute later",()=>{
  vi.useFakeTimers();const created:Blob[]=[],original={create:URL.createObjectURL,revoke:URL.revokeObjectURL};
  URL.createObjectURL=vi.fn((blob:Blob)=>{created.push(blob);return "blob:synthetic-ics";});URL.revokeObjectURL=vi.fn();
  const click=vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(function(this:HTMLAnchorElement){expect(this.download).toBe("방문일정_2026-10-17.ics");expect(this.isConnected).toBe(true);});
  try{
    downloadFile("방문일정_2026-10-17.ics","BEGIN:VCALENDAR\r\n","text/calendar;charset=utf-8");
    expect(click).toHaveBeenCalledTimes(1);expect(document.querySelector("a")).toBeNull();expect(created[0].type).toBe("text/calendar;charset=utf-8");
    vi.advanceTimersByTime(59_999);expect(URL.revokeObjectURL).not.toHaveBeenCalled();vi.advanceTimersByTime(1);expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:synthetic-ics");
  }finally{URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;}
});
