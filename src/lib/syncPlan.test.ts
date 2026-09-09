import { describe, expect, it } from "vitest";
import { instantKey, syncPlan } from "./schedule";

// DB(PostgREST)는 "2026-09-09T23:00:00+00:00", JS toISOString() 은
// "2026-09-09T23:00:00.000Z" 를 준다. 같은 시각이지만 문자열이 다르다.
const DB = "2026-09-09T23:00:00+00:00";
const JS = "2026-09-09T23:00:00.000Z";

describe("instantKey", () => {
  it("표기가 달라도 같은 시각이면 같은 키", () => {
    expect(instantKey(DB)).toBe(instantKey(JS));
  });

  it("다른 시각은 다른 키", () => {
    expect(instantKey(JS)).not.toBe(instantKey("2026-09-09T23:30:00.000Z"));
  });
});

const gen = (id: string, starts_at: string) => ({
  id,
  starts_at,
  status: "open",
  generated: true,
});

describe("syncPlan", () => {
  it("표기만 다른 같은 시각은 유지하고 다시 만들지 않는다", () => {
    const out = syncPlan({
      planned: [JS],
      existing: [gen("a", DB)],
      heldSlotIds: [],
    });
    expect(out.removeIds).toEqual([]);
    expect(out.createIsos).toEqual([]);
  });

  it("계획에 없는 자동생성 빈 슬롯은 지운다", () => {
    const out = syncPlan({
      planned: [],
      existing: [gen("a", DB)],
      heldSlotIds: [],
    });
    expect(out.removeIds).toEqual(["a"]);
  });

  it("계획에 있는데 없는 시각은 만든다", () => {
    const out = syncPlan({ planned: [JS], existing: [], heldSlotIds: [] });
    expect(out.createIsos).toEqual([JS]);
  });

  it("예약됨/차단됨/수동 추가 슬롯은 절대 지우지 않는다", () => {
    const out = syncPlan({
      planned: [],
      existing: [
        { id: "booked", starts_at: DB, status: "booked", generated: true },
        { id: "blocked", starts_at: DB, status: "blocked", generated: true },
        { id: "manual", starts_at: DB, status: "open", generated: false },
      ],
      heldSlotIds: [],
    });
    expect(out.removeIds).toEqual([]);
  });

  it("확인 대기 예약이 잡고 있는 슬롯은 계획에 없어도 지키지 않는다면 안 된다", () => {
    // 손님이 요청해 둔 시간은 아직 open 이지만, 지우면 그 예약을 확정할 수 없게 된다.
    const out = syncPlan({
      planned: [],
      existing: [gen("held", DB)],
      heldSlotIds: ["held"],
    });
    expect(out.removeIds).toEqual([]);
  });

  it("이미 그 시각에 예약된 슬롯이 있으면 새로 만들지 않는다", () => {
    const out = syncPlan({
      planned: [JS],
      existing: [
        { id: "b", starts_at: DB, status: "booked", generated: false },
      ],
      heldSlotIds: [],
    });
    expect(out.createIsos).toEqual([]);
  });
});
