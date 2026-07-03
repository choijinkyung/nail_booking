import { requireAdminPage } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getAllBookings, getOpenSlots, getSettings } from "@/lib/data";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminBookingCard } from "@/components/admin/AdminBookingCard";
import type { BookingWithSlots } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdminPage();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [bookings, openSlots, settings] = await Promise.all([
    getAllBookings(),
    getOpenSlots(),
    getSettings(),
  ]);

  const nowIso = new Date().toISOString();
  const pending = bookings.filter((b) => b.status === "pending");
  const upcoming = bookings.filter(
    (b) =>
      b.status === "confirmed" &&
      (!b.confirmed_slot || b.confirmed_slot.starts_at >= nowIso),
  );
  const past = bookings.filter(
    (b) => !pending.includes(b) && !upcoming.includes(b),
  );

  const render = (b: BookingWithSlots) => (
    <AdminBookingCard
      key={b.id}
      booking={b}
      openSlots={openSlots}
      dict={dict}
      locale={locale}
      currency={settings.currency}
    />
  );

  return (
    <AdminShell active="dashboard" dict={dict}>
      <h1 className="text-xl font-bold text-brand-800">
        {dict.admin.dashboardTitle}
      </h1>

      <Section
        title={`${dict.admin.pending} (${pending.length})`}
        empty={dict.admin.noPending}
        items={pending}
        render={render}
      />
      <Section
        title={`${dict.admin.upcoming} (${upcoming.length})`}
        empty={dict.admin.noUpcoming}
        items={upcoming}
        render={render}
      />
      {past.length > 0 && (
        <Section
          title={dict.admin.past}
          empty=""
          items={past}
          render={render}
        />
      )}
    </AdminShell>
  );
}

function Section({
  title,
  empty,
  items,
  render,
}: {
  title: string;
  empty: string;
  items: BookingWithSlots[];
  render: (b: BookingWithSlots) => React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-brand-500">
        {title}
      </h2>
      {items.length === 0 ? (
        empty ? (
          <p className="rounded-xl bg-white/60 p-4 text-sm text-muted">{empty}</p>
        ) : null
      ) : (
        <div className="space-y-3">{items.map(render)}</div>
      )}
    </section>
  );
}
