import { requireAdminPage } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import {
  getActiveServices,
  getAllBookings,
  getBlocks,
  getCustomers,
  getOpenSlots,
  getSettings,
} from "@/lib/data";
import { slotDayKey } from "@/lib/format";
import { getSiteUrl } from "@/lib/url";
import { AdminShell } from "@/components/admin/AdminShell";
import { BookingManager } from "@/components/admin/BookingManager";
import { ShareLinks } from "@/components/admin/ShareLinks";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdminPage();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [bookings, openSlots, settings, baseUrl, activeServices, blocks, customers] =
    await Promise.all([
      getAllBookings(),
      getOpenSlots(),
      getSettings(),
      getSiteUrl(),
      getActiveServices(),
      getBlocks(),
      getCustomers(),
    ]);
  const today = slotDayKey(new Date().toISOString());

  return (
    <AdminShell active="dashboard" dict={dict}>
      <h1 className="mb-4 text-xl font-bold text-brand-900">
        {dict.admin.dashboardTitle}
      </h1>
      <ShareLinks baseUrl={baseUrl} dict={dict} inviteText={settings.msg_invite} />
      <BookingManager
        bookings={bookings}
        openSlots={openSlots}
        today={today}
        dict={dict}
        locale={locale}
        currency={settings.currency}
        baseUrl={baseUrl}
        shopName={locale === "en" ? settings.shop_name_en : settings.shop_name_ko}
        location={locale === "en" ? settings.location_en : settings.location_ko}
        confirmedAddress={settings.confirmed_address}
        noticeTemplates={{
          confirmed: settings.msg_confirmed,
          changed: settings.msg_changed,
          declined: settings.msg_declined,
          cancelled: settings.msg_cancelled,
          completed: "",
        }}
        services={activeServices}
        blocks={blocks}
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          contact: c.contact,
        }))}
        paymentText={locale === "en" ? settings.payment_en : settings.payment_ko}
        etransferEmail={settings.etransfer_email}
        paymentHeadline={settings.msg_payment}
        etransferNote={
          locale === "en" ? settings.etransfer_note_en : settings.etransfer_note_ko
        }
      />
    </AdminShell>
  );
}
