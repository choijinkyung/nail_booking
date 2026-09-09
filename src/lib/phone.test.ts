import { describe, expect, it } from "vitest";
import { normalizePhone, samePhone } from "./phone";

describe("normalizePhone", () => {
  it("keeps only digits", () => {
    expect(normalizePhone("604-123-4567")).toBe("6041234567");
    expect(normalizePhone("(604) 123 4567")).toBe("6041234567");
    expect(normalizePhone("604.123.4567")).toBe("6041234567");
  });

  it("drops a North American country code", () => {
    expect(normalizePhone("+1 604 123 4567")).toBe("6041234567");
    expect(normalizePhone("16041234567")).toBe("6041234567");
  });

  it("drops a Korean country code and the trunk zero", () => {
    // +82 10-1234-5678 은 국내 표기 010-1234-5678 과 같은 번호다
    expect(normalizePhone("+82 10-1234-5678")).toBe("01012345678");
    expect(normalizePhone("010-1234-5678")).toBe("01012345678");
  });

  it("leaves other inputs as their digits", () => {
    expect(normalizePhone("1234")).toBe("1234");
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone("   ")).toBe("");
  });

  it("ignores a kakao id or anything with no digits", () => {
    expect(normalizePhone("zenna_nail")).toBe("");
  });
});

describe("samePhone", () => {
  it("matches the same number written differently", () => {
    expect(samePhone("604-123-4567", "+1 (604) 123-4567")).toBe(true);
    expect(samePhone("010 1234 5678", "+82 10 1234 5678")).toBe(true);
  });

  it("does not match different numbers", () => {
    expect(samePhone("6041234567", "6041234568")).toBe(false);
  });

  it("never matches when either side has no digits", () => {
    expect(samePhone("", "")).toBe(false);
    expect(samePhone("zenna", "zenna")).toBe(false);
  });
});
