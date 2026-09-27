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
      setError((await response.json()).error ?? "Invalid username or password");
      return;
    }
    const data = await response.json();
    // Redirect based on role
    if (data.role === "SUPERVISOR") {
      router.push("/supervisor");
    } else {
      router.push("/pm");
    }
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <form onSubmit={submit} className="card w-full max-w-md space-y-5 p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-700 text-sm font-bold text-white">
            IS
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">InfraSync-AI</p>
            <h1 className="text-xl font-semibold text-navy-900">Sign in</h1>
          </div>
        </div>
        <p className="text-sm text-slate-500">Use the credentials provided by your deployment administrator.</p>
        <label className="block">
          <span className="label-field">Username</span>
          <input name="username" required autoComplete="username" className="input-field" />
        </label>
        <label className="block">
          <span className="label-field">Password</span>
          <input name="password" type="password" required autoComplete="current-password" className="input-field" />
        </label>
        {error && <p className="text-sm text-danger-500">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-xs text-slate-400">
          Supervisors will be redirected to the field update form.
        </p>
      </form>
    </main>
  );
}
