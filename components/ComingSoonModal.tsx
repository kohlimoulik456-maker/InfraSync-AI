"use client";

import { X } from "lucide-react";

export function ComingSoonModal({
  open,
  onClose,
  title,
  message,
  onUseText,
  onUseExcel
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  onUseText: () => void;
  onUseExcel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="mb-3 flex items-start justify-between">
          <h3 className="text-lg font-semibold text-navy-900">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <p className="mb-6 text-sm leading-relaxed text-slate-600">{message}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="btn-primary flex-1" onClick={onUseText}>
            Use Text Update
          </button>
          <button className="btn-secondary flex-1" onClick={onUseExcel}>
            Use Excel Upload
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
