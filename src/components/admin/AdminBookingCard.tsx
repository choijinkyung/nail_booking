"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import type { AvailabilitySlot, BookingWithSlots } from "@/lib/types";
import { formatDateTime, formatMoney } from "@/lib/format";
import {
  cancelBooking,
  completeBooking,
  confirmBooking,
  declineBooking,
} from "@/app/admin/actions";

interface Props {
  booking: BookingWithSlots;
  openSlots: AvailabilitySlot[];
  dict: Dict;
  locale: Locale;
  currency: string;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
  completed: "bg-brand-100 text-brand-700",
};

export function AdminBookingCard({
  booking,
  openSlots,
  dict,
  locale,
  currency,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState(booking.admin_message ?? "");
  const [otherSlot, setOtherSlot] = useState("");
  const [showPropose, setShowPropose] = useState(false);
  const [err, setErr] = useState("");
  const a = dict.admin;
  const isEn = locale === "en";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErr("");
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setErr(res.error === "SLOT_TAKEN" ? a.slotBookedWarn : dict.booking.errGeneric);
    });
  }

  // 확정 후보: 요청한 시간 중 아직 'open' 인 것들
  type Req = { slot: AvailabilitySlot; label: string };
  const requested: Req[] = [
    ...(booking.preferred_slot
      ? [{ slot: booking.preferred_slot, label: a.preferred } as Req]
      : []),
    ...booking.alternative_slots.map(
      (slot): Req => ({ slot, label: a.alternatives }),
    ),
  ];

  const total = formatMoney(booking.estimated_total, currency);

  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-brand-900">{booking.customer_name}</p>
          <p className="text-sm text-muted">{booking.customer_contact}</p>
          {booking.customer_email && (
            <p className="text-xs text-muted">{booking.customer_email}</p>
          )}
        </div>
        <div className="text-right">
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[booking.status]}`}
          >
            {statusLabel(booking.status, dict)}
          </span>
          <p className="mt-1 text-xs tracking-widest text-brand-400">
            {booking.code}
          </p>
        </div>
      </div>

      {/* 시술 */}
      <div className="mt-3 rounded-xl bg-brand-50/60 p-3 text-sm">
        <ul className="space-y-0.5">
          {booking.services.map((l, i) => (
            <li key={i} className="flex justify-between">
              <span>
                {isEn ? l.name_en : l.name_ko}
                {l.unit === "per_finger" && ` ×${l.quantity}`}
              </span>
              <span>{formatMoney(l.subtotal, currency)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-1 flex justify-between border-t border-brand-100 pt-1 font-semibold text-brand-800">
          <span>{dict.common.total}</span>
          <span>{total}</span>
        </div>
      </div>

      {booking.note && (
        <p className="mt-2 whitespace-pre-line rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
          📝 {booking.note}
        </p>
      )}

      {/* 확정 시간 (confirmed) */}
      {booking.status === "confirmed" && booking.confirmed_slot && (
        <p className="mt-3 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800">
          ✅ {formatDateTime(booking.confirmed_slot.starts_at, locale)}
        </p>
      )}

      {/* 요청 시간 & 확정 컨트롤 (pending) */}
      {booking.status === "pending" && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold uppercase text-brand-400">
            {dict.status.preferredTime} / {a.alternatives}
          </p>
          {requested.length === 0 && (
            <p className="text-sm text-muted">-</p>
          )}
          {requested.map(({ slot, label }) => {
            const bookable = slot.status === "open";
            return (
              <div
                key={slot.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-brand-100 px-3 py-2"
              >
                <span className="text-sm">
                  <span className="mr-1 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-600">
                    {label}
                  </span>
                  {formatDateTime(slot.starts_at, locale)}
                </span>
                <button
                  disabled={pending || !bookable}
                  onClick={() =>
                    run(() =>
                      confirmBooking({
                        bookingId: booking.id,
                        slotId: slot.id,
                        message,
                      }),
                    )
                  }
                  className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {bookable ? a.approve : a.slotsBooked}
                </button>
              </div>
            );
          })}

          {/* 메시지 */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder={a.messageToCustomer}
            className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
          />

          {/* 다른 시간 제안 */}
          <button
            onClick={() => setShowPropose((v) => !v)}
            className="text-sm font-medium text-brand-600"
          >
            {showPropose ? "▲" : "▼"} {a.proposeOther}
          </button>
          {showPropose && (
            <div className="flex gap-2">
              <select
                value={otherSlot}
                onChange={(e) => setOtherSlot(e.target.value)}
                className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">{a.chooseConfirmSlot}</option>
                {openSlots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatDateTime(s.starts_at, locale)}
                  </option>
                ))}
              </select>
              <button
                disabled={pending || !otherSlot}
                onClick={() =>
                  run(() =>
                    confirmBooking({
                      bookingId: booking.id,
                      slotId: otherSlot,
                      message,
                    }),
                  )
                }
                className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                {dict.common.confirm}
              </button>
            </div>
          )}

          <button
            disabled={pending}
            onClick={() =>
              run(() =>
                declineBooking({ bookingId: booking.id, message }),
              )
            }
            className="w-full rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-40"
          >
            {a.decline}
          </button>
          <p className="text-[11px] text-muted">{a.reopenNote}</p>
        </div>
      )}

      {/* confirmed 컨트롤 */}
      {booking.status === "confirmed" && (
        <div className="mt-3 flex gap-2">
          <button
            disabled={pending}
            onClick={() =>
              run(() => completeBooking({ bookingId: booking.id }))
            }
            className="flex-1 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {a.markCompleted}
          </button>
          <button
            disabled={pending}
            onClick={() => run(() => cancelBooking({ bookingId: booking.id }))}
            className="flex-1 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-40"
          >
            {a.cancelBooking}
          </button>
        </div>
      )}

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}

function statusLabel(status: string, dict: Dict): string {
  const map: Record<string, string> = {
    pending: dict.status.status_pending,
    confirmed: dict.status.status_confirmed,
    declined: dict.status.status_declined,
    cancelled: dict.status.status_cancelled,
    completed: dict.status.status_completed,
  };
  return map[status] ?? status;
}
