export type Role = "ADMIN" | "MANAGER" | "SUPERVISOR";

export const SESSION_COOKIE = "infrasync_session";

type Session = {
  username: string;
  role: Role;
  expiresAt: number;
};

function encode(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(padded);
}

async function sign(value: string): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return encode(String.fromCharCode(...new Uint8Array(signature)));
}

export async function createSession(username: string, role: Role): Promise<string> {
  const payload = encode(JSON.stringify({ username, role, expiresAt: Date.now() + 8 * 60 * 60 * 1000 }));
  return `${payload}.${await sign(payload)}`;
}

export async function verifySession(value?: string): Promise<Session | null> {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || signature !== await sign(payload)) return null;

  try {
    const session = JSON.parse(decode(payload)) as Session;
    if (!session.username || !session.role || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function roleAtLeast(actual: Role, required: Role): boolean {
  const rank: Record<Role, number> = { SUPERVISOR: 1, MANAGER: 2, ADMIN: 3 };
  return rank[actual] >= rank[required];
}

export function configuredCredentials(): Array<{ username: string; password: string; role: Role }> {
  const credentials: Array<{ username: string; password: string; role: Role }> = [
    { username: process.env.AUTH_ADMIN_USERNAME ?? "", password: process.env.AUTH_ADMIN_PASSWORD ?? "", role: "ADMIN" },
    { username: process.env.AUTH_MANAGER_USERNAME ?? "", password: process.env.AUTH_MANAGER_PASSWORD ?? "", role: "MANAGER" },
    { username: process.env.AUTH_SUPERVISOR_USERNAME ?? "", password: process.env.AUTH_SUPERVISOR_PASSWORD ?? "", role: "SUPERVISOR" }
  ];
  return credentials.filter((credential) => credential.username && credential.password);
}