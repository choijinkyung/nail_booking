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
    <header className="sticky top-0 z-20 border-b border-brand-100/70 bg-white/60 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-1.5 font-semibold text-brand-700">
          <span aria-hidden>💅</span>
          <span className="truncate max-w-[9rem]">{shopName}</span>
        </Link>
        <LanguageToggle locale={locale} />
      </div>
    </header>
  );
}
