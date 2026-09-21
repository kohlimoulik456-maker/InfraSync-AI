import { NextRequest, NextResponse } from "next/server";
import { configuredCredentials, createSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { username, password } = await request.json().catch(() => ({}));
  const credential = configuredCredentials().find((item) => item.username === username && item.password === password);

  if (!credential) return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });

  const response = NextResponse.json({ role: credential.role });
  response.cookies.set(SESSION_COOKIE, await createSession(credential.username, credential.role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60
  });
  return response;
}