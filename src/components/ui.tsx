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
      className={`rounded-2xl border border-brand-100 bg-white/80 p-5 shadow-sm backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-brand-800">
      {children}
    </h2>
  );
}

type BtnProps = {
  children: ReactNode;
  variant?: "primary" | "outline" | "ghost";
  className?: string;
};

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
const btnVariants = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700",
  outline: "border border-brand-300 bg-white text-brand-700 hover:bg-brand-50",
  ghost: "text-brand-700 hover:bg-brand-50",
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

/** 경고/안내를 강조하는 배너 */
export function NoticeBanner({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
      <div className="flex gap-3">
        <span className="text-xl leading-none" aria-hidden>
          ⚠️
        </span>
        <div>
          <p className="font-bold text-amber-900">{title}</p>
          <div className="mt-1 text-sm leading-relaxed text-amber-800 whitespace-pre-line">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
