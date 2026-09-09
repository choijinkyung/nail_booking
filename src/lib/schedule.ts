import { SLOT_MIN } from "./scheduling";

/** 가게 기준 시간대. 표시와 영업시간 계산은 모두 이 시간대의 '벽시계' 기준이다. */
export const SHOP_TZ = "America/Vancouver";

/** 요일별 반복 영업시간 (weekday: 0=일 … 6=토, start/end 는 자정부터의 분) */
export interface BusinessHour {
  weekday: number;
  enabled: boolean;
  start_min: number;
  end_min: number;
}

/** 예약 창 길이 허용 범위 — 너무 크면 한 번에 만드는 슬롯이 폭증한다. */
export const MIN_WINDOW_DAYS = 1;
export const MAX_WINDOW_DAYS = 60;

export function clampWindowDays(n: number): number {
  const v = Math.floor(Number(n) || 0);
  return Math.min(MAX_WINDOW_DAYS, Math.max(MIN_WINDOW_DAYS, v));
}

/**
 * 주어진 순간에 해당 시간대가 UTC보다 얼마나 앞서는지(ms).
 * Intl 로 그 시간대의 벽시계를 읽어 UTC 로 해석한 뒤 차이를 낸다.
 */
function zoneOffsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(
    g("year"),
    g("month") - 1,
    g("day"),
    g("hour"),
    g("minute"),
    g("second"),
  );
  return asUtc - at.getTime();
}

/**
 * 가게 시간대의 '벽시계' 시각(dayKey + 자정부터의 분) → UTC ISO.
 * 오프셋이 그 순간에 따라 달라지므로(서머타임) 두 번 수렴시킨다.
 */
export function zonedIso(
  dayKey: string,
  minutes: number,
  tz: string = SHOP_TZ,
): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const naive = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  let ts = naive;
  for (let i = 0; i < 2; i++) {
    ts = naive - zoneOffsetMs(new Date(ts), tz);
  }
  return new Date(ts).toISOString();
}

/** dayKey("YYYY-MM-DD") 의 요일. 0=일 … 6=토 */
export function weekdayOf(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** startDayKey 부터 days 일치의 dayKey 목록 (시작일 포함) */
export function dayKeysFrom(startDayKey: string, days: number): string[] {
  const [y, m, d] = startDayKey.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * 설정대로라면 '열려 있어야 하는' 슬롯 시작 시각(UTC ISO) 전체.
 * 순수 함수 — DB도 현재시각도 보지 않는다. 동기화 액션이 이 결과와
 * 실제 DB 상태를 비교해 생성/삭제할 대상을 정한다.
 */
export function plannedSlots(input: {
  todayDayKey: string;
  windowDays: number;
  hours: BusinessHour[];
  daysOff: string[];
}): string[] {
  const byWeekday = new Map(input.hours.map((h) => [h.weekday, h]));
  const off = new Set(input.daysOff);
  const out: string[] = [];

  for (const dayKey of dayKeysFrom(
    input.todayDayKey,
    clampWindowDays(input.windowDays),
  )) {
    if (off.has(dayKey)) continue;
    const h = byWeekday.get(weekdayOf(dayKey));
    if (!h || !h.enabled) continue;
    if (h.end_min <= h.start_min) continue;
    for (let t = h.start_min; t < h.end_min; t += SLOT_MIN) {
      out.push(zonedIso(dayKey, t));
    }
  }
  // 서머타임 전환일에는 벽시계 순서와 UTC 순서가 어긋날 수 있으므로 정렬한다.
  return [...new Set(out)].sort();
}
