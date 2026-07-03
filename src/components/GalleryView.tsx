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

  const shown =
    active === "__all__" ? photos : photos.filter((p) => p.category === active);

  if (photos.length === 0) {
    return (
      <p className="mt-8 rounded-xl bg-white/60 p-6 text-center text-sm text-muted">
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
              className="overflow-hidden rounded-xl border border-brand-100 bg-white"
            >
              <div className="aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image_url}
                  alt={caption || p.category}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              {(caption || p.price != null) && (
                <figcaption className="flex items-center justify-between gap-1 px-2 py-1.5 text-xs">
                  <span className="truncate text-muted">{caption}</span>
                  {p.price != null && (
                    <span className="shrink-0 font-semibold text-brand-700">
                      {formatMoney(p.price, currency)}
                    </span>
                  )}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>
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
          : "border border-brand-200 bg-white text-brand-700"
      }`}
    >
      {label}
    </button>
  );
}
