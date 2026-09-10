/**
 * 인스타그램 링크. 갤러리가 비어 있는 동안 작업 사진을 볼 수 있는 유일한
 * 통로라, 화면 아래가 아니라 위쪽 유틸리티 묶음(조회·언어)에 함께 둔다.
 * 아이콘이라 자리를 거의 차지하지 않는다.
 */
export function InstagramLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-brand-200 text-brand-900 hover:bg-brand-50"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
        <circle cx="12" cy="12" r="3.8" />
        <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
      </svg>
    </a>
  );
}
