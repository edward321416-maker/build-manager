import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";
import { readB1AuthConfig,type B1AuthConfig } from "./config";
import { prepareTransportSession } from "./auth-transport";
import { createRemoteJWKSet,jwtVerify,customFetch as jwksFetch } from "jose";
/** Transport only. No application, authorization, or database dependency. */
export function createB1Auth0(config:B1AuthConfig,customFetch?:typeof fetch):Auth0Client {
  const keys=createRemoteJWKSet(new URL('.well-known/jwks.json',config.issuer),{timeoutDuration:5000,[jwksFetch]:customFetch});
  return new Auth0Client({
    domain:config.domain,clientId:config.clientId,clientSecret:config.clientSecret,secret:config.secret,
    appBaseUrl:config.appBaseUrl,customFetch,
    authorizationParameters:{scope:"openid",connection:"Username-Password-Authentication"},
    signInReturnToPath:"/api/v2/session/complete",
    session:{rolling:false,absoluteDuration:3600,cookie:{sameSite:"lax",secure:false,path:"/"}},
    enableAccessTokenEndpoint:false,enableConnectAccountEndpoint:false,
    beforeSessionSaved:async(session,idToken)=>{
      if(idToken!==null){
        try {
          const {payload}=await jwtVerify(idToken,keys,{issuer:config.issuer,audience:config.clientId,algorithms:['RS256']});
          if(payload.sub!==session.user.sub) throw new Error();
        } catch {throw new Error('AUTHENTICATION_REJECTED');}
      }
      return prepareTransportSession(session,idToken);
    },
    onCallback:async(error)=>error
      ? NextResponse.json({error:"AUTHENTICATION_REJECTED"},{status:401,headers:{"Cache-Control":"private, no-store"}})
      : NextResponse.redirect(new URL("/api/v2/session/complete",config.appBaseUrl)),
  });
}
let client:Auth0Client|undefined;
export function getB1Auth0():Auth0Client {return client??=createB1Auth0(readB1AuthConfig());}
