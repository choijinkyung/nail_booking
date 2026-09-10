"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import type { BookingStatus } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { createCustomer } from "@/app/admin/actions";

export interface CustomerRow {
  id: string;
  contact: string;
  name: string;
  email: string;
  referral_source: string;
  memo: string;
  visits: number;
  isReturning: boolean;
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
  currency,
}: {
  rows: CustomerRow[];
  dict: Dict;
  currency: string;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(needle) ||
          r.contact.toLowerCase().includes(needle),
      )
    : rows;

  return (
    <div className="space-y-3">
      <RegisterCustomer dict={dict} />

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={dict.admin.searchByPhone}
        inputMode="search"
        className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
      />

      {rows.length === 0 ? (
        <p className="rounded-xl bg-white/60 p-4 text-sm text-muted">
          {dict.admin.noCustomers}
        </p>
      ) : shown.length === 0 ? (
        <p className="rounded-xl bg-white/60 p-4 text-sm text-muted">
          {dict.admin.noSearchResult}
        </p>
      ) : (
        shown.map((r) => (
          <CustomerCard key={r.id} row={r} dict={dict} currency={currency} />
        ))
      )}
    </div>
  );
}

/** 관리자가 손님을 직접 등록하는 폼. 연락처가 식별 키라 이름+연락처는 필수. */
function RegisterCustomer({ dict }: { dict: Dict }) {
  const a = dict.admin;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  const field =
    "w-full rounded-xl border border-brand-200 px-3 py-2 text-sm outline-none focus:border-brand-400";

  return (
    <div>
      <button
        onClick={() => {
          setOpen((v) => !v);
          setMsg("");
        }}
        className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white"
      >
        {open ? "\u00d7" : "+"} {a.registerCustomer}
      </button>

      {open && (
        <div className="mt-2 space-y-2 rounded-2xl border border-brand-100 bg-white p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={a.customerName}
            className={field}
          />
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={a.customerContact}
            inputMode="tel"
            className={field}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={a.customerEmail}
            inputMode="email"
            className={field}
          />
          {msg && <p className="text-xs text-amber-600">{msg}</p>}
          <button
            disabled={pending || !name.trim() || !contact.trim()}
            onClick={() =>
              startTransition(async () => {
                setMsg("");
                const res = await createCustomer({ name, contact, email });
                if (!res.ok) {
                  setMsg(a.saveErr);
                  return;
                }
                if (res.existed) {
                  setMsg(a.duplicateContact);
                  return;
                }
                setName("");
                setContact("");
                setEmail("");
                setOpen(false);
                router.refresh();
              })
            }
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            {a.saveCustomer}
          </button>
        </div>
      )}
    </div>
  );
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

/** 목록의 한 줄. 자세한 내용·수정·삭제는 상세 페이지에서 한다. */
function CustomerCard({
  row,
  dict,
  currency,
}: {
  row: CustomerRow;
  dict: Dict;
  currency: string;
}) {
  const a = dict.admin;
  const d = daysSince(row.lastVisitIso);
  const lastText =
    row.lastVisitIso == null ? "-" : d === 0 ? a.today2 : `${d}${a.daysAgo}`;

  return (
    <Link
      href={`/admin/customers/${row.id}`}
      className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white p-4 active:bg-brand-50"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-bold text-brand-900">
            {row.name || row.contact}
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              row.isReturning
                ? "bg-brand-100 text-brand-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {row.isReturning ? a.badgeReturning : a.badgeNew}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-sm text-muted">
          {row.contact}
        </span>
      </span>

      <span className="shrink-0 text-right text-xs">
        <span className="block text-muted">
          {row.visits}
          {a.visits} · {lastText}
        </span>
        <span className="block font-semibold text-brand-700">
          {formatMoney(row.totalSpent, currency)}
        </span>
      </span>
      <span className="shrink-0 text-brand-300">›</span>
    </Link>
  );
}
