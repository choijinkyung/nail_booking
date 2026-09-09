"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import type { Service } from "@/lib/types";
import { formatDuration, formatServicePrice } from "@/lib/format";
import { createAdminBooking } from "@/app/admin/actions";
import { CustomerPicker, type PickedCustomer } from "./CustomerPicker";
import type { PickerCustomer } from "./BookingCalendar";
import { halfHourOptions, isosFor, minLabel } from "./BlockForm";

/**
 * 관리자가 캘린더에서 직접 예약을 잡는 폼.
 * 손님 예약과 달리 즉시 confirmed 이고 이메일을 보내지 않으며,
 * 60분 최소 간격 규칙도 적용되지 않는다(이미 booked 인 시간만 충돌).
 */
export function NewBookingForm({
  dayKey,
  services,
  customers,
  dict,
  locale,
  currency,
  onDone,
}: {
  dayKey: string;
  services: Service[];
  customers: PickerCustomer[];
  dict: Dict;
  locale: Locale;
  currency: string;
  onDone: () => void;
}) {
  const a = dict.admin;
  const isEn = locale === "en";
  const router = useRouter();
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [startMin, setStartMin] = useState(10 * 60);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  const picked = useMemo(
    () =>
      services
        .filter((s) => (qty[s.id] ?? 0) > 0)
        .map((s) => ({ service: s, quantity: qty[s.id] })),
    [services, qty],
  );
  // buildServiceLines 는 수량과 무관하게 시술당 duration_min 을 한 번만 싣는다
  // (bookingDurationMin 이 그 합). 표시도 같은 규칙을 따라야 어긋나지 않는다.
  const totalMin = picked.reduce((sum, p) => sum + p.service.duration_min, 0);
  const totalPrice = picked.reduce(
    (sum, p) =>
      sum +
      p.service.price * (p.service.unit === "per_finger" ? p.quantity : 1),
    0,
  );

  // 마지막 슬롯이 22:00 을 넘지 않도록, 시작 시각 선택지를 소요시간만큼 자른다.
  const options = halfHourOptions(8 * 60, 22 * 60 - Math.max(30, totalMin));
  // 시술을 추가해 소요시간이 늘면 선택지의 끝이 당겨진다 — 현재 선택을 범위 안으로.
  const maxStart = options[options.length - 1] ?? 8 * 60;
  const effStart = Math.min(startMin, maxStart);
  const canSubmit = customer !== null && picked.length > 0 && !pending;

  function bump(id: string, delta: number, perFinger: boolean) {
    setQty((prev) => {
      const cur = prev[id] ?? 0;
      const max = perFinger ? 10 : 1;
      const next = Math.min(max, Math.max(0, cur + delta));
      return { ...prev, [id]: next };
    });
  }

  function submit() {
    if (!customer) return;
    startTransition(async () => {
      setMsg("");
      const res = await createAdminBooking({
        customer,
        services: picked.map((p) => ({
          service_id: p.service.id,
          quantity: p.quantity,
        })),
        startsAtISO: isosFor(dayKey, effStart, effStart + 30)[0],
        note,
      });
      if (!res.ok) {
        setMsg(res.error === "SLOT_TAKEN" ? a.timeTaken : a.saveErr);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-brand-100 bg-white p-3">
      <CustomerPicker customers={customers} dict={dict} onChange={setCustomer} />

      {/* 시술 선택 */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-brand-400">
          {a.pickServices}
        </p>
        <ul className="space-y-1">
          {services.map((s) => {
            const perFinger = s.unit === "per_finger";
            const n = qty[s.id] ?? 0;
            return (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-lg border border-brand-100 px-2 py-1.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-brand-900">
                    {isEn ? s.name_en : s.name_ko}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {formatServicePrice(s.price, currency, s.price_from)}
                    {perFinger ? ` / ${dict.common.perFinger}` : ""} ·{" "}
                    {formatDuration(s.duration_min, locale)}
                  </span>
                </span>
                <button
                  onClick={() => bump(s.id, -1, perFinger)}
                  disabled={n === 0}
                  className="h-7 w-7 shrink-0 rounded-full border border-brand-200 text-brand-700 disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-5 shrink-0 text-center text-sm font-semibold text-brand-800">
                  {n}
                </span>
                <button
                  onClick={() => bump(s.id, +1, perFinger)}
                  disabled={!perFinger && n >= 1}
                  className="h-7 w-7 shrink-0 rounded-full border border-brand-200 text-brand-700 disabled:opacity-30"
                >
                  +
                </button>
              </li>
            );
          })}
        </ul>
        {picked.length > 0 && (
          <p className="mt-1 text-xs text-muted">
            {a.totalDuration} {formatDuration(totalMin, locale)} ·{" "}
            {dict.common.total} {formatServicePrice(totalPrice, currency)}
          </p>
        )}
      </div>

      {/* 시간 */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-brand-400">
          {a.pickTime}
        </p>
        <select
          value={effStart}
          onChange={(e) => setStartMin(Number(e.target.value))}
          className="rounded-lg border border-brand-200 bg-white px-2 py-1 text-sm outline-none focus:border-brand-400"
        >
          {options.map((t) => (
            <option key={t} value={t}>
              {minLabel(t)}
            </option>
          ))}
        </select>
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={a.bookingNote}
        className="w-full rounded-xl border border-brand-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
      />

      {msg && <p className="text-xs text-amber-600">{msg}</p>}

      <button
        disabled={!canSubmit}
        onClick={submit}
        className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
      >
        {a.createBooking}
      </button>
    </div>
  );
}
