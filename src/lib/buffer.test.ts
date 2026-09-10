import { describe, expect, it } from "vitest";
import { BUFFER_CHOICES, clampBuffer, occupiedMinutes } from "./buffer";

describe("occupiedMinutes — 시술시간 + 여유시간", () => {
  it("여유가 없으면 시술시간 그대로", () => {
    expect(occupiedMinutes(90, 0)).toBe(90);
  });

  it("여유를 더한다", () => {
    expect(occupiedMinutes(90, 10)).toBe(100);
    expect(occupiedMinutes(30, 15)).toBe(45);
  });

  it("음수나 이상한 값은 0으로 본다", () => {
    expect(occupiedMinutes(90, -10)).toBe(90);
    expect(occupiedMinutes(90, Number.NaN)).toBe(90);
  });
});

describe("clampBuffer — 5분 단위", () => {
  it("5분 단위로 내림", () => {
    expect(clampBuffer(12)).toBe(10);
    expect(clampBuffer(10)).toBe(10);
    expect(clampBuffer(4)).toBe(0);
  });

  it("음수는 0", () => {
    expect(clampBuffer(-5)).toBe(0);
  });

  it("너무 큰 값은 상한까지", () => {
    expect(clampBuffer(999)).toBe(120);
  });
});

describe("BUFFER_CHOICES", () => {
  it("0 부터 5분 간격으로 제공한다", () => {
    expect(BUFFER_CHOICES[0]).toBe(0);
    expect(BUFFER_CHOICES).toContain(5);
    expect(BUFFER_CHOICES).toContain(10);
    expect(BUFFER_CHOICES.every((v) => v % 5 === 0)).toBe(true);
  });
});
