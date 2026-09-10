import Link from "next/link";
import { LanguageToggle } from "./LanguageToggle";
import type { Locale } from "@/lib/i18n";

export function SiteHeader({
  locale,
  shopName,
}: {
  locale: Locale;
  shopName: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-brand-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
        <Link href="/" className="font-semibold text-brand-900">
          <span className="block max-w-[11rem] truncate">{shopName}</span>
        </Link>
        <LanguageToggle locale={locale} />
      </div>
    </header>
  );
}
