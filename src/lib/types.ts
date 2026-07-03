// 도메인 타입 (Supabase 테이블과 1:1)

export type ServiceUnit = "flat" | "per_finger";

export interface Service {
  id: string;
  name_ko: string;
  name_en: string;
  price: number;
  unit: ServiceUnit;
  description_ko: string;
  description_en: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export type SlotStatus = "open" | "booked" | "blocked";

export interface AvailabilitySlot {
  id: string;
  starts_at: string; // ISO
  ends_at: string | null;
  status: SlotStatus;
  note_ko: string;
  note_en: string;
  created_at: string;
}

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "completed";

// 예약 시점의 시술 스냅샷
export interface BookingServiceLine {
  service_id: string;
  name_ko: string;
  name_en: string;
  unit: ServiceUnit;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface Booking {
  id: string;
  code: string;
  customer_name: string;
  customer_contact: string;
  customer_email: string;
  services: BookingServiceLine[];
  estimated_total: number;
  note: string;
  preferred_slot_id: string | null;
  alternative_slot_ids: string[];
  status: BookingStatus;
  confirmed_slot_id: string | null;
  admin_message: string;
  created_at: string;
  updated_at: string;
}

// 관계 조인이 채워진 예약 (대시보드/조회용)
export interface BookingWithSlots extends Booking {
  preferred_slot: AvailabilitySlot | null;
  confirmed_slot: AvailabilitySlot | null;
  alternative_slots: AvailabilitySlot[];
}

export interface GalleryPhoto {
  id: string;
  image_url: string;
  storage_path: string;
  category: string;
  caption_ko: string;
  caption_en: string;
  sort_order: number;
  created_at: string;
}

export interface Settings {
  id: number;
  shop_name_ko: string;
  shop_name_en: string;
  location_ko: string;
  location_en: string;
  notice_ko: string;
  notice_en: string;
  payment_ko: string;
  payment_en: string;
  etransfer_email: string;
  etransfer_note_ko: string;
  etransfer_note_en: string;
  currency: string;
  updated_at: string;
}
