import { getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * 관리자 전용 웹 매니페스트.
 * Next 의 `manifest.ts` 파일 규칙은 app 루트에서만 동작하므로(손님용 주소가 됨),
 * 관리자 구역에는 라우트 핸들러로 직접 서빙한다.
 * scope/start_url 을 /admin 으로 두어 홈 화면 아이콘이 바로 관리자 화면을 연다.
 */
export async function GET() {
  const settings = await getSettings();
  const shop = settings.shop_name_ko || "Zenna Nail";
  const name = `${shop} 관리자`;

  return Response.json(
    {
      name,
      short_name: "관리자",
      description: `${shop} 예약 관리`,
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      orientation: "portrait",
      background_color: "#ffffff",
      theme_color: "#8a5a44",
      icons: [
        { src: "/admin/icon", sizes: "192x192", type: "image/png" },
        { src: "/admin/icon-large", sizes: "512x512", type: "image/png" },
        {
          src: "/admin/icon-large",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
