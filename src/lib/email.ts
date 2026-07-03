import "server-only";
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? "";
const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "Zenna Nail <onboarding@resend.dev>";

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
    subject: `🤎 새 예약 요청 · ${input.customerName} (${input.code})`,
    html: wrap(`
      <h2 style="margin:0 0 12px">새 예약 요청이 도착했어요</h2>
      <p style="margin:4px 0"><b>고객</b> ${input.customerName} (${input.contact})</p>
      <p style="margin:4px 0"><b>시술</b> ${input.servicesText}</p>
      <p style="margin:4px 0"><b>1지망 시간</b> ${input.preferredText}</p>
      <p style="margin:4px 0"><b>코드</b> ${input.code}</p>
      <p style="margin:16px 0 0"><a href="${input.siteUrl}/admin" style="background:#8a5a44;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">관리자에서 확인하기</a></p>
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
      ${input.message ? `<p style="margin:12px 0;padding:12px;background:#f2e9e1;border-radius:8px">${input.message}</p>` : ""}
      <p style="margin:16px 0 0"><a href="${input.siteUrl}/admin" style="background:#8a5a44;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">관리자에서 확인하기</a></p>
    `),
  });
}

/** 시술 완료 → 고객에게 금액 + e-transfer 안내 */
export async function notifyCustomerCompleted(input: {
  to: string;
  code: string;
  serviceText: string;
  tipText: string;
  totalText: string;
  paymentText: string;
  etransferEmail: string;
  etransferNote: string;
  siteUrl: string;
}): Promise<void> {
  if (!input.to) return;
  await safeSend({
    to: input.to,
    subject: `시술이 완료되었어요 · 결제 안내 (${input.code})`,
    html: wrap(`
      <h2 style="margin:0 0 12px">시술이 완료되었어요 🤎</h2>
      <table style="width:100%;border-collapse:collapse;margin:8px 0">
        <tr><td style="padding:6px 0">시술 금액</td><td style="padding:6px 0;text-align:right">${input.serviceText}</td></tr>
        <tr><td style="padding:6px 0">팁</td><td style="padding:6px 0;text-align:right">${input.tipText}</td></tr>
        <tr><td style="padding:8px 0;border-top:1px solid #e7d6c9;font-weight:700">합계</td><td style="padding:8px 0;border-top:1px solid #e7d6c9;text-align:right;font-weight:700">${input.totalText}</td></tr>
      </table>
      <div style="margin:12px 0;padding:12px;background:#f2e9e1;border-radius:8px">
        <p style="margin:0 0 4px">${input.paymentText}</p>
        ${input.etransferEmail ? `<p style="margin:4px 0"><b>e-transfer:</b> ${input.etransferEmail}</p>` : ""}
        ${input.etransferNote ? `<p style="margin:4px 0;font-size:13px;color:#8c7b6e">${input.etransferNote}</p>` : ""}
      </div>
      <p style="margin:16px 0 0"><a href="${input.siteUrl}/status?code=${input.code}" style="background:#8a5a44;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">예약 상세 보기</a></p>
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
      ${input.message ? `<p style="margin:12px 0;padding:12px;background:#f2e9e1;border-radius:8px">${input.message}</p>` : ""}
      <p style="margin:16px 0 0"><a href="${input.siteUrl}/status?code=${input.code}" style="background:#8a5a44;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">예약 상세 보기</a></p>
    `),
  });
}
