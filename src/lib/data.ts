import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";
import { isSupabaseAdminConfigured } from "./supabase/config";
import type {
  AvailabilitySlot,
  Booking,
  BookingWithSlots,
  GalleryPhoto,
  Service,
  Settings,
} from "./types";

// Supabase 미설정 시 랜딩이 깨지지 않도록 하는 기본값 (schema.sql 기본값과 동일)
export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  shop_name_ko: "홈 네일",
  shop_name_en: "Home Nail",
  location_ko: "Surrey Central 인근 (정확한 주소는 예약 확정 후 안내드려요)",
  location_en: "Near Surrey Central (exact address shared after confirmation)",
  notice_ko: "반려동물(강아지·고양이)이 있어 알러지가 있으신 분은 방문이 어렵습니다.",
  notice_en:
    "We have pets (a dog and a cat). Visits are not possible for guests with allergies.",
  payment_ko: "현금(Cash) 또는 e-transfer만 가능합니다.",
  payment_en: "Cash or e-transfer only.",
  etransfer_email: "",
  etransfer_note_ko: "",
  etransfer_note_en: "",
  currency: "CAD",
  updated_at: "",
};

export async function getSettings(): Promise<Settings> {
  if (!isSupabaseAdminConfigured()) return DEFAULT_SETTINGS;
  try {
    const sb = createSupabaseAdminClient();
    const { data } = await sb.from("settings").select("*").eq("id", 1).single();
    return (data as Settings) ?? DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function getActiveServices(): Promise<Service[]> {
  if (!isSupabaseAdminConfigured()) return [];
  try {
    const sb = createSupabaseAdminClient();
    const { data } = await sb
      .from("services")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    return (data as Service[]) ?? [];
  } catch {
    return [];
  }
}

export async function getAllServices(): Promise<Service[]> {
  if (!isSupabaseAdminConfigured()) return [];
  const sb = createSupabaseAdminClient();
  const { data } = await sb
    .from("services")
    .select("*")
    .order("sort_order", { ascending: true });
  return (data as Service[]) ?? [];
}

/** 고객용: 미래의 '열린' 시간대만 */
export async function getOpenSlots(): Promise<AvailabilitySlot[]> {
  if (!isSupabaseAdminConfigured()) return [];
  try {
    const sb = createSupabaseAdminClient();
    const nowIso = new Date().toISOString();
    const { data } = await sb
      .from("availability_slots")
      .select("*")
      .eq("status", "open")
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true });
    return (data as AvailabilitySlot[]) ?? [];
  } catch {
    return [];
  }
}

/** 관리자용: 전체 시간대 (미래 우선) */
export async function getAllSlots(): Promise<AvailabilitySlot[]> {
  if (!isSupabaseAdminConfigured()) return [];
  const sb = createSupabaseAdminClient();
  const { data } = await sb
    .from("availability_slots")
    .select("*")
    .order("starts_at", { ascending: true });
  return (data as AvailabilitySlot[]) ?? [];
}

async function slotsByIds(
  sb: ReturnType<typeof createSupabaseAdminClient>,
  ids: string[],
): Promise<Map<string, AvailabilitySlot>> {
  const map = new Map<string, AvailabilitySlot>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;
  const { data } = await sb
    .from("availability_slots")
    .select("*")
    .in("id", unique);
  for (const s of (data as AvailabilitySlot[]) ?? []) map.set(s.id, s);
  return map;
}

function hydrate(
  b: Booking,
  slots: Map<string, AvailabilitySlot>,
): BookingWithSlots {
  return {
    ...b,
    preferred_slot: b.preferred_slot_id
      ? slots.get(b.preferred_slot_id) ?? null
      : null,
    confirmed_slot: b.confirmed_slot_id
      ? slots.get(b.confirmed_slot_id) ?? null
      : null,
    alternative_slots: (b.alternative_slot_ids ?? [])
      .map((id) => slots.get(id))
      .filter((s): s is AvailabilitySlot => Boolean(s)),
    requested_slot: b.requested_slot_id
      ? slots.get(b.requested_slot_id) ?? null
      : null,
  };
}

/** 고객용: 코드로 예약 조회 (슬롯 정보 포함) */
export async function getBookingByCode(
  code: string,
): Promise<BookingWithSlots | null> {
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const sb = createSupabaseAdminClient();
    const { data } = await sb
      .from("bookings")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .single();
    if (!data) return null;
    const b = data as Booking;
    const ids = [
      b.preferred_slot_id,
      b.confirmed_slot_id,
      b.requested_slot_id,
      ...(b.alternative_slot_ids ?? []),
    ].filter((x): x is string => Boolean(x));
    const slots = await slotsByIds(sb, ids);
    return hydrate(b, slots);
  } catch {
    return null;
  }
}

/** 갤러리 사진 (공개) — 카테고리·정렬순 */
export async function getGalleryPhotos(): Promise<GalleryPhoto[]> {
  if (!isSupabaseAdminConfigured()) return [];
  try {
    const sb = createSupabaseAdminClient();
    const { data } = await sb
      .from("gallery_photos")
      .select("*")
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    return (data as GalleryPhoto[]) ?? [];
  } catch {
    return [];
  }
}

/** 관리자 대시보드용: 전체 예약 (슬롯 정보 포함) */
export async function getAllBookings(): Promise<BookingWithSlots[]> {
  if (!isSupabaseAdminConfigured()) return [];
  const sb = createSupabaseAdminClient();
  const { data } = await sb
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });
  const bookings = (data as Booking[]) ?? [];
  const ids = bookings.flatMap((b) => [
    b.preferred_slot_id,
    b.confirmed_slot_id,
    b.requested_slot_id,
    ...(b.alternative_slot_ids ?? []),
  ]);
  const slots = await slotsByIds(
    sb,
    ids.filter((x): x is string => Boolean(x)),
  );
  return bookings.map((b) => hydrate(b, slots));
}
