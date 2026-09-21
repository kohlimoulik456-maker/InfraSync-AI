export const EXTRACTION_SYSTEM_PROMPT = `You are InfraSync Time Agent, an infrastructure-project progress extraction assistant.

Extract only facts explicitly stated in a supervisor field update.
Return valid JSON only, matching the provided schema.

Rules:
1. Never create, guess or invent a Primavera Activity_ID.
2. If any information is not stated, return null.
3. Extract activity text, discipline, area/location, asset/line/tag, work status, actual start, actual finish, progress value, progress unit, crew size, delay reason and remarks only when explicitly supported.
4. Use supplied report date and timezone only to convert explicit relative terms such as 'today'.
5. Mark date based on report date as DERIVED_FROM_REPORT_DATE.
6. Preserve exact source phrases as evidence.
7. Allowed statuses: STARTED, IN_PROGRESS, COMPLETED, ON_HOLD, DELAYED, UNKNOWN.
8. Never estimate duration, delay days, costs, quantities or completion percentage.
9. List missing and ambiguous fields.
10. Do not output final confidence percentage.`;

export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    activity_text: { $ref: "#/definitions/field_string" },
    discipline: { $ref: "#/definitions/field_string" },
    area_location: { $ref: "#/definitions/field_string" },
    asset_tag: { $ref: "#/definitions/field_string" },
    work_status: { $ref: "#/definitions/field_string" },
    actual_start: { $ref: "#/definitions/field_string" },
    actual_finish: { $ref: "#/definitions/field_string" },
    progress_value: { $ref: "#/definitions/field_number" },
    progress_unit: { $ref: "#/definitions/field_string" },
    crew_size: { $ref: "#/definitions/field_number" },
    delay_reason: { $ref: "#/definitions/field_string" },
    remarks: { $ref: "#/definitions/field_string" },
    missing_fields: { type: "array", items: { type: "string" } },
    ambiguous_fields: { type: "array", items: { type: "string" } }
  },
  required: [
    "activity_text",
    "discipline",
    "area_location",
    "asset_tag",
    "work_status",
    "actual_start",
    "actual_finish",
    "progress_value",
    "progress_unit",
    "crew_size",
    "delay_reason",
    "remarks",
    "missing_fields",
    "ambiguous_fields"
  ],
  definitions: {
    field_string: {
      type: "object",
      properties: {
        value: { type: ["string", "null"] },
        evidence_text: { type: ["string", "null"] },
        evidence_status: { enum: ["EXPLICIT", "DERIVED_FROM_REPORT_DATE", "MISSING"] }
      },
      required: ["value", "evidence_text", "evidence_status"]
    },
    field_number: {
      type: "object",
      properties: {
        value: { type: ["number", "null"] },
        evidence_text: { type: ["string", "null"] },
        evidence_status: { enum: ["EXPLICIT", "DERIVED_FROM_REPORT_DATE", "MISSING"] }
      },
      required: ["value", "evidence_text", "evidence_status"]
    }
  }
} as const;

export function buildExtractionUserPrompt(rawInput: string, reportDateIso: string): string {
  return `Report date: ${reportDateIso}

Supervisor field update:
"""
${rawInput}
"""

Return only the JSON object described by the schema.`;
}
