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

const SHOP_TZ = "America/Vancouver";

/**
 * 가게 시간대 기준 요일 (0=일 … 6=토).
 * 주의: `new Date("2026-09-13").getDay()` 는 그 문자열을 UTC 자정으로 읽고
 * 실행 환경의 지역 시간으로 요일을 내므로, UTC보다 뒤진 시간대에서는
 * 하루 밀린다. 날짜 부분을 UTC 로 다시 조립해 getUTCDay 로 읽는다.
 */
function shopWeekday(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return new Date(Date.UTC(g("year"), g("month") - 1, g("day"))).getUTCDay();
}

/**
 * 오전/오후 판정. en-CA 는 dayPeriod 를 "a.m." 으로 주기 때문에
 * "AM" 과 문자열 비교하면 항상 오후가 된다. 시(hour)를 24시간제로 직접 읽는다.
 */
function isMorning(d: Date): boolean {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TZ,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(d);
  return Number(h.find((p) => p.type === "hour")?.value ?? 0) < 12;
}

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
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TZ,
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const mo = get("month");
  const day = get("day");
  const hour = get("hour");
  const min = get("minute");
  const am = isMorning(d);
  const dow = shopWeekday(d);

  if (locale === "ko") {
    return `${mo}/${day}(${KO_DAYS[dow]}) ${am ? "오전" : "오후"} ${hour}:${min}`;
  }
  return `${EN_DAYS[dow]} ${mo}/${day} ${hour}:${min} ${am ? "AM" : "PM"}`;
}

/** 날짜만 (그룹 헤더용) */
export function formatDateHeading(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dow = shopWeekday(d);
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
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const am = isMorning(d);
  if (locale === "ko") {
    return `${am ? "오전" : "오후"} ${get("hour")}:${get("minute")}`;
  }
  return `${get("hour")}:${get("minute")} ${am ? "AM" : "PM"}`;
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
