"use client";
import { seoulLocalToInstant } from "../lib/vendor-time";

/** One Seoul wall-clock row. Strings come straight from date/time inputs; no browser time-zone conversion happens. */
export type IntervalDraft={date:string;start:string;end:string};
export const emptyIntervalDraft=():IntervalDraft=>({date:"",start:"",end:""});
export type IntervalResult={ok:true;intervals:{startAt:string;endAt:string}[]}|{ok:false;message:string};

/** Converts 1–5 Seoul rows into ordered absolute intervals; validation compares instants, never display strings. */
export function draftsToIntervals(drafts:IntervalDraft[],now:Date):IntervalResult{
  if(drafts.length<1||drafts.length>5)return {ok:false,message:"시간대는 1개 이상 5개 이하로 입력해 주세요."};
  const intervals:{startAt:string;endAt:string}[]=[];
  for(const draft of drafts){
    if(!draft.date||!draft.start||!draft.end)return {ok:false,message:"날짜와 시작·종료 시간을 모두 입력해 주세요."};
    const startAt=seoulLocalToInstant(draft.date,draft.start),endAt=seoulLocalToInstant(draft.date,draft.end);
    if(!startAt||!endAt)return {ok:false,message:"날짜와 시간을 다시 확인해 주세요."};
    if(Date.parse(startAt)>=Date.parse(endAt))return {ok:false,message:"종료 시간은 시작 시간보다 늦어야 합니다."};
    if(Date.parse(startAt)<=now.getTime())return {ok:false,message:"지난 시간은 선택할 수 없습니다."};
    intervals.push({startAt,endAt});
  }
  intervals.sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt));
  for(let i=1;i<intervals.length;i++)if(Date.parse(intervals[i-1].endAt)>Date.parse(intervals[i].startAt))return {ok:false,message:"시간대가 서로 겹치지 않게 입력해 주세요."};
  return {ok:true,intervals};
}

type Props={legend:string;drafts:IntervalDraft[];onChange(drafts:IntervalDraft[]):void;disabled?:boolean;max?:number};
/** Vertical list of rows (no horizontal scheduling grid); all times are Asia/Seoul. */
export function IntervalFields({legend,drafts,onChange,disabled,max=5}:Props){
  const update=(index:number,change:Partial<IntervalDraft>)=>onChange(drafts.map((draft,i)=>i===index?{...draft,...change}:draft));
  return <fieldset disabled={disabled}>
    <legend>{legend}</legend>
    <p>모든 시간은 한국 시간(서울) 기준입니다.</p>
    {drafts.map((draft,index)=><div key={index} role="group" aria-label={`시간대 ${index+1}`}>
      <label>날짜<input type="date" value={draft.date} onChange={event=>update(index,{date:event.target.value})}/></label>
      <label>시작 시간<input type="time" value={draft.start} onChange={event=>update(index,{start:event.target.value})}/></label>
      <label>종료 시간<input type="time" value={draft.end} onChange={event=>update(index,{end:event.target.value})}/></label>
      {drafts.length>1?<button type="button" onClick={()=>onChange(drafts.filter((_,i)=>i!==index))}>시간대 {index+1} 삭제</button>:null}
    </div>)}
    {drafts.length<max?<button type="button" onClick={()=>onChange([...drafts,emptyIntervalDraft()])}>시간대 추가</button>:null}
  </fieldset>;
}
