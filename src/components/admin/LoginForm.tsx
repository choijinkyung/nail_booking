"use client";

import { useActionState } from "react";
import { signIn, type ActionResult } from "@/app/admin/actions";
import type { Dict } from "@/lib/i18n";

export function LoginForm({ dict }: { dict: Dict }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    signIn,
    null,
  );

  const inputClass =
    "w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-brand-800">
            {dict.admin.firstName}
          </span>
          <input
            name="first_name"
            required
            autoComplete="given-name"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-brand-800">
            {dict.admin.lastName}
          </span>
          <input
            name="last_name"
            required
            autoComplete="family-name"
            className={inputClass}
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-brand-800">
          {dict.admin.password}
        </span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </label>
      {state && !state.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {dict.admin.loginError}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
      >
        {pending ? dict.admin.signingIn : dict.admin.signIn}
      </button>
    </form>
  );
}
