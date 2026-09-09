"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import type { AvailabilitySlot } from "@/lib/types";
import type { BusinessHour } from "@/lib/schedule";
import { MAX_WINDOW_DAYS, MIN_WINDOW_DAYS } from "@/lib/schedule";
import { formatDateHeading, formatTimeOnly, slotDayKey } from "@/lib/format";
import {
  addDayOff,
  removeDayOff,
  saveBusinessHours,
  syncGeneratedSlots,
} from "@/app/admin/actions";

/** 08:00–22:00, 30분 간격 선택지 */
const TIME_OPTIONS: number[] = [];
for (let t = 0; t <= 1440; t += 30) TIME_OPTIONS.push(t);

function hhmm(t: number): string {
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

function defaultHours(rows: BusinessHour[]): BusinessHour[] {
  const byDay = new Map(rows.map((r) => [r.weekday, r]));
  return Array.from({ length: 7 }, (_, weekday) => {
    const r = byDay.get(weekday);
    return {
      weekday,
      enabled: r?.enabled ?? false,
      start_min: r?.start_min ?? 600,
      end_min: r?.end_min ?? 1200,
    };
  });
}

export function AvailabilityManager({
  slots,
  hours: initialHours,
  daysOff,
  windowDays: initialWindow,
  today,
  dict,
  locale,
}: {
  slots: AvailabilitySlot[];
  hours: BusinessHour[];
  daysOff: string[];
  windowDays: number;
  today: string; // YYYY-MM-DD (Vancouver)
  dict: Dict;
  locale: Locale;
}) {
  const a = dict.admin;
  const router = useRouter();
  const [hours, setHours] = useState(() => defaultHours(initialHours));
  const [windowDays, setWindowDays] = useState(initialWindow);
  const [newDayOff, setNewDayOff] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const dayNames = a.weekdayNames.split(",");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErr("");
    setMsg("");
    startTransition(async () => {
      try {
        const res = await fn();
        if (res.ok) {
          setMsg(a.syncResult);
          router.refresh();
        } else {
          setErr(a.saveErr);
        }
      } catch {
        setErr(a.setupNeeded);
      }
    });
  }

  function patch(weekday: number, next: Partial<BusinessHour>) {
    setHours((prev) =>
      prev.map((h) => (h.weekday === weekday ? { ...h, ...next } : h)),
    );
  }

  // 열려있는 미래 슬롯을 날짜별 한 줄로 요약한다 (30분 줄을 전부 늘어놓지 않는다).
  const nowIso = new Date().toISOString();
  const openByDay = new Map<string, AvailabilitySlot[]>();
  for (const s of slots) {
    if (s.status !== "open" || s.starts_at < nowIso) continue;
    const key = slotDayKey(s.starts_at);
    if (!openByDay.has(key)) openByDay.set(key, []);
    openByDay.get(key)!.push(s);
  }
  const summary = [...openByDay.entries()]
    .sort((x, y) => x[0].localeCompare(y[0]))
    .map(([key, list]) => {
      const sorted = [...list].sort((p, q) =>
        p.starts_at.localeCompare(q.starts_at),
      );
      return {
        key,
        first: sorted[0].starts_at,
        last: sorted[sorted.length - 1].starts_at,
        count: sorted.length,
      };
    });

  const futureDaysOff = daysOff.filter((d) => d >= today);
  const select =
    "rounded-lg border border-brand-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-400 disabled:opacity-40";

  return (
    <div className="space-y-3">
      {/* ① 요일별 영업시간 */}
      <section className="rounded-2xl border border-brand-100 bg-white p-4">
        <p className="text-sm font-semibold text-brand-800">{a.weeklyHours}</p>
        <p className="mb-3 text-xs text-muted">{a.weeklyHoursHint}</p>

        <ul className="space-y-1.5">
          {hours.map((h) => (
            <li key={h.weekday} className="flex items-center gap-2">
              <label className="flex w-16 shrink-0 items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={h.enabled}
                  onChange={(e) =>
                    patch(h.weekday, { enabled: e.target.checked })
                  }
                />
                <span
                  className={
                    h.enabled ? "font-semibold text-brand-900" : "text-muted"
                  }
                >
                  {dayNames[h.weekday]}
                </span>
              </label>

              {h.enabled ? (
                <div className="flex items-center gap-1.5">
                  <select
                    aria-label={`${dayNames[h.weekday]} ${a.blockFrom}`}
                    value={h.start_min}
                    onChange={(e) =>
                      patch(h.weekday, { start_min: Number(e.target.value) })
                    }
                    className={select}
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {hhmm(t)}
                      </option>
                    ))}
                  </select>
                  <span className="text-muted">–</span>
                  <select
                    aria-label={`${dayNames[h.weekday]} ${a.blockTo}`}
                    value={h.end_min}
                    onChange={(e) =>
                      patch(h.weekday, { end_min: Number(e.target.value) })
                    }
                    className={select}
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {hhmm(t)}
                      </option>
                    ))}
                  </select>
                  {h.end_min <= h.start_min && (
                    <span className="text-xs text-amber-600">
                      {a.invalidRange}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-sm text-muted">{a.dayOffLabel}</span>
              )}
            </li>
          ))}
        </ul>

        <label className="mt-4 flex items-center gap-2 text-sm text-brand-900">
          {a.windowDays}
          <input
            type="number"
            min={MIN_WINDOW_DAYS}
            max={MAX_WINDOW_DAYS}
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            className="w-20 rounded-lg border border-brand-200 px-2 py-1.5 text-sm outline-none focus:border-brand-400"
          />
          {a.windowDaysUnit}
        </label>

        <button
          disabled={pending}
          onClick={() => run(() => saveBusinessHours({ hours, windowDays }))}
          className="mt-3 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? a.syncing : a.saveHours}
        </button>

        {msg && <p className="mt-2 text-sm text-green-700">{msg}</p>}
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </section>

      {/* ② 쉬는 날 */}
      <section className="rounded-2xl border border-brand-100 bg-white p-4">
        <p className="text-sm font-semibold text-brand-800">{a.daysOffTitle}</p>
        <p className="mb-3 text-xs text-muted">{a.daysOffHint}</p>

        {futureDaysOff.length === 0 ? (
          <p className="mb-3 text-sm text-muted">{a.noDaysOff}</p>
        ) : (
          <ul className="mb-3 space-y-1.5">
            {futureDaysOff.map((d) => (
              <li
                key={d}
                className="flex items-center justify-between rounded-xl border border-brand-100 px-3 py-2 text-sm"
              >
                <span className="text-brand-900">{d}</span>
                <button
                  disabled={pending}
                  onClick={() => run(() => removeDayOff({ day: d }))}
                  className="rounded-lg border border-brand-200 px-2.5 py-1 text-xs text-brand-600 disabled:opacity-40"
                >
                  {a.removeDayOff}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            type="date"
            min={today}
            value={newDayOff}
            onChange={(e) => setNewDayOff(e.target.value)}
            className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
          <button
            disabled={pending || !newDayOff}
            onClick={() =>
              run(async () => {
                const res = await addDayOff({ day: newDayOff });
                if (res.ok) setNewDayOff("");
                return res;
              })
            }
            className="shrink-0 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {a.addDayOff}
          </button>
        </div>
      </section>

      {/* ③ 지금 열려있는 시간 — 날짜당 한 줄 요약 */}
      <section className="rounded-2xl border border-brand-100 bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-brand-800">
              {a.openSummary}
            </p>
            <p className="text-xs text-muted">{a.openSummaryHint}</p>
          </div>
          <button
            disabled={pending}
            onClick={() => run(() => syncGeneratedSlots())}
            className="shrink-0 rounded-lg border border-brand-200 px-2.5 py-1 text-xs text-brand-600 disabled:opacity-40"
          >
            {a.refreshSlots}
          </button>
        </div>

        {summary.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{a.noOpenSlots}</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {summary.map((d) => (
              <li
                key={d.key}
                className="flex items-center justify-between border-b border-brand-50 py-1.5 text-sm last:border-0"
              >
                <span className="text-brand-900">
                  {formatDateHeading(d.first, locale)}
                </span>
                <span className="text-muted">
                  {formatTimeOnly(d.first, locale)} –{" "}
                  {formatTimeOnly(d.last, locale)}
                  <span className="ml-2 text-xs">
                    · {d.count}
                    {a.slotsCount}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
