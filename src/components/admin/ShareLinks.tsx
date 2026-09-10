"use client";

import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import { galleryLink, homeLink } from "@/lib/shareLinks";

/**
 * 보낼 문구에 대한 [공유] + [복사] 버튼.
 *
 * 문구와 링크를 navigator.share 에 따로 넘기면 앱마다 처리가 달라
 * 링크만 가져가고 문구를 버리는 곳이 있다(인스타그램 등). 링크를 문구
 * 안에 넣어 **한 덩어리 텍스트**로 보내면 텍스트를 받는 곳이면 어디든
 * 그대로 들어간다. 복사도 같은 문구 전체를 복사한다.
 */
export function ShareButtons({
  url,
  text,
  dict,
  compact = false,
}: {
  /** 함께 보낼 링크. 없으면 문구만 보낸다. */
  url?: string;
  text: string;
  dict: Dict;
  compact?: boolean;
}) {
  const a = dict.admin;
  const [copied, setCopied] = useState(false);
  const payload = url ? `${text}\n${url}` : text;

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없는 경우 — 사용자가 직접 선택할 수 있게 둔다.
    }
  }

  async function share() {
    if (typeof navigator.share !== "function") {
      await copy();
      return;
    }
    try {
      await navigator.share({ text: payload });
    } catch {
      // 사용자가 공유 시트를 닫은 경우 — 아무 일도 하지 않는다.
    }
  }

  const btn = compact
    ? "rounded-lg px-2 py-1 text-[11px] font-semibold"
    : "rounded-lg px-3 py-1.5 text-xs font-semibold";

  return (
    <span className="flex shrink-0 gap-1.5">
      <button onClick={share} className={`${btn} bg-brand-600 text-white`}>
        {a.shareBtn}
      </button>
      <button
        onClick={copy}
        className={`${btn} border border-brand-200 text-brand-900`}
      >
        {copied ? `✓ ${a.copied}` : a.copyBtn}
      </button>
    </span>
  );
}

/** 대시보드 상단의 "손님에게 링크 보내기" 카드. */
export function ShareLinks({
  baseUrl,
  dict,
}: {
  baseUrl: string;
  dict: Dict;
}) {
  const a = dict.admin;
  const rows = [
    { label: a.shareBook, url: homeLink(baseUrl), text: a.shareMsgBook },
    { label: a.shareGallery, url: galleryLink(baseUrl), text: a.shareMsgGallery },
  ];

  return (
    <div className="mb-4 rounded-lg border border-brand-100 bg-white p-4">
      <p className="mb-2 text-[13px] font-semibold text-brand-400">
        {a.shareTitle}
      </p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-brand-900">
                {r.label}
              </span>
              <span className="block truncate text-[11px] text-muted">
                {r.url}
              </span>
            </span>
            <ShareButtons url={r.url} text={r.text} dict={dict} />
          </li>
        ))}
      </ul>
    </div>
  );
}
