import { createCoreFlowClient,ApiClientError,type CoreFlowClient } from "@build-manager/api-client";
import type { CoreSessionDto,CoreTicketDto,CoreUnitDto } from "@build-manager/api-contracts";
import { useState } from "react";
import { Text,TextInput,View,StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Screen,ActionButton,SectionHeading } from "../components/ui";
import { resolveMobileApiBaseUrl } from "../lib/api-config";
import { TenantTicket } from "../features/tenant/tenant-ticket";
import { TicketReview } from "../features/landlord/ticket-review";

const labels={OPEN:"접수",IN_PROGRESS:"처리중",COMPLETED:"처리 완료 (관리자 기록)"};
export default function CoreFlowScreen(){
  const router=useRouter();
  const [code,setCode]=useState(""),[client,setClient]=useState<CoreFlowClient|null>(null),[session,setSession]=useState<CoreSessionDto|null>(null);
  const [units,setUnits]=useState<CoreUnitDto[]>([]),[unit,setUnit]=useState("");
  const [tickets,setTickets]=useState<CoreTicketDto[]>([]),[selected,setSelected]=useState<CoreTicketDto|null>(null);
  const [issue,setIssue]=useState<"HEATING"|"LEAK">("HEATING"),[text,setText]=useState(""),[message,setMessage]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[details,setDetails]=useState(false);
  const run=async(action:()=>Promise<void>)=>{setBusy(true);setError("");try{await action();}catch(e){if(e instanceof ApiClientError && (e.status===401||e.status===403)){setSession(null);setClient(null);setSelected(null);setDetails(false);setTickets([]);setUnits([]);}else if(e instanceof ApiClientError && e.status===404){setSelected(null);setDetails(false);}setError("처리하지 못했습니다. 서버 주소·입력·접근 권한·연결을 확인하세요.");}finally{setBusy(false);}};
  if(details&&selected&&client&&session)return <View style={{flex:1}}><ActionButton label="← 처리 이력으로" onPress={()=>{setDetails(false);void run(async()=>setSelected(await client.read(selected.ticketId)));}} />{session.role==="TENANT"?<TenantTicket client={client.protocol} ticketId={selected.ticketId} coreFlow />:<TicketReview client={client.protocol} ticketId={selected.ticketId} onBack={()=>setDetails(false)} coreFlow />}</View>;
  return <Screen>
    <SectionHeading>우리 집 수리 접수</SectionHeading>
    <Text>RC1 합성 개발 계정 전용 · 사진 업로드·실제 로그인·업체 출동·알림 미지원</Text>
    <ActionButton label="← 앱 홈" onPress={()=>router.back()} />
    {error?<Text accessibilityRole="alert">{error}</Text>:null}{busy?<Text>불러오는 중…</Text>:null}
    {!session||!client?<>
      <TextInput accessibilityLabel="개발 접근 코드" placeholder="개발 접근 코드" secureTextEntry autoCapitalize="none" autoCorrect={false} value={code} onChangeText={setCode} style={styles.input} />
      <ActionButton label="들어가기" disabled={busy||!/^[a-f0-9]{64}$/.test(code)} onPress={()=>void run(async()=>{const c=createCoreFlowClient({baseUrl:resolveMobileApiBaseUrl(process.env.EXPO_PUBLIC_API_URL),accessCode:code});const s=await c.session(),u=await c.units(),t=await c.tickets();setClient(c);setSession(s);setUnits(u);setUnit(u[0]?.id??"");setTickets(t);setCode("");})} />
      <Text>개발 환경에서 발급한 계정별 코드가 필요합니다. 앱 재진입 때 다시 입력합니다. 접수 이력은 서버에 보존됩니다.</Text>
    </>:<>
      <Text>{session.role==="TENANT"?"세입자":"관리자"} 접속</Text>
      <ActionButton label="로그아웃" disabled={busy} onPress={()=>void run(async()=>{await client.logout();setSession(null);setClient(null);setTickets([]);setSelected(null);})} />
      <ActionButton label="전체 새로고침" disabled={busy} onPress={()=>void run(async()=>{setTickets(await client.tickets());if(selected)setSelected(await client.read(selected.ticketId));})} />
      {selected?<>
        <ActionButton label="← 목록으로" onPress={()=>void run(async()=>{setSelected(null);setTickets(await client.tickets());})} />
        <SectionHeading>접수 상세</SectionHeading><Text testID="work-status">{labels[selected.workStatus]}</Text>
        {session.role!=="TENANT"&&selected.workStatus!=="COMPLETED"?<>
          <TextInput accessibilityLabel="처리 기록" placeholder="처리 기록" multiline maxLength={2000} value={message} onChangeText={setMessage} style={styles.input} />
          <ActionButton label={selected.workStatus==="OPEN"?"처리 시작 기록":"처리 완료 기록"} disabled={busy||!message.trim()} onPress={()=>void run(async()=>{setSelected(await client.handling(selected.ticketId,{status:selected.workStatus==="OPEN"?"IN_PROGRESS":"COMPLETED",message}));setMessage("");})} />
          <Text>담당자가 확인한 사실을 기록하세요. 자동 출동이나 수리 검증을 뜻하지 않습니다.</Text>
        </>:null}
        <SectionHeading>접수 및 처리 이력</SectionHeading>{selected.events.map(e=><Text key={e.id}>{new Date(e.at).toLocaleString()} · {e.actorRole==="TENANT"?"세입자":"관리자"} · {e.message||e.kind}</Text>)}
        {selected.workStatus!=="COMPLETED"?<ActionButton label="질문·추천 경로 상세" onPress={()=>setDetails(true)} />:<Text>관리자의 완료 기록을 확인했습니다.</Text>}
      </>:<>
        <SectionHeading>건물·호실</SectionHeading>{!units.length?<Text>접근 가능한 호실이 없습니다.</Text>:null}
        {units.map(u=><ActionButton key={u.id} label={`${u.buildingName} · ${u.label}`} selected={u.id===unit} onPress={()=>setUnit(u.id)} />)}
        {session.role==="TENANT"&&unit?<>
          <SectionHeading>문제 접수</SectionHeading><ActionButton label="난방" selected={issue==="HEATING"} onPress={()=>setIssue("HEATING")} /><ActionButton label="누수" selected={issue==="LEAK"} onPress={()=>setIssue("LEAK")} />
          <TextInput accessibilityLabel="문제 설명" placeholder="문제 설명" multiline maxLength={2000} value={text} onChangeText={setText} style={styles.input} />
          <ActionButton label="접수하기" disabled={busy||!text.trim()} onPress={()=>void run(async()=>{setSelected(await client.create({unitId:unit,issueType:issue,rawUserText:text}));setText("");})} />
        </>:null}
        <SectionHeading>호실별 접수 이력</SectionHeading>{tickets.filter(t=>t.unitId===unit).length===0?<Text>아직 접수 내역이 없습니다.</Text>:null}
        {tickets.filter(t=>t.unitId===unit).map(t=><ActionButton key={t.ticketId} label={`${t.detail.issueType==="HEATING"?"난방":"누수"} · ${labels[t.workStatus]} · ${t.ticketId.slice(0,8)}`} disabled={busy} onPress={()=>void run(async()=>{setSelected(await client.read(t.ticketId));setMessage("");})} />)}
      </>}
    </>}
  </Screen>;
}
const styles=StyleSheet.create({input:{borderWidth:1,borderColor:"#82998f",borderRadius:8,padding:12,minHeight:48,color:"#17322b",backgroundColor:"#fff"}});
