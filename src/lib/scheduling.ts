import type { BookingServiceLine } from "./types";

export const SLOT_MIN = 30; // 예약 슬롯 단위(분)

/**
 * 예약 사이에 남는 '연속 open' 공백의 최소 허용 길이(분).
 * 미용실/네일 예약처럼: 뒤 예약까지 30분만 비면 아무것도 못 받고(막힘),
 * 1시간부터 짧은 시술(제거 등)만 받을 수 있게 하는 하한선.
 * 60분 미만(=단독 30분 공백)인 구간은 어떤 시술도 시작할 수 없다.
 */
export const MIN_GAP_MIN = 60;

/** 소요시간(분) → 필요한 30분 슬롯 개수 */
export function neededSlots(durationMin: number): number {
  return Math.max(1, Math.ceil((Number(durationMin) || SLOT_MIN) / SLOT_MIN));
}

/** 예약 시술들의 총 소요시간(분) */
export function bookingDurationMin(lines: BookingServiceLine[]): number {
  const sum = (lines ?? []).reduce((s, l) => s + (l.duration_min || 0), 0);
  return sum > 0 ? sum : SLOT_MIN;
}

type SlotLite = { id: string; starts_at: string; status: string };

/**
 * 시간순 정렬된 slots 에서, startId 부터 durationMin 을 채울 수 있는지 검사.
 * 채울 수 있으면 점유할 슬롯 id 배열을, 불가하면 null 을 반환.
 * (연속된 30분 open 슬롯이 duration 만큼 있어야 함)
 */
export function fitFrom(
  slots: SlotLite[],
  startId: string,
  durationMin: number,
): string[] | null {
  const need = neededSlots(durationMin);
  const idx = slots.findIndex((s) => s.id === startId);
  if (idx < 0) return null;
  const ids: string[] = [];
  let expected = new Date(slots[idx].starts_at).getTime();
  for (let k = 0; k < need; k++) {
    const s = slots[idx + k];
    if (!s) return null;
    if (new Date(s.starts_at).getTime() !== expected) return null; // 30분 연속 아님
    if (s.status !== "open") return null; // 이미 점유됨
    ids.push(s.id);
    expected += SLOT_MIN * 60000;
  }
  return ids;
}

/**
 * 시간순 정렬된 slots 에서 startId 가 속한 '연속 open' 구간의 총 길이(분).
 * 앞/뒤로 30분 간격이 이어지고 status 가 open 인 슬롯만 같은 구간으로 본다.
 * (booked/blocked 이거나 슬롯이 없으면 = 예약이나 영업 경계로 끊긴 것)
 */
export function openRunMinutes(slots: SlotLite[], startId: string): number {
  const idx = slots.findIndex((s) => s.id === startId);
  if (idx < 0 || slots[idx].status !== "open") return 0;
  const step = SLOT_MIN * 60000;
  let count = 1;
  // 뒤쪽으로 확장
  let expected = new Date(slots[idx].starts_at).getTime() + step;
  for (let k = idx + 1; k < slots.length; k++) {
    if (slots[k].status !== "open") break;
    if (new Date(slots[k].starts_at).getTime() !== expected) break;
    count++;
    expected += step;
  }
  // 앞쪽으로 확장
  expected = new Date(slots[idx].starts_at).getTime() - step;
  for (let k = idx - 1; k >= 0; k--) {
    if (slots[k].status !== "open") break;
    if (new Date(slots[k].starts_at).getTime() !== expected) break;
    count++;
    expected -= step;
  }
  return count * SLOT_MIN;
}

/**
 * startId 에서 durationMin 짜리 시술을 예약할 수 있는지 종합 판정.
 * 1) 시술 길이만큼 연속 open 슬롯이 있어야 하고(fitFrom),
 * 2) 그 슬롯이 속한 공백이 최소 길이(minGapMin) 이상이어야 한다.
 *    → 단독 30분 공백은 제거(30분)조차 못 받게 막힘.
 * 가능하면 점유할 슬롯 id 배열을, 불가하면 null 을 반환.
 */
export function canBook(
  slots: SlotLite[],
  startId: string,
  durationMin: number,
  minGapMin: number = MIN_GAP_MIN,
): string[] | null {
  if (openRunMinutes(slots, startId) < minGapMin) return null;
  return fitFrom(slots, startId, durationMin);
}

/** 정렬 보장 헬퍼 */
export function sortSlots<T extends { starts_at: string }>(slots: T[]): T[] {
  return [...slots].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
