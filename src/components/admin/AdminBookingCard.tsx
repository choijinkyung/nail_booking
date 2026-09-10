"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import type { AvailabilitySlot, BookingWithSlots } from "@/lib/types";
import { formatDateTime, formatMoney } from "@/lib/format";
import { fitFrom, sortSlots } from "@/lib/scheduling";
import { bookingLink } from "@/lib/shareLinks";
import { buildBookingShareText } from "@/lib/bookingShare";
import { ShareButtons } from "./ShareLinks";
import {
  cancelBooking,
  completeBooking,
  confirmBooking,
  declineBooking,
  dismissRequest,
  proposeTimes,
  resendPayment,
} from "@/app/admin/actions";

interface Props {
  booking: BookingWithSlots;
  openSlots: AvailabilitySlot[];
  dict: Dict;
  locale: Locale;
  currency: string;
  baseUrl: string;
  shopName: string;
  location: string;
  confirmedAddress: string;
}

// 임시: 확인 대기의 '다른 시간 제안 / 가능시간 안내' UI를 화면에서 숨김 (코드는 유지)
const SHOW_PROPOSE_TIMES = false;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
  completed: "bg-brand-100 text-brand-900",
};

export function AdminBookingCard({
  booking,
  openSlots,
  dict,
  locale,
  currency,
  baseUrl,
  shopName,
  location,
  confirmedAddress,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState(booking.admin_message ?? "");
  const [showOffer, setShowOffer] = useState(false);
  const [offerSlots, setOfferSlots] = useState<string[]>([]);
  const [showChangeTime, setShowChangeTime] = useState(false);
  const [changeSlot, setChangeSlot] = useState("");
  const [resent, setResent] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [finalPrice, setFinalPrice] = useState(
    String(booking.estimated_total ?? 0),
  );
  const [tip, setTip] = useState("0");
  const [err, setErr] = useState("");
  const a = dict.admin;
  const isEn = locale === "en";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErr("");
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else
        setErr(
          res.error === "SLOT_TAKEN"
            ? a.slotBookedWarn
            : res.error === "NOT_STARTED"
              ? a.completeTooEarly
              : dict.booking.errGeneric,
        );
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

  // 아직 시작 전(미래) 예약은 완료 처리 불가
  const notStarted =
    !!booking.confirmed_slot &&
    booking.confirmed_slot.starts_at > new Date().toISOString();

  // 확정시간 변경 후보: 열려 있는 모든 미래 시간 중, 시술 소요시간이 들어가는 곳.
  // 서버(confirmBooking)는 원래 아무 시간이나 받고 자리가 되는지만 보므로,
  // 손님이 고른 시간으로 좁힐 이유가 없다. 이 예약이 지금 점유한 슬롯도
  // 서버가 먼저 반납하므로 후보 계산에서 열린 것으로 친다.
  const changeCandidates = useMemo(() => {
    const nowIso = new Date().toISOString();
    const mine = new Set(booking.occupied_slot_ids ?? []);
    const pool = sortSlots(
      openSlots
        .filter((s) => s.starts_at >= nowIso)
        .concat(
          (booking.confirmed_slot ? [booking.confirmed_slot] : []).filter(
            (s) => s.starts_at >= nowIso,
          ),
        )
        .filter(
          (s, i, arr) => arr.findIndex((x) => x.id === s.id) === i,
        )
        .map((s) => (mine.has(s.id) ? { ...s, status: "open" } : s)),
    );
    const duration = booking.services.reduce(
      (sum, l) => sum + (l.duration_min || 0),
      0,
    );
    return pool.filter(
      (s) =>
        s.id !== booking.confirmed_slot?.id &&
        s.status === "open" &&
        fitFrom(pool, s.id, duration || 30),
    );
  }, [openSlots, booking]);

  return (
    <div className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
      {/* 헤더 */}
      {/* 이 카드에서 가장 먼저 읽어야 하는 것은 언제인가 — 맨 위에 크게 둔다 */}
      {booking.confirmed_slot && (
        <p className="mb-2 text-[17px] font-bold text-brand-900">
          {formatDateTime(booking.confirmed_slot.starts_at, locale)}
        </p>
      )}

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
          {/* 코드만으로 열리는 링크 — 관리자가 대신 잡아준 예약도 손님이 확인할 수 있다 */}
          <span className="mt-1.5 flex justify-end">
            <ShareButtons
              url={bookingLink(baseUrl, booking.code)}
              text={buildBookingShareText({
                shopName,
                locale,
                currency,
                location,
                confirmedAddress,
                confirmedIso: booking.confirmed_slot?.starts_at ?? null,
                preferredIso: booking.preferred_slot?.starts_at ?? null,
                services: booking.services,
                total:
                  (booking.final_price ?? booking.estimated_total) +
                  (booking.tip ?? 0),
              })}
              dict={dict}
              compact
            />
          </span>
        </div>
      </div>

      {/* 손님 변경/취소 요청 배너 */}
      {booking.request_kind && (
        <div className="mt-3 rounded-md border-2 border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-bold text-amber-900">
            {booking.request_kind === "change"
              ? a.requestBadgeChange
              : a.requestBadgeCancel}
          </p>
          {booking.change_request && (
            <p className="mt-1 whitespace-pre-line text-sm text-amber-900">
              “{booking.change_request}”
            </p>
          )}
          {booking.request_kind === "change" && booking.requested_slot && (
            <p className="mt-1 text-sm text-amber-900">
              {a.customerRequestedTime}:{" "}
              <b>{formatDateTime(booking.requested_slot.starts_at, locale)}</b>
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {booking.request_kind === "change" &&
              booking.requested_slot &&
              booking.requested_slot.status === "open" && (
                <button
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      confirmBooking({
                        bookingId: booking.id,
                        slotId: booking.requested_slot!.id,
                        message,
                      }),
                    )
                  }
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {a.approveChange}
                </button>
              )}
            {booking.request_kind === "cancel" && (
              <button
                disabled={pending}
                onClick={() =>
                  run(() =>
                    cancelBooking({ bookingId: booking.id, message }),
                  )
                }
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {a.approveCancel}
              </button>
            )}
            <button
              disabled={pending}
              onClick={() =>
                run(() => dismissRequest({ bookingId: booking.id, message }))
              }
              className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 disabled:opacity-40"
            >
              {a.dismissRequest}
            </button>
          </div>
        </div>
      )}

      {/* 시술 */}
      <div className="mt-3 rounded-md bg-brand-50/60 p-3 text-sm">
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
        <div className="mt-1 flex justify-between border-t border-brand-100 pt-1 font-semibold text-brand-900">
          <span>{dict.common.total}</span>
          <span>{total}</span>
        </div>
      </div>

      {booking.note && (
        <p className="mt-2 whitespace-pre-line rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
          {booking.note}
        </p>
      )}

      {booking.early_contact && (
        <p className="mt-2 rounded-lg border border-brand-300 bg-brand-50 p-2 text-sm font-semibold text-brand-900">
          {a.earlyContactBadge}
        </p>
      )}

      {booking.reference_url && (
        <a
          href={booking.reference_url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={booking.reference_url}
            alt="reference"
            className="h-24 w-24 rounded-lg border border-brand-100 object-cover"
          />
          <span className="mt-0.5 block text-[11px] text-muted">
            {dict.booking.reference.split(" (")[0]}
          </span>
        </a>
      )}

      {/* 요청 시간 & 확정 컨트롤 (pending) */}
      {booking.status === "pending" && (
        <div className="mt-3 space-y-2">
          <p className="text-[13px] font-semibold text-brand-400">
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
                className="flex items-center justify-between gap-2 rounded-md border border-brand-100 px-3 py-2"
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
            className="w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
          />

          {/* 다른 시간 제안 / 조정 — 가능한 시간 여러 개를 골라 손님에게 보내면 손님이 선택 */}
          {SHOW_PROPOSE_TIMES && (
            <button
              onClick={() => setShowOffer((v) => !v)}
              className="text-sm font-medium text-brand-600"
            >
              {showOffer ? "⌃" : "⌄"} {a.proposeOther}
            </button>
          )}
          {showOffer && (
            <div className="rounded-md border border-brand-100 p-2">
              <p className="mb-2 text-xs text-muted">{a.proposeHint}</p>
              <div className="flex flex-wrap gap-1.5">
                {openSlots.map((s) => {
                  const on = offerSlots.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() =>
                        setOfferSlots((prev) =>
                          on
                            ? prev.filter((x) => x !== s.id)
                            : [...prev, s.id],
                        )
                      }
                      className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                        on
                          ? "border-brand-500 bg-brand-500 text-white"
                          : "border-brand-200 bg-white text-brand-900"
                      }`}
                    >
                      {formatDateTime(s.starts_at, locale)}
                    </button>
                  );
                })}
              </div>
              <button
                disabled={pending || offerSlots.length === 0}
                onClick={() =>
                  run(() =>
                    proposeTimes({
                      bookingId: booking.id,
                      slotIds: offerSlots,
                      message,
                    }),
                  )
                }
                className="mt-2 w-full rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                {a.proposeSend}
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
            className="w-full rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-40"
          >
            {a.decline}
          </button>
          <p className="text-[11px] text-muted">{a.reopenNote}</p>
        </div>
      )}

      {/* confirmed 컨트롤 */}
      {booking.status === "confirmed" && !showComplete && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <button
              disabled={pending}
              onClick={() => setShowComplete(true)}
              className="flex-1 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {a.markCompleted}
            </button>
            <button
              disabled={pending}
              onClick={() => run(() => cancelBooking({ bookingId: booking.id }))}
              className="flex-1 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-40"
            >
              {a.cancelBooking}
            </button>
          </div>
          {notStarted && (
            <p className="text-[11px] text-muted">{a.completeEarlyNote}</p>
          )}
          {/* 확정 후에도 시간 변경 가능 */}
          <button
            onClick={() => setShowChangeTime((v) => !v)}
            className="text-sm font-medium text-brand-600"
          >
            {showChangeTime ? "⌃" : "⌄"} {a.changeTime}
          </button>
          {showChangeTime && (
            <div className="flex gap-2">
              <select
                value={changeSlot}
                onChange={(e) => setChangeSlot(e.target.value)}
                disabled={changeCandidates.length === 0}
                className="w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">
                  {changeCandidates.length === 0
                    ? a.noOtherChosenTimes
                    : a.chooseConfirmSlot}
                </option>
                {changeCandidates.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatDateTime(s.starts_at, locale)}
                  </option>
                ))}
              </select>
              <button
                disabled={pending || !changeSlot}
                onClick={() =>
                  run(() =>
                    confirmBooking({
                      bookingId: booking.id,
                      slotId: changeSlot,
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
          {showChangeTime && (
            <p className="text-[11px] text-muted">{a.changeTimeHint}</p>
          )}
        </div>
      )}

      {/* 완료 처리: 금액 + 팁 입력 */}
      {booking.status === "confirmed" && showComplete && (
        <div className="mt-3 space-y-2 rounded-md border border-brand-200 bg-brand-50/50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs text-muted">
                {a.finalPriceLabel} ({currency})
              </span>
              <input
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">
                {a.tipLabel} ({currency})
              </span>
              <input
                value={tip}
                onChange={(e) => setTip(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="flex justify-between px-1 text-sm font-semibold text-brand-900">
            <span>{dict.common.total}</span>
            <span>
              {formatMoney(
                (Number(finalPrice) || 0) + (Number(tip) || 0),
                currency,
              )}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowComplete(false)}
              className="rounded-lg border border-brand-200 px-3 py-2 text-xs text-brand-900"
            >
              {dict.common.cancel}
            </button>
            <button
              disabled={pending}
              onClick={() =>
                run(() =>
                  completeBooking({
                    bookingId: booking.id,
                    finalPrice: Number(finalPrice) || 0,
                    tip: Number(tip) || 0,
                  }),
                )
              }
              className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              {a.completeSend}
            </button>
          </div>
        </div>
      )}

      {/* 완료된 예약: 금액 표시 */}
      {booking.status === "completed" && (
        <div className="mt-3 rounded-md bg-brand-50/60 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">{a.finalPriceLabel}</span>
            <span>{formatMoney(booking.final_price ?? booking.estimated_total, currency)}</span>
          </div>
          {booking.tip > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">{a.tipLabel}</span>
              <span>{formatMoney(booking.tip, currency)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-brand-100 pt-1 font-semibold text-brand-900">
            <span>{dict.common.total}</span>
            <span>
              {formatMoney(
                (booking.final_price ?? booking.estimated_total) +
                  (booking.tip ?? 0),
                currency,
              )}
            </span>
          </div>
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await resendPayment({ bookingId: booking.id });
                if (res.ok) {
                  setResent(true);
                  setTimeout(() => setResent(false), 2000);
                } else {
                  setErr(dict.booking.errGeneric);
                }
              })
            }
            className="mt-2 w-full rounded-lg border border-brand-300 px-3 py-2 text-xs font-semibold text-brand-900 disabled:opacity-40"
          >
            {resent ? `✓ ${a.resent}` : `💌 ${a.resendPayment}`}
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
