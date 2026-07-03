"use client";

import { useActionState } from "react";
import { saveSettings, type ActionResult } from "@/app/admin/actions";
import type { Dict } from "@/lib/i18n";
import type { Settings } from "@/lib/types";

export function SettingsForm({
  settings,
  dict,
}: {
  settings: Settings;
  dict: Dict;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveSettings,
    null,
  );
  const a = dict.admin;
  const input =
    "w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400";

  return (
    <form action={action} className="space-y-5 pb-4">
      <Group title={a.shopName}>
        <Bi>
          <Text name="shop_name_ko" label={a.ko} def={settings.shop_name_ko} cls={input} />
          <Text name="shop_name_en" label={a.en} def={settings.shop_name_en} cls={input} />
        </Bi>
      </Group>

      <Group title={a.location}>
        <Area name="location_ko" label={a.ko} def={settings.location_ko} cls={input} />
        <Area name="location_en" label={a.en} def={settings.location_en} cls={input} />
      </Group>

      <Group title={`⚠️ ${a.notice}`}>
        <Area name="notice_ko" label={a.ko} def={settings.notice_ko} cls={input} />
        <Area name="notice_en" label={a.en} def={settings.notice_en} cls={input} />
      </Group>

      <Group title={a.paymentInfo}>
        <Area name="payment_ko" label={a.ko} def={settings.payment_ko} cls={input} />
        <Area name="payment_en" label={a.en} def={settings.payment_en} cls={input} />
      </Group>

      <Group title={a.etransferEmail}>
        <Text name="etransfer_email" label="" def={settings.etransfer_email} cls={input} type="email" />
        <div className="mt-2">
          <Bi>
            <Area name="etransfer_note_ko" label={`${a.etransferNote} (${a.ko})`} def={settings.etransfer_note_ko} cls={input} />
            <Area name="etransfer_note_en" label={`${a.etransferNote} (${a.en})`} def={settings.etransfer_note_en} cls={input} />
          </Bi>
        </div>
      </Group>

      <Group title={a.currency}>
        <Text name="currency" label="" def={settings.currency} cls={input} />
      </Group>

      <div className="sticky bottom-20 z-10">
        {state?.ok && (
          <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-center text-sm text-green-700">
            ✓ {a.saved}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white shadow-lg disabled:opacity-50"
        >
          {pending ? dict.common.saving : dict.common.save}
        </button>
      </div>
    </form>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-brand-100 bg-white p-4">
      <h2 className="mb-3 text-sm font-bold text-brand-700">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Bi({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function Text({
  name,
  label,
  def,
  cls,
  type = "text",
}: {
  name: string;
  label: string;
  def: string;
  cls: string;
  type?: string;
}) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs text-muted">{label}</span>}
      <input name={name} defaultValue={def} type={type} className={cls} />
    </label>
  );
}

function Area({
  name,
  label,
  def,
  cls,
}: {
  name: string;
  label: string;
  def: string;
  cls: string;
}) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs text-muted">{label}</span>}
      <textarea name={name} defaultValue={def} rows={2} className={cls} />
    </label>
  );
}
