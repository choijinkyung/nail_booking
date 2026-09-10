import Link from "next/link";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getBookingByCode, getFutureSlots, getSettings } from "@/lib/data";
import { formatDateTime, formatMoney } from "@/lib/format";
import { SiteHeader } from "@/components/SiteHeader";
import { Card } from "@/components/ui";
import { BookingActions } from "@/components/BookingActions";
import { StatusLookup } from "@/components/StatusLookup";
import type { BookingStatus } from "@/lib/types";

const STATUS_STYLE: Record<BookingStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
  completed: "bg-brand-100 text-brand-900",
};

export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const settings = await getSettings();
  const isEn = locale === "en";
  const shopName = isEn ? settings.shop_name_en : settings.shop_name_ko;

  const booking = code ? await getBookingByCode(code) : null;
  const notFound = Boolean(code) && !booking;
  const futureSlots = booking ? await getFutureSlots() : [];

  const st = dict.status;
  const statusText: Record<BookingStatus, string> = {
    pending: st.status_pending,
    confirmed: st.status_confirmed,
    declined: st.status_declined,
    cancelled: st.status_cancelled,
    completed: st.status_completed,
  };
  const statusDesc: Partial<Record<BookingStatus, string>> = {
    pending: st.pendingDesc,
    confirmed: st.confirmedDesc,
    declined: st.declinedDesc,
  };

  return (
    <div className="min-h-dvh">
      <SiteHeader locale={locale} shopName={shopName} />
      <main className="mx-auto max-w-md px-4 pb-16 pt-4">
        <Link href="/" className="text-sm text-brand-600 hover:underline">
          ← {dict.common.home}
        </Link>
        <h1 className="mt-2 text-xl font-bold text-brand-900">{st.title}</h1>

        {/* 예약번호 또는 이름+비밀번호로 조회 */}
        <div className="mt-4">
          <StatusLookup defaultCode={code} dict={dict} />
        </div>

        {notFound && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {st.notFound}
          </p>
        )}

        {booking && (
          <div className="mt-5 space-y-3">
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted">{st.statusLabel}</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLE[booking.status]}`}
                  >
                    {statusText[booking.status]}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted">{dict.booking.yourCode}</p>
                  <p className="font-bold tracking-widest text-brand-900">
                    {booking.code}
                  </p>
                </div>
              </div>
              {statusDesc[booking.status] && (
                <p className="mt-3 rounded-md bg-brand-50 p-3 text-sm text-brand-900">
                  {statusDesc[booking.status]}
                </p>
              )}
            </Card>

            {/* 손님 변경/취소 요청 (관리자 승인 시에만 실제 변경) */}
            <BookingActions
              booking={booking}
              futureSlots={futureSlots}
              dict={dict}
              locale={locale}
            />

            {booking.reference_url && (
              <Card>
                <p className="mb-2 text-[13px] font-semibold text-brand-400">
                  📎 {dict.booking.reference.split(" (")[0]}
                </p>
                <a href={booking.reference_url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={booking.reference_url}
                    alt="reference"
                    className="h-32 w-32 rounded-lg border border-brand-100 object-cover"
                  />
                </a>
              </Card>
            )}

            {/* 확정 시간 */}
            {booking.status === "confirmed" && booking.confirmed_slot && (
              <Card className="border-green-200 bg-green-50/60">
                <p className="text-[13px] font-semibold text-green-700">
                  {st.confirmedTime}
                </p>
                <p className="mt-1 text-lg font-bold text-green-800">
                  {formatDateTime(booking.confirmed_slot.starts_at, locale)}
                </p>
              </Card>
            )}

            {/* 안내 메시지 */}
            {booking.admin_message && (
              <Card>
                <p className="text-[13px] font-semibold text-brand-400">
                  {st.messageFromShop}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-brand-900">
                  {booking.admin_message}
                </p>
              </Card>
            )}

            {/* 요청 시간들 */}
            {booking.status === "pending" && (
              <Card>
                <p className="text-[13px] font-semibold text-brand-400">
                  {st.preferredTime}
                </p>
                <p className="mt-1 text-sm text-brand-900">
                  {booking.preferred_slot
                    ? formatDateTime(booking.preferred_slot.starts_at, locale)
                    : "-"}
                </p>
                {booking.alternative_slots.length > 0 && (
                  <>
                    <p className="mt-3 text-[13px] font-semibold text-brand-400">
                      {st.alternativeTimes}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-sm text-brand-900">
                      {booking.alternative_slots.map((s) => (
                        <li key={s.id}>{formatDateTime(s.starts_at, locale)}</li>
                      ))}
                    </ul>
                  </>
                )}
              </Card>
            )}

            {/* 시술 내역 */}
            <Card>
              <p className="text-[13px] font-semibold text-brand-400">
                {st.services}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-brand-900">
                {booking.services.map((l, i) => (
                  <li key={i} className="flex justify-between">
                    <span>
                      {isEn ? l.name_en : l.name_ko}
                      {l.unit === "per_finger" && ` ×${l.quantity}`}
                    </span>
                    <span className="font-medium">
                      {formatMoney(l.subtotal, settings.currency)}
                    </span>
                  </li>
                ))}
              </ul>
              {booking.status === "completed" ? (
                <>
                  {booking.tip > 0 && (
                    <div className="mt-2 flex justify-between text-sm text-muted">
                      <span>{dict.booking.tip}</span>
                      <span>{formatMoney(booking.tip, settings.currency)}</span>
                    </div>
                  )}
                  <div className="mt-2 flex justify-between border-t border-brand-100 pt-2 font-bold text-brand-900">
                    <span>{dict.booking.finalTotal}</span>
                    <span>
                      {formatMoney(
                        (booking.final_price ?? booking.estimated_total) +
                          (booking.tip ?? 0),
                        settings.currency,
                      )}
                    </span>
                  </div>
                </>
              ) : (
                <div className="mt-2 flex justify-between border-t border-brand-100 pt-2 font-bold text-brand-900">
                  <span>{dict.booking.estimated}</span>
                  <span>
                    {formatMoney(booking.estimated_total, settings.currency)}
                  </span>
                </div>
              )}
            </Card>

            {/* 결제 안내 — 시술 완료 후에만 노출 */}
            {booking.status === "completed" && (
              <Card className="border-brand-300 bg-brand-50">
                <p className="font-semibold text-brand-900">
                  {st.completedPayCard}
                </p>
                <p className="mt-2 text-sm text-brand-900">
                  {isEn ? settings.payment_en : settings.payment_ko}
                </p>
                {settings.etransfer_email && (
                  <div className="mt-3 rounded-md bg-white p-3">
                    <p className="text-xs text-muted">
                      {isEn ? "e-transfer recipient" : "e-transfer 받는 주소"}
                    </p>
                    <p className="select-all font-semibold text-brand-900">
                      {settings.etransfer_email}
                    </p>
                    {(isEn
                      ? settings.etransfer_note_en
                      : settings.etransfer_note_ko) && (
                      <p className="mt-1 text-xs text-muted">
                        {isEn
                          ? settings.etransfer_note_en
                          : settings.etransfer_note_ko}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
