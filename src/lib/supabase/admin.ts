import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  isSupabaseAdminConfigured,
} from "./config";

/**
 * service_role 키를 사용하는 서버 전용 클라이언트. RLS를 우회하므로
 * 절대 브라우저로 노출되면 안 됩니다. (server-only 로 보호)
 * 모든 DB 읽기/쓰기는 이 클라이언트를 통해 서버에서만 수행합니다.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  if (!isSupabaseAdminConfigured()) {
    throw new Error(
      "Supabase가 설정되지 않았습니다. .env.local 의 SUPABASE_* 값을 확인하세요.",
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
