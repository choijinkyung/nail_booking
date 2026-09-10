"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import { formatDuration, formatServicePrice } from "@/lib/format";
import type { Service, ServiceUnit } from "@/lib/types";
import { addService, deleteService, saveService } from "@/app/admin/actions";

export function ServicesManager({
  services,
  dict,
  locale,
  currency,
}: {
  services: Service[];
  dict: Dict;
  locale: Locale;
  currency: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const a = dict.admin;

  function run(fn: () => Promise<{ ok: boolean }>) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="divide-y divide-brand-100 border-y border-brand-100">
      {services.map((s) => (
        <ServiceRow
          key={s.id}
          service={s}
          dict={dict}
          locale={locale}
          currency={currency}
          pending={pending}
          onSave={(payload) => run(() => saveService(payload))}
          onDelete={() => run(() => deleteService({ id: s.id }))}
        />
      ))}

      <button
        onClick={() => run(() => addService())}
        disabled={pending}
        className="w-full rounded-md border border-dashed border-brand-300 py-3 text-sm font-semibold text-brand-600 disabled:opacity-40"
      >
        ＋ {a.addService}
      </button>
    </div>
  );
}

function ServiceRow({
  service,
  dict,
  locale,
  currency,
  pending,
  onSave,
  onDelete,
}: {
  service: Service;
  dict: Dict;
  locale: Locale;
  currency: string;
  pending: boolean;
  onSave: (p: {
    id: string;
    name_ko: string;
    name_en: string;
    price: number;
    price_from: boolean;
    unit: ServiceUnit;
    duration_min: number;
    active: boolean;
  }) => void;
  onDelete: () => void;
}) {
  const a = dict.admin;
  const [nameKo, setNameKo] = useState(service.name_ko);
  const [nameEn, setNameEn] = useState(service.name_en);
  const [price, setPrice] = useState(String(service.price));
  const [priceFrom, setPriceFrom] = useState(service.price_from);
  const [unit, setUnit] = useState<ServiceUnit>(service.unit);
  const [duration, setDuration] = useState(String(service.duration_min));
  const [active, setActive] = useState(service.active);
  const [saved, setSaved] = useState(false);
  // 편집 폼을 전부 펼쳐 두면 시술 몇 개만 있어도 화면이 끝없이 길어진다.
  const [open, setOpen] = useState(false);

  const dirty =
    nameKo !== service.name_ko ||
    nameEn !== service.name_en ||
    price !== String(service.price) ||
    priceFrom !== service.price_from ||
    unit !== service.unit ||
    duration !== String(service.duration_min) ||
    active !== service.active;

  const input =
    "w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400";

  return (
    <div className="py-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-brand-900">
            {nameKo || nameEn}
            {!active && (
              <span className="ml-2 text-[12px] font-normal text-muted">
                {a.hidden}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-[13px] text-muted">
            {formatDuration(Number(duration) || 0, locale)}
          </span>
        </span>
        <span className="shrink-0 font-semibold text-brand-900">
          {formatServicePrice(Number(price) || 0, currency, priceFrom)}
        </span>
        <span
          className={`shrink-0 text-brand-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ⌄
        </span>
      </button>

      {!open ? null : (
      <div className="pb-4">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">{a.serviceNameKo}</span>
          <input value={nameKo} onChange={(e) => setNameKo(e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">{a.serviceNameEn}</span>
          <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">
            {a.price} ({currency})
          </span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            className={input}
          />
          <label className="mt-1.5 flex items-center gap-1.5 text-xs text-brand-900">
            <input
              type="checkbox"
              checked={priceFrom}
              onChange={(e) => setPriceFrom(e.target.checked)}
              className="h-3.5 w-3.5 accent-brand-600"
            />
            {a.priceFrom}
          </label>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">{a.unit}</span>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as ServiceUnit)}
            className={input}
          >
            <option value="flat">{a.unit_flat}</option>
            <option value="per_finger">{a.unit_per_finger}</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">{a.durationMin}</span>
          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            inputMode="numeric"
            className={input}
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-brand-900">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          {a.active}
        </label>
        <div className="flex gap-2">
          <button
            onClick={onDelete}
            disabled={pending}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 disabled:opacity-40"
          >
            {dict.common.delete}
          </button>
          <button
            onClick={() => {
              onSave({
                id: service.id,
                name_ko: nameKo,
                name_en: nameEn,
                price: Number(price) || 0,
                price_from: priceFrom,
                unit,
                duration_min: Number(duration) || 0,
                active,
              });
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            }}
            disabled={pending || !dirty}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            {saved ? "✓" : dict.common.save}
          </button>
        </div>
      </div>
      </div>
      )}
    </div>
  );
}
