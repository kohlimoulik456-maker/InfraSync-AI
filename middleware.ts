import { NextRequest, NextResponse } from "next/server";
import { roleAtLeast, type Role, verifySession } from "@/lib/auth";

function requiredRole(pathname: string): Role | null {
  if (pathname.startsWith("/api/supervisor")) return "SUPERVISOR";
  if (
    pathname.startsWith("/api/audit") ||
    pathname.startsWith("/api/institutional-memory") ||
    pathname.startsWith("/api/projects/import") ||
    pathname.startsWith("/pm")
  ) return "MANAGER";
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/api/auth/login" || pathname === "/login") return NextResponse.next();

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const apiKey = process.env.AUTH_API_KEY;
  let session = await verifySession(request.cookies.get("infrasync_session")?.value);
  if (!session && apiKey && bearer && bearer === apiKey) {
    session = { username: "api-client", role: (process.env.AUTH_API_ROLE as Role) || "SUPERVISOR", expiresAt: Date.now() + 60_000 };
  }

  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const required = requiredRole(pathname);
  if (required && !roleAtLeast(session.role, required)) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/pm/:path*", "/supervisor/:path*"]
};