import { NextRequest, NextResponse } from "next/server";
import { analyzeEmailWithAI } from "@/lib/analyze-email";

export async function POST(request: NextRequest) {
  try {
    const { emailContent, emailSubject, emailFrom, emailDate } =
      await request.json();

    const result = await analyzeEmailWithAI({
      emailContent,
      emailSubject,
      emailFrom,
      emailDate,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Error analyzing email:", error.message);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to analyze email",
      },
      { status: 500 }
    );
  }
}
