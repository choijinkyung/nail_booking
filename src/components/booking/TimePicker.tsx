"use client";

import { useMemo, useState } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import type { AvailabilitySlot } from "@/lib/types";
import { formatTimeOnly, slotDayKey } from "@/lib/format";
import { fitFrom, sortSlots } from "@/lib/scheduling";

const KO_MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const EN_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const KO_DOW = ["일","월","화","수","목","금","토"];
const EN_DOW = ["S","M","T","W","T","F","S"];
const pad = (n: number) => String(n).padStart(2, "0");

export function TimePicker({
  slots,
  durationMin,
  selected,
  onChange,
  dict,
  locale,
  single = false,
}: {
  slots: AvailabilitySlot[];
  durationMin: number;
  selected: string[];
  onChange: (ids: string[]) => void;
  dict: Dict;
  locale: Locale;
  single?: boolean;
}) {
  const isEn = locale === "en";
  const sorted = useMemo(() => sortSlots(slots), [slots]);

  // 소요시간이 들어가는(연속 open) 시작 슬롯만 선택 가능
  const selectable = useMemo(() => {
    const set = new Set<string>();
    for (const s of sorted) {
      if (s.status === "open" && fitFrom(sorted, s.id, durationMin)) set.add(s.id);
    }
    return set;
  }, [sorted, durationMin]);

  const availDays = useMemo(() => {
    const set = new Set<string>();
    for (const s of sorted) if (selectable.has(s.id)) set.add(slotDayKey(s.starts_at));
    return set;
  }, [sorted, selectable]);

  const firstDay = useMemo(() => {
    for (const s of sorted) {
      const k = slotDayKey(s.starts_at);
      if (availDays.has(k)) return k;
    }
    return "";
  }, [sorted, availDays]);

  const [selDate, setSelDate] = useState(firstDay);
  const initY = firstDay ? Number(firstDay.slice(0, 4)) : 2026;
  const initM = firstDay ? Number(firstDay.slice(5, 7)) - 1 : 0;
  const [year, setYear] = useState(initY);
  const [month, setMonth] = useState(initM);

  const slotsForDay = useMemo(
    () => sorted.filter((s) => slotDayKey(s.starts_at) === selDate),
    [sorted, selDate],
  );

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function move(delta: number) {
    let m = month + delta,
      y = year;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  }
  function toggle(id: string) {
    if (single) { onChange([id]); return; }
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  }

  if (availDays.size === 0) {
    return (
      <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-700">
        {dict.booking.noSlots}
      </p>
    );
  }

  return (
    <div>
      {/* 월 이동 */}
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} className="px-3 py-1.5 text-lg text-brand-600">‹</button>
        <span className="font-bold text-brand-800">
          {isEn ? `${EN_MONTHS[month]} ${year}` : `${year}년 ${KO_MONTHS[month]}`}
        </span>
        <button type="button" onClick={() => move(1)} className="px-3 py-1.5 text-lg text-brand-600">›</button>
      </div>

      {/* 요일 */}
      <div className="grid grid-cols-7 text-center text-xs text-muted">
        {(isEn ? EN_DOW : KO_DOW).map((d, i) => (
          <div key={i} className="py-1">{d}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const key = `${year}-${pad(month + 1)}-${pad(day)}`;
          const avail = availDays.has(key);
          const isSel = key === selDate;
          const hasSelected = slotsForDayHasSelected(sorted, key, selected);
          return (
            <button
              key={i}
              type="button"
              disabled={!avail}
              onClick={() => setSelDate(key)}
              className={`relative flex aspect-square items-center justify-center rounded-lg text-sm ${
                isSel
                  ? "bg-brand-600 font-bold text-white"
                  : avail
                    ? "bg-brand-50 font-medium text-brand-800 hover:bg-brand-100"
                    : "text-brand-300"
              }`}
            >
              {day}
              {hasSelected && !isSel && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* 선택한 날의 시간 */}
      {selDate && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {slotsForDay.map((s) => {
              const ok = selectable.has(s.id);
              const on = selected.includes(s.id);
              const idx = selected.indexOf(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!ok}
                  onClick={() => toggle(s.id)}
                  className={`relative rounded-xl border px-3.5 py-2.5 text-sm font-medium transition ${
                    on
                      ? "border-brand-500 bg-brand-500 text-white"
                      : ok
                        ? "border-brand-200 bg-white text-brand-800 hover:bg-brand-50"
                        : "cursor-not-allowed border-brand-100 bg-brand-50 text-brand-300 line-through"
                  }`}
                >
                  {formatTimeOnly(s.starts_at, locale)}
                  {on && !single && (
                    <span
                      className={`absolute -right-1.5 -top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white ${
                        idx === 0 ? "bg-brand-600" : "bg-brand-400"
                      }`}
                    >
                      {idx === 0 ? dict.booking.preferredBadge : dict.booking.altBadge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function slotsForDayHasSelected(
  slots: AvailabilitySlot[],
  dayKey: string,
  selected: string[],
): boolean {
  return slots.some(
    (s) => selected.includes(s.id) && slotDayKey(s.starts_at) === dayKey,
  );
}
