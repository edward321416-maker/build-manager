import { useEffect,useRef,useState } from "react";
import { Image,Modal,Text,View } from "react-native";
import { ApiClientError,type CoreFlowClient } from "@build-manager/api-client";
import type { CorePhotoDto } from "@build-manager/api-contracts";
import { ActionButton } from "../components/ui";

/** Protected bearer reads only. This screen does not start or configure Expo. */
export function CorePhotos({client,ticketId,onDenied}:{client:CoreFlowClient;ticketId:string;onDenied:()=>void}){
  const [attempt,setAttempt]=useState(0);
  return <LoadedPhotos key={`${ticketId}-${attempt}`} client={client} ticketId={ticketId} onDenied={onDenied} retry={()=>setAttempt(a=>a+1)} />;
}
function LoadedPhotos({client,ticketId,onDenied,retry}:{client:CoreFlowClient;ticketId:string;onDenied:()=>void;retry:()=>void}){
  const [photos,setPhotos]=useState<CorePhotoDto[]>([]),[error,setError]=useState(false),[zoom,setZoom]=useState<CorePhotoDto|null>(null),[loading,setLoading]=useState(true);
  const mounted=useRef(true);
  useEffect(()=>{let live=true;mounted.current=true;
    void client.photos(ticketId).then(items=>{if(live)setPhotos(items);}).catch(e=>{if(!live)return;setError(true);if(e instanceof ApiClientError&&(e.status===401||e.status===403))onDenied();}).finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;mounted.current=false;};
  },[client,ticketId,onDenied]);
  const failed=()=>{setPhotos([]);setZoom(null);setError(true);void client.photos(ticketId).catch(e=>{if(mounted.current&&e instanceof ApiClientError&&(e.status===401||e.status===403))onDenied();});};
  return <View><Text>저장된 참고 사진</Text><Text>사진 선택·업로드는 Web에서 지원합니다. 사진은 자동 분석이나 필수 증빙 판정에 사용하지 않습니다.</Text>
    {loading?<Text>사진 불러오는 중…</Text>:error?<><Text accessibilityRole="alert">사진을 불러오지 못했습니다.</Text><ActionButton label="사진 다시 불러오기" onPress={retry} /></>:!photos.length?<Text>저장된 사진이 없습니다.</Text>:photos.map((photo,i)=><View key={photo.photoId}><Image accessibilityLabel={`접수 참고 사진 ${i+1}`} source={client.photoSource(photo)} style={{width:"100%",height:180}} resizeMode="contain" onError={failed} /><ActionButton label={`사진 ${i+1} 확대`} onPress={()=>setZoom(photo)} /></View>)}
    {zoom?<Modal visible onRequestClose={()=>setZoom(null)}><View style={{flex:1,padding:20}}><ActionButton label="사진 닫기" onPress={()=>setZoom(null)} /><Image accessibilityLabel="확대한 접수 참고 사진" source={client.photoSource(zoom)} style={{flex:1}} resizeMode="contain" onError={failed} /></View></Modal>:null}
  </View>;
}
