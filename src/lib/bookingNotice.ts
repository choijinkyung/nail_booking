import type { Locale } from "./i18n";
import { buildBookingShareText, type ShareServiceLine } from "./bookingShare";

/** 손님에게 보낼 안내의 종류. 처리 직후 무엇을 알릴지가 달라진다. */
export type NoticeKind =
  | "confirmed"
  | "changed"
  | "declined"
  | "cancelled"
  | "completed";

const HEADLINE: Record<NoticeKind, { ko: string; en: string }> = {
  confirmed: {
    ko: "예약이 확정됐어요 🎉",
    en: "Your booking is confirmed 🎉",
  },
  changed: {
    ko: "예약 시간이 변경됐어요",
    en: "Your appointment time has changed",
  },
  declined: {
    ko: "죄송해요, 요청하신 시간은 어려워요",
    en: "Sorry — that time isn't available",
  },
  cancelled: {
    ko: "예약이 취소됐어요",
    en: "Your booking has been cancelled",
  },
  // 완료 안내는 결제 문구(buildPaymentShareText)를 쓰므로 여기 값은 쓰이지 않는다.
  completed: {
    ko: "시술이 완료됐어요",
    en: "All done",
  },
};

const CLOSING: Record<NoticeKind, { ko: string; en: string }> = {
  confirmed: { ko: "", en: "" },
  changed: { ko: "", en: "" },
  declined: {
    ko: "다른 시간으로 다시 예약해주시면 감사하겠습니다.",
    en: "Please pick another time — I'd love to see you.",
  },
  cancelled: {
    ko: "다음에 또 뵈어요.",
    en: "Hope to see you next time.",
  },
  completed: { ko: "", en: "" },
};

/**
 * 예약을 처리한 직후 손님에게 그대로 보낼 안내 문구.
 *
 * 확정·시간변경은 언제/무엇을/얼마인지가 필요하므로 예약 안내 본문을 그대로
 * 쓰고, 불가·취소에는 시간표나 주소를 싣지 않는다 — 성사되지 않은 예약에
 * 집 주소를 흘릴 이유가 없다.
 */
export function buildBookingNoticeText(input: {
  kind: NoticeKind;
  shopName: string;
  locale: Locale;
  currency: string;
  location: string;
  confirmedAddress?: string;
  confirmedIso: string | null;
  preferredIso: string | null;
  services: ShareServiceLine[];
  total: number;
  message?: string;
  /** 설정에서 사장님이 직접 쓴 첫 줄. 비어 있으면 기본 문구를 쓴다. */
  headline?: string;
}): string {
  const isEn = input.locale === "en";
  const pick = (m: { ko: string; en: string }) => (isEn ? m.en : m.ko);
  const parts: string[] = [
    (input.headline ?? "").trim() || pick(HEADLINE[input.kind]),
  ];

  if (input.kind === "confirmed" || input.kind === "changed") {
    parts.push("");
    parts.push(
      buildBookingShareText({
        shopName: input.shopName,
        locale: input.locale,
        currency: input.currency,
        location: input.location,
        confirmedAddress: input.confirmedAddress,
        confirmedIso: input.confirmedIso,
        preferredIso: input.preferredIso,
        services: input.services,
        total: input.total,
      })
        // 머리글은 이미 위에 있으므로 본문의 가게 이름 줄은 뺀다.
        .split("\n")
        .slice(2)
        .join("\n"),
    );
  }

  const msg = (input.message ?? "").trim();
  if (msg) {
    parts.push("");
    parts.push(msg);
  }

  const closing = pick(CLOSING[input.kind]);
  if (closing) {
    parts.push("");
    parts.push(closing);
  }

  return parts.join("\n").trim();
}
