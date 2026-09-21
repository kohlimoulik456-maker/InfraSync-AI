import { NextResponse } from "next/server";
import { generatePresentationSheet } from "@/lib/templates";

export async function GET() {
  const buffer = generatePresentationSheet("Supervisor_Updates");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="InfraSync_Judge_Supervisor_Updates.xlsx"'
    }
  });
}