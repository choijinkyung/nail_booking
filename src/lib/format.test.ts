import { describe, expect, it } from "vitest";
import { formatDateHeading, formatDateTime, formatTimeOnly } from "./format";

// 2026-09-13T17:00Z = 밴쿠버 9월 13일(일요일) 오전 10:00
const SUN_10AM = "2026-09-13T17:00:00.000Z";
// 2026-09-14T03:00Z = 밴쿠버 9월 13일(일요일) 오후 8:00
const SUN_8PM = "2026-09-14T03:00:00.000Z";

describe("formatTimeOnly", () => {
  it("오전 시각을 '오전'으로 쓴다", () => {
    expect(formatTimeOnly(SUN_10AM, "ko")).toBe("오전 10:00");
  });

  it("오후 시각을 '오후'로 쓴다", () => {
    expect(formatTimeOnly(SUN_8PM, "ko")).toBe("오후 8:00");
  });

  it("영어는 AM/PM", () => {
    expect(formatTimeOnly(SUN_10AM, "en")).toBe("10:00 AM");
    expect(formatTimeOnly(SUN_8PM, "en")).toBe("8:00 PM");
  });
});

describe("formatDateHeading", () => {
  it("밴쿠버 기준 요일을 쓴다 (UTC 날짜로 밀리지 않는다)", () => {
    expect(formatDateHeading(SUN_10AM, "ko")).toBe("2026. 09. 13 (일)");
    expect(formatDateHeading(SUN_8PM, "ko")).toBe("2026. 09. 13 (일)");
  });

  it("영어 요일도 같은 날을 가리킨다", () => {
    expect(formatDateHeading(SUN_10AM, "en")).toBe("Sun, 09/13/2026");
  });
});

describe("formatDateTime", () => {
  it("요일과 오전/오후가 모두 맞다", () => {
    expect(formatDateTime(SUN_10AM, "ko")).toBe("09/13(일) 오전 10:00");
    expect(formatDateTime(SUN_8PM, "ko")).toBe("09/13(일) 오후 8:00");
  });

  it("영어 표기", () => {
    expect(formatDateTime(SUN_10AM, "en")).toBe("Sun 09/13 10:00 AM");
  });
});
