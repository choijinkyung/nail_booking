"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import type { AvailabilitySlot } from "@/lib/types";
import { formatDateHeading, formatTimeOnly, localInputToISO, slotDayKey } from "@/lib/format";
import { addSlot, addSlots, deleteSlot, setSlotStatus } from "@/app/admin/actions";

export function AvailabilityManager({
  slots,
  dict,
  locale,
}: {
  slots: AvailabilitySlot[];
  dict: Dict;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState("");
  const [rDate, setRDate] = useState("");
  const [rStart, setRStart] = useState("10:00");
  const [rEnd, setREnd] = useState("20:00");
  const [err, setErr] = useState("");
  const a = dict.admin;

  function run(fn: () => Promise<{ ok: boolean }>) {
    setErr("");
    startTransition(async () => {
      try {
        const res = await fn();
        if (res.ok) router.refresh();
        else setErr(dict.booking.errGeneric);
      } catch {
        // 서버 액션이 예외(예: DB 미설정)로 실패한 경우도 표시
        setErr(dict.admin.setupNeeded);
      }
    });
  }

  function submitAdd() {
    if (!value) return;
    const iso = localInputToISO(value);
    run(async () => {
      const res = await addSlot({ startsAtISO: iso });
      if (res.ok) setValue("");
      return res;
    });
  }

  function submitRange() {
    if (!rDate || !rStart || !rEnd) return;
    const [sh, sm] = rStart.split(":").map(Number);
    const [eh, em] = rEnd.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (endMin <= startMin) {
      setErr(dict.booking.errGeneric);
      return;
    }
    const isos: string[] = [];
    for (let m = startMin; m < endMin; m += 30) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      isos.push(localInputToISO(`${rDate}T${hh}:${mm}`));
    }
    run(() => addSlots({ startsAtISOs: isos }));
  }

  const open = groupByDay(slots.filter((s) => s.status === "open"));
  const blocked = slots.filter((s) => s.status === "blocked");
  const booked = groupByDay(slots.filter((s) => s.status === "booked"));

  return (
    <div>
      {/* 추가 */}
      <div className="rounded-2xl border border-brand-100 bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-brand-800">{a.addSlot}</p>
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400"
          />
          <button
            onClick={submitAdd}
            disabled={pending || !value}
            className="shrink-0 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {a.addSlotBtn}
          </button>
        </div>
      </div>

      {/* 범위로 30분 간격 생성 */}
      <div className="mt-3 rounded-2xl border border-brand-100 bg-white p-4">
        <p className="mb-1 text-sm font-semibold text-brand-800">{a.addRange}</p>
        <p className="mb-2 text-xs text-muted">{a.slotUnitNote}</p>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">{a.rangeDate}</span>
            <input
              type="date"
              value={rDate}
              onChange={(e) => setRDate(e.target.value)}
              className="w-full rounded-xl border border-brand-200 bg-white px-2 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">{a.rangeStart}</span>
            <input
              type="time"
              step={1800}
              value={rStart}
              onChange={(e) => setRStart(e.target.value)}
              className="w-full rounded-xl border border-brand-200 bg-white px-2 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">{a.rangeEnd}</span>
            <input
              type="time"
              step={1800}
              value={rEnd}
              onChange={(e) => setREnd(e.target.value)}
              className="w-full rounded-xl border border-brand-200 bg-white px-2 py-2 text-sm"
            />
          </label>
        </div>
        <button
          onClick={submitRange}
          disabled={pending || !rDate}
          className="mt-2 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {a.rangeGenerate}
        </button>
      </div>

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      {slots.length === 0 && (
        <p className="mt-6 rounded-xl bg-white/60 p-4 text-sm text-muted">
          {a.noSlotsAdmin}
        </p>
      )}

      {/* 열린 시간 */}
      {open.length > 0 && (
        <Group title={`🟢 ${a.slotsOpen}`}>
          {open.map((g) => (
            <DayBlock key={g.key} iso={g.iso} locale={locale}>
              {g.slots.map((s) => (
                <SlotRow key={s.id} time={formatTimeOnly(s.starts_at, locale)}>
                  <button
                    onClick={() =>
                      run(() => setSlotStatus({ slotId: s.id, status: "blocked" }))
                    }
                    disabled={pending}
                    className="rounded-lg border border-brand-200 px-2.5 py-1 text-xs text-brand-600"
                  >
                    {a.block}
                  </button>
                  <button
                    onClick={() => run(() => deleteSlot({ slotId: s.id }))}
                    disabled={pending}
                    className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600"
                  >
                    {a.removeSlot}
                  </button>
                </SlotRow>
              ))}
            </DayBlock>
          ))}
        </Group>
      )}

      {/* 막은 시간 */}
      {blocked.length > 0 && (
        <Group title={`⛔ ${a.slotsBlocked}`}>
          <div className="space-y-2">
            {blocked.map((s) => (
              <SlotRow
                key={s.id}
                time={`${formatDateHeading(s.starts_at, locale)} · ${formatTimeOnly(s.starts_at, locale)}`}
              >
                <button
                  onClick={() =>
                    run(() => setSlotStatus({ slotId: s.id, status: "open" }))
                  }
                  disabled={pending}
                  className="rounded-lg border border-brand-200 px-2.5 py-1 text-xs text-brand-600"
                >
                  {a.unblock}
                </button>
                <button
                  onClick={() => run(() => deleteSlot({ slotId: s.id }))}
                  disabled={pending}
                  className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600"
                >
                  {a.removeSlot}
                </button>
              </SlotRow>
            ))}
          </div>
        </Group>
      )}

      {/* 예약된 시간 (잠금) */}
      {booked.length > 0 && (
        <Group title={`🔒 ${a.slotsBooked}`}>
          {booked.map((g) => (
            <DayBlock key={g.key} iso={g.iso} locale={locale}>
              {g.slots.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-green-100 bg-green-50/50 px-3 py-2 text-sm text-green-800"
                >
                  <span>{formatTimeOnly(s.starts_at, locale)}</span>
                  <span className="text-xs">🔒 {a.slotsBooked}</span>
                </div>
              ))}
            </DayBlock>
          ))}
        </Group>
      )}
    </div>
  );
}

type DayGroup = { key: string; iso: string; slots: AvailabilitySlot[] };
function groupByDay(slots: AvailabilitySlot[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const s of slots) {
    const key = slotDayKey(s.starts_at);
    if (!map.has(key)) map.set(key, { key, iso: s.starts_at, slots: [] });
    map.get(key)!.slots.push(s);
  }
  return [...map.values()];
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-bold text-brand-600">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function DayBlock({
  iso,
  locale,
  children,
}: {
  iso: string;
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-brand-400">
        {formatDateHeading(iso, locale)}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SlotRow({
  time,
  children,
}: {
  time: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-brand-100 bg-white px-3 py-2">
      <span className="text-sm text-brand-900">{time}</span>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}
