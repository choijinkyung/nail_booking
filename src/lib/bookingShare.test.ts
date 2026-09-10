import { describe, expect, it } from "vitest";
import { buildBookingShareText } from "./bookingShare";

const base = {
  shopName: "Zenna Nail",
  locale: "ko" as const,
  currency: "CAD",
  location: "Surrey Central 인근",
  confirmedAddress: "",
  services: [
    {
      name_ko: "원컬러 (젤네일)",
      name_en: "One Color",
      unit: "flat" as const,
      quantity: 1,
      subtotal: 35,
    },
  ],
  total: 35,
};

describe("buildBookingShareText", () => {
  it("확정된 예약은 확정 시간을 싣는다", () => {
    const t = buildBookingShareText({
      ...base,
      confirmedIso: "2026-09-11T03:00:00.000Z", // 밴쿠버 9/10(목) 오후 8:00
      preferredIso: null,
    });
    expect(t).toContain("Zenna Nail");
    expect(t).toContain("09/10(목) 오후 8:00");
    expect(t).toContain("원컬러 (젤네일)");
    expect(t).toContain("$35");
    expect(t).toContain("Surrey Central 인근");
  });

  it("아직 확정 전이면 요청한 시간임을 밝힌다", () => {
    const t = buildBookingShareText({
      ...base,
      confirmedIso: null,
      preferredIso: "2026-09-11T03:00:00.000Z",
    });
    expect(t).toContain("요청하신 시간");
    expect(t).toContain("09/10(목) 오후 8:00");
  });

  it("시간이 아예 없으면 시간 줄을 넣지 않는다", () => {
    const t = buildBookingShareText({
      ...base,
      confirmedIso: null,
      preferredIso: null,
    });
    expect(t).not.toContain("오후");
    expect(t).toContain("원컬러 (젤네일)");
  });

  it("손가락당 시술은 개수를 붙인다", () => {
    const t = buildBookingShareText({
      ...base,
      confirmedIso: null,
      preferredIso: null,
      services: [
        {
          name_ko: "프렌치",
          name_en: "French",
          unit: "per_finger" as const,
          quantity: 3,
          subtotal: 3,
        },
      ],
      total: 3,
    });
    expect(t).toContain("프렌치 ×3");
  });

  it("시술이 여러 개면 합계 줄을 따로 넣는다", () => {
    const t = buildBookingShareText({
      ...base,
      confirmedIso: null,
      preferredIso: null,
      services: [
        { name_ko: "원컬러", name_en: "One", unit: "flat" as const, quantity: 1, subtotal: 35 },
        { name_ko: "제거", name_en: "Off", unit: "flat" as const, quantity: 1, subtotal: 5 },
      ],
      total: 40,
    });
    expect(t).toContain("합계 $40");
  });

  it("위치가 비어 있으면 위치 줄을 넣지 않는다", () => {
    const t = buildBookingShareText({
      ...base,
      confirmedIso: null,
      preferredIso: null,
      location: "",
    });
    expect(t).not.toContain("📍");
  });

  it("영어 로케일은 영어 시술명을 쓴다", () => {
    const t = buildBookingShareText({
      ...base,
      locale: "en",
      confirmedIso: null,
      preferredIso: null,
    });
    expect(t).toContain("One Color");
    expect(t).not.toContain("원컬러");
  });
});

describe("확정 손님에게 보낼 주소", () => {
  const withAddr = {
    ...base,
    confirmedAddress: "1234 Example St, Surrey BC",
    services: base.services,
  };

  it("확정된 예약에는 실제 주소를 쓴다", () => {
    const t = buildBookingShareText({
      ...withAddr,
      confirmedIso: "2026-09-11T03:00:00.000Z",
      preferredIso: null,
    });
    expect(t).toContain("1234 Example St, Surrey BC");
    expect(t).not.toContain("Surrey Central 인근");
  });

  it("아직 확정 전이면 실제 주소를 흘리지 않는다", () => {
    const t = buildBookingShareText({
      ...withAddr,
      confirmedIso: null,
      preferredIso: "2026-09-11T03:00:00.000Z",
    });
    expect(t).not.toContain("1234 Example St");
    expect(t).toContain("Surrey Central 인근");
  });

  it("확정됐지만 실제 주소를 안 적어뒀으면 대략 위치를 쓴다", () => {
    const t = buildBookingShareText({
      ...base,
      confirmedAddress: "",
      confirmedIso: "2026-09-11T03:00:00.000Z",
      preferredIso: null,
    });
    expect(t).toContain("Surrey Central 인근");
  });
});
