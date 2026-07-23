import type { Locale } from "./i18n";
import type { AvailabilitySlot, ServiceUnit } from "./types";

/** 금액 포맷 ($35.00 / $35) */
export function formatMoney(amount: number, currency = "CAD"): string {
  const n = Number(amount) || 0;
  const hasCents = Math.round(n * 100) % 100 !== 0;
  const formatted = n.toLocaleString("en-CA", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
  const symbol = currency === "CAD" || currency === "USD" ? "$" : "";
  return `${symbol}${formatted}`;
}

/** 가격 표시 — price_from(이상)이면 "$30~" 처럼 물결을 붙인다. */
export function formatServicePrice(
  amount: number,
  currency = "CAD",
  from = false,
): string {
  return `${formatMoney(amount, currency)}${from ? "~" : ""}`;
}

const KO_DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const EN_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** 슬롯 시작 시각을 사람이 읽는 형식으로 (Vancouver 시간대) */
export function formatSlot(
  slot: Pick<AvailabilitySlot, "starts_at" | "ends_at">,
  locale: Locale,
): string {
  return formatDateTime(slot.starts_at, locale);
}

export function formatDateTime(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tz = "America/Vancouver";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const mo = get("month");
  const day = get("day");
  const hour = get("hour");
  const min = get("minute");
  const ap = get("dayPeriod");
  const dow = new Date(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d),
  ).getDay();

  if (locale === "ko") {
    return `${mo}/${day}(${KO_DAYS[dow]}) ${ap === "AM" ? "오전" : "오후"} ${hour}:${min}`;
  }
  return `${EN_DAYS[dow]} ${mo}/${day} ${hour}:${min} ${ap}`;
}

/** 날짜만 (그룹 헤더용) */
export function formatDateHeading(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tz = "America/Vancouver";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dow = new Date(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d),
  ).getDay();
  if (locale === "ko") {
    return `${get("year")}. ${get("month")}. ${get("day")} (${KO_DAYS[dow]})`;
  }
  return `${EN_DAYS[dow]}, ${get("month")}/${get("day")}/${get("year")}`;
}

/** datetime-local input 값(로컬 문자열)을 ISO로 — 관리자 입력용 */
export function localInputToISO(value: string): string {
  // value 예: "2026-07-10T14:00" (브라우저 로컬 기준). Date가 로컬로 해석 → ISO 저장
  const d = new Date(value);
  return d.toISOString();
}

/** Vancouver 기준 날짜 키 (YYYY-MM-DD) — 슬롯 그룹핑용 */
export function slotDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** 슬롯 시각만 (HH:MM AM/PM) — 그룹 내부 표시용 */
export function formatTimeOnly(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const ap = get("dayPeriod");
  if (locale === "ko") {
    return `${ap === "AM" ? "오전" : "오후"} ${get("hour")}:${get("minute")}`;
  }
  return `${get("hour")}:${get("minute")} ${ap}`;
}

/** 소요 시간(분) → "1시간 30분" / "1h 30m" */
export function formatDuration(min: number, locale: Locale): string {
  const m = Math.max(0, Math.round(Number(min) || 0));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (locale === "ko") {
    if (h && mm) return `${h}시간 ${mm}분`;
    if (h) return `${h}시간`;
    return `${mm}분`;
  }
  if (h && mm) return `${h}h ${mm}m`;
  if (h) return `${h}h`;
  return `${mm}m`;
}

export function unitLabel(unit: ServiceUnit, locale: Locale): string {
  if (unit === "per_finger") return locale === "ko" ? "손가락당" : "per finger";
  return "";
}
