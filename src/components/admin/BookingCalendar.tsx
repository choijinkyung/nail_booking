"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import type { BookingStatus, BookingWithSlots, Service } from "@/lib/types";
import type { BlockSlot } from "@/lib/data";
import {
  formatDateHeading,
  formatMoney,
  formatTimeOnly,
  slotDayKey,
} from "@/lib/format";
import { removeBlock } from "@/app/admin/actions";
import { BlockForm } from "./BlockForm";
import { NewBookingForm } from "./NewBookingForm";

interface CalEvent {
  bookingId: string;
  dayKey: string;
  iso: string;
  name: string;
  services: string;
  status: BookingStatus;
  amount: number; // 완료 예약의 결제액(시술가+팁), 그 외 0
  durationMin: number;
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

export interface PickerCustomer {
  id: string;
  name: string;
  contact: string;
}

export function BookingCalendar({
  bookings,
  blocks,
  services,
  customers,
  renderBooking,
  today,
  dict,
  locale,
  currency,
}: {
  bookings: BookingWithSlots[];
  blocks: BlockSlot[];
  services: Service[];
  customers: PickerCustomer[];
  /** 그날 예약을 어떻게 그릴지 — 대시보드가 접이식 카드를 넘겨준다 */
  renderBooking?: (bookingId: string) => React.ReactNode;
  today: string; // YYYY-MM-DD (Vancouver)
  dict: Dict;
  locale: Locale;
  currency: string;
}) {
  const isEn = locale === "en";
  const router = useRouter();
  const [ty, tm] = today.split("-").map(Number);
  const [year, setYear] = useState(ty);
  const [month, setMonth] = useState(tm - 1); // 0-indexed
  const [selected, setSelected] = useState(today);
  const [pane, setPane] = useState<"none" | "booking" | "block">("none");

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
        bookingId: b.id,
        dayKey: slotDayKey(iso),
        iso,
        name: b.customer_name,
        services: b.services
          .map((l) => (isEn ? l.name_en : l.name_ko))
          .join(", "),
        status: b.status,
        amount,
        durationMin: b.services.reduce(
          (s, l) => s + (l.duration_min || 0),
          0,
        ),
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

  // 같은 block_group 의 연속 슬롯을 한 줄(시작–종료)로 묶는다.
  const blocksByDay = useMemo(() => {
    const groups = new Map<string, { isos: string[]; note: string }>();
    for (const b of blocks) {
      const g = groups.get(b.block_group);
      const note = isEn ? b.note_en : b.note_ko;
      if (g) {
        g.isos.push(b.starts_at);
        if (!g.note && note) g.note = note;
      } else {
        groups.set(b.block_group, { isos: [b.starts_at], note });
      }
    }
    const byDay = new Map<string, BlockRun[]>();
    for (const [blockGroup, g] of groups) {
      const sorted = [...g.isos].sort();
      const startIso = sorted[0];
      // 마지막 슬롯은 30분짜리이므로 종료 = 마지막 시작 + 30분
      const endIso = new Date(
        new Date(sorted[sorted.length - 1]).getTime() + 30 * 60000,
      ).toISOString();
      const dayKey = slotDayKey(startIso);
      const run: BlockRun = { blockGroup, startIso, endIso, note: g.note };
      if (!byDay.has(dayKey)) byDay.set(dayKey, []);
      byDay.get(dayKey)!.push(run);
    }
    for (const list of byDay.values())
      list.sort((a, b) => a.startIso.localeCompare(b.startIso));
    return byDay;
  }, [blocks, isEn]);

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
  const selectedBlocks = blocksByDay.get(selected) ?? [];

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
        <div className="rounded-lg border border-brand-100 bg-white p-3 text-center">
          <p className="text-xs text-muted">{dict.admin.revenueMonth}</p>
          <p className="mt-0.5 text-lg font-bold text-brand-900">
            {formatMoney(revenueMonth, currency)}
          </p>
        </div>
        <div className="rounded-lg border border-brand-100 bg-brand-600 p-3 text-center text-white">
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
          <span className="font-bold text-brand-900">{monthLabel}</span>
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
                {blocksByDay.has(key) && (
                  <span className="h-1.5 w-3 rounded-sm bg-gray-400" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* 선택한 날 상세 */}
      <div className="mt-5">
        <h2 className="mb-2 text-[15px] font-bold text-brand-900">
          {formatDateHeading(`${selected}T12:00:00Z`, locale)}
        </h2>

        {/* 이 날짜에 대한 관리자 작업 */}
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setPane((p) => (p === "booking" ? "none" : "booking"))}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white"
          >
            {dict.admin.newBooking}
          </button>
          <button
            onClick={() => setPane((p) => (p === "block" ? "none" : "block"))}
            className="rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-900"
          >
            {dict.admin.addBlock}
          </button>
        </div>

        {pane === "booking" && (
          <div className="mb-3">
            <NewBookingForm
              dayKey={selected}
              services={services}
              customers={customers}
              dict={dict}
              locale={locale}
              currency={currency}
              onDone={() => setPane("none")}
            />
          </div>
        )}

        {pane === "block" && (
          <div className="mb-3">
            <BlockForm
              dayKey={selected}
              dict={dict}
              onDone={() => setPane("none")}
            />
          </div>
        )}

        {selectedBlocks.length > 0 && (
          <ul className="mb-2 space-y-2">
            {selectedBlocks.map((b) => (
              <BlockRow
                key={b.blockGroup}
                run={b}
                dict={dict}
                locale={locale}
                onRemoved={() => router.refresh()}
              />
            ))}
          </ul>
        )}

        {selectedEvents.length === 0 ? (
          <p className="rounded-md bg-white/60 p-4 text-sm text-muted">
            {dict.admin.noBookingsOnDay}
          </p>
        ) : renderBooking ? (
          <div>{selectedEvents.map((e) => renderBooking(e.bookingId))}</div>
        ) : (
          <ul className="space-y-2">
            {selectedEvents.map((e, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-md border border-brand-100 bg-white p-3"
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[e.status] ?? "bg-brand-300"}`}
                />
                <span className="w-24 shrink-0 text-sm font-semibold text-brand-900">
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
        <Legend color="bg-gray-400" label={dict.admin.blockedLabel} />
      </div>
    </div>
  );
}

interface BlockRun {
  blockGroup: string;
  startIso: string;
  endIso: string;
  note: string;
}

function BlockRow({
  run,
  dict,
  locale,
  onRemoved,
}: {
  run: BlockRun;
  dict: Dict;
  locale: Locale;
  onRemoved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-3">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gray-400" />
      <span className="w-24 shrink-0 text-sm font-semibold text-gray-700">
        {formatTimeOnly(run.startIso, locale)}
        <span className="block text-[11px] font-normal text-muted">
          – {formatTimeOnly(run.endIso, locale)}
        </span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-gray-800">
          {dict.admin.blockedLabel}
        </span>
        {run.note && (
          <span className="block truncate text-xs text-muted">{run.note}</span>
        )}
      </span>
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await removeBlock({ blockGroup: run.blockGroup });
            if (res.ok) onRemoved();
          })
        }
        className="ml-auto shrink-0 rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-600 disabled:opacity-40"
      >
        {dict.admin.removeBlockBtn}
      </button>
    </li>
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

