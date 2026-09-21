import { extractStructuredEvent, rerankCandidates, isDemoMode } from "../gemini/geminiService";
import { CandidateActivity, LlmExtraction, RerankResult } from "../types";

export { isDemoMode };

export async function runExtraction(rawInput: string, reportDateIso: string) {
  return extractStructuredEvent(rawInput, reportDateIso);
}

export async function runReranking(extraction: LlmExtraction, candidates: CandidateActivity[]) {
  return rerankCandidates(extraction, candidates);
}
