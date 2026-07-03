import Link from "next/link";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getGalleryPhotos, getSettings } from "@/lib/data";
import { SiteHeader } from "@/components/SiteHeader";
import { GalleryView } from "@/components/GalleryView";

export default async function GalleryPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [settings, photos] = await Promise.all([
    getSettings(),
    getGalleryPhotos(),
  ]);
  const shopName =
    locale === "en" ? settings.shop_name_en : settings.shop_name_ko;

  return (
    <div className="min-h-dvh">
      <SiteHeader locale={locale} shopName={shopName} />
      <main className="mx-auto max-w-md px-4 pb-16 pt-4">
        <Link href="/" className="text-sm text-brand-600 hover:underline">
          ← {dict.common.home}
        </Link>
        <h1 className="mt-2 text-xl font-bold text-brand-800">
          🖼️ {dict.gallery.title}
        </h1>
        <GalleryView
          photos={photos}
          dict={dict}
          locale={locale}
          currency={settings.currency}
        />
      </main>
    </div>
  );
}
