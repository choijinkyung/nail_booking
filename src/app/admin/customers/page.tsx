import { requireAdminPage } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getAllBookings, getCustomers, getSettings } from "@/lib/data";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  CustomersManager,
  type CustomerRow,
} from "@/components/admin/CustomersManager";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  await requireAdminPage();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const isEn = locale === "en";
  const [customers, bookings, settings] = await Promise.all([
    getCustomers(),
    getAllBookings(),
    getSettings(),
  ]);

  const rows: CustomerRow[] = customers.map((c) => {
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
  });

  return (
    <AdminShell active="customers" dict={dict}>
      <h1 className="mb-4 text-xl font-bold text-brand-800">
        {dict.admin.customersTitle}
      </h1>
      <CustomersManager
        rows={rows}
        dict={dict}
        locale={locale}
        currency={settings.currency}
      />
    </AdminShell>
  );
}
