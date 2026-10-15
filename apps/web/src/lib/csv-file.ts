/**
 * CSV files the manager screens hand to Excel (E1 spec docs/superpowers/specs/2026-10-15-excel-export-e1-design.md).
 * UTF-8 with a BOM so Korean Windows Excel does not read it in the legacy code page; comma separated, CRLF line ends and
 * every cell quoted with inner quotes doubled (RFC 4180). A cell that starts with a character a spreadsheet may run as a
 * formula gets a leading apostrophe (OWASP CSV Injection); quoting every cell keeps a quote-and-comma trick from moving a
 * formula to the start of a new cell.
 */
const FORMULA_START=new Set(["=","+","-","@","\t","\r","\n","＝","＋","－","＠"]);
const FILE_NAME_UNSAFE=/[\\/:*?"<>|]|\p{Cc}/gu;
export function csvCell(value:string):string{const text=FORMULA_START.has(value.charAt(0))?`'${value}`:value;return `"${text.replaceAll('"','""')}"`;}
export function csvText(header:readonly string[],rows:readonly (readonly string[])[]):string{return "﻿"+[header,...rows].map(row=>row.map(csvCell).join(",")).join("\r\n")+"\r\n";}
/** `정비이력_해솔빌라_101동1203호_2026-10-15.csv`: unsafe characters become `_` and spaces go. */
export function csvFileName(parts:readonly string[],date:string):string{return [...parts.map(part=>part.replace(FILE_NAME_UNSAFE,"_").replace(/\s+/gu,"")),date].join("_")+".csv";}
/** Saves the text through a temporary link. The object URL is released a minute later so a slow save can still read it. */
export function downloadCsv(fileName:string,text:string):void{
  const url=URL.createObjectURL(new Blob([text],{type:"text/csv;charset=utf-8"})),link=document.createElement("a");
  link.href=url;link.download=fileName;link.hidden=true;document.body.append(link);
  try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);}
}
