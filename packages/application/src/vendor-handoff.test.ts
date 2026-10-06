import { describe,expect,expectTypeOf,it } from "vitest";
import {
  VendorHandoffError,
  assertVendorAssignmentTransition,
  reconcileVendorRequestFingerprint,
  redeemVendorSessionState,
  vendorDispositionEffect,
} from "./vendor-handoff";
import type {
  ManagerVendorHandoffDto,
  SanitizedVendorPhoto,
  TenantVendorSchedulingDto,
  VendorCompletionPhotoDto,
  VendorCreateAssignmentCommand,
  VendorHandoffExternalPort,
  VendorHandoffManagerPort,
  VendorHandoffTenantPort,
  VendorJobDto,
  VendorLinkIssueDto,
  VendorSessionDto,
} from "./vendor-handoff";

describe("Vendor application invariants",()=>{
  it("keeps redemption separate from acceptance",()=>{
    expect(redeemVendorSessionState("OFFERED")).toBe("OFFERED");
    expect(redeemVendorSessionState("ACTIVE")).toBe("ACTIVE");
    expect(()=>redeemVendorSessionState("PREPARING")).toThrowError(VendorHandoffError);
    expect(()=>redeemVendorSessionState("ENDED")).toThrowError(VendorHandoffError);
  });

  it("keeps report correction, more work and closeout as distinct effects",()=>{
    expect(vendorDispositionEffect("REQUEST_CORRECTION")).toBe("REPORT_CORRECTION");
    expect(vendorDispositionEffect("MORE_WORK")).toBe("FOLLOW_UP_WORK");
    expect(vendorDispositionEffect("CLOSEOUT")).toBe("CLOSEOUT");
  });

  it("conflicts when an idempotency key is replayed with a changed fingerprint",()=>{
    expect(reconcileVendorRequestFingerprint("same","same")).toBe("same");
    expect(()=>reconcileVendorRequestFingerprint("same","changed")).toThrowError(
      expect.objectContaining({code:"STATE_CONFLICT"}),
    );
  });

  it("allows only the frozen assignment transition vocabulary",()=>{
    expect(()=>assertVendorAssignmentTransition("PREPARING","OFFERED",null)).not.toThrow();
    expect(()=>assertVendorAssignmentTransition("OFFERED","ACTIVE",null)).not.toThrow();
    expect(()=>assertVendorAssignmentTransition("OFFERED","ENDED","DECLINED")).not.toThrow();
    expect(()=>assertVendorAssignmentTransition("ACTIVE","ENDED","WITHDRAWN")).not.toThrow();
    expect(()=>assertVendorAssignmentTransition("ACTIVE","ENDED","CLOSED")).not.toThrow();
    for(const args of [
      ["PREPARING","ACTIVE",null],
      ["ACTIVE","OFFERED",null],
      ["ENDED","ACTIVE",null],
      ["OFFERED","ENDED",null],
      ["ACTIVE","ENDED",null],
      ["PREPARING","OFFERED","REVOKED"],
    ] as const) expect(()=>assertVendorAssignmentTransition(...args)).toThrowError(
      expect.objectContaining({code:"STATE_CONFLICT"}),
    );
  });
});

describe("Vendor application port authority signatures",()=>{
  it("requires request-scoped digests for Manager and Tenant methods",()=>{
    expectTypeOf<VendorHandoffManagerPort["readHandoff"]>().parameters.toEqualTypeOf<[string,string]>();
    expectTypeOf<VendorHandoffManagerPort["createAssignment"]>().parameters.toEqualTypeOf<[string,string,VendorCreateAssignmentCommand]>();
    expectTypeOf<VendorHandoffManagerPort["readHandoff"]>().returns.resolves.toEqualTypeOf<ManagerVendorHandoffDto>();
    expectTypeOf<VendorHandoffTenantPort["readScheduling"]>().parameters.toEqualTypeOf<[string,string]>();
    expectTypeOf<VendorHandoffTenantPort["readScheduling"]>().returns.resolves.toEqualTypeOf<TenantVendorSchedulingDto>();
  });

  it("keeps the external capability session distinct from B1 authority",()=>{
    expectTypeOf<VendorHandoffExternalPort["session"]>().parameters.toEqualTypeOf<[string]>();
    expectTypeOf<VendorHandoffExternalPort["session"]>().returns.resolves.toEqualTypeOf<VendorSessionDto>();
    expectTypeOf<VendorHandoffExternalPort["readJob"]>().parameters.toEqualTypeOf<[string]>();
    expectTypeOf<VendorHandoffExternalPort["readJob"]>().returns.resolves.toEqualTypeOf<VendorJobDto>();
    expectTypeOf<VendorHandoffExternalPort["redeem"]>().parameters.toEqualTypeOf<[string,string,string,string]>();
    expectTypeOf<VendorHandoffExternalPort["redeem"]>().returns.resolves.toEqualTypeOf<VendorSessionDto>();
  });

  it("pins transient link and sanitized photo boundaries",()=>{
    expectTypeOf<VendorHandoffManagerPort["issueLink"]>().returns.resolves.toEqualTypeOf<VendorLinkIssueDto>();
    expectTypeOf<VendorHandoffManagerPort["completionPhoto"]>().returns.resolves.toEqualTypeOf<{photo:VendorCompletionPhotoDto;bytes:Uint8Array}>();
    expectTypeOf<SanitizedVendorPhoto>().toMatchTypeOf<{
      bytes:Uint8Array;mime:"image/jpeg"|"image/png";byteSize:number;width:number;height:number;sha256:string;
    }>();
  });
});
