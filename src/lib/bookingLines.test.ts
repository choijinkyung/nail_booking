import { describe, it, expect } from "vitest";
import { buildServiceLines, lineDuration } from "./bookingLines";
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

describe("lineDuration — 단위가 있는 시술은 개수만큼 시간이 걸린다", () => {
  const flat = { unit: "flat" as const, duration_min: 90 };
  const perFinger = { unit: "per_finger" as const, duration_min: 15 };

  it("고정 단위는 개수와 무관하게 한 번치", () => {
    expect(lineDuration(flat, 1)).toBe(90);
    expect(lineDuration(flat, 3)).toBe(90);
  });

  it("손가락당 시술은 개수에 비례한다", () => {
    expect(lineDuration(perFinger, 1)).toBe(15);
    expect(lineDuration(perFinger, 5)).toBe(75);
    expect(lineDuration(perFinger, 10)).toBe(150);
  });

  it("개수가 없거나 이상하면 1개로 본다", () => {
    expect(lineDuration(perFinger, 0)).toBe(15);
    expect(lineDuration(perFinger, -2)).toBe(15);
  });
});

describe("buildServiceLines 가 개수만큼의 시간을 싣는다", () => {
  const svc = [
    {
      id: "ext",
      name_ko: "연장",
      name_en: "Extension",
      price: 6,
      price_from: false,
      unit: "per_finger" as const,
      duration_min: 15,
      description_ko: "",
      description_en: "",
      sort_order: 0,
      active: true,
      created_at: "",
    },
  ];

  it("손가락 5개면 15분 × 5 = 75분", () => {
    const lines = buildServiceLines(svc, [{ service_id: "ext", quantity: 5 }]);
    expect(lines[0].duration_min).toBe(75);
    expect(lines[0].subtotal).toBe(30);
  });
});
