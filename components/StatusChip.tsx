import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  AUTO_ACCEPT: "chip-teal",
  ACCEPT_MONITOR: "chip-teal",
  MATCHED: "chip-teal",
  COMPLETED: "chip-teal",
  APPROVED: "chip-teal",
  FLAG_FOR_REVIEW: "chip-amber",
  AMBIGUOUS: "chip-amber",
  IN_PROGRESS: "chip-amber",
  ON_HOLD: "chip-amber",
  NO_MATCH: "chip-danger",
  UNMATCHED: "chip-danger",
  REJECTED: "chip-danger",
  INVALID: "chip-danger",
  DELAYED: "chip-danger",
  NOT_STARTED: "chip-slate"
};

export function StatusChip({ value, label }: { value: string; label?: string }) {
  const style = STYLES[value] || "chip-slate";
  return <span className={cn("chip", style)}>{label ?? value.replace(/_/g, " ")}</span>;
}
