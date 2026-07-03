import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/config";

/** 로그인된 관리자 유저 반환 (없으면 null) */
export async function getAdminUser() {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/** 서버 액션에서 관리자 인증 강제 (미인증이면 예외) */
export async function assertAdmin() {
  const user = await getAdminUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

/** 페이지 가드: 미인증이면 로그인으로 리다이렉트 */
export async function requireAdminPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}
