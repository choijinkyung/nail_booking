"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import { referralLabel } from "@/lib/i18n";
import { formatDateTime, formatMoney } from "@/lib/format";
import { deleteCustomer, updateCustomer } from "@/app/admin/actions";
import type { CustomerRow } from "./CustomersManager";

const STATUS_DOT: Record<string, string> = {
  completed: "text-brand-600",
  confirmed: "text-green-600",
  pending: "text-amber-600",
  declined: "text-gray-400",
  cancelled: "text-gray-400",
};

export function CustomerDetail({
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
  const [name, setName] = useState(row.name);
  const [contact, setContact] = useState(row.contact);
  const [email, setEmail] = useState(row.email);
  const [memo, setMemo] = useState(row.memo);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty =
    name !== row.name ||
    contact !== row.contact ||
    email !== row.email ||
    memo !== row.memo;

  const field =
    "w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400";

  function save() {
    startTransition(async () => {
      setErr("");
      setMsg("");
      const res = await updateCustomer({
        customerId: row.id,
        name,
        contact,
        email,
        memo,
      });
      if (res.ok) {
        setMsg(a.savedMark);
        router.refresh();
        return;
      }
      setErr(res.error === "DUPLICATE" ? a.duplicateContactEdit : a.saveErr);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteCustomer({ customerId: row.id });
      if (res.ok) router.push("/admin/customers");
      else setErr(a.saveErr);
    });
  }

  return (
    <div className="space-y-3">
      <Link
        href="/admin/customers"
        className="text-sm text-brand-600 hover:underline"
      >
        ← {a.backToCustomers}
      </Link>

      {/* 요약 */}
      <section className="rounded-lg border border-brand-100 bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-brand-900">
              {row.name || row.contact}
            </p>
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                row.isReturning
                  ? "bg-brand-100 text-brand-900"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {row.isReturning ? a.badgeReturning : a.badgeNew}
            </span>
            {row.referral_source && (
              <span className="ml-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-600">
                {referralLabel(row.referral_source, dict)}
              </span>
            )}
          </div>
          <div className="shrink-0 text-right text-xs">
            <p className="text-muted">
              {row.visits}
              {a.visits}
            </p>
            <p className="mt-1 font-semibold text-brand-900">
              {formatMoney(row.totalSpent, currency)}
            </p>
          </div>
        </div>
      </section>

      {/* 수정 */}
      <section className="space-y-2 rounded-lg border border-brand-100 bg-white p-4">
        <p className="text-[13px] font-semibold text-brand-400">
          {a.editCustomer}
        </p>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">{a.customerName}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">{a.customerContact}</span>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            inputMode="tel"
            className={field}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">{a.customerEmail}</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            className={field}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">{a.customerMemo}</span>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            className={field}
          />
        </label>

        {err && <p className="text-xs text-red-600">{err}</p>}

        <button
          disabled={pending || !dirty || !name.trim() || !contact.trim()}
          onClick={save}
          className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          {msg && !dirty ? `✓ ${msg}` : dict.common.save}
        </button>
      </section>

      {/* 방문 이력 */}
      <section className="rounded-lg border border-brand-100 bg-white p-4">
        <p className="mb-2 text-[13px] font-semibold text-brand-400">
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
                  <span className="shrink-0 text-xs font-semibold text-brand-900">
                    {formatMoney(h.amount, currency)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 삭제 */}
      <section className="rounded-lg border border-red-100 bg-white p-4">
        {confirmDelete ? (
          <div className="space-y-2">
            <p className="text-sm text-red-700">{a.deleteCustomerConfirm}</p>
            <div className="flex gap-2">
              <button
                disabled={pending}
                onClick={remove}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {dict.common.delete}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-brand-200 px-4 py-1.5 text-xs text-brand-900"
              >
                {dict.common.cancel}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs font-semibold text-red-600"
          >
            {a.deleteCustomer}
          </button>
        )}
      </section>
    </div>
  );
}
