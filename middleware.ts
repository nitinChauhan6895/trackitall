import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// The app moved to its own domain. Visitors on the old Vercel address are sent
// there; API routes are left alone so a caller still using the old URL (the
// reminder workflow, an installed copy of the app) keeps working.
const OLD_HOST = "trackitall-ten.vercel.app";
const CANONICAL_ORIGIN = "https://www.vesmo.in";

export async function middleware(request: NextRequest) {
  // The app never uses next/image, yet Next serves its image-optimizer endpoint
  // by default, and several recent Next.js advisories (including remote code
  // execution) are in it. Nothing needs it, so refuse the path outright.
  if (request.nextUrl.pathname.startsWith("/_next/image")) {
    return new NextResponse(null, { status: 404 });
  }

  const host = request.headers.get("host");
  if (host === OLD_HOST && !request.nextUrl.pathname.startsWith("/api/")) {
    const { pathname, search } = request.nextUrl;
    return NextResponse.redirect(`${CANONICAL_ORIGIN}${pathname}${search}`, 308);
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|.*\\.png$).*)",
  ],
};
