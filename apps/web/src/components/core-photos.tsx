"use client";
import { useEffect,useRef,useState } from "react";
import { ApiClientError,type CoreFlowClient } from "@build-manager/api-client";
import { CORE_PHOTO_MAX_BYTES,type CorePhotoDto } from "@build-manager/api-contracts";
import { PhotoSelectionSurface } from "../app/core/ui/core-display";

export type PendingPhoto={uploadId:string;file:File};
function Preview({file,index}:{file:File;index:number}){
  const image=useRef<HTMLImageElement>(null);
  useEffect(()=>{const url=URL.createObjectURL(file);if(image.current)image.current.src=url;return()=>URL.revokeObjectURL(url);},[file]);
  return <img ref={image} alt={`전송 전 사진 ${index+1} 미리보기`} />;
}
export function PhotoPicker({files,onChange,disabled=false}:{files:PendingPhoto[];onChange:(files:PendingPhoto[])=>void;disabled?:boolean}){
  const [error,setError]=useState("");
  return <section className="core-photos" aria-label="사진 선택 및 미리보기">
    <PhotoSelectionSurface selectionCount={files.length} disabled={disabled}><input aria-label="참고 사진 선택" type="file" accept="image/jpeg,image/png" multiple disabled={disabled} onChange={e=>{
      const added=Array.from(e.target.files??[]);e.target.value="";
      if(files.length+added.length>3){setError("한 접수에 사진은 최대 3장입니다.");return;}
      if(added.some(f=>!['image/jpeg','image/png'].includes(f.type)||f.size>CORE_PHOTO_MAX_BYTES)){setError("JPEG·PNG만 선택하세요. 한 장당 5MiB 이하입니다.");return;}
      setError("");onChange([...files,...added.map(file=>({file,uploadId:crypto.randomUUID()}))]);
    }} /></PhotoSelectionSurface>
    <details><summary>사진 도움말</summary><p>한 장당 5MiB·2천만 화소 이하입니다. 사진은 참고 첨부이며 자동 분석이나 필수 증빙 판정에 사용하지 않습니다.</p></details>
    {error?<p role="alert">{error}</p>:null}
    <div className="photo-grid">{files.map((p,i)=><figure key={p.uploadId}><Preview file={p.file} index={i} /><figcaption>전송 전 사진 {i+1}</figcaption><button type="button" disabled={disabled} onClick={()=>onChange(files.filter(f=>f.uploadId!==p.uploadId))}>사진 {i+1} 선택 취소</button></figure>)}</div>
    {files.length?<p>선택한 사진은 아직 저장되지 않았습니다. 전송 실패 시 이 화면에서 다시 시도할 수 있습니다. 페이지를 닫거나 새로고침하면 미전송 선택은 사라집니다.</p>:null}
  </section>;
}

export function PhotoGallery({client,ticketId,revision=0,compact=false}:{client:CoreFlowClient;ticketId:string;revision?:number;compact?:boolean}){
  const [attempt,setAttempt]=useState(0);
  return <LoadedGallery key={`${ticketId}-${revision}-${attempt}`} client={client} ticketId={ticketId} compact={compact} retry={()=>setAttempt(a=>a+1)} />;
}
function LoadedGallery({client,ticketId,compact,retry}:{client:CoreFlowClient;ticketId:string;compact:boolean;retry:()=>void}){
  const [photos,setPhotos]=useState<{photo:CorePhotoDto;url:string}[]>([]),[error,setError]=useState(false),[loading,setLoading]=useState(true),[zoom,setZoom]=useState<string|null>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{let live=true;const urls:string[]=[];
    void (async()=>{try{
      const metadata=await client.photos(ticketId),loaded=[];
      for(const photo of metadata){const blob=await client.readPhoto(photo);if(!live)return;const url=URL.createObjectURL(blob);urls.push(url);loaded.push({photo,url});}
      if(live)setPhotos(loaded);
    }catch{if(live){setPhotos([]);setError(true);}}finally{if(live)setLoading(false);}})();
    return()=>{live=false;urls.forEach(URL.revokeObjectURL);};
  },[client,ticketId]);
  useEffect(()=>{if(zoom)dialog.current?.showModal();else dialog.current?.close();},[zoom]);
  return <section className="core-photos" aria-label={compact?"이력의 첨부 사진":"사진"}>
    {!compact?<h2>사진</h2>:null}
    {loading?<p>사진 불러오는 중…</p>:error?<p role="alert">사진을 불러오지 못했습니다. <button type="button" onClick={retry}>사진 다시 불러오기</button></p>:!photos.length?(!compact?<p>저장된 사진이 없습니다. 글만으로도 접수할 수 있습니다.</p>:null):<div className="photo-grid">{photos.map(({photo,url},i)=><figure key={photo.photoId}><button type="button" aria-label={`저장된 사진 ${i+1} 확대`} onClick={()=>setZoom(url)}><img src={url} alt={`접수 참고 사진 ${i+1}`} /></button>{!compact?<figcaption>사진 {i+1} · <time dateTime={photo.createdAt}>{new Date(photo.createdAt).toLocaleString("ko-KR")}</time></figcaption>:null}</figure>)}</div>}
    <dialog ref={dialog} className="photo-dialog" onClose={()=>setZoom(null)} aria-label="첨부 사진 확대"><button type="button" onClick={()=>setZoom(null)}>사진 닫기</button>{zoom?<img src={zoom} alt="확대한 접수 참고 사진" />:null}</dialog>
  </section>;
}

export function photoError(error:unknown){
  const status=error instanceof ApiClientError?error.status:undefined;
  if(status===413)return "사진 용량 또는 화소가 한도를 넘습니다. 5MiB·2천만 화소 이하 사진을 선택하세요.";
  if(status===400||status===415)return "읽을 수 있는 JPEG·PNG 사진을 선택해 주세요.";
  if(status===409)return "사진을 저장하지 못했습니다. 저장 상태 확인으로 이미 저장된 사진과 완료 상태를 확인하세요. 최대 3장까지 첨부할 수 있습니다.";
  return "사진 전송 결과를 확인하지 못했습니다. 접수는 이미 저장되어 있습니다. 선택은 유지했습니다. 저장 상태 확인 후 사진만 다시 전송해 주세요.";
}
