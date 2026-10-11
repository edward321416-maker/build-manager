import { describe,expect,it } from "vitest";
import { evidenceStage } from "./evidence-stage";

// P1b review: the intake's own ticket decides at once whether a request was sent, before the screen re-reads its events.
const packet={revision:1,summary:"누수 접수 건입니다.",safetyEscalated:false};

describe("evidenceStage",()=>{
  it("lets a request that was never sent pick its photos",()=>{
    expect(evidenceStage({packet:null,status:"IN_PROGRESS"},false)).toBe("STEP");
  });

  it("keeps a request sent without its photos as sent, from the moment the intake holds the sent ticket (spec D5)",()=>{
    expect(evidenceStage({packet,status:"PARTIAL"},false)).toBe("SENT");
    expect(evidenceStage({packet,status:"PARTIAL"},true)).toBe("SENT");
  });

  it("lets a sent request that was reopened another way be submitted again",()=>{
    expect(evidenceStage({packet,status:"IN_PROGRESS"},true)).toBe("SUBMIT");
    expect(evidenceStage({packet:null,status:"IN_PROGRESS"},true)).toBe("SUBMIT");
  });
});
