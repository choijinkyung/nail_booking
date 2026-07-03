import "server-only";
import { createHash, randomBytes } from "crypto";

/** 예약 확인용 비밀번호를 저장할 때 쓰는 솔트 생성 */
export function makeSalt(): string {
  return randomBytes(16).toString("hex");
}

/** salt + 비밀번호 → SHA-256 해시 (평문 저장 금지) */
export function hashPassword(password: string, salt: string): string {
  return createHash("sha256")
    .update(`${salt}:${password}`)
    .digest("hex");
}
