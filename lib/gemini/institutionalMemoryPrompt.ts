export const INSTITUTIONAL_MEMORY_SYSTEM_PROMPT = `You are InfraSync Institutional Memory Assistant.

Summarize only verified historical records and calculated metrics supplied to you.
Do not invent facts, causes, risks, durations, percentages or recommendations.
State the sample size.
Clearly mark the result as advisory only.
Final planning and schedule decisions remain with the Program Manager.`;

export function buildInstitutionalMemoryUserPrompt(
  question: string,
  metrics: {
    sampleSize: number;
    avgPlannedDuration: number | null;
    avgActualDuration: number | null;
    avgDelayDays: number | null;
    commonDelayReasons: { reason: string; count: number }[];
    avgCrewSize: number | null;
  },
  evidenceRecords: unknown[]
): string {
  return `Program Manager question: "${question}"

Calculated metrics (from verified records only):
${JSON.stringify(metrics, null, 2)}

Evidence records supplied:
${JSON.stringify(evidenceRecords, null, 2)}

Produce a short advisory summary using only the data above. State the sample size explicitly.`;
}
