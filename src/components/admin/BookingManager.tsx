"use client";

import { useMemo, useState } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import type { AvailabilitySlot, BookingWithSlots, Service } from "@/lib/types";
import { formatMoney, formatTimeOnly, slotDayKey } from "@/lib/format";
import { AdminBookingCard } from "./AdminBookingCard";
import { BookingCalendar, type PickerCustomer } from "./BookingCalendar";
import type { BlockSlot } from "@/lib/data";
import { ShareButtons } from "./ShareLinks";
import { buildPaymentShareText } from "@/lib/paymentShare";
import {
  buildBookingNoticeText,
  type NoticeKind,
} from "@/lib/bookingNotice";
import { MiniCalendar } from "./MiniCalendar";

type Tab = "pending" | "upcoming" | "past";


/** 캘린더에 표시할 기준 날짜(ISO). 확정/완료는 확정시간, 그 외는 없음. */
function bookingIso(b: BookingWithSlots): string | null {
  if (b.status === "confirmed" || b.status === "completed") {
    return b.confirmed_slot?.starts_at ?? null;
  }
  return null;
}

function groupByDay(bookings: BookingWithSlots[]): Map<string, BookingWithSlots[]> {
  const m = new Map<string, BookingWithSlots[]>();
  for (const b of bookings) {
    const iso = bookingIso(b);
    if (!iso) continue;
    const key = slotDayKey(iso);
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(b);
  }
  for (const list of m.values())
    list.sort((a, b) =>
      (bookingIso(a) ?? "").localeCompare(bookingIso(b) ?? ""),
    );
  return m;
}

export function BookingManager({
  bookings,
  openSlots,
  today,
  dict,
  locale,
  currency,
  baseUrl,
  shopName,
  location,
  confirmedAddress,
  noticeTemplates,
  services,
  blocks,
  customers,
  paymentText,
  etransferEmail,
  etransferNote,
  paymentHeadline,
}: {
  bookings: BookingWithSlots[];
  openSlots: AvailabilitySlot[];
  today: string; // YYYY-MM-DD (Vancouver)
  dict: Dict;
  locale: Locale;
  currency: string;
  baseUrl: string;
  shopName: string;
  location: string;
  confirmedAddress: string;
  /** 설정에서 사장님이 쓴 안내 첫 줄 (비어 있으면 기본 문구) */
  noticeTemplates: Record<NoticeKind, string>;
  services: Service[];
  blocks: BlockSlot[];
  customers: PickerCustomer[];
  paymentText: string;
  etransferEmail: string;
  etransferNote: string;
  paymentHeadline: string;
}) {
  const a = dict.admin;
  const nowIso = new Date().toISOString();

  const hasRequest = (b: BookingWithSlots) =>
    b.request_kind === "change" || b.request_kind === "cancel";

  // 손님 요청은 최상단에 별도 노출 (아래 분류에서 제외)
  const requests = bookings.filter(hasRequest);
  const pending = bookings.filter(
    (b) => b.status === "pending" && !hasRequest(b),
  );
  const upcoming = bookings.filter(
    (b) =>
      b.status === "confirmed" &&
      !hasRequest(b) &&
      (!b.confirmed_slot || b.confirmed_slot.starts_at >= nowIso),
  );
  // 지난: 완료 + 지나간 확정 (날짜가 있어 캘린더로 표시 가능)
  const pastDated = bookings.filter(
    (b) =>
      !hasRequest(b) &&
      (b.status === "completed" ||
        (b.status === "confirmed" &&
          !!b.confirmed_slot &&
          b.confirmed_slot.starts_at < nowIso)),
  );
  // 취소·거절 등 날짜 없는 지난 항목
  const pastOther = bookings.filter(
    (b) =>
      !hasRequest(b) &&
      (b.status === "cancelled" || b.status === "declined"),
  );

  const pastByDay = useMemo(() => groupByDay(pastDated), [pastDated]);

  const [tab, setTab] = useState<Tab>(
    pending.length > 0 ? "pending" : "upcoming",
  );
  // 한 번에 하나만 펼친다 — 여러 개가 동시에 열려 있으면 목록이 안 보인다.
  const [openId, setOpenId] = useState<string | null>(null);
  // 방금 처리한 예약의 안내. 확정하면 카드가 다른 탭으로 옮겨가므로
  // 안내는 목록 바깥에서 들고 있어야 사라지지 않는다.
  const [notice, setNotice] = useState<{
    bookingId: string;
    kind: NoticeKind;
  } | null>(null);
  const noticeBooking = notice
    ? (bookings.find((b) => b.id === notice.bookingId) ?? null)
    : null;
  const [pastSel, setPastSel] = useState(today);
  const [showOther, setShowOther] = useState(false);

  const card = (b: BookingWithSlots) => (
    <AdminBookingCard
      key={b.id}
      booking={b}
      openSlots={openSlots}
      dict={dict}
      locale={locale}
      currency={currency}
      baseUrl={baseUrl}
      shopName={shopName}
      location={location}
      confirmedAddress={confirmedAddress}
      services={services}
      onNotice={(kind) => setNotice({ bookingId: b.id, kind })}
      paymentText={paymentText}
      etransferEmail={etransferEmail}
      etransferNote={etransferNote}
      paymentHeadline={paymentHeadline}
    />
  );

  // 목록에서는 접어 두고, 누르면 카드를 편다.
  const render = (b: BookingWithSlots) => (
    <CollapsibleBooking
      key={b.id}
      booking={b}
      locale={locale}
      currency={currency}
      open={openId === b.id}
      onToggle={() => setOpenId((cur) => (cur === b.id ? null : b.id))}
    >
      {card(b)}
    </CollapsibleBooking>
  );

  const pastSelCards = pastByDay.get(pastSel) ?? [];

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "pending", label: a.pending, count: pending.length },
    { key: "upcoming", label: a.upcoming, count: upcoming.length },
    { key: "past", label: a.pastTab, count: pastDated.length },
  ];

  return (
    <div>
      {/* 방금 처리한 내용을 손님에게 보내기 — 확정하면 카드가 다른 탭으로
          옮겨가므로, 안내는 목록 바깥인 여기서 띄운다. */}
      {notice && noticeBooking && (
        <div className="mb-4 rounded-md border border-brand-600 bg-brand-50 p-3">
          <p className="text-sm font-bold text-brand-900">
            {notice.kind === "completed" ? a.sharePayment : a.sendNoticeTitle} ·{" "}
            {noticeBooking.customer_name}
          </p>
          <p className="mt-0.5 text-xs text-muted">{a.sendNoticeHint}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <ShareButtons
              text={
                // 시술이 끝났으면 알려야 할 것은 일정이 아니라 결제다.
                notice.kind === "completed"
                  ? buildPaymentShareText({
                      shopName,
                      locale,
                      currency,
                      services: noticeBooking.services,
                      tip: noticeBooking.tip ?? 0,
                      paymentText,
                      etransferEmail,
                      etransferNote,
                      headline: paymentHeadline,
                    })
                  : buildBookingNoticeText({
                      kind: notice.kind,
                      shopName,
                      locale,
                      currency,
                      location,
                      confirmedAddress,
                      confirmedIso:
                        noticeBooking.confirmed_slot?.starts_at ?? null,
                      preferredIso:
                        noticeBooking.preferred_slot?.starts_at ?? null,
                      services: noticeBooking.services,
                      total:
                        (noticeBooking.final_price ??
                          noticeBooking.estimated_total) +
                        (noticeBooking.tip ?? 0),
                      message: noticeBooking.admin_message ?? "",
                      headline: noticeTemplates[notice.kind],
                    })
              }
              dict={dict}
            />
            <button
              onClick={() => setNotice(null)}
              className="shrink-0 text-xs text-muted"
            >
              {dict.common.close}
            </button>
          </div>
        </div>
      )}

      {/* 손님 요청 — 항상 최상단 */}
      {requests.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-bold text-amber-600">
            {a.requestSectionTitle} ({requests.length})
          </h2>
          <div className="space-y-3">{requests.map(render)}</div>
        </section>
      )}

      {/* 탭 */}
      <div className="mt-5 flex rounded-lg bg-brand-50 p-1">
        {TABS.map((t) => {
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-md px-2 py-2 text-sm font-semibold transition ${
                on
                  ? "bg-white text-brand-900 shadow-sm"
                  : "text-brand-500 hover:text-brand-900"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${
                    on ? "bg-brand-100 text-brand-900" : "text-brand-400"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 확인 대기 */}
      {tab === "pending" && (
        <section className="mt-5">
          {pending.length === 0 ? (
            <p className="rounded-md bg-white/60 p-4 text-sm text-muted">
              {a.noPending}
            </p>
          ) : (
            <div className="space-y-3">{pending.map(render)}</div>
          )}
        </section>
      )}

      {/* 예정된 예약 */}
      {tab === "upcoming" && (
        <section className="mt-5">
          {/* 캘린더가 예정된 예약의 주인공. 날짜를 누르면 그날 예약이
              예약 관리와 똑같은 카드로 펼쳐진다. */}
          <BookingCalendar
            bookings={bookings}
            blocks={blocks}
            services={services}
            customers={customers}
            renderBooking={(id) => {
              const b = bookings.find((x) => x.id === id);
              return b ? render(b) : null;
            }}
            today={today}
            dict={dict}
            locale={locale}
            currency={currency}
          />
        </section>
      )}

      {tab === "past" && (
        <section className="mt-5">
          {pastDated.length === 0 && pastOther.length === 0 ? (
            <p className="rounded-md bg-white/60 p-4 text-sm text-muted">
              {a.noPastBookings}
            </p>
          ) : (
            <>
              {pastDated.length > 0 && (
                <>
                  <MiniCalendar
                    eventsByDay={pastByDay}
                    today={today}
                    selected={pastSel}
                    onSelect={setPastSel}
                    dict={dict}
                    locale={locale}
                  />
                  <div className="mt-4 space-y-3">
                    {pastSelCards.length === 0 ? (
                      <p className="rounded-md bg-white/60 p-4 text-sm text-muted">
                        {a.selectDayHint}
                      </p>
                    ) : (
                      pastSelCards.map(render)
                    )}
                  </div>
                </>
              )}

              {/* 취소·거절 */}
              {pastOther.length > 0 && (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setShowOther((v) => !v)}
                    className="text-sm font-medium text-brand-600"
                  >
                    {showOther ? "▲" : "▼"} {a.otherBookings} ({pastOther.length})
                  </button>
                  {showOther && (
                    <div className="mt-2 space-y-3">
                      {pastOther.map(render)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * 예약 한 건을 한 줄로 접어서 보여주고, 누르면 카드 전체를 편다.
 * 여러 건이 모두 펼쳐져 있으면 무엇이 몇 건인지 한눈에 안 들어온다.
 */
function CollapsibleBooking({
  booking,
  locale,
  currency,
  open,
  onToggle,
  children,
}: {
  booking: BookingWithSlots;
  locale: Locale;
  currency: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const iso = bookingIso(booking);
  const services = booking.services
    .map((l) => (locale === "en" ? l.name_en : l.name_ko))
    .join(", ");
  const amount =
    booking.status === "completed"
      ? (booking.final_price ?? booking.estimated_total) + (booking.tip ?? 0)
      : booking.estimated_total;

  if (open) {
    return (
      <div>
        {children}
        <button
          onClick={onToggle}
          className="mt-1 w-full py-2 text-center text-xs text-muted"
        >
          {"\u2303"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-3 border-b border-brand-100 py-3 text-left last:border-0"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-brand-900">
          {iso ? formatTimeOnly(iso, locale) : "-"}
          <span className="ml-2 font-normal">{booking.customer_name}</span>
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-muted">
          {services}
        </span>
      </span>
      <span className="shrink-0 text-sm font-semibold text-brand-900">
        {formatMoney(amount, currency)}
      </span>
      <span className="shrink-0 text-brand-400" aria-hidden>
        {"\u2304"}
      </span>
    </button>
  );
}
