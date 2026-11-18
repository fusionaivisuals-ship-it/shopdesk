import { NextResponse, type NextRequest } from "next/server";
import { allowed, ACCESS_COOKIE } from "./lib/access";
import { cookieSecret } from "./lib/guard/config";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const ok = await allowed(process.env.SHOPDESK_ACCESS_CODE, req.cookies.get(ACCESS_COOKIE)?.value, path, cookieSecret());
  if (ok) return NextResponse.next();
  if (path.startsWith("/api/")) return NextResponse.json({ error: "This demo is private for now." }, { status: 401 });
  return NextResponse.redirect(new URL("/unlock", req.url));
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
