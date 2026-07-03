"use client";

import type { Locale } from "@/lib/i18n";
import type { AvailabilitySlot } from "@/lib/types";
import { formatDateHeading, formatTimeOnly, slotDayKey } from "@/lib/format";

export type DayGroup = { key: string; iso: string; slots: AvailabilitySlot[] };

export function groupByDay(slots: AvailabilitySlot[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const s of slots) {
    const key = slotDayKey(s.starts_at);
    if (!map.has(key)) map.set(key, { key, iso: s.starts_at, slots: [] });
    map.get(key)!.slots.push(s);
  }
  return [...map.values()];
}

export function SlotGroups({
  slotsByDay,
  locale,
  selectedIds,
  disabledIds = [],
  onPick,
  badge,
  badgeClass,
}: {
  slotsByDay: DayGroup[];
  locale: Locale;
  selectedIds: string[];
  disabledIds?: string[];
  onPick: (id: string) => void;
  badge: string;
  badgeClass: string;
}) {
  return (
    <div className="space-y-4">
      {slotsByDay.map((g) => (
        <div key={g.key}>
          <p className="mb-2 text-xs font-semibold text-brand-500">
            {formatDateHeading(g.iso, locale)}
          </p>
          <div className="flex flex-wrap gap-2">
            {g.slots.map((s) => {
              const on = selectedIds.includes(s.id);
              const disabled = disabledIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(s.id)}
                  className={`relative rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                    disabled
                      ? "cursor-not-allowed border-brand-100 bg-brand-50 text-brand-300"
                      : on
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-brand-200 bg-white text-brand-800 hover:bg-brand-50"
                  }`}
                >
                  {formatTimeOnly(s.starts_at, locale)}
                  {on && (
                    <span
                      className={`absolute -right-1.5 -top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white ${badgeClass}`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
