import { requireAdminPage } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import {
  getAllSlots,
  getBusinessHours,
  getDaysOff,
  getSettings,
} from "@/lib/data";
import { slotDayKey } from "@/lib/format";
import { AdminShell } from "@/components/admin/AdminShell";
import { AvailabilityManager } from "@/components/admin/AvailabilityManager";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  await requireAdminPage();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [slots, hours, daysOff, settings] = await Promise.all([
    getAllSlots(),
    getBusinessHours(),
    getDaysOff(),
    getSettings(),
  ]);
  const today = slotDayKey(new Date().toISOString());

  return (
    <AdminShell active="availability" dict={dict}>
      <h1 className="mb-4 text-xl font-bold text-brand-900">
        {dict.admin.availabilityTitle}
      </h1>
      <AvailabilityManager
        slots={slots}
        hours={hours}
        daysOff={daysOff}
        windowDays={settings.booking_window_days}
        today={today}
        dict={dict}
        locale={locale}
      />
    </AdminShell>
  );
}
