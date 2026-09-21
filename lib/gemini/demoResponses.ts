// Demo AI Mode: deterministic mock outputs for the seeded example inputs only.
// Used whenever GEMINI_API_KEY is not configured. Never claims Gemini processed
// the update - see the "Demo AI Mode" badge shown in the UI.

import { CandidateActivity, LlmExtraction, RerankResult } from "../types";

function field<T>(value: T | null, evidence_text: string | null, evidence_status: "EXPLICIT" | "DERIVED_FROM_REPORT_DATE" | "MISSING") {
  return { value, evidence_text, evidence_status };
}

const missing = () => field(null, null, "MISSING" as const);

export function demoExtractionFor(rawInput: string): LlmExtraction | null {
  const text = rawInput.toLowerCase();

  if (text.includes("erection of line 24-a") || (text.includes("24-a") && text.includes("spool"))) {
    return {
      activity_text: field("erection of Line 24-A spool at Rack 3", "erection of Line 24-A spool at Rack 3", "EXPLICIT"),
      discipline: field("PIPING", "Piping crew", "EXPLICIT"),
      area_location: field("Rack 3", "Rack 3", "EXPLICIT"),
      asset_tag: field("24-A", "Line 24-A", "EXPLICIT"),
      work_status: field("STARTED", "started erection", "EXPLICIT") as any,
      actual_start: field(new Date().toISOString().slice(0, 10), "today at 9 AM", "DERIVED_FROM_REPORT_DATE"),
      actual_finish: missing(),
      progress_value: missing() as any,
      progress_unit: missing(),
      crew_size: field(6, "Six workers deployed", "EXPLICIT") as any,
      delay_reason: missing(),
      remarks: missing(),
      missing_fields: ["actual_finish", "progress_value"],
      ambiguous_fields: []
    };
  }

  if (text.includes("spool work completed in pipe rack")) {
    return {
      activity_text: field("Spool work completed in Pipe Rack", "Spool work completed in Pipe Rack", "EXPLICIT"),
      discipline: missing(),
      area_location: field("Pipe Rack", "Pipe Rack", "EXPLICIT"),
      asset_tag: missing(),
      work_status: field("COMPLETED", "completed", "EXPLICIT") as any,
      actual_start: missing(),
      actual_finish: field(new Date().toISOString().slice(0, 10), "report date", "DERIVED_FROM_REPORT_DATE"),
      progress_value: missing() as any,
      progress_unit: missing(),
      crew_size: missing() as any,
      delay_reason: missing(),
      remarks: missing(),
      missing_fields: ["discipline", "asset_tag", "actual_start"],
      ambiguous_fields: ["area_location"]
    };
  }

  if (text.includes("foundation f-12")) {
    return {
      activity_text: field("Concrete pour for Foundation F-12", "Concrete pour for Foundation F-12", "EXPLICIT"),
      discipline: field("CIVIL", "Concrete pour", "EXPLICIT"),
      area_location: missing(),
      asset_tag: field("F-12", "Foundation F-12", "EXPLICIT"),
      work_status: field("COMPLETED", "completed today", "EXPLICIT") as any,
      actual_start: missing(),
      actual_finish: field(new Date().toISOString().slice(0, 10), "completed today", "DERIVED_FROM_REPORT_DATE"),
      progress_value: field(45, "Quantity 45 m3", "EXPLICIT") as any,
      progress_unit: field("m3", "Quantity 45 m3", "EXPLICIT"),
      crew_size: missing() as any,
      delay_reason: missing(),
      remarks: missing(),
      missing_fields: ["area_location"],
      ambiguous_fields: []
    };
  }

  if (text.includes("cable pulling for c-305")) {
    return {
      activity_text: field("Cable pulling for C-305", "Cable pulling for C-305", "EXPLICIT"),
      discipline: field("ELECTRICAL", "Cable pulling", "EXPLICIT"),
      area_location: field("Utility Area", "Utility Area", "EXPLICIT"),
      asset_tag: field("C-305", "C-305", "EXPLICIT"),
      work_status: field("COMPLETED", "completed", "EXPLICIT") as any,
      actual_start: missing(),
      actual_finish: field(new Date().toISOString().slice(0, 10), "report date", "DERIVED_FROM_REPORT_DATE"),
      progress_value: missing() as any,
      progress_unit: missing(),
      crew_size: missing() as any,
      delay_reason: missing(),
      remarks: missing(),
      missing_fields: ["actual_start"],
      ambiguous_fields: []
    };
  }

  if (text.trim() === "work done." || text.trim() === "work done") {
    return {
      activity_text: field("Work done", "Work done.", "EXPLICIT"),
      discipline: missing(),
      area_location: missing(),
      asset_tag: missing(),
      work_status: field("UNKNOWN", "Work done.", "EXPLICIT") as any,
      actual_start: missing(),
      actual_finish: missing(),
      progress_value: missing() as any,
      progress_unit: missing(),
      crew_size: missing() as any,
      delay_reason: missing(),
      remarks: missing(),
      missing_fields: ["discipline", "area_location", "asset_tag", "actual_start", "actual_finish"],
      ambiguous_fields: ["activity_text"]
    };
  }

  // Generic fallback for any other free-text input in demo mode: extract
  // only the raw text as activity_text, everything else missing.
  return {
    activity_text: field(rawInput.slice(0, 300), rawInput.slice(0, 300), "EXPLICIT"),
    discipline: missing(),
    area_location: missing(),
    asset_tag: missing(),
    work_status: field("UNKNOWN", null, "MISSING") as any,
    actual_start: missing(),
    actual_finish: missing(),
    progress_value: missing() as any,
    progress_unit: missing(),
    crew_size: missing() as any,
    delay_reason: missing(),
    remarks: missing(),
    missing_fields: ["discipline", "area_location", "asset_tag"],
    ambiguous_fields: []
  };
}

export function demoRerankFor(
  extraction: LlmExtraction,
  candidates: CandidateActivity[]
): RerankResult {
  if (candidates.length === 0) {
    return {
      selected_candidate_id: null,
      llm_match_assessment: "NO_MATCH",
      candidate_reason: "No candidate activities were supplied for this project.",
      ambiguity_notes: null
    };
  }

  const tag = (extraction.asset_tag.value || "").toLowerCase();
  const strongMatch = tag
    ? candidates.find((c) => c.normalized_search_text.toLowerCase().includes(tag))
    : undefined;

  if (strongMatch) {
    return {
      selected_candidate_id: strongMatch.activity_id,
      llm_match_assessment: "HIGH",
      candidate_reason: `Asset/line tag "${extraction.asset_tag.value}" and discipline align with ${strongMatch.activity_name}.`,
      ambiguity_notes: null
    };
  }

  return {
    selected_candidate_id: null,
    llm_match_assessment: "LOW",
    candidate_reason: "Evidence in the supervisor update does not clearly distinguish between the top candidates.",
    ambiguity_notes: "Multiple candidates share similar semantic and contextual signals."
  };
}
