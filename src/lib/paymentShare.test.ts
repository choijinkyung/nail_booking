import { describe, expect, it } from "vitest";
import { buildPaymentShareText } from "./paymentShare";

const base = {
  shopName: "Zenna Nail",
  locale: "ko" as const,
  currency: "CAD",
  services: [
    { name_ko: "원컬러", name_en: "One Color", unit: "flat" as const, quantity: 1, subtotal: 35 },
  ],
  tip: 0,
  paymentText: "e-transfer로 보내주세요.",
  etransferEmail: "pay@example.com",
  etransferNote: "메시지에 성함을 적어주세요.",
};

describe("buildPaymentShareText", () => {
  it("시술과 합계를 싣는다", () => {
    const t = buildPaymentShareText(base);
    expect(t).toContain("원컬러");
    expect(t).toContain("$35");
    expect(t).toContain("합계 $35");
  });

  it("팁이 있으면 따로 적고 합계에 더한다", () => {
    const t = buildPaymentShareText({ ...base, tip: 5 });
    expect(t).toContain("팁 $5");
    expect(t).toContain("합계 $40");
  });

  it("팁이 0이면 팁 줄을 넣지 않는다", () => {
    expect(buildPaymentShareText(base)).not.toContain("팁");
  });

  it("e-transfer 주소와 안내를 싣는다", () => {
    const t = buildPaymentShareText(base);
    expect(t).toContain("pay@example.com");
    expect(t).toContain("메시지에 성함을 적어주세요.");
  });

  it("결제 안내가 비어 있으면 그 줄을 넣지 않는다", () => {
    const t = buildPaymentShareText({
      ...base,
      paymentText: "",
      etransferEmail: "",
      etransferNote: "",
    });
    expect(t).toContain("합계 $35");
    expect(t).not.toContain("undefined");
  });

  it("손가락당 시술은 개수를 붙인다", () => {
    const t = buildPaymentShareText({
      ...base,
      services: [
        { name_ko: "프렌치", name_en: "French", unit: "per_finger" as const, quantity: 3, subtotal: 3 },
      ],
    });
    expect(t).toContain("프렌치 ×3");
  });

  it("영어 로케일은 영어 시술명을 쓴다", () => {
    const t = buildPaymentShareText({ ...base, locale: "en" });
    expect(t).toContain("One Color");
    expect(t).not.toContain("원컬러");
  });
});
