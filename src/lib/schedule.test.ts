import { describe, expect, it } from "vitest";
import { dayKeysFrom, plannedSlots, weekdayOf, zonedIso } from "./schedule";

describe("zonedIso — 밴쿠버 벽시계 시각 → UTC", () => {
  it("summer (PDT, UTC-7)", () => {
    expect(zonedIso("2026-07-15", 10 * 60)).toBe("2026-07-15T17:00:00.000Z");
  });

  it("winter (PST, UTC-8)", () => {
    expect(zonedIso("2026-12-15", 10 * 60)).toBe("2026-12-15T18:00:00.000Z");
  });

  it("서머타임 시작일 이후에도 벽시계 10시는 10시다", () => {
    // 2026-03-08 02:00 에 PST→PDT 전환
    expect(zonedIso("2026-03-07", 10 * 60)).toBe("2026-03-07T18:00:00.000Z");
    expect(zonedIso("2026-03-09", 10 * 60)).toBe("2026-03-09T17:00:00.000Z");
  });
});

describe("weekdayOf", () => {
  it("0=일 … 6=토", () => {
    expect(weekdayOf("2026-09-09")).toBe(3); // 수요일
    expect(weekdayOf("2026-09-13")).toBe(0); // 일요일
    expect(weekdayOf("2026-09-12")).toBe(6); // 토요일
  });
});

describe("dayKeysFrom", () => {
  it("오늘 포함 N일치", () => {
    expect(dayKeysFrom("2026-09-09", 3)).toEqual([
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
    ]);
  });

  it("월말을 넘어간다", () => {
    expect(dayKeysFrom("2026-09-30", 2)).toEqual(["2026-09-30", "2026-10-01"]);
  });
});

const MON_FRI = [
  { weekday: 0, enabled: false, start_min: 600, end_min: 1200 },
  { weekday: 1, enabled: true, start_min: 600, end_min: 720 }, // 10:00-12:00
  { weekday: 2, enabled: true, start_min: 600, end_min: 720 },
  { weekday: 3, enabled: true, start_min: 600, end_min: 720 },
  { weekday: 4, enabled: true, start_min: 600, end_min: 720 },
  { weekday: 5, enabled: true, start_min: 600, end_min: 720 },
  { weekday: 6, enabled: false, start_min: 600, end_min: 1200 },
];

describe("plannedSlots", () => {
  it("영업하는 요일에만 30분 간격으로, 종료시간은 제외", () => {
    // 2026-09-09(수) 하루만
    const out = plannedSlots({
      todayDayKey: "2026-09-09",
      windowDays: 1,
      hours: MON_FRI,
      daysOff: [],
    });
    expect(out).toEqual([
      "2026-09-09T17:00:00.000Z", // 10:00
      "2026-09-09T17:30:00.000Z", // 10:30
      "2026-09-09T18:00:00.000Z", // 11:00
      "2026-09-09T18:30:00.000Z", // 11:30
    ]);
  });

  it("휴무 요일은 건너뛴다", () => {
    // 2026-09-12(토) ~ 09-13(일) 둘 다 비활성
    const out = plannedSlots({
      todayDayKey: "2026-09-12",
      windowDays: 2,
      hours: MON_FRI,
      daysOff: [],
    });
    expect(out).toEqual([]);
  });

  it("지정 휴무일은 제외한다", () => {
    const withOff = plannedSlots({
      todayDayKey: "2026-09-09",
      windowDays: 2,
      hours: MON_FRI,
      daysOff: ["2026-09-10"],
    });
    expect(withOff.every((iso) => iso.startsWith("2026-09-09"))).toBe(true);
  });

  it("설정이 없는 요일은 영업하지 않는 것으로 본다", () => {
    const out = plannedSlots({
      todayDayKey: "2026-09-09",
      windowDays: 1,
      hours: [],
      daysOff: [],
    });
    expect(out).toEqual([]);
  });

  it("종료가 시작보다 이르면 그 요일은 만들지 않는다", () => {
    const out = plannedSlots({
      todayDayKey: "2026-09-09",
      windowDays: 1,
      hours: [{ weekday: 3, enabled: true, start_min: 720, end_min: 600 }],
      daysOff: [],
    });
    expect(out).toEqual([]);
  });

  it("결과는 시간순 정렬이고 중복이 없다", () => {
    const out = plannedSlots({
      todayDayKey: "2026-09-09",
      windowDays: 14,
      hours: MON_FRI,
      daysOff: [],
    });
    expect(out).toEqual([...out].sort());
    expect(new Set(out).size).toBe(out.length);
  });
});
