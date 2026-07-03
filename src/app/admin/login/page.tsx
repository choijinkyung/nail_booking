import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getAdminUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";

export default async function AdminLoginPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  if (isSupabaseConfigured()) {
    const user = await getAdminUser();
    if (user) redirect("/admin");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-2xl">
            💅
          </div>
          <h1 className="text-xl font-bold text-brand-800">
            {dict.admin.title} {dict.admin.login}
          </h1>
        </div>

        {!isSupabaseConfigured() ? (
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">⚠️ {dict.admin.setupNeeded}</p>
            <p className="mt-1">{dict.admin.setupDesc}</p>
          </div>
        ) : (
          <LoginForm dict={dict} />
        )}
      </div>
    </div>
  );
}
