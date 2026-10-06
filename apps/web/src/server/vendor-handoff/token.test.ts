import { createHash } from "node:crypto";
import { describe,expect,it } from "vitest";
import { VendorHandoffError } from "@build-manager/application";
import { capabilityFromAuthorization,clearVendorSessionCookie,createVendorSecret,readVendorSessionCookie,vendorSecretDigest,vendorSessionCookie,VENDOR_SESSION_COOKIE } from "./token";

const sha=(value:string)=>createHash("sha256").update(value).digest("hex");
const synthetic=(seed:string)=>createHash("sha256").update(seed).digest("base64url");
const leaks=(text:string,raw:string)=>text.includes(raw);

describe("Vendor transient secret material",()=>{
  it("draws 256-bit base64url secrets and stores only their SHA-256 digest",()=>{
    const drawn=Array.from({length:64},()=>createVendorSecret());
    for(const secret of drawn){
      expect(/^[A-Za-z0-9_-]{43}$/.test(secret.raw)).toBe(true);
      expect(Buffer.from(secret.raw,"base64url").byteLength).toBe(32);
      expect(secret.digest).toBe(sha(secret.raw));
      expect(secret.digest===secret.raw).toBe(false);
    }
    expect(new Set(drawn.map(x=>x.raw)).size).toBe(drawn.length);
  });
  it("derives the same digest scheme the Manager link issuer stores",()=>{
    const raw=synthetic("capability");
    expect(vendorSecretDigest(raw)).toBe(sha(raw));
  });
  it.each(["","short","x".repeat(44),synthetic("a").slice(0,42)+"=","a b".padEnd(43,"c"),synthetic("p")+"\n"])("rejects malformed raw material without echoing it (%#)",raw=>{
    let caught:unknown;
    try{vendorSecretDigest(raw);}catch(error){caught=error;}
    expect(caught instanceof VendorHandoffError&&caught.code==="UNAUTHENTICATED").toBe(true);
    const text=caught instanceof Error?`${caught.message}\n${caught.stack??""}`:"";
    expect(raw.length>0&&leaks(text,raw)).toBe(false);
  });
});

describe("Vendor session cookie",()=>{
  const now=new Date("2026-10-07T00:00:00.000Z");
  it("is HttpOnly, Strict, host-only and scoped to the Vendor API path",()=>{
    const raw=synthetic("session");
    const cookie=vendorSessionCookie(raw,new Date(now.getTime()+7*86_400_000).toISOString(),now,false);
    expect(cookie.startsWith(`${VENDOR_SESSION_COOKIE}=`)).toBe(true);
    for(const part of ["HttpOnly","SameSite=Strict","Path=/api/v2/vendor","Max-Age=604800"])expect(cookie.split("; ")).toContain(part);
    expect(/Domain=/i.test(cookie)).toBe(false);
    expect(/;\s*Secure/i.test(cookie)).toBe(false);
    expect(vendorSessionCookie(raw,new Date(now.getTime()+1000).toISOString(),now,true).split("; ")).toContain("Secure");
  });
  it("never outlives the absolute session expiry",()=>{
    const raw=synthetic("session");
    expect(vendorSessionCookie(raw,new Date(now.getTime()+1500).toISOString(),now,false).split("; ")).toContain("Max-Age=1");
    expect(vendorSessionCookie(raw,new Date(now.getTime()-1).toISOString(),now,false).split("; ")).toContain("Max-Age=0");
    expect(()=>vendorSessionCookie(raw,"not-a-date",now,false)).toThrow();
  });
  it("clears with the same path and attributes",()=>{
    const cleared=clearVendorSessionCookie(true).split("; ");
    expect(cleared[0]).toBe(`${VENDOR_SESSION_COOKIE}=`);
    for(const part of ["HttpOnly","SameSite=Strict","Path=/api/v2/vendor","Max-Age=0","Secure"])expect(cleared).toContain(part);
  });
  it("reads only one exact well-formed session cookie",()=>{
    const raw=synthetic("session");
    expect(readVendorSessionCookie(`a=1; ${VENDOR_SESSION_COOKIE}=${raw}; b=2`)).toBe(raw);
    expect(readVendorSessionCookie(null)).toBeNull();
    expect(readVendorSessionCookie(`x${VENDOR_SESSION_COOKIE}=${raw}`)).toBeNull();
    expect(readVendorSessionCookie(`${VENDOR_SESSION_COOKIE}=short`)).toBeNull();
    expect(readVendorSessionCookie(`${VENDOR_SESSION_COOKIE}=${raw}; ${VENDOR_SESSION_COOKIE}=${synthetic("other")}`)).toBeNull();
  });
});

describe("capability presentation",()=>{
  it("accepts only the explicit VendorCapability authorization scheme",()=>{
    const raw=synthetic("capability");
    expect(capabilityFromAuthorization(`VendorCapability ${raw}`)).toBe(raw);
    for(const header of [null,"",raw,`Bearer ${raw}`,`VendorCapability  ${raw}`,`VendorCapability ${raw} extra`,`VendorCapability short`])expect(capabilityFromAuthorization(header)).toBeNull();
  });
});
