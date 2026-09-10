import { describe, expect, it } from "vitest";
import { buildBookingNoticeText } from "./bookingNotice";

const base = {
  shopName: "Zenna Nail",
  locale: "ko" as const,
  currency: "CAD",
  location: "Surrey Central 인근",
  confirmedAddress: "1234 Example St",
  confirmedIso: "2026-09-11T03:00:00.000Z", // 밴쿠버 9/10(목) 오후 8:00
  preferredIso: null,
  services: [
    { name_ko: "원컬러", name_en: "One Color", unit: "flat" as const, quantity: 1, subtotal: 35 },
  ],
  total: 35,
  message: "",
};

describe("buildBookingNoticeText", () => {
  it("확정 안내는 확정 문구와 시간·주소를 싣는다", () => {
    const t = buildBookingNoticeText({ ...base, kind: "confirmed" });
    expect(t).toContain("확정");
    expect(t).toContain("09/10(목) 오후 8:00");
    expect(t).toContain("1234 Example St");
  });

  it("시간 변경 안내는 바뀐 시간을 싣는다", () => {
    const t = buildBookingNoticeText({ ...base, kind: "changed" });
    expect(t).toContain("변경");
    expect(t).toContain("09/10(목) 오후 8:00");
  });

  it("취소 안내에는 주소를 넣지 않는다", () => {
    const t = buildBookingNoticeText({ ...base, kind: "cancelled" });
    expect(t).toContain("취소");
    expect(t).not.toContain("1234 Example St");
    expect(t).not.toContain("$35");
  });

  it("불가 안내도 주소를 넣지 않는다", () => {
    const t = buildBookingNoticeText({ ...base, kind: "declined" });
    expect(t).not.toContain("1234 Example St");
  });

  it("사장님 메시지가 있으면 함께 싣는다", () => {
    const t = buildBookingNoticeText({
      ...base,
      kind: "declined",
      message: "그날은 샵 근무가 있어요.",
    });
    expect(t).toContain("그날은 샵 근무가 있어요.");
  });

  it("영어 로케일", () => {
    const t = buildBookingNoticeText({ ...base, locale: "en", kind: "confirmed" });
    expect(t).toContain("confirmed");
    expect(t).toContain("One Color");
  });
});
