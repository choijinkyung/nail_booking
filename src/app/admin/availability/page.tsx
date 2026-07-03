import { requireAdminPage } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getAllSlots } from "@/lib/data";
import { AdminShell } from "@/components/admin/AdminShell";
import { AvailabilityManager } from "@/components/admin/AvailabilityManager";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  await requireAdminPage();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const slots = await getAllSlots();

  return (
    <AdminShell active="availability" dict={dict}>
      <h1 className="mb-4 text-xl font-bold text-brand-800">
        {dict.admin.availabilityTitle}
      </h1>
      <AvailabilityManager slots={slots} dict={dict} locale={locale} />
    </AdminShell>
  );
}
