import { expect,it } from "vitest";
import { CoreManagerWorkUpdateSchema,CoreManagerInternalNoteCreateSchema } from "./core-manager-work";
it("accepts explicit offset times and null metadata while rejecting private authority injection",()=>{
 const value={priority:"NORMAL",assigneeLabel:null,dueAt:null,expectedVersion:1};expect(CoreManagerWorkUpdateSchema.parse(value)).toEqual(value);
 for(const x of [{...value,actorId:"caller"},{...value,orgId:"org"},{...value,dueAt:"2026-10-04T09:00:00"},{...value,expectedVersion:1.2},{...value,assigneeLabel:"a\u202Eb"}])expect(CoreManagerWorkUpdateSchema.safeParse(x).success).toBe(false);
 expect(CoreManagerWorkUpdateSchema.parse({...value,assigneeLabel:" 합성 담당 ",dueAt:"2026-10-04T09:00:00+09:00"}).assigneeLabel).toBe("합성 담당");
});
it("accepts safe multiline notes but no control characters or editable note IDs",()=>{
 expect(CoreManagerInternalNoteCreateSchema.parse({body:"  합성\r\n메모  "})).toEqual({body:"합성\r\n메모"});
 for(const body of [" ","a\tb","a\u0007b","a\u202Eb","x".repeat(2001)])expect(CoreManagerInternalNoteCreateSchema.safeParse({body}).success).toBe(false);
 expect(CoreManagerInternalNoteCreateSchema.safeParse({body:"합성 메모",id:"1"}).success).toBe(false);
});
