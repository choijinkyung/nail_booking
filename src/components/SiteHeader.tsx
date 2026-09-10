import Link from "next/link";
import { LanguageToggle } from "./LanguageToggle";
import type { Locale } from "@/lib/i18n";

/**
 * 페이지 첫 줄 — 상호(왼쪽)와 언어 전환(오른쪽).
 * 회색 띠를 두른 고정 헤더 대신 본문의 첫 행으로 두어,
 * 화면 맨 위가 곧 가게 이름이 되게 한다.
 */
export function SiteHeader({
  locale,
  shopName,
}: {
  locale: Locale;
  shopName: string;
}) {
  return (
    <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-5 pt-5">
      <Link href="/" className="min-w-0 text-[17px] font-bold text-brand-900">
        <span className="block truncate">{shopName}</span>
      </Link>
      <LanguageToggle locale={locale} />
    </div>
  );
}
