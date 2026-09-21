"use client";

import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastKind = "success" | "warning" | "error";

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
}

const ICONS: Record<ToastKind, JSX.Element> = {
  success: <CheckCircle2 size={18} className="text-teal-500" />,
  warning: <AlertTriangle size={18} className="text-amber-500" />,
  error: <XCircle size={18} className="text-danger-500" />
};

export function ToastStack({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timers = toasts.map((t) => setTimeout(() => onDismiss(t.id), 5000));
    return () => timers.forEach(clearTimeout);
  }, [toasts, onDismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "card flex items-start gap-2.5 px-4 py-3 text-sm shadow-md",
            t.kind === "error" && "border-danger-500/30",
            t.kind === "warning" && "border-amber-500/30",
            t.kind === "success" && "border-teal-500/30"
          )}
        >
          {ICONS[t.kind]}
          <span className="flex-1 text-slate-700">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
