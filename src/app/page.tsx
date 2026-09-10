import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getActiveServices, getSettings } from "@/lib/data";
import { formatDuration, formatServicePrice, unitLabel } from "@/lib/format";
import Link from "next/link";
import { InstagramLink } from "@/components/InstagramLink";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ButtonLink, NoticeBanner, SectionTitle } from "@/components/ui";

export default async function LandingPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [settings, services] = await Promise.all([
    getSettings(),
    getActiveServices(),
  ]);
  const isEn = locale === "en";
  const heroTagline = isEn ? settings.hero_tagline_en : settings.hero_tagline_ko;
  const heroSub = isEn ? settings.hero_sub_en : settings.hero_sub_ko;
  const scheduleNote = isEn
    ? settings.schedule_note_en
    : settings.schedule_note_ko;
  const notice = isEn ? settings.notice_en : settings.notice_ko;
  const location = isEn ? settings.location_en : settings.location_ko;

  const steps = [
    { title: dict.landing.step1Title, desc: dict.landing.step1Desc },
    { title: dict.landing.step2Title, desc: dict.landing.step2Desc },
    { title: dict.landing.step3Title, desc: dict.landing.step3Desc },
  ];

  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-md px-5 pb-28">
        {/* Hero — 화면 맨 위가 곧 제목이고, 그 오른쪽이 언어 전환이다 */}
        <section className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <h1 className="min-w-0 text-[32px] font-bold leading-tight text-brand-900">
              {heroTagline}
            </h1>
            <div className="mt-1.5 flex shrink-0 items-center gap-2">
              <Link
                href="/status"
                className="rounded-md border border-brand-200 px-2.5 py-1 text-[13px] font-medium text-brand-900 hover:bg-brand-50"
              >
                {dict.landing.ctaLookup}
              </Link>
              <LanguageToggle locale={locale} />
            </div>
          </div>
          {heroSub && (
            <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-muted">
              {heroSub}
            </p>
          )}
        </section>

        {/* 작업 사진 — 갤러리가 비어 있는 동안 유일한 포트폴리오라
            안내문에 밀리지 않게 히어로 바로 아래에 둔다. */}
        <section className="mt-6">
          <InstagramLink
            href="https://www.instagram.com/zena_12.7"
            label={dict.landing.viewGallery}
          />
        </section>

        {/* 예약시간 유동 안내 */}
        <section className="mt-8">
          <div className="space-y-2">
            <NoticeBanner
              title={isEn ? "About timing" : "예약 시간이 조정될 수 있어요"}
            >
              {scheduleNote}
            </NoticeBanner>
            {/* 알레르기 안내는 접지 않는다 — 모르고 오시면 곤란해지는 내용이다 */}
            <NoticeBanner title={dict.landing.noticeTitle} defaultOpen>
              {notice}
            </NoticeBanner>
          </div>
        </section>

        {/* How it works */}
        <section className="mt-12">
          <SectionTitle>{dict.landing.howTitle}</SectionTitle>
          <ol className="flex items-center gap-2 text-sm text-muted">
            {steps.map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden>›</span>}
                <span className="text-brand-900">{s.title}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Pricing */}
        <section className="mt-12">
          <SectionTitle>{dict.landing.pricingTitle}</SectionTitle>
          <div>
            {services.length === 0 ? (
              <p className="rounded-lg bg-surface px-4 py-8 text-center text-sm text-muted">
                {dict.booking.noServices}
              </p>
            ) : (
              <ul className="divide-y divide-brand-100 border-y border-brand-100">
                {services.map((s) => {
                  const u = unitLabel(s.unit, locale);
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between py-3.5"
                    >
                      <div>
                        <p className="font-medium text-brand-900">
                          {isEn ? s.name_en : s.name_ko}
                          <span className="ml-2 text-xs font-normal text-muted">
                            {formatDuration(s.duration_min, locale)}
                          </span>
                        </p>
                        {(isEn ? s.description_en : s.description_ko) && (
                          <p className="text-xs text-muted">
                            {isEn ? s.description_en : s.description_ko}
                          </p>
                        )}
                      </div>
                      <p className="whitespace-nowrap font-semibold text-brand-900">
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
          </div>
          <p className="mt-2 text-xs text-muted">{dict.landing.pricingNote}</p>
        </section>

        {/* Location */}
        <section className="mt-12">
          <SectionTitle>{dict.landing.locationTitle}</SectionTitle>
          <p className="text-[15px] leading-relaxed text-brand-900">{location}</p>
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
