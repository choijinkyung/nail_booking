import { requireAdminPage } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getAllServices, getSettings } from "@/lib/data";
import { AdminShell } from "@/components/admin/AdminShell";
import { ServicesManager } from "@/components/admin/ServicesManager";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  await requireAdminPage();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [services, settings] = await Promise.all([
    getAllServices(),
    getSettings(),
  ]);

  return (
    <AdminShell active="services" dict={dict}>
      <h1 className="mb-4 text-xl font-bold text-brand-800">
        {dict.admin.servicesTitle}
      </h1>
      <ServicesManager
        services={services}
        dict={dict}
        currency={settings.currency}
      />
    </AdminShell>
  );
}
