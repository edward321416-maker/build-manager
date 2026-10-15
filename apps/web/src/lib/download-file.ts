/** Saves text through a temporary link. The object URL is released a minute later so a slow save can still read it. */
export function downloadFile(fileName:string,text:string,type:string):void{
  const url=URL.createObjectURL(new Blob([text],{type})),link=document.createElement("a");
  link.href=url;link.download=fileName;link.hidden=true;document.body.append(link);
  try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);}
}
