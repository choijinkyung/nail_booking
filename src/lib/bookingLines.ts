import type { BookingServiceLine, Service } from "./types";

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
      duration_min: Number(svc.duration_min) || 0,
      quantity: qty,
      subtotal: Number(svc.price) * qty,
    });
  }
  return lines;
}
