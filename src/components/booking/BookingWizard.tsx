"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import type { AvailabilitySlot, Service } from "@/lib/types";
import {
  formatDateHeading,
  formatDuration,
  formatMoney,
  formatServicePrice,
  formatTimeOnly,
  unitLabel,
} from "@/lib/format";
import { REFERRAL_KEYS } from "@/lib/i18n";
import { createBooking, uploadReferenceImage } from "@/app/actions";
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

const STEPS = [
  "step_service",
  "step_time",
  "step_alt",
  "step_info",
  "step_review",
] as const;

export function BookingWizard(props: Props) {
  const { locale, dict, services, slots, notice, scheduleNote, currency } =
    props;
  const isEn = locale === "en";
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  // 단계를 넘기면 스크롤이 이전 위치에 남아 다음 화면의 중간부터 보인다.
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [step]);
  const [qty, setQty] = useState<Record<string, number>>({});
  // 1지망은 하나, 대체 시간은 여러 개(선택 사항) — 서로 다른 단계에서 고른다.
  const [preferredPick, setPreferredPick] = useState<string[]>([]);
  const [altPicks, setAltPicks] = useState<string[]>([]);
  const preferred = preferredPick[0] ?? "";
  const alts = altPicks.filter((id) => id !== preferred);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [referral, setReferral] = useState("");
  const [refFile, setRefFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [earlyContact, setEarlyContact] = useState(false);
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
    if (s === 1 && !preferred) return dict.booking.errPreferred;
    // s === 2 (대체 시간)는 선택 사항이라 검증하지 않는다.
    if (s === 3) {
      if (!name.trim()) return dict.booking.errName;
      if (!contact.trim()) return dict.booking.errContact;
      // 이름+전화번호로 조회하므로 번호에 숫자가 있어야 한다.
      if (!/\d/.test(contact)) return dict.booking.errContactDigits;
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
      // 레퍼런스 사진 먼저 업로드 (있으면)
      let reference_url = "";
      let reference_path = "";
      if (refFile) {
        const fd = new FormData();
        fd.append("file", refFile);
        const up = await uploadReferenceImage(fd);
        if (up.ok) {
          reference_url = up.url;
          reference_path = up.path;
        }
      }
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
        referral_source: referral,
        reference_url,
        reference_path,
        note,
        early_contact: earlyContact,
      });
      if (res.ok) setResultCode(res.code);
      else setError(mapError(res.error, dict));
    });
  }

  // ── 성공 화면 ─────────────────────────────────────────────
  if (resultCode) {
    return (
      <div className="mt-6 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-xl text-white">
          ✓
        </div>
        <h1 className="text-xl font-bold text-brand-900">
          {dict.booking.successTitle}
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
          {dict.booking.successDesc}
        </p>
        <div className="mt-5 rounded-lg border border-brand-200 bg-white p-5">
          <p className="text-xs text-muted">{dict.booking.yourCode}</p>
          <p className="mt-1 select-all text-3xl font-extrabold tracking-widest text-brand-900">
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
            {copied ? dict.booking.copied : dict.booking.copyCode}
          </button>
        </div>
        <button
          onClick={() => router.push(`/status?code=${resultCode}`)}
          className="mt-6 w-full rounded-md bg-brand-600 px-5 py-3 font-semibold text-white"
        >
          {dict.booking.goLookup}
        </button>
      </div>
    );
  }

  // ── 위저드 ────────────────────────────────────────────────
  return (
    <div className="mt-3">
      <div ref={topRef} className="scroll-mt-20" />
      <h1 className="text-[22px] font-bold text-brand-900">
        {dict.booking.title}
      </h1>

      {/* 진행 표시 — 얇은 선 하나로 어디까지 왔는지만 보여준다 */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <p className="text-[15px] font-semibold text-brand-900">
            {dict.booking[STEPS[step]]}
          </p>
          <p className="text-xs text-muted">
            {step + 1} / {STEPS.length}
          </p>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-brand-100">
          <div
            className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-6 min-h-[280px]">
        {/* Step 0: 시술 */}
        {step === 0 && (
          <div>
            <p className="mb-3 text-sm text-muted">
              {dict.booking.selectServices}
            </p>
            {services.length === 0 ? (
              <p className="text-sm text-muted">{dict.booking.noServices}</p>
            ) : (
              <div className="divide-y divide-brand-100 border-y border-brand-100">
                {services.map((s) => {
                  const on = qty[s.id] > 0;
                  const u = unitLabel(s.unit, locale);
                  return (
                    <div key={s.id} className="py-3">
                      <button
                        type="button"
                        onClick={() => toggleService(s)}
                        className="flex w-full items-center gap-3 py-1 text-left"
                      >
                        {/* 체크는 왼쪽, 가격은 오른쪽 — 줄 전체가 눌린다 */}
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] ${
                            on
                              ? "border-brand-600 bg-brand-600 text-white"
                              : "border-brand-200 text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-brand-900">
                            {isEn ? s.name_en : s.name_ko}
                          </span>
                          <span className="mt-0.5 block text-[13px] text-muted">
                            {formatDuration(s.duration_min, locale)}
                          </span>
                        </span>
                        <span className="shrink-0 text-right font-semibold text-brand-900">
                          {formatServicePrice(s.price, currency, s.price_from)}
                          {u && (
                            <span className="block text-[12px] font-normal text-muted">
                              /{u}
                            </span>
                          )}
                        </span>
                      </button>
                      {on && s.unit === "per_finger" && (
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-sm text-muted">
                            {dict.booking.fingers}
                          </span>
                          <div className="flex items-center gap-3">
                            <Stepper
                              onDec={() => changeQty(s.id, -1)}
                              onInc={() => changeQty(s.id, 1)}
                              value={qty[s.id]}
                            />
                            <span className="w-16 text-right font-semibold text-brand-900">
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

        {/* Step 1: 1지망 시간 (하나만) */}
        {step === 1 && (
          <div>
            <p className="mb-1 text-sm font-semibold text-brand-900">
              {dict.booking.pickPreferred}
            </p>
            <p className="mb-3 text-xs text-muted">
              {dict.booking.pickPreferredHint}
            </p>
            <TimePicker
              slots={slots}
              durationMin={totalDuration || 30}
              selected={preferredPick}
              onChange={setPreferredPick}
              dict={dict}
              locale={locale}
              single
            />
          </div>
        )}

        {/* Step 2: 대체 시간 — 선택 사항 */}
        {step === 2 && (
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="text-sm font-semibold text-brand-900">
                {dict.booking.pickAlts}
              </p>
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-600">
                {dict.booking.optional}
              </span>
            </div>
            <p className="mb-3 text-xs text-muted">{dict.booking.pickAltsHint}</p>
            <TimePicker
              slots={slots.filter((s) => s.id !== preferred)}
              durationMin={totalDuration || 30}
              selected={altPicks}
              onChange={setAltPicks}
              dict={dict}
              locale={locale}
            />
            <button
              onClick={() => {
                setAltPicks([]);
                setStep(3);
              }}
              className="mt-4 w-full rounded-md border border-brand-200 px-4 py-2.5 text-sm font-medium text-muted"
            >
              {dict.booking.skipAlts}
            </button>
          </div>
        )}

        {/* Step 3: 정보 */}
        {step === 3 && (
          <div className="space-y-4">
            {/* 방문 전 안내 — 정보를 적기 전에 먼저 읽어야 하는 내용이다 */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
              <p className="font-bold">{dict.landing.noticeTitle}</p>
              <p className="mt-1 whitespace-pre-line">{notice}</p>
              <p className="mt-3 whitespace-pre-line border-t border-amber-200 pt-3">
                {scheduleNote}
              </p>
            </div>

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
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-muted">
                {dict.booking.contactHint}
              </p>
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
            <Field label={dict.booking.reference}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setRefFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-brand-900 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-2 file:text-brand-900"
              />
              {refFile && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={URL.createObjectURL(refFile)}
                  alt="reference"
                  className="mt-2 h-24 w-24 rounded-lg object-cover"
                />
              )}
            </Field>

            {/* 디자인/재료 안내 — 원하는 디자인 첨부 유도 + 사전 컨펌 책임 */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
              <p className="font-bold">{dict.booking.designNoticeTitle}</p>
              <p className="mt-1 whitespace-pre-line">
                {dict.booking.designNotice}
              </p>
            </div>

            <Field label={dict.booking.memo}>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className={inputClass}
              />
            </Field>

            {/* 일찍 시술 가능 시 연락받기 — 눈에 띄게 강조 */}
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-200 bg-surface p-4">
              <input
                type="checkbox"
                checked={earlyContact}
                onChange={(e) => setEarlyContact(e.target.checked)}
                className="mt-0.5 h-5 w-5 accent-brand-600"
              />
              <span>
                <span className="block text-sm font-bold text-brand-900">
                  {dict.booking.earlyContactTitle}
                </span>
                <span className="mt-0.5 block text-xs text-brand-900">
                  {dict.booking.earlyContactDesc}
                </span>
              </span>
            </label>
          </div>
        )}

        {/* Step 3: 확인 */}
        {step === 4 && (
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
              <div className="mt-2 flex justify-between border-t border-brand-100 pt-2 font-bold text-brand-900">
                <span>{dict.booking.estimated}</span>
                <span>{formatMoney(estimated, currency)}</span>
              </div>
              {totalDuration > 0 && (
                <div className="mt-1 flex justify-between text-sm text-muted">
                  <span>{dict.booking.estimatedDuration}</span>
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
              {note && <p className="mt-1 whitespace-pre-line">{note}</p>}
            </ReviewRow>
            <p className="px-1 text-xs text-muted">
              {dict.booking.estimatedNote}
            </p>

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-brand-200 bg-white p-3">
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
      <div className="safe-b sticky bottom-0 z-20 mt-6 flex gap-2 border-t border-brand-100 bg-white/90 pt-3 backdrop-blur-md">
        {step > 0 && (
          <button
            onClick={back}
            className="min-h-12 rounded-md border border-brand-200 px-5 text-[15px] font-semibold text-brand-900"
          >
            {dict.common.back}
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            onClick={next}
            disabled={validateStep(step) !== ""}
            className="min-h-12 flex-1 rounded-md bg-brand-600 px-5 text-[15px] font-semibold text-white disabled:opacity-40"
          >
            {dict.common.next}
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={pending || !agree || !preferred}
            className="min-h-12 flex-1 rounded-md bg-brand-600 px-5 text-[15px] font-semibold text-white disabled:opacity-40"
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
  "w-full rounded-md border border-brand-200 bg-white px-4 py-3 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-brand-900">
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
    <div className="mt-4 rounded-md bg-brand-100/60 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-brand-900">
          {dict.booking.estimated}
        </span>
        <span className="text-lg font-bold text-brand-900">
          {formatMoney(total, currency)}
        </span>
      </div>
      {durationText && (
        <div className="mt-1 flex items-center justify-between text-sm text-muted">
          <span>{dict.booking.estimatedDuration}</span>
          <span className="font-medium text-brand-900">{durationText}</span>
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
    <div className="rounded-lg border border-brand-100 bg-white p-4">
      <p className="mb-1 text-[13px] font-semibold text-brand-400">
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
    case "NO_ALTERNATIVE":
      return dict.booking.errAlternative;
    case "SLOT_TAKEN":
      return dict.booking.noSlots;
    case "SETUP":
      return dict.admin.setupNeeded;
    default:
      return dict.booking.errGeneric;
  }
}
