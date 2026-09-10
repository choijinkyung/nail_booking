import { requireAdminPage } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getGalleryPhotos, getSettings } from "@/lib/data";
import { AdminShell } from "@/components/admin/AdminShell";
import { GalleryManager } from "@/components/admin/GalleryManager";

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage() {
  await requireAdminPage();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [photos, settings] = await Promise.all([
    getGalleryPhotos(),
    getSettings(),
  ]);

  return (
    <AdminShell active="gallery" dict={dict}>
      <h1 className="mb-4 text-xl font-bold text-brand-900">
        {dict.admin.galleryTitle}
      </h1>
      <GalleryManager photos={photos} dict={dict} currency={settings.currency} />
    </AdminShell>
  );
}
