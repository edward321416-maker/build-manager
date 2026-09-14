import { describe, expect, it } from "vitest";
import {
  representativeBuilding,
  representativeTicket,
} from "../testing/aggregates";
import {
  PERSISTED_AGGREGATE_VERSION,
  decodeBuilding,
  decodeTicket,
  encodeBuilding,
  encodeTicket,
} from "./codecs";

describe("building codec", () => {
  it("round-trips a representative building", () => {
    const row = encodeBuilding(representativeBuilding);

    expect(decodeBuilding(row)).toEqual(representativeBuilding);
  });

  it("preserves verified routing-eligible context exactly", () => {
    const decoded = decodeBuilding(encodeBuilding(representativeBuilding));

    expect(
      decoded.context.filter((entry) => entry.routingEligible && entry.verified),
    ).toEqual([
      representativeBuilding.context[1],
      representativeBuilding.context[2],
    ]);
  });

  it("stamps the current aggregate version and the row key", () => {
    const row = encodeBuilding(representativeBuilding);

    expect(row.id).toBe("demo-building-a");
    expect(row.aggregate_version).toBe(PERSISTED_AGGREGATE_VERSION);
    expect(typeof row.aggregate_json).toBe("string");
  });
});

describe("ticket codec", () => {
  it("round-trips a representative ticket", () => {
    expect(decodeTicket(encodeTicket(representativeTicket))).toEqual(
      representativeTicket,
    );
  });

  it("preserves the repair packet revision, recommendation, and human decision", () => {
    const decoded = decodeTicket(encodeTicket(representativeTicket));

    expect(decoded.repairPacket?.revision).toBe(3);
    expect(decoded.repairPacket?.recommendation?.primary).toBe("LANDLORD_REVIEW");
    expect(decoded.repairPacket?.contextSnapshot.routingBasis).toHaveLength(1);
    expect(decoded.routeDecision).toEqual(representativeTicket.routeDecision);
    expect(decoded.evidence).toEqual(representativeTicket.evidence);
  });

  it("carries no value that JSON cannot represent", () => {
    const row = encodeTicket(representativeTicket);

    expect(JSON.parse(row.aggregate_json)).toEqual(
      JSON.parse(JSON.stringify(representativeTicket)),
    );
  });
});

describe("corruption is rejected rather than cast away", () => {
  it("rejects a row whose JSON does not parse", () => {
    expect(() =>
      decodeBuilding({
        id: "demo-building-a",
        aggregate_version: PERSISTED_AGGREGATE_VERSION,
        aggregate_json: "{not json",
      }),
    ).toThrowError(/json/i);
  });

  it("rejects an unsupported aggregate version", () => {
    const row = encodeBuilding(representativeBuilding);

    expect(() =>
      decodeBuilding({ ...row, aggregate_version: 99 }),
    ).toThrowError(/aggregate version/i);
  });

  it("rejects a building row whose key disagrees with the stored aggregate", () => {
    const row = encodeBuilding(representativeBuilding);

    expect(() => decodeBuilding({ ...row, id: "demo-building-b" })).toThrowError(
      /corrupt/i,
    );
  });

  it("rejects a ticket row whose key disagrees with the stored aggregate", () => {
    const row = encodeTicket(representativeTicket);

    expect(() => decodeTicket({ ...row, id: "ticket-b" })).toThrowError(/corrupt/i);
  });

  it("rejects a structurally invalid building aggregate", () => {
    expect(() =>
      decodeBuilding({
        id: "demo-building-a",
        aggregate_version: PERSISTED_AGGREGATE_VERSION,
        aggregate_json: JSON.stringify({ id: "demo-building-a" }),
      }),
    ).toThrowError(/building/i);
  });

  it("rejects a structurally invalid ticket aggregate", () => {
    expect(() =>
      decodeTicket({
        id: "ticket-a",
        aggregate_version: PERSISTED_AGGREGATE_VERSION,
        aggregate_json: JSON.stringify({ id: "ticket-a", answers: "nope" }),
      }),
    ).toThrowError(/ticket/i);
  });

  it("rejects a JSON scalar where an aggregate object is expected", () => {
    expect(() =>
      decodeBuilding({
        id: "demo-building-a",
        aggregate_version: PERSISTED_AGGREGATE_VERSION,
        aggregate_json: '"just a string"',
      }),
    ).toThrowError(/building/i);
  });
});
