import { describe, it, expect } from "vitest";
import { buildServiceLines } from "./bookingLines";
import type { Service } from "./types";

const svc = (over: Partial<Service>): Service => ({
  id: "s1", name_ko: "원컬러", name_en: "One color", price: 30, price_from: false,
  unit: "flat", duration_min: 90, description_ko: "", description_en: "",
  sort_order: 0, active: true, created_at: "",
  ...over,
});

describe("buildServiceLines", () => {
  it("snapshots price and clamps quantity", () => {
    const lines = buildServiceLines([svc({ id: "s1", price: 30 })], [
      { service_id: "s1", quantity: 99 },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(20);
    expect(lines[0].subtotal).toBe(600);
    expect(lines[0].unit_price).toBe(30);
  });

  it("drops unknown service ids", () => {
    expect(buildServiceLines([], [{ service_id: "x", quantity: 1 }])).toEqual([]);
  });
});
