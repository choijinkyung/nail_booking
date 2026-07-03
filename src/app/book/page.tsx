import Link from "next/link";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getActiveServices, getFutureSlots, getSettings } from "@/lib/data";
import { SiteHeader } from "@/components/SiteHeader";
import { BookingWizard } from "@/components/booking/BookingWizard";

export default async function BookPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [settings, services, slots] = await Promise.all([
    getSettings(),
    getActiveServices(),
    getFutureSlots(),
  ]);
  const isEn = locale === "en";
  const shopName = isEn ? settings.shop_name_en : settings.shop_name_ko;

  return (
    <div className="min-h-dvh">
      <SiteHeader locale={locale} shopName={shopName} />
      <main className="mx-auto max-w-md px-4 pb-24 pt-4">
        <Link href="/" className="text-sm text-brand-600 hover:underline">
          ← {dict.common.home}
        </Link>
        <BookingWizard
          locale={locale}
          dict={dict}
          services={services}
          slots={slots}
          notice={isEn ? settings.notice_en : settings.notice_ko}
          scheduleNote={isEn ? settings.schedule_note_en : settings.schedule_note_ko}
          currency={settings.currency}
        />
      </main>
    </div>
  );
}
