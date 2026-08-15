import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED = ["/dashboard", "/onboarding", "/listings", "/map", "/admin"];

/**
 * Signed-in check only. Role and supplier-approval checks happen in the pages
 * and route handlers where the database is available — the JWT is not allowed
 * to be the source of truth for authority.
 */
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!token) {
    const signin = new URL("/signin", req.url);
    signin.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signin);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
