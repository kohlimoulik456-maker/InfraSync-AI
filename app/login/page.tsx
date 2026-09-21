"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") })
    });
    setLoading(false);
    if (!response.ok) {
      setError((await response.json()).error ?? "Unable to sign in");
      return;
    }
    router.push("/pm");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <form onSubmit={submit} className="card w-full max-w-md space-y-5 p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">InfraSync-AI</p>
          <h1 className="mt-2 text-2xl font-semibold text-navy-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Use an account configured by the deployment administrator.</p>
        </div>
        <label className="block"><span className="label-field">Username</span><input name="username" required autoComplete="username" className="input-field" /></label>
        <label className="block"><span className="label-field">Password</span><input name="password" type="password" required autoComplete="current-password" className="input-field" /></label>
        {error && <p className="text-sm text-danger-500">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
      </form>
    </main>
  );
}