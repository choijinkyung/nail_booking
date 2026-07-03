"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";
import { notifyAdminBookingUpdate, notifyAdminNewBooking } from "@/lib/email";
import { getSiteUrl } from "@/lib/url";
import { formatSlot } from "@/lib/format";
import { hashPassword, makeSalt } from "@/lib/hash";
import { findBookingCodeByNamePassword } from "@/lib/data";
import { bookingDurationMin, fitFrom, sortSlots } from "@/lib/scheduling";
import type { Booking, BookingServiceLine, Service } from "@/lib/types";

/** 언어 전환 — 쿠키 설정 후 페이지 새로고침용 */
export async function setLocale(locale: string) {
  const store = await cookies();
  store.set(LOCALE_COOKIE, normalizeLocale(locale), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

/** 예약 시 레퍼런스 사진 업로드 (공개 — 이미지/10MB 제한) */
export async function uploadReferenceImage(
  formData: FormData,
): Promise<{ ok: true; url: string; path: string } | { ok: false }> {
  if (!isSupabaseAdminConfigured()) return { ok: false };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false };
  if (!file.type.startsWith("image/")) return { ok: false };
  if (file.size > 10 * 1024 * 1024) return { ok: false };
  const sb = createSupabaseAdminClient();
  const ext = (file.name.split(".").pop() ?? "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5);
  const path = `refs/${crypto.randomUUID()}.${ext || "jpg"}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await sb.storage
    .from("gallery")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) return { ok: false };
  const { data: pub } = sb.storage.from("gallery").getPublicUrl(path);
  return { ok: true, url: pub.publicUrl, path };
}

export interface CreateBookingInput {
  services: { service_id: string; quantity: number }[];
  preferred_slot_id: string;
  alternative_slot_ids: string[];
  customer_name: string;
  customer_contact: string;
  customer_email?: string;
  customer_password: string; // 예약 확인용 (이름+비밀번호 조회)
  referral_source?: string;
  reference_url?: string;
  reference_path?: string;
  note?: string;
}

export type CreateBookingResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

// 사람이 헷갈리지 않는 문자만 사용 (0/O, 1/I 제외)
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function generateCode(len = 6): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, error: "SETUP" };
  }

  // 서버 검증
  const name = (input.customer_name ?? "").trim();
  const contact = (input.customer_contact ?? "").trim();
  const email = (input.customer_email ?? "").trim();
  const password = (input.customer_password ?? "").trim();
  if (!name || !contact) return { ok: false, error: "INVALID" };
  if (password.length < 4) return { ok: false, error: "PASSWORD" };
  if (!input.preferred_slot_id) return { ok: false, error: "NO_PREFERRED" };
  if (!input.services || input.services.length === 0)
    return { ok: false, error: "NO_SERVICE" };

  const sb = createSupabaseAdminClient();

  // 1) 시술 스냅샷 & 합계는 DB 가격으로 재계산 (클라이언트 값 신뢰 금지)
  const serviceIds = [...new Set(input.services.map((s) => s.service_id))];
  const { data: svcRows } = await sb
    .from("services")
    .select("*")
    .in("id", serviceIds)
    .eq("active", true);
  const svcMap = new Map<string, Service>(
    ((svcRows as Service[]) ?? []).map((s) => [s.id, s]),
  );

  const lines: BookingServiceLine[] = [];
  for (const sel of input.services) {
    const svc = svcMap.get(sel.service_id);
    if (!svc) continue;
    const qty = Math.max(1, Math.min(20, Math.floor(sel.quantity || 1)));
    const subtotal = Number(svc.price) * qty;
    lines.push({
      service_id: svc.id,
      name_ko: svc.name_ko,
      name_en: svc.name_en,
      unit: svc.unit,
      unit_price: Number(svc.price),
      duration_min: Number(svc.duration_min) || 0,
      quantity: qty,
      subtotal,
    });
  }
  if (lines.length === 0) return { ok: false, error: "NO_SERVICE" };
  const estimatedTotal = lines.reduce((sum, l) => sum + l.subtotal, 0);

  // 2) 슬롯 유효성 확인 (열려 있는 미래 슬롯인지)
  const nowIso = new Date().toISOString();
  const wantedSlotIds = [
    input.preferred_slot_id,
    ...(input.alternative_slot_ids ?? []),
  ];
  const { data: slotRows } = await sb
    .from("availability_slots")
    .select("id, starts_at, ends_at, status, note_ko, note_en, created_at")
    .in("id", wantedSlotIds);
  const validSlotIds = new Set(
    ((slotRows as { id: string; status: string; starts_at: string }[]) ?? [])
      .filter((s) => s.status === "open" && s.starts_at >= nowIso)
      .map((s) => s.id),
  );
  if (!validSlotIds.has(input.preferred_slot_id)) {
    return { ok: false, error: "SLOT_TAKEN" };
  }
  const altIds = [...new Set(input.alternative_slot_ids ?? [])].filter(
    (id) => id !== input.preferred_slot_id && validSlotIds.has(id),
  );

  // 3) 고객(단골) upsert — 연락처를 키로 매칭
  const referral = (input.referral_source ?? "").trim();
  let customerId: string | null = null;
  try {
    const { data: existing } = await sb
      .from("customers")
      .select("id, referral_source")
      .eq("contact", contact)
      .maybeSingle();
    if (existing) {
      customerId = (existing as { id: string }).id;
      await sb
        .from("customers")
        .update({
          name,
          email,
          // 유입경로는 기존 값 우선(첫 유입 유지), 없으면 새 값
          referral_source:
            (existing as { referral_source: string }).referral_source ||
            referral,
        })
        .eq("id", customerId);
    } else {
      const { data: created } = await sb
        .from("customers")
        .insert({ contact, name, email, referral_source: referral })
        .select("id")
        .single();
      customerId = (created as { id: string } | null)?.id ?? null;
    }
  } catch (err) {
    console.error("[createBooking] customer upsert 실패(무시):", err);
  }

  // 4) 유니크 코드로 insert (충돌 시 재시도)
  const salt = makeSalt();
  const passwordHash = hashPassword(password, salt);
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
      reference_url: (input.reference_url ?? "").trim(),
      reference_path: (input.reference_path ?? "").trim(),
      lookup_password_hash: passwordHash,
      lookup_password_salt: salt,
      services: lines,
      estimated_total: estimatedTotal,
      note: (input.note ?? "").trim(),
      preferred_slot_id: input.preferred_slot_id,
      alternative_slot_ids: altIds,
      status: "pending",
    });
    if (!error) {
      inserted = true;
    } else if (error.code !== "23505") {
      // 코드 중복(23505)이 아니면 진짜 실패
      console.error("[createBooking] insert 실패:", error);
      return { ok: false, error: "DB" };
    }
  }
  if (!inserted) return { ok: false, error: "DB" };

  // 4) 관리자 이메일 알림 (베스트 에포트)
  try {
    const siteUrl = await getSiteUrl();
    const locale = normalizeLocale(
      (await cookies()).get(LOCALE_COOKIE)?.value,
    );
    const preferredSlot = ((slotRows as { id: string; starts_at: string }[]) ?? []).find(
      (s) => s.id === input.preferred_slot_id,
    );
    await notifyAdminNewBooking({
      code,
      customerName: name,
      contact,
      preferredText: preferredSlot
        ? formatSlot({ starts_at: preferredSlot.starts_at, ends_at: null }, locale)
        : "-",
      servicesText: lines
        .map((l) => `${locale === "en" ? l.name_en : l.name_ko} ×${l.quantity}`)
        .join(", "),
      siteUrl,
    });
  } catch (err) {
    console.error("[createBooking] 알림 실패(무시):", err);
  }

  return { ok: true, code };
}

// ── 이름 + 비밀번호로 예약 조회 (예약 코드 반환) ──
export async function lookupByNamePassword(input: {
  name: string;
  password: string;
}): Promise<{ ok: true; code: string } | { ok: false }> {
  const code = await findBookingCodeByNamePassword(
    input.name ?? "",
    input.password ?? "",
  );
  return code ? { ok: true, code } : { ok: false };
}

// ── 관리자가 제안한 가능시간 중 하나를 손님이 선택 → 확정 ──
export async function acceptProposedTime(input: {
  code: string;
  slotId: string;
}): Promise<CustomerRequestResult> {
  if (!isSupabaseAdminConfigured()) return { ok: false, error: "SETUP" };
  const code = (input.code ?? "").trim().toUpperCase();
  if (!code || !input.slotId) return { ok: false, error: "NOT_FOUND" };
  const sb = createSupabaseAdminClient();
  const { data } = await sb
    .from("bookings")
    .select("*")
    .eq("code", code)
    .single();
  const b = data as Booking | null;
  if (!b) return { ok: false, error: "NOT_FOUND" };
  if (b.status !== "pending" || !(b.proposed_slot_ids ?? []).includes(input.slotId))
    return { ok: false, error: "CLOSED" };

  const duration = bookingDurationMin(b.services ?? []);
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
  if (!occ) return { ok: false, error: "SLOT_TAKEN" };

  const { data: locked } = await sb
    .from("availability_slots")
    .update({ status: "booked" })
    .in("id", occ)
    .eq("status", "open")
    .select("id");
  if (!locked || locked.length !== occ.length) {
    await sb.from("availability_slots").update({ status: "open" }).in("id", occ);
    return { ok: false, error: "SLOT_TAKEN" };
  }

  const { error } = await sb
    .from("bookings")
    .update({
      status: "confirmed",
      confirmed_slot_id: input.slotId,
      occupied_slot_ids: occ,
      proposed_slot_ids: [],
      admin_message: "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", b.id);
  if (error) {
    await sb.from("availability_slots").update({ status: "open" }).in("id", occ);
    return { ok: false, error: "DB" };
  }

  try {
    const siteUrl = await getSiteUrl();
    await notifyAdminBookingUpdate({
      code: b.code,
      customerName: b.customer_name,
      contact: b.customer_contact,
      kind: "change",
      message: "손님이 안내된 시간 중 하나를 선택해 예약이 확정됐어요.",
      siteUrl,
    });
  } catch (err) {
    console.error("[acceptProposedTime] 알림 무시:", err);
  }
  revalidatePath("/admin");
  return { ok: true };
}

// ── 예약 불가(declined) 후 다른 시간으로 다시 요청 ──
export async function reRequestBooking(input: {
  code: string;
  preferredSlotId: string;
  alternativeSlotIds: string[];
}): Promise<CustomerRequestResult> {
  if (!isSupabaseAdminConfigured()) return { ok: false, error: "SETUP" };
  const code = (input.code ?? "").trim().toUpperCase();
  if (!code) return { ok: false, error: "NOT_FOUND" };
  if (!input.preferredSlotId) return { ok: false, error: "NO_PREFERRED" };

  const sb = createSupabaseAdminClient();
  const { data } = await sb
    .from("bookings")
    .select("*")
    .eq("code", code)
    .single();
  const b = data as Booking | null;
  if (!b) return { ok: false, error: "NOT_FOUND" };
  if (b.status !== "declined") return { ok: false, error: "CLOSED" };

  // 희망 시간은 관리자가 연(open) 미래 슬롯만 허용
  const nowIso = new Date().toISOString();
  const wanted = [input.preferredSlotId, ...(input.alternativeSlotIds ?? [])];
  const { data: slotRows } = await sb
    .from("availability_slots")
    .select("id, status, starts_at")
    .in("id", wanted);
  const valid = new Set(
    ((slotRows as { id: string; status: string; starts_at: string }[]) ?? [])
      .filter((s) => s.status === "open" && s.starts_at >= nowIso)
      .map((s) => s.id),
  );
  if (!valid.has(input.preferredSlotId)) return { ok: false, error: "SLOT_TAKEN" };
  const alts = [...new Set(input.alternativeSlotIds ?? [])].filter(
    (id) => id !== input.preferredSlotId && valid.has(id),
  );

  const { error } = await sb
    .from("bookings")
    .update({
      status: "pending",
      preferred_slot_id: input.preferredSlotId,
      alternative_slot_ids: alts,
      admin_message: "",
      request_kind: "",
      change_request: "",
      change_requested_at: null,
      requested_slot_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", b.id);
  if (error) return { ok: false, error: "DB" };

  try {
    const siteUrl = await getSiteUrl();
    await notifyAdminBookingUpdate({
      code: b.code,
      customerName: b.customer_name,
      contact: b.customer_contact,
      kind: "change",
      message: "예약 불가 안내 후 다른 시간으로 다시 요청했어요.",
      siteUrl,
    });
  } catch (err) {
    console.error("[reRequestBooking] 알림 무시:", err);
  }

  revalidatePath("/admin");
  return { ok: true };
}

// ── 손님의 변경/취소 "요청" (실제 변경은 관리자 승인 시에만) ──
export type CustomerRequestResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitCustomerRequest(input: {
  code: string;
  kind: "change" | "cancel";
  message: string;
  requestedSlotId?: string;
}): Promise<CustomerRequestResult> {
  if (!isSupabaseAdminConfigured()) return { ok: false, error: "SETUP" };
  const code = (input.code ?? "").trim().toUpperCase();
  if (!code) return { ok: false, error: "NOT_FOUND" };

  const sb = createSupabaseAdminClient();
  const { data } = await sb
    .from("bookings")
    .select("*")
    .eq("code", code)
    .single();
  const b = data as Booking | null;
  if (!b) return { ok: false, error: "NOT_FOUND" };
  if (["cancelled", "declined", "completed"].includes(b.status)) {
    return { ok: false, error: "CLOSED" };
  }

  // 변경요청의 희망 시간은 '관리자가 연(open) 미래 슬롯'만 허용
  let requestedSlotId: string | null = null;
  if (input.kind === "change" && input.requestedSlotId) {
    const nowIso = new Date().toISOString();
    const { data: slot } = await sb
      .from("availability_slots")
      .select("id, status, starts_at")
      .eq("id", input.requestedSlotId)
      .single();
    const s = slot as { id: string; status: string; starts_at: string } | null;
    if (s && s.status === "open" && s.starts_at >= nowIso) requestedSlotId = s.id;
  }

  const { error } = await sb
    .from("bookings")
    .update({
      request_kind: input.kind,
      change_request: (input.message ?? "").trim(),
      change_requested_at: new Date().toISOString(),
      requested_slot_id: requestedSlotId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", b.id);
  if (error) return { ok: false, error: "DB" };

  try {
    const siteUrl = await getSiteUrl();
    await notifyAdminBookingUpdate({
      code: b.code,
      customerName: b.customer_name,
      contact: b.customer_contact,
      kind: input.kind,
      message: (input.message ?? "").trim(),
      siteUrl,
    });
  } catch (err) {
    console.error("[submitCustomerRequest] 알림 실패(무시):", err);
  }

  revalidatePath("/admin");
  return { ok: true };
}
