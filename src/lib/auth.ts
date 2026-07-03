import "server-only";
import { redirect } from "next/navigation";
import { hasAdminSession } from "./adminAuth";

/** 로그인된 관리자인지 여부 */
export async function isAdmin(): Promise<boolean> {
  return hasAdminSession();
}

/** 서버 액션에서 관리자 인증 강제 (미인증이면 예외) */
export async function assertAdmin(): Promise<void> {
  if (!(await hasAdminSession())) throw new Error("UNAUTHORIZED");
}

/** 페이지 가드: 미인증이면 로그인으로 리다이렉트 */
export async function requireAdminPage(): Promise<void> {
  if (!(await hasAdminSession())) redirect("/admin/login");
}
