import { NextRequest, NextResponse } from "next/server";
import { roleAtLeast, type Role, verifySession } from "@/lib/auth";

function withLocalCors(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get("origin");
  const isLocalOrigin = origin && (
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
    /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin)
  );
  if (isLocalOrigin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("Vary", "Origin");
  }
  return response;
}

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

  if (pathname.startsWith("/api/") && request.method === "OPTIONS") {
    return withLocalCors(new NextResponse(null, { status: 204 }), request);
  }

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const apiKey = process.env.AUTH_API_KEY;
  let session = await verifySession(request.cookies.get("infrasync_session")?.value);
  if (!session && apiKey && bearer && bearer === apiKey) {
    session = { username: "api-client", role: (process.env.AUTH_API_ROLE as Role) || "SUPERVISOR", expiresAt: Date.now() + 60_000 };
  }

  if (!session) {
    if (pathname.startsWith("/api/")) return withLocalCors(NextResponse.json({ error: "Authentication required" }, { status: 401 }), request);
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const required = requiredRole(pathname);
  if (required && !roleAtLeast(session.role, required)) {
    if (pathname.startsWith("/api/")) return withLocalCors(NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }), request);
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return withLocalCors(NextResponse.next(), request);
}

export const config = {
  matcher: ["/api/:path*", "/pm/:path*", "/supervisor/:path*"]
};