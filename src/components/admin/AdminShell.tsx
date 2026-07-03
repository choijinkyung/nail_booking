import Link from "next/link";
import { signOut } from "@/app/admin/actions";
import type { Dict } from "@/lib/i18n";

type Tab =
  | "dashboard"
  | "calendar"
  | "availability"
  | "services"
  | "gallery"
  | "settings";

const TABS: { key: Tab; href: string; icon: string; label: keyof Dict["admin"] }[] =
  [
    { key: "dashboard", href: "/admin", icon: "📋", label: "nav_dashboard" },
    { key: "calendar", href: "/admin/calendar", icon: "📅", label: "nav_calendar" },
    {
      key: "availability",
      href: "/admin/availability",
      icon: "🗓️",
      label: "nav_availability",
    },
    { key: "services", href: "/admin/services", icon: "💰", label: "nav_services" },
    { key: "gallery", href: "/admin/gallery", icon: "🖼️", label: "nav_gallery" },
    { key: "settings", href: "/admin/settings", icon: "⚙️", label: "nav_settings" },
  ];

export function AdminShell({
  active,
  dict,
  children,
}: {
  active: Tab;
  dict: Dict;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh pb-24">
      <header className="sticky top-0 z-20 border-b border-brand-100 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <span className="font-bold text-brand-700">💅 {dict.admin.title}</span>
          <form action={signOut}>
            <button className="text-sm text-muted hover:text-brand-700">
              {dict.admin.signOut}
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-5">{children}</main>

      {/* 하단 탭바 */}
      <nav className="safe-b fixed inset-x-0 bottom-0 z-30 border-t border-brand-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg overflow-x-auto">
          {TABS.map((t) => {
            const on = t.key === active;
            return (
              <Link
                key={t.key}
                href={t.href}
                className={`flex min-w-[62px] flex-1 shrink-0 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                  on ? "text-brand-700" : "text-muted"
                }`}
              >
                <span className="text-lg">{t.icon}</span>
                {dict.admin[t.label]}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
