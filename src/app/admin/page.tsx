import { requireAdminPage } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getAllBookings, getOpenSlots, getSettings } from "@/lib/data";
import { slotDayKey } from "@/lib/format";
import { getSiteUrl } from "@/lib/url";
import { AdminShell } from "@/components/admin/AdminShell";
import { BookingManager } from "@/components/admin/BookingManager";
import { ShareLinks } from "@/components/admin/ShareLinks";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdminPage();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [bookings, openSlots, settings, baseUrl] = await Promise.all([
    getAllBookings(),
    getOpenSlots(),
    getSettings(),
    getSiteUrl(),
  ]);
  const today = slotDayKey(new Date().toISOString());

  return (
    <AdminShell active="dashboard" dict={dict}>
      <h1 className="mb-4 text-xl font-bold text-brand-900">
        {dict.admin.dashboardTitle}
      </h1>
      <ShareLinks baseUrl={baseUrl} dict={dict} />
      <BookingManager
        bookings={bookings}
        openSlots={openSlots}
        today={today}
        dict={dict}
        locale={locale}
        currency={settings.currency}
        baseUrl={baseUrl}
      />
    </AdminShell>
  );
}
