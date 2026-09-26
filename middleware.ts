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
  
  // Allow CORS preflight requests
  if (pathname.startsWith("/api/") && request.method === "OPTIONS") {
    return withLocalCors(new NextResponse(null, { status: 204 }), request);
  }

  // Authentication is disabled - allow all requests to proceed
  return withLocalCors(NextResponse.next(), request);
}

export const config = {
  matcher: ["/api/:path*", "/pm/:path*", "/supervisor/:path*"]
};