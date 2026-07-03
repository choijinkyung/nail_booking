"use client";

import { useMemo, useState } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import type { BookingStatus, BookingWithSlots } from "@/lib/types";
import { formatMoney, formatTimeOnly, slotDayKey } from "@/lib/format";

interface CalEvent {
  dayKey: string;
  iso: string;
  name: string;
  services: string;
  status: BookingStatus;
  amount: number; // 완료 예약의 결제액(시술가+팁), 그 외 0
}

const DOT: Record<string, string> = {
  pending: "bg-amber-400",
  confirmed: "bg-green-500",
  completed: "bg-brand-400",
  declined: "bg-gray-300",
  cancelled: "bg-gray-300",
};

const KO_MONTHS = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];
const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const KO_DOW = ["일", "월", "화", "수", "목", "금", "토"];
const EN_DOW = ["S", "M", "T", "W", "T", "F", "S"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function BookingCalendar({
  bookings,
  today,
  dict,
  locale,
  currency,
}: {
  bookings: BookingWithSlots[];
  today: string; // YYYY-MM-DD (Vancouver)
  dict: Dict;
  locale: Locale;
  currency: string;
}) {
  const isEn = locale === "en";
  const [ty, tm] = today.split("-").map(Number);
  const [year, setYear] = useState(ty);
  const [month, setMonth] = useState(tm - 1); // 0-indexed
  const [selected, setSelected] = useState(today);

  // 이벤트 구성: 확정/완료는 확정시간, 대기는 1지망시간 기준
  const events = useMemo<CalEvent[]>(() => {
    const out: CalEvent[] = [];
    for (const b of bookings) {
      let iso: string | null = null;
      if (b.status === "confirmed" || b.status === "completed") {
        iso = b.confirmed_slot?.starts_at ?? null;
      } else if (b.status === "pending") {
        iso = b.preferred_slot?.starts_at ?? null;
      }
      if (!iso) continue;
      const amount =
        b.status === "completed"
          ? (b.final_price ?? b.estimated_total) + (b.tip ?? 0)
          : 0;
      out.push({
        dayKey: slotDayKey(iso),
        iso,
        name: b.customer_name,
        services: b.services
          .map((l) => (isEn ? l.name_en : l.name_ko))
          .join(", "),
        status: b.status,
        amount,
      });
    }
    return out;
  }, [bookings, isEn]);

  // 매출: 전체 + 현재 보는 달
  const monthPrefix = `${year}-${pad(month + 1)}`;
  const revenueTotal = events.reduce((s, e) => s + e.amount, 0);
  const revenueMonth = events
    .filter((e) => e.dayKey.startsWith(monthPrefix))
    .reduce((s, e) => s + e.amount, 0);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) {
      if (!m.has(e.dayKey)) m.set(e.dayKey, []);
      m.get(e.dayKey)!.push(e);
    }
    for (const list of m.values())
      list.sort((a, b) => a.iso.localeCompare(b.iso));
    return m;
  }, [events]);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedEvents = eventsByDay.get(selected) ?? [];

  function move(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  }
  function goToday() {
    setYear(ty);
    setMonth(tm - 1);
    setSelected(today);
  }

  const monthLabel = isEn
    ? `${EN_MONTHS[month]} ${year}`
    : `${year}년 ${KO_MONTHS[month]}`;

  return (
    <div>
      {/* 매출 요약 */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-brand-100 bg-white p-3 text-center">
          <p className="text-xs text-muted">{dict.admin.revenueMonth}</p>
          <p className="mt-0.5 text-lg font-bold text-brand-700">
            {formatMoney(revenueMonth, currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-brand-100 bg-brand-600 p-3 text-center text-white">
          <p className="text-xs opacity-90">{dict.admin.revenueTotal}</p>
          <p className="mt-0.5 text-lg font-bold">
            {formatMoney(revenueTotal, currency)}
          </p>
        </div>
      </div>

      {/* 헤더 */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => move(-1)}
          className="rounded-lg px-3 py-1.5 text-lg text-brand-600"
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <span className="font-bold text-brand-800">{monthLabel}</span>
          <button
            onClick={goToday}
            className="rounded-full border border-brand-200 px-2.5 py-0.5 text-xs text-brand-600"
          >
            {dict.admin.today}
          </button>
        </div>
        <button
          onClick={() => move(1)}
          className="rounded-lg px-3 py-1.5 text-lg text-brand-600"
        >
          ›
        </button>
      </div>

      {/* 요일 */}
      <div className="grid grid-cols-7 text-center text-xs text-muted">
        {(isEn ? EN_DOW : KO_DOW).map((d, i) => (
          <div key={i} className="py-1">
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const key = `${year}-${pad(month + 1)}-${pad(day)}`;
          const dayEvents = eventsByDay.get(key) ?? [];
          const isToday = key === today;
          const isSel = key === selected;
          return (
            <button
              key={i}
              onClick={() => setSelected(key)}
              className={`flex aspect-square flex-col items-center justify-start rounded-lg border p-1 text-xs ${
                isSel
                  ? "border-brand-500 bg-brand-50"
                  : "border-transparent hover:bg-brand-50/50"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  isToday ? "bg-brand-600 font-bold text-white" : "text-brand-900"
                }`}
              >
                {day}
              </span>
              <span className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                {dayEvents.slice(0, 3).map((e, j) => (
                  <span
                    key={j}
                    className={`h-1.5 w-1.5 rounded-full ${DOT[e.status] ?? "bg-brand-300"}`}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {/* 선택한 날 상세 */}
      <div className="mt-5">
        <h2 className="mb-2 text-sm font-bold text-brand-600">{selected}</h2>
        {selectedEvents.length === 0 ? (
          <p className="rounded-xl bg-white/60 p-4 text-sm text-muted">
            {dict.admin.noBookingsOnDay}
          </p>
        ) : (
          <ul className="space-y-2">
            {selectedEvents.map((e, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-xl border border-brand-100 bg-white p-3"
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[e.status] ?? "bg-brand-300"}`}
                />
                <span className="w-20 shrink-0 text-sm font-semibold text-brand-700">
                  {formatTimeOnly(e.iso, locale)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-brand-900">
                    {e.name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {e.services}
                  </span>
                </span>
                <span className="ml-auto shrink-0 text-right text-xs">
                  <span className="block text-muted">
                    {statusText(e.status, dict)}
                  </span>
                  {e.status === "completed" && e.amount > 0 && (
                    <span className="block font-semibold text-brand-700">
                      {formatMoney(e.amount, currency)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 범례 */}
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
        <Legend color="bg-amber-400" label={dict.status.status_pending} />
        <Legend color="bg-green-500" label={dict.status.status_confirmed} />
        <Legend color="bg-brand-400" label={dict.status.status_completed} />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function statusText(status: BookingStatus, dict: Dict): string {
  const map: Record<BookingStatus, string> = {
    pending: dict.status.status_pending,
    confirmed: dict.status.status_confirmed,
    declined: dict.status.status_declined,
    cancelled: dict.status.status_cancelled,
    completed: dict.status.status_completed,
  };
  return map[status];
}
