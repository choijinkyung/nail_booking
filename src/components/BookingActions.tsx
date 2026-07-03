"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import type { AvailabilitySlot, BookingWithSlots } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { submitCustomerRequest } from "@/app/actions";
import { Card } from "@/components/ui";

export function BookingActions({
  booking,
  openSlots,
  dict,
  locale,
}: {
  booking: BookingWithSlots;
  openSlots: AvailabilitySlot[];
  dict: Dict;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<null | "change" | "cancel">(null);
  const [slotId, setSlotId] = useState("");
  const [message, setMessage] = useState("");
  const [err, setErr] = useState("");
  const st = dict.status;

  // 종료된 예약이면 액션 없음
  if (["cancelled", "declined", "completed"].includes(booking.status)) {
    return null;
  }

  // 이미 요청이 접수된 상태
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
        requestedSlotId: kind === "change" ? slotId : undefined,
      });
      if (res.ok) {
        setMode(null);
        setMessage("");
        setSlotId("");
        router.refresh();
      } else {
        setErr(st.requestErr);
      }
    });
  }

  const inputClass =
    "w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400";

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

      {mode === "change" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">{st.changeDesc}</p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-800">
              {st.pickNewTime}
            </span>
            <select
              value={slotId}
              onChange={(e) => setSlotId(e.target.value)}
              className={inputClass}
            >
              <option value="">{st.noNewTime}</option>
              {openSlots.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatDateTime(s.starts_at, locale)}
                </option>
              ))}
            </select>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder={st.requestMessage}
            className={inputClass}
          />
          <Actions
            onCancel={() => setMode(null)}
            onSend={() => send("change")}
            pending={pending}
            dict={dict}
          />
        </div>
      )}

      {mode === "cancel" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">{st.cancelDesc}</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder={st.requestMessage}
            className={inputClass}
          />
          <Actions
            onCancel={() => setMode(null)}
            onSend={() => send("cancel")}
            pending={pending}
            dict={dict}
            danger
          />
        </div>
      )}

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </Card>
  );
}

function Actions({
  onCancel,
  onSend,
  pending,
  dict,
  danger = false,
}: {
  onCancel: () => void;
  onSend: () => void;
  pending: boolean;
  dict: Dict;
  danger?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onCancel}
        className="rounded-xl border border-brand-200 px-4 py-2.5 text-sm font-medium text-brand-700"
      >
        {dict.common.back}
      </button>
      <button
        onClick={onSend}
        disabled={pending}
        className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
          danger ? "bg-red-500" : "bg-brand-600"
        }`}
      >
        {pending ? dict.status.sending : dict.status.sendRequest}
      </button>
    </div>
  );
}
