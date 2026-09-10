"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  removeLogo,
  saveSettings,
  sendTestEmail,
  uploadLogo,
  type ActionResult,
} from "@/app/admin/actions";
import type { Dict, Locale } from "@/lib/i18n";
import { defaultHeadline } from "@/lib/bookingNotice";
import type { Settings } from "@/lib/types";

export function SettingsForm({
  settings,
  dict,
  locale,
}: {
  settings: Settings;
  dict: Dict;
  locale: Locale;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveSettings,
    null,
  );
  const a = dict.admin;
  const input =
    "w-full rounded-md border border-brand-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400";

  return (
    <div className="space-y-4 pb-4">
      <LogoUploader logoUrl={settings.logo_url} dict={dict} />

      <form action={action} className="space-y-5">
        <Section title={a.secShop} defaultOpen>
          <Group title={a.shopName}>
            <Bi>
              <Text name="shop_name_ko" label={a.ko} def={settings.shop_name_ko} cls={input} />
              <Text name="shop_name_en" label={a.en} def={settings.shop_name_en} cls={input} />
            </Bi>
          </Group>
          <Group title={a.heroTagline}>
            <Text name="hero_tagline_ko" label={a.ko} def={settings.hero_tagline_ko} cls={input} />
            <Text name="hero_tagline_en" label={a.en} def={settings.hero_tagline_en} cls={input} />
          </Group>
          <Group title={a.heroSub}>
            <Area name="hero_sub_ko" label={a.ko} def={settings.hero_sub_ko} cls={input} />
            <Area name="hero_sub_en" label={a.en} def={settings.hero_sub_en} cls={input} />
          </Group>
        </Section>

        <Section title={a.secNotices}>
          <Group title={a.scheduleNote}>
            <Area name="schedule_note_ko" label={a.ko} def={settings.schedule_note_ko} cls={input} />
            <Area name="schedule_note_en" label={a.en} def={settings.schedule_note_en} cls={input} />
          </Group>
          <Group title={a.notice}>
            <Area name="notice_ko" label={a.ko} def={settings.notice_ko} cls={input} />
            <Area name="notice_en" label={a.en} def={settings.notice_en} cls={input} />
          </Group>
        </Section>

        <Section title={a.secMessages}>
          <p className="mb-3 text-xs text-muted">{a.secMessagesHint}</p>
          <Group title={a.msgInvite}>
            <Area
              name="msg_invite"
              label=""
              def={settings.msg_invite || a.shareMsgBook}
              cls={input}
            />
          </Group>
          {(["confirmed", "changed", "declined", "cancelled"] as const).map(
            (kind) => (
              <Group key={kind} title={MSG_LABEL[kind](a)}>
                <Area
                  name={`msg_${kind}`}
                  label=""
                  def={
                    (settings[`msg_${kind}`] as string) ||
                    defaultHeadline(kind, locale)
                  }
                  cls={input}
                />
              </Group>
            ),
          )}
        </Section>

        <Section title={a.secLocation}>
          <Group title={a.location}>
            <Area name="location_ko" label={a.ko} def={settings.location_ko} cls={input} />
            <Area name="location_en" label={a.en} def={settings.location_en} cls={input} />
          </Group>
          <Group title={a.confirmedAddress}>
            <p className="mb-2 text-xs text-muted">{a.confirmedAddressHint}</p>
            <Area name="confirmed_address" label="" def={settings.confirmed_address} cls={input} />
          </Group>
        </Section>

        <Section title={a.secPayment}>
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
        </Section>

      <div className="sticky bottom-20 z-10">
        {state?.ok && (
          <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-center text-sm text-green-700">
            ✓ {a.saved}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-brand-600 px-5 py-3 font-semibold text-white shadow-lg disabled:opacity-50"
        >
          {pending ? dict.common.saving : dict.common.save}
        </button>
      </div>
      </form>

      <Section title={a.emailCheck}>
        <p className="mb-2 text-xs text-muted">{a.emailCheckHint}</p>
        <EmailCheck dict={dict} />
      </Section>
    </div>
  );
}

function LogoUploader({
  logoUrl,
  dict,
}: {
  logoUrl: string;
  dict: Dict;
}) {
  const a = dict.admin;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    uploadLogo,
    null,
  );
  const [delPending, startDelete] = useTransition();

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <section className="rounded-lg border border-brand-100 bg-white p-4">
      <h2 className="mb-3 text-sm font-bold text-brand-900">{a.logo}</h2>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-100 text-3xl">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="logo" className="h-full w-full object-cover" />
          ) : (
            "💅"
          )}
        </div>
        <form ref={formRef} action={action} className="min-w-0 flex-1 space-y-2">
          <input
            type="file"
            name="file"
            accept="image/*"
            required
            className="block w-full text-sm text-brand-900 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-2 file:text-brand-900"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {pending ? dict.common.saving : a.logoUpload}
            </button>
            {logoUrl && (
              <button
                type="button"
                disabled={delPending}
                onClick={() =>
                  startDelete(async () => {
                    await removeLogo();
                    router.refresh();
                  })
                }
                className="rounded-lg border border-brand-200 px-3 py-1.5 text-xs text-brand-900 disabled:opacity-40"
              >
                {a.logoRemove}
              </button>
            )}
          </div>
        </form>
      </div>
      <p className="mt-2 text-xs text-muted">{a.logoHint}</p>
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-brand-100 bg-white p-4">
      <h2 className="mb-3 text-sm font-bold text-brand-900">{title}</h2>
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

/** 이메일이 실제로 나가는지 눌러서 확인 — 실패 사유를 그대로 보여준다. */
function EmailCheck({ dict }: { dict: Dict }) {
  const a = dict.admin;
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMsg(null);
            const res = await sendTestEmail();
            setMsg(
              res.ok
                ? {
                    ok: res.status === "delivered" || res.status === "sent",
                    text:
                      `${a.testEmailSent} ${res.to}\n` +
                      `${a.emailStatus}: ${res.status}\n` +
                      `${a.emailFrom}: ${res.from}`,
                  }
                : { ok: false, text: res.error },
            );
          })
        }
        className="rounded-md border border-brand-200 px-4 py-2 text-sm font-semibold text-brand-900 disabled:opacity-40"
      >
        {pending ? a.syncing : a.sendTestEmail}
      </button>
      {msg && (
        <p
          className={`mt-2 whitespace-pre-line text-xs ${
            msg.ok ? "text-green-700" : "text-red-600"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}

const MSG_LABEL = {
  confirmed: (a: Dict["admin"]) => a.msgConfirmed,
  changed: (a: Dict["admin"]) => a.msgChanged,
  declined: (a: Dict["admin"]) => a.msgDeclined,
  cancelled: (a: Dict["admin"]) => a.msgCancelled,
};

/** 설정 한 묶음. 기본은 접혀 있어 화면이 한눈에 들어온다. */
function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-brand-100 bg-white"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[15px] font-bold text-brand-900">
        {title}
        <span
          className="text-brand-400 transition-transform group-open:rotate-180"
          aria-hidden
        >
          {"\u2304"}
        </span>
      </summary>
      <div className="space-y-4 border-t border-brand-100 px-4 py-4">
        {children}
      </div>
    </details>
  );
}
