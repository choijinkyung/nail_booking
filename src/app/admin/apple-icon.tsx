import { ImageResponse } from "next/og";
import { adminIconElement } from "@/components/adminIcon";

// iOS 홈 화면 아이콘 표준 크기
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(adminIconElement(size.width), { ...size });
}
