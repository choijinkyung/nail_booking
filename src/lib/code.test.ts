import { describe, it, expect } from "vitest";
import { generateCode } from "./code";

describe("generateCode", () => {
  it("has the requested length and only safe chars", () => {
    const c = generateCode(6);
    expect(c).toHaveLength(6);
    expect(c).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]+$/);
  });
});
