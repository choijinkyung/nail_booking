import type { BookingWithSlots, Customer } from "./types";
import type { CustomerRow } from "@/components/admin/CustomersManager";

/**
 * 고객 한 명의 화면용 집계(방문 수·마지막 방문·누적 결제·이력).
 * 목록 페이지와 상세 페이지가 같은 규칙을 쓰도록 한 곳에 둔다.
 */
export function buildCustomerRow(
  c: Customer,
  bookings: BookingWithSlots[],
  isEn: boolean,
): CustomerRow {
  const mine = bookings.filter((b) => b.customer_id === c.id);

  const history = mine
    .map((b) => {
      const dateIso =
        b.completed_at ??
        b.confirmed_slot?.starts_at ??
        b.preferred_slot?.starts_at ??
        b.created_at;
      const amount =
        b.status === "completed"
          ? (b.final_price ?? b.estimated_total) + (b.tip ?? 0)
          : 0;
      return {
        dateIso,
        servicesText: b.services
          .map(
            (l) =>
              `${isEn ? l.name_en : l.name_ko}${l.unit === "per_finger" ? `×${l.quantity}` : ""}`,
          )
          .join(", "),
        status: b.status,
        amount,
      };
    })
    .sort((a, b) => b.dateIso.localeCompare(a.dateIso));

  const completed = mine.filter((b) => b.status === "completed");
  const lastVisitIso =
    completed
      .map((b) => b.completed_at ?? b.confirmed_slot?.starts_at ?? "")
      .filter(Boolean)
      .sort()
      .pop() ?? null;
  const totalSpent = completed.reduce(
    (s, b) => s + (b.final_price ?? b.estimated_total) + (b.tip ?? 0),
    0,
  );

  return {
    id: c.id,
    contact: c.contact,
    name: c.name,
    email: c.email,
    referral_source: c.referral_source,
    memo: c.memo,
    visits: completed.length,
    isReturning: completed.length > 0,
    lastVisitIso,
    totalSpent,
    history,
  };
}
