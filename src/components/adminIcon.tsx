import type { ReactElement } from "react";

/** 브랜드 모카색 바탕에 흰 Z — 관리자 앱 아이콘의 단일 출처. */
export function adminIconElement(size: number): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#8a5a44",
        color: "#ffffff",
        fontSize: Math.round(size * 0.72),
      }}
    >
      Z
    </div>
  );
}
