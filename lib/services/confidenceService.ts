// Pure mathematical confidence scoring. No LLM calls here - Gemini only
// extracts facts and reranks; the final numeric score is always computed here.

import { CandidateActivity, ConfidenceBreakdown, LlmExtraction, ScoredCandidate } from "../types";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

// --- A. Semantic similarity (weight 40%) ------------------------------

/** Simple token-overlap / fuzzy similarity in [0,100]. No external deps so
 * this stays deterministic and unit-testable without network access. */
export function tokenSimilarity(a: string, b: string): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

  const tokensA = new Set(norm(a));
  const tokensB = new Set(norm(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  for (const t of tokensA) if (tokensB.has(t)) overlap++;

  const union = new Set([...tokensA, ...tokensB]).size;
  const jaccard = overlap / union;

  // Bonus for substring containment (helps short tags like "24-A", "C-305")
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  const containment = aLower.includes(bLower) || bLower.includes(aLower) ? 15 : 0;

  return clamp(jaccard * 100 + containment);
}

export function semanticSimilarity(extractedText: string, candidate: CandidateActivity): number {
  const candidateCorpus = [
    candidate.activity_name,
    candidate.field_keywords ?? "",
    candidate.normalized_search_text
  ].join(" ");
  return Math.round(tokenSimilarity(extractedText, candidateCorpus) * 10) / 10;
}

// --- B. Schedule consistency (weight 25%) ------------------------------

export function scheduleConsistency(
  extraction: LlmExtraction,
  candidate: CandidateActivity,
  hasExistingActualStart: boolean
): number {
  let score = 100;
  const workStatus = extraction.work_status.value;

  if (
    workStatus === "COMPLETED" &&
    candidate.activity_status === "NOT_STARTED" &&
    !hasExistingActualStart
  ) {
    score -= 40;
  }

  const start = extraction.actual_start.value;
  const finish = extraction.actual_finish.value;
  if (start && finish && new Date(finish) < new Date(start)) {
    score -= 30;
  }

  if (candidate.activity_status === "COMPLETED" && workStatus === "STARTED") {
    score -= 25;
  }

  // Far-outside-planned-window check: flag but do not reject solely for lateness.
  const reportDate = extraction.actual_start.value || extraction.actual_finish.value;
  if (reportDate) {
    const plannedStart = new Date(candidate.planned_start).getTime();
    const plannedFinish = new Date(candidate.planned_finish).getTime();
    const reported = new Date(reportDate).getTime();
    const windowMs = Math.max(plannedFinish - plannedStart, 1000 * 60 * 60 * 24);
    const bufferMs = windowMs * 3; // generous buffer before penalizing
    if (reported < plannedStart - bufferMs || reported > plannedFinish + bufferMs) {
      score -= 20;
    }
  }

  // Predecessor state: MVP heuristic - if candidate has a predecessor and
  // candidate is NOT_STARTED but report claims COMPLETED/IN_PROGRESS/STARTED,
  // treat as a soft inconsistency signal (already partially captured above).
  if (
    candidate.predecessor_id &&
    candidate.activity_status === "NOT_STARTED" &&
    (workStatus === "IN_PROGRESS" || workStatus === "COMPLETED")
  ) {
    score -= 20;
  }

  return clamp(score);
}

// --- C. Context match (weight 20%) -------------------------------------

export function contextMatch(extraction: LlmExtraction, candidate: CandidateActivity): number {
  const extractedDiscipline = (extraction.discipline.value || "").toUpperCase().trim();
  const candidateDiscipline = (candidate.discipline || "").toUpperCase().trim();

  if (extractedDiscipline && candidateDiscipline && extractedDiscipline !== candidateDiscipline) {
    // Explicit discipline mismatch forces Context Match = 0.
    return 0;
  }

  let score = 0;
  if (extractedDiscipline && extractedDiscipline === candidateDiscipline) score += 40;

  const extractedArea = (extraction.area_location.value || "").toLowerCase().trim();
  const candidateArea = (candidate.area || "").toLowerCase().trim();
  if (extractedArea && candidateArea && extractedArea === candidateArea) score += 25;
  else if (extractedArea && candidateArea && candidateArea.includes(extractedArea)) score += 15;

  const extractedTag = (extraction.asset_tag.value || "").toLowerCase().trim();
  const candidateSearchText = candidate.normalized_search_text.toLowerCase();
  if (extractedTag && candidateSearchText.includes(extractedTag)) score += 25;

  const keywordList = (candidate.field_keywords || "")
    .toLowerCase()
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const activityTextLower = (extraction.activity_text.value || "").toLowerCase();
  const keywordHit = keywordList.some((k) => k && activityTextLower.includes(k));
  if (keywordHit) score += 10;

  return clamp(score);
}

// --- D. Rule validation (weight 15%) ------------------------------------

export interface RuleValidationInput {
  activityBelongsToProject: boolean;
  projectIdValid: boolean;
  rawInputExists: boolean;
  datesValid: boolean;
  finishNotBeforeStart: boolean;
  workStatusValid: boolean;
  hasProhibitedConflict: boolean;
}

export function ruleValidation(input: RuleValidationInput): number {
  if (
    !input.activityBelongsToProject ||
    !input.projectIdValid ||
    input.hasProhibitedConflict
  ) {
    return 0;
  }
  let score = 100;
  if (!input.rawInputExists) score -= 100;
  if (!input.datesValid) score -= 30;
  if (!input.finishNotBeforeStart) score -= 30;
  if (!input.workStatusValid) score -= 20;
  return clamp(score);
}

// --- Overall formula -----------------------------------------------------

export function overallConfidence(
  semantic: number,
  schedule: number,
  context: number,
  rule: number
): number {
  const raw = 0.4 * semantic + 0.25 * schedule + 0.2 * context + 0.15 * rule;
  return Math.round(raw * 10) / 10;
}

/** Demo/seed helper: spread an overall score into the four weighted criteria. */
export function splitOverallIntoCriteria(overall: number): {
  semanticSimilarity: number;
  scheduleConsistency: number;
  contextMatch: number;
  ruleValidation: number;
} {
  const jitter = (spread: number) => (Math.random() * 2 - 1) * spread;
  const semantic = clamp(overall + jitter(12));
  const schedule = clamp(overall + jitter(14));
  const context = clamp(overall + jitter(18));
  const rule = clamp((overall - 0.4 * semantic - 0.25 * schedule - 0.2 * context) / 0.15);
  return {
    semanticSimilarity: Math.round(semantic * 10) / 10,
    scheduleConsistency: Math.round(schedule * 10) / 10,
    contextMatch: Math.round(context * 10) / 10,
    ruleValidation: Math.round(rule * 10) / 10
  };
}

export function topTwoGap(scoredCandidates: ScoredCandidate[]): number | null {
  if (scoredCandidates.length < 2) return null;
  const sorted = [...scoredCandidates].sort((a, b) => b.similarity - a.similarity);
  return Math.round((sorted[0].similarity - sorted[1].similarity) * 10) / 10;
}

export function decisionFromScore(score: number): { matchStatus: string; decision: string } {
  if (score >= 90.0) return { matchStatus: "MATCHED", decision: "AUTO_ACCEPT" };
  if (score >= 80.0) return { matchStatus: "MATCHED", decision: "ACCEPT_MONITOR" };
  if (score >= 60.0) return { matchStatus: "AMBIGUOUS", decision: "FLAG_FOR_REVIEW" };
  return { matchStatus: "UNMATCHED", decision: "NO_MATCH" };
}

export function buildConfidenceBreakdown(
  semantic: number,
  schedule: number,
  context: number,
  rule: number,
  gap: number | null
): ConfidenceBreakdown {
  return {
    semantic_similarity: semantic,
    schedule_consistency: schedule,
    context_match: context,
    rule_validation: rule,
    overall_score: overallConfidence(semantic, schedule, context, rule),
    top_two_gap: gap
  };
}
