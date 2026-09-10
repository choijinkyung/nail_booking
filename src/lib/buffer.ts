/** 여유시간은 5분 단위로만 고른다. */
export const BUFFER_STEP = 5;
export const MAX_BUFFER_MIN = 120;

/** 화면에 보여줄 선택지 (0 = 없음) */
export const BUFFER_CHOICES = [0, 5, 10, 15, 20, 30, 45, 60];

export function clampBuffer(min: number): number {
  const n = Math.floor(Number(min) || 0);
  if (n <= 0) return 0;
  return Math.min(MAX_BUFFER_MIN, Math.floor(n / BUFFER_STEP) * BUFFER_STEP);
}

/**
 * 이 예약이 실제로 차지하는 시간(분) = 시술시간 + 뒤 여유시간.
 * 예약 가능 시간이 30분 격자라 최종 점유 칸수는 이 값을 올림해 정해진다.
 */
export function occupiedMinutes(durationMin: number, bufferMin: number): number {
  return (Number(durationMin) || 0) + clampBuffer(bufferMin);
}
