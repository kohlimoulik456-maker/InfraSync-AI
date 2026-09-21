"use client";

import { useCallback, useState } from "react";
import { ToastKind, ToastMessage } from "@/components/Toast";

let idCounter = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const push = useCallback((kind: ToastKind, text: string) => {
    idCounter += 1;
    setToasts((prev) => [...prev, { id: idCounter, kind, text }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, push, dismiss };
}
