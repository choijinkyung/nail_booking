import { requireAdminPage } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getAllBookings, getCustomers, getSettings } from "@/lib/data";
import { buildCustomerRow } from "@/lib/customerRows";
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

  const rows: CustomerRow[] = customers.map((c) =>
    buildCustomerRow(c, bookings, isEn),
  );

  return (
    <AdminShell active="customers" dict={dict}>
      <h1 className="mb-4 text-xl font-bold text-brand-900">
        {dict.admin.customersTitle}
      </h1>
      <CustomersManager
        rows={rows}
        dict={dict}
        currency={settings.currency}
      />
    </AdminShell>
  );
}
