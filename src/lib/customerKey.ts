import { normalizePhone } from "./phone";

/** 사람을 가릴 수 있다고 볼 최소 자릿수. 이보다 짧으면 자리채움 값으로 본다. */
export const MIN_PHONE_DIGITS = 8;

/**
 * 이 연락처만으로 사람을 특정할 수 있는가.
 * "0" 처럼 필수 항목을 채우려고 넣은 값에 여러 사람이 걸려
 * 한 명으로 합쳐지는 일을 막기 위한 판정이다.
 */
export function isUsablePhone(contact: string): boolean {
  return normalizePhone(contact ?? "").length >= MIN_PHONE_DIGITS;
}

function nameKey(name: string): string {
  return (name ?? "").trim().toLowerCase();
}

/**
 * 두 예약자가 같은 손님인가.
 * 제대로 된 번호가 있으면 번호만으로 판단하고(이름이 바뀌어도 같은 사람),
 * 번호가 자리채움 값이면 이름까지 같아야 같은 사람으로 본다.
 */
export function sameCustomer(
  a: { name: string; contact: string },
  b: { name: string; contact: string },
): boolean {
  const pa = normalizePhone(a.contact ?? "");
  const pb = normalizePhone(b.contact ?? "");
  if (isUsablePhone(a.contact) || isUsablePhone(b.contact)) {
    return pa === pb && pa !== "";
  }
  return pa === pb && nameKey(a.name) === nameKey(b.name);
}
