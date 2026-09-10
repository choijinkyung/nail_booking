import { setLocale } from "@/app/actions";
import type { Locale } from "@/lib/i18n";

/**
 * 언어 전환 버튼. 서버 액션으로 쿠키를 바꾸면 Next.js가 현재 페이지를
 * 자동 재렌더링하므로 클라이언트 JS 없이도 동작합니다.
 */
export function LanguageToggle({ locale }: { locale: Locale }) {
  const other: Locale = locale === "ko" ? "en" : "ko";
  const label = locale === "ko" ? "EN" : "한국어";
  return (
    <form action={setLocale.bind(null, other)}>
      <button
        type="submit"
        className="shrink-0 rounded-md border border-brand-200 px-2.5 py-1 text-[13px] font-medium text-muted transition hover:bg-brand-50"
        aria-label={`Switch language to ${other}`}
      >
        {label}
      </button>
    </form>
  );
}
