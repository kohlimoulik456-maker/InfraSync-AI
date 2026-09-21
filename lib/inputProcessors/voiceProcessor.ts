// STUB ONLY. Voice Update is intentionally unavailable in the MVP.
// This module must never request microphone permission, open a recorder,
// create supervisor update data, or call the backend AI pipeline / Gemini.

export interface StubResponse {
  status: "COMING_SOON";
  message: string;
}

export function processVoiceUpdate(): StubResponse {
  return {
    status: "COMING_SOON",
    message: "Voice-to-text processing is not available in the MVP. Please use Text Update or Excel Upload."
  };
}
