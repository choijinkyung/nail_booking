"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import type { AvailabilitySlot, BookingWithSlots } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { bookingDurationMin } from "@/lib/scheduling";
import {
  acceptProposedTime,
  reRequestBooking,
  submitCustomerRequest,
} from "@/app/actions";
import { Card } from "@/components/ui";
import { TimePicker } from "@/components/booking/TimePicker";

export function BookingActions({
  booking,
  futureSlots,
  dict,
  locale,
}: {
  booking: BookingWithSlots;
  futureSlots: AvailabilitySlot[];
  dict: Dict;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<null | "change" | "cancel">(null);
  const [message, setMessage] = useState("");
  const [proposedPick, setProposedPick] = useState("");
  const [rePicked, setRePicked] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const st = dict.status;
  const duration = bookingDurationMin(booking.services);

  const inputClass =
    "w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400";

  // ── 관리자가 가능시간을 안내한 경우: 손님이 선택 → 확정 ──
  if (booking.status === "pending" && booking.proposed_slots.length > 0) {
    return (
      <Card className="border-brand-300">
        <p className="text-sm font-semibold text-brand-800">
          {st.proposedTitle}
        </p>
        <p className="mt-1 mb-3 text-xs text-muted">{st.proposedDesc}</p>
        <div className="flex flex-wrap gap-2">
          {booking.proposed_slots.map((s) => (
            <button
              key={s.id}
              onClick={() => setProposedPick(s.id)}
              className={`rounded-xl border px-3.5 py-2.5 text-sm font-medium transition ${
                proposedPick === s.id
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-brand-200 bg-white text-brand-800 hover:bg-brand-50"
              }`}
            >
              {formatDateTime(s.starts_at, locale)}
            </button>
          ))}
        </div>
        <button
          disabled={pending || !proposedPick}
          onClick={() => {
            setErr("");
            startTransition(async () => {
              const res = await acceptProposedTime({
                code: booking.code,
                slotId: proposedPick,
              });
              if (res.ok) router.refresh();
              else setErr(st.requestErr);
            });
          }}
          className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {st.confirmThisTime}
        </button>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </Card>
    );
  }

  // ── 예약 불가(declined): 다른 시간으로 다시 요청 ──
  if (booking.status === "declined") {
    return (
      <Card>
        <p className="text-sm font-semibold text-brand-800">
          {st.reRequestOpen}
        </p>
        <p className="mt-1 mb-3 text-xs text-muted">{st.reRequestDesc}</p>
        <TimePicker
          slots={futureSlots}
          durationMin={duration}
          selected={rePicked}
          onChange={setRePicked}
          dict={dict}
          locale={locale}
        />
        <button
          disabled={pending || rePicked.length === 0}
          onClick={() => {
            setErr("");
            startTransition(async () => {
              const res = await reRequestBooking({
                code: booking.code,
                preferredSlotId: rePicked[0],
                alternativeSlotIds: rePicked.slice(1),
              });
              if (res.ok) router.refresh();
              else setErr(st.requestErr);
            });
          }}
          className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? dict.booking.submitting : st.reRequestSubmit}
        </button>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </Card>
    );
  }

  // 종료된 예약이면 액션 없음
  if (["cancelled", "completed"].includes(booking.status)) {
    return null;
  }

  // 이미 변경/취소 요청이 접수된 상태
  if (booking.request_kind === "change" || booking.request_kind === "cancel") {
    return (
      <Card className="border-amber-200 bg-amber-50/70">
        <p className="text-sm font-medium text-amber-900">
          {booking.request_kind === "change"
            ? st.requestPendingChange
            : st.requestPendingCancel}
        </p>
      </Card>
    );
  }

  function send(kind: "change" | "cancel") {
    setErr("");
    startTransition(async () => {
      const res = await submitCustomerRequest({
        code: booking.code,
        kind,
        message,
      });
      if (res.ok) {
        setMode(null);
        setMessage("");
        router.refresh();
      } else {
        setErr(st.requestErr);
      }
    });
  }

  return (
    <Card>
      {mode === null && (
        <div className="flex gap-2">
          <button
            onClick={() => setMode("change")}
            className="flex-1 rounded-xl border border-brand-300 px-3 py-2.5 text-sm font-medium text-brand-700"
          >
            🔄 {st.requestChange}
          </button>
          <button
            onClick={() => setMode("cancel")}
            className="flex-1 rounded-xl border border-red-200 px-3 py-2.5 text-sm font-medium text-red-600"
          >
            ❌ {st.requestCancel}
          </button>
        </div>
      )}

      {mode !== null && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            {mode === "change" ? st.changeDesc : st.cancelDesc}
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder={st.requestMessage}
            className={inputClass}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setMode(null)}
              className="rounded-xl border border-brand-200 px-4 py-2.5 text-sm font-medium text-brand-700"
            >
              {dict.common.back}
            </button>
            <button
              onClick={() => send(mode)}
              disabled={pending}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                mode === "cancel" ? "bg-red-500" : "bg-brand-600"
              }`}
            >
              {pending ? st.sending : st.sendRequest}
            </button>
          </div>
        </div>
      )}

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </Card>
  );
}
