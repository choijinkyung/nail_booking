import type { Locale } from "./i18n";
import type { ServiceUnit } from "./types";
import { formatDateTime, formatMoney } from "./format";

export interface ShareServiceLine {
  name_ko: string;
  name_en: string;
  unit: ServiceUnit;
  quantity: number;
  subtotal: number;
}

/**
 * 관리자가 손님에게 보내는 예약 안내 문구.
 *
 * 카카오톡·문자로 그대로 붙는 글이라, 화면과 달리 이모지를 줄머리로 쓴다 —
 * 대화창에서는 장식이 아니라 훑어보기 위한 표식이다.
 * 링크는 navigator.share 가 따로 붙이므로 여기에 넣지 않는다.
 */
export function buildBookingShareText(input: {
  shopName: string;
  locale: Locale;
  currency: string;
  location: string;
  /** 확정된 손님에게만 보낼 실제 주소. 비어 있으면 location 을 쓴다. */
  confirmedAddress?: string;
  confirmedIso: string | null;
  preferredIso: string | null;
  services: ShareServiceLine[];
  total: number;
}): string {
  const isEn = input.locale === "en";
  const lines: string[] = [];

  lines.push(isEn ? `${input.shopName} booking` : `${input.shopName} 예약 안내`);
  lines.push("");

  const iso = input.confirmedIso ?? input.preferredIso;
  if (iso) {
    const when = formatDateTime(iso, input.locale);
    if (input.confirmedIso) {
      lines.push(`📅 ${when}`);
    } else {
      lines.push(
        isEn
          ? `📅 ${when} (requested — not confirmed yet)`
          : `📅 ${when} (요청하신 시간 — 아직 확정 전이에요)`,
      );
    }
  }

  for (const l of input.services) {
    const name = isEn ? l.name_en : l.name_ko;
    const qty = l.unit === "per_finger" ? ` ×${l.quantity}` : "";
    lines.push(`💅 ${name}${qty} ${formatMoney(l.subtotal, input.currency)}`);
  }

  if (input.services.length > 1) {
    lines.push(
      `${isEn ? "Total" : "합계"} ${formatMoney(input.total, input.currency)}`,
    );
  }

  // 확정된 예약에만 실제 주소를 보낸다 — 확정 전 손님에게 집 주소가 새지 않도록.
  const place = input.confirmedIso
    ? (input.confirmedAddress ?? "").trim() || input.location.trim()
    : input.location.trim();
  if (place) {
    lines.push(`📍 ${place}`);
  }

  return lines.join("\n");
}
