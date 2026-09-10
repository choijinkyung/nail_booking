import type { Locale } from "./i18n";
import { formatMoney } from "./format";
import type { ShareServiceLine } from "./bookingShare";

/** 결제 안내의 기본 첫 줄. 설정 화면이 이걸 미리 채워 보여준다. */
export function defaultPaymentHeadline(shopName: string, locale: Locale): string {
  return locale === "en" ? `${shopName} — payment` : `${shopName} 결제 안내`;
}

/**
 * 시술이 끝난 뒤 손님에게 보내는 결제 안내 문구.
 * 이메일이 없는 손님이 많아 메일로는 닿지 않으므로, 카카오톡으로
 * 그대로 붙여 보낼 수 있는 글로 만든다.
 */
export function buildPaymentShareText(input: {
  shopName: string;
  locale: Locale;
  currency: string;
  services: ShareServiceLine[];
  tip: number;
  paymentText: string;
  etransferEmail: string;
  etransferNote: string;
  /** 설정에서 사장님이 쓴 첫 줄. 비어 있으면 기본 문구. */
  headline?: string;
}): string {
  const isEn = input.locale === "en";
  const lines: string[] = [];

  lines.push(
    (input.headline ?? "").trim() ||
      defaultPaymentHeadline(input.shopName, input.locale),
  );
  lines.push("");

  for (const l of input.services) {
    const name = isEn ? l.name_en : l.name_ko;
    const qty = l.unit === "per_finger" ? ` ×${l.quantity}` : "";
    lines.push(`💅 ${name}${qty} ${formatMoney(l.subtotal, input.currency)}`);
  }

  const subtotal = input.services.reduce((sum, l) => sum + l.subtotal, 0);
  const tip = Number(input.tip) || 0;
  if (tip > 0) {
    lines.push(`${isEn ? "Tip" : "팁"} ${formatMoney(tip, input.currency)}`);
  }
  lines.push(
    `${isEn ? "Total" : "합계"} ${formatMoney(subtotal + tip, input.currency)}`,
  );

  const pay = (input.paymentText ?? "").trim();
  const mail = (input.etransferEmail ?? "").trim();
  const note = (input.etransferNote ?? "").trim();
  if (pay || mail || note) {
    lines.push("");
    if (pay) lines.push(pay);
    if (mail) lines.push(`💳 ${mail}`);
    if (note) lines.push(note);
  }

  return lines.join("\n");
}
