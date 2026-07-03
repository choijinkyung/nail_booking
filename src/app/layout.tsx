import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getSettings } from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const settings = await getSettings();
  const shopName =
    locale === "en" ? settings.shop_name_en : settings.shop_name_ko;
  const appName = getDictionary(locale).common.appName;
  return {
    title: `${shopName} · ${appName}`,
    description:
      locale === "en"
        ? "Home nail service — book easily."
        : "집에서 받는 네일, 간편하게 예약하세요.",
  };
}

export const viewport: Viewport = {
  themeColor: "#db2777",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full text-ink">{children}</body>
    </html>
  );
}
