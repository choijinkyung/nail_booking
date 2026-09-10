"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import { blockRange } from "@/app/admin/actions";

/** 블록 폼이 다루는 시간 범위(분, 자정 기준). 08:00 – 22:00 */
export const DAY_START_MIN = 8 * 60;
export const DAY_END_MIN = 22 * 60;

/** "HH:MM" 라벨 */
export function minLabel(t: number): string {
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** 30분 간격 시각 목록 (양끝 포함) */
export function halfHourOptions(
  from = DAY_START_MIN,
  to = DAY_END_MIN,
): number[] {
  const out: number[] = [];
  for (let t = from; t <= to; t += 30) out.push(t);
  return out;
}

/**
 * dayKey("YYYY-MM-DD") 의 [startMin, endMin) 구간을 30분 간격 ISO 목록으로.
 * 관리자 브라우저의 로컬 시간 기준으로 Date 를 만든다 — 기존 AvailabilityManager
 * 와 같은 방식이라 서버에서 밴쿠버↔UTC 변환을 하지 않는다.
 */
export function isosFor(
  dayKey: string,
  startMin: number,
  endMin: number,
): string[] {
  const [y, m, d] = dayKey.split("-").map(Number);
  const out: string[] = [];
  for (let t = startMin; t < endMin; t += 30) {
    const dt = new Date(y, m - 1, d, Math.floor(t / 60), t % 60, 0, 0);
    out.push(dt.toISOString());
  }
  return out;
}

export function BlockForm({
  dayKey,
  dict,
  onDone,
}: {
  dayKey: string;
  dict: Dict;
  onDone: () => void;
}) {
  const a = dict.admin;
  const router = useRouter();
  const [allDay, setAllDay] = useState(false);
  const [startMin, setStartMin] = useState(10 * 60);
  const [endMin, setEndMin] = useState(12 * 60);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  const options = halfHourOptions();
  const select =
    "rounded-lg border border-brand-200 bg-white px-2 py-1 text-sm outline-none focus:border-brand-400";

  function submit() {
    const s = allDay ? DAY_START_MIN : startMin;
    const e = allDay ? DAY_END_MIN : endMin;
    if (e <= s) {
      setMsg(a.invalidRange);
      return;
    }
    startTransition(async () => {
      setMsg("");
      const res = await blockRange({
        startsAtISOs: isosFor(dayKey, s, e),
        reasonKo: reason,
        reasonEn: reason,
      });
      if (!res.ok) {
        setMsg(res.error === "SLOT_TAKEN" ? a.blockConflict : a.saveErr);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-brand-100 bg-white p-3">
      <label className="flex items-center gap-2 text-sm text-brand-900">
        <input
          type="checkbox"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
        />
        {a.allDay}
      </label>

      {!allDay && (
        <div className="flex items-center gap-2 text-sm">
          <select
            aria-label={a.blockFrom}
            value={startMin}
            onChange={(e) => setStartMin(Number(e.target.value))}
            className={select}
          >
            {options.map((t) => (
              <option key={t} value={t}>
                {minLabel(t)}
              </option>
            ))}
          </select>
          <span className="text-muted">–</span>
          <select
            aria-label={a.blockTo}
            value={endMin}
            onChange={(e) => setEndMin(Number(e.target.value))}
            className={select}
          >
            {options.map((t) => (
              <option key={t} value={t}>
                {minLabel(t)}
              </option>
            ))}
          </select>
        </div>
      )}

      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={a.blockReason}
        className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
      />

      {msg && <p className="text-xs text-amber-600">{msg}</p>}

      <button
        disabled={pending}
        onClick={submit}
        className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
      >
        {a.addBlock}
      </button>
    </div>
  );
}
