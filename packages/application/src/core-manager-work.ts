// Separate from CoreRecord and tenant-visible protocol/shared-event contracts.
export type CoreManagerWorkItem={
  ticketId:string;unitId:string;buildingId:string;buildingName:string;unitLabel:string;
  issueType:"HEATING"|"LEAK";workStatus:"OPEN"|"IN_PROGRESS"|"COMPLETED";
  priority:"NORMAL"|"HIGH"|"URGENT";assigneeLabel:string|null;dueAt:string|null;
  createdAt:string;updatedAt:string;version:number;
};
export type CoreManagerWorkUpdate=Pick<CoreManagerWorkItem,"priority"|"assigneeLabel"|"dueAt">&{expectedVersion:number};
export type CoreManagerInternalNote={id:string;body:string;createdAt:string};
export type CoreManagerScope={
  list():Promise<CoreManagerWorkItem[]>;
  read(id:string):Promise<CoreManagerWorkItem>;
  update(id:string,input:CoreManagerWorkUpdate):Promise<CoreManagerWorkItem>;
  notes(id:string):Promise<CoreManagerInternalNote[]>;
  appendNote(id:string,body:string):Promise<CoreManagerInternalNote>;
};
