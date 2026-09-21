import { GoogleGenerativeAI } from "@google/generative-ai";
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionUserPrompt } from "./extractionPrompt";
import { RERANKING_SYSTEM_PROMPT, buildRerankingUserPrompt } from "./rerankingPrompt";
import {
  INSTITUTIONAL_MEMORY_SYSTEM_PROMPT,
  buildInstitutionalMemoryUserPrompt
} from "./institutionalMemoryPrompt";
import { CandidateActivity, LlmExtraction, RerankResult } from "../types";
import { demoExtractionFor, demoRerankFor } from "./demoResponses";

export function isDemoMode(): boolean {
  return !process.env.GEMINI_API_KEY;
}

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY as string;
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const client = new GoogleGenerativeAI(apiKey);
  return client.getGenerativeModel({ model: modelName });
}

function emptyField() {
  return { value: null, evidence_text: null, evidence_status: "MISSING" as const };
}

function blankExtraction(): LlmExtraction {
  return {
    activity_text: emptyField(),
    discipline: emptyField(),
    area_location: emptyField(),
    asset_tag: emptyField(),
    work_status: emptyField() as any,
    actual_start: emptyField(),
    actual_finish: emptyField(),
    progress_value: emptyField() as any,
    progress_unit: emptyField(),
    crew_size: emptyField() as any,
    delay_reason: emptyField(),
    remarks: emptyField(),
    missing_fields: [],
    ambiguous_fields: []
  };
}

function tryParseJson<T>(text: string): T | null {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/**
 * Extract structured event data from a single raw supervisor input
 * (one text update, or one Excel row). Demo mode returns deterministic
 * mock outputs for the seeded examples only; live mode calls Gemini
 * Flash and validates the JSON, retrying once with a repair instruction.
 */
export async function extractStructuredEvent(
  rawInput: string,
  reportDateIso: string
): Promise<{ extraction: LlmExtraction | null; failed: boolean }> {
  if (isDemoMode()) {
    const demo = demoExtractionFor(rawInput);
    return { extraction: demo ?? blankExtraction(), failed: false };
  }

  const model = getModel();
  const userPrompt = buildExtractionUserPrompt(rawInput, reportDateIso);

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt =
      attempt === 0
        ? `${EXTRACTION_SYSTEM_PROMPT}\n\n${userPrompt}`
        : `${EXTRACTION_SYSTEM_PROMPT}\n\n${userPrompt}\n\nYour previous response was not valid JSON matching the schema. Return ONLY a single valid JSON object, with no markdown fences and no commentary.`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = tryParseJson<LlmExtraction>(text);
      if (parsed) return { extraction: parsed, failed: false };
    } catch {
      // fall through to retry / failure
    }
  }

  return { extraction: null, failed: true };
}

/**
 * Rerank the top 3 backend-supplied candidates. Gemini may only select
 * among the supplied activity_ids or return null.
 */
export async function rerankCandidates(
  extraction: LlmExtraction,
  candidates: CandidateActivity[]
): Promise<{ rerank: RerankResult | null; failed: boolean }> {
  if (isDemoMode()) {
    return { rerank: demoRerankFor(extraction, candidates), failed: false };
  }

  const model = getModel();
  const userPrompt = buildRerankingUserPrompt(extraction, candidates);

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt =
      attempt === 0
        ? `${RERANKING_SYSTEM_PROMPT}\n\n${userPrompt}`
        : `${RERANKING_SYSTEM_PROMPT}\n\n${userPrompt}\n\nYour previous response was not valid JSON matching the schema. Return ONLY a single valid JSON object.`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = tryParseJson<RerankResult>(text);
      if (parsed) {
        // Enforce: never select an activity not supplied by backend.
        if (parsed.selected_candidate_id && !candidates.some((c) => c.activity_id === parsed.selected_candidate_id)) {
          parsed.selected_candidate_id = null;
        }
        return { rerank: parsed, failed: false };
      }
    } catch {
      // retry
    }
  }

  return { rerank: null, failed: true };
}

export async function generateInstitutionalMemorySummary(
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
): Promise<string> {
  if (metrics.sampleSize === 0) {
    return "No verified historical records match this query yet. Advisory only — final schedule decisions remain with the Program Manager.";
  }

  if (isDemoMode()) {
    const reasons = metrics.commonDelayReasons.map((r) => `${r.reason} (${r.count})`).join(", ") || "none recorded";
    return `Demo AI Mode summary based on ${metrics.sampleSize} verified record(s). Average actual duration: ${
      metrics.avgActualDuration ?? "n/a"
    } day(s); average delay: ${metrics.avgDelayDays ?? "n/a"} day(s). Common delay reasons: ${reasons}. Advisory only — final schedule decisions remain with the Program Manager.`;
  }

  const model = getModel();
  const userPrompt = buildInstitutionalMemoryUserPrompt(question, metrics, evidenceRecords);
  try {
    const result = await model.generateContent(`${INSTITUTIONAL_MEMORY_SYSTEM_PROMPT}\n\n${userPrompt}`);
    return result.response.text();
  } catch {
    return "Institutional Memory summary could not be generated at this time. Advisory only — final schedule decisions remain with the Program Manager.";
  }
}
