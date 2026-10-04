import { NextResponse, type NextRequest } from "next/server";

// Arabic lives at the root (mizansharia.com, /review) and English under /en. Unprefixed paths are
// rewritten onto the Arabic [lang] routes; old /ar links redirect to their clean form.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/en" || pathname.startsWith("/en/")) return;
  if (pathname === "/ar" || pathname.startsWith("/ar/")) {
    request.nextUrl.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(request.nextUrl, 308);
  }
  request.nextUrl.pathname = `/ar${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(request.nextUrl);
}

export const config = {
  // Skip Next internals, API routes (never locale-prefixed), and static files (anything with a dot).
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
