import type { BookingServiceLine, Service, ServiceUnit } from "./types";

/**
 * 시술 한 줄에 실제로 걸리는 시간.
 * 손가락당처럼 단위가 있는 시술은 개수만큼 시간이 늘어난다 —
 * 연장 5개는 1개의 다섯 배가 걸리므로 그만큼 자리를 잡아야 한다.
 */
export function lineDuration(
  service: { unit: ServiceUnit; duration_min: number },
  quantity: number,
): number {
  const per = Number(service.duration_min) || 0;
  if (service.unit !== "per_finger") return per;
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  return per * qty;
}

/** DB 가격 기준 시술 스냅샷 생성. 수량 1–20 클램프, 없는 id 는 제외. */
export function buildServiceLines(
  services: Service[],
  selections: { service_id: string; quantity: number }[],
): BookingServiceLine[] {
  const map = new Map(services.map((s) => [s.id, s]));
  const lines: BookingServiceLine[] = [];
  for (const sel of selections) {
    const svc = map.get(sel.service_id);
    if (!svc) continue;
    const qty = Math.max(1, Math.min(20, Math.floor(sel.quantity || 1)));
    lines.push({
      service_id: svc.id,
      name_ko: svc.name_ko,
      name_en: svc.name_en,
      unit: svc.unit,
      unit_price: Number(svc.price),
      duration_min: lineDuration(svc, qty),
      quantity: qty,
      subtotal: Number(svc.price) * qty,
    });
  }
  return lines;
}
