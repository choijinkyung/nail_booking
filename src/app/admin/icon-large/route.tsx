import { ImageResponse } from "next/og";
import { adminIconElement } from "@/components/adminIcon";

/** 매니페스트의 512px 아이콘 (maskable 포함). */
export function GET() {
  return new ImageResponse(adminIconElement(512), { width: 512, height: 512 });
}
