import { it,expect,vi } from "vitest";
import { createCoreFlowClient } from "./core-flow";

// P6 + C1 step 2, PR 2: the building screen's calls. Synthetic ids and names only.
const id="00000000-0000-4000-8000-000000000001",org="00000000-0000-4000-8000-000000000002";
const info={buildingId:id,displayName:"합성 건물",serviceAddress:null,heatingType:"INDIVIDUAL",managementMode:null,demo:false,version:1,unitCount:0,editable:true};
const save={expectedVersion:0,displayName:"합성 건물",serviceAddress:null,heatingType:"INDIVIDUAL" as const,managementMode:null};

it("reads, saves and creates through the Core and B3 paths with checked bodies",async()=>{
  const transport=vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({editable:true,items:[{buildingId:id,displayName:null,unitCount:0,needsInfo:true}]}))
    .mockResolvedValueOnce(Response.json(info)).mockResolvedValueOnce(Response.json(info))
    .mockResolvedValueOnce(Response.json({id,orgId:org,addressReference:"합성 건물"},{status:201}))
    .mockResolvedValueOnce(Response.json({id,orgId:org,propertyId:id,label:"101호"},{status:201}));
  const c=createCoreFlowClient({baseUrl:"",fetchImpl:transport});
  expect(await c.buildings.list()).toEqual({editable:true,items:[{buildingId:id,displayName:null,unitCount:0,needsInfo:true}]});
  expect(await c.buildings.read(id)).toEqual(info);
  expect(await c.buildings.save(id,save)).toEqual(info);
  expect(await c.buildings.create(org,"합성 건물")).toEqual({id,orgId:org,addressReference:"합성 건물"});
  expect(await c.buildings.addUnit(org,id,"101호")).toEqual({id,orgId:org,propertyId:id,label:"101호"});
  expect(transport.mock.calls.map(([url,init])=>[init?.method,url,init?.body])).toEqual([
    ["GET","/api/v2/core/buildings",undefined],
    ["GET",`/api/v2/core/buildings/${id}`,undefined],
    ["POST",`/api/v2/core/buildings/${id}`,JSON.stringify(save)],
    ["POST",`/api/v2/organizations/${org}/properties`,JSON.stringify({addressReference:"합성 건물"})],
    ["POST",`/api/v2/organizations/${org}/properties/${id}/units`,JSON.stringify({label:"101호"})],
  ]);
});

it("refuses bodies the contracts refuse before sending, and keeps the status of a refused response",async()=>{
  const transport=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({error:"CONFLICT"}),{status:409}));
  const c=createCoreFlowClient({baseUrl:"",fetchImpl:transport});
  expect(()=>c.buildings.create(org," 앞 공백")).toThrow();
  expect(()=>c.buildings.save(id,{...save,displayName:"이름"+String.fromCodePoint(0x200b)})).toThrow();
  await expect(c.buildings.addUnit(org,id,"101호")).rejects.toMatchObject({status:409});
  expect(transport).toHaveBeenCalledTimes(1);
});

it("rejects a response outside the contract",async()=>{
  const transport=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({...info,serviceAddress:""}));
  await expect(createCoreFlowClient({baseUrl:"",fetchImpl:transport}).buildings.read(id)).rejects.toMatchObject({code:"INVALID_RESPONSE"});
});
