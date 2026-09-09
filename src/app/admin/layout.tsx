import type { Metadata } from "next";

/**
 * 관리자 구역 전용 메타데이터.
 * 손님 화면(루트 레이아웃)에는 영향을 주지 않는다.
 * 폰에서 "홈 화면에 추가" 시 주소창 없는 앱처럼 열리게 한다.
 */
export const metadata: Metadata = {
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "관리자",
    statusBarStyle: "default",
  },
  other: {
    // Next 16 은 표준 mobile-web-app-capable 만 내보낸다. 구형 iOS Safari 는
    // apple- 접두사 버전만 인식하므로, 전체화면 실행을 위해 함께 넣는다.
    "apple-mobile-web-app-capable": "yes",
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
