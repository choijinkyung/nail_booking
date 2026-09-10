"use client";

import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import type { PickerCustomer } from "./BookingCalendar";

/** 예약에 붙일 고객: 기존 고객 id, 또는 새로 만들 고객 정보. */
export type PickedCustomer =
  | { id: string }
  | { name: string; contact: string; email?: string };

/**
 * 기존 고객 검색 / 새 고객 입력 두 모드를 토글하는 선택기.
 * 유효한 선택이 없으면 onChange(null) 을 호출한다.
 */
export function CustomerPicker({
  customers,
  dict,
  onChange,
}: {
  customers: PickerCustomer[];
  dict: Dict;
  onChange: (v: PickedCustomer | null) => void;
}) {
  const a = dict.admin;
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [q, setQ] = useState("");
  const [pickedId, setPickedId] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");

  const needle = q.trim().toLowerCase();
  const matches = needle
    ? customers
        .filter(
          (c) =>
            c.name.toLowerCase().includes(needle) ||
            c.contact.toLowerCase().includes(needle),
        )
        .slice(0, 6)
    : [];

  const field =
    "w-full rounded-xl border border-brand-200 px-3 py-2 text-sm outline-none focus:border-brand-400";

  function switchMode(next: "existing" | "new") {
    setMode(next);
    // 모드를 바꾸면 이전 모드의 선택은 무효 — 상위에 즉시 알린다.
    if (next === "existing") {
      onChange(pickedId ? { id: pickedId } : null);
    } else {
      onChange(
        name.trim() && contact.trim()
          ? { name: name.trim(), contact: contact.trim(), email: email.trim() }
          : null,
      );
    }
  }

  function emitNew(n: string, c: string, e: string) {
    onChange(
      n.trim() && c.trim()
        ? { name: n.trim(), contact: c.trim(), email: e.trim() }
        : null,
    );
  }

  const tab = (on: boolean) =>
    `rounded-lg px-3 py-1 text-xs font-semibold ${
      on ? "bg-brand-600 text-white" : "border border-brand-200 text-brand-700"
    }`;

  return (
    <div className="space-y-2">
      <p className="text-[13px] font-semibold text-brand-400">
        {a.pickCustomer}
      </p>

      <div className="flex gap-2">
        <button onClick={() => switchMode("existing")} className={tab(mode === "existing")}>
          {a.existingCustomer}
        </button>
        <button onClick={() => switchMode("new")} className={tab(mode === "new")}>
          {a.orNewCustomer}
        </button>
      </div>

      {mode === "existing" ? (
        <div className="space-y-1">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPickedId("");
              onChange(null);
            }}
            placeholder={a.searchCustomer}
            className={field}
          />
          {pickedId ? (
            <p className="text-sm font-medium text-brand-700">
              ✓ {customers.find((c) => c.id === pickedId)?.name}{" "}
              <span className="text-xs font-normal text-muted">
                {customers.find((c) => c.id === pickedId)?.contact}
              </span>
            </p>
          ) : needle && matches.length === 0 ? (
            <p className="text-xs text-amber-600">{a.noCustomerMatch}</p>
          ) : (
            matches.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setPickedId(c.id);
                  onChange({ id: c.id });
                }}
                className="block w-full rounded-lg px-2 py-1 text-left text-sm hover:bg-brand-50"
              >
                <span className="font-medium text-brand-900">{c.name}</span>{" "}
                <span className="text-xs text-muted">{c.contact}</span>
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              emitNew(e.target.value, contact, email);
            }}
            placeholder={a.customerName}
            className={field}
          />
          <input
            value={contact}
            onChange={(e) => {
              setContact(e.target.value);
              emitNew(name, e.target.value, email);
            }}
            placeholder={a.customerContact}
            inputMode="tel"
            className={field}
          />
          <input
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              emitNew(name, contact, e.target.value);
            }}
            placeholder={a.customerEmail}
            inputMode="email"
            className={field}
          />
        </div>
      )}
    </div>
  );
}
