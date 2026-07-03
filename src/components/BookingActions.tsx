"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import type { AvailabilitySlot, BookingWithSlots } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { reRequestBooking, submitCustomerRequest } from "@/app/actions";
import { Card } from "@/components/ui";
import { SlotGroups, groupByDay } from "@/components/booking/SlotGroups";

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
  const [rePreferred, setRePreferred] = useState("");
  const [reAlts, setReAlts] = useState<string[]>([]);
  const st = dict.status;
  const slotsByDay = useMemo(() => groupByDay(openSlots), [openSlots]);

  function reRequest() {
    setErr("");
    startTransition(async () => {
      const res = await reRequestBooking({
        code: booking.code,
        preferredSlotId: rePreferred,
        alternativeSlotIds: reAlts,
      });
      if (res.ok) router.refresh();
      else setErr(st.requestErr);
    });
  }

  // 예약 불가(declined): 처음부터 다시 하지 않고 다른 시간으로 재요청
  if (booking.status === "declined") {
    return (
      <Card>
        <p className="text-sm font-semibold text-brand-800">
          {st.reRequestOpen}
        </p>
        <p className="mt-1 mb-3 text-xs text-muted">{st.reRequestDesc}</p>
        {openSlots.length === 0 ? (
          <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-700">
            {dict.booking.noSlots}
          </p>
        ) : (
          <>
            <p className="mb-2 text-sm font-semibold text-brand-800">
              {dict.booking.pickPreferred}
            </p>
            <SlotGroups
              slotsByDay={slotsByDay}
              locale={locale}
              selectedIds={rePreferred ? [rePreferred] : []}
              onPick={(id) => {
                setRePreferred(id);
                setReAlts((prev) => prev.filter((x) => x !== id));
              }}
              badge={dict.booking.preferredBadge}
              badgeClass="bg-brand-600"
            />
            <p className="mb-2 mt-5 text-sm font-semibold text-brand-800">
              {dict.booking.pickAlternatives}
            </p>
            <SlotGroups
              slotsByDay={slotsByDay}
              locale={locale}
              selectedIds={reAlts}
              disabledIds={rePreferred ? [rePreferred] : []}
              onPick={(id) =>
                setReAlts((prev) =>
                  prev.includes(id)
                    ? prev.filter((x) => x !== id)
                    : [...prev, id],
                )
              }
              badge={dict.booking.altBadge}
              badgeClass="bg-brand-400"
            />
            <button
              onClick={reRequest}
              disabled={pending || !rePreferred}
              className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? dict.booking.submitting : st.reRequestSubmit}
            </button>
          </>
        )}
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </Card>
    );
  }

  // 종료된 예약이면 액션 없음
  if (["cancelled", "completed"].includes(booking.status)) {
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
