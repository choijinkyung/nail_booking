"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import type { AvailabilitySlot, Service } from "@/lib/types";
import {
  formatDateHeading,
  formatDuration,
  formatMoney,
  formatTimeOnly,
  unitLabel,
} from "@/lib/format";
import { REFERRAL_KEYS } from "@/lib/i18n";
import { createBooking } from "@/app/actions";
import { TimePicker } from "./TimePicker";

interface Props {
  locale: Locale;
  dict: Dict;
  services: Service[];
  slots: AvailabilitySlot[];
  notice: string;
  scheduleNote: string;
  currency: string;
}

const STEPS = ["step_service", "step_time", "step_info", "step_review"] as const;

export function BookingWizard(props: Props) {
  const { locale, dict, services, slots, notice, scheduleNote, currency } =
    props;
  const isEn = locale === "en";
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState(0);
  const [qty, setQty] = useState<Record<string, number>>({});
  // 고른 시간(순서 유지): [0] = 1지망, 나머지 = 대체
  const [pickedTimes, setPickedTimes] = useState<string[]>([]);
  const preferred = pickedTimes[0] ?? "";
  const alts = pickedTimes.slice(1);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState("");
  const [note, setNote] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [resultCode, setResultCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedServices = useMemo(
    () => services.filter((s) => qty[s.id] > 0),
    [services, qty],
  );
  const estimated = useMemo(
    () =>
      selectedServices.reduce((sum, s) => sum + Number(s.price) * qty[s.id], 0),
    [selectedServices, qty],
  );
  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + (s.duration_min || 0), 0),
    [selectedServices],
  );

  function toggleService(s: Service) {
    setQty((prev) => {
      const next = { ...prev };
      if (next[s.id] > 0) delete next[s.id];
      else next[s.id] = 1;
      return next;
    });
  }
  function changeQty(id: string, delta: number) {
    setQty((prev) => {
      const cur = prev[id] ?? 0;
      const val = Math.max(1, Math.min(10, cur + delta));
      return { ...prev, [id]: val };
    });
  }
  function validateStep(s: number): string {
    if (s === 0 && selectedServices.length === 0) return dict.booking.errService;
    if (s === 1 && pickedTimes.length === 0) return dict.booking.errPreferred;
    if (s === 2) {
      if (!name.trim()) return dict.booking.errName;
      if (!contact.trim()) return dict.booking.errContact;
      if (password.trim().length < 4) return dict.booking.errPassword;
    }
    return "";
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  function back() {
    setError("");
    setStep((s) => Math.max(0, s - 1));
  }

  function submit() {
    for (let i = 0; i <= 2; i++) {
      const err = validateStep(i);
      if (err) {
        setError(err);
        setStep(i);
        return;
      }
    }
    // 마지막 확인: 안내사항 동의 필수
    if (!agree) {
      setError(dict.booking.errAgree);
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await createBooking({
        services: selectedServices.map((s) => ({
          service_id: s.id,
          quantity: qty[s.id],
        })),
        preferred_slot_id: preferred,
        alternative_slot_ids: alts,
        customer_name: name,
        customer_contact: contact,
        customer_email: email,
        customer_password: password,
        referral_source: referral,
        note,
      });
      if (res.ok) setResultCode(res.code);
      else setError(mapError(res.error, dict));
    });
  }

  // ── 성공 화면 ─────────────────────────────────────────────
  if (resultCode) {
    return (
      <div className="mt-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
          🎉
        </div>
        <h1 className="text-xl font-bold text-brand-800">
          {dict.booking.successTitle}
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
          {dict.booking.successDesc}
        </p>
        <div className="mt-5 rounded-2xl border border-brand-200 bg-white p-5">
          <p className="text-xs text-muted">{dict.booking.yourCode}</p>
          <p className="mt-1 select-all text-3xl font-extrabold tracking-widest text-brand-700">
            {resultCode}
          </p>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(resultCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="mt-3 text-sm font-medium text-brand-600 hover:underline"
          >
            {copied ? dict.booking.copied : `📋 ${dict.booking.copyCode}`}
          </button>
        </div>
        <button
          onClick={() => router.push(`/status?code=${resultCode}`)}
          className="mt-6 w-full rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white"
        >
          {dict.booking.goLookup}
        </button>
      </div>
    );
  }

  // ── 위저드 ────────────────────────────────────────────────
  return (
    <div className="mt-3">
      <h1 className="text-xl font-bold text-brand-800">{dict.booking.title}</h1>

      {/* 진행 표시 */}
      <ol className="mt-4 flex items-center gap-2">
        {STEPS.map((key, i) => (
          <li key={key} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i <= step
                  ? "bg-brand-600 text-white"
                  : "bg-brand-100 text-brand-400"
              }`}
            >
              {i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 rounded ${
                  i < step ? "bg-brand-500" : "bg-brand-100"
                }`}
              />
            )}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm font-medium text-brand-600">
        {dict.booking[STEPS[step]]}
      </p>

      <div className="mt-4 min-h-[240px]">
        {/* Step 0: 시술 */}
        {step === 0 && (
          <div>
            <p className="mb-3 text-sm text-muted">
              {dict.booking.selectServices}
            </p>
            {services.length === 0 ? (
              <p className="text-sm text-muted">{dict.booking.noServices}</p>
            ) : (
              <div className="space-y-2">
                {services.map((s) => {
                  const on = qty[s.id] > 0;
                  const u = unitLabel(s.unit, locale);
                  return (
                    <div
                      key={s.id}
                      className={`rounded-2xl border p-4 transition ${
                        on
                          ? "border-brand-400 bg-brand-50"
                          : "border-brand-100 bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleService(s)}
                        className="flex w-full items-center justify-between text-left"
                      >
                        <span>
                          <span className="font-semibold text-brand-900">
                            {isEn ? s.name_en : s.name_ko}
                          </span>
                          {u && (
                            <span className="ml-1 text-xs text-muted">
                              ({formatMoney(s.price, currency)}/{u})
                            </span>
                          )}
                          <span className="ml-1 text-xs text-muted">
                            · ⏱ {formatDuration(s.duration_min, locale)}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          {s.unit === "flat" && (
                            <span className="font-semibold text-brand-700">
                              {formatMoney(s.price, currency)}
                            </span>
                          )}
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full border text-sm ${
                              on
                                ? "border-brand-500 bg-brand-500 text-white"
                                : "border-brand-200 text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                        </span>
                      </button>
                      {on && s.unit === "per_finger" && (
                        <div className="mt-3 flex items-center justify-between border-t border-brand-100 pt-3">
                          <span className="text-sm text-muted">
                            {dict.booking.fingers}
                          </span>
                          <div className="flex items-center gap-3">
                            <Stepper
                              onDec={() => changeQty(s.id, -1)}
                              onInc={() => changeQty(s.id, 1)}
                              value={qty[s.id]}
                            />
                            <span className="w-16 text-right font-semibold text-brand-700">
                              {formatMoney(Number(s.price) * qty[s.id], currency)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <TotalBar
              dict={dict}
              total={estimated}
              currency={currency}
              durationText={
                totalDuration > 0
                  ? formatDuration(totalDuration, locale)
                  : ""
              }
            />
          </div>
        )}

        {/* Step 1: 시간 (캘린더 → 30분 단위 시간) */}
        {step === 1 && (
          <div>
            <p className="mb-1 text-sm font-semibold text-brand-800">
              {dict.booking.pickTimes}
            </p>
            <p className="mb-3 text-xs text-muted">{dict.booking.pickTimesHint}</p>
            <TimePicker
              slots={slots}
              durationMin={totalDuration || 30}
              selected={pickedTimes}
              onChange={setPickedTimes}
              dict={dict}
              locale={locale}
            />
          </div>
        )}

        {/* Step 2: 정보 */}
        {step === 2 && (
          <div className="space-y-4">
            <Field label={`${dict.booking.name} *`}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                autoComplete="name"
              />
            </Field>
            <Field label={`${dict.booking.contact} *`}>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={dict.booking.email}>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                inputMode="email"
                className={inputClass}
                autoComplete="email"
              />
            </Field>
            <Field label={`${dict.booking.password} *`}>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                className={inputClass}
              />
            </Field>
            <Field label={dict.referral.label}>
              <select
                value={referral}
                onChange={(e) => setReferral(e.target.value)}
                className={inputClass}
              >
                <option value="">{dict.referral.none}</option>
                {REFERRAL_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {(dict.referral as Record<string, string>)[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={dict.booking.memo}>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className={inputClass}
              />
            </Field>
          </div>
        )}

        {/* Step 3: 확인 */}
        {step === 3 && (
          <div className="space-y-3">
            <ReviewRow label={dict.booking.reviewServices}>
              <ul className="space-y-1">
                {selectedServices.map((s) => (
                  <li key={s.id} className="flex justify-between">
                    <span>
                      {isEn ? s.name_en : s.name_ko}
                      {s.unit === "per_finger" && ` ×${qty[s.id]}`}
                    </span>
                    <span className="font-medium">
                      {formatMoney(Number(s.price) * qty[s.id], currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-between border-t border-brand-100 pt-2 font-bold text-brand-800">
                <span>{dict.booking.estimated}</span>
                <span>{formatMoney(estimated, currency)}</span>
              </div>
              {totalDuration > 0 && (
                <div className="mt-1 flex justify-between text-sm text-muted">
                  <span>⏱ {dict.booking.estimatedDuration}</span>
                  <span>{formatDuration(totalDuration, locale)}</span>
                </div>
              )}
            </ReviewRow>
            <ReviewRow label={dict.booking.reviewPreferred}>
              {slotLabel(slots, preferred, locale)}
            </ReviewRow>
            {alts.length > 0 && (
              <ReviewRow label={dict.booking.reviewAlternatives}>
                <ul className="space-y-0.5">
                  {alts.map((id) => (
                    <li key={id}>{slotLabel(slots, id, locale)}</li>
                  ))}
                </ul>
              </ReviewRow>
            )}
            <ReviewRow label={dict.booking.reviewInfo}>
              <p>{name}</p>
              <p className="text-muted">{contact}</p>
              {email && <p className="text-muted">{email}</p>}
              {note && <p className="mt-1 whitespace-pre-line">📝 {note}</p>}
            </ReviewRow>
            <p className="px-1 text-xs text-muted">
              {dict.booking.estimatedNote}
            </p>

            {/* 마지막 확인: 반려동물 안내 + 예약시간 변경 가능 안내 */}
            <div className="space-y-2 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="whitespace-pre-line">⚠️ {notice}</p>
              <p className="whitespace-pre-line border-t border-amber-200 pt-2">
                ⏰ {scheduleNote}
              </p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-200 bg-white p-3">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-0.5 h-5 w-5 accent-brand-600"
              />
              <span className="text-sm text-brand-900">{dict.booking.agree}</span>
            </label>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* 하단 내비게이션 */}
      <div className="mt-5 flex gap-3">
        {step > 0 && (
          <button
            onClick={back}
            className="rounded-xl border border-brand-200 px-5 py-3 font-semibold text-brand-700"
          >
            {dict.common.back}
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            onClick={next}
            className="flex-1 rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {dict.common.next}
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={pending}
            className="flex-1 rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {pending ? dict.booking.submitting : dict.booking.submitRequest}
          </button>
        )}
      </div>
    </div>
  );
}

// ── 하위 컴포넌트/헬퍼 ───────────────────────────────────────

const inputClass =
  "w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-brand-800">
        {label}
      </span>
      {children}
    </label>
  );
}

function Stepper({
  value,
  onInc,
  onDec,
}: {
  value: number;
  onInc: () => void;
  onDec: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onDec}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-200 text-lg text-brand-600"
      >
        −
      </button>
      <span className="w-6 text-center font-semibold">{value}</span>
      <button
        type="button"
        onClick={onInc}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-200 text-lg text-brand-600"
      >
        +
      </button>
    </div>
  );
}

function TotalBar({
  dict,
  total,
  currency,
  durationText,
}: {
  dict: Dict;
  total: number;
  currency: string;
  durationText?: string;
}) {
  return (
    <div className="mt-4 rounded-xl bg-brand-100/60 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-brand-800">
          {dict.booking.estimated}
        </span>
        <span className="text-lg font-bold text-brand-700">
          {formatMoney(total, currency)}
        </span>
      </div>
      {durationText && (
        <div className="mt-1 flex items-center justify-between text-sm text-muted">
          <span>⏱ {dict.booking.estimatedDuration}</span>
          <span className="font-medium text-brand-700">{durationText}</span>
        </div>
      )}
    </div>
  );
}

function ReviewRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-400">
        {label}
      </p>
      <div className="text-sm text-brand-900">{children}</div>
    </div>
  );
}

function slotLabel(
  slots: AvailabilitySlot[],
  id: string,
  locale: Locale,
): string {
  const s = slots.find((x) => x.id === id);
  if (!s) return "-";
  return `${formatDateHeading(s.starts_at, locale)} · ${formatTimeOnly(s.starts_at, locale)}`;
}

function mapError(code: string, dict: Dict): string {
  switch (code) {
    case "NO_SERVICE":
      return dict.booking.errService;
    case "NO_PREFERRED":
      return dict.booking.errPreferred;
    case "PASSWORD":
      return dict.booking.errPassword;
    case "SLOT_TAKEN":
      return dict.booking.noSlots;
    case "SETUP":
      return dict.admin.setupNeeded;
    default:
      return dict.booking.errGeneric;
  }
}
