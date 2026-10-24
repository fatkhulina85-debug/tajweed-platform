import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";

/** Reads the session: render inside <Suspense>. */
export async function UserMenu() {
  const locale = await getLocale();
  const dict = await getDictionary();
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link href={`/${locale}/login`} className="text-sm text-primary underline">
        {dict.common.login}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href={`/${locale}/account`} className="max-w-48 truncate text-ink hover:underline">
        {user.displayName || user.email}
      </Link>
      <form action={signOut}>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" className="rounded-md px-2.5 py-1 text-muted hover:bg-mint">
          {dict.common.logout}
        </button>
      </form>
    </div>
  );
}
