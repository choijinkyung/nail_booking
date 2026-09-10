import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";
import { isSupabaseAdminConfigured } from "./supabase/config";
import { normalizePhone } from "./phone";
import { nameKey } from "./customerKey";
import type { BusinessHour } from "./schedule";
import type {
  AvailabilitySlot,
  Booking,
  BookingWithSlots,
  Customer,
  GalleryPhoto,
  Service,
  Settings,
} from "./types";

// Supabase 미설정 시 랜딩이 깨지지 않도록 하는 기본값 (schema.sql 기본값과 동일)
export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  shop_name_ko: "Zenna Nail",
  shop_name_en: "Zenna Nail",
  hero_tagline_ko: "집에서 편안하게 받는 네일",
  hero_tagline_en: "Home nail service, at your convenience",
  hero_sub_ko: "원하는 시간을 골라 예약을 요청하면, 확인 후 확정해 드려요.",
  hero_sub_en: "Pick a time and send a request — I'll confirm it after checking.",
  schedule_note_ko:
    "네일샵 근무 일정에 따라 예약 시간이 조정될 수 있어요. 그래서 대체 시간을 함께 받아요.",
  schedule_note_en:
    "Times may shift depending on my nail salon schedule, so I collect backup times too.",
  logo_url: "",
  logo_storage_path: "",
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
  booking_window_days: 14,
  confirmed_address: "",
  msg_invite: "",
  msg_confirmed: "",
  msg_changed: "",
  msg_declined: "",
  msg_cancelled: "",
  msg_payment: "",
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

/** 고객 TimePicker용: 미래의 모든 슬롯 (open/booked/blocked) — 예약된 건 비활성 표시 */
export async function getFutureSlots(): Promise<AvailabilitySlot[]> {
  if (!isSupabaseAdminConfigured()) return [];
  try {
    const sb = createSupabaseAdminClient();
    const nowIso = new Date().toISOString();
    const { data } = await sb
      .from("availability_slots")
      .select("*")
      .neq("status", "blocked")
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true });
    return (data as AvailabilitySlot[]) ?? [];
  } catch {
    return [];
  }
}

/** 요일별 반복 영업시간 (0=일 … 6=토). 행이 없는 요일은 휴무로 본다. */
export async function getBusinessHours(): Promise<BusinessHour[]> {
  if (!isSupabaseAdminConfigured()) return [];
  const sb = createSupabaseAdminClient();
  const { data } = await sb
    .from("business_hours")
    .select("weekday, enabled, start_min, end_min")
    .order("weekday", { ascending: true });
  return (data as BusinessHour[]) ?? [];
}

/** 지정 휴무일 (YYYY-MM-DD), 오늘 이후만 의미가 있으므로 전체를 읽어 화면에서 거른다. */
export async function getDaysOff(): Promise<string[]> {
  if (!isSupabaseAdminConfigured()) return [];
  const sb = createSupabaseAdminClient();
  const { data } = await sb
    .from("schedule_days_off")
    .select("day")
    .order("day", { ascending: true });
  return ((data as { day: string }[]) ?? []).map((r) => r.day);
}

/** 관리자 블록(범위 차단) 슬롯. block_group 이 붙은 blocked 슬롯만. */
export type BlockSlot = {
  block_group: string;
  starts_at: string;
  note_ko: string;
  note_en: string;
};

export async function getBlocks(): Promise<BlockSlot[]> {
  if (!isSupabaseAdminConfigured()) return [];
  const sb = createSupabaseAdminClient();
  const { data } = await sb
    .from("availability_slots")
    .select("block_group, starts_at, note_ko, note_en")
    .eq("status", "blocked")
    .not("block_group", "is", null)
    .order("starts_at", { ascending: true });
  return (data as BlockSlot[]) ?? [];
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

/** 클라이언트로 나가면 안 되는 민감 필드 제거 (비밀번호 해시 등) */
function stripSecret(b: Booking): Booking {
  const r = { ...b } as Record<string, unknown>;
  delete r.lookup_password_hash;
  delete r.lookup_password_salt;
  return r as unknown as Booking;
}

function hydrate(
  raw: Booking,
  slots: Map<string, AvailabilitySlot>,
): BookingWithSlots {
  const b = stripSecret(raw);
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
    proposed_slots: (b.proposed_slot_ids ?? [])
      .map((id) => slots.get(id))
      .filter((s): s is AvailabilitySlot => Boolean(s)),
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
      ...(b.proposed_slot_ids ?? []),
    ].filter((x): x is string => Boolean(x));
    const slots = await slotsByIds(sb, ids);
    return hydrate(b, slots);
  } catch {
    return null;
  }
}

/** 관리자용: 전체 고객 (최근 등록순) */
export async function getCustomers(): Promise<Customer[]> {
  if (!isSupabaseAdminConfigured()) return [];
  const sb = createSupabaseAdminClient();
  const { data } = await sb
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as Customer[]) ?? [];
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

/**
 * 이름 + 전화번호로 예약 코드 찾기 (가장 최근 매칭).
 * 전화번호는 표기가 달라도 맞도록 정규화 키로 비교하고,
 * 이름은 대소문자·앞뒤 공백을 무시한다.
 */
export async function findBookingCodeByNamePhone(
  name: string,
  phone: string,
): Promise<string | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const cleanName = (name ?? "").trim();
  const norm = normalizePhone(phone ?? "");
  // 숫자가 없는 입력(카톡 아이디 등)으로는 찾을 수 없다 — 예약번호로 조회해야 한다.
  if (!cleanName || !norm) return null;
  try {
    const sb = createSupabaseAdminClient();
    // 이름은 코드에서 비교한다. ilike 로 넘기면 "%" 가 와일드카드가 되어
    // 이름 확인이 무력화되고 번호만 아는 사람이 남의 예약을 열 수 있다.
    const { data } = await sb
      .from("bookings")
      .select("code, customer_name")
      .eq("customer_contact_norm", norm)
      .order("created_at", { ascending: false })
      .limit(30);
    const rows = (data as { code: string; customer_name: string }[]) ?? [];
    const want = nameKey(cleanName);
    return rows.find((r) => nameKey(r.customer_name) === want)?.code ?? null;
  } catch {
    return null;
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
    ...(b.proposed_slot_ids ?? []),
  ]);
  const slots = await slotsByIds(
    sb,
    ids.filter((x): x is string => Boolean(x)),
  );
  return bookings.map((b) => hydrate(b, slots));
}
