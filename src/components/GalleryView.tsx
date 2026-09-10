"use client";

import { useState } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import type { GalleryPhoto } from "@/lib/types";
import { formatMoney } from "@/lib/format";

export function GalleryView({
  photos,
  dict,
  locale,
  currency,
}: {
  photos: GalleryPhoto[];
  dict: Dict;
  locale: Locale;
  currency: string;
}) {
  const categories = [...new Set(photos.map((p) => p.category))];
  const [active, setActive] = useState<string>("__all__");
  const isEn = locale === "en";

  const [zoom, setZoom] = useState<GalleryPhoto | null>(null);
  const shown =
    active === "__all__" ? photos : photos.filter((p) => p.category === active);

  if (photos.length === 0) {
    return (
      <p className="mt-8 rounded-md bg-white/60 p-6 text-center text-sm text-muted">
        {dict.gallery.empty}
      </p>
    );
  }

  return (
    <div>
      {/* 카테고리 탭 */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <Tab
          label={dict.gallery.all}
          on={active === "__all__"}
          onClick={() => setActive("__all__")}
        />
        {categories.map((c) => (
          <Tab key={c} label={c} on={active === c} onClick={() => setActive(c)} />
        ))}
      </div>

      {/* 사진 그리드 */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {shown.map((p) => {
          const caption = isEn ? p.caption_en : p.caption_ko;
          return (
            <figure
              key={p.id}
              className="overflow-hidden rounded-md border border-brand-100 bg-white"
            >
              <button
                type="button"
                onClick={() => setZoom(p)}
                className="block aspect-square w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image_url}
                  alt={caption || p.category}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
              {(caption || p.price != null) && (
                <figcaption className="flex items-center justify-between gap-1 px-2 py-1.5 text-xs">
                  <span className="truncate text-muted">{caption}</span>
                  {p.price != null && (
                    <span className="shrink-0 font-semibold text-brand-900">
                      {formatMoney(p.price, currency)}
                    </span>
                  )}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>

      {/* 크게 보기 (라이트박스) */}
      {zoom && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4"
        >
          <button
            onClick={() => setZoom(null)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg text-white"
            aria-label={dict.common.close}
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoom.image_url}
            alt={(isEn ? zoom.caption_en : zoom.caption_ko) || zoom.category}
            className="max-h-[80vh] max-w-full rounded-md object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {((isEn ? zoom.caption_en : zoom.caption_ko) || zoom.price != null) && (
            <div className="mt-3 flex items-center gap-3 text-white">
              <span className="text-sm">
                {isEn ? zoom.caption_en : zoom.caption_ko}
              </span>
              {zoom.price != null && (
                <span className="font-semibold">
                  {formatMoney(zoom.price, currency)}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Tab({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
        on
          ? "bg-brand-600 text-white"
          : "border border-brand-200 bg-white text-brand-900"
      }`}
    >
      {label}
    </button>
  );
}
