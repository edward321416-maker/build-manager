import { afterEach,expect,it,vi } from "vitest";
import { generateKeyPairSync,randomBytes,sign } from "node:crypto";
import { NextRequest,type NextResponse } from "next/server";
import { createB1Auth0 } from "./auth0";
type Fault="signature"|"issuer"|"audience"|"expiry"|"nonce"|"state"|"social"|undefined;
afterEach(()=>vi.restoreAllMocks());
function jar(response:NextResponse){return response.cookies.getAll().filter(c=>c.value).map(c=>`${c.name}=${c.value}`).join('; ');}
async function flow(fault?:Fault){
 vi.spyOn(console,'error').mockImplementation(()=>{});
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const jwk={...publicKey.export({format:'jwk'}),kid:'test',use:'sig',alg:'RS256'};
 const config={domain:'synthetic.invalid',issuer:'https://synthetic.invalid/',clientId:'synthetic',clientSecret:randomBytes(32).toString('hex'),secret:randomBytes(32).toString('hex'),appBaseUrl:'http://localhost:3124'};
 let nonce='',used=false,tokenCalls=0;
 const network:typeof fetch=async(input)=>{
  const url=new URL(input instanceof Request?input.url:String(input));
  if(url.pathname==='/.well-known/openid-configuration')return Response.json({issuer:config.issuer,authorization_endpoint:config.issuer+'authorize',token_endpoint:config.issuer+'oauth/token',jwks_uri:config.issuer+'jwks',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256'],token_endpoint_auth_methods_supported:['client_secret_post'],end_session_endpoint:config.issuer+'logout'});
  if(url.pathname==='/jwks' || url.pathname==='/.well-known/jwks.json')return Response.json({keys:[jwk]});
  if(url.pathname==='/oauth/token'){
   tokenCalls++;if(used)return Response.json({error:'invalid_grant'},{status:400});used=true;
   const now=Math.floor(Date.now()/1000),payload={iss:fault==='issuer'?'https://wrong.invalid/':config.issuer,aud:fault==='audience'?'wrong':config.clientId,sub:fault==='social'?'oauth2|synthetic':'auth0|synthetic',nonce:fault==='nonce'?'wrong':nonce,iat:now,exp:fault==='expiry'?now-3600:now+3600,sid:'synthetic'};
   const unsigned=Buffer.from(JSON.stringify({alg:'RS256',kid:'test'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url');
   let signature=sign('RSA-SHA256',Buffer.from(unsigned),privateKey).toString('base64url');if(fault==='signature')signature=Buffer.alloc(256).toString('base64url');
   return Response.json({access_token:randomBytes(32).toString('hex'),token_type:'Bearer',expires_in:3600,id_token:unsigned+'.'+signature});
  }
  throw new Error('UNEXPECTED_TEST_NETWORK');
 };
 const client=createB1Auth0(config,network);
 const start=await client.middleware(new NextRequest(config.appBaseUrl+'/auth/login'));
 expect(start.status).toBe(307);
 const destination=new URL(start.headers.get('location')!);nonce=destination.searchParams.get('nonce')!;
 expect(destination.searchParams.get('connection')).toBe('Username-Password-Authentication');
 const callback=config.appBaseUrl+'/auth/callback?code=synthetic&state='+encodeURIComponent(fault==='state'?'wrong':destination.searchParams.get('state')!);
 const request=new NextRequest(callback,{headers:{cookie:jar(start)}});
 let result:NextResponse|null=null,threw=false;
 try{result=await client.middleware(request);}catch{threw=true;}
 return {client,result,threw,request,config,tokenCalls:()=>tokenCalls};
}
it('R08 actual SDK validates callback and saves fresh transport material',async()=>{
 const f=await flow();expect(f.threw).toBe(false);expect(f.result?.headers.get('location')).toBe(f.config.appBaseUrl+'/api/v2/session/complete');
 expect(f.result!.headers.getSetCookie().some(c=>c.startsWith('__session=') && /HttpOnly/i.test(c) && /SameSite=lax/i.test(c))).toBe(true);
 const s=await f.client.getSession(new NextRequest(f.config.appBaseUrl,{headers:{cookie:jar(f.result!)}}));
 expect(s?.b1).toMatchObject({handle:expect.stringMatching(/^[a-f0-9]{64}$/)});
 const replay=await f.client.middleware(f.request);expect(replay.status).toBe(401);expect(f.tokenCalls()).toBe(2);
});
it.each(['signature','issuer','audience','expiry','nonce','state','social'] as const)('R08 actual SDK/hook denies %s without usable session',async fault=>{
 const f=await flow(fault);
 expect(f.threw || f.result?.status===401).toBe(true);
 const cookie=f.result?jar(f.result):'';
 expect(await f.client.getSession(new NextRequest(f.config.appBaseUrl,{headers:{cookie}}))).toBeNull();
});
