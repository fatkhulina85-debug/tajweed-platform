import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { safeNextPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

const allowedTypes: EmailOtpType[] = ["invite", "recovery"];

// Target of the invite and password-recovery email links
// (supabase/templates/*.html): exchanges the token for a session.
export async function GET(request: NextRequest, { params }: RouteContext<"/[lang]/auth/confirm">) {
  const { lang } = await params;
  const locale = hasLocale(lang) ? lang : defaultLocale;
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type && allowedTypes.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(
        new URL(safeNextPath(searchParams.get("next"), locale), request.url),
      );
    }
  }

  return NextResponse.redirect(new URL(`/${locale}/login?error=link`, request.url));
}
