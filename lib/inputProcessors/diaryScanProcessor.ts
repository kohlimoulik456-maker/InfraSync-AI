// STUB ONLY. Scan Site Diary is intentionally unavailable in the MVP.
// This module must never request camera permission, open the device camera,
// process/upload an image, or call the backend AI pipeline / Gemini.

export interface StubResponse {
  status: "COMING_SOON";
  message: string;
}

export function processDiaryScan(): StubResponse {
  return {
    status: "COMING_SOON",
    message: "OCR processing for scanned diaries is not available in the MVP. Please use Text Update or Excel Upload."
  };
}
