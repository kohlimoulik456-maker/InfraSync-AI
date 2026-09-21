import { NextResponse } from "next/server";
import { generatePresentationWorkbook } from "@/lib/templates";

export async function GET() {
  const buffer = generatePresentationWorkbook();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="InfraSync_Judge_Demo_Workbook.xlsx"'
    }
  });
}