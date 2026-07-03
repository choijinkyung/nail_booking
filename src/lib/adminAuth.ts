import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

// 관리자 계정은 환경변수로 관리합니다. (Supabase 유저 생성 불필요)
const ADMIN_FIRST = process.env.ADMIN_FIRST_NAME ?? "";
const ADMIN_LAST = process.env.ADMIN_LAST_NAME ?? "";
const ADMIN_PW = process.env.ADMIN_PASSWORD ?? "";
// 세션 쿠키 서명용 비밀키 (없으면 service_role 키로 대체)
const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

const COOKIE_NAME = "zenna_admin";
const MAX_AGE = 60 * 60 * 24 * 30; // 30일

/** 관리자 로그인 기능을 쓸 수 있는 상태인지 (비번 + 서명키 설정됨) */
export function isAdminConfigured(): boolean {
  return Boolean(ADMIN_PW && SESSION_SECRET);
}

function ciEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** 입력한 이름+비밀번호가 관리자 계정과 일치하는지 */
export function verifyCredentials(
  firstName: string,
  lastName: string,
  password: string,
): boolean {
  if (!isAdminConfigured()) return false;
  const nameOk = ciEqual(firstName, ADMIN_FIRST) && ciEqual(lastName, ADMIN_LAST);
  const pwOk = safeEqual(password, ADMIN_PW);
  return nameOk && pwOk;
}

function sign(value: string): string {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

function makeToken(): string {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  return `${exp}.${sign(exp)}`;
}

function isValidToken(token: string | undefined): boolean {
  if (!token || !SESSION_SECRET) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  if (!safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Math.floor(Date.now() / 1000);
}

export async function setAdminSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, makeToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** 현재 요청이 로그인된 관리자인지 */
export async function hasAdminSession(): Promise<boolean> {
  const store = await cookies();
  return isValidToken(store.get(COOKIE_NAME)?.value);
}
