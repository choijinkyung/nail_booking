import { redirect } from "next/navigation";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { isAdmin } from "@/lib/auth";
import { isAdminConfigured } from "@/lib/adminAuth";
import { LoginForm } from "@/components/admin/LoginForm";

export default async function AdminLoginPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const configured = isAdminConfigured();
  if (configured && (await isAdmin())) redirect("/admin");

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-[22px] font-bold text-brand-900">
            {dict.admin.title} {dict.admin.login}
          </h1>
        </div>

        {!configured ? (
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
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
