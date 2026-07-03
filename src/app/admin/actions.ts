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
import { notifyCustomerResult } from "@/lib/email";
import { getSiteUrl } from "@/lib/url";
import { formatSlot } from "@/lib/format";
import { getLocale } from "@/lib/locale";
import type { AvailabilitySlot, Booking } from "@/lib/types";

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
  slot: AvailabilitySlot | null,
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
 * 예약 확정. ★ 중복 예약 방지:
 * 슬롯을 status='open' → 'booked' 로 조건부 업데이트하여, 이미 예약된 시간이면
 * 0행이 갱신되고 확정이 거부됩니다. (DB 유니크 인덱스가 2차 방어)
 */
export async function confirmBooking(input: {
  bookingId: string;
  slotId: string;
  message?: string;
}): Promise<ActionResult> {
  await assertAdmin();
  const sb = createSupabaseAdminClient();

  // 0) 이전에 확정돼 있던 슬롯(변경 승인 시)을 나중에 다시 열기 위해 기억
  const { data: prev } = await sb
    .from("bookings")
    .select("confirmed_slot_id")
    .eq("id", input.bookingId)
    .single();
  const prevSlotId = (prev as { confirmed_slot_id: string | null } | null)
    ?.confirmed_slot_id;

  // 1) 슬롯 잠금 (원자적 조건부 업데이트)
  const { data: locked, error: lockErr } = await sb
    .from("availability_slots")
    .update({ status: "booked" })
    .eq("id", input.slotId)
    .eq("status", "open")
    .select("*");
  if (lockErr) return { ok: false, error: "DB" };
  if (!locked || locked.length === 0) {
    // 이미 예약됐거나 존재하지 않는 슬롯
    return { ok: false, error: "SLOT_TAKEN" };
  }
  const slot = locked[0] as AvailabilitySlot;

  // 2) 예약 확정
  const { data: updated, error: upErr } = await sb
    .from("bookings")
    .update({
      status: "confirmed",
      confirmed_slot_id: input.slotId,
      admin_message: input.message ?? "",
      // 손님 변경요청을 승인/처리했으므로 요청 플래그 정리
      request_kind: "",
      change_request: "",
      change_requested_at: null,
      requested_slot_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.bookingId)
    .in("status", ["pending", "confirmed"])
    .select("*")
    .single();

  if (upErr || !updated) {
    // 롤백: 방금 잠근 슬롯을 다시 연다
    await sb
      .from("availability_slots")
      .update({ status: "open" })
      .eq("id", input.slotId);
    return { ok: false, error: "DB" };
  }

  // 변경 승인으로 시간이 바뀐 경우, 이전 확정 슬롯을 다시 연다
  if (prevSlotId && prevSlotId !== input.slotId) {
    await sb
      .from("availability_slots")
      .update({ status: "open" })
      .eq("id", prevSlotId)
      .eq("status", "booked");
  }

  await emailResult(updated as Booking, true, slot);
  revalidatePath("/admin");
  revalidatePath("/admin/availability");
  revalidatePath("/admin/calendar");
  return { ok: true };
}

export async function declineBooking(input: {
  bookingId: string;
  message?: string;
}): Promise<ActionResult> {
  await assertAdmin();
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("bookings")
    .update({
      status: "declined",
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
  await emailResult(data as Booking, false, null);
  revalidatePath("/admin");
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
  // 확정 슬롯이 있으면 다시 열기
  const { data: b } = await sb
    .from("bookings")
    .select("confirmed_slot_id")
    .eq("id", input.bookingId)
    .single();
  const slotId = (b as { confirmed_slot_id: string | null } | null)
    ?.confirmed_slot_id;
  if (slotId) {
    await sb
      .from("availability_slots")
      .update({ status: "open" })
      .eq("id", slotId)
      .eq("status", "booked");
  }
  const { data: updated, error } = await sb
    .from("bookings")
    .update({
      status: "cancelled",
      confirmed_slot_id: null,
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
}): Promise<ActionResult> {
  await assertAdmin();
  const sb = createSupabaseAdminClient();
  const { error } = await sb
    .from("bookings")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", input.bookingId);
  if (error) return { ok: false, error: "DB" };
  revalidatePath("/admin");
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

// ── 가격/시술 관리 ───────────────────────────────────────────

export async function saveService(input: {
  id: string;
  name_ko: string;
  name_en: string;
  price: number;
  unit: "flat" | "per_finger";
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
      unit: input.unit,
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
  });
  if (error) {
    await sb.storage.from("gallery").remove([path]); // 롤백
    return { ok: false, error: "DB" };
  }
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
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
