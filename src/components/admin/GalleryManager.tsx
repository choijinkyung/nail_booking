"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GALLERY_CATEGORIES, type Dict } from "@/lib/i18n";
import type { GalleryPhoto } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import {
  deleteGalleryPhoto,
  uploadGalleryPhoto,
  type ActionResult,
} from "@/app/admin/actions";

export function GalleryManager({
  photos,
  dict,
  currency,
}: {
  photos: GalleryPhoto[];
  dict: Dict;
  currency: string;
}) {
  const a = dict.admin;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    uploadGalleryPhoto,
    null,
  );
  const [delPending, startDelete] = useTransition();
  const [cat, setCat] = useState<string>(GALLERY_CATEGORIES[0]);
  const [customCat, setCustomCat] = useState("");

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  const categories = [...new Set(photos.map((p) => p.category))];
  const resolvedCat = cat === "__custom__" ? customCat.trim() : cat;
  const input =
    "w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400";

  return (
    <div>
      {/* 업로드 폼 */}
      <form
        ref={formRef}
        action={action}
        className="space-y-3 rounded-2xl border border-brand-100 bg-white p-4"
      >
        <p className="text-sm font-semibold text-brand-800">{a.uploadPhoto}</p>
        <input
          type="file"
          name="file"
          accept="image/*"
          required
          className="block w-full text-sm text-brand-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-2 file:text-brand-700"
        />
        {/* 카테고리 선택 (예약 시술 종류) */}
        <input type="hidden" name="category" value={resolvedCat} />
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">
              {a.photoCategory}
            </span>
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className={input}
            >
              {[...new Set([...GALLERY_CATEGORIES, ...categories])].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="__custom__">{a.categoryCustom}…</option>
            </select>
            {cat === "__custom__" && (
              <input
                value={customCat}
                onChange={(e) => setCustomCat(e.target.value)}
                placeholder={a.categoryHint}
                className={`${input} mt-2`}
              />
            )}
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">
              {a.galleryPrice}
            </span>
            <input
              name="price"
              inputMode="decimal"
              placeholder="$"
              className={input}
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">{a.captionKo}</span>
          <textarea name="caption_ko" rows={3} className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">{a.captionEn}</span>
          <textarea name="caption_en" rows={2} className={input} />
        </label>
        {state && !state.ok && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {a.uploadErr}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
        >
          {pending ? a.uploading : a.upload}
        </button>
      </form>

      {/* 기존 사진 */}
      {photos.length === 0 ? (
        <p className="mt-6 rounded-xl bg-white/60 p-4 text-sm text-muted">
          {a.noPhotos}
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {categories.map((cat) => (
            <section key={cat}>
              <h2 className="mb-2 text-sm font-bold text-brand-600">{cat}</h2>
              <div className="grid grid-cols-3 gap-2">
                {photos
                  .filter((p) => p.category === cat)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-brand-100"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.image_url}
                        alt={p.caption_ko || cat}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      <button
                        disabled={delPending}
                        onClick={() =>
                          startDelete(async () => {
                            await deleteGalleryPhoto({
                              id: p.id,
                              storagePath: p.storage_path,
                            });
                            router.refresh();
                          })
                        }
                        className="absolute right-1 top-1 rounded-full bg-black/55 px-2 py-1 text-xs text-white"
                        aria-label={dict.common.delete}
                      >
                        ✕
                      </button>
                      {p.price != null && (
                        <span className="absolute bottom-1 left-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                          {formatMoney(p.price, currency)}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
