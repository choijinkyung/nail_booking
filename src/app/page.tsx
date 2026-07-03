import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getActiveServices, getSettings } from "@/lib/data";
import { formatMoney, unitLabel } from "@/lib/format";
import { SiteHeader } from "@/components/SiteHeader";
import { ButtonLink, Card, NoticeBanner, SectionTitle } from "@/components/ui";

export default async function LandingPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [settings, services] = await Promise.all([
    getSettings(),
    getActiveServices(),
  ]);
  const isEn = locale === "en";
  const shopName = isEn ? settings.shop_name_en : settings.shop_name_ko;
  const notice = isEn ? settings.notice_en : settings.notice_ko;
  const location = isEn ? settings.location_en : settings.location_ko;
  const payment = isEn ? settings.payment_en : settings.payment_ko;
  const etransferNote = isEn
    ? settings.etransfer_note_en
    : settings.etransfer_note_ko;

  const steps = [
    { icon: "💅", title: dict.landing.step1Title, desc: dict.landing.step1Desc },
    { icon: "🗓️", title: dict.landing.step2Title, desc: dict.landing.step2Desc },
    { icon: "✅", title: dict.landing.step3Title, desc: dict.landing.step3Desc },
  ];

  return (
    <div className="min-h-dvh">
      <SiteHeader locale={locale} shopName={shopName} />

      <main className="mx-auto max-w-md px-4 pb-28">
        {/* Hero */}
        <section className="pt-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-3xl">
            💅
          </div>
          <h1 className="text-2xl font-extrabold text-brand-800">{shopName}</h1>
          <p className="mt-2 text-base font-medium text-brand-600">
            {dict.landing.heroTagline}
          </p>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">
            {dict.landing.heroSub}
          </p>
        </section>

        {/* ⚠️ 안내사항 — 상단에 강조 */}
        <section className="mt-6">
          <NoticeBanner title={dict.landing.noticeTitle}>{notice}</NoticeBanner>
        </section>

        {/* 유동적 시간 안내 */}
        <section className="mt-4">
          <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4 text-sm leading-relaxed text-brand-800">
            ⏰ {dict.landing.flexNote}
          </div>
        </section>

        {/* How it works */}
        <section className="mt-8">
          <SectionTitle>🌸 {dict.landing.howTitle}</SectionTitle>
          <div className="space-y-3">
            {steps.map((s, i) => (
              <Card key={i} className="flex items-start gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg">
                  {s.icon}
                </div>
                <div>
                  <p className="font-semibold text-brand-800">
                    {i + 1}. {s.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{s.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="mt-8">
          <SectionTitle>💰 {dict.landing.pricingTitle}</SectionTitle>
          <Card className="p-0">
            {services.length === 0 ? (
              <p className="p-5 text-sm text-muted">{dict.booking.noServices}</p>
            ) : (
              <ul className="divide-y divide-brand-50">
                {services.map((s) => {
                  const u = unitLabel(s.unit, locale);
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between px-5 py-3.5"
                    >
                      <div>
                        <p className="font-medium text-brand-900">
                          {isEn ? s.name_en : s.name_ko}
                        </p>
                        {(isEn ? s.description_en : s.description_ko) && (
                          <p className="text-xs text-muted">
                            {isEn ? s.description_en : s.description_ko}
                          </p>
                        )}
                      </div>
                      <p className="whitespace-nowrap font-semibold text-brand-700">
                        {formatMoney(s.price, settings.currency)}
                        {u && (
                          <span className="ml-1 text-xs font-normal text-muted">
                            /{u}
                          </span>
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <p className="mt-2 px-1 text-xs text-muted">{dict.landing.pricingNote}</p>
        </section>

        {/* Location */}
        <section className="mt-8">
          <SectionTitle>📍 {dict.landing.locationTitle}</SectionTitle>
          <Card>
            <p className="text-sm leading-relaxed text-brand-900">{location}</p>
          </Card>
        </section>

        {/* Payment */}
        <section className="mt-8">
          <SectionTitle>💳 {dict.landing.paymentTitle}</SectionTitle>
          <Card>
            <p className="text-sm leading-relaxed text-brand-900">{payment}</p>
            {settings.etransfer_email && (
              <div className="mt-3 rounded-xl bg-brand-50 p-3">
                <p className="text-xs text-muted">{dict.landing.etransferEmail}</p>
                <p className="select-all font-semibold text-brand-700">
                  {settings.etransfer_email}
                </p>
                {etransferNote && (
                  <p className="mt-1 text-xs text-muted">{etransferNote}</p>
                )}
              </div>
            )}
          </Card>
        </section>

        <section className="mt-8 flex justify-center gap-2">
          <ButtonLink href="/gallery" variant="outline">
            🖼️ {dict.landing.viewGallery}
          </ButtonLink>
          <ButtonLink href="/status" variant="ghost">
            🔎 {dict.landing.ctaLookup}
          </ButtonLink>
        </section>
      </main>

      {/* 하단 고정 CTA */}
      <div className="safe-b fixed inset-x-0 bottom-0 z-30 border-t border-brand-100 bg-white/85 px-4 pt-3 backdrop-blur-md">
        <div className="mx-auto max-w-md">
          <ButtonLink href="/book" className="w-full">
            {dict.landing.ctaBook}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
