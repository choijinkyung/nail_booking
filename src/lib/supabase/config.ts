// Supabase 환경변수 및 설정 여부 판별

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** 공개 클라이언트(인증)에 필요한 값이 채워졌는지 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    SUPABASE_URL &&
      SUPABASE_URL.startsWith("http") &&
      SUPABASE_ANON_KEY,
  );
}

/** 서버 DB 접근(service_role)까지 가능한지 */
export function isSupabaseAdminConfigured(): boolean {
  return isSupabaseConfigured() && Boolean(SUPABASE_SERVICE_ROLE_KEY);
}
