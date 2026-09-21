// Common normalized input object produced by every input processor.
// Only TEXT and EXCEL are permitted to enter the common AI pipeline in the MVP.

export type SourceType = "TEXT" | "EXCEL" | "VOICE" | "DIARY_SCAN";

export interface NormalizedSupervisorInput {
  project_id: string;
  supervisor_id: string;
  source_type: SourceType;
  update_date: string; // ISO date
  discipline: string | null;
  area_unit: string | null;
  activity_description: string;
  actual_start_date: string | null;
  actual_finish_date: string | null;
  progress_value: number | null;
  progress_unit: string | null;
  delay_reason: string | null;
  remarks: string | null;
  raw_input: string;
  metadata: Record<string, unknown>;
}

export type EvidenceStatus = "EXPLICIT" | "DERIVED_FROM_REPORT_DATE" | "MISSING";

export interface ExtractedField<T> {
  value: T | null;
  evidence_text: string | null;
  evidence_status: EvidenceStatus;
}

export type WorkStatus =
  | "STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ON_HOLD"
  | "DELAYED"
  | "UNKNOWN";

export interface LlmExtraction {
  activity_text: ExtractedField<string>;
  discipline: ExtractedField<string>;
  area_location: ExtractedField<string>;
  asset_tag: ExtractedField<string>;
  work_status: ExtractedField<WorkStatus>;
  actual_start: ExtractedField<string>;
  actual_finish: ExtractedField<string>;
  progress_value: ExtractedField<number>;
  progress_unit: ExtractedField<string>;
  crew_size: ExtractedField<number>;
  delay_reason: ExtractedField<string>;
  remarks: ExtractedField<string>;
  missing_fields: string[];
  ambiguous_fields: string[];
}

export interface CandidateActivity {
  activity_id: string;
  activity_name: string;
  discipline: string;
  area: string | null;
  activity_status: string;
  field_keywords: string | null;
  normalized_search_text: string;
  planned_start: string;
  planned_finish: string;
  predecessor_id: string | null;
}

export type LlmMatchAssessment = "HIGH" | "MEDIUM" | "LOW" | "NO_MATCH";

export interface RerankResult {
  selected_candidate_id: string | null;
  llm_match_assessment: LlmMatchAssessment;
  candidate_reason: string;
  ambiguity_notes: string | null;
}

export interface ScoredCandidate {
  activity_id: string;
  activity_name: string;
  similarity: number;
}

export interface ConfidenceBreakdown {
  semantic_similarity: number;
  schedule_consistency: number;
  context_match: number;
  rule_validation: number;
  overall_score: number;
  top_two_gap: number | null;
}

export type MatchStatus =
  | "MATCHED"
  | "AMBIGUOUS"
  | "UNMATCHED"
  | "INVALID"
  | "APPROVED"
  | "REJECTED";

export type Decision =
  | "AUTO_ACCEPT"
  | "ACCEPT_MONITOR"
  | "FLAG_FOR_REVIEW"
  | "NO_MATCH"
  | "REJECTED";

export interface AuditJson {
  activity_mapping: {
    activity_id: string | null;
    activity_name: string | null;
    mapping_status: MatchStatus;
    candidates: ScoredCandidate[];
  };
  confidence: ConfidenceBreakdown;
  decision: {
    action: Decision;
    requires_human_review: boolean;
  };
  audit: {
    reason: string;
    source_evidence: string[];
    created_at: string;
  };
}

export interface PipelineResult {
  matchStatus: MatchStatus;
  decision: Decision;
  activityId: string | null;
  activityName: string | null;
  reason: string;
  confidence: ConfidenceBreakdown;
  candidates: ScoredCandidate[];
  llmExtraction: LlmExtraction | null;
  auditJson: AuditJson;
}
