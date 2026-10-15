// @vitest-environment jsdom
import { afterEach,expect,it,vi } from "vitest";
import { csvCell,csvFileName,csvText,downloadCsv } from "./csv-file";

afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});
it("quotes every cell and doubles inner quotes (RFC 4180)",()=>{
  expect(csvCell("김 담당")).toBe('"김 담당"');expect(csvCell('A동 "1층"')).toBe('"A동 ""1층"""');
  expect(csvCell("A동, 1층")).toBe('"A동, 1층"');expect(csvCell("줄\n바꿈")).toBe('"줄\n바꿈"');expect(csvCell("")).toBe('""');
});
it("keeps each formula start as text with a leading apostrophe (OWASP CSV Injection)",()=>{
  for(const start of ["=","+","-","@","\t","\r","\n","＝","＋","－","＠"])expect(csvCell(`${start}1+1`)).toBe(`"'${start}1+1"`);
  expect(csvCell('=HYPERLINK("https://example.invalid","보기")')).toBe('"\'=HYPERLINK(""https://example.invalid"",""보기"")"');
});
it("leaves a formula character in the middle alone, so dates and unit names stay as they are",()=>{
  expect(csvCell("101-1203")).toBe('"101-1203"');expect(csvCell("a=b")).toBe('"a=b"');expect(csvCell("2026-10-14 18:00")).toBe('"2026-10-14 18:00"');
});
it("starts with a BOM, ends every line with CRLF and keeps a quote-and-comma trick inside one cell",()=>{
  expect(csvText(["가","나"],[["1",'x",=1+2'],["2",""]])).toBe('﻿"가","나"\r\n"1","x"",=1+2"\r\n"2",""\r\n');
});
it("builds a file name without path, reserved or control characters and without spaces",()=>{
  expect(csvFileName(["정비이력","해솔빌라","101동 1203호"],"2026-10-15")).toBe("정비이력_해솔빌라_101동1203호_2026-10-15.csv");
  expect(csvFileName(["정비이력","../a:b*c?","x\u0007y"],"2026-10-15")).toBe("정비이력_.._a_b_c__x_y_2026-10-15.csv");
  expect(csvFileName(["업무함"],"2026-10-15")).toBe("업무함_2026-10-15.csv");
});
it("saves through a temporary download link and releases the object URL a minute later",()=>{
  vi.useFakeTimers();const created:Blob[]=[],original={create:URL.createObjectURL,revoke:URL.revokeObjectURL};
  URL.createObjectURL=vi.fn((blob:Blob)=>{created.push(blob);return "blob:synthetic-csv";});URL.revokeObjectURL=vi.fn();
  const click=vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(function(this:HTMLAnchorElement){
    expect(this.download).toBe("업무함_2026-10-15.csv");expect(this.getAttribute("href")).toBe("blob:synthetic-csv");expect(this.isConnected).toBe(true);
  });
  try{
    const text=csvText(["가"],[["값"]]);downloadCsv("업무함_2026-10-15.csv",text);
    expect(click).toHaveBeenCalledTimes(1);expect(document.querySelector("a")).toBeNull();
    expect(created[0].type).toBe("text/csv;charset=utf-8");expect(created[0].size).toBe(new TextEncoder().encode(text).length);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();vi.advanceTimersByTime(60_000);expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:synthetic-csv");
  }finally{URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;}
});
