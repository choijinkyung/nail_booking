import { describe, it, expect } from "vitest";
import { slotStartsForDuration, neededSlots } from "./scheduling";

describe("slotStartsForDuration", () => {
  it("returns one slot for a 30-min service", () => {
    expect(slotStartsForDuration("2026-07-24T18:00:00.000Z", 30)).toEqual([
      "2026-07-24T18:00:00.000Z",
    ]);
  });

  it("returns consecutive 30-min starts covering a 90-min service", () => {
    expect(slotStartsForDuration("2026-07-24T18:00:00.000Z", 90)).toEqual([
      "2026-07-24T18:00:00.000Z",
      "2026-07-24T18:30:00.000Z",
      "2026-07-24T19:00:00.000Z",
    ]);
  });

  it("rounds a non-multiple duration up to whole slots", () => {
    expect(slotStartsForDuration("2026-07-24T18:00:00.000Z", 45)).toHaveLength(
      neededSlots(45),
    );
  });
});
