import { requireAdminPage } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getAllBookings, getOpenSlots, getSettings } from "@/lib/data";
import { slotDayKey } from "@/lib/format";
import { AdminShell } from "@/components/admin/AdminShell";
import { BookingManager } from "@/components/admin/BookingManager";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdminPage();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [bookings, openSlots, settings] = await Promise.all([
    getAllBookings(),
    getOpenSlots(),
    getSettings(),
  ]);
  const today = slotDayKey(new Date().toISOString());

  return (
    <AdminShell active="dashboard" dict={dict}>
      <h1 className="text-xl font-bold text-brand-800">
        {dict.admin.dashboardTitle}
      </h1>
      <BookingManager
        bookings={bookings}
        openSlots={openSlots}
        today={today}
        dict={dict}
        locale={locale}
        currency={settings.currency}
      />
    </AdminShell>
  );
}
