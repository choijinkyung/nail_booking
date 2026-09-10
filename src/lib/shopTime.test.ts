import { describe, expect, it } from "vitest";
import { shopOffsetMinutes, shopWallClock, wallClockToIso } from "./shopTime";

const at = (iso: string) => new Date(iso);

describe("shopOffsetMinutes — 밴쿠버 표준/서머 시간", () => {
  it("한여름은 PDT (UTC-7)", () => {
    expect(shopOffsetMinutes(at("2026-07-15T12:00:00Z"))).toBe(-420);
  });

  it("한겨울은 PST (UTC-8)", () => {
    expect(shopOffsetMinutes(at("2026-01-15T12:00:00Z"))).toBe(-480);
  });

  it("서머타임 시작은 3월 두 번째 일요일 10:00 UTC", () => {
    // 2026-03-08
    expect(shopOffsetMinutes(at("2026-03-08T09:59:00Z"))).toBe(-480);
    expect(shopOffsetMinutes(at("2026-03-08T10:00:00Z"))).toBe(-420);
  });

  it("서머타임 종료는 11월 첫 일요일 09:00 UTC", () => {
    // 2026-11-01
    expect(shopOffsetMinutes(at("2026-11-01T08:59:00Z"))).toBe(-420);
    expect(shopOffsetMinutes(at("2026-11-01T09:00:00Z"))).toBe(-480);
  });

  it("연도가 달라도 규칙대로 (2027)", () => {
    // 2027 시작 3/14, 종료 11/7
    expect(shopOffsetMinutes(at("2027-03-14T10:00:00Z"))).toBe(-420);
    expect(shopOffsetMinutes(at("2027-11-07T09:00:00Z"))).toBe(-480);
  });
});

describe("wallClockToIso — 가게 벽시계 → UTC", () => {
  it("여름 10:00 은 17:00Z", () => {
    expect(wallClockToIso("2026-07-15", 600)).toBe("2026-07-15T17:00:00.000Z");
  });

  it("겨울 10:00 은 18:00Z", () => {
    expect(wallClockToIso("2026-12-15", 600)).toBe("2026-12-15T18:00:00.000Z");
  });

  it("서머타임 종료 당일 10:00 도 18:00Z (이미 표준시)", () => {
    expect(wallClockToIso("2026-11-01", 600)).toBe("2026-11-01T18:00:00.000Z");
  });

  it("서머타임 종료 다음 수요일도 18:00Z", () => {
    expect(wallClockToIso("2026-11-04", 600)).toBe("2026-11-04T18:00:00.000Z");
  });
});

describe("shopWallClock — UTC → 가게 벽시계", () => {
  it("11/01 18:00Z 는 오전 10시", () => {
    const w = shopWallClock(at("2026-11-01T18:00:00Z"));
    expect(w.hour).toBe(10);
    expect(w.minute).toBe(0);
    expect(w.month).toBe(11);
    expect(w.day).toBe(1);
    expect(w.weekday).toBe(0); // 일요일
  });

  it("자정을 넘겨 날짜가 바뀌는 경우", () => {
    // 2026-11-02T03:00Z = 11/01 19:00 PST
    const w = shopWallClock(at("2026-11-02T03:00:00Z"));
    expect(w.day).toBe(1);
    expect(w.hour).toBe(19);
  });
});
