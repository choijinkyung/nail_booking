/**
 * 관리자가 손님에게 보내는 공개 링크.
 * baseUrl 은 getSiteUrl() 결과(끝 슬래시 없음)를 기대하지만,
 * 빈 값이나 슬래시가 붙은 값도 안전하게 처리한다.
 */
function base(baseUrl: string): string {
  return (baseUrl ?? "").replace(/\/+$/, "");
}

/** 예약하기 페이지 */
export function bookLink(baseUrl: string): string {
  return `${base(baseUrl)}/book`;
}

/** 갤러리 페이지 */
export function galleryLink(baseUrl: string): string {
  return `${base(baseUrl)}/gallery`;
}

/** 예약 확인 페이지 — 코드만으로 열리므로 관리자가 잡아준 예약도 손님이 볼 수 있다. */
export function bookingLink(baseUrl: string, code: string): string {
  return `${base(baseUrl)}/status?code=${encodeURIComponent(code)}`;
}
