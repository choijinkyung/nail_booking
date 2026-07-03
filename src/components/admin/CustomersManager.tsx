"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import { referralLabel } from "@/lib/i18n";
import type { BookingStatus } from "@/lib/types";
import { formatDateTime, formatMoney } from "@/lib/format";
import { saveCustomerMemo } from "@/app/admin/actions";

export interface CustomerRow {
  id: string;
  contact: string;
  name: string;
  email: string;
  referral_source: string;
  memo: string;
  visits: number;
  lastVisitIso: string | null;
  totalSpent: number;
  history: {
    dateIso: string;
    servicesText: string;
    status: BookingStatus;
    amount: number;
  }[];
}

export function CustomersManager({
  rows,
  dict,
  locale,
  currency,
}: {
  rows: CustomerRow[];
  dict: Dict;
  locale: Locale;
  currency: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl bg-white/60 p-4 text-sm text-muted">
        {dict.admin.noCustomers}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <CustomerCard
          key={r.id}
          row={r}
          dict={dict}
          locale={locale}
          currency={currency}
        />
      ))}
    </div>
  );
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

const STATUS_DOT: Record<string, string> = {
  completed: "text-brand-600",
  confirmed: "text-green-600",
  pending: "text-amber-600",
  declined: "text-gray-400",
  cancelled: "text-gray-400",
};

function CustomerCard({
  row,
  dict,
  locale,
  currency,
}: {
  row: CustomerRow;
  dict: Dict;
  locale: Locale;
  currency: string;
}) {
  const a = dict.admin;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [memo, setMemo] = useState(row.memo);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const d = daysSince(row.lastVisitIso);
  const lastText =
    row.lastVisitIso == null
      ? "-"
      : d === 0
        ? a.today2
        : `${d}${a.daysAgo}`;

  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between text-left"
      >
        <div>
          <p className="font-bold text-brand-900">
            {row.name || row.contact}{" "}
            <span className="text-xs font-normal text-muted">
              · {row.visits}
              {a.visits}
            </span>
          </p>
          <p className="text-sm text-muted">{row.contact}</p>
          {row.referral_source && (
            <span className="mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-600">
              {referralLabel(row.referral_source, dict)}
            </span>
          )}
        </div>
        <div className="text-right text-xs">
          <p className="text-muted">{a.lastVisit}</p>
          <p className="font-semibold text-brand-700">{lastText}</p>
          <p className="mt-1 text-muted">{a.totalSpent}</p>
          <p className="font-semibold text-brand-700">
            {formatMoney(row.totalSpent, currency)}
          </p>
        </div>
      </button>

      {open && (
        <div className="mt-3 border-t border-brand-100 pt-3">
          {/* 방문 이력 */}
          <p className="mb-1 text-xs font-semibold uppercase text-brand-400">
            {a.history}
          </p>
          {row.history.length === 0 ? (
            <p className="text-sm text-muted">-</p>
          ) : (
            <ul className="space-y-1">
              {row.history.map((h, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className={STATUS_DOT[h.status] ?? "text-muted"}>●</span>
                  <span className="w-28 shrink-0 text-xs text-muted">
                    {formatDateTime(h.dateIso, locale)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-brand-900">
                    {h.servicesText}
                  </span>
                  {h.amount > 0 && (
                    <span className="shrink-0 text-xs font-semibold text-brand-700">
                      {formatMoney(h.amount, currency)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* 메모 */}
          <p className="mb-1 mt-3 text-xs font-semibold uppercase text-brand-400">
            {a.customerMemo}
          </p>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
          <button
            disabled={pending || memo === row.memo}
            onClick={() =>
              startTransition(async () => {
                const res = await saveCustomerMemo({
                  customerId: row.id,
                  memo,
                });
                if (res.ok) {
                  setSaved(true);
                  setTimeout(() => setSaved(false), 1500);
                  router.refresh();
                }
              })
            }
            className="mt-2 rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            {saved ? "✓" : a.saveMemo}
          </button>
        </div>
      )}
    </div>
  );
}
