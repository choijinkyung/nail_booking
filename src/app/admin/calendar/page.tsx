import { requireAdminPage } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import {
  getActiveServices,
  getAllBookings,
  getBlocks,
  getCustomers,
  getSettings,
} from "@/lib/data";
import { slotDayKey } from "@/lib/format";
import { AdminShell } from "@/components/admin/AdminShell";
import { BookingCalendar } from "@/components/admin/BookingCalendar";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage() {
  await requireAdminPage();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [bookings, settings, blocks, services, customers] = await Promise.all([
    getAllBookings(),
    getSettings(),
    getBlocks(),
    getActiveServices(),
    getCustomers(),
  ]);
  const today = slotDayKey(new Date().toISOString());

  return (
    <AdminShell active="calendar" dict={dict}>
      <h1 className="mb-4 text-xl font-bold text-brand-800">
        {dict.admin.calendarTitle}
      </h1>
      <BookingCalendar
        bookings={bookings}
        blocks={blocks}
        services={services}
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          contact: c.contact,
        }))}
        today={today}
        dict={dict}
        locale={locale}
        currency={settings.currency}
      />
    </AdminShell>
  );
}
