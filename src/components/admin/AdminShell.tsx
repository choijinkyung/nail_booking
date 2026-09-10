import Link from "next/link";
import { signOut } from "@/app/admin/actions";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";
import { slotDayKey } from "@/lib/format";
import { AutoSync } from "./AutoSync";
import {
  IconBookings,
  IconCalendar,
  IconCustomers,
  IconGallery,
  IconHours,
  IconPrices,
  IconSettings,
} from "./NavIcons";
import type { Dict } from "@/lib/i18n";

type Tab =
  | "dashboard"
  | "calendar"
  | "customers"
  | "availability"
  | "services"
  | "gallery"
  | "settings";

const TABS: {
  key: Tab;
  href: string;
  Icon: () => React.ReactElement;
  label: keyof Dict["admin"];
}[] = [
  { key: "dashboard", href: "/admin", Icon: IconBookings, label: "nav_dashboard" },
  { key: "calendar", href: "/admin/calendar", Icon: IconCalendar, label: "nav_calendar" },
  { key: "customers", href: "/admin/customers", Icon: IconCustomers, label: "nav_customers" },
  { key: "availability", href: "/admin/availability", Icon: IconHours, label: "nav_availability" },
  { key: "services", href: "/admin/services", Icon: IconPrices, label: "nav_services" },
  { key: "gallery", href: "/admin/gallery", Icon: IconGallery, label: "nav_gallery" },
  { key: "settings", href: "/admin/settings", Icon: IconSettings, label: "nav_settings" },
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
      {/* 하루 한 번 예약 가능 시간 동기화 (화면 출력 없음) */}
      {isSupabaseAdminConfigured() && (
        <AutoSync today={slotDayKey(new Date().toISOString())} />
      )}
      <header className="sticky top-0 z-20 border-b border-brand-100 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <span className="font-bold text-brand-900">{dict.admin.title}</span>
          <form action={signOut}>
            <button className="text-sm text-muted hover:text-brand-700">
              {dict.admin.signOut}
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-5">
        {!isSupabaseAdminConfigured() && (
          <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">⚠️ 데이터베이스에 연결되지 않았어요</p>
            <p className="mt-1">
              메뉴·예약·시간 저장이 동작하지 않아요. 배포(Vercel) 환경변수에{" "}
              <b>NEXT_PUBLIC_SUPABASE_URL</b>, <b>NEXT_PUBLIC_SUPABASE_ANON_KEY</b>,{" "}
              <b>SUPABASE_SERVICE_ROLE_KEY</b> 가 모두 등록됐는지 확인하고 다시
              배포(Redeploy)해주세요.
            </p>
          </div>
        )}
        {children}
      </main>

      {/* 하단 탭바 */}
      <nav className="safe-b fixed inset-x-0 bottom-0 z-30 border-t border-brand-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg">
          {TABS.map(({ key, href, Icon, label }) => {
            const on = key === active;
            return (
              <Link
                key={key}
                href={href}
                aria-current={on ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium ${
                  on ? "text-brand-600" : "text-muted"
                }`}
              >
                <Icon />
                <span className="whitespace-nowrap">{dict.admin[label]}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
