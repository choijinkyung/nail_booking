import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getActiveServices, getSettings } from "@/lib/data";
import { formatDuration, formatServicePrice, unitLabel } from "@/lib/format";
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
  const heroTagline = isEn ? settings.hero_tagline_en : settings.hero_tagline_ko;
  const heroSub = isEn ? settings.hero_sub_en : settings.hero_sub_ko;
  const scheduleNote = isEn
    ? settings.schedule_note_en
    : settings.schedule_note_ko;
  const notice = isEn ? settings.notice_en : settings.notice_ko;
  const location = isEn ? settings.location_en : settings.location_ko;

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
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-brand-100 text-3xl">
            {settings.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logo_url}
                alt={shopName}
                className="h-full w-full object-cover"
              />
            ) : (
              "💅"
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-brand-800">{shopName}</h1>
          <p className="mt-2 text-base font-medium text-brand-600">
            {heroTagline}
          </p>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">
            {heroSub}
          </p>
        </section>

        {/* ⏰ 예약시간 유동 안내 — 가장 강조 (제일 중요) */}
        <section className="mt-6">
          <div className="rounded-2xl bg-brand-600 p-4 text-white shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-xl">
                ⏰
              </span>
              <div>
                <p className="text-sm font-bold">
                  {isEn ? "Please note about timing" : "예약 시간 안내 (꼭 읽어주세요)"}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-white/95 whitespace-pre-line">
                  {scheduleNote}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ⚠️ 주의사항 강조 */}
        <section className="mt-4">
          <NoticeBanner title={dict.landing.noticeTitle}>{notice}</NoticeBanner>
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
                          <span className="ml-2 text-xs font-normal text-muted">
                            ⏱ {formatDuration(s.duration_min, locale)}
                          </span>
                        </p>
                        {(isEn ? s.description_en : s.description_ko) && (
                          <p className="text-xs text-muted">
                            {isEn ? s.description_en : s.description_ko}
                          </p>
                        )}
                      </div>
                      <p className="whitespace-nowrap font-semibold text-brand-700">
                        {formatServicePrice(s.price, settings.currency, s.price_from)}
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

        <section className="mt-8 flex justify-center gap-2">
          {/* 갤러리 기능 임시 비활성화 — '시술 사진 보기'는 인스타그램으로 이동 */}
          <ButtonLink
            href="https://www.instagram.com/zena_12.7"
            variant="outline"
            target="_blank"
            rel="noreferrer"
          >
            📸 {dict.landing.viewGallery}
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
