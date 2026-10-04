"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { ApiClientError,type CoreFlowClient } from "@build-manager/api-client";
import { CoreCommunicationSendSchema,type CoreCommunicationIntent,type CoreCommunicationPage,type CoreCommunicationSummary } from "@build-manager/api-contracts";
import { clearCommunicationRecovery,readCommunicationRecovery,saveCommunicationRecovery,type CommunicationRecovery } from "./communication-recovery";
import styles from "./ticket-communication.module.css";

export function CommunicationBadge({summary,tenant=false}:{summary?:Pick<CoreCommunicationSummary,"waitingFor"|"readOnly">;tenant?:boolean}){
  if(!summary||summary.readOnly||summary.waitingFor==="NONE")return null;
  return <span className={styles.badge}>{summary.waitingFor==="TENANT"?(tenant?"내 답변 필요":"세입자 답변 대기"):"관리자 답변 대기"}</span>;
}
export function useCommunicationSummaries(client:CoreFlowClient,ids:string[],revision:number){
  const [summaries,setSummaries]=useState<Record<string,CoreCommunicationSummary>>({}),[error,setError]=useState(false);
  const key=ids.join(",");
  useEffect(()=>{
    let live=true,generation=0;
    const load=async()=>{const current=++generation;try{
      const list=key?key.split(","):[],all:CoreCommunicationSummary[]=[];
      for(let i=0;i<list.length;i+=50)all.push(...await client.communication.summaries(list.slice(i,i+50)));
      if(live&&current===generation){setSummaries(Object.fromEntries(all.map(s=>[s.ticketId,s])));setError(false);}
    }catch{if(live&&current===generation){setSummaries({});setError(true);}}};
    const focus=()=>{if(!document.hidden)void load();};void load();window.addEventListener("focus",focus);document.addEventListener("visibilitychange",focus);
    return()=>{live=false;generation++;window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",focus);};
  },[client,key,revision]);
  return {summaries,error};
}
const intentLabel:Record<CoreCommunicationIntent,string>={REQUEST_REPLY:"질문",TENANT_MESSAGE:"문의·답변",MANAGER_REPLY:"답변",MANAGER_UPDATE:"진행 안내"};
export function TicketCommunication({client,ticketId,tenant,revision,completed,onVersion}:{client:CoreFlowClient;ticketId:string;tenant:boolean;revision:number;completed:boolean;onVersion(value:{ticketId:string;version:number}|null):void}){
  const [page,setPage]=useState<CoreCommunicationPage|null>(null),[text,setText]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [error,setError]=useState(""),[notice,setNotice]=useState(""),[recovery,setRecovery]=useState<CommunicationRecovery|null>(null),[notFound,setNotFound]=useState(false);
  const alive=useRef(false),generation=useRef(0);
  const readOnly=completed||page?.readOnly;
  const load=useCallback(async()=>{
    const current=++generation.current;setLoading(true);onVersion(null);
    try{const next=await client.communication.read(ticketId);if(alive.current&&current===generation.current){setPage(next);onVersion({ticketId,version:next.version});}}
    catch(e){if(alive.current&&current===generation.current){setPage(null);setError("대화를 불러오지 못했습니다. 연결과 접근 권한을 확인하고 대화 새로고침을 눌러 주세요.");if(e instanceof ApiClientError&&(e.status===401||e.status===403))clearCommunicationRecovery();}}
    finally{if(alive.current&&current===generation.current)setLoading(false);}
  },[client,ticketId,onVersion]);
  useEffect(()=>{
    alive.current=true;generation.current++;let current=true;
    void Promise.resolve().then(()=>{if(current){setRecovery(readCommunicationRecovery(ticketId));void load();}});
    const focus=()=>{if(!document.hidden)void load();};
    window.addEventListener("focus",focus);document.addEventListener("visibilitychange",focus);
    return()=>{current=false;alive.current=false;window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",focus);};
  },[ticketId,load,revision]);
  const send=async(intent:CoreCommunicationIntent)=>{
    if(!page||busy||loading||recovery||readOnly)return;
    const parsed=CoreCommunicationSendSchema.safeParse({clientRequestId:crypto.randomUUID(),expectedVersion:page.version,intent,body:text});
    if(!parsed.success){setError("공백이 아닌 1–2000자를 입력해 주세요. 줄바꿈 외 제어 문자는 사용할 수 없습니다.");return;}
    const pending={ticketId,clientRequestId:parsed.data.clientRequestId,intent,expectedVersion:page.version};
    setBusy(true);setError("");setNotice("");setNotFound(false);setRecovery(pending);saveCommunicationRecovery(pending);
    try{
      await client.communication.send(ticketId,parsed.data);if(!alive.current)return;
      clearCommunicationRecovery(ticketId);setRecovery(null);setText("");setNotice("대화를 저장했습니다. 상대는 새로고침하거나 다시 열어 확인할 수 있습니다.");await load();
    }catch(e){if(!alive.current)return;
      if(e instanceof ApiClientError&&e.status&&[400,401,403,404,409].includes(e.status)){
        clearCommunicationRecovery(ticketId);setRecovery(null);
        if(e.status===401||e.status===403){clearCommunicationRecovery();setText("");setPage(null);}
        setError(e.status===409?"다른 변경이 먼저 저장되었습니다. 대화 새로고침으로 최신 대화를 확인한 뒤 내용을 검토해 다시 보내 주세요.":"입력 또는 접근 권한을 확인해 주세요. 저장하지 않았습니다.");
        if(e.status===409){setPage(null);onVersion(null);}
      }else setError("저장 결과를 확인하지 못했습니다. 다시 보내기 전에 저장 여부 확인을 눌러 주세요.");
    }finally{if(alive.current)setBusy(false);}
  };
  const check=async()=>{
    if(!recovery||busy)return;setBusy(true);setError("");setNotice("");
    try{await client.communication.receipt(ticketId,recovery.clientRequestId);if(!alive.current)return;
      clearCommunicationRecovery(ticketId);setRecovery(null);setNotFound(false);setText("");setNotice("이미 저장된 대화를 확인했습니다. 중복 전송하지 않았습니다.");await load();
    }catch(e){if(!alive.current)return;
      if(e instanceof ApiClientError&&e.status===404){setNotFound(true);await load();setError("이 요청의 저장 기록을 찾지 못했습니다. 최신 대화를 확인한 뒤 새 메시지를 작성할지 결정해 주세요. 이전 본문은 자동 복구·전송하지 않습니다.");}
      else if(e instanceof ApiClientError&&(e.status===401||e.status===403)){clearCommunicationRecovery();setRecovery(null);setText("");setPage(null);setError("접근 권한이 변경되었습니다. 다시 로그인해 주세요.");}
      else setError("저장 여부를 확인하지 못했습니다. 연결이 복구되면 저장 여부 확인을 눌러 주세요.");
    }finally{if(alive.current)setBusy(false);}
  };
  const older=async()=>{if(!page?.nextBeforeSequence||busy)return;setBusy(true);setError("");try{
    const previous=await client.communication.read(ticketId,page.nextBeforeSequence);if(alive.current)setPage(current=>current?{...current,messages:[...previous.messages,...current.messages.filter(m=>!previous.messages.some(p=>p.id===m.id))],nextBeforeSequence:previous.nextBeforeSequence}:current);
  }catch{if(alive.current)setError("이전 대화를 불러오지 못했습니다. 연결을 확인하고 다시 눌러 주세요.");}finally{if(alive.current)setBusy(false);}};
  return <section aria-label="세입자와 공유하는 대화" className={styles.conversation}>
    <div className={styles.heading}><div><h2>세입자와 공유하는 대화</h2><p>세입자와 권한 있는 관리자가 함께 보는 내용입니다.</p></div><button disabled={busy||loading} onClick={()=>{setError("");void load();}}>대화 새로고침</button></div>
    <CommunicationBadge summary={page?{...page,readOnly:Boolean(readOnly)}:undefined} tenant={tenant}/>
    {loading?<p role="status">대화를 불러오는 중…</p>:null}
    {error?<p className={styles.error} role="alert">{error}</p>:null}{notice?<p className={styles.notice} role="status">{notice}</p>:null}
    {page?.nextBeforeSequence?<button disabled={busy||loading} onClick={()=>void older()}>이전 대화 더 보기</button>:null}
    {page?.messages.length?<ol className={styles.messages}>{page.messages.map(m=><li key={m.id} data-author={m.authorRole}><p className={styles.meta}><strong>{m.authorRole==="TENANT"?"세입자":"관리자"}</strong> · {intentLabel[m.intent]} · <time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleString("ko-KR")}</time></p><p className={styles.body}>{m.body}</p>{m.replyToMessageId?<small>앞선 대화에 대한 답변</small>:null}</li>)}</ol>:page?<p>아직 공유된 대화가 없습니다. 문의나 진행 안내를 남겨 주세요.</p>:null}
    {recovery?<div className={styles.recovery}><p>확인이 필요한 전송이 있습니다. 저장 여부를 확인하기 전에는 새 메시지를 보내지 않습니다.</p><button disabled={busy} onClick={()=>void check()}>저장 여부 확인</button>{notFound?<button disabled={busy||loading} onClick={()=>{clearCommunicationRecovery(ticketId);setRecovery(null);setNotFound(false);setText("");setError("");}}>확인 후 새 메시지 작성</button>:null}</div>:null}
    {readOnly?<p>관리자의 완료 기록이 있는 접수입니다. 이전 대화만 볼 수 있으며 새 메시지는 보낼 수 없습니다.</p>:<div className={styles.composer}>
      <label>공개 대화 내용<textarea aria-label="공개 대화 내용" rows={4} maxLength={2000} value={text} disabled={busy||Boolean(recovery)} onChange={e=>setText(e.target.value)}/></label><p>{text.length}/2000자 · 사진은 기존 참고 사진 영역에서 확인하세요.</p>
      <div className={styles.actions}>{tenant?<button data-primary="true" disabled={busy||loading||!page||Boolean(recovery)||!text.trim()} onClick={()=>void send("TENANT_MESSAGE")}>{page?.waitingFor==="TENANT"?"답변 보내기":"추가 문의 보내기"}</button>:<>
        <button data-primary={page?.waitingFor!=="MANAGER"} disabled={busy||loading||!page||Boolean(recovery)||!text.trim()||page.waitingFor==="TENANT"} onClick={()=>void send("REQUEST_REPLY")}>세입자에게 질문</button>
        <button data-primary={page?.waitingFor==="MANAGER"} disabled={busy||loading||!page||Boolean(recovery)||!text.trim()||page.waitingFor!=="MANAGER"} onClick={()=>void send("MANAGER_REPLY")}>답변</button>
        <button data-primary={page?.waitingFor==="TENANT"} disabled={busy||loading||!page||Boolean(recovery)||!text.trim()} onClick={()=>void send("MANAGER_UPDATE")}>진행 안내</button>
      </>}</div>
      {!tenant?<p>질문은 세입자의 답변을 요청하고, 답변은 관리자 답변 대기를 마칩니다. 진행 안내는 대기 상태를 바꾸지 않습니다.</p>:null}
    </div>}
  </section>;
}
