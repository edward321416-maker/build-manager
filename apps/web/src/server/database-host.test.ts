import { expect,it } from "vitest";
import { databaseHostAllowed } from "./database-host";

it("allows loopback databases and remote databases only with verified TLS",()=>{
  for(const host of ["127.0.0.1","localhost","::1"])expect(databaseHostAllowed({host})).toBe(true);
  expect(databaseHostAllowed({host:"ep-demo.ap-southeast-1.aws.neon.tech",ssl:true})).toBe(true);
  expect(databaseHostAllowed({host:"ep-demo.ap-southeast-1.aws.neon.tech",ssl:{rejectUnauthorized:true}})).toBe(true);
  // Hosted demo: the provider's private service network is not reachable from the Internet.
  expect(databaseHostAllowed({host:"postgres.railway.internal"})).toBe(true);
  for(const host of ["railway.internal","postgres.railway.internal.evil.example","postgres.railway.internal.","a.b.railway.internal","postgres.up.railway.app"])
    expect(databaseHostAllowed({host}),host).toBe(false);
  for(const config of [{host:"db.internal"},{host:"db.internal",ssl:false},{host:"db.internal",ssl:{rejectUnauthorized:false}},{host:"db.internal",ssl:"require"},{host:""},{host:undefined}])
    expect(databaseHostAllowed(config),JSON.stringify(config)).toBe(false);
});
