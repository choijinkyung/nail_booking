"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import { lookupByNamePassword } from "@/app/actions";

export function StatusLookup({
  defaultCode,
  dict,
}: {
  defaultCode?: string;
  dict: Dict;
}) {
  const st = dict.status;
  const router = useRouter();
  const [tab, setTab] = useState<"code" | "namepw">("code");
  const [code, setCode] = useState(defaultCode ?? "");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const inputClass =
    "w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  function lookupCode() {
    if (!code.trim()) return;
    router.push(`/status?code=${encodeURIComponent(code.trim().toUpperCase())}`);
  }
  function lookupNamePw() {
    setErr("");
    startTransition(async () => {
      const res = await lookupByNamePassword({ name, password });
      if (res.ok) router.push(`/status?code=${res.code}`);
      else setErr(st.notFoundNamePw);
    });
  }

  return (
    <div>
      {/* 탭 */}
      <div className="mb-3 flex gap-2">
        {(["code", "namepw"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setErr("");
            }}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              tab === t
                ? "bg-brand-600 text-white"
                : "border border-brand-200 bg-white text-brand-700"
            }`}
          >
            {t === "code" ? st.tabCode : st.tabNamePw}
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
            className={`${inputClass} uppercase tracking-widest`}
            autoCapitalize="characters"
          />
          <button
            onClick={lookupCode}
            className="shrink-0 rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookupNamePw()}
              type="password"
              placeholder={st.passwordLabel}
              className={inputClass}
            />
            <button
              onClick={lookupNamePw}
              disabled={pending}
              className="shrink-0 rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
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
