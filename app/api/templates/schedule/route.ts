import { NextResponse } from "next/server";
import { generateBlankScheduleTemplate } from "@/lib/templates";

export async function GET() {
  const buffer = generateBlankScheduleTemplate();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="InfraSync_Schedule_Format.xlsx"'
    }
  });
}
