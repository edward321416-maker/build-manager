export type B1AuthConfig = Readonly<{ domain:string; issuer:string; clientId:string; clientSecret:string; secret:string; appBaseUrl:string }>;
export function readB1AuthConfig(env: Readonly<Record<string,string|undefined>> = process.env): B1AuthConfig {
  const domain=env.B1_AUTH0_DOMAIN,clientId=env.B1_AUTH0_CLIENT_ID,clientSecret=env.B1_AUTH0_CLIENT_SECRET,secret=env.B1_AUTH0_SECRET,base=env.B1_APP_BASE_URL;
  try {
    if(!domain || !/^[a-z0-9.-]+$/.test(domain) || !domain.includes('.') || !clientId || !clientSecret || !secret || !/^[a-fA-F0-9]{64}$/.test(secret) || !base) throw new Error();
    const url=new URL(base);
    if(url.protocol!=="http:" || !["localhost","127.0.0.1"].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname!=="/") throw new Error();
    return {domain,issuer:`https://${domain}/`,clientId,clientSecret,secret,appBaseUrl:url.origin};
  } catch { throw new Error("B1_CONFIGURATION_UNAVAILABLE"); }
}
