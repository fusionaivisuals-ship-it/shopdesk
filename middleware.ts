import { NextResponse, type NextRequest } from "next/server";
import { allowed, ACCESS_COOKIE } from "./lib/access";

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (allowed(process.env.SHOPDESK_ACCESS_CODE, req.cookies.get(ACCESS_COOKIE)?.value, path)) return NextResponse.next();
  if (path.startsWith("/api/")) return NextResponse.json({ error: "This demo is private for now." }, { status: 401 });
  return NextResponse.redirect(new URL("/unlock", req.url));
}

export const config = { matcher: ["/((?!_next/|favicon.ico).*)"] };
