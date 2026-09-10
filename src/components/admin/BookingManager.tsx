"use client";

import { useMemo, useState } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import type { AvailabilitySlot, BookingWithSlots } from "@/lib/types";
import { slotDayKey } from "@/lib/format";
import { AdminBookingCard } from "./AdminBookingCard";
import { MiniCalendar } from "./MiniCalendar";

type Tab = "pending" | "upcoming" | "past";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

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

  // 다가오는 2일(오늘+내일)치는 리스트로 먼저 노출
  const [ty, tm, td] = today.split("-").map(Number);
  const tmr = new Date(ty, tm - 1, td + 1);
  const tomorrowKey = `${tmr.getFullYear()}-${pad(tmr.getMonth() + 1)}-${pad(tmr.getDate())}`;
  const upcomingSorted = useMemo(
    () =>
      [...upcoming].sort((x, y) =>
        (x.confirmed_slot?.starts_at ?? "").localeCompare(
          y.confirmed_slot?.starts_at ?? "",
        ),
      ),
    [upcoming],
  );
  const next2 = upcomingSorted.filter(
    (b) => slotDayKey(b.confirmed_slot!.starts_at) <= tomorrowKey,
  );

  const upcomingByDay = useMemo(() => groupByDay(upcoming), [upcoming]);
  const pastByDay = useMemo(() => groupByDay(pastDated), [pastDated]);

  const [tab, setTab] = useState<Tab>(
    pending.length > 0 ? "pending" : "upcoming",
  );
  const [upSel, setUpSel] = useState(today);
  const [pastSel, setPastSel] = useState(today);
  const [showOther, setShowOther] = useState(false);

  const render = (b: BookingWithSlots) => (
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
    />
  );

  const upSelCards = upcomingByDay.get(upSel) ?? [];
  const pastSelCards = pastByDay.get(pastSel) ?? [];

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "pending", label: a.pending, count: pending.length },
    { key: "upcoming", label: a.upcoming, count: upcoming.length },
    { key: "past", label: a.pastTab, count: pastDated.length },
  ];

  return (
    <div>
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
          {upcoming.length === 0 ? (
            <p className="rounded-md bg-white/60 p-4 text-sm text-muted">
              {a.noUpcoming}
            </p>
          ) : (
            <>
              {/* 다가오는 2일 */}
              {next2.length > 0 && (
                <div className="mb-5">
                  <h3 className="mb-2 text-sm font-bold text-brand-500">
                    {a.next2days}
                  </h3>
                  <div className="space-y-3">{next2.map(render)}</div>
                </div>
              )}

              {/* 이후 일정 — 캘린더 */}
              <h3 className="mb-2 text-sm font-bold text-brand-500">
                {a.laterSectionTitle}
              </h3>
              <MiniCalendar
                eventsByDay={upcomingByDay}
                today={today}
                selected={upSel}
                onSelect={setUpSel}
                dict={dict}
                locale={locale}
              />
              <div className="mt-4 space-y-3">
                {upSelCards.length === 0 ? (
                  <p className="rounded-md bg-white/60 p-4 text-sm text-muted">
                    {a.selectDayHint}
                  </p>
                ) : (
                  upSelCards.map(render)
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* 지난 예약 */}
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
