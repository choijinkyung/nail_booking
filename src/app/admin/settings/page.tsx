import { requireAdminPage } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getSettings } from "@/lib/data";
import { AdminShell } from "@/components/admin/AdminShell";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdminPage();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const settings = await getSettings();

  return (
    <AdminShell active="settings" dict={dict}>
      <h1 className="mb-4 text-xl font-bold text-brand-900">
        {dict.admin.settingsTitle}
      </h1>
      <SettingsForm settings={settings} dict={dict} locale={locale} />
    </AdminShell>
  );
}
