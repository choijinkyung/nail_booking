"use client";

import { useMemo, useState } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import type { BookingStatus, BookingWithSlots } from "@/lib/types";

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

/**
 * 월 그리드 달력. 날짜별 예약 상태 점을 찍고, 날짜를 누르면 onSelect 로 알린다.
 * 상세(그날 예약 카드)는 부모가 selected 값을 받아 직접 렌더한다.
 */
export function MiniCalendar({
  eventsByDay,
  today,
  selected,
  onSelect,
  dict,
  locale,
}: {
  eventsByDay: Map<string, BookingWithSlots[]>;
  today: string; // YYYY-MM-DD
  selected: string;
  onSelect: (dayKey: string) => void;
  dict: Dict;
  locale: Locale;
}) {
  const isEn = locale === "en";
  const [ty, tm] = today.split("-").map(Number);
  // 선택된 날짜가 속한 달을 기본으로 보여준다
  const [sy, sm] = (selected || today).split("-").map(Number);
  const [year, setYear] = useState(sy || ty);
  const [month, setMonth] = useState((sm || tm) - 1); // 0-indexed

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = useMemo(
    () => [
      ...Array(firstDow).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ],
    [firstDow, daysInMonth],
  );

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
    onSelect(today);
  }

  const monthLabel = isEn
    ? `${EN_MONTHS[month]} ${year}`
    : `${year}년 ${KO_MONTHS[month]}`;

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => move(-1)}
          className="rounded-lg px-3 py-1.5 text-lg text-brand-600"
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <span className="font-bold text-brand-900">{monthLabel}</span>
          <button
            type="button"
            onClick={goToday}
            className="rounded-full border border-brand-200 px-2.5 py-0.5 text-xs text-brand-600"
          >
            {dict.admin.today}
          </button>
        </div>
        <button
          type="button"
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
              type="button"
              onClick={() => onSelect(key)}
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
                {dayEvents.slice(0, 3).map((b, j) => (
                  <span
                    key={j}
                    className={`h-1.5 w-1.5 rounded-full ${DOT[b.status] ?? "bg-brand-300"}`}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function statusDot(status: BookingStatus): string {
  return DOT[status] ?? "bg-brand-300";
}
