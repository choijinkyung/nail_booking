/**
 * 가게 시간대(America/Vancouver) 계산.
 *
 * 왜 Intl 에 맡기지 않는가: 배포 환경(Vercel)의 시간대 데이터가 11월 이후의
 * 서머타임 종료를 반영하지 못해, 서버는 "오전 10시"라고 표시하는 시각이
 * 손님 폰에서는 오전 9시로 보였다. 실행 환경마다 답이 달라지는 것을 막기
 * 위해 규칙을 코드에 둔다.
 *
 * 규칙(2007년 이후 미국·캐나다 태평양 시간대):
 *   · 서머타임 시작 — 3월 두 번째 일요일 02:00 표준시 = 10:00 UTC
 *   · 서머타임 종료 — 11월 첫 번째 일요일 02:00 서머시 = 09:00 UTC
 *   · PST = UTC-8, PDT = UTC-7
 */

export const PST_MINUTES = -480;
export const PDT_MINUTES = -420;

/** 해당 연·월의 n번째 일요일 날짜(1-31). month 는 0-based. */
function nthSunday(year: number, month: number, n: number): number {
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const firstSunday = 1 + ((7 - firstDow) % 7);
  return firstSunday + (n - 1) * 7;
}

/** 주어진 순간에 가게가 UTC 대비 몇 분 앞/뒤인지 */
export function shopOffsetMinutes(at: Date): number {
  const y = at.getUTCFullYear();
  const start = Date.UTC(y, 2, nthSunday(y, 2, 2), 10, 0, 0); // 3월 둘째 일요일 10:00Z
  const end = Date.UTC(y, 10, nthSunday(y, 10, 1), 9, 0, 0); // 11월 첫 일요일 09:00Z
  const t = at.getTime();
  return t >= start && t < end ? PDT_MINUTES : PST_MINUTES;
}

export interface WallClock {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
  hour: number;
  minute: number;
  /** 0=일 … 6=토 */
  weekday: number;
}

/** UTC 순간 → 가게 벽시계 */
export function shopWallClock(at: Date): WallClock {
  const shifted = new Date(at.getTime() + shopOffsetMinutes(at) * 60000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** 가게 기준 날짜 키 (YYYY-MM-DD) */
export function shopDayKey(at: Date): string {
  const w = shopWallClock(at);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${w.year}-${p(w.month)}-${p(w.day)}`;
}

/**
 * 가게 벽시계(dayKey + 자정부터의 분) → UTC ISO.
 * 오프셋이 그 순간에 따라 달라지므로 두 번 수렴시킨다.
 */
export function wallClockToIso(dayKey: string, minutes: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  let ts = naive;
  for (let i = 0; i < 2; i++) {
    ts = naive - shopOffsetMinutes(new Date(ts)) * 60000;
  }
  return new Date(ts).toISOString();
}
