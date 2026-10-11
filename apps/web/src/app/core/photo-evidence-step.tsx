"use client";
import { useEffect,useId,useRef,useState,type ChangeEvent } from "react";
import { ApiClientError,type CoreFlowClient } from "@build-manager/api-client";
import { CORE_PHOTO_MAX_BYTES,CORE_PHOTO_MAX_COUNT,type CorePhotoDto,type SyntheticEvidenceRequirementDto,type TenantTicketStatusDto } from "@build-manager/api-contracts";
import { EVIDENCE_NAMES,evidenceNamesByPhoto } from "./ui/evidence-names";
import styles from "./core-design.module.css";

type Stored={photo:CorePhotoDto;url:string};
type Upload={state:"idle"}|{state:"sending";uploadId:string;file:File}|{state:"failed";uploadId:string;file:File;message:string;retry:boolean};

/** What went wrong with an upload, in this step's words (rules §10); only a connection or unknown failure is worth retrying. */
function uploadFailure(error:unknown):{message:string;retry:boolean}{
  const status=error instanceof ApiClientError?error.status:undefined;
  if(status===413)return {message:"사진 용량이나 화소가 한도를 넘어요. 5MiB·2천만 화소 이하 사진을 골라 주세요.",retry:false};
  if(status===400||status===415)return {message:"읽을 수 있는 JPEG·PNG 사진을 골라 주세요.",retry:false};
  if(status===409)return {message:"사진을 더 올릴 수 없어요. 사진은 최대 3장이고, 처리가 끝난 접수에는 올릴 수 없어요.",retry:false};
  return {message:"사진을 올리지 못했어요. 연결을 확인하고 다시 올려 주세요.",retry:true};
}

/**
 * P1b (spec D1–D6): the tenant names one of the ticket's own photos as the evidence the protocol asks for now, or adds
 * one here. The server checks the photo and the type again; this only offers the choice. Shown only before the request
 * is first sent (D5): a request already sent without photos stays as it is.
 */
export function PhotoEvidenceStep({client,ticketId,requirement,named,revision,busy,onChoose,onSubmitWithout,onPhotosChanged}:{
  client:Pick<CoreFlowClient,"photos"|"readPhoto"|"uploadPhoto">;
  ticketId:string;
  requirement:SyntheticEvidenceRequirementDto;
  /** Evidence already named, so each photo shows what it stands for. */
  named:TenantTicketStatusDto["submittedEvidence"];
  /** The screen's photo revision: another part of the screen stored a photo. */
  revision:number;
  /** The intake is saving. */
  busy:boolean;
  onChoose:(photoId:string)=>void;
  onSubmitWithout:()=>void;
  onPhotosChanged:()=>void;
}){
  const headingId=useId(),hintId=useId(),heading=useRef<HTMLHeadingElement>(null);
  const [photos,setPhotos]=useState<Stored[]>([]),[load,setLoad]=useState<"loading"|"ready"|"failed">("loading"),[reload,setReload]=useState(0);
  const [selected,setSelected]=useState<string|null>(null),[upload,setUpload]=useState<Upload>({state:"idle"}),[fileError,setFileError]=useState("");
  // The control that led here (the last answer, or the previous step's choice) is gone: continue from this step's heading.
  // Focus that is still on another control stays where the tenant put it.
  useEffect(()=>{if(document.activeElement===null||document.activeElement===document.body)heading.current?.focus();},[]);
  useEffect(()=>{let live=true;const urls:string[]=[];
    void (async()=>{try{
      const metadata=await client.photos(ticketId),loaded:Stored[]=[];
      for(const photo of metadata){const blob=await client.readPhoto(photo);if(!live)return;const url=URL.createObjectURL(blob);urls.push(url);loaded.push({photo,url});}
      if(live){setPhotos(loaded);setLoad("ready");}
    }catch{if(live)setLoad("failed");}})();
    return()=>{live=false;urls.forEach(url=>URL.revokeObjectURL(url));};
  },[client,ticketId,revision,reload]);

  const sending=upload.state==="sending",locked=busy||sending,full=photos.length>=CORE_PHOTO_MAX_COUNT;
  const send=async(uploadId:string,file:File)=>{
    setUpload({state:"sending",uploadId,file});
    try{
      // A response lost on the way back may still have stored the photo: look before sending it again.
      const photo=(await client.photos(ticketId)).find(item=>item.uploadId===uploadId)??await client.uploadPhoto(ticketId,uploadId,file);
      setUpload({state:"idle"});setSelected(photo.photoId);setReload(value=>value+1);onPhotosChanged();
    }catch(error){
      setUpload({state:"failed",uploadId,file,...uploadFailure(error)});
      // A 409 means the photos changed (the limit was reached elsewhere) or the request was closed: read them again.
      if(error instanceof ApiClientError&&error.status===409)setReload(value=>value+1);
    }
  };
  const pick=(event:ChangeEvent<HTMLInputElement>)=>{
    const file=Array.from(event.target.files??[])[0];event.target.value="";
    if(!file)return;
    if(!["image/jpeg","image/png"].includes(file.type)||file.size>CORE_PHOTO_MAX_BYTES){setFileError("JPEG·PNG 사진만 올릴 수 있어요. 한 장당 5MiB 이하예요.");return;}
    setFileError("");void send(crypto.randomUUID(),file);
  };

  const names=evidenceNamesByPhoto(named);
  const ready=load==="ready",chosen=selected!==null&&photos.some(item=>item.photo.photoId===selected);
  const hint=ready&&!chosen?(photos.length?"사진을 하나 골라 주세요.":null):null;
  return <section className={styles.evidenceStep} aria-labelledby={headingId}>
    <h2 id={headingId} ref={heading} tabIndex={-1}>{EVIDENCE_NAMES[requirement.evidenceType].prompt}</h2>
    {requirement.instruction?<p>{requirement.instruction}</p>:null}
    {load==="loading"?<p>사진을 불러오는 중이에요.</p>
      :load==="failed"?<div role="alert"><p>올린 사진을 불러오지 못했어요. 연결을 확인하고 다시 불러와 주세요.</p><button type="button" onClick={()=>{setLoad("loading");setReload(value=>value+1);}}>사진 다시 불러오기</button></div>
      :!photos.length?<p id={hintId}>아직 올린 사진이 없어요. &apos;사진 추가하기&apos;로 올려 주세요.</p>
      :<div className={styles.evidenceTiles} role="radiogroup" aria-labelledby={headingId}>{photos.map(({photo,url},index)=>
        <label key={photo.photoId} className={styles.evidenceTile}>
          <img src={url} alt={`올린 사진 ${index+1}`}/>
          {/* Named by the caption only, so the photo's alt text is not read twice. */}
          <span><input type="radio" aria-labelledby={`${headingId}-photo-${index}`} name={`evidence-${ticketId}-${requirement.evidenceType}`} value={photo.photoId} checked={selected===photo.photoId} disabled={locked} onChange={()=>setSelected(photo.photoId)}/><span id={`${headingId}-photo-${index}`}>{`사진 ${index+1}`}{names.has(photo.photoId)?` · ${names.get(photo.photoId)!.join(", ")}`:""}</span></span>
        </label>)}</div>}
    <div className={styles.evidenceActions}>
      <button type="button" className={styles.primary} disabled={!chosen||locked} aria-describedby={hint||(ready&&!photos.length)?hintId:undefined} onClick={()=>{if(selected)onChoose(selected);}}>이 사진으로 정하기</button>
      {hint?<p id={hintId}>{hint}</p>:null}
      <label className={styles.evidenceAdd} data-disabled={full||locked}>사진 추가하기<input type="file" accept="image/jpeg,image/png" disabled={full||locked} onChange={pick}/></label>
      {full?<p>한 접수에 사진은 최대 3장이에요. 올린 사진 중에서 골라 주세요.</p>:null}
      {sending?<p role="status">사진을 올리는 중이에요.</p>:null}
      {fileError?<p role="alert">{fileError}</p>:null}
      {upload.state==="failed"?<div role="alert"><p>{upload.message}</p>{upload.retry?<button type="button" disabled={busy} onClick={()=>void send(upload.uploadId,upload.file)}>다시 올리기</button>:null}</div>:null}
      <button type="button" className={styles.textAction} disabled={locked} onClick={onSubmitWithout}>사진 없이 제출하기</button>
      <p>사진 없이 보내도 접수돼요. 관리자가 확인한 뒤 필요한 것을 다시 물어볼 수 있어요.</p>
    </div>
  </section>;
}
