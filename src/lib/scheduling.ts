import type { BookingServiceLine } from "./types";

export const SLOT_MIN = 30; // 예약 슬롯 단위(분)

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

/** 정렬 보장 헬퍼 */
export function sortSlots<T extends { starts_at: string }>(slots: T[]): T[] {
  return [...slots].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
