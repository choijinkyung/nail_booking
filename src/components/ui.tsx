import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-brand-100 bg-white p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-[17px] font-bold text-brand-900">{children}</h2>
  );
}

/** 섹션 사이를 가르는 헤어라인. 카드로 감싸는 대신 이걸로 구조를 만든다. */
export function Divider({ className = "" }: { className?: string }) {
  return <hr className={`border-0 border-t border-brand-100 ${className}`} />;
}

/** 값이 없을 때 보여주는 안내 — 다음에 뭘 하면 되는지 알려준다. */
export function EmptyState({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg bg-surface px-4 py-8 text-center">
      <p className="text-sm text-muted">{children}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

type BtnProps = {
  children: ReactNode;
  variant?: "primary" | "outline" | "ghost";
  className?: string;
};

const btnBase =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-5 text-[15px] font-semibold transition active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none";
const btnVariants = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  outline: "border border-brand-200 bg-white text-brand-900 hover:bg-brand-50",
  ghost: "text-brand-900 hover:bg-brand-50",
};

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
  ...rest
}: BtnProps & { href: string } & ComponentProps<typeof Link>) {
  return (
    <Link
      href={href}
      className={`${btnBase} ${btnVariants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </Link>
  );
}

/**
 * 길지만 꼭 있어야 하는 안내. 기본은 접어두고 제목만 보여준다 —
 * 랜딩에서 읽을 것과 참고할 것이 같은 무게로 쌓이지 않게 한다.
 */
export function NoticeBanner({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-brand-100 bg-white"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-[15px] font-semibold text-brand-900">
        {title}
        <span
          className="shrink-0 text-brand-400 transition-transform group-open:rotate-180"
          aria-hidden
        >
          ⌄
        </span>
      </summary>
      <div className="whitespace-pre-line px-4 pb-4 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </details>
  );
}
