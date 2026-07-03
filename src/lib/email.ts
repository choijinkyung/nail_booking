import "server-only";
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? "";
const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "Nail Booking <onboarding@resend.dev>";

function client(): Resend | null {
  if (!RESEND_API_KEY) return null;
  return new Resend(RESEND_API_KEY);
}

/**
 * 이메일 발송은 항상 "베스트 에포트" — 실패해도 예약 처리 자체는 막지 않음.
 * RESEND_API_KEY 가 없으면 조용히 건너뜁니다.
 */
async function safeSend(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const resend = client();
  if (!resend || !args.to) return;
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: args.to,
      subject: args.subject,
      html: args.html,
    });
  } catch (err) {
    console.error("[email] 발송 실패:", err);
  }
}

const wrap = (inner: string) =>
  `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f2937">${inner}</div>`;

/** 새 예약 요청 → 관리자에게 알림 */
export async function notifyAdminNewBooking(input: {
  code: string;
  customerName: string;
  contact: string;
  preferredText: string;
  servicesText: string;
  siteUrl: string;
}): Promise<void> {
  if (!ADMIN_EMAIL) return;
  await safeSend({
    to: ADMIN_EMAIL,
    subject: `🩷 새 예약 요청 · ${input.customerName} (${input.code})`,
    html: wrap(`
      <h2 style="margin:0 0 12px">새 예약 요청이 도착했어요</h2>
      <p style="margin:4px 0"><b>고객</b> ${input.customerName} (${input.contact})</p>
      <p style="margin:4px 0"><b>시술</b> ${input.servicesText}</p>
      <p style="margin:4px 0"><b>1지망 시간</b> ${input.preferredText}</p>
      <p style="margin:4px 0"><b>코드</b> ${input.code}</p>
      <p style="margin:16px 0 0"><a href="${input.siteUrl}/admin" style="background:#db2777;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">관리자에서 확인하기</a></p>
    `),
  });
}

/** 손님의 변경/취소 요청 → 관리자에게 알림 */
export async function notifyAdminBookingUpdate(input: {
  code: string;
  customerName: string;
  contact: string;
  kind: "change" | "cancel";
  message: string;
  siteUrl: string;
}): Promise<void> {
  if (!ADMIN_EMAIL) return;
  const isCancel = input.kind === "cancel";
  await safeSend({
    to: ADMIN_EMAIL,
    subject: `${isCancel ? "❌ 예약 취소" : "🔄 예약 변경 요청"} · ${input.customerName} (${input.code})`,
    html: wrap(`
      <h2 style="margin:0 0 12px">${isCancel ? "손님이 예약을 취소했어요" : "손님이 예약 변경을 요청했어요"}</h2>
      <p style="margin:4px 0"><b>고객</b> ${input.customerName} (${input.contact})</p>
      <p style="margin:4px 0"><b>코드</b> ${input.code}</p>
      ${input.message ? `<p style="margin:12px 0;padding:12px;background:#fdf2f8;border-radius:8px">${input.message}</p>` : ""}
      <p style="margin:16px 0 0"><a href="${input.siteUrl}/admin" style="background:#db2777;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">관리자에서 확인하기</a></p>
    `),
  });
}

/** 예약 확정/불가 결과 → 고객에게 알림 (이메일 입력한 경우만) */
export async function notifyCustomerResult(input: {
  to: string;
  confirmed: boolean;
  code: string;
  timeText: string;
  message: string;
  siteUrl: string;
}): Promise<void> {
  if (!input.to) return;
  const title = input.confirmed ? "예약이 확정되었어요 🎉" : "예약 안내";
  await safeSend({
    to: input.to,
    subject: `${title} (${input.code})`,
    html: wrap(`
      <h2 style="margin:0 0 12px">${title}</h2>
      ${
        input.confirmed
          ? `<p style="margin:4px 0"><b>확정 시간</b> ${input.timeText}</p>`
          : ""
      }
      ${input.message ? `<p style="margin:12px 0;padding:12px;background:#fdf2f8;border-radius:8px">${input.message}</p>` : ""}
      <p style="margin:16px 0 0"><a href="${input.siteUrl}/status?code=${input.code}" style="background:#db2777;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">예약 상세 보기</a></p>
    `),
  });
}
