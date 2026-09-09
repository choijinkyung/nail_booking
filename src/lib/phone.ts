/**
 * 전화번호 정규화 — 손님이 예약할 때와 조회할 때 표기가 달라도
 * 같은 번호로 인식하기 위한 매칭 키를 만든다.
 * 화면에 보여주는 값은 손님이 입력한 원본을 그대로 쓰고,
 * 이 값은 DB의 매칭 전용 컬럼(contact_norm)에만 저장한다.
 *
 * 카카오 아이디처럼 숫자가 없는 연락처는 "" 를 반환한다 —
 * 그런 연락처는 전화번호 조회로 찾을 수 없다(예약번호로 조회).
 */
export function normalizePhone(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "";

  // 북미: +1 604 123 4567 → 6041234567
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  // 한국: +82 10-1234-5678 → 01012345678 (국내 표기와 같아지도록 0 을 붙임)
  if (digits.startsWith("82") && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

/** 두 연락처가 같은 전화번호인지. 숫자가 없는 쪽이 있으면 항상 false. */
export function samePhone(a: string, b: string): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return Boolean(na) && na === nb;
}
