"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/auth";
import {
  clearAdminSession,
  setAdminSession,
  verifyCredentials,
} from "@/lib/adminAuth";
import { notifyCustomerCompleted, notifyCustomerResult } from "@/lib/email";
import { getSiteUrl } from "@/lib/url";
import { formatMoney, formatSlot } from "@/lib/format";
import { getLocale } from "@/lib/locale";
import {
  bookingDurationMin,
  fitFrom,
  slotStartsForDuration,
  sortSlots,
} from "@/lib/scheduling";
import type {
  AvailabilitySlot,
  Booking,
  BookingServiceLine,
  Service,
} from "@/lib/types";
import { generateCode } from "@/lib/code";
import { buildServiceLines } from "@/lib/bookingLines";

// ── 인증 ─────────────────────────────────────────────────────
export type ActionResult = { ok: true } | { ok: false; error: string };

export async function signIn(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const firstName = String(formData.get("first_name") ?? "");
  const lastName = String(formData.get("last_name") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!verifyCredentials(firstName, lastName, password)) {
    return { ok: false, error: "INVALID" };
  }
  await setAdminSession();
  redirect("/admin");
}

export async function signOut() {
  await clearAdminSession();
  redirect("/admin/login");
}

// ── 예약 처리 ────────────────────────────────────────────────

/** 고객에게 결과 메일 (베스트 에포트) */
async function emailResult(
  booking: Pick<Booking, "customer_email" | "code" | "admin_message">,
  confirmed: boolean,
  slot: Pick<AvailabilitySlot, "starts_at" | "ends_at"> | null,
) {
  if (!booking.customer_email) return;
  try {
    const [siteUrl, locale] = await Promise.all([getSiteUrl(), getLocale()]);
    await notifyCustomerResult({
      to: booking.customer_email,
      confirmed,
      code: booking.code,
      timeText: slot ? formatSlot(slot, locale) : "",
      message: booking.admin_message ?? "",
      siteUrl,
    });
  } catch (err) {
    console.error("[emailResult] 무시:", err);
  }
}

/**
 * 예약 확정 (소요시간만큼 30분 슬롯을 통째로 점유).
 * ★ 중복 예약 방지: 소요시간이 들어가는 연속 open 슬롯이 있어야 하며, 조건부 잠금 +
 *   유니크 인덱스로 이중 방어. 확정한 시간부터 소요시간 동안의 슬롯이 모두 막힙니다.
 */
export async function confirmBooking(input: {
  bookingId: string;
  slotId: string;
  message?: string;
}): Promise<ActionResult> {
  await assertAdmin();
  const sb = createSupabaseAdminClient();

  // 0) 예약 정보 (소요시간·기존 점유 슬롯)
  const { data: bRow } = await sb
    .from("bookings")
    .select("services, occupied_slot_ids")
    .eq("id", input.bookingId)
    .single();
  if (!bRow) return { ok: false, error: "DB" };
  const duration = bookingDurationMin(
    (bRow as { services: BookingServiceLine[] }).services ?? [],
  );
  const prevOcc =
    (bRow as { occupied_slot_ids: string[] }).occupied_slot_ids ?? [];

  // 1) 이전 점유 슬롯 반납 (시간 변경/재확정 대비)
  if (prevOcc.length > 0) {
    await sb
      .from("availability_slots")
      .update({ status: "open" })
      .in("id", prevOcc)
      .eq("status", "booked");
  }

  // 2) 소요시간이 들어가는 연속 슬롯 계산
  const nowIso = new Date().toISOString();
  const { data: slotRows } = await sb
    .from("availability_slots")
    .select("id, starts_at, status")
    .gte("starts_at", nowIso)
    .neq("status", "blocked")
    .order("starts_at", { ascending: true });
  const sorted = sortSlots(
    (slotRows as { id: string; starts_at: string; status: string }[]) ?? [],
  );
  const occ = fitFrom(sorted, input.slotId, duration);
  async function restorePrev() {
    if (prevOcc.length > 0)
      await sb
        .from("availability_slots")
        .update({ status: "booked" })
        .in("id", prevOcc);
  }
  if (!occ) {
    await restorePrev();
    return { ok: false, error: "SLOT_TAKEN" };
  }

  // 3) 계산된 슬롯들을 원자적으로 잠금
  const { data: locked } = await sb
    .from("availability_slots")
    .update({ status: "booked" })
    .in("id", occ)
    .eq("status", "open")
    .select("id");
  if (!locked || locked.length !== occ.length) {
    // 경쟁 상태: 일부만 잠김 → 되돌리기
    await sb.from("availability_slots").update({ status: "open" }).in("id", occ);
    await restorePrev();
    return { ok: false, error: "SLOT_TAKEN" };
  }

  // 4) 예약 확정
  const { data: updated, error: upErr } = await sb
    .from("bookings")
    .update({
      status: "confirmed",
      confirmed_slot_id: input.slotId,
      occupied_slot_ids: occ,
      admin_message: input.message ?? "",
      request_kind: "",
      change_request: "",
      change_requested_at: null,
      requested_slot_id: null,
      proposed_slot_ids: [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.bookingId)
    .in("status", ["pending", "confirmed"])
    .select("*")
    .single();

  if (upErr || !updated) {
    await sb.from("availability_slots").update({ status: "open" }).in("id", occ);
    await restorePrev();
    return { ok: false, error: "DB" };
  }

  const startSlot = sorted.find((s) => s.id === input.slotId);
  await emailResult(
    updated as Booking,
    true,
    startSlot ? { starts_at: startSlot.starts_at, ends_at: null } : null,
  );
  revalidatePath("/admin");
  revalidatePath("/admin/availability");
  revalidatePath("/admin/calendar");
  return { ok: true };
}

/**
 * 관리자가 직접 예약을 등록 (워크인/전화). 즉시 confirmed, 이메일 없음.
 * 손님용 canBook 의 60분 최소 간격 규칙은 무시하며, 오직 이미 booked 된
 * 슬롯과의 충돌만 막는다.
 */
export async function createAdminBooking(input: {
  customer:
    | { id: string }
    | { name: string; contact: string; email?: string; referral?: string };
  services: { service_id: string; quantity: number }[];
  startsAtISO: string;
  note?: string;
}): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  await assertAdmin();
  if (!input.startsAtISO) return { ok: false, error: "INVALID" };
  if (!input.services || input.services.length === 0)
    return { ok: false, error: "NO_SERVICE" };
  const sb = createSupabaseAdminClient();

  // 1) 시술 스냅샷 (DB 가격 기준)
  const serviceIds = [...new Set(input.services.map((s) => s.service_id))];
  const { data: svcRows } = await sb
    .from("services")
    .select("*")
    .in("id", serviceIds)
    .eq("active", true);
  const lines = buildServiceLines((svcRows as Service[]) ?? [], input.services);
  if (lines.length === 0) return { ok: false, error: "NO_SERVICE" };
  const estimatedTotal = lines.reduce((s, l) => s + l.subtotal, 0);
  const duration = bookingDurationMin(lines);

  // 2) 고객 확정 (기존 id 또는 연락처 upsert)
  let customerId: string | null = null;
  let name = "";
  let contact = "";
  let email = "";
  let referral = "";
  if ("id" in input.customer) {
    const { data: c } = await sb
      .from("customers")
      .select("id, name, contact, email, referral_source")
      .eq("id", input.customer.id)
      .maybeSingle();
    if (!c) return { ok: false, error: "NO_CUSTOMER" };
    const cc = c as { id: string; name: string; contact: string; email: string; referral_source: string };
    customerId = cc.id; name = cc.name; contact = cc.contact; email = cc.email; referral = cc.referral_source;
  } else {
    name = (input.customer.name ?? "").trim();
    contact = (input.customer.contact ?? "").trim();
    email = (input.customer.email ?? "").trim();
    referral = (input.customer.referral ?? "").trim();
    if (!name || !contact) return { ok: false, error: "INVALID" };
    const { data: existing } = await sb
      .from("customers").select("id").eq("contact", contact).maybeSingle();
    if (existing) {
      customerId = (existing as { id: string }).id;
      await sb.from("customers").update({ name, email }).eq("id", customerId);
    } else {
      const { data: created, error: insErr } = await sb
        .from("customers")
        .insert({ contact, name, email, referral_source: referral })
        .select("id").single();
      customerId = (created as { id: string } | null)?.id ?? null;
      if (!customerId && insErr?.code === "23505") {
        // 동시에 같은 연락처로 등록된 경우: 방금 다른 요청이 만든 행을 재조회해 연결한다.
        const { data: raced } = await sb
          .from("customers").select("id").eq("contact", contact).maybeSingle();
        customerId = (raced as { id: string } | null)?.id ?? null;
      }
    }
  }

  // 3) 소요시간만큼 연속 30분 슬롯 확보 (없으면 생성). 규칙 무시, booked 와만 충돌 금지.
  const occIsos = slotStartsForDuration(input.startsAtISO, duration);
  // 없는 슬롯은 open 으로 생성 (이미 있으면 무시)
  const { error: seedErr } = await sb.from("availability_slots").upsert(
    occIsos.map((iso) => ({ starts_at: iso, status: "open" })),
    { onConflict: "starts_at", ignoreDuplicates: true },
  );
  if (seedErr) return { ok: false, error: "DB" };
  // 원자적 잠금: open 인 것만 booked 로. 하나라도 booked/blocked 면 개수 부족 → 충돌.
  const { data: locked } = await sb
    .from("availability_slots")
    .update({ status: "booked" })
    .in("starts_at", occIsos)
    .eq("status", "open")
    .select("id, starts_at");
  const lockedRows = (locked as { id: string; starts_at: string }[] | null) ?? [];
  if (lockedRows.length !== occIsos.length) {
    // 롤백
    await sb.from("availability_slots").update({ status: "open" })
      .in("id", lockedRows.map((r) => r.id));
    return { ok: false, error: "SLOT_TAKEN" };
  }
  const sortedLocked = [...lockedRows].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const confirmedSlotId = sortedLocked[0].id;
  const occupiedIds = sortedLocked.map((r) => r.id);

  // 4) 예약 insert (confirmed). 코드 충돌 재시도. 이메일 없음.
  let code = "";
  let inserted = false;
  for (let attempt = 0; attempt < 6 && !inserted; attempt++) {
    code = generateCode();
    const { error } = await sb.from("bookings").insert({
      code,
      customer_id: customerId,
      customer_name: name,
      customer_contact: contact,
      customer_email: email,
      referral_source: referral,
      services: lines,
      estimated_total: estimatedTotal,
      note: (input.note ?? "").trim(),
      status: "confirmed",
      confirmed_slot_id: confirmedSlotId,
      occupied_slot_ids: occupiedIds,
    });
    if (!error) inserted = true;
    else if (error.code !== "23505") {
      // 코드 중복이 아니면 실패 → 슬롯 롤백
      await sb.from("availability_slots").update({ status: "open" }).in("id", occupiedIds);
      return { ok: false, error: "DB" };
    }
  }
  if (!inserted) {
    await sb.from("availability_slots").update({ status: "open" }).in("id", occupiedIds);
    return { ok: false, error: "DB" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/availability");
  revalidatePath("/admin/customers");
  return { ok: true, code };
}

export async function declineBooking(input: {
  bookingId: string;
  message?: string;
}): Promise<ActionResult> {
  await assertAdmin();
  const sb = createSupabaseAdminClient();
  // 혹시 점유 슬롯이 있으면 반납
  const { data: pre } = await sb
    .from("bookings")
    .select("occupied_slot_ids")
    .eq("id", input.bookingId)
    .single();
  const occ = (pre as { occupied_slot_ids: string[] } | null)?.occupied_slot_ids;
  if (occ && occ.length > 0) {
    await sb
      .from("availability_slots")
      .update({ status: "open" })
      .in("id", occ)
      .eq("status", "booked");
  }
  const { data, error } = await sb
    .from("bookings")
    .update({
      status: "declined",
      admin_message: input.message ?? "",
      occupied_slot_ids: [],
      confirmed_slot_id: null,
      request_kind: "",
      change_request: "",
      change_requested_at: null,
      requested_slot_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.bookingId)
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: "DB" };
  await emailResult(data as Booking, false, null);
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * 예약 취소 대신 "가능시간 안내": 여러 시간을 제안하면 손님이 조회 화면에서
 * 그중 하나를 골라 확정됩니다. (status 는 pending 유지)
 */
export async function proposeTimes(input: {
  bookingId: string;
  slotIds: string[];
  message?: string;
}): Promise<ActionResult> {
  await assertAdmin();
  if (!input.slotIds || input.slotIds.length === 0)
    return { ok: false, error: "NO_SLOTS" };
  const sb = createSupabaseAdminClient();
  // 열려 있는 미래 슬롯만 제안
  const nowIso = new Date().toISOString();
  const { data: slotRows } = await sb
    .from("availability_slots")
    .select("id, status, starts_at")
    .in("id", input.slotIds);
  const valid = ((slotRows as { id: string; status: string; starts_at: string }[]) ?? [])
    .filter((s) => s.status === "open" && s.starts_at >= nowIso)
    .map((s) => s.id);
  if (valid.length === 0) return { ok: false, error: "NO_SLOTS" };

  const { data, error } = await sb
    .from("bookings")
    .update({
      proposed_slot_ids: valid,
      admin_message: input.message ?? "",
      request_kind: "",
      change_request: "",
      change_requested_at: null,
      requested_slot_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.bookingId)
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: "DB" };

  // 손님에게 "가능시간 안내" 이메일 (이메일 입력 시)
  const b = data as Booking;
  if (b.customer_email) {
    try {
      const siteUrl = await getSiteUrl();
      await notifyCustomerResult({
        to: b.customer_email,
        confirmed: false,
        code: b.code,
        timeText: "",
        message:
          (input.message ? input.message + "\n\n" : "") +
          "가능한 시간을 안내드려요. 예약 조회 화면에서 원하는 시간을 선택해주세요.",
        siteUrl,
      });
    } catch (err) {
      console.error("[proposeTimes] 이메일 무시:", err);
    }
  }
  revalidatePath("/admin");
  return { ok: true };
}

/** 시술 완료 후 결제 안내(금액+e-transfer)를 다시 발송 */
export async function resendPayment(input: {
  bookingId: string;
}): Promise<ActionResult> {
  await assertAdmin();
  const sb = createSupabaseAdminClient();
  const { data } = await sb
    .from("bookings")
    .select("*")
    .eq("id", input.bookingId)
    .single();
  const b = data as Booking | null;
  if (!b) return { ok: false, error: "DB" };
  if (b.status !== "completed") return { ok: false, error: "NOT_COMPLETED" };
  if (!b.customer_email) return { ok: false, error: "NO_EMAIL" };

  try {
    const [siteUrl, settingsRes] = await Promise.all([
      getSiteUrl(),
      sb.from("settings").select("*").eq("id", 1).single(),
    ]);
    const s = (settingsRes.data ?? {}) as Record<string, string>;
    const cur = s.currency || "CAD";
    const isEn = (await getLocale()) === "en";
    const finalPrice = Number(b.final_price ?? b.estimated_total) || 0;
    await notifyCustomerCompleted({
      to: b.customer_email,
      code: b.code,
      serviceText: formatMoney(finalPrice, cur),
      tipText: formatMoney(b.tip ?? 0, cur),
      totalText: formatMoney(finalPrice + (b.tip ?? 0), cur),
      paymentText: (isEn ? s.payment_en : s.payment_ko) || "",
      etransferEmail: s.etransfer_email || "",
      etransferNote: (isEn ? s.etransfer_note_en : s.etransfer_note_ko) || "",
      siteUrl,
    });
  } catch (err) {
    console.error("[resendPayment] 실패:", err);
    return { ok: false, error: "EMAIL" };
  }
  return { ok: true };
}

/** 손님의 요청을 반려(변경 없이 요청만 해제). 원하면 안내 메시지를 손님에게 발송. */
export async function dismissRequest(input: {
  bookingId: string;
  message?: string;
}): Promise<ActionResult> {
  await assertAdmin();
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("bookings")
    .update({
      request_kind: "",
      change_request: "",
      change_requested_at: null,
      requested_slot_id: null,
      admin_message: input.message ?? "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.bookingId)
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: "DB" };
  const b = data as Booking;
  if (input.message) {
    await emailResult(b, b.status === "confirmed", null);
  }
  revalidatePath("/admin");
  return { ok: true };
}

export async function cancelBooking(input: {
  bookingId: string;
  message?: string;
}): Promise<ActionResult> {
  await assertAdmin();
  const sb = createSupabaseAdminClient();
  // 점유했던 슬롯들 반납
  const { data: b } = await sb
    .from("bookings")
    .select("occupied_slot_ids")
    .eq("id", input.bookingId)
    .single();
  const occ = (b as { occupied_slot_ids: string[] } | null)?.occupied_slot_ids;
  if (occ && occ.length > 0) {
    await sb
      .from("availability_slots")
      .update({ status: "open" })
      .in("id", occ)
      .eq("status", "booked");
  }
  const { data: updated, error } = await sb
    .from("bookings")
    .update({
      status: "cancelled",
      confirmed_slot_id: null,
      occupied_slot_ids: [],
      request_kind: "",
      change_request: "",
      change_requested_at: null,
      requested_slot_id: null,
      admin_message: input.message ?? "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.bookingId)
    .select("*")
    .single();
  if (error || !updated) return { ok: false, error: "DB" };
  // 취소 결과를 손님에게 안내 (이메일 입력 시)
  await emailResult(updated as Booking, false, null);
  revalidatePath("/admin");
  revalidatePath("/admin/availability");
  revalidatePath("/admin/calendar");
  return { ok: true };
}

export async function completeBooking(input: {
  bookingId: string;
  finalPrice: number;
  tip: number;
}): Promise<ActionResult> {
  await assertAdmin();
  const sb = createSupabaseAdminClient();
  const finalPrice = Math.max(0, Number(input.finalPrice) || 0);
  const tip = Math.max(0, Number(input.tip) || 0);

  // 아직 시작하지 않은(미래) 예약은 완료 처리 불가 — 시술 시작 시각 이후만 허용
  const { data: bRow } = await sb
    .from("bookings")
    .select("confirmed_slot_id")
    .eq("id", input.bookingId)
    .single();
  const confirmedSlotId = (bRow as { confirmed_slot_id?: string | null } | null)
    ?.confirmed_slot_id;
  if (confirmedSlotId) {
    const { data: slotRow } = await sb
      .from("availability_slots")
      .select("starts_at")
      .eq("id", confirmedSlotId)
      .single();
    const startsAt = (slotRow as { starts_at?: string } | null)?.starts_at;
    if (startsAt && startsAt > new Date().toISOString()) {
      return { ok: false, error: "NOT_STARTED" };
    }
  }

  const { data, error } = await sb
    .from("bookings")
    .update({
      status: "completed",
      final_price: finalPrice,
      tip,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.bookingId)
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: "DB" };

  // 고객에게 금액 + e-transfer 안내 이메일 (이메일 입력 시)
  const b = data as Booking;
  if (b.customer_email) {
    try {
      const [siteUrl, settingsRes] = await Promise.all([
        getSiteUrl(),
        sb.from("settings").select("*").eq("id", 1).single(),
      ]);
      const s = (settingsRes.data ?? {}) as Record<string, string>;
      const cur = s.currency || "CAD";
      const locale = await getLocale();
      const isEn = locale === "en";
      await notifyCustomerCompleted({
        to: b.customer_email,
        code: b.code,
        serviceText: formatMoney(finalPrice, cur),
        tipText: formatMoney(tip, cur),
        totalText: formatMoney(finalPrice + tip, cur),
        paymentText: (isEn ? s.payment_en : s.payment_ko) || "",
        etransferEmail: s.etransfer_email || "",
        etransferNote: (isEn ? s.etransfer_note_en : s.etransfer_note_ko) || "",
        siteUrl,
      });
    } catch (err) {
      console.error("[completeBooking] 이메일 무시:", err);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/customers");
  return { ok: true };
}

// ── 가능 시간 관리 ───────────────────────────────────────────

export async function addSlot(input: {
  startsAtISO: string;
}): Promise<ActionResult> {
  await assertAdmin();
  if (!input.startsAtISO) return { ok: false, error: "INVALID" };
  const sb = createSupabaseAdminClient();
  const { error } = await sb
    .from("availability_slots")
    .insert({ starts_at: input.startsAtISO, status: "open" });
  if (error) return { ok: false, error: "DB" };
  revalidatePath("/admin/availability");
  return { ok: true };
}

/** 여러 슬롯 한번에 추가 (30분 범위 생성 등). 같은 시각은 무시. */
export async function addSlots(input: {
  startsAtISOs: string[];
}): Promise<ActionResult> {
  await assertAdmin();
  const uniq = [...new Set((input.startsAtISOs ?? []).filter(Boolean))];
  if (uniq.length === 0) return { ok: false, error: "INVALID" };
  const sb = createSupabaseAdminClient();
  const { error } = await sb
    .from("availability_slots")
    .upsert(
      uniq.map((iso) => ({ starts_at: iso, status: "open" })),
      { onConflict: "starts_at", ignoreDuplicates: true },
    );
  if (error) return { ok: false, error: "DB" };
  revalidatePath("/admin/availability");
  return { ok: true };
}

export async function setSlotStatus(input: {
  slotId: string;
  status: "open" | "blocked";
}): Promise<ActionResult> {
  await assertAdmin();
  const sb = createSupabaseAdminClient();
  // booked 상태는 이 액션으로 바꾸지 않음 (booked ↔ open/blocked 금지)
  const { error } = await sb
    .from("availability_slots")
    .update({ status: input.status })
    .eq("id", input.slotId)
    .in("status", ["open", "blocked"]);
  if (error) return { ok: false, error: "DB" };
  revalidatePath("/admin/availability");
  return { ok: true };
}

export async function deleteSlot(input: {
  slotId: string;
}): Promise<ActionResult> {
  await assertAdmin();
  const sb = createSupabaseAdminClient();
  // 예약된 슬롯은 삭제 금지
  const { error } = await sb
    .from("availability_slots")
    .delete()
    .eq("id", input.slotId)
    .neq("status", "booked");
  if (error) return { ok: false, error: "DB" };
  revalidatePath("/admin/availability");
  return { ok: true };
}

export async function blockRange(input: {
  startsAtISOs: string[];
  reasonKo?: string;
  reasonEn?: string;
}): Promise<ActionResult> {
  await assertAdmin();
  const isos = [...new Set((input.startsAtISOs ?? []).filter(Boolean))];
  if (isos.length === 0) return { ok: false, error: "INVALID" };
  const sb = createSupabaseAdminClient();

  // 1) 사전 조회: 대상 시간대에 이미 booked 슬롯이 있으면 전체 거부.
  //    조회 자체가 실패하면(네트워크 등) booked 여부를 알 수 없으므로 안전하게 중단한다
  //    (fail closed) — 이 결과만으로 최종 판단하지 않고, 아래 쓰기 단계에서 다시 한번
  //    booked 를 배제해 조회~쓰기 사이의 경쟁 상태(동시 예약 확정)로부터도 보호한다.
  const { data: existing, error: selErr } = await sb
    .from("availability_slots")
    .select("starts_at, status")
    .in("starts_at", isos);
  if (selErr) return { ok: false, error: "DB" };
  const existingRows =
    (existing as { starts_at: string; status: string }[] | null) ?? [];
  const booked = existingRows.filter((s) => s.status === "booked");
  if (booked.length > 0) {
    return { ok: false, error: "SLOT_TAKEN" };
  }
  // 롤백 시 원상복구하려면, 우리가 새로 만든 행과 원래 있던 행을 구분해야 한다.
  const priorStatusByIso = new Map(
    existingRows.map((r) => [r.starts_at, r.status]),
  );

  const group = crypto.randomUUID();
  const note_ko = (input.reasonKo ?? "").trim();
  const note_en = (input.reasonEn ?? "").trim();

  // 이후 어느 단계에서 실패하더라도 이 그룹이 만든 변경만 되돌린다.
  // 새로 만든 행은 삭제하고, 원래 있던 행은 이전 상태(대개 open)로 되돌린다.
  // 통째로 삭제하면 관리자가 열어둔 예약 가능 시간이 사라져 버린다.
  // (booked 로 확정된 행은 이 그룹에 속하지 않으므로 어느 쪽에도 걸리지 않는다.)
  async function rollback() {
    const preexisting = isos.filter((iso) => priorStatusByIso.has(iso));
    const created = isos.filter((iso) => !priorStatusByIso.has(iso));
    if (created.length > 0) {
      await sb
        .from("availability_slots")
        .delete()
        .eq("block_group", group)
        .eq("status", "blocked")
        .in("starts_at", created);
    }
    for (const iso of preexisting) {
      await sb
        .from("availability_slots")
        .update({
          status: priorStatusByIso.get(iso),
          block_group: null,
          note_ko: "",
          note_en: "",
        })
        .eq("starts_at", iso)
        .eq("block_group", group);
    }
  }

  // 2) 아직 없는 시각만 새로 생성한다. ignoreDuplicates 이므로 기존 행(특히 방금
  //    booked 로 바뀐 행)은 이 문장으로는 절대 건드리지 않는다.
  const { error: insErr } = await sb.from("availability_slots").upsert(
    isos.map((iso) => ({
      starts_at: iso,
      status: "blocked",
      block_group: group,
      note_ko,
      note_en,
    })),
    { onConflict: "starts_at", ignoreDuplicates: true },
  );
  if (insErr) return { ok: false, error: "DB" };

  // 3) 기존 행만 blocked 로 갱신하되, 같은 문장에서 booked 를 제외한다(neq).
  //    사전 조회 이후 다른 요청이 이 슬롯을 예약 확정(open→booked)했더라도
  //    이 UPDATE 는 그 행을 대상에서 빼므로 확정된 예약을 절대 덮어쓰지 않는다.
  const { error: updErr } = await sb
    .from("availability_slots")
    .update({ status: "blocked", block_group: group, note_ko, note_en })
    .in("starts_at", isos)
    .neq("status", "booked")
    .select("id");
  if (updErr) {
    await rollback();
    return { ok: false, error: "DB" };
  }

  // 4) 결과 검증: 이 block_group 으로 실제 blocked 된 행 수가 요청 범위 전체와
  //    같아야 한다. 부족하면 2)~3) 사이 경쟁으로 일부 슬롯이 booked 로 바뀌어
  //    누락된 것 — 방금 이 그룹으로 만든 blocked 행만 되돌리고 실패를 반환한다.
  const { data: finalRows, error: cntErr } = await sb
    .from("availability_slots")
    .select("id")
    .eq("block_group", group)
    .eq("status", "blocked");
  if (cntErr) {
    await rollback();
    return { ok: false, error: "DB" };
  }
  if ((finalRows?.length ?? 0) !== isos.length) {
    await rollback();
    return { ok: false, error: "SLOT_TAKEN" };
  }

  revalidatePath("/admin/calendar");
  revalidatePath("/admin/availability");
  return { ok: true };
}

export async function removeBlock(input: {
  blockGroup: string;
}): Promise<ActionResult> {
  await assertAdmin();
  if (!input.blockGroup) return { ok: false, error: "INVALID" };
  const sb = createSupabaseAdminClient();
  // 그룹의 blocked 슬롯만 삭제 (블록은 관리자가 만든 것). booked 는 애초에 이 그룹에 없음.
  const { error } = await sb
    .from("availability_slots")
    .delete()
    .eq("block_group", input.blockGroup)
    .eq("status", "blocked");
  if (error) return { ok: false, error: "DB" };
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/availability");
  return { ok: true };
}

// ── 가격/시술 관리 ───────────────────────────────────────────

export async function saveService(input: {
  id: string;
  name_ko: string;
  name_en: string;
  price: number;
  price_from: boolean;
  unit: "flat" | "per_finger";
  duration_min: number;
  active: boolean;
}): Promise<ActionResult> {
  await assertAdmin();
  const sb = createSupabaseAdminClient();
  const { error } = await sb
    .from("services")
    .update({
      name_ko: input.name_ko.trim(),
      name_en: input.name_en.trim(),
      price: Number(input.price) || 0,
      price_from: Boolean(input.price_from),
      unit: input.unit,
      duration_min: Math.max(0, Math.round(Number(input.duration_min) || 0)),
      active: input.active,
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: "DB" };
  revalidatePath("/admin/services");
  revalidatePath("/");
  return { ok: true };
}

export async function addService(): Promise<ActionResult> {
  await assertAdmin();
  const sb = createSupabaseAdminClient();
  const { error } = await sb.from("services").insert({
    name_ko: "새 시술",
    name_en: "New service",
    price: 0,
    unit: "flat",
    sort_order: 100,
    active: false,
  });
  if (error) return { ok: false, error: "DB" };
  revalidatePath("/admin/services");
  return { ok: true };
}

export async function deleteService(input: {
  id: string;
}): Promise<ActionResult> {
  await assertAdmin();
  const sb = createSupabaseAdminClient();
  const { error } = await sb.from("services").delete().eq("id", input.id);
  if (error) return { ok: false, error: "DB" };
  revalidatePath("/admin/services");
  revalidatePath("/");
  return { ok: true };
}

// ── 설정 ─────────────────────────────────────────────────────

// ── 고객 메모 ────────────────────────────────────────────────
/**
 * 고객 등록. `contact`(연락처)가 중복이면 기존 고객을 `existed: true` 로 반환한다.
 * 조회-후-삽입 사이의 경쟁은 UNIQUE 위반(23505)을 잡아 재조회로 흡수한다.
 */
export async function createCustomer(input: {
  name: string;
  contact: string;
  email?: string;
  referral?: string;
  memo?: string;
}): Promise<{ ok: true; id: string; existed: boolean } | { ok: false; error: string }> {
  await assertAdmin();
  const name = (input.name ?? "").trim();
  const contact = (input.contact ?? "").trim();
  if (!name || !contact) return { ok: false, error: "INVALID" };

  const sb = createSupabaseAdminClient();
  const { data: existing } = await sb
    .from("customers")
    .select("id")
    .eq("contact", contact)
    .maybeSingle();
  if (existing) {
    return { ok: true, id: (existing as { id: string }).id, existed: true };
  }

  const { data: created, error } = await sb
    .from("customers")
    .insert({
      name,
      contact,
      email: (input.email ?? "").trim(),
      referral_source: (input.referral ?? "").trim(),
      memo: (input.memo ?? "").trim(),
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    // 동시에 같은 연락처가 등록됨 → 그 행을 기존 고객으로 취급한다.
    const { data: raced } = await sb
      .from("customers")
      .select("id")
      .eq("contact", contact)
      .maybeSingle();
    const racedId = (raced as { id: string } | null)?.id;
    if (racedId) return { ok: true, id: racedId, existed: true };
  }
  if (error || !created) return { ok: false, error: "DB" };

  revalidatePath("/admin/customers");
  return { ok: true, id: (created as { id: string }).id, existed: false };
}

/** 고객 부분 갱신. 전달된 필드만 바꾼다(연락처는 식별 키라 여기서 바꾸지 않음). */
export async function updateCustomer(input: {
  customerId: string;
  name?: string;
  email?: string;
  referral?: string;
  memo?: string;
}): Promise<ActionResult> {
  await assertAdmin();
  if (!input.customerId) return { ok: false, error: "INVALID" };

  const patch: Record<string, string> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.email !== undefined) patch.email = input.email.trim();
  if (input.referral !== undefined) patch.referral_source = input.referral.trim();
  if (input.memo !== undefined) patch.memo = input.memo.trim();
  if (Object.keys(patch).length === 0) return { ok: true };

  const sb = createSupabaseAdminClient();
  const { error } = await sb
    .from("customers")
    .update(patch)
    .eq("id", input.customerId);
  if (error) return { ok: false, error: "DB" };

  revalidatePath("/admin/customers");
  return { ok: true };
}

/** 연락처로 고객 1명 찾기 (예약 폼의 전화번호 매칭용). 없으면 null. */
export async function findCustomerByContact(contact: string): Promise<{
  id: string;
  name: string;
  contact: string;
  email: string;
  referral_source: string;
} | null> {
  await assertAdmin();
  const c = (contact ?? "").trim();
  if (!c) return null;

  const sb = createSupabaseAdminClient();
  const { data } = await sb
    .from("customers")
    .select("id, name, contact, email, referral_source")
    .eq("contact", c)
    .maybeSingle();
  return (
    (data as {
      id: string;
      name: string;
      contact: string;
      email: string;
      referral_source: string;
    } | null) ?? null
  );
}

export async function saveCustomerMemo(input: {
  customerId: string;
  memo: string;
}): Promise<ActionResult> {
  return updateCustomer({ customerId: input.customerId, memo: input.memo });
}

// ── 갤러리 ───────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

export async function uploadGalleryPhoto(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertAdmin();
  const file = formData.get("file");
  const category =
    String(formData.get("category") ?? "").trim() || "기타";
  const caption_ko = String(formData.get("caption_ko") ?? "").trim();
  const caption_en = String(formData.get("caption_en") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const price = priceRaw ? Number(priceRaw) || null : null;

  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "NO_FILE" };
  if (!file.type.startsWith("image/"))
    return { ok: false, error: "NOT_IMAGE" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "TOO_BIG" };

  const sb = createSupabaseAdminClient();
  const ext = (file.name.split(".").pop() ?? "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5);
  const path = `${crypto.randomUUID()}.${ext || "jpg"}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await sb.storage
    .from("gallery")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: "STORAGE" };

  const { data: pub } = sb.storage.from("gallery").getPublicUrl(path);
  const { error } = await sb.from("gallery_photos").insert({
    image_url: pub.publicUrl,
    storage_path: path,
    category,
    caption_ko,
    caption_en,
    price,
  });
  if (error) {
    await sb.storage.from("gallery").remove([path]); // 롤백
    return { ok: false, error: "DB" };
  }
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  return { ok: true };
}

export async function uploadLogo(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "NO_FILE" };
  if (!file.type.startsWith("image/")) return { ok: false, error: "NOT_IMAGE" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "TOO_BIG" };

  const sb = createSupabaseAdminClient();
  const ext = (file.name.split(".").pop() ?? "png")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5);
  const path = `logo/${crypto.randomUUID()}.${ext || "png"}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  // 이전 로고 삭제
  const { data: prev } = await sb
    .from("settings")
    .select("logo_storage_path")
    .eq("id", 1)
    .single();
  const prevPath = (prev as { logo_storage_path: string } | null)
    ?.logo_storage_path;

  const { error: upErr } = await sb.storage
    .from("gallery")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: "STORAGE" };
  const { data: pub } = sb.storage.from("gallery").getPublicUrl(path);

  const { error } = await sb
    .from("settings")
    .update({ logo_url: pub.publicUrl, logo_storage_path: path })
    .eq("id", 1);
  if (error) {
    await sb.storage.from("gallery").remove([path]);
    return { ok: false, error: "DB" };
  }
  if (prevPath) await sb.storage.from("gallery").remove([prevPath]);
  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { ok: true };
}

export async function removeLogo(): Promise<ActionResult> {
  await assertAdmin();
  const sb = createSupabaseAdminClient();
  const { data: prev } = await sb
    .from("settings")
    .select("logo_storage_path")
    .eq("id", 1)
    .single();
  const prevPath = (prev as { logo_storage_path: string } | null)
    ?.logo_storage_path;
  if (prevPath) await sb.storage.from("gallery").remove([prevPath]);
  await sb
    .from("settings")
    .update({ logo_url: "", logo_storage_path: "" })
    .eq("id", 1);
  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteGalleryPhoto(input: {
  id: string;
  storagePath: string;
}): Promise<ActionResult> {
  await assertAdmin();
  const sb = createSupabaseAdminClient();
  if (input.storagePath) {
    await sb.storage.from("gallery").remove([input.storagePath]);
  }
  const { error } = await sb
    .from("gallery_photos")
    .delete()
    .eq("id", input.id);
  if (error) return { ok: false, error: "DB" };
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  return { ok: true };
}

export async function saveSettings(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertAdmin();
  const sb = createSupabaseAdminClient();
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const { error } = await sb
    .from("settings")
    .update({
      shop_name_ko: get("shop_name_ko"),
      shop_name_en: get("shop_name_en"),
      hero_tagline_ko: get("hero_tagline_ko"),
      hero_tagline_en: get("hero_tagline_en"),
      hero_sub_ko: get("hero_sub_ko"),
      hero_sub_en: get("hero_sub_en"),
      schedule_note_ko: get("schedule_note_ko"),
      schedule_note_en: get("schedule_note_en"),
      location_ko: get("location_ko"),
      location_en: get("location_en"),
      notice_ko: get("notice_ko"),
      notice_en: get("notice_en"),
      payment_ko: get("payment_ko"),
      payment_en: get("payment_en"),
      etransfer_email: get("etransfer_email"),
      etransfer_note_ko: get("etransfer_note_ko"),
      etransfer_note_en: get("etransfer_note_en"),
      currency: get("currency") || "CAD",
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { ok: false, error: "DB" };
  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { ok: true };
}
