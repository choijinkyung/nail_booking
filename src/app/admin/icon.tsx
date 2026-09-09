import { ImageResponse } from "next/og";
import { adminIconElement } from "@/components/adminIcon";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(adminIconElement(size.width), { ...size });
}
