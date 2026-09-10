"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import { lookupByNamePhone } from "@/app/actions";

export function StatusLookup({
  defaultCode,
  dict,
}: {
  defaultCode?: string;
  dict: Dict;
}) {
  const st = dict.status;
  const router = useRouter();
  const [tab, setTab] = useState<"code" | "namephone">("code");
  const [code, setCode] = useState(defaultCode ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const inputClass =
    "w-full rounded-md border border-brand-200 bg-white px-4 py-3 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  function lookupCode() {
    if (!code.trim()) return;
    router.push(`/status?code=${encodeURIComponent(code.trim().toUpperCase())}`);
  }
  function lookupNamePhone() {
    setErr("");
    startTransition(async () => {
      const res = await lookupByNamePhone({ name, phone });
      if (res.ok) router.push(`/status?code=${res.code}`);
      else setErr(st.notFoundNamePhone);
    });
  }

  return (
    <div>
      {/* 탭 */}
      <div className="mb-3 flex gap-2">
        {(["code", "namephone"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setErr("");
            }}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
              tab === t
                ? "bg-brand-600 text-white"
                : "border border-brand-200 bg-white text-brand-900"
            }`}
          >
            {t === "code" ? st.tabCode : st.tabNamePhone}
          </button>
        ))}
      </div>

      {tab === "code" ? (
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookupCode()}
            placeholder={st.codePlaceholder}
            className={`${inputClass} tracking-widest`}
            autoCapitalize="characters"
          />
          <button
            onClick={lookupCode}
            className="shrink-0 rounded-md bg-brand-600 px-5 py-3 font-semibold text-white"
          >
            {st.lookup}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={st.nameLabel}
            className={inputClass}
            autoComplete="name"
          />
          <div className="flex gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookupNamePhone()}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={st.phoneLookupLabel}
              className={inputClass}
            />
            <button
              onClick={lookupNamePhone}
              disabled={pending}
              className="shrink-0 rounded-md bg-brand-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {st.lookup}
            </button>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
      )}
    </div>
  );
}
