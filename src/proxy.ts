import { NextResponse, type NextRequest } from "next/server";
import { hasLocale, localeCookie, negotiateLocale } from "@/i18n/config";
import { routeDecision } from "@/lib/auth/routes";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!hasLocale(pathname.split("/")[1])) {
    const locale = negotiateLocale(
      request.cookies.get(localeCookie)?.value,
      request.headers.get("accept-language"),
    );
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  const { response, signedIn } = await updateSession(request);
  const decision = routeDecision(pathname, signedIn);
  if (!decision) return response;

  const redirect = NextResponse.redirect(new URL(decision.redirectTo, request.url));
  // Keep refreshed session cookies when redirecting.
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  // Skip Next.js internals, API routes and files with an extension.
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
