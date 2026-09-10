import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getAllBookings, getCustomers, getSettings } from "@/lib/data";
import { AdminShell } from "@/components/admin/AdminShell";
import { CustomerDetail } from "@/components/admin/CustomerDetail";
import { buildCustomerRow } from "@/lib/customerRows";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [customers, bookings, settings] = await Promise.all([
    getCustomers(),
    getAllBookings(),
    getSettings(),
  ]);

  const customer = customers.find((c) => c.id === id);
  if (!customer) notFound();

  return (
    <AdminShell active="customers" dict={dict}>
      <CustomerDetail
        row={buildCustomerRow(customer, bookings, locale === "en")}
        dict={dict}
        locale={locale}
        currency={settings.currency}
      />
    </AdminShell>
  );
}
